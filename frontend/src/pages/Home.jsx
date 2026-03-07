import React, { useState, useEffect, useRef } from 'react';
import { Search, MoreVertical, Phone, Video, Plus, Smile, Send, Check, CheckCheck, CornerUpLeft, X, FileText, Download, Image as ImageIcon, Film, Trash2, ArrowLeft, Mic, Square, Settings as SettingsIcon, Camera } from 'lucide-react';
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
    const [chatWallpaper, setChatWallpaper] = useState(localStorage.getItem('chatWallpaper') || 'default');

    // Initialize Socket and Request Notification Permission
    useEffect(() => {
        // Request browser notification permission
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        socket.current = io('http://localhost:5000');
        if (user) {
            socket.current.emit('join', user.id);
        }

        socket.current.on('receive_message', async (newMessage) => {
            setMessages((prev) => {
                // Only append if it belongs to current active chat
                if (activeChat && (newMessage.sender_id === activeChat.id || newMessage.receiver_id === activeChat.id)) {
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

            if (activeChat && newMessage.sender_id === activeChat.id) {
                try {
                    await api.markAsRead({ senderId: activeChat.id });
                } catch (e) { console.error(e); }
            }
            // Refresh sidebar to update last message/order
            fetchSidebar();
        });

        socket.current.on('typing', (data) => {
            setTypingUsers(prev => ({ ...prev, [data.senderId]: true }));
        });

        socket.current.on('stop_typing', (data) => {
            setTypingUsers(prev => ({ ...prev, [data.senderId]: false }));
        });

        socket.current.on('user_status', (data) => {
            setOnlineUsers(prev => ({
                ...prev,
                [data.userId]: { isOnline: data.isOnline, lastSeen: data.lastSeen }
            }));
        });

        socket.current.on('messages_read', (data) => {
            setMessages((prev) =>
                prev.map((msg) =>
                    (msg.receiver_id === data.byUserId && !msg.is_read)
                        ? { ...msg, is_read: true }
                        : msg
                )
            );
        });

        socket.current.on('message_updated', (updatedMsg) => {
            setMessages((prev) =>
                prev.map((msg) => msg.id === updatedMsg.id ? updatedMsg : msg)
            );
        });

        socket.current.on('message_deleted', ({ messageId }) => {
            setMessages((prev) =>
                prev.map((msg) => msg.id === messageId ? { ...msg, is_deleted: true, content: '' } : msg)
            );
        });

        return () => socket.current.disconnect();
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
                    navigator.setAppBadge(totalUnread).catch(() => {});
                } else {
                    navigator.clearAppBadge().catch(() => {});
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
            if (e.key === 'chatWallpaper') setChatWallpaper(e.newValue || 'default');
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

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

        // Optimistic update for sidebar visibility if not already there
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
        // Document / generic file
        return (
            <a href={msg.file_url} download={msg.content} target="_blank" rel="noreferrer"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-100 hover:bg-gray-200'
                    } transition-colors`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isMine ? 'bg-white/30' : 'bg-blue-100'
                    }`}>
                    <FileText size={18} className={isMine ? 'text-white' : 'text-blue-500'} />
                </div>
                <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate max-w-[160px] ${isMine ? 'text-white' : 'text-gray-800'
                        }`}>{msg.content}</p>
                    <p className={`text-[10px] ${isMine ? 'text-white/70' : 'text-gray-400'
                        }`}>Tap to download</p>
                </div>
                <Download size={14} className={isMine ? 'text-white/80' : 'text-blue-400'} />
            </a>
        );
    };

    // Audio Recording Logic
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(audioBlob);
                const file = new File([audioBlob], `voice_message_${Date.now()}.webm`, { type: 'audio/webm' });
                setAttachPreview({ file, url, type: 'audio', name: 'Voice Message' });
                
                // Cleanup stream tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
            
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
        socket.current.emit('react_message', {
            messageId: msgId,
            emoji,
            senderId: user.id,
            receiverId: activeChat.id
        });
        setReactionPickerMsgId(null);
    };

    const handleDeleteMessage = (msgId) => {
        if (!activeChat || !window.confirm('Delete this message for everyone?')) return;
        socket.current.emit('delete_message', {
            messageId: msgId,
            senderId: user.id,
            receiverId: activeChat.id
        });
    };

    const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '👎'];

    const getStatusText = (userId) => {
        if (typingUsers[userId]) return <span className="text-blue-500 italic">typing...</span>;
        const status = onlineUsers[userId];
        if (!status) return 'Offline'; // fallback
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

    return (
        <div className="flex h-screen w-full bg-[#f0f2f5] dark:bg-[#0f172a] overflow-hidden font-sans relative transition-colors duration-300">
            {/* Sidebar */}
            <div className={`w-full md:w-1/4 md:min-w-[320px] flex-col bg-white/70 dark:bg-slate-900/70 backdrop-blur-[10px] border-r border-white/30 dark:border-slate-800/30 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm">
                            <img src={user?.avatar_url} alt="Profile" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 dark:text-white text-sm">{user?.username}</h3>
                            <p className="text-xs text-green-500 font-medium">Online</p>
                        </div>
                    </div>
                    <Link to="/settings" className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                        <SettingsIcon size={20} />
                    </Link>
                </div>

                {/* Search */}
                <div className="px-4 py-2 relative">
                    <div className="relative rounded-2xl flex items-center px-4 py-2.5 bg-gray-100/80 dark:bg-slate-800/80 border border-transparent transition-all duration-300 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                        <Search size={18} className="text-gray-400 mr-2" />
                        <input
                            type="text"
                            placeholder="Find someone new..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent border-none outline-none w-full text-sm placeholder-gray-400 dark:text-white"
                        />
                    </div>

                    {/* Search Results Overlay */}
                    {searchResults.length > 0 && (
                        <div className="absolute left-4 right-4 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                            {searchResults.map((res) => (
                                <div
                                    key={res.id}
                                    onClick={() => handleSelectChat(res)}
                                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                                >
                                    <img src={res.avatar_url} className="w-8 h-8 rounded-full" alt="" />
                                    <span className="text-sm font-bold text-slate-700">{res.username}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar Chat List */}
                <div className="flex-1 overflow-y-auto mt-2 px-2 pb-4">
                    <h4 className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Direct Messages</h4>
                    <div className="space-y-1">
                        {sidebarUsers.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => handleSelectChat(chat)}
                                className={`flex items-center gap-4 p-4 cursor-pointer rounded-2xl transition-all duration-200 ${activeChat?.id === chat.id
                                    ? 'bg-white shadow-[0_10px_25px_rgba(0,0,0,0.05)]'
                                    : Number(chat.unreadcount) > 0
                                        ? 'bg-blue-50/80 shadow-[0_5px_15px_rgba(59,130,246,0.1)]'
                                        : 'hover:bg-white/50'
                                    }`}
                            >
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm">
                                        <img src={chat.avatar_url} alt={chat.username} />
                                    </div>
                                    {onlineUsers[chat.id]?.isOnline && (
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <h4 className={`text-sm font-bold truncate ${activeChat?.id === chat.id ? 'text-blue-600' : Number(chat.unreadcount) > 0 ? 'text-blue-600' : 'text-gray-800'}`}>{chat.username}</h4>
                                        <span className={`text-[10px] font-medium ${Number(chat.unreadcount) > 0 ? 'text-blue-500' : 'text-gray-400'}`}>{chat.lasttime ? new Date(chat.lasttime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                    </div>
                                    <p className={`text-xs truncate ${Number(chat.unreadcount) > 0 ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>
                                        {typingUsers[chat.id] ? (
                                            <span className="text-blue-500 italic">typing...</span>
                                        ) : (
                                            chat.lastmsg || 'No messages yet'
                                        )}
                                    </p>
                                </div>
                                {Number(chat.unreadcount) > 0 && (
                                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                                        {chat.unreadcount}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={`flex-1 flex-col relative h-full w-full ${activeChat ? 'flex' : 'hidden md:flex'}`}>
                {/* Wallpaper Background */}
                <div className={`absolute inset-0 z-0 transition-all duration-700 ${
                    chatWallpaper === 'gradient' ? 'wallpaper-gradient' : 
                    chatWallpaper === 'stars' ? 'wallpaper-stars' : 
                    'bg-[#f0f2f5] dark:bg-[#0f172a]'
                }`}
                style={chatWallpaper.startsWith('data:') ? { 
                    backgroundImage: `url(${chatWallpaper})`, 
                    backgroundSize: 'cover', 
                    backgroundPosition: 'center' 
                } : {}}
                >
                    {/* Legibility Overlay */}
                    {chatWallpaper !== 'default' && (
                        <div className="absolute inset-0 bg-white/30 dark:bg-slate-900/40 backdrop-blur-[1px]"></div>
                    )}
                </div>

                {activeChat ? (
                    <div className="flex flex-col h-full relative z-10">
                        <div className="p-3 md:p-4 flex items-center justify-between bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-white/30 dark:border-slate-700/30 z-10 shrink-0">
                            <div className="flex items-center gap-2 md:gap-4 flex-1">
                                <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 rounded-xl hover:bg-white/60 dark:hover:bg-slate-700/60 text-gray-500 dark:text-slate-400 transition-colors">
                                    <ArrowLeft size={20} />
                                </button>
                                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm shrink-0">
                                    <img src={activeChat.avatar_url} alt="Active Chat" />
                                </div>
                                {!showChatSearch ? (
                                    <div>
                                        <h3 className="font-bold text-gray-800 dark:text-white text-sm">{activeChat.username}</h3>
                                        <div className="flex items-center gap-1">
                                            {onlineUsers[activeChat.id]?.isOnline && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                                            <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                                                {getStatusText(activeChat.id)}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 max-w-md">
                                        <div className="relative">
                                            <input 
                                                autoFocus
                                                type="text" 
                                                placeholder="Search messages..."
                                                value={chatSearchTerm}
                                                onChange={(e) => setChatSearchTerm(e.target.value)}
                                                className="w-full pl-4 pr-10 py-1.5 bg-gray-100 dark:bg-slate-700 rounded-xl text-sm border-none focus:ring-2 focus:ring-blue-500/20 dark:text-white"
                                            />
                                            <button 
                                                onClick={() => { setShowChatSearch(false); setChatSearchTerm(''); }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1 md:gap-2">
                                <button 
                                    onClick={() => setShowChatSearch(prev => !prev)}
                                    className={`p-2 md:p-2.5 rounded-xl transition-colors shadow-sm bg-white/40 dark:bg-slate-800/40 ${showChatSearch ? 'text-blue-600 bg-blue-50' : 'text-gray-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/60'}`}
                                >
                                    <Search size={18} />
                                </button>
                                <button className="p-2 md:p-2.5 rounded-xl hover:bg-white/60 dark:hover:bg-slate-700/60 text-gray-500 dark:text-slate-400 transition-colors shadow-sm bg-white/40 dark:bg-slate-800/40">
                                    <Phone size={18} />
                                </button>
                                <button className="p-2 md:p-2.5 rounded-xl hover:bg-white/60 dark:hover:bg-slate-700/60 text-gray-500 dark:text-slate-400 transition-colors shadow-sm bg-white/40 dark:bg-slate-800/40">
                                    <Video size={18} />
                                </button>
                                <button className="p-2 md:p-2.5 rounded-xl hover:bg-white/60 dark:hover:bg-slate-700/60 text-gray-500 dark:text-slate-400 transition-colors shadow-sm bg-white/40 dark:bg-slate-800/40 hidden sm:block">
                                    <MoreVertical size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages
                                .filter(msg => !chatSearchTerm || (msg.content && msg.content.toLowerCase().includes(chatSearchTerm.toLowerCase())))
                                .map((msg, index) => (
                                <div
                                    key={index}
                                    id={`msg-${msg.id}`}
                                    className={`flex transition-all duration-300 ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'
                                        } ${highlightedMsgId === msg.id
                                            ? 'bg-yellow-100/80 dark:bg-yellow-900/40 rounded-2xl -mx-3 px-3'
                                            : ''
                                        }`}
                                    onMouseEnter={() => !msg.is_deleted && setHoveredMsgId(msg.id)}
                                    onMouseLeave={() => { setHoveredMsgId(null); setReactionPickerMsgId(null); }}
                                >
                                    <div className={`flex gap-2 md:gap-3 max-w-[85%] md:max-w-[70%] ${msg.sender_id === user.id ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className="flex flex-col relative">
                                            <div className={`px-4 py-3 text-sm shadow-[0_4px_15px_rgba(0,0,0,0.05)] ${msg.is_deleted
                                                ? (msg.sender_id === user.id
                                                    ? 'bg-linear-to-br from-[#93c5fd] to-[#60a5fa] dark:from-blue-900/60 dark:to-blue-800/60 text-white/70 rounded-[20px_20px_5px_20px] italic'
                                                    : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 rounded-[20px_20px_20px_5px] italic')
                                                : msg.message_type !== 'text'
                                                    ? (msg.sender_id === user.id
                                                        ? 'bg-linear-to-br from-[#3b82f6] to-[#2563eb] text-white rounded-[20px_20px_5px_20px] p-2'
                                                        : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-[20px_20px_20px_5px] p-2')
                                                    : (msg.sender_id === user.id
                                                        ? 'bg-linear-to-br from-[#3b82f6] to-[#2563eb] text-white rounded-[20px_20px_5px_20px]'
                                                        : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-[20px_20px_20px_5px]')
                                                }`}>
                                                {msg.is_deleted ? (
                                                    <span className="flex items-center gap-1.5">
                                                        <Trash2 size={12} className="opacity-60" />
                                                        This message was deleted
                                                    </span>
                                                ) : (
                                                    <>
                                                        {/* Reply preview inside bubble — click to jump */}
                                                        {msg.reply_to_msg && (
                                                            <div
                                                                onClick={() => scrollToMessage(msg.reply_to_msg.id)}
                                                                className={`mb-2 px-3 py-2 rounded-xl border-l-4 text-xs cursor-pointer active:scale-[0.98] transition-all ${msg.sender_id === user.id
                                                                    ? 'bg-white/20 border-white/60 text-white/90 hover:bg-white/30'
                                                                    : 'bg-gray-50 dark:bg-slate-700 border-blue-300 dark:border-blue-500 text-gray-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-600'
                                                                    }`}
                                                            >
                                                                <p className="font-semibold mb-0.5">
                                                                    {msg.reply_to_msg.sender_id === user.id ? 'You' : activeChat.username}
                                                                </p>
                                                                <p className="truncate">{msg.reply_to_msg.content}</p>
                                                            </div>
                                                        )}
                                                        {msg.message_type === 'text' ? msg.content : renderFileMessage(msg)}
                                                    </>
                                                )}
                                            </div>

                                            {/* Reactions display */}
                                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                <div className={`flex flex-wrap gap-1 mt-1 ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                                                    {(() => {
                                                        const counts = {};
                                                        Object.values(msg.reactions).forEach(e => { counts[e] = (counts[e] || 0) + 1; });
                                                        return Object.entries(counts).map(([emoji, count]) => (
                                                            <span
                                                                key={emoji}
                                                                onClick={() => handleReact(msg.id, emoji)}
                                                                className="text-xs bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm rounded-full px-2 py-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                                            >
                                                                {emoji} {count > 1 ? count : ''}
                                                            </span>
                                                        ));
                                                    })()}
                                                </div>
                                            )}

                                            <div className={`flex items-center gap-1 mt-1 ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                                                <span className="text-[10px] text-gray-400 font-medium">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {msg.sender_id === user.id && (
                                                    msg.is_read ? (
                                                        <CheckCheck size={12} className="text-blue-500" />
                                                    ) : onlineUsers[msg.receiver_id]?.isOnline ? (
                                                        <CheckCheck size={12} className="text-gray-400" />
                                                    ) : (
                                                        <Check size={12} className="text-gray-400" />
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {/* Hover action buttons: react + reply + delete */}
                                        {hoveredMsgId === msg.id && !msg.is_deleted && (
                                            <div className={`flex items-center gap-1 self-center relative ${msg.sender_id === user.id ? 'order-first mr-1' : 'ml-1'}`}>
                                                {/* Reply button */}
                                                <button
                                                    onClick={() => handleStartReply(msg)}
                                                    className="w-7 h-7 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-400 hover:text-blue-500 hover:scale-110 transition-all"
                                                    title="Reply"
                                                >
                                                    <CornerUpLeft size={13} />
                                                </button>

                                                {/* React button */}
                                                <button
                                                    onClick={() => setReactionPickerMsgId(prev => prev === msg.id ? null : msg.id)}
                                                    className="w-7 h-7 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-400 hover:text-yellow-500 hover:scale-110 transition-all"
                                                    title="React"
                                                >
                                                    😊
                                                </button>

                                                {/* Delete button — only for own messages */}
                                                {msg.sender_id === user.id && (
                                                    <button
                                                        onClick={() => handleDeleteMessage(msg.id)}
                                                        className="w-7 h-7 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-400 hover:text-red-500 hover:scale-110 transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}

                                                {/* Quick reaction picker */}
                                                {reactionPickerMsgId === msg.id && (
                                                    <div className={`absolute bottom-9 flex gap-1 bg-white shadow-2xl border border-gray-100 rounded-2xl px-2.5 py-2 z-50 ${msg.sender_id === user.id ? 'right-0' : 'left-0'
                                                        }`}>
                                                        {QUICK_REACTIONS.map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => handleReact(msg.id, emoji)}
                                                                className="text-xl hover:scale-125 transition-transform"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={scrollRef} />
                        </div>

                        <div className="p-2 md:p-4 bg-white/30 backdrop-blur-md shrink-0">
                            <div className="max-w-4xl mx-auto relative">

                                {/* File attachment preview */}
                                {attachPreview && (
                                    <div className="flex items-center gap-3 bg-white border border-blue-100 rounded-2xl px-4 py-3 mb-2 shadow-sm">
                                        {attachPreview.type === 'image' && (
                                            <img src={attachPreview.url} className="w-14 h-14 rounded-xl object-cover shrink-0" alt="preview" />
                                        )}
                                        {attachPreview.type === 'video' && (
                                            <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                                <Film size={22} className="text-blue-400" />
                                            </div>
                                        )}
                                        {attachPreview.type === 'file' && (
                                            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                                <FileText size={22} className="text-blue-400" />
                                            </div>
                                        )}
                                        {attachPreview.type === 'audio' && (
                                            <div className="bg-blue-50/50 rounded-xl px-2 py-1 flex items-center justify-center shrink-0">
                                                <audio controls src={attachPreview.url} className="h-10 w-48" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{attachPreview.name}</p>
                                            <p className="text-xs text-gray-400 capitalize">{attachPreview.type}</p>
                                        </div>
                                        <button onClick={handleSendFile} disabled={uploading}
                                            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg disabled:opacity-50 transition-all hover:scale-105 ml-2">
                                            {uploading ? <span className="text-[10px]">...</span> : <Send size={16} />}
                                        </button>
                                        <button onClick={() => setAttachPreview(null)}
                                            className="text-gray-400 hover:text-gray-600 ml-1">
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}

                                {/* Reply preview banner */}
                                {replyingTo && (
                                    <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-2xl px-4 py-2 mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <CornerUpLeft size={14} className="text-blue-400 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-semibold text-blue-500">
                                                    Replying to {replyingTo.sender_id === user.id ? 'yourself' : activeChat.username}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">{replyingTo.content}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setReplyingTo(null)}
                                            className="ml-3 text-gray-400 hover:text-gray-600 shrink-0"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                                {/* Emoji Picker floating above input */}
                                {showEmojiPicker && (
                                    <div className="absolute bottom-full mb-2 right-0 sm:right-auto sm:left-0 md:left-auto md:right-0 z-50 max-w-[100vw]" ref={emojiPickerRef}>
                                        <EmojiPicker
                                            onEmojiClick={handleEmojiClick}
                                            height={380}
                                            width={320}
                                            searchDisabled={false}
                                            skinTonesDisabled
                                            previewConfig={{ showPreview: false }}
                                        />
                                    </div>
                                )}
                                <form onSubmit={handleSendMessage} className="flex items-center gap-2 md:gap-3 bg-white shadow-xl shadow-blue-500/5 rounded-2xl px-2 md:px-4 py-2 border border-blue-50 transition-all focus-within:ring-2 focus-within:ring-blue-100">
                                    {isRecording ? (
                                        <>
                                            <div className="flex items-center gap-2 text-red-500 font-medium text-sm animate-pulse px-2 flex-1">
                                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                                                Recording... {formatRecordingTime(recordingTime)}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button type="button" onClick={cancelRecording} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50">
                                                    <Trash2 size={20} />
                                                </button>
                                                <button type="button" onClick={stopRecording} className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all shadow-lg shadow-blue-500/30 hover:scale-105 ml-1 md:ml-2 shrink-0">
                                                    <Square size={16} fill="white" />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* Hidden file input */}
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                                                className="hidden"
                                                onChange={handleFileSelect}
                                            />
                                            <button type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800">
                                                <Plus size={20} />
                                            </button>
                                            <button type="button"
                                                onClick={() => setIsCameraOpen(true)}
                                                className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800">
                                                <Camera size={20} />
                                            </button>
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={messageText}
                                                onChange={(e) => {
                                                    setMessageText(e.target.value);
                                                    handleTyping();
                                                }}
                                                onKeyDown={(e) => { if (e.key === 'Escape') { setShowEmojiPicker(false); setReplyingTo(null); } }}
                                                placeholder={replyingTo ? 'Type your reply...' : 'Type your message...'}
                                                className="flex-1 bg-transparent border-none outline-none text-sm py-2 px-2 min-w-0 dark:text-white"
                                            />
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowEmojiPicker(prev => !prev)}
                                                    className={`text-gray-400 hover:text-yellow-500 transition-colors p-2 rounded-lg hover:bg-yellow-50 dark:hover:bg-slate-800 ${showEmojiPicker ? 'text-yellow-500 bg-yellow-50 dark:bg-slate-700' : ''}`}
                                                >
                                                    <Smile size={20} />
                                                </button>
                                                {messageText.trim() || attachPreview ? (
                                                    <button type="submit" className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 ml-1 md:ml-2 shrink-0">
                                                        <Send size={18} className="ml-0.5" />
                                                    </button>
                                                ) : (
                                                    <button type="button" onClick={startRecording} className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center transition-all ml-1 md:ml-2 shrink-0">
                                                        <Mic size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </form>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300">
                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl shadow-xl flex items-center justify-center mb-6 text-blue-500 dark:text-blue-400 ring-1 ring-slate-100 dark:ring-slate-700">
                            <Send size={40} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Your messages</h2>
                        <p className="text-sm mt-2 max-w-[280px] text-center">Search for a username above to start a conversation with someone new.</p>
                    </div>
                )}
            </div>

            {/* Camera Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-2xl w-full max-w-lg border border-white/10">
                        <div className="p-4 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-white font-bold">Capture Photo</h3>
                            <button onClick={() => setIsCameraOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="relative aspect-video bg-black flex items-center justify-center">
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="p-6 flex justify-center items-center gap-6 bg-slate-800/50">
                            <button 
                                onClick={() => setIsCameraOpen(false)}
                                className="px-6 py-2 rounded-xl text-slate-400 hover:text-white font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={capturePhoto}
                                className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full border-4 border-slate-900 transition-colors"></div>
                            </button>
                            <div className="w-20"></div> {/* Spacer for symmetry */}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
