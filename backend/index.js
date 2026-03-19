const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uuidv4 = require('uuid').v4;
const WebRTCSignaling = require('./socketServer');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { pool, initializeDB } = require('./db');
const axios = require('axios');
const cheerio = require('cheerio');
const webpush = require('web-push');
const { encryptMessageForStorage, decryptTextFromStorage } = require('./messageCrypto');

const hasVapidKeys = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

// Config Web Push
if (hasVapidKeys) {
    webpush.setVapidDetails(
        'mailto:you@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    console.warn('VAPID keys are missing. Push notifications will not work.');
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);
const BUCKET_NAME = 'chat-media';


const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://chat-app-six-jet.vercel.app',
    'http://localhost:5173'
].filter(Boolean);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    },
});


app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Keep-Alive / Health Check Endpoint for Render/UptimeRobot
app.get('/api/ping', (req, res) => {
    res.status(200).send('pong');
});

// Serve uploaded files statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// Multer storage config - Switch to Memory Storage for Supabase uploads
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// Initialize Database
// initializeDB(); // Handled at bottom to ensure sync startup

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

const SENSITIVE_MESSAGE_FIELDS = [
    'encrypted_key',
    'sender_encrypted_key',
    'iv',
    'encrypted_content',
    'is_media_encrypted'
];

function sanitizeMessageForClient(message) {
    if (!message) return message;

    const safe = { ...message };
    safe.content = decryptTextFromStorage(safe.content);

    if (Array.isArray(safe.edit_history)) {
        safe.edit_history = safe.edit_history.map(entry => {
            if (!entry || typeof entry !== 'object') return entry;
            return {
                ...entry,
                content: typeof entry.content === 'string' ? decryptTextFromStorage(entry.content) : entry.content
            };
        });
    }

    if (safe.reply_to_msg) {
        safe.reply_to_msg = sanitizeMessageForClient(safe.reply_to_msg);
    }

    for (const field of SENSITIVE_MESSAGE_FIELDS) {
        delete safe[field];
    }

    return safe;
}

// File Upload endpoint using Supabase Storage
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    console.log('--- Upload Request Received ---');
    console.log('File info:', req.file ? { name: req.file.originalname, size: req.file.size, type: req.file.mimetype } : 'No file');
    
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        console.error('Supabase config missing in .env');
        return res.status(500).json({ error: 'Storage configuration error' });
    }

    try {
        const file = req.file;
        const fileExt = path.extname(file.originalname);
        const fileName = `${uuidv4()}${fileExt}`;
        const filePath = `uploads/${fileName}`;

        console.log('Uploading to Supabase path:', filePath);

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) {
            console.error('Supabase upload error detail:', JSON.stringify(error, null, 2));
            return res.status(500).json({ error: 'Upload to storage failed', detail: error.message });
        }

        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        console.log('Upload success! Public URL:', publicUrl);

        const mimeType = file.mimetype;
        let messageType = 'file';
        if (mimeType.startsWith('image/')) messageType = 'image';
        else if (mimeType.startsWith('video/')) messageType = 'video';
        else if (mimeType.startsWith('audio/')) messageType = 'audio';

        res.json({ 
            fileUrl: publicUrl, 
            originalName: file.originalname, 
            messageType, 
            fileName: fileName 
        });
    } catch (err) {
        console.error('Upload handler error:', err);
        res.status(500).send('Upload error');
    }
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

        // Record Login Activity
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        let location = 'Unknown';

        try {
            // Only try to fetch location for non-local IPs
            if (ip && ip !== '::1' && ip !== '127.0.0.1' && !ip.startsWith('192.168.')) {
                const geo = await axios.get(`http://ip-api.com/json/${ip}?fields=status,city,country`);
                if (geo.data.status === 'success') {
                    location = `${geo.data.city}, ${geo.data.country}`;
                }
            } else {
                location = 'Local Host';
            }
        } catch (geoipErr) {
            console.error('GeoIP error:', geoipErr.message);
        }

        await pool.query(
            'INSERT INTO login_activities (user_id, device_name, ip_address, location, last_active, is_current) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)',
            [user.id, userAgent, ip, location, true] // We'll handle 'is_current' differently on fetch if needed
        );

        res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url, bio: user.bio } });
    } catch (err) {
        console.error(err);
        res.status(500).send('Login error');
    }
});

// E2EE Public Key Routes
app.get('/api/keys/:userId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT public_key FROM public_keys WHERE user_id = $1', [req.params.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Key not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch public key' });
    }
});

