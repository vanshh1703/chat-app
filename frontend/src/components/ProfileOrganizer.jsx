import React, { useState, useMemo, useEffect } from 'react';
import { X, Image as ImageIcon, Video, Music, FileText, Download, Link as LinkIcon, Calendar, ArrowUpRight, Phone, Mail, Activity, Bell, BellOff, ChevronRight, Share2, Shield, Loader2 } from 'lucide-react';
import * as api from '../api/api';

const ProfileOrganizer = ({ isOpen, onClose, activeChat, messages, isMuted, onToggleMute, onStartCall, onStartSearch }) => {
        const [editingAlias, setEditingAlias] = useState(false);
        const [aliasInput, setAliasInput] = useState(activeChat?.alias || '');
        const [aliasSaving, setAliasSaving] = useState(false);
        useEffect(() => { setAliasInput(activeChat?.alias || ''); setEditingAlias(false); }, [activeChat]);

        const handleSetAlias = async (e) => {
            e.preventDefault();
            if (!activeChat?.id) return;
            setAliasSaving(true);
            try {
                await api.setAlias(activeChat.id, aliasInput);
                setEditingAlias(false);
                // Update alias in activeChat object directly for instant UI update
                if (activeChat) {
                    activeChat.alias = aliasInput;
                }
            } catch (err) {
                alert('Failed to set alias');
            } finally {
                setAliasSaving(false);
            }
        };
    const [subView, setSubView] = useState('profile'); // 'profile' or 'media'
    const [activeTab, setActiveTab] = useState('media'); // 'media', 'docs', 'audio', 'links'
    const [sharedMedia, setSharedMedia] = useState([]);
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);

    useEffect(() => {
        if (isOpen && activeChat?.id) {
            const fetchSharedMedia = async () => {
                setIsLoadingMedia(true);
                try {
                    const { data } = await api.getSharedMedia(activeChat.id);
                    setSharedMedia(data);
                } catch (err) {
                    console.error('Failed to fetch shared media:', err);
                } finally {
                    setIsLoadingMedia(false);
                }
            };
            fetchSharedMedia();
        }
    }, [isOpen, activeChat?.id]);

    const { media, docs, audio, links } = useMemo(() => {
        const validMessages = sharedMedia.filter(m => !m.is_deleted);
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        return {
            media: validMessages.filter(m => m.message_type === 'image' || m.message_type === 'video'),
            docs: validMessages.filter(m => m.message_type === 'file'),
            audio: validMessages.filter(m => m.message_type === 'audio'),
            links: validMessages.filter(m => m.message_type === 'text' && m.content && m.content.match(urlRegex))
        };
    }, [sharedMedia]);

    if (!isOpen || !activeChat) return null;

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const tabs = [
        { id: 'media', label: 'Media', count: media.length, icon: ImageIcon },
        { id: 'docs', label: 'Docs', count: docs.length, icon: FileText },
        { id: 'audio', label: 'Audio', count: audio.length, icon: Music },
        { id: 'links', label: 'Links', count: links.length, icon: LinkIcon }
    ];

    const renderProfile = () => (
        <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar">
            {/* Minimal Header for Profile */}
            <div className="relative group">
                <div className="h-64 md:h-80 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                        src={activeChat.avatar_url}
                        alt={activeChat.username}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        width="128"
                        height="128"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent"></div>
                </div>
                <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center gap-2">
                        {!editingAlias ? (
                            <>
                                <h2 className="text-3xl font-black text-white tracking-tighter drop-shadow-lg">
                                    {activeChat.alias || activeChat.username}
                                </h2>
                                <button onClick={() => setEditingAlias(true)}
                                    className="p-1 rounded-full bg-black hover:bg-blue-900 transition-colors"
                                    title="Edit Nickname"
                                >
                                    <svg width="20" height="20" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                        <path d="M12 20h9"/>
                                        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                    </svg>
                                </button>
                            </>
                        ) : (
                            <form onSubmit={handleSetAlias} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={aliasInput}
                                    onChange={e => setAliasInput(e.target.value)}
                                    className="px-3 py-1.5 text-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                    placeholder="Set custom name..."
                                    disabled={aliasSaving}
                                    autoFocus
                                />
                                <button type="submit" className="text-blue-600 font-bold text-xs" disabled={aliasSaving}>{aliasSaving ? 'Saving...' : 'Save'}</button>
                                <button type="button" className="text-gray-400 text-xs" onClick={() => setEditingAlias(false)}>Cancel</button>
                            </form>
                        )}
                    </div>
                    <p className="text-white/80 text-sm font-bold uppercase tracking-widest mt-1">
                        {activeChat.is_online ? 'online' : 'last seen recently'}
                    </p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { icon: Phone, label: 'Call', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', onClick: () => onStartCall('audio') },
                        { icon: Video, label: 'Video', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', onClick: () => onStartCall('video') },
                        { icon: Search, label: 'Search', color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-slate-800', onClick: () => { onClose(); onStartSearch(); } },
                    ].map((btn, i) => (
                        <button key={i} onClick={btn.onClick} className="flex flex-col items-center gap-2 group">
                            <div className={`w-12 h-12 rounded-2xl ${btn.bg} flex items-center justify-center transition-all group-hover:scale-110 group-active:scale-95 shadow-sm`}>
                                <btn.icon size={20} className={btn.color} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{btn.label}</span>
                        </button>
                    ))}
                </div>

                {/* About Section */}
                <div className="p-5 bg-white dark:bg-slate-800/50 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">About & Status</p>
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                            {activeChat.bio || "Available"}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1 font-bold">Updated Nov 12, 2025</p>
                    </div>
                    <div className="h-px bg-gray-100 dark:bg-slate-800"></div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Contact Method</p>
                            <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{activeChat.email || 'Private'}</p>
                        </div>
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-xl">
                            <Mail size={18} />
                        </div>
                    </div>
                </div>

                {/* Media Audio Links Docs Preview */}
                <button
                    onClick={() => setSubView('media')}
                    className="w-full p-5 bg-white dark:bg-slate-800/50 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-slate-800 group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Media, Audio, Links, and Docs</p>
                        <div className="flex items-center gap-1 text-blue-500 font-bold text-sm">
                            {media.length + audio.length + docs.length + links.length} <ChevronRight size={16} />
                        </div>
                    </div>
                    {([...media, ...audio].length > 0) ? (
                        <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
                            {[...media, ...audio].slice(0, 6).map((msg, idx) => (
                                <div key={idx} className="w-20 h-20 rounded-xl shrink-0 overflow-hidden bg-gray-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm">
                                    <DecryptedMediaPreview msg={msg} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 text-left italic">No shared content yet</p>
                    )}
                </button>

                {/* Notification Settings */}
                <div className="space-y-3">
                    <button
                        onClick={onToggleMute}
                        className="w-full flex items-center gap-4 p-5 bg-white dark:bg-slate-800/50 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm"
                    >
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isMuted ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-500' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-500'}`}>
                            {isMuted ? <BellOff size={20} /> : <Bell size={20} />}
                        </div>
                        <div className="text-left flex-1">
                            <p className="text-sm font-bold text-gray-800 dark:text-slate-200">Mute Notifications</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{isMuted ? 'Silently listening' : 'Always ring'}</p>
                        </div>
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${isMuted ? 'bg-rose-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isMuted ? 'right-1' : 'left-1'}`}></div>
                        </div>
                    </button>

                    <button className="w-full flex items-center gap-4 p-5 bg-white dark:bg-slate-800/50 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm">
                        <div className="w-11 h-11 bg-slate-50 dark:bg-slate-800 text-gray-400 rounded-2xl flex items-center justify-center">
                            <Shield size={20} />
                        </div>
                        <div className="text-left flex-1">
                            <p className="text-sm font-bold text-gray-800 dark:text-slate-200">Encryption</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Messages are E2E encrypted</p>
                        </div>
                        <ArrowUpRight size={16} className="text-gray-300" />
                    </button>
                </div>
            </div>
        </div>
    );

    const renderMediaView = () => (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex px-4 pt-4 border-b border-gray-100 dark:border-slate-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        {tab.label}
                        {tab.count > 0 && <span className="ml-1 opacity-50">({tab.count})</span>}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 rounded-t-full"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'media' && (
                    <div className="grid grid-cols-3 gap-2">
                        {media.length > 0 ? media.map(msg => (
                            <DecryptedMedia msg={msg} />
                        )) : (
                            <div className="col-span-3 py-10 text-center text-gray-400">
                                <ImageIcon size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm font-bold">No Media Shared</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'docs' && (
                    <div className="space-y-2">
                        {docs.length > 0 ? docs.map(msg => (
                            <a key={msg.id} href={msg.file_url} download={msg.content} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-700 transition-all shadow-sm group">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <FileText size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{msg.content}</p>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mt-1">{formatDate(msg.created_at)}</p>
                                </div>
                                <Download size={14} className="text-gray-400 group-hover:text-blue-500" />
                            </a>
                        )) : (
                            <div className="py-10 text-center text-gray-400"><FileText size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm font-bold">No Documents Shared</p></div>
                        )}
                    </div>
                )}

                {activeTab === 'audio' && (
                    <div className="space-y-3">
                        {audio.length > 0 ? audio.map(msg => (
                            <div key={msg.id} className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50  border border-transparent hover:border-gray-200 dark:hover:border-slate-700 transition-all shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl"><Music size={16} /></div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Voice Note</p>
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{formatDate(msg.created_at)}</p>
                                    </div>
                                </div>
                                <audio controls className="w-full h-8" src={msg.file_url} />
                            </div>
                        )) : (
                            <div className="py-10 text-center text-gray-400"><Music size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm font-bold">No Audio Shared</p></div>
                        )}
                    </div>
                )}

                {activeTab === 'links' && (
                    <div className="space-y-2">
                        {links.length > 0 ? links.map(msg => {
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            const extractedLinks = msg.content.match(urlRegex) || [];
                            return extractedLinks.map((link, idx) => (
                                <a key={`${msg.id}-${idx}`} href={link} target="_blank" rel="noreferrer" className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-700 transition-all shadow-sm group">
                                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl mt-0.5"><LinkIcon size={18} /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate group-hover:underline">{link}</p>
                                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mt-1">{formatDate(msg.created_at)}</p>
                                    </div>
                                    <ArrowUpRight size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                            ));
                        }) : (
                            <div className="py-10 text-center text-gray-400"><LinkIcon size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm font-bold">No Links Shared</p></div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            {/* Backdrop for mobile */}
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            ></div>

            {/* Main Panel */}
            <div className={`fixed inset-y-0 right-0 w-full sm:w-[400px] z-1000 flex flex-col bg-white dark:bg-slate-900 shadow-2xl border-l border-white/20 dark:border-slate-800 ${isOpen ? 'translate-x-0' : 'translate-x-full'} ${typeof window !== 'undefined' && window.innerWidth < 640 ? 'transition-none duration-0' : 'transition-transform duration-500 ease-in-out'}`}>
                {/* Header */}
                <div className="p-6 flex items-center justify-between z-10 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <button
                            onPointerDown={subView === 'media' ? () => setSubView('profile') : onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-500"
                        >
                            <X size={22} className={subView === 'media' ? 'rotate-180 transition-transform' : ''} />
                        </button>
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-white">
                            {subView === 'media' ? 'Shared Content' : 'Contact Info'}
                        </h3>
                    </div>
                </div>

                {subView === 'profile' ? renderProfile() : renderMediaView()}
            </div>
        </>
    );
};

// Help search component (lucide-react doesn't have Search by default in some lists, but adding it here if needed)
const Search = ({ size, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
);


// --- Decryption Helper Hook (Minimal version of useEncryption for this component) ---
import { keyManager } from '../utils/keyManager';
import { decryptFile } from '../utils/mediaCrypto';

const DecryptedMediaPreview = ({ msg }) => {
    const [decryptedUrl, setDecryptedUrl] = useState(null);
    const [decrypting, setDecrypting] = useState(false);

    useEffect(() => {
        const isEncrypted = msg.is_media_encrypted || (!!msg.encrypted_key && !!msg.iv);
        if (isEncrypted && msg.file_url && !decryptedUrl && !decrypting) {
            const performDecryption = async () => {
                setDecrypting(true);
                try {
                    const response = await fetch(msg.file_url);
                    const encryptedBlob = await response.blob();
                    const profile = JSON.parse(localStorage.getItem('profile'));
                    const userId = profile?.user?.id;
                    const myKeys = await keyManager.getMyKeys(userId);

                    const isMine = String(msg.sender_id) === String(userId);
                    const keyToUse = isMine ? (msg.sender_encrypted_key || msg.encrypted_key) : msg.encrypted_key;

                    const decrypted = await decryptFile(encryptedBlob, keyToUse, msg.iv, myKeys.privateKey, msg.message_type === 'image' ? 'image/jpeg' : (msg.message_type === 'video' ? 'video/webm' : 'application/octet-stream'));
                    setDecryptedUrl(URL.createObjectURL(decrypted));
                } catch (err) {
                    console.error("Preview decryption error:", err);
                } finally {
                    setDecrypting(false);
                }
            };
            performDecryption();
        }
    }, [msg, decryptedUrl, decrypting]);

    const url = decryptedUrl || msg.file_url;

    if (decrypting) return <div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={16} /></div>;

    if (msg.message_type === 'audio') return <div className="w-full h-full flex items-center justify-center bg-purple-50 dark:bg-purple-900/20 text-purple-500"><Music size={24} /></div>;

    return <img src={url} alt="" className="w-full h-full object-cover" />;
};

const DecryptedMedia = ({ msg }) => {
    const [decryptedUrl, setDecryptedUrl] = useState(null);
    const [decrypting, setDecrypting] = useState(false);

    useEffect(() => {
        const isEncrypted = msg.is_media_encrypted || (!!msg.encrypted_key && !!msg.iv);
        if (isEncrypted && msg.file_url && !decryptedUrl && !decrypting) {
            const performDecryption = async () => {
                setDecrypting(true);
                try {
                    const response = await fetch(msg.file_url);
                    const encryptedBlob = await response.blob();
                    const profile = JSON.parse(localStorage.getItem('profile'));
                    const userId = profile?.user?.id;
                    const myKeys = await keyManager.getMyKeys(userId);

                    const isMine = String(msg.sender_id) === String(userId);
                    const keyToUse = isMine ? (msg.sender_encrypted_key || msg.encrypted_key) : msg.encrypted_key;

                    const decrypted = await decryptFile(encryptedBlob, keyToUse, msg.iv, myKeys.privateKey, msg.message_type === 'image' ? 'image/jpeg' : (msg.message_type === 'video' ? 'video/webm' : 'application/octet-stream'));
                    setDecryptedUrl(URL.createObjectURL(decrypted));
                } catch (err) {
                    console.error("Full media decryption error:", err);
                } finally {
                    setDecrypting(false);
                }
            };
            performDecryption();
        }
    }, [msg, decryptedUrl, decrypting]);

    const url = decryptedUrl || msg.file_url;
    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (decrypting) return <div className="aspect-square flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-xl gap-2"><Loader2 className="animate-spin text-blue-500" size={24} /><span className="text-[8px] font-bold text-gray-400 uppercase">Decrypting...</span></div>;

    return (
        <a href={url} target="_blank" rel="noreferrer" className="aspect-square relative group rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800 shadow-sm min-h-[100px]">
            {msg.message_type === 'image' ? (
                <img src={url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            ) : (
                <div className="w-full h-full relative flex items-center justify-center">
                    <video src={url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity group-hover:bg-black/40">
                        <Video className="text-white drop-shadow-lg" size={24} />
                    </div>
                </div>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="absolute bottom-1 right-2 text-[8px] text-white/80 font-bold tracking-wider">{formatDate(msg.created_at)}</span>
            </div>
            {(msg.is_media_encrypted || (msg.encrypted_key && msg.iv)) && (
                <div className="absolute top-1.5 right-1.5 p-1 bg-emerald-500/80 backdrop-blur-sm text-white rounded-md">
                    <Shield size={8} />
                </div>
            )}
        </a>
    );
};

export default ProfileOrganizer;
