import React, { useState, useEffect, useRef } from 'react';
import { Search, MoreVertical, Phone, Video, Plus, Smile, Send, Check, CheckCheck, CornerUpLeft, X, FileText, Download, Image as ImageIcon, Film, Trash2, ArrowLeft, Mic, Square, Settings as SettingsIcon, Camera, BarChart2, Activity, Clock, Calendar, MessageSquare, Award, TrendingUp, Zap, Pin, PinOff, Mail } from 'lucide-react';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';
import * as api from '../api/api';
import EmojiPicker from 'emoji-picker-react';

const Home = () => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('profile'))?.user);
    const [sidebarUsers, setSidebarUsers] = useState([]);
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

    // Audio recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef(null);
    const [chatWallpaper, setChatWallpaper] = useState('default');
    const [showInsights, setShowInsights] = useState(false);
    const [chatStats, setChatStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [viewingProfile, setViewingProfile] = useState(null); // User object
    const [isEditingAlias, setIsEditingAlias] = useState(false);
    const [newAlias, setNewAlias] = useState('');
    const [isPowerModalOpen, setIsPowerModalOpen] = useState(false);
    const [powerLevel, setPowerLevel] = useState(0);
    const [isPoweringUp, setIsPoweringUp] = useState(false);
    const [activeSorryBlast, setActiveSorryBlast] = useState(null); // { power, timestamp }

    useEffect(() => {
        if (user) {
            setChatWallpaper(localStorage.getItem(`chatWallpaper_${user.id}`) || 'default');
        }
    }, [user]);

    // Separate useEffect for socket connection to avoid reconnecting on chat switch
    useEffect(() => {
        socket.current = io('http://localhost:5000');
        return () => socket.current.disconnect();
    }, []);

    // Initialize listeners and Request Notification Permission
    useEffect(() => {
        if (!socket.current) return;

        // Request browser notification permission
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        if (user) {
            socket.current.emit('join', user.id);
        }

        const currentSocket = socket.current;

        currentSocket.on('receive_message', async (newMessage) => {
            console.log('Message received:', newMessage);
            setMessages((prev) => {
                // Only append if it belongs to current active chat
                if (activeChat && (String(newMessage.sender_id) === String(activeChat.id) || String(newMessage.receiver_id) === String(activeChat.id))) {
                    return [...prev, newMessage];
                }
                return prev;
            });

            if (newMessage.sender_id !== user.id) {
                // Determine if we should show a notification
                const isDifferentChat = !activeChat || activeChat.id !== newMessage.sender_id;
                if (isDifferentChat || document.hidden) {
                    const notifSettings = JSON.parse(localStorage.getItem('notifSettings') || '{"individual": true, "all": true, "sound": true}');
                    const shouldNotify = notifSettings.all && (isDifferentChat ? notifSettings.individual : true);

                    if (shouldNotify) {
                        if (notifSettings.sound) {
                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                            audio.play().catch(e => console.error("Sound play failed", e));
                        }

                        if ('Notification' in window && Notification.permission === 'granted') {
                            const title = `New message from ${newMessage.senderName || 'a user'}`;
                            const options = {
                                body: newMessage.message_type === 'text' ? newMessage.content : `Sent an ${newMessage.message_type}`,
                                icon: '/pwa-192x192.png',
                            };
                            new Notification(title, options);
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
                        : msg
                )
            );
        });

        currentSocket.on('message_updated', (updatedMsg) => {
            setMessages((prev) =>
                prev.map((msg) => msg.id === updatedMsg.id ? updatedMsg : msg)
            );
        });

        currentSocket.on('message_deleted', ({ messageId }) => {
            setMessages((prev) =>
                prev.map((msg) => msg.id === messageId ? { ...msg, is_deleted: true, content: '' } : msg)
            );
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
    }, [user, activeChat]);

    // Fetch sidebar users
    const fetchSidebar = async () => {
        try {
            const { data } = await api.getSidebar();
            setSidebarUsers(data);

            // Update App Badge
            const totalUnread = data.reduce((sum, u) => sum + Number(u.unreadcount || 0), 0);
            if ('setAppBadge' in navigator) {
                if (totalUnread > 0) {
                    navigator.setAppBadge(totalUnread).catch(() => { });
                } else {
                    navigator.clearAppBadge().catch(() => { });
                }
            }

            const statuses = {};
            data.forEach(u => statuses[u.id] = { isOnline: u.is_online, lastSeen: u.last_seen });
            setOnlineUsers(prev => ({ ...prev, ...statuses }));
        } catch (err) {
            console.error('Fetch sidebar error', err);
        }
    };

    useEffect(() => {
        fetchSidebar();
    }, []);

    // Camera Logic
    useEffect(() => {
        let stream = null;
        if (isCameraOpen) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
                .then(s => {
                    stream = s;
                    if (videoRef.current) videoRef.current.srcObject = s;
                })
                .catch(err => {
                    console.error('Camera access error', err);
                    setIsCameraOpen(false);
                    alert('Could not access camera. Please check permissions.');
                });
        }
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isCameraOpen]);

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0);

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
                const url = URL.createObjectURL(file);
                setAttachPreview({ file, url, type: 'image', name: file.name });
                setIsCameraOpen(false);
            }
        }, 'image/jpeg', 0.8);
    };

    // Wallpaper Logic
    useEffect(() => {
        const handleStorage = (e) => {
            if (user && e.key === `chatWallpaper_${user.id}`) setChatWallpaper(e.newValue || 'default');
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [user]);

    // Scroll to bottom on new messages
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle Search
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (searchTerm.trim()) {
                try {
                    const { data } = await api.searchUsers(searchTerm);
                    setSearchResults(data);

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
        setSearchTerm('');
        setSearchResults([]);
        try {
            await api.markAsRead({ senderId: selectedUser.id });
            const { data } = await api.getMessages(selectedUser.id);
            setMessages(data);
            fetchSidebar();
        } catch (err) {
            console.error('Fetch messages error', err);
        }
    };

    // Send logic
    const handleSendMessage = (e) => {
        if (e) e.preventDefault();
        if (!messageText.trim() || !activeChat) return;

        const msgData = {
            senderId: user.id,
            receiverId: activeChat.id,
            content: messageText,
            messageType: 'text',
            replyToId: replyingTo ? replyingTo.id : null,
            senderName: user.username
        };

        socket.current.emit('send_message', msgData);
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
        const el = document.getElementById(`msg-${msgId}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMsgId(msgId);
        setTimeout(() => setHighlightedMsgId(null), 1500);
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
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', attachPreview.file);
            const { data } = await api.uploadFile(formData);
            socket.current.emit('send_message', {
                senderId: user.id,
                receiverId: activeChat.id,
                content: data.originalName,
                messageType: data.messageType,
                fileUrl: data.fileUrl,
                replyToId: replyingTo ? replyingTo.id : null,
                senderName: user.username
            });
            setAttachPreview(null);
            setReplyingTo(null);
            if (!sidebarUsers.find(u => u.id === activeChat.id)) fetchSidebar();
        } catch (err) {
            console.error('File upload error', err);
        } finally {
            setUploading(false);
        }
    };

    const renderFileMessage = (msg) => {
        const isMine = msg.sender_id === user.id;
        if (msg.message_type === 'image') {
            return (
                <a href={msg.file_url} target="_blank" rel="noreferrer">
                    <img src={msg.file_url} alt={msg.content}
                        className="max-w-[240px] max-h-[220px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                </a>
            );
        }
        if (msg.message_type === 'video') {
            return (
                <video controls className="max-w-[280px] rounded-xl" src={msg.file_url}>
                    Your browser does not support video.
                </video>
            );
        }
        if (msg.message_type === 'audio') {
            return (
                <audio controls className="max-w-[240px] h-10" src={msg.file_url}>
                    Your browser does not support audio.
                </audio>
            );
        }
        return (
            <a href={msg.file_url} download={msg.content} target="_blank" rel="noreferrer"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isMine ? 'bg-white/30' : 'bg-blue-100'}`}>
                    <FileText size={18} className={isMine ? 'text-white' : 'text-blue-500'} />
                </div>
                <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate max-w-[160px] ${isMine ? 'text-white' : 'text-gray-800'}`}>{msg.content}</p>
                    <p className={`text-[10px] ${isMine ? 'text-white/70' : 'text-gray-400'}`}>Tap to download</p>
                </div>
                <Download size={14} className={isMine ? 'text-white/80' : 'text-blue-400'} />
            </a>
        );
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(audioBlob);
                const file = new File([audioBlob], `voice_message_${Date.now()}.webm`, { type: 'audio/webm' });
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
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    const handleFetchStats = async () => {
        if (!activeChat) return;
        setLoadingStats(true);
        setShowInsights(true);
        try {
            const { data } = await api.getChatStats(activeChat.id);
            setChatStats(data);
        } catch (err) {
            console.error('Fetch stats error', err);
        } finally {
            setLoadingStats(false);
        }
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
        return `Last seen ${lastSeenDate.toLocaleDateString()}`;
    };

    const renderSorryBlast = () => {
        if (!activeSorryBlast) return null;
        const { power } = activeSorryBlast;
        const particleCount = Math.min(20 + Math.floor(power / 10), 100);

        return (
            <div className="fixed inset-0 z-200 pointer-events-none overflow-hidden flex items-center justify-center">
                {/* Screen Shake Effect */}
                <div className="absolute inset-0 bg-rose-500/10 animate-pulse"></div>

                {/* Particle Explosion */}
                {[...Array(particleCount)].map((_, i) => {
                    const angle = (i / particleCount) * 360;
                    const velocity = 5 + Math.random() * 10;
                    const size = 4 + Math.random() * 8;
                    const delay = Math.random() * 0.5;

                    return (
                        <div
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
                        ></div>
                    );
                })}

                {/* Central Shockwave */}
                <div className="w-20 h-20 rounded-full border-4 border-white/50 animate-ping duration-700"></div>
                <div className="absolute text-white font-black italic text-6xl md:text-8xl tracking-tighter animate-in zoom-in fade-in duration-500 fill-mode-forwards">
                    SORRY!
                </div>
            </div>
        );
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

                return (
                    <div className="flex flex-col items-center pt-4 pr-6 pb-2 pl-2 select-none max-w-full relative">
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

                            {/* Level Badge - Now more prominent and colorful */}
                            <div className={`absolute -top-3 -right-6 ${theme.badge} text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xl border-2 border-white/20 z-10 transition-transform group-hover:scale-110 whitespace-nowrap`}>
                                LVL {power.toLocaleString()}
                            </div>

                            {/* Extra effects for high levels */}
                            {power > 100 && (
                                <div className={`absolute inset-0 pointer-events-none opacity-50`}>
                                    <div className={`absolute inset-0 animate-pulse bg-${theme.glow}-500/20 blur-xl rounded-full`}></div>
                                </div>
                            )}

                            {power > 20 && (
                                <div className="absolute inset-0 pointer-events-none text-white/40">
                                    <div className="absolute top-0 left-1/4 w-1 h-1 bg-current rounded-full animate-ping"></div>
                                    <div className="absolute bottom-0 right-1/4 w-1.5 h-1.5 bg-current rounded-full animate-ping delay-100"></div>
                                    {power > 1000 && <div className="absolute top-1/2 left-0 w-2 h-2 bg-current rounded-full animate-ping delay-200"></div>}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
        } catch (e) {
            return msg.content;
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#f0f2f5] dark:bg-[#0f172a] overflow-hidden font-sans relative transition-colors duration-300">
            {/* Sidebar */}
            <div className={`w-full md:w-1/4 md:min-w-[320px] flex-col bg-white/70 dark:bg-slate-900/70 backdrop-blur-[10px] border-r border-white/30 dark:border-slate-800/30 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to="/profile" className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm hover:scale-105 transition-transform">
                            <img src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} alt="Profile" className="w-full h-full object-cover" />
                        </Link>
                        <div>
                            <h3 className="font-bold text-gray-800 dark:text-white text-sm">{user?.username}</h3>
                            <p className="text-xs text-green-500 font-medium">Online</p>
                        </div>
                    </div>
                    <Link to="/settings" className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                        <SettingsIcon size={20} />
                    </Link>
                </div>
                <div className="px-4 py-2 relative">
                    <div className="relative rounded-2xl flex items-center px-4 py-2.5 bg-gray-100/80 dark:bg-slate-800/80 border border-transparent transition-all duration-300 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                        <Search size={18} className="text-gray-400 mr-2" />
                        <input type="text" placeholder="Find someone new..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none w-full text-sm placeholder-gray-400 dark:text-white" />
                    </div>
                    {searchResults.length > 0 && (
                        <div className="absolute left-4 right-4 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                            {searchResults.map((res) => (
                                <div key={res.id} onClick={() => handleSelectChat(res)} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0">
                                    <img src={res.avatar_url} className="w-8 h-8 rounded-full" alt="" />
                                    <span className="text-sm font-bold text-slate-700">{res.username}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto mt-2 px-2 pb-4">
                    <h4 className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Direct Messages</h4>
                    <div className="space-y-1">
                        {sidebarUsers.map(chat => (
                            <div key={chat.id} onMouseEnter={() => setHoveredMsgId(`sidebar_${chat.id}`)} onMouseLeave={() => setHoveredMsgId(null)} onClick={() => handleSelectChat(chat)} className={`group flex items-center gap-4 p-4 cursor-pointer rounded-2xl transition-all duration-200 ${activeChat?.id === chat.id ? 'bg-white shadow-[0_10px_25px_rgba(0,0,0,0.05)]' : Number(chat.unreadcount) > 0 ? 'bg-blue-50/80' : 'hover:bg-white/50'}`}>
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm">
                                        <img src={chat.avatar_url} alt={chat.username} />
                                    </div>
                                    {onlineUsers[chat.id]?.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                                    {chat.is_pinned && (
                                        <div className="absolute -top-1 -right-1 p-1 bg-white dark:bg-slate-900 rounded-full shadow-md text-blue-500 border border-blue-100">
                                            <Pin size={8} fill="currentColor" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <h4 className="text-sm font-bold truncate flex items-center gap-1">
                                            {chat.alias || chat.username}
                                        </h4>
                                        <span className="text-[10px] text-gray-400">{chat.lastmsgtime ? new Date(chat.lastmsgtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                    </div>
                                    <p className="text-xs truncate text-gray-500">{typingUsers[chat.id] ? <span className="text-blue-500 italic">typing...</span> : chat.lastmsg || 'No messages yet'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {Number(chat.unreadcount) > 0 && <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">{chat.unreadcount}</div>}
                                    {(hoveredMsgId === `sidebar_${chat.id}` || chat.is_pinned) && (
                                        <button
                                            onClick={(e) => handlePinChat(e, chat.id)}
                                            className={`p-1.5 rounded-full transition-all duration-200 ${chat.is_pinned ? 'text-blue-500' : 'text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100'}`}
                                            title={chat.is_pinned ? 'Unpin chat' : 'Pin chat'}
                                        >
                                            {chat.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={`flex-1 flex-col relative h-full w-full ${activeChat ? 'flex' : 'hidden md:flex'}`}>
                <div className={`absolute inset-0 z-0 ${chatWallpaper === 'gradient' ? 'wallpaper-gradient' : chatWallpaper === 'stars' ? 'wallpaper-stars' : 'bg-[#f0f2f5] dark:bg-[#0f172a]'}`} style={chatWallpaper.startsWith('data:') ? { backgroundImage: `url(${chatWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                    {chatWallpaper !== 'default' && <div className="absolute inset-0 bg-white/30 dark:bg-slate-900/40 backdrop-blur-[1px]"></div>}
                </div>

                {activeChat ? (
                    <div className="flex flex-col h-full relative z-10">
                        <div className="p-3 md:p-4 flex items-center justify-between bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-white/30 dark:border-slate-700/30 z-10">
                            <div className="flex items-center gap-2 md:gap-4 flex-1">
                                <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 rounded-xl text-gray-500"><ArrowLeft size={20} /></button>
                                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform" onClick={() => handleViewProfile(activeChat)}>
                                    <img src={activeChat.avatar_url} alt="Active" />
                                </div>
                                {!showChatSearch ? (
                                    <div>
                                        {isEditingAlias ? (
                                            <form onSubmit={handleSetAlias} className="flex items-center gap-2">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={newAlias}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => setNewAlias(e.target.value)}
                                                    className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                                    placeholder="Set custom name..."
                                                />
                                                <button type="submit" className="text-blue-600 font-bold text-xs">Save</button>
                                                <button type="button" onClick={() => setIsEditingAlias(false)} className="text-gray-400 text-xs">Cancel</button>
                                            </form>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-gray-800 dark:text-white text-sm cursor-pointer" onClick={() => handleViewProfile(activeChat)}>
                                                    {activeChat.alias || activeChat.username}
                                                </h3>
                                                <button
                                                    onClick={() => { setIsEditingAlias(true); setNewAlias(activeChat.alias || activeChat.username); }}
                                                    onFocus={(e) => e.target.select()}
                                                    className="p-1 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                                    title="Edit Name"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-[11px] text-gray-500">{getStatusText(activeChat.id)}</p>
                                    </div>
                                ) : (
                                    <div className="flex-1 max-w-md relative">
                                        <input autoFocus type="text" placeholder="Search messages..." value={chatSearchTerm} onChange={(e) => setChatSearchTerm(e.target.value)} className="w-full pl-4 pr-10 py-1.5 bg-gray-100 rounded-xl text-sm outline-none" />
                                        <button onClick={() => { setShowChatSearch(false); setChatSearchTerm(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={16} /></button>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1 md:gap-2">
                                <button onClick={handleFetchStats} className={`p-2 rounded-xl ${showInsights ? 'text-blue-600' : 'text-gray-500'}`} title="Chat Insights"><BarChart2 size={18} /></button>
                                <button onClick={() => setShowChatSearch(p => !p)} className={`p-2 rounded-xl ${showChatSearch ? 'text-blue-600' : 'text-gray-500'}`}><Search size={18} /></button>
                                <button className="p-2 rounded-xl text-gray-500"><Phone size={18} /></button>
                                <button className="p-2 rounded-xl text-gray-500"><Video size={18} /></button>
                            </div>
                        </div>

                        {/* Pinned Messages Banner */}
                        {messages.some(m => m.is_pinned) && (
                            <div className="px-4 py-2 bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur-sm border-b border-amber-100 dark:border-amber-800 flex items-center justify-between z-10 sticky top-[60px] md:top-[73px]">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="p-1.5 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-400">
                                        <Pin size={14} fill="currentColor" />
                                    </div>
                                    <div className="flex-1 truncate">
                                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pinned Message</p>
                                        <p className="text-xs text-gray-700 dark:text-slate-300 truncate font-medium">
                                            {messages.filter(m => m.is_pinned).reverse()[0].content || "Attachment"}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => scrollToMessage(messages.filter(m => m.is_pinned).reverse()[0].id)} className="text-[10px] font-bold text-amber-600 hover:scale-105 transition-transform px-3 py-1 bg-white dark:bg-slate-800 rounded-lg border border-amber-200">View</button>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                            {messages.filter(m => !chatSearchTerm || (m.content && m.content.toLowerCase().includes(chatSearchTerm.toLowerCase()))).map((msg, i) => (
                                <div key={i} id={`msg-${msg.id}`} className={`flex ${msg.message_type === 'system' ? 'justify-center' : msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                                    {msg.message_type === 'system' ? (
                                        <div className="px-4 py-1.5 bg-gray-200/50 dark:bg-slate-800/50 rounded-full text-[11px] font-bold text-gray-500">{msg.content}</div>
                                    ) : (
                                        <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${msg.sender_id === user.id ? 'items-end' : 'items-start'}`} onMouseEnter={() => setHoveredMsgId(msg.id)} onMouseLeave={() => setHoveredMsgId(null)}>
                                            <div className={`px-4 py-3 rounded-2xl relative shadow-sm ${msg.is_deleted ? 'bg-gray-100 italic text-gray-400' : msg.is_pinned ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : msg.sender_id === user.id ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200'}`}>
                                                {msg.is_deleted ? 'This message was deleted' : (
                                                    <>
                                                        {msg.reply_to_msg && (
                                                            <div onClick={() => scrollToMessage(msg.reply_to_msg.id)} className={`mb-2 p-2 rounded-xl border-l-4 text-xs cursor-pointer ${msg.sender_id === user.id ? 'bg-white/20 border-white' : 'bg-gray-50 border-blue-500 text-gray-500'}`}>
                                                                <p className="font-bold">{msg.reply_to_msg.sender_id === user.id ? 'You' : activeChat.alias || activeChat.username}</p>
                                                                <p className="truncate">{msg.reply_to_msg.content}</p>
                                                            </div>
                                                        )}
                                                        {msg.is_pinned && <div className="flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 mb-1"><Pin size={10} fill="currentColor" /> PINNED</div>}
                                                        {msg.message_type === 'text' ? msg.content : msg.message_type === 'template' ? renderTemplateMessage(msg) : renderFileMessage(msg)}
                                                    </>
                                                )}
                                                {hoveredMsgId === msg.id && !msg.is_deleted && (
                                                    <div className={`absolute top-0 -translate-y-full flex gap-1 p-1 bg-white rounded-lg shadow-xl z-20 ${msg.sender_id === user.id ? 'right-0' : 'left-0'}`}>
                                                        <button onClick={() => setReactionPickerMsgId(msg.id)} className="p-1 hover:bg-gray-100 rounded" title="React">😊</button>
                                                        <button onClick={() => handleStartReply(msg)} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="Reply"><CornerUpLeft size={14} /></button>
                                                        <button onClick={() => handlePinMessage(msg.id)} className={`p-1 hover:bg-gray-100 rounded ${msg.is_pinned ? 'text-amber-500' : 'text-gray-500'}`} title={msg.is_pinned ? 'Unpin' : 'Pin'}>
                                                            {msg.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                                                        </button>
                                                        {msg.sender_id === user.id && <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 hover:bg-gray-100 rounded text-red-500" title="Delete"><Trash2 size={14} /></button>}
                                                    </div>
                                                )}
                                                {reactionPickerMsgId === msg.id && (
                                                    <div className="absolute top-0 -translate-y-full flex gap-1 p-2 bg-white rounded-2xl shadow-2xl z-30 border border-gray-100">
                                                        {QUICK_REACTIONS.map(e => <button key={e} onClick={() => handleReact(msg.id, e)} className="text-xl hover:scale-125 transition-transform">{e}</button>)}
                                                    </div>
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
                                    )}
                                </div>
                            ))}
                            <div ref={scrollRef} />
                        </div>

                        {showInsights && (
                            <ChatInsights
                                otherUser={activeChat}
                                stats={chatStats}
                                onClose={() => setShowInsights(false)}
                            />
                        )}

                        {attachPreview && (
                            <div className="p-3 bg-white/50 backdrop-blur flex items-center gap-3 border-t">
                                {attachPreview.type === 'image' && <img src={attachPreview.url} className="w-12 h-12 rounded object-cover" alt="" />}
                                <div className="flex-1 truncate"><p className="text-sm font-bold truncate">{attachPreview.name}</p></div>
                                <button onClick={handleSendFile} disabled={uploading} className="p-2 bg-blue-600 text-white rounded-lg">{uploading ? '...' : <Send size={18} />}</button>
                                <button onClick={() => setAttachPreview(null)} className="text-gray-400"><X size={18} /></button>
                            </div>
                        )}

                        <div className="p-3 md:p-4 bg-white/80 backdrop-blur-md">
                            <div className="max-w-4xl mx-auto">
                                {replyingTo && (
                                    <div className="flex justify-between items-center bg-blue-50 p-2 rounded-xl mb-2 text-xs">
                                        <div className="truncate"><span className="font-bold text-blue-600">Reply to: </span>{replyingTo.content}</div>
                                        <button onClick={() => setReplyingTo(null)}><X size={14} /></button>
                                    </div>
                                )}
                                <form onSubmit={handleSendMessage} className="flex gap-2 items-center bg-white p-2 rounded-2xl shadow-sm border">
                                    {isRecording ? (
                                        <div className="flex-1 flex items-center justify-between px-2 text-red-500">
                                            <span>Recording... {formatRecordingTime(recordingTime)}</span>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={cancelRecording}><Trash2 size={20} /></button>
                                                <button type="button" onClick={stopRecording} className="p-2 bg-red-500 text-white rounded-full"><Square size={16} /></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
                                            <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><Plus size={20} /></button>
                                            <button type="button" onClick={() => setIsCameraOpen(true)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><Camera size={20} /></button>
                                            <input ref={inputRef} value={messageText} onChange={e => { setMessageText(e.target.value); handleTyping(); }} placeholder="Type a message..." className="flex-1 bg-transparent outline-none text-sm" />
                                            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-gray-400 hover:text-yellow-500 transition-colors"><Smile size={20} /></button>
                                            <button type="button" onClick={() => setIsPowerModalOpen(true)} className="p-2 text-gray-400 hover:text-rose-500 transition-colors" title="Send Sorry Power"><Zap size={20} /></button>
                                            {messageText.trim() || attachPreview ? (
                                                <button type="submit" className="p-2 bg-blue-600 text-white rounded-xl"><Send size={18} /></button>
                                            ) : (
                                                <button type="button" onClick={startRecording} className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><Mic size={20} /></button>
                                            )}
                                        </>
                                    )}
                                </form>
                                {showEmojiPicker && <div className="absolute bottom-full mb-2 right-0 z-50"><EmojiPicker onEmojiClick={handleEmojiClick} height={350} width={300} /></div>}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-500"><Send size={32} /></div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Your Space to Connect</h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400">Search for a friend or select a chat to start messaging.</p>
                    </div>
                )}
            </div>

            {/* Camera Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-100 bg-black/90 flex flex-col items-center justify-center p-4">
                    <div className="relative w-full max-w-lg aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <button onClick={() => setIsCameraOpen(false)} className="absolute top-4 right-4 p-2 bg-black/40 text-white rounded-full"><X size={24} /></button>
                    </div>
                    <div className="mt-8 flex gap-8 items-center">
                        <button onClick={() => setIsCameraOpen(false)} className="text-white opacity-60 hover:opacity-100 font-medium">Cancel</button>
                        <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-gray-400 hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-lg"><div className="w-12 h-12 rounded-full border-2 border-slate-900"></div></button>
                        <div className="w-12"></div>
                    </div>
                </div>
            )}

            {/* Profile View Modal */}
            {viewingProfile && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[42px] shadow-2xl overflow-hidden border border-white/20 dark:border-slate-700/50">
                        <div className="h-40 bg-linear-to-br from-blue-500 via-indigo-600 to-violet-700 relative">
                            <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"></div>
                            <button
                                onClick={() => setViewingProfile(null)}
                                className="absolute top-6 right-6 p-2.5 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all hover:rotate-90"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="px-8 pb-10 text-center -mt-20 relative z-10">
                            <div className="w-36 h-36 rounded-full border-10 border-white dark:border-slate-800 shadow-2xl overflow-hidden bg-white dark:bg-slate-900 mx-auto">
                                <img src={viewingProfile.avatar_url} alt={viewingProfile.username} className="w-full h-full object-cover" />
                            </div>
                            <h2 className="mt-6 text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                                {viewingProfile.alias || viewingProfile.username}
                            </h2>
                            {viewingProfile.alias && (
                                <p className="text-xs font-black text-blue-500 dark:text-blue-400 uppercase tracking-[0.2em] mt-2 opacity-80">@{viewingProfile.username}</p>
                            )}

                            <div className="mt-8 space-y-4">
                                <div className="flex items-center gap-4 p-4.5 bg-gray-50/80 dark:bg-slate-900/40 rounded-[28px] border border-gray-100/50 dark:border-slate-700/30 transition-colors hover:bg-white dark:hover:bg-slate-900/60">
                                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center shadow-inner">
                                        <Mail size={22} />
                                    </div>
                                    <div className="text-left overflow-hidden">
                                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Email Address</p>
                                        <p className="text-[14px] font-bold text-gray-700 dark:text-slate-200 truncate">{viewingProfile.email}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 p-4.5 bg-gray-50/80 dark:bg-slate-900/40 rounded-[28px] border border-gray-100/50 dark:border-slate-700/30 transition-colors hover:bg-white dark:hover:bg-slate-900/60">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${viewingProfile.is_online ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-400'}`}>
                                        <Activity size={22} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Global Status</p>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${viewingProfile.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                            <p className={`text-[14px] font-black ${viewingProfile.is_online ? 'text-emerald-500' : 'text-gray-500'}`}>
                                                {viewingProfile.is_online ? 'Available Now' : 'Currently Offline'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {viewingProfile.bio && (
                                    <div className="p-4.5 bg-gray-50/80 dark:bg-slate-900/40 rounded-[28px] border border-gray-100/50 dark:border-slate-700/30 text-left">
                                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">About</p>
                                        <p className="text-[14px] font-medium text-gray-700 dark:text-slate-200 line-clamp-3">
                                            {viewingProfile.bio}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setViewingProfile(null)}
                                className="w-full mt-10 py-5 bg-linear-to-r from-gray-800 to-gray-900 dark:from-slate-700 dark:to-slate-800 hover:from-black hover:to-black text-white font-black text-sm uppercase tracking-widest rounded-[24px] transition-all shadow-xl active:scale-95 border-b-4 border-black/20"
                            >
                                Close Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Power Up Modal */}
            {isPowerModalOpen && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl transition-all animate-in fade-in duration-300">
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
                            {[...Array(6)].map((_, i) => (
                                <div
                                    key={i}
                                    style={{
                                        transform: `scale(${1 + (powerLevel * 0.05)})`,
                                        opacity: Math.max(0.1, 1 - (i * 0.15)),
                                        transition: 'all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                    }}
                                    className={`absolute inset-0 rounded-full border-2 border-rose-500/30 animate-ping`}
                                ></div>
                            ))}

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
                </div>
            )}

            {renderSorryBlast()}
        </div>
    );
};

export default Home;

const ChatInsights = ({ onClose, stats, otherUser }) => {
    if (!stats) return (
        <div className="absolute inset-0 z-60 bg-[#f0f2f5]/95 dark:bg-[#0f172a]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in slide-in-from-right duration-300">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500 font-bold">Calculating insights...</p>
        </div>
    );

    return (
        <div className="absolute inset-0 z-60 bg-[#f0f2f5]/95 dark:bg-[#0f172a]/95 backdrop-blur-md flex flex-col p-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                        <BarChart2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white font-sans">Chat Insights</h2>
                        <p className="text-xs text-gray-500">Analytics with {otherUser?.alias || otherUser?.username}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <X size={20} className="text-gray-500" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar pb-10">
                {/* Friendship Score Hero */}
                <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-sm border border-white/50 dark:border-slate-700/50">
                    <div className="absolute top-0 right-0 p-10 opacity-5 dark:opacity-10 translate-x-1/4 -translate-y-1/4">
                        <Award size={200} />
                    </div>
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="relative w-32 h-32 mb-4">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" className="stroke-current text-gray-100 dark:text-slate-700" strokeWidth="2.5" />
                                <circle cx="18" cy="18" r="16" fill="none" className="stroke-current text-blue-600" strokeWidth="2.5" strokeDasharray={`${stats.friendshipScore}, 100`} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-3xl font-black text-gray-800 dark:text-white">{stats.friendshipScore}%</span>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Friendship Score</h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-[200px]">
                            {stats.friendshipScore > 80 ? "Legendary Connection! 🏆" : stats.friendshipScore > 50 ? "Building a solid bond! ✨" : "Just getting started! 🌱"}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mb-3">
                            <MessageSquare size={20} />
                        </div>
                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Messages</p>
                        <h4 className="text-2xl font-black text-gray-800 dark:text-white mt-1">{stats.totalMessages}</h4>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-3">
                            <Zap size={20} />
                        </div>
                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Longest Convo</p>
                        <h4 className="text-xl font-black text-gray-800 dark:text-white mt-1 truncate">{stats.longestConversation}</h4>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mb-3">
                            <Clock size={20} />
                        </div>
                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Avg Reply</p>
                        <h4 className="text-xl font-black text-gray-800 dark:text-white mt-1 truncate">{stats.avgReplyTime}</h4>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center mb-3">
                            <Calendar size={20} />
                        </div>
                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Active Day</p>
                        <h4 className="text-lg font-black text-gray-800 dark:text-white mt-1 truncate">{stats.mostActiveDay}</h4>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl shadow-sm border border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={18} className="text-blue-500" />
                        <h3 className="font-bold text-gray-800 dark:text-white">Top Used Words</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {stats.topWords && stats.topWords.length > 0 ? stats.topWords.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800 hover:scale-105 transition-transform cursor-default">
                                <span className="text-sm font-bold text-gray-700 dark:text-slate-200">{item.word}</span>
                                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-black">{item.count}</span>
                            </div>
                        )) : (
                            <p className="text-xs text-gray-400">No word data available yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
