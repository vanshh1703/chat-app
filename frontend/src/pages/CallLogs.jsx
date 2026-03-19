import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Phone, Video, PhoneMissed, PhoneIncoming, PhoneOutgoing, Search, Home, User, Clock3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/api';

const TABS = [
    { id: 'all', label: 'All' },
    { id: 'missed', label: 'Missed' }
];

const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};


const getDayLabel = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();

    const sameDay =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

    if (sameDay) return 'Today';

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isYesterday =
        date.getFullYear() === yesterday.getFullYear() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getDate() === yesterday.getDate();

    if (isYesterday) return 'Yesterday';

    return formatDate(dateStr);
};

const SwipeToCallRow = ({ children, onSwipeCall }) => {
    const [translateX, setTranslateX] = useState(0);
    const touchStartRef = useRef(null);
    const touchCurrentRef = useRef(null);

    const handleTouchStart = (event) => {
        touchStartRef.current = event.touches[0].clientX;
        touchCurrentRef.current = event.touches[0].clientX;
    };

    const handleTouchMove = (event) => {
        if (touchStartRef.current === null) return;

        touchCurrentRef.current = event.touches[0].clientX;
        const deltaX = touchCurrentRef.current - touchStartRef.current;

        if (deltaX > 0) {
            setTranslateX(Math.min(deltaX, 90));
        }
    };

    const handleTouchEnd = () => {
        if (touchStartRef.current === null || touchCurrentRef.current === null) {
            setTranslateX(0);
            return;
        }

        const totalSwipe = touchCurrentRef.current - touchStartRef.current;
        if (totalSwipe > 70) {
            onSwipeCall();
        }

        setTranslateX(0);
        touchStartRef.current = null;
        touchCurrentRef.current = null;
    };

    return (
        <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute inset-y-0 left-0 w-16 flex items-center justify-center text-emerald-300">
                <Phone size={18} />
            </div>
            <div
                className="relative touch-pan-y"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                style={{
                    transform: `translateX(${translateX}px)`,
                    transition: translateX === 0 ? 'transform 0.2s ease-out' : 'none'
                }}
            >
                {children}
            </div>
        </div>
    );
};

