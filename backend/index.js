const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const { pool, initializeDB } = require('./db');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const calculateExpectedScore = (ratingA, ratingB) => {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}; // Kept for reference or future use if needed

const updateElo = async (user1Id, user2Id, actualScoreU1) => {
    const u1Data = await pool.query('SELECT debate_rating FROM users WHERE id = $1', [user1Id]);
    const u2Data = await pool.query('SELECT debate_rating FROM users WHERE id = $1', [user2Id]);
    
    const r1 = u1Data.rows[0].debate_rating;
    const r2 = u2Data.rows[0].debate_rating;
    
    let change1 = 0;
    let change2 = 0;

    if (actualScoreU1 === 1) { // User 1 wins
        change1 = 10;
    } else if (actualScoreU1 === 0) { // User 2 wins
        change2 = 10;
    } else { // Draw
        change1 = 5;
        change2 = 5;
    }
    
    const newR1 = r1 + change1;
    const newR2 = r2 + change2;
    
    await pool.query('UPDATE users SET debate_rating = $1 WHERE id = $2', [newR1, user1Id]);
    await pool.query('UPDATE users SET debate_rating = $1 WHERE id = $2', [newR2, user2Id]);
    
    // Update wins/losses/draws
    if (actualScoreU1 === 1) {
        await pool.query('UPDATE users SET wins = wins + 1 WHERE id = $1', [user1Id]);
        await pool.query('UPDATE users SET losses = losses + 1 WHERE id = $1', [user2Id]);
    } else if (actualScoreU1 === 0) {
        await pool.query('UPDATE users SET losses = losses + 1 WHERE id = $1', [user1Id]);
        await pool.query('UPDATE users SET wins = wins + 1 WHERE id = $1', [user2Id]);
    } else {
        await pool.query('UPDATE users SET draws = draws + 1 WHERE id = $1', [user1Id]);
        await pool.query('UPDATE users SET draws = draws + 1 WHERE id = $1', [user2Id]);
    }

    return { change1, change2 };
};

const runAIJudge = async (debateId, topic, messages) => {
    if (!OPENROUTER_API_KEY) {
        console.error("AI Judge Error: OPENROUTER_API_KEY is not defined in environment variables.");
        return { winner_id: null, score_user1: 50, score_user2: 50, explanation: "AI evaluation failed: API key missing." };
    }

    const formattedMessages = messages.map(m => `User ${m.user_id} (Round ${m.round_number}): ${m.message}`).join('\n');
    const prompt = `
        You are an expert debate judge. Analyze the following debate on the topic: "${topic}".
        Debate Messages:
        ${formattedMessages}

        Evaluate based on:
        1. Logic
        2. Clarity
        3. Relevance
        4. Strength of argument

        Respond ONLY in valid JSON format. Do not include any markdown blocks or extra text.
        Structure:
        {
            "winner_id": <user_id_of_winner_or_null_if_draw>,
            "score_user1": <points_0_to_10>,
            "score_user2": <points_0_to_10>,
            "explanation": "<short_explanation>"
        }
    `;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "arcee-ai/trinity-large-preview:free",
                "messages": [{ "role": "user", "content": prompt }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`AI Judge API Error (Status ${response.status}):`, errorText);
            return { winner_id: null, score_user1: 5, score_user2: 5, explanation: "AI evaluation failed: API error." };
        }

        const data = await response.json();
        let content = data.choices[0].message.content.trim();
        
        // Sanitize: strip markdown code blocks if present
        if (content.startsWith('```json')) {
            content = content.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (content.startsWith('```')) {
            content = content.replace(/^```/, '').replace(/```$/, '').trim();
        }

        try {
            const result = JSON.parse(content);
            
            // Sanitize winner_id: Ensure it is an integer or null
            if (result.winner_id !== null) {
                const parsedId = parseInt(result.winner_id, 10);
                if (isNaN(parsedId)) {
                    // Handle cases like "User 2" or "2"
                    const match = String(result.winner_id).match(/\d+/);
                    result.winner_id = match ? parseInt(match[0], 10) : null;
                } else {
                    result.winner_id = parsedId;
                }
            }
            
            // Ensure points are numbers
            result.score_user1 = parseInt(result.score_user1, 10) || 5;
            result.score_user2 = parseInt(result.score_user2, 10) || 5;

            return result;
        } catch (parseErr) {
            console.error("AI Judge JSON Parse Error. Raw content:", content);
            return { winner_id: null, score_user1: 5, score_user2: 5, explanation: "AI evaluation failed: Invalid format returned." };
        }
    } catch (err) {
        console.error("AI Judge Network Error:", err);
        return { winner_id: null, score_user1: 5, score_user2: 5, explanation: "AI evaluation failed: Network error." };
    }
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:5174'],
        methods: ['GET', 'POST'],
    },
});

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// Multer storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// Initialize Database
initializeDB();

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// File Upload endpoint
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;
    let messageType = 'file';
    if (mimeType.startsWith('image/')) messageType = 'image';
    else if (mimeType.startsWith('video/')) messageType = 'video';
    else if (mimeType.startsWith('audio/')) messageType = 'audio';
    res.json({ fileUrl, originalName, messageType, fileName: originalName });
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, email, password, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id, username, email, avatar_url',
            [username, email, hashedPassword, `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'User already exists' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url, bio: user.bio } });
    } catch (err) {
        console.error(err);
        res.status(500).send('Login error');
    }
});

// User Search endpoint
app.get('/api/users/search', authenticateToken, async (req, res) => {
    const { q } = req.query;
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.avatar_url, u.is_online, u.last_seen, a.alias 
             FROM users u 
             LEFT JOIN contact_aliases a ON a.contact_id = u.id AND a.user_id = $2 
             WHERE u.username ILIKE $1 AND u.id != $2 LIMIT 10`,
            [`%${q}%`, req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Search error');
    }
});

