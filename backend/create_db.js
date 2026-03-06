const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function createDb() {
    try {
        await client.connect();
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = 'chat_app'`);
        if (res.rowCount === 0) {
            await client.query('CREATE DATABASE chat_app');
            console.log('Database chat_app created successfully');
        } else {
            console.log('Database chat_app already exists');
        }
    } catch (err) {
        console.error('Failed to create database:', err);
    } finally {
        await client.end();
    }
}

createDb();
