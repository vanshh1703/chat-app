const { pool } = require('./db');

module.exports = (io, socket) => {
    // Helper to safely emit to a target
    const safeEmit = (to, event, payload) => {
        if (!to) return;
        try {
            io.to(to.toString()).emit(event, payload);
        } catch (err) {
            console.error(`Error emitting ${event} to ${to}:`, err);
        }
    };

    // Helper to log call to message history
    const logCallToChat = async (callId, callerId, receiverId, type, status, duration = 0) => {
        try {
            if (!callId) return;

            // Check if already logged using is_chat_logged flag
            const checkRes = await pool.query('SELECT is_chat_logged FROM call_logs WHERE id = $1', [callId]);
            if (checkRes.rows.length === 0 || checkRes.rows[0].is_chat_logged) return;

            let content = '';
            if (status === 'missed') content = `Missed ${type} call`;
            else if (status === 'rejected') content = `${type.charAt(0).toUpperCase() + type.slice(1)} call rejected`;
            else if (status === 'ended') {
                const mins = Math.floor(duration / 60);
                const secs = duration % 60;
                const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                content = `${type.charAt(0).toUpperCase() + type.slice(1)} call ended • ${durationStr}`;
            }

            // Mark as logged FIRST to prevent race conditions
            await pool.query('UPDATE call_logs SET is_chat_logged = TRUE WHERE id = $1', [callId]);

            const result = await pool.query(
                'INSERT INTO messages (sender_id, receiver_id, content, message_type) VALUES ($1, $2, $3, $4) RETURNING *',
                [callerId, receiverId, content, 'call']
            );

            const newMessage = result.rows[0];
            safeEmit(callerId, 'receive_message', newMessage);
            safeEmit(receiverId, 'receive_message', newMessage);
        } catch (err) {
            console.error("Error logging call to chat:", err);
        }
    };

    // 1. Initial Call Request
    socket.on('call-user', async (data) => {
        try {
            const { to, from, name, avatar, type } = data;
            if (!to) return;
            console.log(`Call from ${from} (${name}) to ${to} [${type}]`);

            // Initial log as 'missed' (if not picked up)
            const result = await pool.query(
                'INSERT INTO call_logs (caller_id, receiver_id, call_type, status) VALUES ($1, $2, $3, $4) RETURNING id',
                [from, to, type, 'missed']
            );
            const callId = result.rows[0].id;
            socket.currentCallId = callId;

            // Send callId to both caller and receiver
            socket.emit('call-initiated', { callId });
            safeEmit(to, 'incoming-call', { from, name, avatar, type, callId });
        } catch (err) {
            console.error("Error in call-user:", err);
        }
    });

    // 2. Call Accepted
    socket.on('accept-call', async (data) => {
        try {
            const { to, callId } = data;
            if (!to) return;
            const cid = callId || socket.currentCallId;
            console.log(`Call accepted by ${socket.userId}, notifying ${to} [CallID: ${cid}]`);

            // Update log to 'ongoing'
            if (cid) {
                await pool.query('UPDATE call_logs SET status = $1 WHERE id = $2', ['ongoing', cid]);
            }

            safeEmit(to, 'accept-call', { from: socket.userId, callId: cid });
        } catch (err) {
            console.error("Error in accept-call:", err);
        }
    });

    // 3. Call Rejected
    socket.on('reject-call', async (data) => {
        try {
            const { to, callId } = data;
            if (!to) return;
            const cid = callId || socket.currentCallId;
            console.log(`Call rejected by ${socket.userId}, notifying ${to} [CallID: ${cid}]`);

            if (cid) {
                // Check current status to avoid double logging
                const checkRes = await pool.query('SELECT status FROM call_logs WHERE id = $1', [cid]);
                if (checkRes.rows[0]?.status === 'missed' || checkRes.rows[0]?.status === 'rejected') {
                    await pool.query('UPDATE call_logs SET status = $1, ended_at = CURRENT_TIMESTAMP WHERE id = $2', ['rejected', cid]);

                    const callRes = await pool.query('SELECT * FROM call_logs WHERE id = $1', [cid]);
                    const call = callRes.rows[0];
                    await logCallToChat(cid, call.caller_id, call.receiver_id, call.call_type, 'rejected');
                }
            }

            safeEmit(to, 'reject-call', { from: socket.userId });
        } catch (err) {
            console.error("Error in reject-call:", err);
        }
    });

    // 4. WebRTC Offer
    socket.on('send-offer', (data) => {
        try {
            const { to, offer } = data;
            if (!to) return;
            safeEmit(to, 'send-offer', { from: socket.userId, offer });
        } catch (err) {
            console.error("Error in send-offer:", err);
        }
    });

    // 5. WebRTC Answer
    socket.on('send-answer', (data) => {
        try {
            const { to, answer } = data;
            if (!to) return;
            safeEmit(to, 'send-answer', { from: socket.userId, answer });
        } catch (err) {
            console.error("Error in send-answer:", err);
        }
    });

    // 6. ICE Candidate Exchange
    socket.on('ice-candidate', (data) => {
        try {
            const { to, candidate } = data;
            if (!to) return;
            safeEmit(to, 'ice-candidate', { from: socket.userId, candidate });
        } catch (err) {
            console.error("Error in ice-candidate:", err);
        }
    });

    // 7. End Call
    socket.on('end-call', async (data) => {
        try {
            const { to, callId } = data;
            if (!to) return;
            const cid = callId || socket.currentCallId;
            console.log(`Call ended by ${socket.userId}, notifying ${to} [CallID: ${cid}]`);

            if (cid) {
                const now = new Date();
                const callRes = await pool.query('SELECT created_at, status, caller_id, receiver_id, call_type FROM call_logs WHERE id = $1', [cid]);
                const call = callRes.rows[0];

                if (!call) return;

                if (call.status === 'ongoing') {
                    const duration = Math.floor((now - new Date(call.created_at)) / 1000);
                    await pool.query(
                        'UPDATE call_logs SET status = $1, duration = $2, ended_at = CURRENT_TIMESTAMP WHERE id = $3',
                        ['ended', duration, cid]
                    );
                    await logCallToChat(cid, call.caller_id, call.receiver_id, call.call_type, 'ended', duration);
                } else if (call.status === 'missed') {
                    // Only log as missed if it hasn't been logged yet
                    await logCallToChat(cid, call.caller_id, call.receiver_id, call.call_type, 'missed');
                }
            }

            safeEmit(to, 'end-call', { from: socket.userId });
        } catch (err) {
            console.error("Error in end-call:", err);
        }
    });
};
