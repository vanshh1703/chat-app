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

    if (!keys) {
      console.log('Generating new E2EE key pair...');
      const keyPair = await crypto.generateKeyPair();
      const publicKeyPem = await crypto.exportPublicKey(keyPair.publicKey);
      const privateKeyPem = await crypto.exportPrivateKey(keyPair.privateKey);

      keys = {
        publicKey: publicKeyPem,
        privateKey: privateKeyPem,
        userId
      };

      await db.put(STORE_NAME, keys, `keys_${userId}`);
      await this.uploadPublicKey(publicKeyPem);
    } else {
      // PROACTIVE SYNC: Ensure the server has our public key even if we already have it locally
      // This handles cases where the initial upload might have failed or the server was reset.
      this.uploadPublicKey(keys.publicKey);
    }

    // Convert PEM strings back to CryptoKey objects for active use
    return {
      publicKey: await crypto.importPublicKey(keys.publicKey),
      privateKey: await crypto.importPrivateKey(keys.privateKey)
    };
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
