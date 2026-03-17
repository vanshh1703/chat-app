import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X, Maximize2, Minimize2, ChevronUp, ChevronDown, Monitor, RefreshCw } from 'lucide-react';

const CallUI = ({
    onAccept,
    onReject,
    onEnd,
    incomingCall,
    activeCall,
    localStream,
    remoteStream,
    isAudioOnly,
    isSharingScreen,
    onToggleScreenShare,
    onSwitchCamera
}) => {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isMinimized, setIsMinimized] = useState(true);
    const [isSwapped, setIsSwapped] = useState(false); // Track PIP swap

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            console.log("Attaching local stream to video element");
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, activeCall]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            console.log("Attaching remote stream to video element");
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, activeCall]);

    useEffect(() => {
        let timer;
        if (activeCall) {
            timer = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            setCallDuration(0);
        }
        return () => clearInterval(timer);
    }, [activeCall]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    };

    // 1. Incoming/Outgoing Call Popup (Pre-active)
    if (incomingCall && !activeCall) {
        const isCaller = incomingCall.isCaller;

        return (
            <div className="fixed top-8 left-1/2 -translate-x-1/2 z-1000 w-[350px] bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-white/20 dark:border-slate-800 p-6 animate-in slide-in-from-top duration-500">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full border-4 border-blue-500/20 overflow-hidden ring-4 ring-blue-500/10 animate-pulse">
                            <img src={incomingCall.avatar} alt={incomingCall.name} className="w-full h-full object-cover" width="80" height="80" loading="lazy" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 p-2 bg-blue-500 rounded-full text-white shadow-lg">
                            {incomingCall.type === 'video' ? <Video size={16} /> : <Phone size={16} />}
                        </div>
                    </div>
                    <div>
                        <h3 className="font-black text-xl text-gray-900 dark:text-white">{incomingCall.name}</h3>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">
                            {isCaller ? `Calling ${incomingCall.name}...` : `Incoming ${incomingCall.type} call...`}
                        </p>
                    </div>

                    {isCaller ? (
                        <div className="w-full mt-2">
                            <button
                                onClick={onEnd}
                                className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                            >
                                <PhoneOff size={18} /> Hang up
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-4 w-full mt-2">
                            <button
                                onClick={onReject}
                                className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                            >
                                <PhoneOff size={18} /> Reject
                            </button>
                            <button
                                onClick={onAccept}
                                className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                                <Phone size={18} /> Accept
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 2. Active Call UI (Dynamic Island or Full Overlay)
    if (activeCall) {
        if (isMinimized) {
            // Dynamic Island Mode
            return (
                <div 
                    className="fixed top-6 left-1/2 -translate-x-1/2 z-1000 cursor-pointer"
                    onClick={() => setIsMinimized(false)}
                >
                    <div className="bg-slate-900/95 dark:bg-black/95 backdrop-blur-2xl border border-white/10 px-4 py-2.5 rounded-[32px] shadow-2xl flex items-center gap-4 transition-all duration-500 hover:scale-105 group ring-1 ring-white/10">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full border-2 border-green-500/50 overflow-hidden shadow-inner">
                                <img src={incomingCall?.avatar || activeCall.avatar} alt="Call" className="w-full h-full object-cover" width="96" height="96" loading="lazy" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                                {isAudioOnly ? 'Voice Call' : 'Video Call'}
                            </span>
                            <div className="flex items-center gap-2">
                                <h4 className="text-white font-bold text-sm tracking-tight">{incomingCall?.name || activeCall.username || 'Active Call'}</h4>
                                <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                                <span className="text-green-400 font-mono text-xs font-bold">{formatTime(callDuration)}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 ml-2 pl-4 border-l border-white/10">
                            {/* Mobile Controls in Minimized Mode */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                                className={`p-2 rounded-full transition-all ${isMuted ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            >
                                {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                            </button>
                            
                            {!isAudioOnly && (
                                <>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleVideo(); }}
                                        className={`p-2 rounded-full transition-all ${isVideoOff ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                    >
                                        {isVideoOff ? <VideoOff size={14} /> : <Video size={14} />}
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onSwitchCamera?.(); }}
                                        className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all"
                                        title="Flip Camera"
                                    >
                                        <RefreshCw size={14} />
                                    </button>
                                </>
                            )}

                            <button 
                                onClick={(e) => { e.stopPropagation(); onEnd(); }}
                                className="p-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition-all shadow-lg active:scale-90"
                            >
                                <PhoneOff size={16} />
                            </button>
                            <div className="hidden md:block p-2 text-white/40 group-hover:text-white/70 transition-colors">
                                <ChevronDown size={18} />
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={`fixed inset-0 z-1000 bg-slate-950 flex items-center justify-center transition-all duration-500 ${isMaximized ? 'p-0' : 'p-4 md:p-8'}`}>
                {/* Background Glow */}
                <div className="absolute inset-0 bg-linear-to-br from-blue-900/20 to-indigo-900/20 pointer-events-none"></div>

                <div className={`relative w-full h-full max-w-5xl aspect-video bg-black rounded-[40px] overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center group ${isMaximized ? 'rounded-none border-none' : ''}`}>
                    {/* Remote Video (Main) */}
                    <div className="w-full h-full relative" onClick={() => !isAudioOnly && setIsSwapped(!isSwapped)}>
                        {remoteStream ? (
                            <video
                                ref={isSwapped ? localVideoRef : remoteVideoRef}
                                autoPlay
                                playsInline
                                muted={isSwapped}
                                className={`w-full h-full object-cover ${isSwapped ? '-scale-x-100' : ''}`}
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-6">
                                <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center border-4 border-slate-700 animate-pulse">
                                    <Phone size={48} className="text-slate-600" />
                                </div>
                                <p className="text-slate-400 font-black uppercase tracking-[0.2em]">Connecting...</p>
                            </div>
                        )}
                    </div>

                    {/* Local Video (Preview/PIP) */}
                    {!isAudioOnly && (
                        <div 
                            onClick={(e) => { e.stopPropagation(); setIsSwapped(!isSwapped); }}
                            className="absolute top-8 right-8 w-32 md:w-56 aspect-video bg-slate-900 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 z-10 transition-transform cursor-pointer hover:scale-105 active:scale-95"
                        >
                            {isVideoOff && !isSwapped ? (
                                <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                    <VideoOff size={24} className="text-slate-600" />
                                </div>
                            ) : (
                                <video
                                    ref={isSwapped ? remoteVideoRef : localVideoRef}
                                    autoPlay
                                    muted={!isSwapped}
                                    playsInline
                                    className={`w-full h-full object-cover ${!isSwapped ? '-scale-x-100' : ''}`}
                                />
                            )}
                        </div>
                    )}

                    {/* Minimize Button */}
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 bg-black/30 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 group-hover:translate-y-0 -translate-y-4 transition-transform hover:bg-black/50 text-white/70 hover:text-white"
                        title="Minimize Call"
                    >
                        <ChevronUp size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Minimize</span>
                    </button>

                    {/* Header Info */}
                    <div className="absolute top-8 left-8 flex items-center gap-4 z-10 bg-black/30 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 transition-transform">
                        <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse"></div>
                        <span className="text-white font-black text-sm tracking-widest">{formatTime(callDuration)}</span>
                    </div>

                    {/* Toggle Maximize */}
                    <button
                        onClick={() => setIsMaximized(!isMaximized)}
                        className="absolute bottom-8 right-8 p-3 bg-black/30 backdrop-blur-md text-white/70 hover:text-white rounded-full border border-white/10 transition-all hover:scale-110 z-10"
                    >
                        {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                    </button>

                    {/* Bottom Controls */}
                    <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 md:gap-6 px-6 md:px-10 py-4 md:py-6 bg-black/60 rounded-[32px] md:rounded-[40px] border border-white/10 shadow-2xl transition-all duration-500 z-20 ${isMaximized ? 'bottom-16' : ''} md:opacity-0 md:group-hover:opacity-100 md:translate-y-12 md:group-hover:translate-y-0 opacity-100 translate-y-0`}>
                        <button
                            onClick={toggleMute}
                            className={`p-4 md:p-5 rounded-full transition-all hover:scale-110 active:scale-90 ${isMuted ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                        </button>

                        {!isAudioOnly && (
                            <>
                                <button
                                    onClick={toggleVideo}
                                    className={`p-4 md:p-5 rounded-full transition-all hover:scale-110 active:scale-90 ${isVideoOff ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                >
                                    {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                                </button>
                                
                                <button
                                    onClick={onSwitchCamera}
                                    className="p-4 md:p-5 bg-white/10 text-white rounded-full transition-all hover:scale-110 active:scale-90 hover:bg-white/20"
                                    title="Flip Camera"
                                >
                                    <RefreshCw size={24} />
                                </button>
                            </>
                        )}

                        {!isAudioOnly && (
                            <button
                                onClick={onToggleScreenShare}
                                className={`p-4 md:p-5 rounded-full transition-all hover:scale-110 active:scale-90 ${isSharingScreen ? 'bg-blue-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                title={isSharingScreen ? "Stop Sharing" : "Share Screen"}
                            >
                                <Monitor size={24} />
                            </button>
                        )}

                        <button
                            onClick={onEnd}
                            className="p-5 md:p-7 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition-all hover:scale-110 active:scale-90 shadow-2xl shadow-rose-500/40"
                        >
                            <PhoneOff size={32} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default CallUI;