app.post('/api/keys', authenticateToken, async (req, res) => {
    const { publicKey } = req.body;
    try {
        await pool.query(
            'INSERT INTO public_keys (user_id, public_key) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET public_key = $2',
            [req.user.id, publicKey]
        );
        res.json({ message: 'Public key updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to upload public key' });
    }
});

// Utility: Link Preview
app.get('/api/utils/link-preview', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            timeout: 5000
        });

        const $ = cheerio.load(response.data);
        const metadata = {
            title: $('meta[property="og:title"]').attr('content') || $('title').text() || '',
            description: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '',
            image: $('meta[property="og:image"]').attr('content') || '',
            url: url
        };

        res.json(metadata);
    } catch (err) {
        console.error('Link preview error:', err.message);
        res.status(500).json({ error: 'Failed to fetch preview' });
    }
});

// Push Notification Routes
app.get('/api/push/vapid-public-key', (req, res) => {
    if (!hasVapidKeys) {
        return res.status(503).json({ error: 'VAPID keys are not configured on backend' });
    }
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', authenticateToken, async (req, res) => {
    const { subscription } = req.body;
    try {
        if (!hasVapidKeys) {
            return res.status(503).json({ error: 'Cannot subscribe: VAPID keys are not configured on backend' });
        }
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Invalid subscription payload' });
        }
        await pool.query(
            'INSERT INTO push_subscriptions (user_id, subscription) VALUES ($1, $2) ON CONFLICT (user_id, subscription) DO NOTHING',
            [req.user.id, subscription]
        );
        res.status(201).json({ message: 'Subscribed to push notifications' });
    } catch (err) {
        console.error('Push subscribe error:', err);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

app.post('/api/push/unsubscribe', authenticateToken, async (req, res) => {
    const { subscription } = req.body;
    try {
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Invalid subscription payload' });
        }
        await pool.query(
            "DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription->>'endpoint' = $2",
            [req.user.id, subscription.endpoint]
        );
        res.sendStatus(200);
    } catch (err) {
        console.error('Push unsubscribe error:', err);
        res.status(500).json({ error: 'Failed to unsubscribe' });
    }
});

app.post('/api/push/reset', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [req.user.id]);
        res.status(200).json({ message: 'Push subscriptions reset for user' });
    } catch (err) {
        console.error('Push reset error:', err);
        res.status(500).json({ error: 'Failed to reset push subscriptions' });
    }
});

app.post('/api/push/test', authenticateToken, async (req, res) => {
    try {
        const result = await sendPushNotification(req.user.id, {
            senderName: 'Ash Chat',
            sender_id: req.user.id,
            message_type: 'text',
            content: req.body?.message || 'Test push notification'
        });

        if (result.error) {
            return res.status(503).json({ error: result.error, sent: result.sent || 0, details: result.details || null });
        }

        res.status(200).json({ message: 'Test push notification sent', sent: result.sent });
    } catch (err) {
        console.error('Push test error:', err);
        res.status(500).json({ error: 'Failed to send test push notification' });
    }
});

