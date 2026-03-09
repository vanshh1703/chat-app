import React, { useState, useEffect } from 'react';
import { Phone, Video, PhoneMissed, PhoneIncoming, PhoneOutgoing, ArrowLeft, Clock, Calendar, MoreVertical } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../api/api';

const CallLogs = () => {
    const [callLogs, setCallLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user] = useState(JSON.parse(localStorage.getItem('profile'))?.user);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const { data } = await api.getCallHistory();
                setCallLogs(data);
            } catch (err) {
                console.error("Error fetching call logs:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const formatDuration = (seconds) => {
        if (!seconds) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const StatusIcon = ({ status, isOutgoing }) => {
        if (status === 'missed') return <PhoneMissed size={16} className="text-rose-500" />;
        if (status === 'rejected') return <PhoneOutgoing size={16} className="text-gray-400" />;
        if (isOutgoing) return <PhoneOutgoing size={16} className="text-emerald-500" />;
        return <PhoneIncoming size={16} className="text-blue-500" />;
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-6 mb-10">
                    <button
                        onClick={() => navigate('/home')}
                        className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight">Call History</h1>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Recent activities</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-20">
                        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                ) : callLogs.length === 0 ? (
                    <div className="flex flex-col items-center gap-6 py-20 bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Phone size={32} className="text-slate-400" />
                        </div>
                        <div className="text-center">
                            <h3 className="font-black text-xl">No calls yet</h3>
                            <p className="text-slate-500 mt-2">Your call history will appear here.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {callLogs.map((log) => {
                            const isOutgoing = log.caller_id === user.id;
                            const otherName = isOutgoing ? log.receiver_name : log.caller_name;
                            const otherAvatar = isOutgoing ? log.receiver_avatar : log.caller_avatar;

                            return (
                                <div
                                    key={log.id}
                                    className="group relative bg-white dark:bg-slate-900 p-5 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center gap-5"
                                >
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-2xl overflow-hidden ring-4 ring-slate-100 dark:ring-slate-800 transition-all group-hover:ring-blue-500/20">
                                            <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover" />
                                        </div>
                                        <div className={`absolute -bottom-1 -right-1 p-2 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${log.status === 'missed' ? 'bg-rose-500' : 'bg-white dark:bg-slate-800'}`}>
                                            <StatusIcon status={log.status} isOutgoing={isOutgoing} />
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-lg truncate group-hover:text-blue-500 transition-colors uppercase tracking-tight">{otherName}</h3>
                                        <div className="flex items-center gap-3 mt-1 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">
                                            <span className="flex items-center gap-1.5">
                                                <Calendar size={12} /> {formatDate(log.created_at)}
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                                            <span className="flex items-center gap-1.5">
                                                <Clock size={12} /> {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {log.status === 'ended' && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                                                    <span>{formatDuration(log.duration)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-emerald-500 hover:text-white transition-all active:scale-90">
                                            <Phone size={20} />
                                        </button>
                                        <button className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-blue-500 hover:text-white transition-all active:scale-90">
                                            <Video size={20} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CallLogs;
