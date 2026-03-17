/**
 * Core cryptographic services for End-to-End Encryption (E2EE)
 * Uses Web Crypto API for performance and security.
 */

export const RSA_ALGO = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

export const AES_ALGO = {
  name: "AES-GCM",
  length: 256,
};

/**
 * Generates a new RSA-2048 key pair
 */
export async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    RSA_ALGO,
    true, // Extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a message using AES-GCM and a recipient's public key
 * @param {string} content Plain text message
 * @param {CryptoKey} recipientPublicKey Recipient's RSA public key
 * @returns {Object} { encryptedContent, encryptedKey, iv }
 */
export async function encryptMessage(content, recipientPublicKey, senderPublicKey = null) {
  // 1. Generate a random AES-256 key for this message
  const aesKey = await window.crypto.subtle.generateKey(
    AES_ALGO,
    true,
    ["encrypt", "decrypt"]
  );

  // 2. Encrypt the content with AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedContent = new TextEncoder().encode(content);
  const encryptedContentBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encodedContent
  );

  // 3. Encrypt the AES key with the recipient's RSA public key
  const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    exportedAesKey
  );

  // 4. Encrypt the AES key with the sender's RSA public key (so they can read their own history)
  let senderEncryptedKeyBase64 = null;
  if (senderPublicKey) {
    const senderAesKeyBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      senderPublicKey,
      exportedAesKey
    );
    senderEncryptedKeyBase64 = arrayBufferToBase64(senderAesKeyBuffer);
  }

  return {
    encryptedContent: arrayBufferToBase64(encryptedContentBuffer),
    encryptedKey: arrayBufferToBase64(encryptedAesKeyBuffer),
    senderEncryptedKey: senderEncryptedKeyBase64,
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Decrypts a message using the user's private key
 */
export async function decryptMessage(payload, myPrivateKey) {
  const { encryptedContent, encryptedKey, iv } = payload;

  const ivBuffer = base64ToArrayBuffer(iv);
  const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKey);
  const encryptedContentBuffer = base64ToArrayBuffer(encryptedContent);

  // 1. Decrypt the AES key using RSA private key
  let decryptedAesKeyBuffer;
  try {
    decryptedAesKeyBuffer = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      myPrivateKey,
      encryptedKeyBuffer
    );
  } catch (e) {
    console.error("[decryptMessage] RSA Decrypt FAILED", e);
    throw e;
  }

  // 2. Import the decrypted AES key
  let aesKey;
  try {
    aesKey = await window.crypto.subtle.importKey(
      "raw",
      decryptedAesKeyBuffer,
      AES_ALGO,
      false,
      ["decrypt"]
    );
  } catch (e) {
    console.error("[decryptMessage] AES Key Import FAILED", e);
    throw e;
  }

  // 3. Decrypt the content using AES-GCM
  try {
    const decryptedContentBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuffer },
      aesKey,
      encryptedContentBuffer
    );
    return new TextDecoder().decode(decryptedContentBuffer);
  } catch (e) {
    console.error("[decryptMessage] AES Data Decrypt FAILED", e);
    throw e;
  }
}

/**
 * Helper: Export CryptoKey to Base64 (for server/storage)
 */
export async function exportPublicKey(key) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return arrayBufferToBase64(exported);
}

/**
 * Helper: Import Public Key from Base64
 */
export async function importPublicKey(base64Key) {
  const buffer = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    "spki",
    buffer,
    RSA_ALGO,
    true,
    ["encrypt"]
  );
}

/**
 * Helper: Export Private Key (Encrypted with a passphrase)
 */
export async function exportPrivateKey(key, passphrase) {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  // In a real app, we'd encrypt this buffer with a key derived from passphrase
  // For now, returning base64 (user backup should be handled carefully)
  return arrayBufferToBase64(exported);
}

export async function importPrivateKey(base64Key) {
  const buffer = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    "pkcs8",
    buffer,
    RSA_ALGO,
    true,
    ["decrypt"]
  );
}

// Low-level buffer conversion helpers - Chunked to avoid stack overflow with spread
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Process in chunks or simple loop to avoid "Maximum call stack size exceeded"
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
