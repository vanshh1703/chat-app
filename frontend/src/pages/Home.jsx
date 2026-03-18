import React, { useState, useEffect, useRef } from 'react';
import { Search, MoreVertical, Phone, Video, Plus, Smile, Send, Check, CheckCheck, CornerUpLeft, X, FileText, Download, Image as ImageIcon, Film, Trash2, ArrowLeft, Mic, Square, Settings as SettingsIcon, Camera, BarChart2, Activity, Clock, Calendar, MessageSquare, Award, TrendingUp, Zap, Pin, PinOff, Mail, Edit2, Brain, Copy, PenTool, Wifi, History, Bell, BellOff, Shield, Lock, Key, Info } from 'lucide-react';
import { io } from 'socket.io-client';
import { processMessage, ashPersona, KNOWLEDGE, INTENTS } from '../bot/ash';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../api/api';
import { Suspense } from 'react';
import { EmojiPicker, CallUI, DrawingModal, OfflineChatManager, ProfileOrganizer, KeyVerification } from '../components/lazyComponents';
import * as webrtc from '../webrtc';
import * as signaling from '../socket-events';
import StealthNotificationToast from '../components/StealthNotificationToast';
import { subscribeToPush } from '../utils/pushManager';

// face-api is loaded dynamically only when camera+face recognition is used (see useFaceapi hook)
import { useEncryption } from '../hooks/useEncryption';
import { keyManager } from '../utils/keyManager';
import { encryptFile, decryptFile } from '../utils/mediaCrypto';

const DecryptedFileMessage = ({ msg, user, activeChat, setIsDrawingOpen, setDrawingInitialImage }) => {
    const isMine = msg.sender_id === user.id;
    const [decryptedUrl, setDecryptedUrl] = useState(null);
    const [decrypting, setDecrypting] = useState(false);

    // Mobile long press logic for the pen icon
    const [showMobileActions, setShowMobileActions] = useState(false);
    const longPressTimerRef = useRef(null);

    const handleTouchStart = () => {
        longPressTimerRef.current = setTimeout(() => {
            setShowMobileActions(true);
        }, 500); // 500ms for long press
    };

    const handleTouchEndOrCancel = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    useEffect(() => {
        const isEncrypted = msg.is_media_encrypted || (!!msg.encrypted_key && !!msg.iv);
        if (isEncrypted && msg.file_url && !decryptedUrl && !decrypting) {
            const performDecryption = async () => {
                setDecrypting(true);
                try {
                    console.log("Starting media decryption for:", msg.id);
                    // Fetch the encrypted file as a blob
                    const response = await fetch(msg.file_url);
                    if (!response.ok) throw new Error(`Failed to fetch encrypted media: ${response.status}`);
                    const encryptedBlob = await response.blob();

                    // Get private key from keyManager
                    const myKeys = await keyManager.getMyKeys(user.id);
                    if (!myKeys || !myKeys.privateKey) {
                        console.error("No private key found for decryption");
                        return;
                    }

                    // For sent messages, we MUST use sender_encrypted_key if it exists
                    // For received messages, we MUST use encrypted_key
                    const isMine = String(msg.sender_id) === String(user.id);
                    const keyToUse = isMine ? (msg.sender_encrypted_key || msg.encrypted_key) : msg.encrypted_key;

                    if (!keyToUse) {
                        console.error("No encrypted key available for this message", msg.id);
                        return;
                    }

                    const ext = msg.content ? msg.content.split('.').pop().toLowerCase() : '';
                    let mimeType = 'application/octet-stream';
                    if (msg.message_type === 'image') mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                    else if (msg.message_type === 'video') mimeType = ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4';
                    else if (msg.message_type === 'audio') mimeType = ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : 'audio/mpeg';

                    const decrypted = await decryptFile(encryptedBlob, keyToUse, msg.iv, myKeys.privateKey, mimeType);
                    const fingerprint = await keyManager.getFingerprint(user.id);
                    console.log(`[decryptFile] Decryption successful for message ${msg.id}. Local Fingerprint: ${fingerprint}`);
                    const url = URL.createObjectURL(decrypted);
                    setDecryptedUrl(url);
                } catch (err) {
                    const fingerprint = await keyManager.getFingerprint(user.id);
                    const isMine = String(msg.sender_id) === String(user.id);
                    const keyToUse = isMine ? (msg.sender_encrypted_key || msg.encrypted_key) : msg.encrypted_key;

                    console.error("Media decryption error detail:", {
                        msgId: msg.id,
                        errorName: err.name,
                        errorMessage: err.message,
                        hasIv: !!msg.iv,
                        keySource: isMine ? (msg.sender_encrypted_key ? 'sender' : 'fallback-recipient') : 'recipient',
                        keyStart: keyToUse ? keyToUse.substring(0, 20) + '...' : 'null',
                        localFingerprint: fingerprint
                    });
                } finally {
                    setDecrypting(false);
                }
            };
            performDecryption();
        }
    }, [msg, decryptedUrl, decrypting, user.id]);

    const isEncrypted = msg.is_media_encrypted || (!!msg.encrypted_key && !!msg.iv);
    const fileUrl = isEncrypted ? (decryptedUrl || null) : msg.file_url;

    // Removed decrypting/loading UI for instant experience

    if (msg.message_type === 'image') {
        return (
            <div className="relative group/image"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEndOrCancel}
                onTouchCancel={handleTouchEndOrCancel}
            >
                {fileUrl ? (
                    <a href={fileUrl} target="_blank" rel="noreferrer">
                        <img src={fileUrl} alt={msg.content}
                            className="max-w-[240px] max-h-[220px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                    </a>
                ) : (
                    <div className="w-48 h-48 bg-gray-200 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                        <Shield size={32} className="text-gray-400 animate-pulse" />
                    </div>
                )}
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        setShowMobileActions(false);
                        setDrawingInitialImage(fileUrl);
                        setIsDrawingOpen(true);
                    }}
                    className={`absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-opacity backdrop-blur-sm shadow-lg ${showMobileActions ? 'opacity-100' : 'opacity-0 group-hover/image:opacity-100'}`}
                    title="Draw on Image"
                >
                    <PenTool size={16} />
                </button>
                {(isEncrypted) && (
                    <div className="absolute bottom-2 right-2 p-1 bg-emerald-500/80 backdrop-blur-sm text-white rounded-md">
                        <Lock size={10} />
                    </div>
                )}
            </div>
        );
    }
    if (msg.message_type === 'video') {
        return (
            <div className="relative">
                <video controls className="max-w-[280px] rounded-xl" src={fileUrl} preload="metadata" playsInline>
                    Your browser does not support video.
                </video>
                {(isEncrypted) && (
                    <div className="absolute top-2 right-2 p-1 bg-emerald-500/80 backdrop-blur-sm text-white rounded-md">
                        <Lock size={10} />
                    </div>
                )}
            </div>
        );
    }
    if (msg.message_type === 'audio') {
        return <ModernAudioPlayer src={fileUrl} isMine={isMine} />;
    }
    return (
        <a href={fileUrl} download={msg.content} target="_blank" rel="noreferrer"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isMine ? 'bg-white/30' : 'bg-blue-100'}`}>
                <FileText size={18} className={isMine ? 'text-white' : 'text-blue-500'} />
            </div>
            <div className="min-w-0">
                <p className={`text-xs font-semibold truncate max-w-[160px] ${isMine ? 'text-white' : 'text-gray-800'}`}>{msg.content}</p>
                <p className={`text-[10px] ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
                    {isEncrypted ? 'Encrypted File' : 'Tap to download'}
                </p>
            </div>
            {isEncrypted ? <Lock size={14} className="text-emerald-500" /> : <Download size={14} className={isMine ? 'text-white/80' : 'text-blue-400'} />}
        </a>
    );
};

