const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const initializeDB = async () => {
    try {
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

        try {
            await pool.query('ALTER TABLE messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE');
        } catch (e) { }

        try {
            await pool.query("ALTER TABLE messages ADD COLUMN reactions JSONB DEFAULT '{}'::jsonb;");
        } catch (e) { }

        try {
            await pool.query('ALTER TABLE messages ADD COLUMN reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;');
        } catch (e) { }

        try {
            await pool.query('ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;');
        } catch (e) { }

        try {
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;');
        } catch (e) { }

        try {
            await pool.query('ALTER TABLE users ADD COLUMN last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP;');
        } catch (e) { }

        try {
            await pool.query('ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT FALSE;');
        } catch (e) { }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS pinned_chats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                pinned_user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, pinned_user_id)
            );
        `);

        try {
            await pool.query('ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;');
        } catch (e) { }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS contact_aliases (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                contact_id INTEGER REFERENCES users(id),
                alias VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, contact_id)
            );
        `);

        console.log('Database tables initialized');
    } catch (err) {
        console.error('Database initialization error:', err);
    }
};

module.exports = { pool, initializeDB };
