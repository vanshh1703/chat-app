import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, User, Zap, MessageSquare, AlertCircle, Loader2, Trophy, ArrowLeft, ShieldCheck } from 'lucide-react';
import { io } from 'socket.io-client';
import * as api from '../api/api';

const DebateRoom = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [user] = useState(JSON.parse(localStorage.getItem('profile'))?.user);
    const [debate, setDebate] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const socket = useRef();
    const scrollRef = useRef();

    useEffect(() => {
        const fetchDebateData = async () => {
            try {
                const { data: debateData } = await api.getDebate(id);
                setDebate(debateData);
                const { data: msgData } = await api.getDebateMessages(id);
                setMessages(msgData);
            } catch (err) {
                console.error('Failed to fetch debate data:', err);
                navigate('/home');
            } finally {
                setLoading(false);
            }
        };

        fetchDebateData();

        socket.current = io('http://localhost:5000');
        socket.current.emit('join', user.id);

        socket.current.on('debate_message', (data) => {
            if (String(data.debateId) === String(id)) {
                setMessages(prev => [...prev, { ...data, created_at: new Date() }]);
            }
        });

        socket.current.on('debate_round_end', (data) => {
            if (String(data.debateId) === String(id)) {
                // Refresh debate to get new status if needed, though status changes in rounds
                // For now, round changes are driven by messages
            }
        });

        socket.current.on('debate_status', (data) => {
            if (String(data.debateId) === String(id)) {
                setDebate(prev => ({ ...prev, status: data.status }));
            }
        });

        socket.current.on('debate_finished', (data) => {
            if (String(data.debateId) === String(id)) {
                setDebate(prev => ({ 
                    ...prev, 
                    status: 'finished', 
                    winner_id: data.winner_id,
                    score_user1: data.score_user1,
                    score_user2: data.score_user2,
                    ratingChange1: data.ratingChange1,
                    ratingChange2: data.ratingChange2,
                    explanation: data.explanation
                }));
            }
        });

        return () => socket.current.disconnect();
    }, [id, user.id, navigate]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const getCurrentRound = () => {
        // Round 1: 0-1 messages
        // Round 2: 2-3 messages
        // Round 3: 4-5 messages
        const count = messages.length;
        if (count < 2) return 1;
        if (count < 4) return 2;
        if (count < 6) return 3;
        return 4; // Finished
    };

    const hasSentCurrentRoundMsg = () => {
        const round = getCurrentRound();
        return messages.some(m => m.user_id === user.id && m.round_number === round);
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        const round = getCurrentRound();
        if (messageText.length < 20 || hasSentCurrentRoundMsg() || round > 3) return;

        setSending(true);
        const data = {
            debateId: id,
            userId: user.id,
            message: messageText,
            roundNumber: round
        };

        socket.current.emit('debate_message', data);
        setMessageText('');
        setSending(false);
    };

    const getRoundName = (round) => {
        if (round === 1) return "Opening Argument";
        if (round === 2) return "Counter Argument";
        if (round === 3) return "Final Statement";
        return "Debate Finished";
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f172a]">
                <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
        );
    }

    const currentRound = getCurrentRound();
    const canSend = messageText.length >= 20 && !hasSentCurrentRoundMsg() && currentRound <= 3;

    return (
        <div className="flex flex-col h-screen bg-[#f8fafc] dark:bg-[#0f172a] font-sans">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 p-4 shadow-sm z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/home')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                            <ArrowLeft size={20} className="text-gray-500" />
                        </button>
                        <div>
                            <h2 className="font-black text-gray-800 dark:text-white uppercase tracking-tighter text-lg">Debate Arena</h2>
                            <p className="text-xs font-bold text-blue-500 uppercase tracking-widest">{debate.topic}</p>
                        </div>
                    </div>
                    {debate.status === 'finished' && (
                        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                            <Trophy size={18} className="text-emerald-500" />
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                {debate.winner_id ? 'Victor Declared' : 'Draw'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Rounds Progress */}
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 p-3 overflow-x-auto">
                <div className="max-w-4xl mx-auto flex items-center justify-between px-4 min-w-[300px]">
                    {[1, 2, 3].map(r => (
                        <div key={r} className={`flex items-center gap-2 ${currentRound === r ? 'opacity-100' : 'opacity-40'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${currentRound >= r ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                {r}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">{getRoundName(r)}</span>
                        </div>
                    ))}
                    <div className={`flex items-center gap-2 ${currentRound > 3 ? 'opacity-100' : 'opacity-40'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${currentRound > 3 ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                            <ShieldCheck size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Verdict</span>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-linear-to-b from-transparent to-gray-50/50 dark:to-slate-900/30">
                <div className="max-w-3xl mx-auto space-y-8">
                    {messages.map((msg, idx) => {
                        const isMe = msg.user_id === user.id;
                        return (
                            <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        Round {msg.round_number} • {getRoundName(msg.round_number)}
                                    </span>
                                </div>
                                <div className={`relative px-6 py-4 rounded-[32px] shadow-sm max-w-[90%] ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-slate-700'}`}>
                                    <p className="text-sm md:text-base leading-relaxed font-medium">{msg.message}</p>
                                </div>
                            </div>
                        );
                    })}

                    {debate.status === 'evaluating' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="relative">
                                < Zap className="text-yellow-500 animate-pulse" size={48} />
                                <Loader2 className="absolute inset-0 animate-spin text-blue-500 opacity-50" size={48} />
                            </div>
                            <div className="text-center">
                                <h3 className="font-black text-gray-800 dark:text-white uppercase tracking-tighter text-xl">AI Judge is evaluating...</h3>
                                <p className="text-sm text-gray-500">Analyzing arguments, logic, and clarity</p>
                            </div>
                        </div>
                    )}

                    {debate.status === 'finished' && (
                        <div className="bg-white dark:bg-slate-800 rounded-[40px] p-8 md:p-12 border border-gray-100 dark:border-slate-700 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-12 opacity-5">
                                <ShieldCheck size={200} />
                            </div>
                            <div className="relative z-10 text-center space-y-8">
                                <div className="space-y-2">
                                    <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase mr-2">Official Verdict</h3>
                                    <div className="w-20 h-1.5 bg-blue-600 mx-auto rounded-full"></div>
                                </div>

                                <div className="flex items-center justify-around">
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Player 1</p>
                                        <div className="flex flex-col items-center">
                                            <div className="text-4xl font-black text-gray-900 dark:text-white mb-1">{debate.score_user1}/10</div>
                                            {debate.ratingChange1 !== undefined && (
                                                <div className={`text-sm font-black px-3 py-1 rounded-full ${debate.ratingChange1 >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                    {debate.ratingChange1 >= 0 ? '+' : ''}{debate.ratingChange1} Rating
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="text-gray-200 dark:text-slate-700 text-3xl font-light italic">VERDICT</div>
                                    
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Player 2</p>
                                        <div className="flex flex-col items-center">
                                            <div className="text-4xl font-black text-gray-900 dark:text-white mb-1">{debate.score_user2}/10</div>
                                            {debate.ratingChange2 !== undefined && (
                                                <div className={`text-sm font-black px-3 py-1 rounded-full ${debate.ratingChange2 >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                    {debate.ratingChange2 >= 0 ? '+' : ''}{debate.ratingChange2} Rating
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-gray-50 dark:bg-slate-900/50 rounded-3xl text-left border border-gray-100 dark:border-slate-800">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">AI Explanation</h4>
                                    <p className="text-sm text-gray-600 dark:text-slate-300 italic leading-relaxed">
                                        "{debate.explanation}"
                                    </p>
                                </div>

                                <button onClick={() => navigate('/home')} className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all active:scale-95 shadow-xl">
                                    Return to Lobby
                                </button>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </div>

            {/* Input Area */}
            {debate.status === 'active' && currentRound <= 3 && (
                <div className="p-4 md:p-6 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 z-10">
                    <div className="max-w-3xl mx-auto">
                        {hasSentCurrentRoundMsg() ? (
                            <div className="flex items-center justify-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                                <p className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                    <Loader2 className="animate-spin" size={16} />
                                    Waiting for opponent to finish Round {currentRound}...
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSendMessage} className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                        {getRoundName(currentRound)}
                                    </span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${messageText.length < 20 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {messageText.length} / 20 min chars
                                    </span>
                                </div>
                                <div className="relative group">
                                    <textarea
                                        autoFocus
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 rounded-[28px] outline-hidden focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-700 dark:text-white font-medium transition-all resize-none h-32"
                                        placeholder="Enter your argument here..."
                                    />
                                    <button
                                        type="submit"
                                        disabled={!canSend || sending}
                                        className={`absolute bottom-4 right-4 p-3 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 ${canSend ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebateRoom;
