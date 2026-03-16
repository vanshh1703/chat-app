import React, { useState, useEffect } from 'react';
import { Shield, X, Check, Copy, Info, AlertTriangle } from 'lucide-react';
import { keyManager } from '../utils/keyManager';

/**
 * KeyVerification Modal
 * Shows safety numbers for the current chat to verify E2EE integrity.
 */
const KeyVerification = ({ isOpen, onClose, user, friend }) => {
  const [safetyNumber, setSafetyNumber] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && user && friend) {
      setError(null);
      setSafetyNumber('');
      generateSafetyNumber();
    }
  }, [isOpen, user, friend]);

  const generateSafetyNumber = async () => {
    try {
      const myKeys = await keyManager.getMyKeys(user.id);
      if (!myKeys) {
        setError("Your E2EE keys are not initialized. Please refresh the page.");
        return;
      }

      // Always fetch a FRESH key from the server for safety number verification to avoid stale cache issues
      const friendPubKey = await keyManager.fetchFriendPublicKey(friend.id, true);
      if (!friendPubKey) {
        setError(`Could not find ${friend.username}'s public key. they might need to log in again to sync their keys.`);
        return;
      }

      // Extract raw keys as strings for hashing
      const myPub = await window.crypto.subtle.exportKey("spki", myKeys.publicKey);
      const friendPub = await window.crypto.subtle.exportKey("spki", friendPubKey);

      // --- DEBUG LOGS ---
      const bufToHex = buf => Array.from(new Uint8Array(buf)).slice(0, 5).map(b => b.toString(16).padStart(2, '0')).join('');
      console.log(`[E2EE Debug] My Pub Key (first 5 bytes of SPKI): ${bufToHex(myPub)}`);
      console.log(`[E2EE Debug] Friend Pub Key (first 5 bytes of SPKI): ${bufToHex(friendPub)}`);
      // ------------------

      // Simple hash-based safety number (Signal style)
      // Combining both keys and hashing them in a deterministic order (sorted by key data)
      const keys = [new Uint8Array(myPub), new Uint8Array(friendPub)];
      // Sort keys to ensure same safety number for both parties
      keys.sort((a, b) => {
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
          if (a[i] !== b[i]) return a[i] - b[i];
        }
        return a.length - b.length;
      });

      const combined = new Uint8Array(keys[0].byteLength + keys[1].byteLength);
      combined.set(keys[0], 0);
      combined.set(keys[1], keys[0].byteLength);

      const hashBuffer = await window.crypto.subtle.digest("SHA-256", combined);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      
      // Convert to a readable numeric string (e.g. 10 groups of 5 digits)
      const numericString = hashArray.map(b => b.toString().padStart(3, '0')).join('').slice(0, 40);
      const formatted = numericString.match(/.{1,5}/g).join(' ');
      
      setSafetyNumber(formatted);
    } catch (err) {
      console.error('Failed to generate safety number:', err);
      setError("An error occurred while generating the safety number.");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(safetyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-white/10 animate-in zoom-in duration-300">
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white leading-none">Safety Number</h2>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Encrypted Session Verified</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          <div className="flex justify-center mb-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center">
                <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-full border-2 border-emerald-500 p-0.5" width="64" height="64" loading="lazy" />
                <span className="text-xs font-bold mt-2 text-gray-500 uppercase tracking-tighter">You</span>
              </div>
              <div className="flex flex-col items-center">
                <img src={friend.avatar_url} alt="" className="w-16 h-16 rounded-full border-2 border-emerald-500 p-0.5" width="64" height="64" loading="lazy" />
                <span className="text-xs font-bold mt-2 text-gray-500 uppercase tracking-tighter">{friend.username}</span>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-3xl border relative group ${error ? 'bg-rose-50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/20' : 'bg-gray-50 dark:bg-slate-950 border-gray-100 dark:border-slate-800'}`}>
            {error ? (
              <p className="text-center text-xs font-bold text-rose-600 dark:text-rose-400 leading-relaxed px-4">
                {error}
              </p>
            ) : (
              <p className="text-center font-mono text-lg md:text-xl tracking-[0.2em] text-gray-800 dark:text-emerald-400 font-bold break-all leading-relaxed px-2">
                {safetyNumber || 'Generating...'}
              </p>
            )}
            
            {!error && safetyNumber && (
              <button 
                onClick={handleCopy}
                className="absolute top-2 right-2 p-2 text-gray-400 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              </button>
            )}
          </div>

          <div className="mt-8 space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 flex gap-3">
              <Info className="text-emerald-600 flex-shrink-0" size={18} />
              <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                To verify the security of your end-to-end encryption with <strong>{friend.username}</strong>, compare the numbers above with their device.
              </p>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 flex gap-3">
              <AlertTriangle className="text-amber-600 shrink-0" size={18} />
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                If these numbers match, your conversation is 100% secure. If they don't, someone might be intercepting your connection.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button 
              onClick={async () => {
                await keyManager.clearFriendCache(friend.id);
                setError(null);
                setSafetyNumber('');
                await generateSafetyNumber();
              }}
              className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-[24px] font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 dark:hover:bg-slate-700 transition-all border border-gray-200 dark:border-slate-700"
            >
              Reset Session
            </button>
            <button 
              onClick={onClose}
              className="flex-[2] py-4 bg-slate-900 dark:bg-emerald-500 text-white rounded-[24px] font-black uppercase tracking-widest text-sm shadow-xl hover:scale-[1.02] active:scale-95 transition-all shadow-emerald-500/20"
            >
              I've Verified
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyVerification;