async function sendPushNotification(receiverId, payload) {
    if (!hasVapidKeys) {
        console.warn('Skipping push send: VAPID keys are missing');
        return { sent: 0, error: 'VAPID keys are missing on backend deployment' };
    }

    try {
        const result = await pool.query('SELECT subscription FROM push_subscriptions WHERE user_id = $1', [receiverId]);
        const subscriptions = result.rows;

        if (!subscriptions.length) {
            return { sent: 0, error: 'No push subscription found for user. Re-login and allow notifications.' };
        }

        let sentCount = 0;
        const deliveryErrors = [];

        await Promise.all(
            subscriptions.map(async (sub) => {
                try {
                    const subscriptionObject = typeof sub.subscription === 'string'
                        ? JSON.parse(sub.subscription)
                        : sub.subscription;

                    if (!subscriptionObject || !subscriptionObject.endpoint) {
                        deliveryErrors.push({
                            statusCode: null,
                            body: null,
                            message: 'Invalid subscription payload in database (missing endpoint)'
                        });
                        return;
                    }

                    const meta = subscriptionObject.meta || {};
                    const isStealth = Boolean(meta.stealthEnabled);
                    const isIncomingCall = payload.notificationType === 'incoming_call';
                    const callTypeLabel = payload.callType === 'video' ? 'Video call' : 'Voice call';
                    const incomingCallUrl = `/home?incoming=call&from=${encodeURIComponent(payload.sender_id || '')}&type=${encodeURIComponent(payload.callType || 'voice')}&name=${encodeURIComponent(payload.senderName || 'Someone')}`;
                    const notificationTitle = isStealth
                        ? (meta.fakeTitle || 'Software Update Ready')
                        : (isIncomingCall ? `${payload.senderName || 'Someone'} is calling` : `New message from ${payload.senderName || 'User'}`);
                    const notificationBody = isStealth
                        ? (meta.fakeBody || 'Tap to learn more')
                        : (isIncomingCall
                            ? (payload.content || callTypeLabel)
                            : (payload.message_type === 'text' ? (payload.content || 'New Message') : `Sent an ${payload.message_type || 'attachment'}`));
                    const notificationUrl = isStealth
                        ? (meta.decoyAppRoute || '/decoy/settings')
                        : (isIncomingCall ? incomingCallUrl : '/home');

                    const pushPayload = JSON.stringify({
                        title: notificationTitle,
                        body: notificationBody,
                        icon: isStealth ? '/favicon.ico' : '/pwa-192x192.png',
                        badge: isStealth ? '/favicon.ico' : '/pwa-192x192.png',
                        vibrate: isStealth ? [20] : (isIncomingCall ? [300, 200, 300, 200, 300] : [100, 50, 100]),
                        silent: Boolean(isStealth),
                        tag: isStealth ? 'system-alert' : (isIncomingCall ? `incoming-call-${payload.sender_id || 'unknown'}` : 'message-notification'),
                        renotify: Boolean(isIncomingCall),
                        requireInteraction: Boolean(isIncomingCall && !isStealth),
                        data: {
                            url: notificationUrl,
                            senderId: payload.sender_id,
                            stealth: isStealth,
                            type: isIncomingCall ? 'incoming_call' : 'message',
                            callType: payload.callType || null
                        }
                    });

                    await webpush.sendNotification(subscriptionObject, pushPayload);
                    sentCount += 1;
                } catch (e) {
                    if (e.statusCode === 410 || e.statusCode === 404) {
                        await pool.query('DELETE FROM push_subscriptions WHERE subscription = $1', [sub.subscription]);
                    }
                    deliveryErrors.push({
                        statusCode: e.statusCode || null,
                        body: e.body || null,
                        message: e.message || 'WebPush send failed'
                    });
                    console.error('WebPush error:', e.message || e);
                }
            })
        );

        if (sentCount === 0) {
            const firstError = deliveryErrors[0] || {};
            const isLikelyVapidMismatch = firstError.statusCode === 401 || firstError.statusCode === 403;

            return {
                sent: 0,
                error: isLikelyVapidMismatch
                    ? 'Push provider rejected subscriptions (401/403). Your VAPID public/private keys likely do not match.'
                    : 'Push provider rejected all subscriptions. Please re-subscribe.',
                details: {
                    rejected: deliveryErrors.length,
                    firstProviderError: firstError
                }
            };
        }

        return { sent: sentCount };
    } catch (err) {
        console.error('Send push error:', err);
        return { sent: 0, error: 'Server push send failed' };
    }
}

// Helper to record login activity
async function recordLoginActivity(userId, req) {
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    let location = 'Unknown';

    try {
        if (ip && ip !== '::1' && ip !== '127.0.0.1' && !ip.startsWith('192.168.')) {
            const geo = await axios.get(`http://ip-api.com/json/${ip}?fields=status,city,country`);
            if (geo.data.status === 'success') {
                location = `${geo.data.city}, ${geo.data.country}`;
            }
        } else {
            location = 'Local Host';
        }
    } catch (geoipErr) {
        console.error('GeoIP error:', geoipErr.message);
    }

    await pool.query(
        'INSERT INTO login_activities (user_id, device_name, ip_address, location, last_active, is_current) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)',
        [userId, userAgent, ip, location, true]
    );
}

