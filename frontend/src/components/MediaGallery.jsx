import React, { useState, useMemo } from 'react';
import { X, Image as ImageIcon, Video, Music, FileText, Download, Link as LinkIcon, Calendar, ArrowUpRight } from 'lucide-react';

const MediaGallery = ({ isOpen, onClose, messages, activeChat }) => {
    const [activeTab, setActiveTab] = useState('media'); // 'media', 'docs', 'audio', 'links'

    const { media, docs, audio, links } = useMemo(() => {
        const validMessages = messages.filter(m => !m.is_deleted);
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        return {
            media: validMessages.filter(m => m.message_type === 'image' || m.message_type === 'video').reverse(),
            docs: validMessages.filter(m => m.message_type === 'file').reverse(),
            audio: validMessages.filter(m => m.message_type === 'audio').reverse(),
            links: validMessages.filter(m => m.message_type === 'text' && m.content && m.content.match(urlRegex)).reverse()
        };
    }, [messages]);

    if (!isOpen) return null;

    const tabs = [
        { id: 'media', label: 'Media', count: media.length },
        { id: 'docs', label: 'Docs', count: docs.length },
        { id: 'audio', label: 'Audio', count: audio.length },
        { id: 'links', label: 'Links', count: links.length }
    ];

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="absolute inset-y-0 right-0 w-full sm:w-[350px] shadow-2xl z-50 flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-white/20 dark:border-slate-700/50 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-500">
                        <ImageIcon size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-800 dark:text-white tracking-tight">Shared Content</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{activeChat?.alias || activeChat?.username}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-500"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex px-4 pt-4 border-b border-gray-100 dark:border-slate-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 pb-3 text-sm font-bold transition-all relative ${activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        <div className="flex items-center justify-center gap-1.5">
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400'}`}>
                                    {tab.count}
                                </span>
                            )}
                        </div>
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 dark:bg-blue-500 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.4)]"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'media' && (
                    <div className="grid grid-cols-3 gap-2">
                        {media.length > 0 ? media.map(msg => (
                            <DecryptedMedia msg={msg} activeChat={activeChat} />
                        )) : (
                            <div className="col-span-3 py-10 text-center text-gray-400">
                                <ImageIcon size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm font-bold">No Media Shared</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'docs' && (
                    <div className="space-y-3">
                        {docs.length > 0 ? docs.map(msg => (
                            <a
                                key={msg.id}
                                href={msg.file_url}
                                download={msg.content}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-700 transition-all shadow-sm group"
                            >
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <FileText size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{msg.content}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Calendar size={10} className="text-gray-400" />
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex-1 shrink-0">{formatDate(msg.created_at)}</p>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-gray-400 hover:text-blue-600 shadow-sm border border-gray-100 dark:border-slate-600">
                                    <Download size={14} />
                                </div>
                            </a>
                        )) : (
                            <div className="py-10 text-center text-gray-400">
                                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm font-bold">No Documents Shared</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'audio' && (
                    <div className="space-y-3">
                        {audio.length > 0 ? audio.map(msg => (
                            <div key={msg.id} className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50  border border-transparent hover:border-gray-200 dark:hover:border-slate-700 transition-all shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                                        <Music size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{msg.sender_id === activeChat?.id ? activeChat?.username : 'You'}'s Voice Note</p>
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{formatDate(msg.created_at)}</p>
                                    </div>
                                </div>
                                <audio controls className="w-full h-8" src={msg.file_url}>
                                    Your browser does not support audio.
                                </audio>
                            </div>
                        )) : (
                            <div className="py-10 text-center text-gray-400">
                                <Music size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm font-bold">No Audio Shared</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'links' && (
                    <div className="space-y-3">
                        {links.length > 0 ? links.map(msg => {
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            const extractedLinks = msg.content.match(urlRegex) || [];
                            return extractedLinks.map((link, idx) => (
                                <a
                                    key={`${msg.id}-${idx}`}
                                    href={link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-700 transition-all shadow-sm group"
                                >
                                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl mt-0.5">
                                        <LinkIcon size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate group-hover:underline">{link}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 max-w-[90%]">Context: "{msg.content}"</p>
                                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mt-1">{formatDate(msg.created_at)}</p>
                                    </div>
                                    <div className="shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowUpRight size={16} />
                                    </div>
                                </a>
                            ));
                        }) : (
                            <div className="py-10 text-center text-gray-400">
                                <LinkIcon size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm font-bold">No Links Shared</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


import { keyManager } from '../utils/keyManager';
import { decryptFile } from '../utils/mediaCrypto';
import { Loader2, Shield } from 'lucide-react';

const DecryptedMedia = ({ msg, activeChat }) => {
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

                    const ext = msg.content ? msg.content.split('.').pop().toLowerCase() : '';
                    let mimeType = 'application/octet-stream';
                    if (msg.message_type === 'image') mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                    else if (msg.message_type === 'video') mimeType = ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4';
                    else if (msg.message_type === 'audio') mimeType = ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : 'audio/mpeg';

                    const decrypted = await decryptFile(encryptedBlob, keyToUse, msg.iv, myKeys.privateKey, mimeType);
                    setDecryptedUrl(URL.createObjectURL(decrypted));
                } catch (err) {
                    console.error("Gallery decryption error:", err);
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

export default MediaGallery;
