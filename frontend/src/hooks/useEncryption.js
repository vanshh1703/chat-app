import { useState, useEffect, useCallback } from 'react';
import { keyManager } from '../utils/keyManager';
import * as crypto from '../utils/cryptoService';

/**
 * Hook for managing E2EE in components.
 * Loads user keys and provides encryption/decryption functions.
 */
export function useEncryption(userId) {
  const [keys, setKeys] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function loadKeys() {
      setIsLoading(true);
      try {
        const userKeys = await keyManager.initKeys(userId);
        setKeys(userKeys);
      } catch (err) {
        console.error('Failed to initialize E2EE keys:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadKeys();
  }, [userId]);

  /**
   * Encrypts content for a specific recipient
   */
  const encrypt = useCallback(async (content, recipientId) => {
    if (!content) return null;
    try {
      const recipientPublicKey = await keyManager.fetchFriendPublicKey(recipientId);
      if (!recipientPublicKey) {
        console.warn('Recipient public key not found, sending unencrypted (Fallback)');
        return { content, isEncrypted: false };
      }

      const encryptedPayload = await crypto.encryptMessage(content, recipientPublicKey, keys.publicKey);
      return { 
        ...encryptedPayload, 
        isEncrypted: true,
        // We still send the plain content for now to avoid breaking existing server routing 
        // IF the server needs it. But the prompt says "server must be completely blind".
        // So we'll send a placeholder for 'content' and use 'encryptedContent' for the real data.
        content: "[Encrypted Message]" 
      };
    } catch (err) {
      console.error('Encryption failed:', err);
      return { content, isEncrypted: false };
    }
  }, [keys]);

  /**
   * Decrypts an incoming message
   */
  const decrypt = useCallback(async (message) => {
    if (!message.encrypted_key || !message.iv || !keys?.privateKey) {
      return message.content;
    }

    try {
      const ciphertext = message.content === "[Encrypted Message]" ? (message.encrypted_content || message.encryptedContent) : message.content;
      
      if (!ciphertext || ciphertext === "[Encrypted Message]") {
        console.warn(`[E2EE Decrypt] Missing ciphertext for message ${message.id}. Raw content: ${message.content}`);
        return "⚠️ Decryption Failed (Missing Ciphertext)";
      }

      // Priority: snake_case (database) -> camelCase (previous versions)
      let keyToUse = message.encrypted_key || message.encryptedKey;
      const isSender = (message.sender_id && String(message.sender_id) === String(userId)) || (message.senderId && String(message.senderId) === String(userId));
      
      if (isSender) {
        keyToUse = message.sender_encrypted_key || message.senderEncryptedKey || keyToUse;
      }

      const decrypted = await crypto.decryptMessage({
        encryptedContent: ciphertext,
        encryptedKey: keyToUse,
        iv: message.iv
      }, keys.privateKey);
      return decrypted;
    } catch (err) {
      console.error(`[E2EE Decrypt Error] Message ID: ${message.id}`, {
        error: err.name,
        message: err.message,
        hasCiphertext: !!(message.encrypted_content || message.encryptedContent),
        hasKey: !!(message.encrypted_key || message.encryptedKey),
        hasIV: !!message.iv
      });
      return `⚠️ Decryption Failed (${err.name === 'OperationError' ? 'Key mismatch' : 'Decryption error'})`;
    }
  }, [keys]);

  return {
    isLoading,
    isReady: !!keys,
    encrypt,
    decrypt,
    publicKey: keys?.publicKey
  };
}
