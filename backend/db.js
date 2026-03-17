const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

const initializeDB = async () => {
    try {
        // 1. Core tables first
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password TEXT NOT NULL,
                avatar_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_online BOOLEAN DEFAULT FALSE
            );
        `);

        // 2. Add columns to users if they don't exist
        try { await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT'); } catch (e) { }
        try { await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP'); } catch (e) { }
        try { await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE'); } catch (e) { }

        // 3. Dependent tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS muted_chats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                muted_user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, muted_user_id)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER REFERENCES users(id),
                receiver_id INTEGER REFERENCES users(id),
                content TEXT,
                message_type VARCHAR(10) DEFAULT 'text',
                file_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_read BOOLEAN DEFAULT FALSE
            );
        `);

        // 4. Add columns to messages
        try { await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE'); } catch (e) { }
        try { await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(10) DEFAULT 'text'"); } catch (e) { }
        try { await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb"); } catch (e) { }
        try { await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL'); } catch (e) { }
        try { await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE'); } catch (e) { }
        try { await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE'); } catch (e) { }
        try { await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE'); } catch (e) { }
        try { await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb"); } catch (e) { }
        try { await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted_key TEXT'); } catch (e) { }
        try { await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_encrypted_key TEXT'); } catch (e) { }
        try { await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS iv TEXT'); } catch (e) { }
        try { await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted_content TEXT'); } catch (e) { }
        try { await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_media_encrypted BOOLEAN DEFAULT FALSE'); } catch (e) { }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS pinned_chats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                pinned_user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, pinned_user_id)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS call_logs (
                id SERIAL PRIMARY KEY,
                caller_id INTEGER REFERENCES users(id),
                receiver_id INTEGER REFERENCES users(id),
                call_type VARCHAR(10),
                status VARCHAR(15),
                duration INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                is_chat_logged BOOLEAN DEFAULT FALSE
            );
        `);

        try { await pool.query('ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS is_chat_logged BOOLEAN DEFAULT FALSE'); } catch (e) { }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS login_activities (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                device_name TEXT,
                ip_address TEXT,
                location TEXT,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_current BOOLEAN DEFAULT FALSE
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS public_keys (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id),
                public_key TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS contact_aliases (
                user_id INTEGER REFERENCES users(id),
                contact_id INTEGER REFERENCES users(id),
                alias TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, contact_id)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                subscription JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, subscription)
            );
        `);

        console.log('Database tables initialized');
    } catch (err) {
        console.error('Database initialization error:', err);
    }
};

module.exports = { pool, initializeDB };