// Get Login Activities
app.get('/api/users/login-activity', authenticateToken, async (req, res) => {
    try {
        let result = await pool.query(
            'SELECT * FROM login_activities WHERE user_id = $1 ORDER BY last_active DESC LIMIT 10',
            [req.user.id]
        );

        // If no activity found, record the current session
        if (result.rows.length === 0) {
            await recordLoginActivity(req.user.id, req);
            result = await pool.query(
                'SELECT * FROM login_activities WHERE user_id = $1 ORDER BY last_active DESC LIMIT 10',
                [req.user.id]
            );
        }

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch login activity' });
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
                (SELECT id FROM messages 
                 WHERE (sender_id = u.id AND receiver_id = $1) 
                    OR (sender_id = $1 AND receiver_id = u.id) 
                 ORDER BY created_at DESC LIMIT 1) as lastMsgId,
                (SELECT sender_id FROM messages 
                 WHERE (sender_id = u.id AND receiver_id = $1) 
                    OR (sender_id = $1 AND receiver_id = u.id) 
                 ORDER BY created_at DESC LIMIT 1) as lastMsgSenderId,
                (SELECT message_type FROM messages 
                 WHERE (sender_id = u.id AND receiver_id = $1) 
                    OR (sender_id = $1 AND receiver_id = u.id) 
                 ORDER BY created_at DESC LIMIT 1) as lastMsgType,
                (SELECT created_at FROM messages 
                 WHERE (sender_id = u.id AND receiver_id = $1) 
                    OR (sender_id = $1 AND receiver_id = u.id) 
                 ORDER BY created_at DESC LIMIT 1) as lastMsgTime,
                (SELECT COUNT(*) FROM messages 
                 WHERE sender_id = u.id AND receiver_id = $1 AND is_read = false) as unreadCount,
                EXISTS (SELECT 1 FROM pinned_chats WHERE user_id = $1 AND pinned_user_id = u.id) as is_pinned,
                EXISTS (SELECT 1 FROM muted_chats WHERE user_id = $1 AND muted_user_id = u.id) as is_muted
            FROM users u
            JOIN messages m ON (m.sender_id = u.id AND m.receiver_id = $1) OR (m.sender_id = $1 AND m.receiver_id = u.id)
            LEFT JOIN contact_aliases a ON a.contact_id = u.id AND a.user_id = $1
            WHERE u.id != $1
            ORDER BY is_pinned DESC, lastMsgTime DESC NULLS LAST
        `;
        const result = await pool.query(query, [req.user.id]);

        const formattedRows = result.rows.map(row => {
            let displayMsg = decryptTextFromStorage(row.lastmsg);
            if (row.lastmsgtype === 'telepathy') {
                try {
                    const signal = JSON.parse(displayMsg);
                    displayMsg = `${signal.icon} ${signal.label}`;
                } catch (e) { }
            } else if (row.lastmsgtype === 'image') displayMsg = '📷 Photo';
            else if (row.lastmsgtype === 'video') displayMsg = '🎥 Video';
            else if (row.lastmsgtype === 'audio') displayMsg = '🎵 Audio';
            else if (row.lastmsgtype === 'file') displayMsg = '📁 File';
            else if (row.lastmsgtype === 'call') displayMsg = '📞 Call';

            return { 
                ...row, 
                lastmsg: displayMsg,
                // Pass along E2EE data for frontend decryption
                lastMsgData: {
                    id: row.lastmsgid,
                    content: displayMsg,
                    sender_id: row.lastmsgsenderid,
                    message_type: row.lastmsgtype
                }
            };
        });

        res.json(formattedRows);
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

// Mute/Unmute a chat
app.post('/api/users/mute-chat', authenticateToken, async (req, res) => {
    const { mutedUserId } = req.body;
    try {
        // Toggle mute
        const check = await pool.query('SELECT id FROM muted_chats WHERE user_id = $1 AND muted_user_id = $2', [req.user.id, mutedUserId]);
        if (check.rows.length > 0) {
            await pool.query('DELETE FROM muted_chats WHERE user_id = $1 AND muted_user_id = $2', [req.user.id, mutedUserId]);
            res.json({ muted: false });
        } else {
            await pool.query('INSERT INTO muted_chats (user_id, muted_user_id) VALUES ($1, $2)', [req.user.id, mutedUserId]);
            res.json({ muted: true });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Mute chat failed' });
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

// Pin/Unpin message
app.post('/api/messages/pin', authenticateToken, async (req, res) => {
    const { messageId } = req.body;
    try {
        const check = await pool.query('SELECT is_pinned FROM messages WHERE id = $1', [messageId]);
        if (check.rows.length === 0) return res.status(404).send('Message not found');

        const newPinned = !check.rows[0].is_pinned;
        await pool.query('UPDATE messages SET is_pinned = $1 WHERE id = $2', [newPinned, messageId]);
        res.json({ is_pinned: newPinned });
    } catch (err) {
        console.error(err);
        res.status(500).send('Pin message error');
    }
});

// Shared media/docs/links between two users
app.get('/api/messages/shared/:otherId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM messages 
            WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
            AND (
                message_type IN ('image', 'video', 'file', 'audio', 'text')
            )
            AND is_deleted = false
            ORDER BY created_at DESC
        `, [req.user.id, req.params.otherId]);

        const decryptedRows = result.rows.map(sanitizeMessageForClient);
        const urlRegex = /https?:\/\//i;
        const filteredRows = decryptedRows.filter((row) => (
            ['image', 'video', 'file', 'audio'].includes(row.message_type)
            || (row.message_type === 'text' && urlRegex.test(row.content || ''))
        ));

        res.json(filteredRows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Shared content error');
    }
});