// --- Modern Premium Audio Player ---
const ModernAudioPlayer = ({ src, isMine }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef(null);

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const onLoadedMetadata = () => {
        setDuration(audioRef.current.duration);
    };

    const onTimeUpdate = () => {
        setCurrentTime(audioRef.current.currentTime);
    };

    const formatTime = (time) => {
        if (isNaN(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const progress = (currentTime / duration) * 100 || 0;

    return (
        <div className={`flex items-center gap-3 p-3 rounded-[24px] min-w-[220px] max-w-full shadow-sm border ${isMine ? 'bg-white/20 border-white/10' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700'}`}>
            <audio ref={audioRef} src={src} onLoadedMetadata={onLoadedMetadata} onTimeUpdate={onTimeUpdate} onEnded={() => setIsPlaying(false)} className="hidden" />

            <button
                onClick={togglePlay}
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 ${isMine ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}
            >
                {isPlaying ? <Square size={16} fill="currentColor" /> : <Send size={16} fill="currentColor" className="ml-0.5 rotate-90" />}
            </button>

            <div className="flex-1 flex flex-col gap-1.5">
                {/* Waveform Visualization Mockup */}
                <div className="flex items-end gap-[2px] h-6 px-1">
                    {[...Array(20)].map((_, i) => {
                        const h = Math.random() * 80 + 20;
                        const isActive = (i / 20) * 100 <= progress;
                        return (
                            <div
                                key={i}
                                className={`w-[3px] rounded-full transition-all duration-300 ${isActive ? (isMine ? 'bg-white' : 'bg-blue-500') : (isMine ? 'bg-white/30' : 'bg-gray-200 dark:bg-slate-700')}`}
                                style={{ height: `${h}%` }}
                            />
                        );
                    })}
                </div>

                <div className="flex justify-between items-center">
                    <div className="h-1 flex-1 bg-current opacity-10 rounded-full mr-3 overflow-hidden relative">
                        <div className={`absolute top-0 left-0 h-full rounded-full ${isMine ? 'bg-white' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className={`text-[10px] font-bold ${isMine ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}>
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                </div>
            </div>
        </div>
    );
};

// --- Profile Avatar with Error Handling ---
const SafeAvatar = ({ src, alt, size = "w-10 h-10", className = "" }) => {
    const [error, setError] = useState(false);
    const fallbackUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${alt || 'user'}`;
    return (
        <div className={`${size} rounded-full overflow-hidden bg-gray-100 dark:bg-slate-800 flex items-center justify-center border-2 border-white shadow-sm shrink-0 ${className}`}>
            <img
                src={error || !src ? fallbackUrl : src}
                alt={alt}
                className="w-full h-full object-cover"
                onError={() => setError(true)}
                draggable={false}
            />
        </div>
    );
};

// --- Link Preview Storage Cache ---
const linkPreviewCache = {};

const LinkPreviewCard = ({ url }) => {
    const [preview, setPreview] = useState(linkPreviewCache[url] || null);
    const [loading, setLoading] = useState(!linkPreviewCache[url]);

    useEffect(() => {
        if (preview) return;
        let isMounted = true;

        const fetchPreview = async () => {
            try {
                const { data } = await api.getLinkPreview(url);
                if (isMounted) {
                    setPreview(data);
                    linkPreviewCache[url] = data;
                }
            } catch (err) {
                console.error('Failed to fetch link preview', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchPreview();
        return () => { isMounted = false; };
    }, [url, preview]);

    if (loading || !preview || (!preview.title && !preview.description)) return null;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 hover:border-blue-400 transition-colors no-underline group shadow-sm"
        >
            {preview.image && (
                <div className="h-32 w-full overflow-hidden bg-gray-100 dark:bg-slate-900 border-b border-gray-50 dark:border-slate-800">
                    <img src={preview.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
            )}
            <div className="p-3">
                <h4 className="text-xs font-black text-gray-900 dark:text-white line-clamp-1 group-hover:text-blue-500 transition-colors uppercase tracking-tight">{preview.title || url}</h4>
                {preview.description && <p className="text-[10px] text-gray-500 dark:text-slate-400 line-clamp-2 mt-1 font-medium">{preview.description}</p>}
                <p className="text-[9px] text-blue-500/70 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                    {new URL(url).hostname}
                </p>
            </div>
        </a>
    );
};

const YouTubePlayer = ({ url }) => {
    const getYouTubeID = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const videoId = getYouTubeID(url);
    if (!videoId) return null;

    return (
        <div className="mt-3 rounded-[24px] overflow-hidden border border-white/10 shadow-2xl bg-black aspect-video group relative">
            <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
            ></iframe>
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-[8px] font-black text-white uppercase tracking-tighter">YouTube Player</span>
            </div>
        </div>
    );
};


const telepathySignals = [{ icon: '⚡', label: 'Thinking of you', color: 'text-yellow-500', bg: 'bg-yellow-50', glow: 'shadow-yellow-500/20' },
{ icon: '💭', label: 'Call me later', color: 'text-blue-500', bg: 'bg-blue-50', glow: 'shadow-blue-500/20' },
{ icon: '🙏', label: 'Thank you', color: 'text-emerald-500', bg: 'bg-emerald-50', glow: 'shadow-emerald-500/20' },
{ icon: '💖', label: 'Emotional support', color: 'text-rose-500', bg: 'bg-rose-50', glow: 'shadow-rose-500/20' },
{ icon: '🔥', label: 'You got this', color: 'text-orange-500', bg: 'bg-orange-50', glow: 'shadow-orange-500/20' },
{ icon: '☕', label: 'Coffee soon?', color: 'text-amber-600', bg: 'bg-amber-50', glow: 'shadow-amber-500/20' },];

const CAMERA_FILTERS = [
    { name: 'Normal', css: 'none', type: 'css' },
    { name: 'Vintage', css: 'sepia(0.6) contrast(1.2)', type: 'css' },
    { name: 'Noir', css: 'grayscale(1) contrast(1.5)', type: 'css' },
    { name: 'Dreamy', css: 'blur(1px) brightness(1.2) contrast(0.9)', type: 'css' },
    { name: 'Neon', css: 'hue-rotate(90deg) saturate(2)', type: 'css' },
    { name: 'Warm', css: 'sepia(0.3) saturate(1.5) hue-rotate(-15deg)', type: 'css' },
    { name: 'Cool', css: 'saturate(1.2) hue-rotate(180deg)', type: 'css' },
    { name: 'Hearts', css: 'none', type: 'ar', element: '💖' },
    { name: 'Clear Skin', css: 'none', type: 'ar', element: 'blur' }
];

const SwipeableMessage = ({ children, onSwipeToReply, isMine }) => {
    const [translateX, setTranslateX] = useState(0);
    const touchStartRef = useRef(null);
    const touchCurrentRef = useRef(null);

    const handleTouchStart = (e) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchMove = (e) => {
        if (!touchStartRef.current) return;
        touchCurrentRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        const deltaX = touchCurrentRef.current.x - touchStartRef.current.x;
        const deltaY = touchCurrentRef.current.y - touchStartRef.current.y;

        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
            touchStartRef.current = null;
            setTranslateX(0);
            return;
        }

        if (deltaX < 0 && deltaX > -80) {
            setTranslateX(deltaX);
        } else if (deltaX > 0 && deltaX < 80) {
            setTranslateX(deltaX);
        }
    };

    const handleTouchEnd = () => {
        if (Math.abs(translateX) > 50) {
            onSwipeToReply();
        }
        setTranslateX(0);
        touchStartRef.current = null;
        touchCurrentRef.current = null;
    };

    return (
        <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            style={{
                transform: `translateX(${translateX}px)`,
                transition: translateX === 0 ? 'transform 0.2s ease-out' : 'none'
            }}
            className="w-full relative touch-pan-y"
        >
            {children}
            <div
                className={`absolute top-1/2 -translate-y-1/2 ${translateX < 0 ? 'right-[-40px]' : 'left-[-40px]'} flex items-center justify-center p-2 rounded-full bg-gray-100 dark:bg-slate-800 text-blue-500 transition-opacity duration-200 ${Math.abs(translateX) > 30 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <CornerUpLeft size={16} />
            </div>
        </div>
    );
};


const Home = () => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('profile'))?.user);
    const [sidebarUsers, setSidebarUsers] = useState([]);
    // Utility: Mark screenshot in sidebar
    const markScreenshotInSidebar = () => {
        setSidebarUsers(prev => prev.map(u =>
            u.id === user.id
                ? { ...u, lastmsg: 'Took a screenshot', lastmsgtype: 'text', lastmsgtime: new Date().toISOString() }
                : u
        ));
    };
    // Listen for screenshot event (for demo, use a keyboard shortcut: Ctrl+Shift+S)
    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
                markScreenshotInSidebar();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);
    // For sidebar profile modal
    const [profileModalUser, setProfileModalUser] = useState(null);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const socket = useRef();
    const scrollRef = useRef();
    const [typingUsers, setTypingUsers] = useState({});
    const [onlineUsers, setOnlineUsers] = useState({});
    const typingTimeoutRef = useRef(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [hoveredMsgId, setHoveredMsgId] = useState(null);
    const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
    const emojiPickerRef = useRef();
    const [replyingTo, setReplyingTo] = useState(null);
    const inputRef = useRef();
    const [highlightedMsgId, setHighlightedMsgId] = useState(null);
    const [chatSearchTerm, setChatSearchTerm] = useState('');
    const [showChatSearch, setShowChatSearch] = useState(false);
    const fileInputRef = useRef();
    const [uploading, setUploading] = useState(false);
    const [attachPreview, setAttachPreview] = useState(null); // { file, url, type }
    const [editingMsg, setEditingMsg] = useState(null);
    const [lastAshIntent, setLastAshIntent] = useState(null);
    const [isDrawingOpen, setIsDrawingOpen] = useState(false);
    const [drawingInitialImage, setDrawingInitialImage] = useState(null);
    const [stealthNotif, setStealthNotif] = useState(null); // { message, settings }

    // Audio recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef(null);
    const [activeCameraFilter, setActiveCameraFilter] = useState(CAMERA_FILTERS[0]);
    const [isCameraRecording, setIsCameraRecording] = useState(false);
    const isCameraRecordingRef = useRef(false);
    const cameraRecorderRef = useRef(null);
    const cameraCanvasRef = useRef(null);
    const cameraStreamRef = useRef(null);
    const cameraChunksRef = useRef([]);
    const cameraAnimationRef = useRef(null);
    const cameraOverlayCanvasRef = useRef(null);
    const [isFaceApiLoaded, setIsFaceApiLoaded] = useState(false);
    const arTrackingAnimationRef = useRef(null);
    const [cameraPreview, setCameraPreview] = useState(null);
    const [chatWallpaper, setChatWallpaper] = useState('default');
    const [viewingProfile, setViewingProfile] = useState(null); // User object
    const [isEditingAlias, setIsEditingAlias] = useState(false);
    const [newAlias, setNewAlias] = useState('');
    const [isPowerModalOpen, setIsPowerModalOpen] = useState(false);
    const [powerLevel, setPowerLevel] = useState(0);
    const [isPoweringUp, setIsPoweringUp] = useState(false);
    const [activeSorryBlast, setActiveSorryBlast] = useState(null); // { power, timestamp }
    const [showTelepathyPicker, setShowTelepathyPicker] = useState(false);
    const [isOfflineChatOpen, setIsOfflineChatOpen] = useState(false);
    const [showMediaGallery, setShowMediaGallery] = useState(false);
    const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
    const [historyMsg, setHistoryMsg] = useState(null);
    const [messageOffset, setMessageOffset] = useState(0);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const messageContainerRef = useRef(null);
    const [isKeyVerificationOpen, setIsKeyVerificationOpen] = useState(false);
    const navigate = useNavigate();

    // WebRTC & Calling State
    const [incomingCall, setIncomingCall] = useState(null);
    const [activeCall, setActiveCall] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [facingMode, setFacingMode] = useState('user');

    // Refs for signaling stability
    const activeChatRef = useRef(activeChat);
    const incomingCallRef = useRef(incomingCall);
    const localStreamRef = useRef(localStream);

    useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);
    useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
    useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
    const peerConnection = useRef(null);
    const pendingCandidates = useRef([]);
    const currentCallIdRef = useRef(null);
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const screenStreamRef = useRef(null);

    // E2EE Encryption Hook
    const { encrypt, decrypt, isReady: encryptionReady } = useEncryption(user?.id);
    const [decryptedMessages, setDecryptedMessages] = useState({}); // { msgId: text }

    useEffect(() => {
        if (user) {
            setChatWallpaper(localStorage.getItem(`chatWallpaper_${user.id}`) || 'default');
        }
    }, [user]);

    // Separate useEffect for socket connection to avoid reconnecting on chat switch
    useEffect(() => {
        const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
        socket.current = io(socketUrl);
        return () => socket.current.disconnect();
    }, []);

    // Initialize listeners and Request Notification Permission
    useEffect(() => {
        if (!socket.current) return;

        // Request browser notification permission
        console.log('Notification permission status:', Notification.permission);
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            console.log('Requesting notification permission...');
            Notification.requestPermission().then(permission => {
                console.log('Notification permission result:', permission);
                if (permission === 'granted') {
                    console.log('Subscribing to push notifications (first time)...');
                    subscribeToPush();
                }
            });
        } else if ('Notification' in window && Notification.permission === 'granted') {
            console.log('Already have permission, subscribing to push notifications...');
            subscribeToPush();
        }

        const currentSocket = socket.current;

        if (user) {
            currentSocket.emit('join', user.id);

            // Handle reconnection
            currentSocket.on('connect', () => {
                currentSocket.emit('join', user.id);
            });
        }

        currentSocket.on('receive_message', async (newMessage) => {
            // Ignore messages from ASH bot, as they are handled locally
            if (newMessage.sender_id === ashPersona.id || newMessage.receiver_id === ashPersona.id) {
                return;
            }

            console.log('Message received:', newMessage);
            setMessages((prev) => {
                // Only append if it belongs to current active chat
                if (activeChat && (String(newMessage.sender_id) === String(activeChat.id) || String(newMessage.receiver_id) === String(activeChat.id))) {
                    return [...prev, newMessage];
                }
                return prev;
            });

            // Handle Decryption for new messages (only if it's a text message)
            if (newMessage.message_type === 'text' && newMessage.encrypted_key && encryptionReady) {
                const text = await decrypt(newMessage);
                setDecryptedMessages(prev => ({ ...prev, [newMessage.id]: text }));
            }
            if (newMessage.sender_id !== user.id) {
                // Determine if we should show a foreground notification/sound
                // Use String comparison for safety
                const isDifferentChat = !activeChatRef.current || String(activeChatRef.current.id) !== String(newMessage.sender_id);
                const isAppVisible = !document.hidden;

                // Get sender's mute status
                const senderInSidebar = sidebarUsers.find(u => String(u.id) === String(newMessage.sender_id));
                const isMuted = senderInSidebar ? senderInSidebar.is_muted : (activeChatRef.current && String(activeChatRef.current.id) === String(newMessage.sender_id) ? activeChatRef.current.is_muted : false);

                if (isAppVisible && !isMuted) {
                    const notifSettings = JSON.parse(localStorage.getItem('notifSettings') || '{"individual": true, "all": true, "sound": true}');
                    const shouldNotify = notifSettings.all && (isDifferentChat ? notifSettings.individual : true);

                    if (shouldNotify) {
                        // Always play sound if enabled and app is visible, even if in active chat (as long as it's not muted)
                        if (notifSettings.sound) {
                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                            audio.play().catch(e => console.error("Sound play failed", e));
                        }

                        // Only show visual notification if we're in a DIFFERENT chat or list view
                        if (isDifferentChat) {
                            const stealthSettings = JSON.parse(localStorage.getItem('stealthNotifSettings') || '{"enabled": false}');
                            if (stealthSettings.enabled) {
                                setStealthNotif({ message: newMessage, settings: stealthSettings });
                            } else if ('Notification' in window && Notification.permission === 'granted') {
                                const title = `New message from ${newMessage.senderName || 'a user'}`;
                                const options = {
                                    body: newMessage.message_type === 'text' ? newMessage.content : `Sent an ${newMessage.message_type}`,
                                    icon: '/pwa-192x192.png',
                                    badge: '/pwa-192x192.png',
                                    vibrate: [100, 50, 100],
                                    tag: 'message-notification',
                                    renotify: true,
                                    data: {
                                        url: window.location.origin + '/home'
                                    }
                                };

                                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                                    navigator.serviceWorker.ready.then(registration => {
                                        registration.showNotification(title, options);
                                    });
                                } else {
                                    new Notification(title, options);
                                }
                            }
                        }
                    }
                }
            }

            if (activeChat && String(newMessage.sender_id) === String(activeChat.id)) {
                try {
                    await api.markAsRead({ senderId: activeChat.id });
                } catch (e) { console.error(e); }
            }
            // Refresh sidebar to update last message/order
            fetchSidebar();
        });

        currentSocket.on('typing', (data) => {
            setTypingUsers(prev => ({ ...prev, [data.senderId]: true }));
        });

        currentSocket.on('stop_typing', (data) => {
            setTypingUsers(prev => ({ ...prev, [data.senderId]: false }));
        });

        currentSocket.on('user_status', (data) => {
            setOnlineUsers(prev => ({
                ...prev,
                [data.userId]: { isOnline: data.isOnline, lastSeen: data.lastSeen }
            }));
        });

        currentSocket.on('messages_read', (data) => {
            setMessages((prev) =>
                prev.map((msg) =>
                    (msg.receiver_id === data.byUserId && !msg.is_read)
                        ? { ...msg, is_read: true }
                        : msg));
        });

        currentSocket.on('message_updated', (updatedMsg) => {
            setMessages((prev) =>
                prev.map((msg) => msg.id === updatedMsg.id ? updatedMsg : msg));
        });

        currentSocket.on('message_deleted', ({ messageId }) => {
            setMessages((prev) =>
                prev.map((msg) => msg.id === messageId ? { ...msg, is_deleted: true, content: '' } : msg));
        });

        // Screenshot detection
        const handleKeyDown = (e) => {
            const screenshotKeys = ['PrintScreen', 'Print', 'Snapshot'];
            if (screenshotKeys.includes(e.key)) {
                if (activeChat) {
                    socket.current.emit('screenshot_taken', {
                        senderId: user.id,
                        receiverId: activeChat.id,
                        senderName: user.username
                    });
                    console.log('Screenshot detection triggered (keydown):', e.key);
                }
            }
        };

        const handleKeyUp = (e) => {
            const screenshotKeys = ['PrintScreen', 'Print', 'Snapshot'];
            if (screenshotKeys.includes(e.key)) {
                if (activeChat) {
                    socket.current.emit('screenshot_taken', {
                        senderId: user.id,
                        receiverId: activeChat.id,
                        senderName: user.username
                    });
                    console.log('Screenshot detection triggered (keyup):', e.key);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            currentSocket.off('connect');
            currentSocket.off('receive_message');
            currentSocket.off('typing');
            currentSocket.off('stop_typing');
            currentSocket.off('user_status');
            currentSocket.off('messages_read');
            currentSocket.off('message_updated');
            currentSocket.off('message_deleted');
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [user, activeChat, sidebarUsers, encryptionReady, decrypt]);

    // Batch Decrypt Messages when they change (including sidebar last messages)
    useEffect(() => {
        if (!encryptionReady) return;

        const decryptBatch = async () => {
            const decryptNeededMessages = messages.filter(m => m.message_type === 'text' && m.encrypted_key && !decryptedMessages[m.id]);
            const decryptNeededSidebar = sidebarUsers
                .filter(u => u.lastmsgtype === 'text' && u.lastMsgData?.encrypted_key && !decryptedMessages[u.lastMsgData.id])
                .map(u => u.lastMsgData);

            const allNeeded = [...decryptNeededMessages, ...decryptNeededSidebar];
            if (allNeeded.length === 0) return;

            const newDecrypted = { ...decryptedMessages };
            let changed = false;
            for (const msg of allNeeded) {
                if (!newDecrypted[msg.id]) {
                    newDecrypted[msg.id] = await decrypt(msg);
                    changed = true;
                }
            }
            if (changed) setDecryptedMessages(newDecrypted);
        };

        decryptBatch();
    }, [messages, sidebarUsers, encryptionReady, decrypt, decryptedMessages]);

    // --- WebRTC Signaling Listeners ---
    useEffect(() => {
        if (!socket.current) return;
        const s = socket.current;

        const handleIncomingCall = (data) => {
            console.log("Incoming call received:", data);
            currentCallIdRef.current = data.callId;
            setIncomingCall({ ...data, isCaller: false });
            // Play ringtone
            const ringtone = new Audio('https://assets.mixkit.co/active_storage/sfx/1350/1350-preview.mp3');
            ringtone.play().catch(e => console.error("Ringtone failed", e));
        };

        const handleCallInitiated = (data) => {
            console.log("Call record created on server, ID:", data.callId);
            currentCallIdRef.current = data.callId;
        };

        const handleAcceptCallSignaling = async (data) => {
            console.log("Call accepted by remote user");
            if (window.ringbackTone) {
                window.ringbackTone.pause();
                window.ringbackTone = null;
            }
            try {
                // Use refs to get latest state
                const callType = incomingCallRef.current?.type || 'video';
                const stream = await webrtc.getMediaStream(callType);
                setLocalStream(stream);

                const partnerId = activeChatRef.current?.id || incomingCallRef.current?.from || data?.from;

                peerConnection.current = webrtc.createPeerConnection(
                    (candidate) => signaling.emitIceCandidate(s, { to: partnerId, candidate }),
                    (rStream) => setRemoteStream(rStream)
                );

                stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

                const offer = await webrtc.createOffer(peerConnection.current);
                signaling.emitOffer(s, { to: partnerId, offer });
                setActiveCall(true);

                // Drain candidates
                for (const cand of pendingCandidates.current) {
                    await webrtc.addIceCandidate(peerConnection.current, cand);
                }
                pendingCandidates.current = [];
            } catch (err) {
                console.error("Error setting up call after acceptance", err);
                handleEndCall();
            }
        };

        const handleRejectCallSignaling = () => {
            alert("Call rejected");
            if (window.ringbackTone) {
                window.ringbackTone.pause();
                window.ringbackTone = null;
            }
            handleEndCall();
        };

        const handleOffer = async (data) => {
            console.log("Received WebRTC offer");
            try {
                const answer = await webrtc.createAnswer(peerConnection.current, data.offer);
                signaling.emitAnswer(s, { to: data.from, answer });
                setActiveCall(true);

                for (const cand of pendingCandidates.current) {
                    await webrtc.addIceCandidate(peerConnection.current, cand);
                }
                pendingCandidates.current = [];
            } catch (err) {
                console.error("Error handling offer", err);
            }
        };

        const handleAnswer = async (data) => {
            console.log("Received WebRTC answer");
            await webrtc.handleAnswer(peerConnection.current, data.answer);
            for (const cand of pendingCandidates.current) {
                await webrtc.addIceCandidate(peerConnection.current, cand);
            }
            pendingCandidates.current = [];
        };

        const handleIceCandidate = async (data) => {
            if (peerConnection.current && peerConnection.current.remoteDescription) {
                await webrtc.addIceCandidate(peerConnection.current, data.candidate);
            } else {
                pendingCandidates.current.push(data.candidate);
            }
        };

        const handleRemoteEndCall = () => {
            console.log("Call ended by remote user");
            handleEndCall();
        };

        s.on('incoming-call', handleIncomingCall);
        s.on('call-initiated', handleCallInitiated);
        s.on('accept-call', handleAcceptCallSignaling);
        s.on('reject-call', handleRejectCallSignaling);
        s.on('send-offer', handleOffer);
        s.on('send-answer', handleAnswer);
        s.on('ice-candidate', handleIceCandidate);
        s.on('end-call', handleRemoteEndCall);

        return () => {
            s.off('incoming-call', handleIncomingCall);
            s.off('call-initiated', handleCallInitiated);
            s.off('accept-call', handleAcceptCallSignaling);
            s.off('reject-call', handleRejectCallSignaling);
            s.off('send-offer', handleOffer);
            s.off('send-answer', handleAnswer);
            s.off('ice-candidate', handleIceCandidate);
            s.off('end-call', handleRemoteEndCall);
        };
    }, []); // Stable effect

    const handleStartCall = async (type = 'video') => {
        if (!activeChat) return;
        if (activeChat.id === ashPersona.id) {
            alert("You cannot call ASH.");
            return;
        }
        try {
            // First notify the other user
            signaling.emitCallUser(socket.current, {
                to: activeChat.id,
                from: user.id,
                name: user.username,
                avatar: user.avatar_url,
                type: type
            });

            // Set up local state
            setIncomingCall({
                name: activeChat.username,
                avatar: activeChat.avatar_url,
                type,
                isCaller: true,
                to: activeChat.id
            });

            // Play ringback tone (calling sound)
            const ringback = new Audio('https://assets.mixkit.co/active_storage/sfx/1350/1350-preview.mp3');
            ringback.loop = true;
            ringback.play().catch(e => console.error("Ringback failed", e));
            window.ringbackTone = ringback;

            // Note: We wait for 'accept-call' before starting the WebRTC stream to save resources 
            // and avoid camera activation until the other person is ready.
        } catch (err) {
            console.error("Start call error", err);
        }
    };

    const handleAcceptCall = async () => {
        if (!incomingCall) return;
        try {
            const stream = await webrtc.getMediaStream(incomingCall.type);
            setLocalStream(stream);

            peerConnection.current = webrtc.createPeerConnection((candidate) => signaling.emitIceCandidate(socket.current, { to: incomingCall.from, candidate }),
                (rStream) => setRemoteStream(rStream));

            stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

            signaling.emitAcceptCall(socket.current, { to: incomingCall.from, callId: currentCallIdRef.current });
            setActiveCall(true);
            // The caller will receive 'accept-call' and send an offer.
        } catch (err) {
            console.error("Accept call error", err);
            alert("Could not access camera/microphone.");
            handleRejectCall();
        }
    };

    const handleRejectCall = () => {
        if (incomingCall?.from) {
            signaling.emitRejectCall(socket.current, { to: incomingCall.from, callId: currentCallIdRef.current });
        }
        setIncomingCall(null);
        currentCallIdRef.current = null;
    };

    const handleEndCall = () => {
        // Robust target detection
        const targetId = activeChatRef.current?.id || incomingCallRef.current?.from || incomingCallRef.current?.to;

        if (targetId && socket.current) {
            signaling.emitEndCall(socket.current, { to: targetId, callId: currentCallIdRef.current });
        }

        // Stop ringback tone if active
        if (window.ringbackTone) {
            window.ringbackTone.pause();
            window.ringbackTone = null;
        }

        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }

        setIsSharingScreen(false);
        setLocalStream(null);
        setRemoteStream(null);
        setActiveCall(null);
        setIncomingCall(null);
        pendingCandidates.current = [];
        currentCallIdRef.current = null;
    };

    const handleToggleScreenShare = async () => {
        if (!peerConnection.current) return;

        if (isSharingScreen) {
            // Stop sharing
            try {
                if (screenStreamRef.current) {
                    screenStreamRef.current.getTracks().forEach(track => track.stop());
                    screenStreamRef.current = null;
                }

                // Switch back to camera
                if (localStream) {
                    const videoTrack = localStream.getVideoTracks()[0];
                    const sender = peerConnection.current.getSenders().find(s => s.track.kind === 'video');
                    if (sender && videoTrack) {
                        await sender.replaceTrack(videoTrack);
                    }
                }
                setIsSharingScreen(false);
            } catch (err) {
                console.error("Error stopping screen share", err);
            }
        } else {
            // Start sharing
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                screenStreamRef.current = stream;
                const screenTrack = stream.getVideoTracks()[0];

                const sender = peerConnection.current.getSenders().find(s => s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                }

                screenTrack.onended = () => {
                    handleToggleScreenShare(); // Revert to camera if user stops via browser UI
                };

                setIsSharingScreen(true);
            } catch (err) {
                console.error("Error starting screen share", err);
            }
        }
    };

    const handleSwitchCamera = async () => {
        if (!activeCall || !localStream || !peerConnection.current) return;
        const newMode = facingMode === 'user' ? 'environment' : 'user';
        try {
            const newStream = await webrtc.getMediaStream('video', newMode);
            const videoTrack = newStream.getVideoTracks()[0];
            const sender = peerConnection.current.getSenders().find(s => s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(videoTrack);
            }
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(newStream);
            setFacingMode(newMode);
        } catch (err) {
            console.error("Switch camera error", err);
        }
    };

    // Fetch sidebar users
    const fetchSidebar = async () => {
        try {
            const { data } = await api.getSidebar();

            // Standardize property names for Sidebar messages
            const normalizedData = data.map(u => ({
                ...u,
                lastMsgData: {
                    id: u.lastmsgid,
                    content: u.lastmsg,
                    sender_id: u.lastmsgsenderid,
                    encrypted_key: u.lastmsgenckey,
                    sender_encrypted_key: u.lastmsgsenderenckey,
                    iv: u.lastmsgiv,
                    encrypted_content: u.lastmsgenccontent,
                    message_type: u.lastmsgtype
                }
            }));

            // Handle background decryption for sidebar messages
            if (encryptionReady) {
                normalizedData.forEach(async (chat) => {
                    const msg = chat.lastMsgData;
                    if (msg.message_type === 'text' && msg.encrypted_key && !decryptedMessages[msg.id]) {
                        try {
                            const text = await decrypt(msg);
                            setDecryptedMessages(prev => ({ ...prev, [msg.id]: text }));
                        } catch (e) {
                            console.error(`Sidebar decryption failed for user ${chat.id}`, e);
                        }
                    }
                });
            }

            // Ensure ASH is always in the sidebar
            let updatedSidebarUsers = [...normalizedData];
            const hasAsh = updatedSidebarUsers.some(u => u.id === ashPersona.id);

            if (!hasAsh) {
                const ashContact = {
                    id: ashPersona.id,
                    username: ashPersona.name,
                    avatar_url: ashPersona.avatar_url,
                    lastmsg: "System Online. Type 'help' to begin.",
                    lastmsgtime: new Date().toISOString(),
                    unreadcount: 0,
                    is_pinned: true // Pin ASH by default
                };
                updatedSidebarUsers.unshift(ashContact); // Add ASH to the beginning
            } else {
                // If ASH is already in data, ensure it's at the top and pinned
                const ashIndex = updatedSidebarUsers.findIndex(u => u.id === ashPersona.id);
                const ashFromData = updatedSidebarUsers[ashIndex];
                const updatedAsh = { ...ashFromData, is_pinned: true }; // Ensure pinned
                updatedSidebarUsers = updatedSidebarUsers.filter(u => u.id !== ashPersona.id);
                updatedSidebarUsers.unshift(updatedAsh); // Move ASH to the beginning
            }

            setSidebarUsers(updatedSidebarUsers);

            // Update App Badge
            const totalUnread = updatedSidebarUsers.reduce((sum, u) => sum + Number(u.unreadcount || 0), 0);
            if ('setAppBadge' in navigator) {
                if (totalUnread > 0) {
                    navigator.setAppBadge(totalUnread).catch(() => { });
                } else {
                    navigator.clearAppBadge().catch(() => { });
                }
            }

            const statuses = {};
            updatedSidebarUsers.forEach(u => statuses[u.id] = { isOnline: u.is_online, lastSeen: u.last_seen });
            setOnlineUsers(prev => ({ ...prev, ...statuses }));
        } catch (err) {
            console.error('Fetch sidebar error', err);
        }
    };

    useEffect(() => {
        fetchSidebar();
    }, []);

    useEffect(() => {
        let stream;
        if (isCameraOpen) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(s => {
                    stream = s;
                    if (videoRef.current) {
                        videoRef.current.srcObject = s;
                    }
                })
                .catch(err => {
                    console.error('Camera access error', err);
                    setIsCameraOpen(false);
                    alert('Could not access camera. Please check permissions.');
                });

            // Load Face API Models
            const loadModels = async () => {
                if (isFaceApiLoaded) return;
                try {
                    await Promise.all([
                        // The face-api.js library requires the URI to point to the directory containing the manifests
                        faceapi.nets.tinyFaceDetector.loadFromUri('/face-models'),
                        faceapi.nets.faceLandmark68TinyNet.loadFromUri('/face-models')
                    ]);
                    setIsFaceApiLoaded(true);
                    console.log("Face API models loaded successfully.");
                } catch (e) {
                    console.error("Failed to load face-api models:", e);
                }
            };
            loadModels();

        }
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (arTrackingAnimationRef.current) cancelAnimationFrame(arTrackingAnimationRef.current);
        };
    }, [isCameraOpen]);

    // AR Tracking loop
    useEffect(() => {
        if (!isCameraOpen || !videoRef.current || !cameraOverlayCanvasRef.current) return;

        const video = videoRef.current;
        const canvas = cameraOverlayCanvasRef.current;
        const ctx = canvas.getContext('2d');

        const detectFace = async () => {
            if (video.paused || video.ended || !isCameraOpen || video.readyState !== 4) {
                arTrackingAnimationRef.current = requestAnimationFrame(detectFace);
                return;
            }

            // Setup canvas dimensions to match video
            if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (activeCameraFilter.type === 'ar') {
                if (!isFaceApiLoaded) {
                    ctx.font = '20px Arial';
                    ctx.fillStyle = 'white';
                    ctx.textAlign = 'center';
                    ctx.fillText('Loading AR Models...', canvas.width / 2, 50);
                } else {
                    try {
                        const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })).withFaceLandmarks(true);
                        if (detections) {
                            const dims = faceapi.matchDimensions(canvas, video, true);
                            const resizedResult = faceapi.resizeResults(detections, dims);

                            if (activeCameraFilter.name === 'Hearts') {
                                // Draw floating hearts over head
                                const landmarks = resizedResult.landmarks.positions;
                                const topOfHead = landmarks[27]; // between eyes
                                ctx.font = '40px Arial';
                                ctx.textAlign = 'center';
                                ctx.fillText('💖', topOfHead.x - 40, topOfHead.y - 120);
                                ctx.fillText('💖', topOfHead.x + 40, topOfHead.y - 100);
                                ctx.fillText('💖', topOfHead.x, topOfHead.y - 160);
                            } else if (activeCameraFilter.name === 'Clear Skin') {
                                // Soft focus blur block over the central face
                                const box = resizedResult.detection.box;
                                ctx.filter = 'blur(4px) opacity(0.5)';
                                ctx.fillStyle = '#ffcccc'; // slight tint
                                ctx.beginPath();
                                ctx.ellipse(box.x + box.width / 2, box.y + box.height / 2, box.width / 2.5, box.height / 2.2, 0, 0, 2 * Math.PI);
                                ctx.fill();
                                ctx.filter = 'none';
                            }
                        } else {
                            // No face detected debug text
                            ctx.font = '20px Arial';
                            ctx.fillStyle = 'rgba(255,255,255,0.5)';
                            ctx.textAlign = 'center';
                            ctx.fillText('No Face Detected', canvas.width / 2, 50);
                        }
                    } catch (err) {
                        console.error("AR Tracking Error:", err);
                    }
                }
            }

            arTrackingAnimationRef.current = requestAnimationFrame(detectFace);
        };

        // Start loop when video is playing
        const handlePlay = () => detectFace();
        video.addEventListener('play', handlePlay);

        // Fire immediately if already playing
        if (!video.paused) detectFace();

        return () => {
            video.removeEventListener('play', handlePlay);
            if (arTrackingAnimationRef.current) cancelAnimationFrame(arTrackingAnimationRef.current);
        };
    }, [isCameraOpen, isFaceApiLoaded, activeCameraFilter]);

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');

        ctx.filter = activeCameraFilter.type === 'css' ? activeCameraFilter.css : 'none';
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none'; // reset filter before drawing AR

        if (activeCameraFilter.type === 'ar' && cameraOverlayCanvasRef.current) {
            ctx.drawImage(cameraOverlayCanvasRef.current, 0, 0, canvas.width, canvas.height);
        }

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
                const url = URL.createObjectURL(file);
                setCameraPreview({ file, url, type: 'image', name: file.name });
            }
        }, 'image/jpeg', 0.8);
    };

    const startVideoRecording = () => {
        if (!videoRef.current) return;
        setIsCameraRecording(true);
        isCameraRecordingRef.current = true;

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        cameraCanvasRef.current = canvas;
        const ctx = canvas.getContext('2d');

        const drawFrame = () => {
            if (!videoRef.current || !isCameraRecordingRef.current) return;

            ctx.filter = activeCameraFilter.type === 'css' ? activeCameraFilter.css : 'none';
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            ctx.filter = 'none';

            if (activeCameraFilter.type === 'ar' && cameraOverlayCanvasRef.current) {
                ctx.drawImage(cameraOverlayCanvasRef.current, 0, 0, canvas.width, canvas.height);
            }

            cameraAnimationRef.current = requestAnimationFrame(drawFrame);
        };
        drawFrame();

        // Check if captureStream is available (standards compliance)
        const stream = canvas.captureStream ? canvas.captureStream(30) : null;
        if (!stream) {
            console.error('canvas.captureStream is not supported by this browser.');
            setIsCameraRecording(false);
            isCameraRecordingRef.current = false;
            return;
        }

        cameraStreamRef.current = stream;
        cameraChunksRef.current = [];

        try {
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) cameraChunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                const blob = new Blob(cameraChunksRef.current, { type: 'video/webm' });
                const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
                const url = URL.createObjectURL(file);
                setIsCameraRecording(false);
                isCameraRecordingRef.current = false;
                if (cameraAnimationRef.current) cancelAnimationFrame(cameraAnimationRef.current);
                setCameraPreview({ file, url, type: 'video', name: file.name });
            };
            cameraRecorderRef.current = recorder;
            recorder.start();
        } catch (err) {
            console.error("MediaRecorder error", err);
            setIsCameraRecording(false);
            isCameraRecordingRef.current = false;
        }
    };

    const stopVideoRecording = () => {
        setIsCameraRecording(false);
        isCameraRecordingRef.current = false;
        if (cameraRecorderRef.current && cameraRecorderRef.current.state === 'recording') {
            cameraRecorderRef.current.stop();
        }
        if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (cameraAnimationRef.current) cancelAnimationFrame(cameraAnimationRef.current);
    };

    // Wallpaper Logic
    useEffect(() => {
        const handleStorage = (e) => {
            if (user && e.key === `chatWallpaper_${user.id} `) setChatWallpaper(e.newValue || 'default');
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [user]);

    // Scroll to bottom on new messages
    const shouldScrollToBottomRef = useRef(true);

    // Use useLayoutEffect for scroll management to prevent "jumping"
    const lastMessageCountRef = useRef(0);

    React.useLayoutEffect(() => {
        const container = messageContainerRef.current;
        if (!container) return;

        // If we are loading more, don't scroll to bottom
        if (!shouldScrollToBottomRef.current) {
            shouldScrollToBottomRef.current = true;
            lastMessageCountRef.current = messages.length;
            return;
        }

        // If it's a new chat or a NEW incoming message, scroll to bottom
        if (messages.length > lastMessageCountRef.current) {
            // Scroll to bottom
            scrollRef.current?.scrollIntoView({ behavior: 'auto' });
        }

        lastMessageCountRef.current = messages.length;
    }, [messages]);

    // Handle Search
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (searchTerm.trim()) {
                try {
                    const { data } = await api.searchUsers(searchTerm);
                    // Filter out the bot itself from search if it appears (though it shouldn't be in DB)
                    setSearchResults(data.filter(u => u.username !== ashPersona.name));

                    const statuses = {};
                    data.forEach(u => statuses[u.id] = { isOnline: u.is_online, lastSeen: u.last_seen });
                    setOnlineUsers(prev => ({ ...prev, ...statuses }));
                } catch (err) {
                    console.error('Search error', err);
                }
            } else {
                setSearchResults([]);
            }
        }, 500);
        return () => clearTimeout(delaySearch);
    }, [searchTerm]);

    // Handle clicking a user (from sidebar or search)
    const handleSelectChat = async (selectedUser) => {
        setActiveChat(selectedUser);
        setShowEmojiPicker(false);
        setShowTelepathyPicker(false);
        setSearchTerm('');
        setSearchResults([]);
        setMessageOffset(0);
        setHasMoreMessages(true);
        if (String(selectedUser.id) === String(ashPersona.id)) {
            const saved = localStorage.getItem('ash_messages');
            setMessages(saved ? JSON.parse(saved) : []);
            return;
        }
        try {
            await api.markAsRead({ senderId: selectedUser.id });
            const { data } = await api.getMessages(selectedUser.id, 20, 0);
            setMessages(data);
            setMessageOffset(data.length);
            if (data.length < 20) setHasMoreMessages(false);
            fetchSidebar();
        } catch (err) {
            console.error('Fetch messages error', err);
        }
    };

    const loadMoreMessages = async () => {
        if (!activeChat || !hasMoreMessages || isLoadingMore || activeChat.id === ashPersona.id) return;

        setIsLoadingMore(true);
        const container = messageContainerRef.current;
        const scrollHeightBefore = container.scrollHeight;

        try {
            const { data } = await api.getMessages(activeChat.id, 20, messageOffset);
            if (data.length === 0) {
                setHasMoreMessages(false);
            } else {
                shouldScrollToBottomRef.current = false;
                setMessages(prev => [...data, ...prev]);
                setMessageOffset(prev => prev + data.length);
                if (data.length < 20) setHasMoreMessages(false);

                // Preserve scroll position (instant adjustment)
                setTimeout(() => {
                    if (container) {
                        const newScrollTop = container.scrollHeight - scrollHeightBefore;
                        // Force the scroll position to be at least 25 to avoid re-triggering the load
                        container.scrollTop = Math.max(newScrollTop, 25);
                    }
                }, 0);
            }
        } catch (err) {
            console.error('Load more messages error', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const handleScroll = (e) => {
        // Detect if scrolled near top (within 20px threshold)
        if (e.target.scrollTop <= 20 && !isLoadingMore && hasMoreMessages) {
            loadMoreMessages();
        }
    };

    // --- Copy Logic ---
    const handleCopyMessage = (msg) => {
        const baseContent = decryptedMessages[msg.id] || msg.content;
        const textToCopy = msg.message_type === 'telepathy' ? baseContent.split(' • ')[0] : baseContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Optional: Show a brief toast or change icon state
            setHoveredMsgId(null);
        }).catch(err => console.error('Copy failed', err));
    };

    // Send logic
    const handleSendMessage = (e) => {
        if (e) e.preventDefault();
        setShowEmojiPicker(false);
        setShowTelepathyPicker(false);
        if (!messageText.trim() || !activeChat) return;

        if (activeChat.id === ashPersona.id) {
            // Local bot message
            const currentMsg = messageText; // Important: Capture before state clear
            const botMsg = {
                id: `ash_${Date.now()}`,
                sender_id: user.id,
                recipient_id: ashPersona.id,
                content: currentMsg,
                message_type: 'text',
                created_at: new Date().toISOString()
            };

            setMessages(prev => {
                const newMsgs = [...prev, botMsg];
                localStorage.setItem('ash_messages', JSON.stringify(newMsgs));
                return newMsgs;
            });

            // Simulate typing
            setTypingUsers(prev => ({ ...prev, [ashPersona.id]: true }));

            setTimeout(() => {
                try {
                    const response = processMessage(currentMsg, {
                        user,
                        sidebarUsers,
                        contactsCount: sidebarUsers.length,
                        isOnline: navigator.onLine,
                        wallpaper: chatWallpaper,
                        stats: {}, // Fixed: chatStats was missing
                        lastIntent: lastAshIntent
                    });

                    // Update ASH memory
                    if (response) {
                        const matchedKey = Object.keys(KNOWLEDGE).concat(Object.keys(INTENTS)).find(k => response.toLowerCase().includes(k.toLowerCase()));
                        if (matchedKey) setLastAshIntent(matchedKey);
                    }

                    const replyMsg = {
                        id: `ash_reply_${Date.now()}`,
                        sender_id: ashPersona.id,
                        recipient_id: user.id,
                        content: response || "I am processing your signal, but no data was returned.",
                        message_type: 'text',
                        created_at: new Date().toISOString()
                    };

                    setMessages(prev => {
                        const newMsgs = [...prev, replyMsg];
                        localStorage.setItem('ash_messages', JSON.stringify(newMsgs));
                        return newMsgs;
                    });
                } catch (err) {
                    console.error("ASH Response Error:", err);
                } finally {
                    setTypingUsers(prev => ({ ...prev, [ashPersona.id]: false }));
                }
            }, 1200);

            setMessageText('');
            setReplyingTo(null);
            return;
        }

        if (editingMsg) {
            socket.current.emit('edit_message', {
                messageId: editingMsg.id,
                senderId: user.id,
                receiverId: activeChat.id,
                newContent: messageText
            });
            setEditingMsg(null);
            setMessageText(''); // Clear text after edit
        } else {
            const sendFlow = async () => {
                let msgData = {
                    senderId: user.id,
                    receiverId: activeChat.id,
                    content: messageText,
                    messageType: 'text',
                    replyToId: replyingTo ? replyingTo.id : null,
                    senderName: user.username
                };
                // Instantly send text to backend, no frontend encryption
                socket.current.emit('send_message', msgData);
            };
            sendFlow();
        }

        setMessageText('');
        setReplyingTo(null);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socket.current.emit('stop_typing', { senderId: user.id, receiverId: activeChat.id });

        if (!sidebarUsers.find(u => u.id === activeChat.id)) {
            fetchSidebar();
        }
    };

    const handleSendPowerMessage = (power) => {
        if (!activeChat) return;

        const msgData = {
            senderId: user.id,
            receiverId: activeChat.id,
            content: JSON.stringify({ type: 'sorry', power }),
            messageType: 'template',
            senderName: user.username
        };

        socket.current.emit('send_message', msgData);

        // Trigger one-time animation
        setActiveSorryBlast({ power, timestamp: Date.now() });
        setTimeout(() => setActiveSorryBlast(null), 3000);

        setIsPowerModalOpen(false);
        setPowerLevel(0);

        if (!sidebarUsers.find(u => u.id === activeChat.id)) {
            fetchSidebar();
        }
    };

    const handleStartReply = (msg) => {
        setReplyingTo(msg);
        setReactionPickerMsgId(null);
        inputRef.current?.focus();
    };

    const scrollToMessage = (msgId) => {
        // Find the message in the messages array
        const msg = messages.find(m => m.id === msgId);
        // Only scroll if the message exists and is not deleted
        if (!msg || msg.is_deleted) return;
        const el = document.getElementById(`msg-${msgId}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
        setHighlightedMsgId(msgId);
        setTimeout(() => setHighlightedMsgId(null), 1000);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        let type = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        setAttachPreview({ file, url, type, name: file.name });
        e.target.value = '';
    };

    const handleSendFile = async () => {
        if (!attachPreview || !activeChat) return;
        // Instantly send file to backend, no frontend encryption
        try {
            const formData = new FormData();
            formData.append('file', attachPreview.file);
            const { data } = await api.uploadFile(formData);
            socket.current.emit('send_message', {
                senderId: user.id,
                receiverId: activeChat.id,
                content: data.originalName,
                messageType: attachPreview.type || data.messageType || 'file',
                fileUrl: data.fileUrl,
                replyToId: replyingTo ? replyingTo.id : null,
                senderName: user.username
            });
            setAttachPreview(null);
            setReplyingTo(null);
            if (!sidebarUsers.find(u => u.id === activeChat.id)) fetchSidebar();
        } catch (err) {
            console.error('Frontend handleSendFile error:', err);
            if (err.response) {
                alert(`Upload failed: ${err.response.data.detail || err.response.data.error || 'Server error'}`);
            } else {
                alert('Upload failed: Could not connect to server.');
            }
        }
    };

    const renderFileMessage = (msg) => {
        return <DecryptedFileMessage msg={msg} user={user} activeChat={activeChat} setIsDrawingOpen={setIsDrawingOpen} setDrawingInitialImage={setDrawingInitialImage} />;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Check for supported MIME types
            const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
            const supportedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

            if (!supportedType) {
                console.error('No supported audio MIME types found for MediaRecorder.');
                alert('Audio recording is not supported on this browser/device.');
                return;
            }

            const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: supportedType });
                const url = URL.createObjectURL(audioBlob);
                const extension = supportedType.split('/')[1].split(';')[0];
                const file = new File([audioBlob], `voice_message_${Date.now()}.${extension}`, { type: supportedType });
                setAttachPreview({ file, url, type: 'audio', name: 'Voice Message' });
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingTimerRef.current = setInterval(() => { setRecordingTime(prev => prev + 1); }, 1000);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Microphone access is required to record audio messages.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingTimerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = () => {
                const stream = mediaRecorderRef.current.stream;
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingTimerRef.current);
            setRecordingTime(0);
        }
    };

    const formatRecordingTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')} `;
    };

    const handleTyping = () => {
        if (!activeChat) return;
        socket.current.emit('typing', { senderId: user.id, receiverId: activeChat.id });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.current.emit('stop_typing', { senderId: user.id, receiverId: activeChat.id });
        }, 2000);
    };

    const handleEmojiClick = (emojiData) => {
        setMessageText(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const handleReact = (msgId, emoji) => {
        if (!activeChat) return;
        socket.current.emit('react_message', { messageId: msgId, emoji, senderId: user.id, receiverId: activeChat.id });
        setReactionPickerMsgId(null);
    };

    const handleDeleteMessage = (msgId) => {
        if (!activeChat || !window.confirm('Delete this message for everyone?')) return;
        socket.current.emit('delete_message', { messageId: msgId, senderId: user.id, receiverId: activeChat.id });
    };
    const handlePinChat = async (e, pinnedUserId) => {
        e.stopPropagation();
        try {
            const { data } = await api.pinChat({ pinnedUserId });
            setSidebarUsers(prev => prev.map(u => u.id === pinnedUserId ? { ...u, is_pinned: data.pinned } : u).sort((a, b) => b.is_pinned - a.is_pinned || new Date(b.lastMsgTime) - new Date(a.lastMsgTime)));
        } catch (err) {
            console.error('Pin chat error', err);
        }
    };

    const handleToggleMute = async (mutedUserId) => {
        try {
            const { data } = await api.muteChat({ mutedUserId });
            setSidebarUsers(prev => prev.map(u => u.id === mutedUserId ? { ...u, is_muted: data.muted } : u));
            if (activeChat && activeChat.id === mutedUserId) {
                setActiveChat(prev => ({ ...prev, is_muted: data.muted }));
            }
        } catch (err) {
            console.error('Mute chat error', err);
        }
    };

    const handlePinMessage = async (messageId) => {
        try {
            const { data } = await api.pinMessage({ messageId });
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: data.is_pinned } : m));
            setHoveredMsgId(null);
        } catch (err) {
            console.error('Pin message error', err);
        }
    };

    const handleSetAlias = async (e) => {
        if (e) e.preventDefault();
        if (!activeChat) return;
        try {
            const { data } = await api.setAlias({ contactId: activeChat.id, alias: newAlias });
            setActiveChat(prev => ({ ...prev, alias: data.alias }));
            setSidebarUsers(prev => prev.map(u => u.id === activeChat.id ? { ...u, alias: data.alias } : u));
            setIsEditingAlias(false);
        } catch (err) {
            console.error('Set alias error', err);
        }
    };

    const handleViewProfile = async (targetUser) => {
        try {
            const { data } = await api.getUserProfile(targetUser.id);
            setViewingProfile(data);
        } catch (err) {
            console.error('View profile error', err);
        }
    };

    const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '👎'];

    const getStatusText = (userId) => {
        if (typingUsers[userId]) return <span className="text-blue-500 italic">typing...</span>;
        if (String(userId) === String(ashPersona.id)) return <span className="text-green-500 font-bold">System Online</span>;
        const status = onlineUsers[userId];
        if (!status) return 'Offline';
        if (status.isOnline) return 'Active now';
        if (!status.lastSeen) return 'Offline';
        const lastSeenDate = new Date(status.lastSeen);
        const now = new Date();
        const diffMs = now - lastSeenDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffMins <= 1) return 'Last seen just now';
        if (diffMins < 60) return `Last seen ${diffMins}m ago`;
        if (diffHours < 24) return `Last seen ${diffHours}h ago`;
        if (diffDays === 1) return 'Last seen yesterday';
        return `Last seen ${lastSeenDate.toLocaleDateString()} `;
    };

    const renderSorryBlast = () => {
        if (!activeSorryBlast) return null;
        const { power } = activeSorryBlast;
        const particleCount = Math.min(20 + Math.floor(power / 10), 100);

        return (<div className="fixed inset-0 z-200 pointer-events-none overflow-hidden flex items-center justify-center">
            {/* Screen Shake Effect */}
            <div className="absolute inset-0 bg-rose-500/10 animate-pulse"></div>

            {/* Particle Explosion */}
            {[...Array(particleCount)].map((_, i) => {
                const angle = (i / particleCount) * 360;
                const velocity = 5 + Math.random() * 10;
                const size = 4 + Math.random() * 8;
                const delay = Math.random() * 0.5;

                return (<div
                    key={i}
                    className="absolute bg-rose-500 rounded-full animate-out fade-out zoom-out duration-1000 fill-mode-forwards"
                    style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        left: '50%',
                        top: '50%',
                        animationDelay: `${delay}s`,
                        transform: `rotate(${angle}deg) translate(${velocity * 20}px)`,
                        boxShadow: '0 0 10px rgba(244,63,94,0.8)'
                    }}
                ></div>);
            })}

            {/* Central Shockwave */}
            <div className="w-20 h-20 rounded-full border-4 border-white/50 animate-ping duration-700"></div>
            <div className="absolute text-white font-black italic text-6xl md:text-8xl tracking-tighter animate-in zoom-in fade-in duration-500 fill-mode-forwards">
                SORRY!
            </div>
        </div>);
    };

    const renderTelepathyMessage = (msg) => {
        try {
            const signal = JSON.parse(msg.content);
            const isMine = msg.sender_id === user.id;

            return (<div className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-default group relative overflow-hidden`}>
                <div className="text-4xl mb-2 animate-bounce flex items-center justify-center" style={{ animationDuration: '3s' }}>
                    {signal.icon}
                </div>
                <div className={`text-[10px] font-black uppercase tracking-[0.2em] text-center ${isMine ? 'text-white' : 'text-gray-500'} `}>
                    {signal.label}
                </div>
            </div>);
        } catch (e) {
            return msg.content;
        }
    };

    const handleSendTelepathy = (signal) => {
        if (!activeChat) return;

        const msgData = {
            senderId: user.id,
            receiverId: activeChat.id,
            content: JSON.stringify(signal),
            messageType: 'telepathy',
            senderName: user.username
        };

        socket.current.emit('send_message', msgData);
        setShowTelepathyPicker(false);

        if (!sidebarUsers.find(u => u.id === activeChat.id)) {
            fetchSidebar();
        }
    };

    const renderTemplateMessage = (msg) => {
        try {
            const data = JSON.parse(msg.content);
            if (data.type === 'sorry') {
                const power = data.power || 0;

                // Dynamic Theme based on power
                let theme = { text: 'text-white', badge: 'bg-white text-blue-600', shadow: 'rgba(244,63,94,0.5)', glow: 'rose' };
                if (power > 5000) theme = { text: 'text-yellow-400', badge: 'bg-yellow-400 text-slate-900', shadow: 'rgba(234,179,8,0.8)', glow: 'yellow' };
                else if (power > 1000) theme = { text: 'text-cyan-400', badge: 'bg-cyan-400 text-slate-900', shadow: 'rgba(34,211,238,0.7)', glow: 'cyan' };
                else if (power > 100) theme = { text: 'text-orange-400', badge: 'bg-orange-400 text-slate-900', shadow: 'rgba(251,146,60,0.6)', glow: 'orange' };

                const isMyMessage = msg.sender_id === user.id;
                const textColor = isMyMessage ? 'text-white' : theme.text;

                // log scale for extreme numbers so it doesn't break layout but feels bigger
                const scale = 1 + Math.min(Math.log10(power + 1) * 0.1, 0.4);

                return (<div className="flex flex-col items-center pt-4 pr-6 pb-2 pl-2 select-none max-w-full relative">
                    <div
                        className={`relative transition-all duration-500 transform hover:scale-105 active:scale-95 cursor-default group`}
                        style={{
                            transform: `scale(${scale})`,
                            filter: `drop-shadow(0 0 ${Math.min(power * 0.01, 20)}px ${theme.shadow})`
                        }}
                    >
                        <div className={`text-3xl md:text-5xl font-black italic tracking-tighter leading-none ${textColor} whitespace-nowrap drop-shadow-sm`}>
                            SORRY
                        </div>

                        {/* Level Badge-Now more prominent and colorful */}
                        <div className={`absolute -top-3 -right-6 ${theme.badge} text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xl border-2 border-white/20 z-10 transition-transform group-hover:scale-110 whitespace-nowrap`}>
                            LVL {power.toLocaleString()}
                        </div>

                        {/* Extra effects for high levels */}
                        {power > 100 && (<div className={`absolute inset-0 pointer-events-none opacity-50`}>
                            <div className={`absolute inset-0 animate-pulse bg-${theme.glow}-500/20 rounded-full`}></div>
                        </div>)}

                        {power > 20 && (<div className="absolute inset-0 pointer-events-none text-white/40">
                            <div className="absolute top-0 left-1/4 w-1 h-1 bg-current rounded-full animate-ping"></div>
                            <div className="absolute bottom-0 right-1/4 w-1.5 h-1.5 bg-current rounded-full animate-ping delay-100"></div>
                            {power > 1000 && <div className="absolute top-1/2 left-0 w-2 h-2 bg-current rounded-full animate-ping delay-200"></div>}
                        </div>)}
                    </div>
                </div>);
            }
        } catch (e) {
            return msg.content;
        }
    };

    return (
        <>
            {stealthNotif && (
                <StealthNotificationToast
                    message={stealthNotif.message}
                    settings={stealthNotif.settings}
                    onDismiss={() => setStealthNotif(null)}
                />
            )}
            <div className="flex h-screen w-full bg-[#f0f2f5] dark:bg-[#0f172a] overflow-hidden font-sans relative transition-colors duration-300">
                {/* Sidebar */}
                <div className={`w-full md:w-[350px] flex flex-col bg-white/80 dark:bg-slate-900/80 border-r border-gray-200 dark:border-slate-800 transition-all duration-300 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link to="/profile" aria-label="Go to your profile" className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm hover:scale-105 transition-transform">
                                <img src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} alt="Profile" className="w-full h-full object-cover" width="44" height="44" />
                            </Link>
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-white text-sm">{user?.username}</h3>
                                <p className="text-xs text-green-500 font-medium">Online</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setIsOfflineChatOpen(true)} className="p-2 rounded-xl text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="Offline Mesh Chat (Bluetooth/Wi-Fi)">
                                <Wifi size={20} />
                            </button>
                            <Link to="/calls" aria-label="Call History" className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Call History">
                                <Clock size={20} />
                            </Link>
                            <Link to="/settings" aria-label="Settings" className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                                <SettingsIcon size={20} />
                            </Link>
                        </div>
                    </div>
                    <div className="px-4 py-2 relative">
                        <div className="relative rounded-2xl flex items-center px-4 py-2.5 bg-gray-100/80 dark:bg-slate-800/80 border border-transparent transition-all duration-300 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                            <Search size={18} className="text-gray-400 mr-2" />
                            <input type="text" placeholder="Find someone new..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none w-full text-sm placeholder-gray-400 dark:text-white" />
                        </div>
                        {searchResults.length > 0 && (<div className="absolute left-4 right-4 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                            {searchResults.map((res) => (<div key={res.id} onClick={() => handleSelectChat(res)} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0">
                                <img src={res.avatar_url} className="w-8 h-8 rounded-full" alt="" width="32" height="32" />
                                <span className="text-sm font-bold text-slate-700">{res.username}</span>
                            </div>))}
                        </div>)}
                    </div>
                    <div className="flex-1 overflow-y-auto mt-2 px-2 pb-4">
                        <h4 className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Direct Messages</h4>
                        <div className="space-y-1">
                            {sidebarUsers.map(chat => (<div key={chat.id} onMouseEnter={() => setHoveredMsgId(`sidebar_${chat.id}`)} onMouseLeave={() => setHoveredMsgId(null)} onClick={() => handleSelectChat(chat)} className={`group flex items-center gap-4 p-4 cursor-pointer rounded-2xl transition-all duration-200 ${activeChat?.id === chat.id ? 'bg-white shadow-[0_10px_25px_rgba(0,0,0,0.05)]' : Number(chat.unreadcount) > 0 ? 'bg-blue-50/80' : 'hover:bg-white/50'}`}>
                                <div className="relative group/profile" style={{ cursor: 'pointer' }}>
                                    <div
                                        className="absolute inset-0 rounded-full z-10 group-hover/profile:ring-2 group-hover/profile:ring-blue-200"
                                        onClick={e => { e.stopPropagation(); handleViewProfile(chat); }}
                                    ></div>
                                    {chat.id === ashPersona.id ? (
                                        <div className="w-14 h-14 rounded-full overflow-hidden bg-indigo-950 flex items-center justify-center border-2 border-white shadow-sm shrink-0">
                                            <img src={chat.avatar_url} alt="ASH" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <SafeAvatar src={chat.avatar_url} alt={chat.username} size="w-14 h-14" />
                                    )}
                                    {onlineUsers[chat.id]?.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full z-10"></div>}
                                    {chat.is_pinned && (<div className="absolute -top-1 -right-1 p-1 bg-white dark:bg-slate-900 rounded-full shadow-md text-blue-500 border border-blue-100">
                                        <Pin size={8} fill="currentColor" />
                                    </div>)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <h4 className="text-base font-bold truncate flex items-center gap-1">
                                            {chat.alias || chat.username}
                                        </h4>
                                        <span className="text-[10px] text-gray-400">{chat.lastmsgtime ? new Date(chat.lastmsgtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                    </div>
                                    {/* Hide [System] label in sidebar */}
                                    {/*
                                    {chat.id === ashPersona.id && (
                                        <span className="text-xs text-gray-400 font-semibold">[System]</span>
                                    )}
                                    */}
                                    <p className="text-xs truncate text-gray-500">
                                        {typingUsers[chat.id] ? (
                                            <span className="text-blue-500 italic">typing...</span>
                                        ) : (
                                            decryptedMessages[chat.lastMsgData?.id] || (
                                                chat.lastmsgtype === 'text' || !chat.lastmsgtype
                                                    ? (chat.lastmsg || 'No messages yet')
                                                    : `[${chat.lastmsgtype.charAt(0).toUpperCase() + chat.lastmsgtype.slice(1)}]`
                                            )
                                        )}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {Number(chat.unreadcount) > 0 && <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">{chat.unreadcount}</div>}
                                    {(hoveredMsgId === `sidebar_${chat.id}` || chat.is_pinned) && (<button
                                        onClick={(e) => handlePinChat(e, chat.id)}
                                        className={`p-1.5 rounded-full transition-all duration-200 ${chat.is_pinned ? 'text-blue-500' : 'text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100'}`}
                                        title={chat.is_pinned ? 'Unpin chat' : 'Pin chat'}
                                    >
                                        {chat.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                                    </button>)}
                                </div>
                            </div>))}
                        </div>
                    </div>

                </div>

                {/* Main Chat Area */}
                <div className={`flex-1 flex flex-col relative h-full w-full ${activeChat ? 'flex' : 'hidden md:flex'}`}>
                    <div className={`absolute inset-0 z-0 ${chatWallpaper === 'gradient' ? 'wallpaper-gradient' : chatWallpaper === 'stars' ? 'wallpaper-stars' : 'bg-[#f0f2f5] dark:bg-[#0f172a]'}`} style={chatWallpaper.startsWith('data:') ? { backgroundImage: `url(${chatWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                        {chatWallpaper !== 'default' && <div className="absolute inset-0 bg-white/30 dark:bg-slate-900/40"></div>}
                    </div>

                    {
                        activeChat ? (<div className="flex flex-col h-full relative z-10">
                            <div className="p-3 md:p-4 flex items-center justify-between bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-700/30 z-10 sticky top-0">
                                <div className="flex items-center gap-2 md:gap-4 flex-1">
                                    <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 rounded-xl text-gray-500"><ArrowLeft size={20} /></button>
                                    {String(activeChat.id) === String(ashPersona.id) ? (
                                        <div
                                            className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden bg-indigo-950 flex items-center justify-center border-2 border-white shadow-sm shrink-0 cursor-pointer hover:scale-105 transition-transform"
                                            onPointerDown={() => handleViewProfile(activeChat)}
                                        >
                                            <img src={activeChat.avatar_url} alt="ASH" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <SafeAvatar
                                            src={activeChat.avatar_url}
                                            alt="Active"
                                            size="w-10 h-10 md:w-11 md:h-11"
                                            className="cursor-pointer hover:scale-105 transition-transform"
                                        />
                                    )}
                                    {!showChatSearch ? (
                                        <div
                                            className="flex flex-col cursor-pointer select-none"
                                            onPointerDown={() => handleViewProfile(activeChat)}
                                            tabIndex={0}
                                        >
                                            <div className="flex items-center gap-2">
                                                <h3
                                                    className="font-bold text-gray-800 dark:text-white text-base flex items-center gap-1.5"
                                                >
                                                    {activeChat.alias || activeChat.username}
                                                    {encryptionReady && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setIsKeyVerificationOpen(true); }}
                                                            className="p-1 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
                                                        >
                                                            <Lock size={14} className="text-emerald-500" />
                                                        </button>
                                                    )}
                                                </h3>
                                            </div>
                                            <p className="text-[12px] text-gray-500 ml-0.5 mt-0.5">{getStatusText(activeChat.id)}</p>
                                        </div>
                                    ) : (<div className="flex-1 max-w-md relative">
                                        <input autoFocus type="text" placeholder="Search messages..." value={chatSearchTerm} onChange={(e) => setChatSearchTerm(e.target.value)} className="w-full pl-4 pr-10 py-1.5 bg-gray-100 rounded-xl text-sm outline-none" />
                                        <button onClick={() => { setShowChatSearch(false); setChatSearchTerm(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={16} /></button>
                                    </div>)}
                                </div>
                                <div className="flex items-center gap-1 md:gap-2">
                                    <button
                                        onPointerDown={() => handleViewProfile(activeChat)}
                                        className={`hidden md:flex p-2 rounded-xl transition-all ${viewingProfile ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                                        title="Shared Media"
                                    ><ImageIcon size={18} /></button>
                                    <button onClick={() => setShowChatSearch(p => !p)} className={`p-2 rounded-xl transition-all ${showChatSearch ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}><Search size={18} /></button>
                                    <button
                                        onClick={() => handleToggleMute(activeChat.id)}
                                        className={`p-2 rounded-xl transition-all ${activeChat.is_muted ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/30' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                                        title={activeChat.is_muted ? "Unmute notifications" : "Mute notifications"}
                                    >
                                        {activeChat.is_muted ? <BellOff size={18} /> : <Bell size={18} />}
                                    </button>
                                    <button onClick={() => handleStartCall('voice')} className="p-2 rounded-xl text-gray-500 hover:text-blue-600 transition-colors"><Phone size={18} /></button>
                                    <button onClick={() => handleStartCall('video')} className="p-2 rounded-xl text-gray-500 hover:text-blue-600 transition-colors"><Video size={18} /></button>
                                </div>
                            </div>

                            {/* Pinned Messages Banner */}
                            {messages.some(m => m.is_pinned) && (<div className="px-4 py-2 bg-amber-50/80 dark:bg-amber-900/20  border-b border-amber-100 dark:border-amber-800 flex items-center justify-between z-10 sticky top-[60px] md:top-[73px]">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="p-1.5 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-400">
                                        <Pin size={14} fill="currentColor" />
                                    </div>
                                    <div className="flex-1 truncate">
                                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pinned Message</p>
                                        <p className="text-xs text-gray-700 dark:text-slate-300 truncate font-medium">
                                            {(decryptedMessages[messages.filter(m => m.is_pinned).reverse()[0].id] || messages.filter(m => m.is_pinned).reverse()[0].content) || "Attachment"}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => scrollToMessage(messages.filter(m => m.is_pinned).reverse()[0].id)} className="text-[10px] font-bold text-amber-600 hover:scale-105 transition-transform px-3 py-1 bg-white dark:bg-slate-800 rounded-lg border border-amber-200">View</button>
                            </div>)}

                            <div
                                ref={messageContainerRef}
                                onScroll={handleScroll}
                                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
                            >
                                {isLoadingMore && (
                                    <div className="flex justify-center p-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                    </div>
                                )}
                                {messages.filter(m => !chatSearchTerm || (m.content && m.content.toLowerCase().includes(chatSearchTerm.toLowerCase()))).map((msg, i) => (
                                    <div key={msg.id || i} id={`msg-${msg.id}`} className={`flex ${msg.message_type === 'system' ? 'justify-center' : String(msg.sender_id) === String(user.id) ? 'justify-end' : 'justify-start'}`}>
                                        {msg.message_type === 'system' ? (
                                            <div className="px-4 py-1.5 bg-gray-200/50 dark:bg-slate-800/50 rounded-full text-[11px] font-bold text-gray-500">{msg.content}</div>
                                        ) : (
                                            <SwipeableMessage onSwipeToReply={() => handleStartReply(msg)} isMine={msg.sender_id === user.id}>
                                                <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${msg.sender_id === user.id ? 'ml-auto items-end' : 'mr-auto items-start'}`} onMouseEnter={() => setHoveredMsgId(msg.id)} onMouseLeave={() => setHoveredMsgId(null)}>
                                                    <div className={`px-4 py-3 rounded-2xl relative shadow-sm ${msg.is_deleted ? 'bg-gray-100 italic text-gray-400' : msg.is_pinned ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : String(msg.sender_id) === String(ashPersona.id) ? 'bg-linear-to-br from-indigo-600 to-violet-700 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]' : String(msg.sender_id) === String(user.id) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200'} ${highlightedMsgId === msg.id ? 'ring-4 ring-blue-400/70 z-10 transition-all duration-300' : ''}`}>
                                                        {msg.is_deleted ? 'This message was deleted' : (
                                                            <>
                                                                {msg.reply_to_msg && (
                                                                    <div onClick={() => scrollToMessage(msg.reply_to_msg.id)} className={`mb-2 p-2 rounded-xl border-l-4 text-xs cursor-pointer ${msg.sender_id === user.id ? 'bg-white/20 border-white' : 'bg-gray-50 border-blue-500 text-gray-500'}`}>
                                                                        <p className="font-bold">{msg.reply_to_msg.sender_id === user.id ? 'You' : activeChat.alias || activeChat.username}</p>
                                                                        <p className="truncate">
                                                                            {msg.reply_to_msg.message_type === 'text'
                                                                                ? (decryptedMessages[msg.reply_to_msg.id] || msg.reply_to_msg.content)
                                                                                : msg.reply_to_msg.message_type === 'image' ? '📷 Photo'
                                                                                    : msg.reply_to_msg.message_type === 'video' ? '🎥 Video'
                                                                                        : msg.reply_to_msg.message_type === 'audio' ? '🎵 Audio'
                                                                                            : '📎 File'}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {msg.is_pinned && <div className="flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 mb-1"><Pin size={10} fill="currentColor" /> PINNED</div>}
                                                                {msg.message_type === 'call' && msg.content ? (
                                                                    <div className="flex items-center gap-3 py-1">
                                                                        <div className={`p-2.5 rounded-xl ${msg.content.includes('Missed') ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                                            {msg.content.includes('video') ? <Video size={18} /> : <Phone size={18} />}
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-black text-sm tracking-tight">{msg.content.split(' • ')[0]}</p>
                                                                            {msg.content.includes(' • ') && <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-0.5">{msg.content.split(' • ')[1]}</p>}
                                                                        </div>
                                                                    </div>
                                                                ) : msg.message_type === 'text' ? (
                                                                    <>
                                                                        <div className="flex flex-col">
                                                                            <span>{decryptedMessages[msg.id] || msg.content}</span>
                                                                            {msg.encrypted_key && (
                                                                                <span className="text-[8px] opacity-70 flex items-center gap-1 mt-1">
                                                                                    <Shield size={10} className={decryptedMessages[msg.id]?.startsWith('⚠️') ? 'text-rose-500' : 'text-emerald-500'} />
                                                                                    {decryptedMessages[msg.id]?.startsWith('⚠️') ? 'Decryption Failed' : 'End-to-End Encrypted'}
                                                                                </span>
                                                                            )}
                                                                            {msg.is_edited && (
                                                                                <button
                                                                                    onClick={() => setHistoryMsg(msg)}
                                                                                    className={`text-[9px] mt-0.5 opacity-60 hover:opacity-100 transition-opacity flex items-center gap-0.5 ${msg.sender_id === user.id ? 'text-white' : 'text-gray-500'}`}
                                                                                >
                                                                                    <History size={10} /> (edited)
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        {(() => {
                                                                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                                                                            const urls = msg.content.match(urlRegex);
                                                                            if (urls && urls.length > 0) {
                                                                                const firstUrl = urls[0];
                                                                                const isYouTube = firstUrl.includes('youtube.com') || firstUrl.includes('youtu.be');
                                                                                if (isYouTube) {
                                                                                    return <YouTubePlayer url={firstUrl} />;
                                                                                }
                                                                                return <LinkPreviewCard url={firstUrl} />;
                                                                            }
                                                                            return null;
                                                                        })()}
                                                                    </>
                                                                ) : msg.message_type === 'template' ? renderTemplateMessage(msg) : msg.message_type === 'telepathy' ? renderTelepathyMessage(msg) : renderFileMessage(msg)}

                                                                {hoveredMsgId === msg.id && !msg.is_deleted && (
                                                                    <div className={`absolute top-0 -translate-y-full flex gap-1 p-1 bg-white rounded-lg shadow-xl z-20 ${msg.sender_id === user.id ? 'right-0' : 'left-0'}`}>
                                                                        <button onClick={() => setReactionPickerMsgId(msg.id)} className="p-1 hover:bg-gray-100 rounded" title="React">😊</button>
                                                                        <button onClick={() => handleStartReply(msg)} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="Reply"><CornerUpLeft size={14} /></button>
                                                                        <button onClick={() => handlePinMessage(msg.id)} className={`p-1 hover:bg-gray-100 rounded ${msg.is_pinned ? 'text-amber-500' : 'text-gray-500'}`} title={msg.is_pinned ? 'Unpin' : 'Pin'}>
                                                                            {msg.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                                                                        </button>
                                                                        {msg.sender_id === user.id && msg.message_type === 'text' && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditingMsg(msg);
                                                                                    setMessageText(decryptedMessages[msg.id] || msg.content);
                                                                                    inputRef.current?.focus();
                                                                                }}
                                                                                className="p-1 hover:bg-gray-100 rounded text-blue-500"
                                                                                title="Edit"
                                                                            >
                                                                                <Edit2 size={14} />
                                                                            </button>
                                                                        )}
                                                                        <button onClick={() => handleCopyMessage(msg)} className="p-1 hover:bg-gray-100 rounded text-blue-500" title="Copy">
                                                                            <Copy size={14} />
                                                                        </button>
                                                                        {msg.sender_id === user.id && <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 hover:bg-gray-100 rounded text-red-500" title="Delete"><Trash2 size={14} /></button>}
                                                                    </div>
                                                                )}
                                                                {reactionPickerMsgId === msg.id && (
                                                                    <div className="absolute top-0 -translate-y-full flex gap-1 p-2 bg-white rounded-2xl shadow-2xl z-30 border border-gray-100">
                                                                        {QUICK_REACTIONS.map(e => <button key={e} onClick={() => handleReact(msg.id, e)} className="text-xl hover:scale-125 transition-transform">{e}</button>)}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                        <div className="flex gap-1 mt-1">
                                                            {Object.entries(Object.values(msg.reactions).reduce((acc, e) => { acc[e] = (acc[e] || 0) + 1; return acc; }, {})).map(([e, c]) => (
                                                                <span key={e} className="text-[10px] bg-white rounded-full px-1.5 py-0.5 border shadow-sm">{e} {c > 1 ? c : ''}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        {msg.sender_id === user.id && (msg.is_read ? <CheckCheck size={12} className="text-blue-500" /> : <Check size={12} />)}
                                                    </div>
                                                </div>
                                            </SwipeableMessage>
                                        )}
                                    </div>
                                ))}
                                <div ref={scrollRef} />
                            </div>

                            {attachPreview && (<div className="p-3 bg-white/50  flex items-center gap-3 border-t">
                                {attachPreview.type === 'image' && <img src={attachPreview.url} className="w-12 h-12 rounded object-cover" alt="" />}
                                <div className="flex-1 truncate"><p className="text-sm font-bold truncate">{attachPreview.name}</p></div>
                                <button onClick={handleSendFile} className="p-2 bg-blue-600 text-white rounded-lg"><Send size={18} /></button>
                                <button onClick={() => setAttachPreview(null)} className="text-gray-400"><X size={18} /></button>
                            </div>)}

                            <div className="p-3 md:p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 dark:border-slate-700/30">
                                <div className="w-full">
                                    {replyingTo && (<div className="flex justify-between items-center bg-blue-50 p-2 rounded-xl mb-2 text-xs">
                                        <div className="truncate"><span className="font-bold text-blue-600">Reply to: </span>
                                            {replyingTo.message_type === 'text'
                                                ? (decryptedMessages[replyingTo.id] || replyingTo.content)
                                                : replyingTo.message_type === 'image' ? '📷 Photo'
                                                    : replyingTo.message_type === 'video' ? '🎥 Video'
                                                        : replyingTo.message_type === 'audio' ? '🎵 Audio'
                                                            : '📎 File'}
                                        </div>
                                        <button onClick={() => setReplyingTo(null)}><X size={14} /></button>
                                    </div>)}
                                    {editingMsg && (<div className="flex justify-between items-center bg-blue-50 p-2 rounded-xl mb-2 text-xs">
                                        <div className="truncate"><span className="font-bold text-blue-600">Editing: </span>{decryptedMessages[editingMsg.id] || editingMsg.content}</div>
                                        <button onClick={() => { setEditingMsg(null); setMessageText(''); }}><X size={14} /></button>
                                    </div>)}
                                    <form onSubmit={handleSendMessage} className="flex gap-2 items-center bg-white p-2 rounded-2xl shadow-sm border">
                                        {isRecording ? (<div className="flex-1 flex items-center justify-between px-2 text-red-500">
                                            <span>Recording... {formatRecordingTime(recordingTime)}</span>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={cancelRecording}><Trash2 size={20} /></button>
                                                <button type="button" onClick={stopRecording} className="p-2 bg-red-500 text-white rounded-full"><Square size={16} /></button>
                                            </div>
                                        </div>) : (<>
                                            {/* Allow GIFs from system keyboard and gallery */}
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*,image/gif"
                                                className="hidden"
                                                style={{}}
                                                onChange={handleFileSelect}
                                            />

                                            {/* Mobile Responsive Input Bar */}
                                            <div className="flex items-center gap-1">
                                                {/* Plus button - Desktop: File upload, Mobile: Popover */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.innerWidth < 768) {
                                                            setIsAttachmentOpen(!isAttachmentOpen);
                                                        } else {
                                                            fileInputRef.current.click();
                                                        }
                                                    }}
                                                    className={`p-2 transition-colors ${isAttachmentOpen ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 rounded-full' : 'text-gray-400 hover:text-blue-600'}`}
                                                >
                                                    <Plus size={20} />
                                                </button>

                                                <button type="button" onClick={() => setIsCameraOpen(true)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><Camera size={20} /></button>

                                                {/* Desktop Only Icons */}
                                                <div className="hidden md:flex items-center">
                                                    <button type="button" onClick={() => { setDrawingInitialImage(null); setIsDrawingOpen(true); }} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Draw Message"><PenTool size={20} /></button>
                                                    <button type="button" onClick={() => setShowTelepathyPicker(!showTelepathyPicker)} className={`p-2 transition-colors ${showTelepathyPicker ? 'text-blue-500' : 'text-gray-400 hover:text-blue-600'}`} title="Telepathy Mode"><Brain size={20} /></button>
                                                    <button type="button" onClick={() => setIsPowerModalOpen(true)} className="p-2 text-gray-400 hover:text-rose-500 transition-colors" title="Send Sorry Power"><Zap size={20} /></button>
                                                </div>
                                            </div>

                                            <input ref={inputRef} value={messageText} onChange={e => { setMessageText(e.target.value); handleTyping(); }} placeholder="Type a message..." className="flex-1 bg-transparent outline-none text-sm" />

                                            <div className="flex items-center">
                                                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-gray-400 hover:text-yellow-500 transition-colors"><Smile size={20} /></button>
                                                {messageText.trim() || attachPreview ? (
                                                    <button type="submit" className="p-2 bg-blue-600 text-white rounded-xl"><Send size={18} /></button>
                                                ) : (
                                                    <button type="button" onClick={startRecording} className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><Mic size={20} /></button>
                                                )}
                                            </div>
                                        </>)}
                                    </form>
                                    {showEmojiPicker && <div className="absolute bottom-full mb-2 right-0 z-50"><Suspense fallback={<div className="w-[300px] h-[350px] flex items-center justify-center bg-white shadow-lg rounded-lg"><div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div></div>}><EmojiPicker onEmojiClick={handleEmojiClick} height={350} width={300} /></Suspense></div>}

                                    {/* Mobile Attachment Popover */}
                                    {isAttachmentOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-45 md:hidden"
                                                onClick={() => setIsAttachmentOpen(false)}
                                            ></div>
                                            <div className="absolute bottom-full mb-4 left-0 z-50 md:hidden w-72 animate-in slide-in-from-bottom-4 duration-300">
                                                <div className="bg-white/95 dark:bg-slate-900/95  border border-white/20 dark:border-slate-700/50 p-5 rounded-[32px] shadow-2xl">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {[
                                                            {
                                                                icon: ImageIcon,
                                                                label: 'Media',
                                                                color: 'bg-blue-500',
                                                                onClick: () => { setIsAttachmentOpen(false); fileInputRef.current.click(); }
                                                            },
                                                            {
                                                                icon: PenTool,
                                                                label: 'Drawing',
                                                                color: 'bg-purple-500',
                                                                onClick: () => { setIsAttachmentOpen(false); setDrawingInitialImage(null); setIsDrawingOpen(true); }
                                                            },
                                                            {
                                                                icon: Brain,
                                                                label: 'Telepathy',
                                                                color: 'bg-cyan-500',
                                                                onClick: () => { setIsAttachmentOpen(false); setShowTelepathyPicker(true); }
                                                            },
                                                            {
                                                                icon: Zap,
                                                                label: 'Sorry Power',
                                                                color: 'bg-rose-500',
                                                                onClick: () => { setIsAttachmentOpen(false); setIsPowerModalOpen(true); }
                                                            }
                                                        ].map((item, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={item.onClick}
                                                                className="flex flex-col items-center gap-2 group p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
                                                            >
                                                                <div className={`w-12 h-12 ${item.color} rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 active:scale-95`}>
                                                                    <item.icon size={22} />
                                                                </div>
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                                                                    {item.label}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {showTelepathyPicker && (<div className="absolute bottom-full mb-4 right-0 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
                                        <div className="bg-white/95 dark:bg-slate-900/95  border border-white/20 dark:border-slate-700/50 p-4 rounded-[32px] shadow-2xl w-72">
                                            <div className="flex items-center justify-between mb-4 px-2">
                                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Telepathy Mode</h4>
                                                <button onClick={() => setShowTelepathyPicker(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={14} /></button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                {telepathySignals.map((sig, idx) => (<button
                                                    key={idx}
                                                    onClick={() => handleSendTelepathy(sig)}
                                                    className={`flex flex-col items-center p-4 rounded-[24px] ${sig.bg} border border-transparent hover:border-white/20 transition-all hover:scale-105 active:scale-95 group relative overflow-hidden shadow-sm hover:shadow-md`}
                                                >
                                                    <span className="text-3xl mb-2 group-hover:animate-bounce transition-transform">{sig.icon}</span>
                                                    <span className={`text-[9px] font-black text-center uppercase tracking-tighter ${sig.color}`}>{sig.label}</span>
                                                </button>))}
                                            </div>
                                        </div>
                                    </div>)}
                                </div>
                            </div>
                        </div>) : (<div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-500"><Send size={32} /></div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Your Space to Connect</h2>
                            <p className="text-sm text-gray-500 dark:text-slate-400">Search for a friend or select a chat to start messaging.</p>
                        </div>)
                    }
                </div>

                {/* Camera Modal */}
                {
                    isCameraOpen && (<div className="fixed inset-0 z-100 bg-black/95 flex flex-col items-center justify-center p-4">
                        <div className="relative w-full max-w-md aspect-3/4 bg-black rounded-[40px] overflow-hidden shadow-2xl">
                            {cameraPreview ? (
                                cameraPreview.type === 'video' ? (
                                    <video src={cameraPreview.url} autoPlay loop playsInline className="w-full h-full object-cover" />
                                ) : (
                                    <img src={cameraPreview.url} alt="Preview" className="w-full h-full object-cover" />
                                )
                            ) : (
                                <>
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ filter: activeCameraFilter.type === 'css' ? activeCameraFilter.css : 'none' }} />
                                    <canvas ref={cameraOverlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                                </>
                            )}

                            <button onClick={() => {
                                if (cameraPreview) setCameraPreview(null);
                                else setIsCameraOpen(false);
                            }} className="absolute top-4 right-4 p-2.5 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors z-10"><X size={20} /></button>

                            {/* Recording Indicator */}
                            {isCameraRecording && !cameraPreview && (
                                <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full z-10">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="text-white text-xs font-bold tracking-wider">REC</span>
                                </div>
                            )}
                        </div>

                        {!cameraPreview ? (
                            <>
                                {/* Filter Carousel */}
                                <div className="w-full max-w-md mt-6 overflow-x-auto custom-scrollbar pb-2 px-2 flex gap-4 snap-x">
                                    {CAMERA_FILTERS.map((f, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setActiveCameraFilter(f)}
                                            className={`flex flex-col items-center gap-2 shrink-0 snap-center transition-all ${activeCameraFilter.name === f.name ? 'scale-110' : 'scale-90 opacity-70 hover:opacity-100'}`}
                                        >
                                            <div className={`w-14 h-14 rounded-full border-4 overflow-hidden relative flex items-center justify-center ${activeCameraFilter.name === f.name ? 'border-indigo-500' : 'border-white/20'}`}>
                                                <div className="absolute inset-0 w-full h-full bg-linear-to-br from-indigo-400 to-purple-500" style={{ filter: f.type === 'css' ? f.css : 'none' }}></div>
                                                {f.type === 'ar' && <span className="relative z-10 text-2xl">{f.element === 'blur' ? '✨' : f.element}</span>}
                                            </div>
                                            <span className="text-[10px] text-white font-bold tracking-wider uppercase">{f.name}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Capture Controls */}
                                <div className="mt-8 flex gap-8 items-center cursor-default shrink-0">
                                    <button onClick={() => setIsCameraOpen(false)} className="text-white opacity-60 hover:opacity-100 font-medium text-sm tracking-wider w-16 text-right">CANCEL</button>

                                    <div className="relative w-20 h-20 flex items-center justify-center">
                                        <button
                                            onPointerDown={(e) => {
                                                e.currentTarget.recordTimeout = setTimeout(() => {
                                                    startVideoRecording();
                                                }, 300);
                                            }}
                                            onPointerUp={(e) => {
                                                clearTimeout(e.currentTarget.recordTimeout);
                                                if (isCameraRecordingRef.current) {
                                                    stopVideoRecording();
                                                } else {
                                                    capturePhoto();
                                                }
                                            }}
                                            onPointerLeave={(e) => {
                                                clearTimeout(e.currentTarget.recordTimeout);
                                                if (isCameraRecordingRef.current) stopVideoRecording();
                                            }}
                                            onContextMenu={(e) => e.preventDefault()}
                                            className={`absolute inset-0 rounded-full border-4 transition-all flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.3)] touch-none cursor-pointer ${isCameraRecording ? 'border-red-500 scale-125 bg-white/20' : 'border-white hover:scale-105 active:scale-95 bg-white/20'}`}
                                        >
                                            <div className={`rounded-full transition-all pointer-events-none ${isCameraRecording ? 'w-8 h-8 bg-red-500 rounded-lg' : 'w-16 h-16 bg-white border-2 border-slate-900 rounded-full'}`}></div>
                                        </button>
                                    </div>

                                    <div className="w-16"></div>
                                </div>
                                <p className="mt-6 text-white/50 text-xs font-medium tracking-wide">Tap for photo, hold for video</p>
                            </>
                        ) : (
                            <div className="mt-8 flex gap-8 items-center shrink-0 w-full max-w-md justify-between px-6">
                                <button onClick={() => setCameraPreview(null)} className="flex items-center gap-2 px-4 py-3 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all font-bold">
                                    <Trash2 size={20} /> Discard
                                </button>

                                <button onClick={() => {
                                    setAttachPreview(cameraPreview);
                                    setCameraPreview(null);
                                    setIsCameraOpen(false);
                                }} className="flex items-center gap-2 px-6 py-3 bg-yellow-400 text-black rounded-2xl hover:bg-yellow-500 transition-all font-black shadow-lg shadow-yellow-400/20 active:scale-95">
                                    Send To Chat <Send size={20} />
                                </button>
                            </div>
                        )}
                    </div>)}

                {/* Profile View Modal */}
                <Suspense fallback={null}>
                    <ProfileOrganizer
                        isOpen={!!viewingProfile}
                        onClose={() => setViewingProfile(null)}
                        activeChat={viewingProfile}
                        messages={messages}
                        isMuted={activeChat?.is_muted}
                        onToggleMute={() => handleToggleMute(activeChat?.id)}
                        onStartCall={handleStartCall}
                        onStartSearch={() => setShowChatSearch(true)}
                        isSharingScreen={isSharingScreen}
                        onToggleScreenShare={handleToggleScreenShare}
                    />
                </Suspense>

                {/* Power Up Modal */}
                {
                    isPowerModalOpen && (<div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80  transition-all animate-in fade-in duration-300">
                        <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[48px] shadow-2xl overflow-hidden p-8 text-center relative">
                            <button
                                onClick={() => { setIsPowerModalOpen(false); setPowerLevel(0); }}
                                className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all hover:rotate-90"
                            >
                                <X size={24} />
                            </button>

                            <div className="mt-8 mb-12">
                                <h2 className="text-4xl font-black text-white tracking-tighter mb-2">SORRY POWER</h2>
                                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">Tap to increase intensity</p>
                            </div>

                            <div className="relative flex items-center justify-center h-64">
                                {[...Array(6)].map((_, i) => (<div
                                    key={i}
                                    style={{
                                        transform: `scale(${1 + (powerLevel * 0.05)})`,
                                        opacity: Math.max(0.1, 1 - (i * 0.15)),
                                        transition: 'all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                    }}
                                    className={`absolute inset-0 rounded-full border-2 border-rose-500/30 animate-ping`}
                                ></div>))}

                                <button
                                    onMouseDown={() => setIsPoweringUp(true)}
                                    onMouseUp={() => setIsPoweringUp(false)}
                                    onClick={() => setPowerLevel(prev => Math.min(prev + 1, 10000))}
                                    className={`relative w-48 h-48 rounded-full bg-linear-to-br from-rose-500 to-rose-700 shadow-[0_0_50px_rgba(244,63,94,0.4)] flex items-center justify-center text-white transition-all active:scale-90 select-none group ${isPoweringUp ? 'scale-110' : 'scale-100'}`}
                                    style={{ transform: `scale(${1 + Math.min(powerLevel * 0.001, 0.4)})` }}
                                >
                                    <div className="flex flex-col items-center">
                                        <span className="text-2xl font-black italic tracking-tighter text-white/90 group-active:text-white">SORRY</span>
                                        <span className="text-4xl font-black mt-1">{powerLevel}</span>
                                    </div>
                                </button>
                            </div>

                            <div className="mt-16 space-y-4">
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-linear-to-r from-rose-500 to-rose-300 transition-all duration-300 shadow-[0_0_15px_rgba(244,63,94,0.5)]"
                                        style={{ width: `${Math.min((powerLevel / 10000) * 100, 100)}%` }}
                                    ></div>
                                </div>

                                <button
                                    onClick={() => handleSendPowerMessage(powerLevel)}
                                    className={`w-full py-5 font-black text-lg uppercase tracking-widest rounded-3xl transition-all shadow-2xl active:scale-95 disabled:opacity-50 ${powerLevel > 5000 ? 'bg-yellow-400 text-slate-900 shadow-yellow-500/20' :
                                        powerLevel > 1000 ? 'bg-cyan-400 text-slate-900 shadow-cyan-500/20' :
                                            powerLevel > 100 ? 'bg-orange-400 text-slate-900 shadow-orange-500/20' :
                                                'bg-white text-slate-900 shadow-white/20'
                                        }`}
                                    disabled={powerLevel === 0}
                                >
                                    Send Level {powerLevel.toLocaleString()} Sorry
                                </button>
                            </div>
                        </div>
                    </div>)}

                {renderSorryBlast()}



                <Suspense fallback={null}>
                    <CallUI
                        incomingCall={incomingCall}
                        activeCall={activeCall}
                        localStream={localStream}
                        remoteStream={remoteStream}
                        onAccept={handleAcceptCall}
                        onReject={handleRejectCall}
                        onEnd={handleEndCall}
                        onSwitchCamera={handleSwitchCamera}
                    />
                </Suspense>

                <Suspense fallback={null}>
                    <DrawingModal
                        isOpen={isDrawingOpen}
                        onClose={() => { setIsDrawingOpen(false); setDrawingInitialImage(null); }}
                        initialImage={drawingInitialImage}
                        onSend={(file) => {
                            const url = URL.createObjectURL(file);
                            setAttachPreview({ file, url, type: 'image', name: 'Drawing.png' });
                        }}
                    />
                </Suspense>

                <Suspense fallback={null}>
                    <OfflineChatManager
                        isOpen={isOfflineChatOpen}
                        onClose={() => setIsOfflineChatOpen(false)}
                        currentUser={user}
                    />
                </Suspense>

                {/* Edit History Modal */}
                {historyMsg && (
                    <div className="fixed inset-0 z-200 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                                        <History size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-gray-800 dark:text-white uppercase tracking-tighter">Edit History</h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Full audit log</p>
                                    </div>
                                </div>
                                <button onClick={() => setHistoryMsg(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-400">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
                                {/* Current Version */}
                                <div className="relative pl-6 border-l-2 border-blue-500 pb-2">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 bg-blue-500 rounded-full border-4 border-white dark:border-slate-900 ring-4 ring-blue-500/10"></div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">Current Version</span>
                                        <span className="text-[10px] text-gray-400 font-bold">Latest</span>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                                        <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed font-medium">{historyMsg.content}</p>
                                    </div>
                                </div>

                                {/* Previous Edits */}
                                {historyMsg.edit_history && [...historyMsg.edit_history].reverse().map((edit, idx) => (
                                    <div key={idx} className="relative pl-6 border-l-2 border-gray-200 dark:border-slate-800 pb-2">
                                        <div className="absolute -left-[9px] top-0 w-4 h-4 bg-gray-200 dark:bg-slate-800 rounded-full border-4 border-white dark:border-slate-900"></div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                {idx === (historyMsg.edit_history.length - 1) ? 'Original Version' : `Revision ${historyMsg.edit_history.length - idx}`}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-bold">
                                                {new Date(edit.edited_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800/50">
                                            <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{edit.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800">
                                <button
                                    onClick={() => setHistoryMsg(null)}
                                    className="w-full py-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                                >
                                    Close Audit Log
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <Suspense fallback={null}>
                    <KeyVerification
                        isOpen={isKeyVerificationOpen}
                        onClose={() => setIsKeyVerificationOpen(false)}
                        user={user}
                        friend={activeChat}
                    />
                </Suspense>
            </div>
        </>
    );
};

export default Home;