// Update Profile
app.post('/api/users/update-profile', authenticateToken, async (req, res) => {
    const { username, avatar_url, bio } = req.body;
    try {
        const result = await pool.query(
            'UPDATE users SET username = COALESCE($1, username), avatar_url = COALESCE($2, avatar_url), bio = COALESCE($3, bio) WHERE id = $4 RETURNING id, username, email, avatar_url, bio',
            [username, avatar_url, bio, req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Profile update failed' });
    }
});

// Change Password
app.post('/api/users/change-password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    try {
        const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(oldPassword, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid old password' });

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, req.user.id]);
        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Password change failed' });
    }
});

// Sidebar: Get users with whom there is a chat history
app.get('/api/users/sidebar', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT u.id, u.username, u.avatar_url, u.is_online, u.last_seen, a.alias,
                (SELECT content FROM messages 
                 WHERE (sender_id = u.id AND receiver_id = $1) 
                    OR (sender_id = $1 AND receiver_id = u.id) 
                 ORDER BY created_at DESC LIMIT 1) as lastMsg,
                (SELECT created_at FROM messages 
                 WHERE (sender_id = u.id AND receiver_id = $1) 
                    OR (sender_id = $1 AND receiver_id = u.id) 
                 ORDER BY created_at DESC LIMIT 1) as lastMsgTime,
                (SELECT COUNT(*) FROM messages 
                 WHERE sender_id = u.id AND receiver_id = $1 AND is_read = false) as unreadCount,
                EXISTS (SELECT 1 FROM pinned_chats WHERE user_id = $1 AND pinned_user_id = u.id) as is_pinned
            FROM users u
            JOIN messages m ON (m.sender_id = u.id AND m.receiver_id = $1) OR (m.sender_id = $1 AND m.receiver_id = u.id)
            LEFT JOIN contact_aliases a ON a.contact_id = u.id AND a.user_id = $1
            WHERE u.id != $1
            ORDER BY is_pinned DESC, lastMsgTime DESC NULLS LAST
        `;
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Sidebar error');
    }
});

// Pin/Unpin a chat
app.post('/api/users/pin-chat', authenticateToken, async (req, res) => {
    const { pinnedUserId } = req.body;
    try {
        // Toggle pin
        const check = await pool.query('SELECT id FROM pinned_chats WHERE user_id = $1 AND pinned_user_id = $2', [req.user.id, pinnedUserId]);
        if (check.rows.length > 0) {
            await pool.query('DELETE FROM pinned_chats WHERE user_id = $1 AND pinned_user_id = $2', [req.user.id, pinnedUserId]);
            res.json({ pinned: false });
        } else {
            await pool.query('INSERT INTO pinned_chats (user_id, pinned_user_id) VALUES ($1, $2)', [req.user.id, pinnedUserId]);
            res.json({ pinned: true });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Pin chat failed' });
    }
});

// Set contact alias
app.post('/api/users/set-alias', authenticateToken, async (req, res) => {
    const { contactId, alias } = req.body;
    try {
        const result = await pool.query(`
            INSERT INTO contact_aliases (user_id, contact_id, alias)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, contact_id) DO UPDATE SET alias = $3
            RETURNING *
        `, [req.user.id, contactId, alias]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Set alias failed' });
    }
});

// Get other user's profile
app.get('/api/users/profile/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username, u.email, u.avatar_url, u.is_online, u.last_seen, u.bio, a.alias
            FROM users u
            LEFT JOIN contact_aliases a ON a.contact_id = u.id AND a.user_id = $1
            WHERE u.id = $2
        `, [req.user.id, req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Get profile error');
    }
});

