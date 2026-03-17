import { RSA_ALGO, AES_ALGO, arrayBufferToBase64, base64ToArrayBuffer } from './cryptoService';

/**
 * Encrypts a file using AES-GCM and a recipient's public key
 * @param {File} file The file to encrypt
 * @param {CryptoKey} recipientPublicKey Recipient's RSA public key
 * @param {CryptoKey} senderPublicKey Optional sender's RSA public key
 * @returns {Object} { encryptedBlob, encryptedKey, iv, fileName, fileType }
 */
export async function encryptFile(file, recipientPublicKey, senderPublicKey = null) {
  const arrayBuffer = await file.arrayBuffer();
  
  // 1. Generate AES key for this file
  const aesKey = await window.crypto.subtle.generateKey(
    AES_ALGO,
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

  console.log("[decryptFile] Starting...", {
    dataSize: encryptedData.byteLength,
    keySize: encryptedKey.byteLength,
    ivSize: iv.byteLength
  });

  // 1. Decrypt AES key
  let decryptedAesKeyBuffer;
  try {
    decryptedAesKeyBuffer = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      myPrivateKey,
      encryptedKey
    );
    console.log("[decryptFile] RSA Decrypt successful");
  } catch (e) {
    console.error("[decryptFile] RSA Decrypt FAILED", e);
    throw e;
  }

  // 2. Import AES key
  let aesKey;
  try {
    aesKey = await window.crypto.subtle.importKey(
      "raw",
      decryptedAesKeyBuffer,
      AES_ALGO,
      false,
      ["decrypt"]
    );
    console.log("[decryptFile] AES Key Import successful");
  } catch (e) {
    console.error("[decryptFile] AES Key Import FAILED", e);
    throw e;
  }

  // 3. Decrypt data
  try {
    const decryptedData = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encryptedData
    );
    console.log("[decryptFile] AES Data Decrypt successful");
    return new Blob([decryptedData]);
  } catch (e) {
    console.error("[decryptFile] AES Data Decrypt FAILED", e);
    throw e;
  }
}
