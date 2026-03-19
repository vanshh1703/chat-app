const crypto = require('crypto');

const ENCRYPTION_PREFIX = 'v1';
const WRAPPED_KEY_PREFIX = 'k1';

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

function encryptAesGcm(plainText, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, encrypted };
}

function serializeEncryptedPayload({ iv, tag, encrypted }) {
  return `${ENCRYPTION_PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function serializeWrappedKey({ iv, tag, encrypted }) {
  return `${WRAPPED_KEY_PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function encryptMessageForStorage(value) {
  if (value === null || value === undefined) {
    return {
      content: value,
      encrypted_key: null,
      sender_encrypted_key: null,
      iv: null,
      encrypted_content: null
    };
  }

  const plainText = String(value);
  const key = getSecretKey();

  const messagePayload = encryptAesGcm(plainText, key);
  const serializedContent = serializeEncryptedPayload(messagePayload);

  const wrappedKeySeed = `${Date.now()}:${crypto.randomBytes(16).toString('base64')}`;
  const wrappedKeyPayload = encryptAesGcm(wrappedKeySeed, key);
  const wrappedKey = serializeWrappedKey(wrappedKeyPayload);

  return {
    content: serializedContent,
    encrypted_key: wrappedKey,
    sender_encrypted_key: wrappedKey,
    iv: messagePayload.iv.toString('base64'),
    encrypted_content: `${messagePayload.tag.toString('base64')}:${messagePayload.encrypted.toString('base64')}`
  };
}

function encryptTextForStorage(value) {
  return encryptMessageForStorage(value).content;
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
  encryptMessageForStorage,
  encryptTextForStorage,
  decryptTextFromStorage,
};