const CallLogs = () => {
    const [callLogs, setCallLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [showSearch, setShowSearch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const user = useMemo(() => JSON.parse(localStorage.getItem('profile'))?.user || null, []);
    const navigate = useNavigate();

    const fetchLogs = useCallback(async () => {
        if (!user?.id) {
            setCallLogs([]);
            setError('User session not found. Please login again.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const { data } = await api.getCallHistory();
            setCallLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching call logs:', err);
            setError('Unable to load call history right now.');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filteredLogs = useMemo(() => {
        if (!user?.id) return [];

        return [...callLogs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).filter((log) => {
            const isOutgoing = log.caller_id === user.id;
            const otherName = (isOutgoing ? log.receiver_name : log.caller_name) || '';
            const callStatus = (log.status || '').toLowerCase();

            const matchesTab =
                activeTab === 'all' ||
                (activeTab === 'missed' && (log.status === 'missed' || log.status === 'rejected'));

            const matchesSearch =
                !normalizedSearch ||
                otherName.toLowerCase().includes(normalizedSearch) ||
                callStatus.includes(normalizedSearch);

            return matchesTab && matchesSearch;
        });
    }, [activeTab, callLogs, normalizedSearch, user?.id]);

    const groupedLogs = useMemo(() => {
        return filteredLogs.reduce((accumulator, log) => {
            const dayKey = getDayLabel(log.created_at);
            if (!accumulator[dayKey]) accumulator[dayKey] = [];
            accumulator[dayKey].push(log);
            return accumulator;
        }, {});
    }, [filteredLogs]);

    const groupedOrder = useMemo(() => Object.keys(groupedLogs), [groupedLogs]);

    const handleSwipeCall = useCallback((log) => {
        if (!user?.id) return;

        const isOutgoing = log.caller_id === user.id;
        const targetId = isOutgoing ? log.receiver_id : log.caller_id;
        if (!targetId) return;

        const targetName = isOutgoing ? log.receiver_name : log.caller_name;
        const targetAvatar = isOutgoing ? log.receiver_avatar : log.caller_avatar;
        const callType = log.call_type === 'video' ? 'video' : 'voice';

        const params = new URLSearchParams({
            startCall: callType,
            to: String(targetId),
            name: targetName || 'Contact',
            avatar: targetAvatar || ''
        });

        navigate(`/home?${params.toString()}`);
    }, [navigate, user?.id]);

    

    const renderCallMeta = (log) => {
        const isOutgoing = log.caller_id === user.id;
        if (log.status === 'missed' || log.status === 'rejected') {
            return {
                label: 'Missed',
                icon: <PhoneMissed size={13} className="text-rose-300" />,
                textClass: 'text-rose-300'
            };
        }

        if (isOutgoing) {
            return {
                label: 'Outgoing',
                icon: <PhoneOutgoing size={13} className="text-white/60" />,
                textClass: 'text-white/60'
            };
        }

        return {
            label: 'Incoming',
            icon: <PhoneIncoming size={13} className="text-white/60" />,
            textClass: 'text-white/60'
        };
    };

    return (
        <div className="min-h-screen bg-linear-to-b from-[#8f6a5d] via-[#2b2224] to-black text-slate-100 transition-colors duration-500">
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-[#d8a087]/10 rounded-full blur-[150px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#503236]/20 rounded-full blur-[150px]" />
            </div>

            <div className="relative max-w-md mx-auto px-5 pt-6 pb-28 min-h-dvh">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-4xl font-bold text-white tracking-tight">Calls</h1>
                        
                    </div>
                    <button
                        onClick={() => setShowSearch((prev) => !prev)}
                        className="w-12 h-12 rounded-full border border-white/20 bg-black/30 backdrop-blur-xl text-white/80 flex items-center justify-center hover:bg-black/45"
                        title="Search calls"
                    >
                        <Search size={20} />
                    </button>
                </div>

                {showSearch && (
                    <div className="mt-4">
                        <input
                            type="text"
                            placeholder="Search calls"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-2xl bg-black/40 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-hidden focus:border-white/25"
                        />
                    </div>
                )}

                <div className="mt-5 flex items-center gap-2">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${activeTab === tab.id
                                ? 'bg-black/80 text-white shadow-lg border border-white/15'
                                : 'bg-black/25 text-white/70 border border-white/10'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="mt-5 space-y-6">
                    {loading ? (
                        <div className="py-16 flex justify-center">
                            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                            {error}
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-white/60">
                            No call logs found.
                        </div>
                    ) : (
                        groupedOrder.map((dayLabel) => (
                            <section key={dayLabel} className="space-y-3">
                                <h3 className="text-sm text-white/55">{dayLabel}</h3>
                                <div className="space-y-2">
                                    {groupedLogs[dayLabel].map((log) => {
                                        const isOutgoing = log.caller_id === user.id;
                                        const otherName = isOutgoing ? log.receiver_name : log.caller_name;
                                        const otherAvatar = isOutgoing ? log.receiver_avatar : log.caller_avatar;
                                        const meta = renderCallMeta(log);

                                        return (
                                            <SwipeToCallRow key={log.id} onSwipeCall={() => handleSwipeCall(log)}>
                                                <div className="flex items-center gap-3 px-1 py-1.5">
                                                <div className="w-13 h-13 rounded-full overflow-hidden shrink-0 bg-black/40 border border-white/10 flex items-center justify-center">
                                                    {otherAvatar ? (
                                                        <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-base font-semibold text-white/80">{String(otherName || '?').charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-base truncate ${meta.label === 'Missed' ? 'text-rose-300' : 'text-white'}`}>{otherName}</p>
                                                    <div className={`mt-0.5 flex items-center gap-1.5 text-xs ${meta.textClass}`}>
                                                        {meta.icon}
                                                        <span>{meta.label}</span>
                                                        {log.call_type === 'video' && <Video size={12} className="text-white/45" />}
                                                    </div>
                                                </div>
                                                <span className="text-sm text-white/55">{formatTime(log.created_at)}</span>
                                            </div>
                                            </SwipeToCallRow>
                                        );
                                    })}
                                </div>
                            </section>
                        ))
                    )}
                </div>
            </div>

            <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-20 w-[290px] rounded-full border border-white/15 bg-black/65 backdrop-blur-xl px-3 py-2">
                <div className="grid grid-cols-3 items-center">
                    <button onClick={() => navigate('/home')} className="flex justify-center text-white/70 hover:text-white">
                        <Home size={18} />
                    </button>
                    <button className="mx-auto flex items-center gap-2 rounded-full bg-black/80 border border-white/20 px-4 py-2 text-white shadow-lg">
                        <Phone size={14} />
                        <span className="text-xs font-semibold">Calls</span>
                    </button>
                    <button onClick={() => navigate('/profile')} className="flex justify-center text-white/70 hover:text-white">
                        <User size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CallLogs;
