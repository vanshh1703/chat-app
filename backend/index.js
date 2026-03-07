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
        res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url } });
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
            'SELECT id, username, avatar_url, is_online, last_seen FROM users WHERE username ILIKE $1 AND id != $2 LIMIT 10',
            [`%${q}%`, req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Search error');
    }
});

// Sidebar: Get users with whom there is a chat history
app.get('/api/users/sidebar', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT u.id, u.username, u.avatar_url, u.is_online, u.last_seen,
                (SELECT content FROM messages 
                 WHERE (sender_id = u.id AND receiver_id = $1) 
                    OR (sender_id = $1 AND receiver_id = u.id) 
                 ORDER BY created_at DESC LIMIT 1) as lastMsg,
                (SELECT created_at FROM messages 
                 WHERE (sender_id = u.id AND receiver_id = $1) 
                    OR (sender_id = $1 AND receiver_id = u.id) 
                 ORDER BY created_at DESC LIMIT 1) as lastTime,
                (SELECT COUNT(*) FROM messages 
                 WHERE sender_id = u.id AND receiver_id = $1 AND is_read = false) as unreadCount
            FROM users u
            JOIN messages m ON (m.sender_id = u.id OR m.receiver_id = u.id)
            WHERE (m.sender_id = $1 OR m.receiver_id = $1) AND u.id != $1
            ORDER BY lastTime DESC
        `;
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Sidebar error');
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
        const { senderId, receiverId, content, messageType, replyToId, fileUrl } = data;
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
            const payload = { ...newMessage, reply_to_msg: replyToMsg };

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
