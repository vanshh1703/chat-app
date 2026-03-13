import React, { useState, useEffect } from 'react';
import { Phone, Video, PhoneMissed, PhoneIncoming, PhoneOutgoing, ArrowLeft, Clock, Calendar, MoreVertical, Search, Filter, ChevronLeft, ChevronRight, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/api';

const CallLogs = () => {
    const [callLogs, setCallLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // all, missed, incoming, outgoing
    const [searchTerm, setSearchTerm] = useState('');
    const [user] = useState(JSON.parse(localStorage.getItem('profile'))?.user);
    const navigate = useNavigate();

    // Pagination states (simulated for UI)
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 7;

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

    const filteredLogs = callLogs.filter(log => {
        const isOutgoing = log.caller_id === user.id;
        const otherName = isOutgoing ? log.receiver_name : log.caller_name;

        const matchesTab =
            activeTab === 'all' ||
            (activeTab === 'missed' && log.status === 'missed') ||
            (activeTab === 'incoming' && log.receiver_id === user.id) ||
            (activeTab === 'outgoing' && log.caller_id === user.id);

        const matchesSearch = otherName?.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesTab && matchesSearch;
    });

    const paginatedLogs = filteredLogs.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

    const formatDuration = (seconds) => {
        if (!seconds) return '0s';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const StatusPill = ({ status, isOutgoing }) => {
        const config = {
            missed: {
                bg: 'bg-rose-500/10 dark:bg-rose-500/5',
                text: 'text-rose-600 dark:text-rose-400',
                border: 'border-rose-500/20',
                label: 'Missed',
                icon: <PhoneMissed size={12} />
            },
            rejected: {
                bg: 'bg-slate-500/10 dark:bg-slate-500/5',
                text: 'text-slate-600 dark:text-slate-400',
                border: 'border-slate-500/20',
                label: 'Rejected',
                icon: <ArrowLeft size={12} className="rotate-45" />
            },
            incoming: {
                bg: 'bg-emerald-500/10 dark:bg-emerald-500/5',
                text: 'text-emerald-600 dark:text-emerald-400',
                border: 'border-emerald-500/20',
                label: 'Incoming',
                icon: <PhoneIncoming size={12} />
            },
            outgoing: {
                bg: 'bg-blue-500/10 dark:bg-blue-500/5',
                text: 'text-blue-600 dark:text-blue-400',
                border: 'border-blue-500/20',
                label: 'Outgoing',
                icon: <PhoneOutgoing size={12} />
            }
        };

        let type = status;
        if (status !== 'missed' && status !== 'rejected') {
            type = isOutgoing ? 'outgoing' : 'incoming';
        }

        const { bg, text, border, label, icon } = config[type] || config.incoming;

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${bg} ${text} ${border}`}>
                {icon}
                {label}
            </span>
        );
    };

    const tabs = [
        { id: 'all', label: 'All Calls' },
        { id: 'incoming', label: 'Incoming' },
        { id: 'outgoing', label: 'Outgoing' },
        { id: 'missed', label: 'Missed' }
    ];

    return (
        <div className="min-h-screen bg-[#FDFDFF] dark:bg-[#020617] text-slate-900 dark:text-slate-100 transition-colors duration-500 selection:bg-blue-500/30">
            {/* Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-500/5 dark:bg-blue-500/10 rounded-full -[150px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full -[150px]" />
            </div>

            <div className="relative max-w-[1200px] mx-auto px-6 py-12 md:py-20">
                {/* Header: Search + Title + Tabs */}
                <div className="flex flex-col gap-10 mb-12">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                        {/* Search Bar */}
                        <div className="relative group flex-1 max-w-lg">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                <Search size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors duration-300" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by name or status..."
                                className="w-full bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-200 dark:border-slate-800 rounded-3xl py-4 pl-14 pr-6 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 placeholder:text-slate-400 placeholder:font-semibold"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Tabs Inspired by Screenshot */}
                        <div className="flex p-1.5 bg-slate-100/50 dark:bg-slate-900 shadow-inner rounded-3xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                                    className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === tab.id
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => navigate('/home')}
                                className="group p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-x-1 transition-all active:scale-95"
                            >
                                <ArrowLeft size={24} className="text-slate-600 dark:text-slate-400 group-hover:text-blue-500" />
                            </button>
                            <div>
                                <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-blue-600 to-indigo-600 dark:from-white dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent leading-tight lowercase first-letter:uppercase">
                                    History Dashboard
                                </h1>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dashboard Table Wrapper */}
                <div className="bg-white dark:bg-slate-900/40  border border-slate-200/60 dark:border-slate-800/60 rounded-[48px] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800/50">
                                    <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Contact</th>
                                    <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Type</th>
                                    <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                                    <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Duration</th>
                                    <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Timestamp</th>
                                    <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="py-32 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-12 h-12 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 animate-pulse">Scanning records...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-32 text-center px-12">
                                            <div className="flex flex-col items-center gap-8 max-w-sm mx-auto">
                                                <div className="w-24 h-24 rounded-[38px] bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-white dark:border-slate-700 shadow-xl">
                                                    <Hash size={32} className="text-slate-300 dark:text-slate-600" />
                                                </div>
                                                <div className="space-y-4">
                                                    <h3 className="text-2xl font-black tracking-tight">Zero Activity Found</h3>
                                                    <p className="text-sm font-medium text-slate-500 leading-relaxed uppercase tracking-tighter">
                                                        No call data matches your current search or filter. Try redefining your query.
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedLogs.map((log) => {
                                        const isOutgoing = log.caller_id === user.id;
                                        const otherName = isOutgoing ? log.receiver_name : log.caller_name;
                                        const otherAvatar = isOutgoing ? log.receiver_avatar : log.caller_avatar;
                                        const isMissed = log.status === 'missed';

                                        return (
                                            <tr key={log.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all duration-300 border-b border-slate-50/50 dark:border-slate-800/30 last:border-0">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-[18px] overflow-hidden ring-4 ring-slate-100/50 dark:ring-slate-800/50 group-hover:ring-blue-500/20 transition-all duration-500">
                                                            <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                        </div>
                                                        <span className="font-black text-sm uppercase tracking-tight group-hover:text-blue-500 transition-colors">{otherName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-xl border ${log.call_type === 'video' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                                                            {log.call_type === 'video' ? <Video size={16} /> : <Phone size={16} />}
                                                        </div>
                                                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{log.call_type}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <StatusPill status={log.status} isOutgoing={isOutgoing} />
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className="text-xs font-black tracking-widest text-slate-600 dark:text-slate-400">
                                                        {log.status === 'ended' ? formatDuration(log.duration) : '--'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[11px] font-black tracking-widest uppercase">{formatDate(log.created_at)}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{formatTime(log.created_at)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <div className="flex items-center justify-center gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all shadow-sm">
                                                            <Phone size={16} />
                                                        </button>
                                                        <button className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">
                                                            <Video size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer Styled like Reference */}
                    <div className="px-8 py-8 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-transparent flex flex-col sm:flex-row items-center justify-between gap-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Showing <span className="text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredLogs.length)}</span> of <span className="text-slate-900 dark:text-white">{filteredLogs.length}</span> calls
                        </p>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={16} /> Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CallLogs;
