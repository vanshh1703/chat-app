/**
 * Utility for encrypting and decrypting media files (images, audio, video)
 * for End-to-End Encryption.
 */

import * as crypto from './cryptoService';

/**
 * Encrypts a file using AES-GCM and a recipient's public key
 * @param {File} file The file to encrypt
 * @param {CryptoKey} recipientPublicKey Recipient's RSA public key
 * @returns {Object} { encryptedBlob, encryptedKey, iv, fileName, fileType }
 */
export async function encryptFile(file, recipientPublicKey, senderPublicKey = null) {
  const arrayBuffer = await file.arrayBuffer();
  
  // 1. Generate AES key for this file
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 2. Encrypt file data
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    arrayBuffer
  );

  // 3. Encrypt AES key with recipient's RSA public key
  const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const encryptedKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    exportedAesKey
  );

  // 4. Encrypt AES key with sender's RSA public key
  let senderEncryptedKeyBase64 = null;
  if (senderPublicKey) {
    const senderKeyBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      senderPublicKey,
      exportedAesKey
    );
    senderEncryptedKeyBase64 = arrayBufferToBase64(senderKeyBuffer);
  }

  // Return a new Blob containing the encrypted data
  return {
    encryptedBlob: new Blob([encryptedData], { type: 'application/octet-stream' }),
    encryptedKey: arrayBufferToBase64(encryptedKey),
    senderEncryptedKey: senderEncryptedKeyBase64,
    iv: arrayBufferToBase64(iv),
    fileName: file.name,
    fileType: file.type
  };
}

/**
 * Decrypts an encrypted blob
 */
export async function decryptFile(encryptedBlob, encryptedKeyBase64, ivBase64, myPrivateKey) {
  const encryptedData = await encryptedBlob.arrayBuffer();
  const encryptedKey = base64ToArrayBuffer(encryptedKeyBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  // 1. Decrypt AES key
  const decryptedAesKeyBuffer = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    myPrivateKey,
    encryptedKey
  );

  // 2. Import AES key
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    decryptedAesKeyBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // 3. Decrypt data
  const decryptedData = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encryptedData
  );

  return new Blob([decryptedData]);
}

// Helpers - Chunked to avoid stack overflow with spread
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Process in chunks or simple loop to avoid "Maximum call stack size exceeded"
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
