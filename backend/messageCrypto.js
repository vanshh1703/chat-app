const crypto = require('crypto');

const ENCRYPTION_PREFIX = 'v1';

function getSecretKey() {
  const source = process.env.MESSAGE_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!source) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing MESSAGE_ENCRYPTION_KEY (or JWT_SECRET) for message encryption');
    }
    return crypto.createHash('sha256').update('local-dev-message-key').digest();
  }
  return crypto.createHash('sha256').update(source).digest();
}

function encryptTextForStorage(value) {
  if (value === null || value === undefined) return value;
  const plainText = String(value);
  const iv = crypto.randomBytes(12);
  const key = getSecretKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptTextFromStorage(value) {
  if (value === null || value === undefined) return value;
  const serialized = String(value);
  if (!serialized.startsWith(`${ENCRYPTION_PREFIX}:`)) return serialized;

  const parts = serialized.split(':');
  if (parts.length !== 4) return '[Message unavailable]';

  try {
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const encrypted = Buffer.from(parts[3], 'base64');
    const key = getSecretKey();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '[Message unavailable]';
  }
}

module.exports = {
  encryptTextForStorage,
  decryptTextFromStorage,
};