// Message history between two users
app.get('/api/messages/:otherId', authenticateToken, async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    try {
        const result = await pool.query(`
            SELECT m.*,
                row_to_json(r.*) as reply_to_msg
            FROM messages m
            LEFT JOIN messages r ON r.id = m.reply_to_id
            WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
            ORDER BY m.created_at DESC
            LIMIT $3 OFFSET $4
        `, [req.user.id, req.params.otherId, limit, offset]);

        // Reverse because we fetch the latest (DESC) for pagination, but frontend expects ASC for chat flow
        const payload = result.rows.map(sanitizeMessageForClient).reverse();
        res.json(payload);
    } catch (err) {
        console.error(err);
        res.status(500).send('Message history error');
    }
});

// Pin/Unpin a message



app.get('/api/calls/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(`
            SELECT 
                cl.*,
                u1.username as caller_name, u1.avatar_url as caller_avatar,
                u2.username as receiver_name, u2.avatar_url as receiver_avatar
            FROM call_logs cl
            JOIN users u1 ON cl.caller_id = u1.id
            JOIN users u2 ON cl.receiver_id = u2.id
            WHERE cl.caller_id = $1 OR cl.receiver_id = $1
            ORDER BY cl.created_at DESC
            LIMIT 50
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Database error');
    }
});
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', async (userId) => {
        if (!userId) return;
        socket.join(userId.toString());
        socket.userId = userId;
        console.log(`User ${userId} joined their private room`);
        try {
            await pool.query('UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
            io.emit('user_status', { userId, isOnline: true, lastSeen: new Date() });
        } catch (e) { console.error(e); }
    });

    // Initialize WebRTC Signaling
    if (typeof WebRTCSignaling === 'function') {
        try {
            WebRTCSignaling(io, socket, { sendPushNotification });
        } catch (err) {
            console.error('Error during WebRTCSignaling call:', err);
        }
    }

    socket.on('send_message', async (data) => {
        const { senderId, receiverId, content, messageType, replyToId, fileUrl, senderName } = data;
        try {
            const encryptedPayload = encryptMessageForStorage(content || '');
            const result = await pool.query(
                'INSERT INTO messages (sender_id, receiver_id, content, message_type, reply_to_id, file_url, encrypted_key, sender_encrypted_key, iv, encrypted_content) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
                [
                    senderId,
                    receiverId,
                    encryptedPayload.content,
                    messageType || 'text',
                    replyToId || null,
                    fileUrl || null,
                    encryptedPayload.encrypted_key,
                    encryptedPayload.sender_encrypted_key,
                    encryptedPayload.iv,
                    encryptedPayload.encrypted_content
                ]
            );
            const newMessage = sanitizeMessageForClient(result.rows[0]);

            let replyToMsg = null;
            if (replyToId) {
                const replyResult = await pool.query('SELECT * FROM messages WHERE id = $1', [replyToId]);
                replyToMsg = replyResult.rows[0] ? sanitizeMessageForClient(replyResult.rows[0]) : null;
            }
            const payload = { ...newMessage, reply_to_msg: replyToMsg, senderName };

            // Emit to both parties
            io.to(senderId.toString()).emit('receive_message', payload);
            io.to(receiverId.toString()).emit('receive_message', payload);

            // Always trigger push notification. The Service Worker will decide whether to show it based on focus.
            sendPushNotification(receiverId, payload);
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

            const updatedMessage = sanitizeMessageForClient(result.rows[0]);
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
            const encryptedPayload = encryptMessageForStorage('');
            // Only the sender can delete their own message. We soft delete it by setting is_deleted=true.
            // Note: The prompt says "deleting message from frontend should not be deleting message from database".
            // It was already doing an UPDATE setting is_deleted = true.
            // But we can also clear file_url if we want to be thorough.
            const result = await pool.query(
                'UPDATE messages SET is_deleted = true, content = $3, encrypted_key = $4, sender_encrypted_key = $5, iv = $6, encrypted_content = $7, file_url = NULL WHERE id = $1 AND sender_id = $2 RETURNING *',
                [
                    messageId,
                    senderId,
                    encryptedPayload.content,
                    encryptedPayload.encrypted_key,
                    encryptedPayload.sender_encrypted_key,
                    encryptedPayload.iv,
                    encryptedPayload.encrypted_content
                ]
            );
            if (result.rows.length === 0) return; // not authorised
            const deleted = result.rows[0];
            io.to(senderId.toString()).emit('message_deleted', { messageId: deleted.id });
            io.to(receiverId.toString()).emit('message_deleted', { messageId: deleted.id });
        } catch (err) {
            console.error('Delete message error:', err);
        }
    });

    socket.on('edit_message', async (data) => {
        const { messageId, senderId, receiverId, newContent } = data;
        try {
            // Fetch current content and edit history
            const currentMsgResult = await pool.query('SELECT content, created_at, edit_history FROM messages WHERE id = $1 AND sender_id = $2', [messageId, senderId]);
            if (currentMsgResult.rows.length === 0) return; // not authorised

            const { content: oldContent, created_at: oldTimestamp, edit_history: currentHistory } = currentMsgResult.rows[0];
            const oldContentPlain = decryptTextFromStorage(oldContent);
            const newHistory = [...(currentHistory || []), { content: oldContent, edited_at: oldTimestamp }];
            const encryptedPayload = encryptMessageForStorage(newContent);

            const result = await pool.query(
                'UPDATE messages SET content = $1, encrypted_key = $2, sender_encrypted_key = $3, iv = $4, encrypted_content = $5, is_edited = true, edit_history = $6 WHERE id = $7 AND sender_id = $8 RETURNING *',
                [
                    encryptedPayload.content,
                    encryptedPayload.encrypted_key,
                    encryptedPayload.sender_encrypted_key,
                    encryptedPayload.iv,
                    encryptedPayload.encrypted_content,
                    JSON.stringify(newHistory.map((entry, idx) => idx === newHistory.length - 1 ? { ...entry, content: oldContentPlain } : entry)),
                    messageId,
                    senderId
                ]
            );
            if (result.rows.length === 0) return; // not authorised

            const updatedMsg = sanitizeMessageForClient(result.rows[0]);
            // We need to fetch reply_to_msg if it exists, similar to send_message
            let replyToMsg = null;
            if (updatedMsg.reply_to_id) {
                const replyResult = await pool.query('SELECT * FROM messages WHERE id = $1', [updatedMsg.reply_to_id]);
                replyToMsg = replyResult.rows[0] ? sanitizeMessageForClient(replyResult.rows[0]) : null;
            }
            const payload = { ...updatedMsg, reply_to_msg: replyToMsg };

            io.to(senderId.toString()).emit('message_updated', payload);
            io.to(receiverId.toString()).emit('message_updated', payload);
        } catch (err) {
            console.error('Edit message error:', err);
        }
    });

    socket.on('screenshot_taken', async (data) => {
        const { senderId, receiverId, senderName } = data;
        try {
            const content = `${senderName} took a screenshot`;
            const encryptedPayload = encryptMessageForStorage(content);
            const result = await pool.query(
                'INSERT INTO messages (sender_id, receiver_id, content, message_type, encrypted_key, sender_encrypted_key, iv, encrypted_content) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [
                    senderId,
                    receiverId,
                    encryptedPayload.content,
                    'system',
                    encryptedPayload.encrypted_key,
                    encryptedPayload.sender_encrypted_key,
                    encryptedPayload.iv,
                    encryptedPayload.encrypted_content
                ]
            );
            const newMessage = sanitizeMessageForClient(result.rows[0]);
            const payload = { ...newMessage, senderName: 'System' };

            io.to(senderId.toString()).emit('receive_message', payload);
            io.to(receiverId.toString()).emit('receive_message', payload);
        } catch (err) {
            console.error('Socket screenshot_taken error:', err);
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
initializeDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('CRITICAL: Database initialization failed. Server not started.', err);
});
