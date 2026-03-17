import { openDB } from 'idb';
import * as crypto from './cryptoService';
import * as api from '../api/api';

const DB_NAME = 'chat-e2ee';
const STORE_NAME = 'keys';

/**
 * Manages key generation, local storage (IndexedDB), and server sync.
 */
class KeyManager {
  constructor() {
    this.dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME);
      },
    });
  }

  /**
   * Initializes keys for the current user
   */
  async initKeys(userId) {
    const db = await this.dbPromise;
    let keys = await db.get(STORE_NAME, `keys_${userId}`);

    const generateAndStore = async () => {
      console.log('Generating new E2EE key pair...');
      const keyPair = await crypto.generateKeyPair();
      const publicKeyPem = await crypto.exportPublicKey(keyPair.publicKey);
      const privateKeyPem = await crypto.exportPrivateKey(keyPair.privateKey);

      const record = {
        publicKey: publicKeyPem,
        privateKey: privateKeyPem,
        userId
      };

      await db.put(STORE_NAME, record, `keys_${userId}`);
      await this.uploadPublicKey(publicKeyPem);
      return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
    };

    let importedKeys;
    if (!keys) {
      importedKeys = await generateAndStore();
    } else {
      try {
        importedKeys = {
          publicKey: await crypto.importPublicKey(keys.publicKey),
          privateKey: await crypto.importPrivateKey(keys.privateKey)
        };
        // Proactive sync
        this.uploadPublicKey(keys.publicKey);
      } catch (err) {
        console.error('Failed to import existing keys, regenerating...', err);
        importedKeys = await generateAndStore();
      }
    }

    // VERIFY keys work before returning
    const works = await this.testKeys(importedKeys.publicKey, importedKeys.privateKey);
    if (!works) {
      console.error('KEY SELF-TEST FAILED! The generated/loaded keys are unusable. Clearing storage.');
      await db.delete(STORE_NAME, `keys_${userId}`);
      // Try one more time
      const freshKeys = await generateAndStore();
      const worksAgain = await this.testKeys(freshKeys.publicKey, freshKeys.privateKey);
      if (!worksAgain) {
        console.error('CRITICAL: Even fresh keys failed self-test. E2EE is broken in this environment.');
      }
      return freshKeys;
    }

    return importedKeys;
  }

  /**
   * Verifies that a key pair actually works for encrypt/decrypt
   */
  async testKeys(publicKey, privateKey) {
    try {
      const testMsg = "Self-test " + Date.now();
      const encrypted = await crypto.encryptMessage(testMsg, publicKey);
      const decrypted = await crypto.decryptMessage(encrypted, privateKey);
      return decrypted === testMsg;
    } catch (err) {
      console.error('Key self-test encountered error:', err);
      return false;
    }
  }

  async uploadPublicKey(publicKeyPem) {
    try {
      // Use centralized api helper (which handles token and base URL)
      await api.uploadPublicKey(publicKeyPem);
    } catch (err) {
      console.error('Failed to upload public key:', err);
    }
  }

  async fetchFriendPublicKey(friendId, forceRefresh = false) {
    const db = await this.dbPromise;
    const CACHE_TTL = 3600000; // 1 hour
    
    if (!forceRefresh) {
      // Try local cache first
      let cachedRecord = await db.get(STORE_NAME, `friend_key_${friendId}`);
      if (cachedRecord && (Date.now() - cachedRecord.timestamp < CACHE_TTL)) {
        return crypto.importPublicKey(cachedRecord.key);
      }
    }

    // Fetch from server
    try {
      const { data } = await api.getPublicKey(friendId);
      const record = {
        key: data.public_key,
        timestamp: Date.now()
      };
      
      await db.put(STORE_NAME, record, `friend_key_${friendId}`);
      return crypto.importPublicKey(data.public_key);
    } catch (err) {
      console.error('Failed to fetch friend public key:', err);
      return null;
    }
  }

  async getMyKeys(userId) {
    const db = await this.dbPromise;
    const keys = await db.get(STORE_NAME, `keys_${userId}`);
    if (!keys) return null;

    return {
      publicKey: await crypto.importPublicKey(keys.publicKey),
      privateKey: await crypto.importPrivateKey(keys.privateKey)
    };
  }

  async clearFriendCache(friendId) {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, `friend_key_${friendId}`);
    console.log(`Cleared E2EE key cache for friend ${friendId}`);
  }
}

export const keyManager = new KeyManager();
