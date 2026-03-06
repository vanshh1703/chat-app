import React, { useState, useEffect, useRef } from 'react';
import { Search, MoreVertical, Phone, Video, Plus, Smile, Send, Check, CheckCheck, CornerUpLeft, X, FileText, Download, Image as ImageIcon, Film, Trash2 } from 'lucide-react';
import { io } from 'socket.io-client';
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
    const fileInputRef = useRef();
    const [uploading, setUploading] = useState(false);
    const [attachPreview, setAttachPreview] = useState(null); // { file, url, type }

    // Initialize Socket
    useEffect(() => {
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
            replyToId: replyingTo ? replyingTo.id : null
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
                replyToId: replyingTo ? replyingTo.id : null
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
        <div className="flex h-screen w-full bg-[#f0f2f5] overflow-hidden font-sans">
            {/* Sidebar */}
            <div className="w-1/4 min-w-[320px] flex flex-col bg-white/70 backdrop-blur-[10px] border-r border-white/30">
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                            <img src={user?.avatar_url} alt="Profile" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-sm">{user?.username}</h3>
                            <p className="text-xs text-green-500 font-medium">Online</p>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="px-4 py-2 relative">
                    <div className="relative rounded-2xl flex items-center px-4 py-2.5 bg-gray-100/80 border border-transparent transition-all duration-300 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                        <Search size={18} className="text-gray-400 mr-2" />
                        <input
                            type="text"
                            placeholder="Find someone new..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent border-none outline-none w-full text-sm placeholder-gray-400"
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
            <div className="flex-1 flex flex-col bg-white/40 backdrop-blur-sm relative">
                {activeChat ? (
                    <>
                        <div className="p-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-white/30 z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm">
                                    <img src={activeChat.avatar_url} alt="Active Chat" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm">{activeChat.username}</h3>
                                    <div className="flex items-center gap-1">
                                        {onlineUsers[activeChat.id]?.isOnline && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                                        <p className="text-[11px] text-gray-500 font-medium">
                                            {getStatusText(activeChat.id)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2.5 rounded-xl hover:bg-white/60 text-gray-500 transition-colors shadow-sm bg-white/40">
                                    <Phone size={18} />
                                </button>
                                <button className="p-2.5 rounded-xl hover:bg-white/60 text-gray-500 transition-colors shadow-sm bg-white/40">
                                    <Video size={18} />
                                </button>
                                <button className="p-2.5 rounded-xl hover:bg-white/60 text-gray-500 transition-colors shadow-sm bg-white/40">
                                    <MoreVertical size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg, index) => (
                                <div
                                    key={index}
                                    id={`msg-${msg.id}`}
                                    className={`flex transition-all duration-300 ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'
                                        } ${highlightedMsgId === msg.id
                                            ? 'bg-yellow-100/80 rounded-2xl -mx-3 px-3'
                                            : ''
                                        }`}
                                    onMouseEnter={() => !msg.is_deleted && setHoveredMsgId(msg.id)}
                                    onMouseLeave={() => { setHoveredMsgId(null); setReactionPickerMsgId(null); }}
                                >
                                    <div className={`flex gap-3 max-w-[70%] ${msg.sender_id === user.id ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className="flex flex-col relative">
                                            <div className={`px-4 py-3 text-sm shadow-[0_4px_15px_rgba(0,0,0,0.05)] ${msg.is_deleted
                                                ? (msg.sender_id === user.id
                                                    ? 'bg-linear-to-br from-[#93c5fd] to-[#60a5fa] text-white/70 rounded-[20px_20px_5px_20px] italic'
                                                    : 'bg-gray-100 text-gray-400 rounded-[20px_20px_20px_5px] italic')
                                                : msg.message_type !== 'text'
                                                    ? (msg.sender_id === user.id
                                                        ? 'bg-linear-to-br from-[#3b82f6] to-[#2563eb] text-white rounded-[20px_20px_5px_20px] p-2'
                                                        : 'bg-white text-gray-800 rounded-[20px_20px_20px_5px] p-2')
                                                    : (msg.sender_id === user.id
                                                        ? 'bg-linear-to-br from-[#3b82f6] to-[#2563eb] text-white rounded-[20px_20px_5px_20px]'
                                                        : 'bg-white text-gray-800 rounded-[20px_20px_20px_5px]')
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
                                                                    : 'bg-gray-50 border-blue-300 text-gray-500 hover:bg-blue-50'
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
                                                                className="text-xs bg-white border border-gray-100 shadow-sm rounded-full px-2 py-0.5 cursor-pointer hover:bg-gray-50 transition-colors"
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

                        <div className="p-4 bg-white/30 backdrop-blur-md">
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
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{attachPreview.name}</p>
                                            <p className="text-xs text-gray-400 capitalize">{attachPreview.type}</p>
                                        </div>
                                        <button onClick={handleSendFile} disabled={uploading}
                                            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg disabled:opacity-50 transition-all hover:scale-105">
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
                                    <div className="absolute bottom-full mb-2 right-0 z-50" ref={emojiPickerRef}>
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
                                <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-white shadow-xl shadow-blue-500/5 rounded-2xl px-4 py-2 border border-blue-50 transition-all focus-within:ring-2 focus-within:ring-blue-100">
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
                                        className="text-gray-400 hover:text-blue-500 transition-colors p-2 rounded-lg hover:bg-blue-50">
                                        <Plus size={20} />
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
                                        className="flex-1 bg-transparent border-none outline-none text-sm py-2 px-2"
                                    />
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowEmojiPicker(prev => !prev)}
                                            className={`text-gray-400 hover:text-yellow-500 transition-colors p-2 rounded-lg hover:bg-yellow-50 ${showEmojiPicker ? 'text-yellow-500 bg-yellow-50' : ''}`}
                                        >
                                            <Smile size={20} />
                                        </button>
                                        <button type="submit" className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 ml-2">
                                            <Send size={18} className="ml-0.5" />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 text-blue-500 ring-1 ring-slate-100">
                            <Send size={40} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-700">Your messages</h2>
                        <p className="text-sm mt-2 max-w-[280px] text-center">Search for a username above to start a conversation with someone new.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Home;