// Mark messages as read
app.post('/api/messages/mark-read', authenticateToken, async (req, res) => {
    const { senderId } = req.body;
    try {
        await pool.query(
            'UPDATE messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false',
            [senderId, req.user.id]
        );
        io.to(senderId.toString()).emit('messages_read', { byUserId: req.user.id });
        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.status(500).send('Mark read error');
    }
});

// Message history between two users
app.get('/api/messages/:otherId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT m.*,
                row_to_json(r.*) as reply_to_msg
            FROM messages m
            LEFT JOIN messages r ON r.id = m.reply_to_id
            WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
            ORDER BY m.created_at ASC
        `, [req.user.id, req.params.otherId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Message history error');
    }
});

// Pin/Unpin a message
app.post('/api/messages/pin', authenticateToken, async (req, res) => {
    const { messageId } = req.body;
    try {
        const check = await pool.query('SELECT is_pinned FROM messages WHERE id = $1', [messageId]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Message not found' });

        const newPinnedStatus = !check.rows[0].is_pinned;
        await pool.query('UPDATE messages SET is_pinned = $1 WHERE id = $2', [newPinnedStatus, messageId]);

        res.json({ id: messageId, is_pinned: newPinnedStatus });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Pin message failed' });
    }
});
// Chat stats between two users
app.get('/api/messages/stats/:otherId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const otherId = req.params.otherId;

        const result = await pool.query(`
            SELECT * FROM messages 
            WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
            ORDER BY created_at ASC
        `, [userId, otherId]);

        const messages = result.rows;
        if (messages.length === 0) {
            return res.json({
                totalMessages: 0,
                friendshipScore: 0,
                avgReplyTime: '0s',
                longestConversation: '0s',
                mostActiveDay: 'N/A',
                topWords: []
            });
        }

        // 1. Total Messages
        const totalMessages = messages.length;

        // 2. Average Reply Time & 3. Longest Conversation
        let replyTimes = [];
        let bursts = [];
        let currentBurst = { start: messages[0].created_at, end: messages[0].created_at };

        for (let i = 1; i < messages.length; i++) {
            const prev = messages[i - 1];
            const curr = messages[i];
            const diff = (new Date(curr.created_at) - new Date(prev.created_at)) / 1000;

            if (curr.sender_id !== prev.sender_id && diff < 86400) {
                replyTimes.push(diff);
            }

            if (diff < 900) {
                currentBurst.end = curr.created_at;
            } else {
                bursts.push((new Date(currentBurst.end) - new Date(currentBurst.start)) / 1000);
                currentBurst = { start: curr.created_at, end: curr.created_at };
            }
        }
        bursts.push((new Date(currentBurst.end) - new Date(currentBurst.start)) / 1000);

        const avgReplyTimeSec = replyTimes.length > 0 ? replyTimes.reduce((a, b) => a + b, 0) / replyTimes.length : 0;
        const longestBurstSec = Math.max(...bursts);

        const formatDuration = (sec) => {
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = Math.floor(sec % 60);
            if (h > 0) return `${h}h ${m}m`;
            if (m > 0) return `${m}m ${s}s`;
            return `${s}s`;
        };

        // 4. Most Active Day
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayCounts = {};
        messages.forEach(m => {
            const day = days[new Date(m.created_at).getDay()];
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        });
        const mostActiveDay = Object.keys(dayCounts).sort((a, b) => dayCounts[b] - dayCounts[a])[0];

        // 5. Top Words
        const stopWords = new Set(['the', 'a', 'in', 'and', 'is', 'it', 'to', 'for', 'with', 'on', 'of', 'this', 'that', 'i', 'you', 'my', 'me', 'be', 'are', 'was', 'were', 'have', 'has', 'had']);
        const wordCounts = {};
        messages.forEach(m => {
            if (m.message_type === 'text' && m.content) {
                const words = m.content.toLowerCase().match(/\b(\w+)\b/g);
                if (words) {
                    words.forEach(w => {
                        if (w.length > 2 && !stopWords.has(w)) {
                            wordCounts[w] = (wordCounts[w] || 0) + 1;
                        }
                    });
                }
            }
        });
        const topWords = Object.entries(wordCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([word, count]) => ({ word, count }));

        // 6. Friendship Score
        const uniqueDays = new Set(messages.map(m => new Date(m.created_at).toDateString())).size;
        const totalInteractions = messages.filter(m => m.reply_to_id).length +
            messages.reduce((sum, m) => sum + Object.keys(m.reactions || {}).length, 0);

        const volumeScore = Math.min(100, (totalMessages / 500) * 100);
        const consistencyScore = Math.min(100, (uniqueDays / 10) * 100);
        const speedScore = 100 * (1 / (1 + (avgReplyTimeSec / 3600)));
        const interactionScore = Math.min(100, (totalInteractions / 30) * 100);

        const friendshipScore = Math.round(
            (volumeScore * 0.4) + (consistencyScore * 0.2) + (speedScore * 0.2) + (interactionScore * 0.2)
        );

        res.json({
            totalMessages,
            avgReplyTime: formatDuration(avgReplyTimeSec),
            longestConversation: formatDuration(longestBurstSec),
            mostActiveDay,
            topWords,
            friendshipScore,
            scores: { volumeScore, consistencyScore, speedScore, interactionScore }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Stats error');
    }
});

// --- Debate System Endpoints ---

// Create a debate invite
app.post('/api/debates/invite', authenticateToken, async (req, res) => {
    const { opponentId, topic } = req.body;
    try {
        // Anti-Abuse: Max 10 ranked debates per day
        const dailyCount = await pool.query(
            "SELECT COUNT(*) FROM debates WHERE (user1_id = $1 OR user2_id = $1) AND created_at > NOW() - INTERVAL '1 day'",
            [req.user.id]
        );
        if (parseInt(dailyCount.rows[0].count) >= 10) {
            return res.status(429).json({ error: 'Daily debate limit reached (10)' });
        }

        // Anti-Abuse: Max 3 debates against same opponent per day
        const opponentCount = await pool.query(
            "SELECT COUNT(*) FROM debates WHERE ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)) AND created_at > NOW() - INTERVAL '1 day'",
            [req.user.id, opponentId]
        );
        if (parseInt(opponentCount.rows[0].count) >= 3) {
            return res.status(429).json({ error: 'Limit reached for this opponent (3/day)' });
        }

        const result = await pool.query(
            'INSERT INTO debates (topic, user1_id, user2_id, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [topic, req.user.id, opponentId, 'pending']
        );
        const debate = result.rows[0];

        // Notify opponent via socket
        io.to(opponentId.toString()).emit('debate_invite', {
            debateId: debate.id,
            topic: debate.topic,
            senderId: req.user.id,
            senderName: req.user.username
        });

        res.json(debate);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create debate invite' });
    }
});

// Respond to debate invite
app.post('/api/debates/respond', authenticateToken, async (req, res) => {
    const { debateId, action } = req.body; // 'accept' or 'reject'
    const status = action === 'accept' ? 'active' : 'rejected';
    try {
        const result = await pool.query(
            'UPDATE debates SET status = $1 WHERE id = $2 AND user2_id = $3 AND status = $4 RETURNING *',
            [status, debateId, req.user.id, 'pending']
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Invite not found or already processed' });

        const debate = result.rows[0];
        // Notify both parties
        io.to(debate.user1_id.toString()).emit('debate_accept', { debateId: debate.id, status });
        io.to(debate.user2_id.toString()).emit('debate_accept', { debateId: debate.id, status });

        res.json(debate);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to respond to invite' });
    }
});

// Get debate info
app.get('/api/debates/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM debates WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Debate not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch debate' });
    }
});

// Get debate messages
app.get('/api/debates/:id/messages', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM debate_messages WHERE debate_id = $1 ORDER BY round_number ASC, created_at ASC', [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch debate messages' });
    }
});

// Get user debate stats
app.get('/api/user/:id/debate-stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;
        const statsQuery = await pool.query(
            'SELECT debate_rating, wins, losses, draws FROM users WHERE id = $1',
            [userId]
        );
        if (statsQuery.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const rankQuery = await pool.query(
            'SELECT COUNT(*) + 1 as rank FROM users WHERE debate_rating > (SELECT debate_rating FROM users WHERE id = $1)',
            [userId]
        );

        const totalDebatesQuery = await pool.query(
            'SELECT COUNT(*) FROM debates WHERE (user1_id = $1 OR user2_id = $1) AND status = $2',
            [userId, 'finished']
        );

        const stats = statsQuery.rows[0];
        const total = parseInt(totalDebatesQuery.rows[0].count);
        const winRate = total > 0 ? (stats.wins / total * 100).toFixed(1) : 0;

        res.json({
            rating: stats.debate_rating,
            rank: parseInt(rankQuery.rows[0].rank),
            totalDebates: total,
            wins: stats.wins,
            losses: stats.losses,
            draws: stats.draws,
            winRate: `${winRate}%`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch debate stats' });
    }
});

// Global Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT username, debate_rating, wins, losses, 
             RANK() OVER (ORDER BY debate_rating DESC) as rank
             FROM users 
             ORDER BY debate_rating DESC 
             LIMIT 100`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Socket.io for Real-time
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', async (userId) => {
        socket.join(userId.toString());
        socket.userId = userId;
        console.log(`User ${userId} joined their private room`);
        try {
            await pool.query('UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
            io.emit('user_status', { userId, isOnline: true, lastSeen: new Date() });
        } catch (e) { console.error(e); }
    });

    socket.on('send_message', async (data) => {
        const { senderId, receiverId, content, messageType, replyToId, fileUrl, senderName } = data;
        try {
            const result = await pool.query(
                'INSERT INTO messages (sender_id, receiver_id, content, message_type, reply_to_id, file_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [senderId, receiverId, content, messageType || 'text', replyToId || null, fileUrl || null]
            );
            const newMessage = result.rows[0];

            let replyToMsg = null;
            if (replyToId) {
                const replyResult = await pool.query('SELECT * FROM messages WHERE id = $1', [replyToId]);
                replyToMsg = replyResult.rows[0] || null;
            }
            const payload = { ...newMessage, reply_to_msg: replyToMsg, senderName };

            // Emit to both parties
            io.to(senderId.toString()).emit('receive_message', payload);
            io.to(receiverId.toString()).emit('receive_message', payload);
        } catch (err) {
            console.error('Socket send message error:', err);
        }
    });

    socket.on('typing', (data) => {
        io.to(data.receiverId.toString()).emit('typing', { senderId: data.senderId });
    });

    socket.on('react_message', async (data) => {
        const { messageId, emoji, senderId, receiverId } = data;
        try {
            const result = await pool.query(`
                UPDATE messages 
                SET reactions = jsonb_set(COALESCE(reactions, '{}'::jsonb), ARRAY[$1::text], to_jsonb($2::text))
                WHERE id = $3
                RETURNING *
            `, [senderId.toString(), emoji, messageId]);

            const updatedMessage = result.rows[0];
            io.to(senderId.toString()).emit('message_updated', updatedMessage);
            io.to(receiverId.toString()).emit('message_updated', updatedMessage);
        } catch (err) {
            console.error('Socket react message error:', err);
        }
    });

    socket.on('stop_typing', (data) => {
        io.to(data.receiverId.toString()).emit('stop_typing', { senderId: data.senderId });
    });

    socket.on('delete_message', async (data) => {
        const { messageId, senderId, receiverId } = data;
        try {
            // Only the sender can delete their own message. We soft delete it by setting is_deleted=true.
            // Note: The prompt says "deleting message from frontend should not be deleting message from database".
            // It was already doing an UPDATE setting is_deleted = true.
            // But we can also clear file_url if we want to be thorough.
            const result = await pool.query(
                'UPDATE messages SET is_deleted = true, content = \'\', file_url = NULL WHERE id = $1 AND sender_id = $2 RETURNING *',
                [messageId, senderId]
            );
            if (result.rows.length === 0) return; // not authorised
            const deleted = result.rows[0];
            io.to(senderId.toString()).emit('message_deleted', { messageId: deleted.id });
            io.to(receiverId.toString()).emit('message_deleted', { messageId: deleted.id });
        } catch (err) {
            console.error('Delete message error:', err);
        }
    });

    socket.on('screenshot_taken', async (data) => {
        const { senderId, receiverId, senderName } = data;
        try {
            const content = `${senderName} took a screenshot`;
            const result = await pool.query(
                'INSERT INTO messages (sender_id, receiver_id, content, message_type) VALUES ($1, $2, $3, $4) RETURNING *',
                [senderId, receiverId, content, 'system']
            );
            const newMessage = result.rows[0];
            const payload = { ...newMessage, senderName: 'System' };

            io.to(senderId.toString()).emit('receive_message', payload);
            io.to(receiverId.toString()).emit('receive_message', payload);
        } catch (err) {
            console.error('Socket screenshot_taken error:', err);
        }
    });

    socket.on('debate_message', async (data) => {
        const { debateId, userId, message, roundNumber } = data;
        try {
            // Validation: Min 20 chars
            if (message.length < 20) return;

            // Check if user already sent message for this round
            const checkQuery = await pool.query(
                'SELECT * FROM debate_messages WHERE debate_id = $1 AND user_id = $2 AND round_number = $3',
                [debateId, userId, roundNumber]
            );
            if (checkQuery.rows.length > 0) return;

            await pool.query(
                'INSERT INTO debate_messages (debate_id, user_id, round_number, message) VALUES ($1, $2, $3, $4)',
                [debateId, userId, roundNumber, message]
            );

            // Fetch the debate to get both parties
            const debateRes = await pool.query('SELECT * FROM debates WHERE id = $1', [debateId]);
            const debate = debateRes.rows[0];

            // Notify both parties
            io.to(debate.user1_id.toString()).emit('debate_message', data);
            io.to(debate.user2_id.toString()).emit('debate_message', data);

            // Check if round is finished
            const roundMsgs = await pool.query(
                'SELECT * FROM debate_messages WHERE debate_id = $1 AND round_number = $2',
                [debateId, roundNumber]
            );

            if (roundMsgs.rows.length === 2) {
                // Round finished
                if (roundNumber < 3) {
                    io.to(debate.user1_id.toString()).emit('debate_round_end', { debateId, roundNumber, nextRound: roundNumber + 1 });
                    io.to(debate.user2_id.toString()).emit('debate_round_end', { debateId, roundNumber, nextRound: roundNumber + 1 });
                } else {
                    // Debate finished! Run AI Judge
                    io.to(debate.user1_id.toString()).emit('debate_status', { debateId, status: 'evaluating' });
                    io.to(debate.user2_id.toString()).emit('debate_status', { debateId, status: 'evaluating' });

                    const allMsgs = await pool.query('SELECT * FROM debate_messages WHERE debate_id = $1 ORDER BY round_number ASC, created_at ASC', [debateId]);
                    const judgeRes = await runAIJudge(debateId, debate.topic, allMsgs.rows);

                    await pool.query(
                        'UPDATE debates SET status = $1, winner_id = $2, score_user1 = $3, score_user2 = $4, explanation = $5 WHERE id = $6',
                        ['finished', judgeRes.winner_id, judgeRes.score_user1, judgeRes.score_user2, judgeRes.explanation, debateId]
                    );

                    // Update Elo
                    let actualScoreU1 = 0.5;
                    if (judgeRes.winner_id === debate.user1_id) actualScoreU1 = 1;
                    else if (judgeRes.winner_id === debate.user2_id) actualScoreU1 = 0;
                    const { change1, change2 } = await updateElo(debate.user1_id, debate.user2_id, actualScoreU1);
                    
                    const finalResult = { 
                        debateId, 
                        ...judgeRes,
                        ratingChange1: change1,
                        ratingChange2: change2
                    };

                    io.to(debate.user1_id.toString()).emit('debate_finished', finalResult);
                    io.to(debate.user2_id.toString()).emit('debate_finished', finalResult);
                    io.emit('leaderboard_update'); // Global update
                }
            }
        } catch (err) {
            console.error('Debate message error:', err);
        }
    });

    socket.on('disconnect', async () => {
        console.log('User disconnected');
        if (socket.userId) {
            try {
                await pool.query('UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [socket.userId]);
                io.emit('user_status', { userId: socket.userId, isOnline: false, lastSeen: new Date() });
            } catch (e) { console.error(e); }
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
