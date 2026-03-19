import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, ChevronUp, ChevronDown, Maximize2, Minimize2, Monitor, RefreshCw } from 'lucide-react';

const IncomingCallBar = ({ name, avatar, subtitle, onAccept, onReject }) => (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-black rounded-full flex items-center px-4 py-2 shadow-xl min-w-[260px] max-w-xs">
        <img src={avatar} alt={name} className="w-10 h-10 rounded-full border-2 border-white mr-3" />
        <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm truncate">{name}</div>
            <div className="text-xs text-gray-300 truncate">{subtitle}</div>
        </div>
        <button onClick={onReject} className="ml-3 bg-rose-500 hover:bg-rose-600 rounded-full p-2 text-white">
            <PhoneOff size={18} />
        </button>
        <button onClick={onAccept} className="ml-2 bg-emerald-500 hover:bg-emerald-600 rounded-full p-2 text-white">
            <Phone size={18} />
        </button>
    </div>
);

const FullScreenIncomingCall = ({ name, avatar, subtitle, onAccept, onReject }) => (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-slate-900/80 to-slate-800/90">
        <div className="w-full flex flex-col items-center pt-12">
            <img src={avatar} alt={name} className="w-16 h-16 rounded-full border-2 border-white shadow-lg mb-2" />
            <div className="font-bold text-white text-lg text-center">{name}</div>
            <div className="text-xs text-gray-300 text-center">{subtitle}</div>
        </div>
        <div className="flex flex-col items-center w-full mb-12">
            <div className="flex justify-center gap-16">
                <button onClick={onReject} className="flex flex-col items-center">
                    <span className="bg-rose-500 hover:bg-rose-600 rounded-full p-5 mb-2 shadow-lg">
                        <PhoneOff size={28} className="text-white" />
                    </span>
                    <span className="text-xs text-white font-bold">Decline</span>
                </button>
                <button onClick={onAccept} className="flex flex-col items-center">
                    <span className="bg-emerald-500 hover:bg-emerald-600 rounded-full p-5 mb-2 shadow-lg">
                        <Phone size={28} className="text-white" />
                    </span>
                    <span className="text-xs text-white font-bold">Accept</span>
                </button>
            </div>
        </div>
    </div>
);

const CallUI = ({
    onAccept,
    onReject,
    onEnd,
    incomingCall,
    activeCall,
    localStream,
    remoteStream,
    isAudioOnly,
    onToggleVideo,
    isSharingScreen,
    onToggleScreenShare,
    onSwitchCamera,
}) => {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isMinimized, setIsMinimized] = useState(true);
    const [isSwapped, setIsSwapped] = useState(false);
    const [incomingExpanded, setIncomingExpanded] = useState(false);

    const callDisplayName = incomingCall?.name || activeCall?.username || 'Caller';
    const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(callDisplayName)}`;
    const callAvatar = incomingCall?.avatar || activeCall?.avatar || fallbackAvatar;

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, activeCall]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, activeCall]);

    useEffect(() => {
        if (!localStream) {
            setIsVideoOff(false);
            return;
        }

        const firstVideoTrack = localStream.getVideoTracks()[0];
        if (!firstVideoTrack) {
            setIsVideoOff(true);
            return;
        }

        setIsVideoOff(!firstVideoTrack.enabled);
    }, [localStream]);

    useEffect(() => {
        let timer;
        if (activeCall) {
            timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
        } else {
            setCallDuration(0);
        }
        return () => clearInterval(timer);
    }, [activeCall]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const toggleMute = () => {
        if (!localStream) return;
        localStream.getAudioTracks().forEach((track) => {
            track.enabled = !track.enabled;
        });
        setIsMuted((prev) => !prev);
    };

    const toggleVideo = async () => {
        if (onToggleVideo) {
            const isVideoEnabled = await onToggleVideo();
            setIsVideoOff(!isVideoEnabled);
            return;
        }

        if (!localStream) return;
        const tracks = localStream.getVideoTracks();
        if (tracks.length > 0) {
            const nextEnabled = !tracks[0].enabled;
            tracks.forEach((track) => {
                track.enabled = nextEnabled;
            });
            setIsVideoOff(!nextEnabled);
        }
    };

    if (incomingCall && !activeCall) {
        const isCaller = incomingCall.isCaller;

        if (!isCaller) {
            if (incomingExpanded) {
                return (
                    <FullScreenIncomingCall
                        name={callDisplayName}
                        avatar={callAvatar}
                        subtitle={incomingCall.subtitle || 'powered by ringer'}
                        onAccept={onAccept}
                        onReject={onReject}
                    />
                );
            }

            return (
                <div onClick={() => setIncomingExpanded(true)}>
                    <IncomingCallBar
                        name={callDisplayName}
                        avatar={callAvatar}
                        subtitle={incomingCall.subtitle || 'powered by ringer'}
                        onAccept={onAccept}
                        onReject={onReject}
                    />
                </div>
            );
        }

        return (
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] w-[340px] max-w-[92vw] rounded-[30px] border border-white/10 bg-gradient-to-b from-slate-900/95 to-black/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.55)] p-6 animate-in slide-in-from-top duration-500">
                <div className="flex flex-col items-center text-center">
                    <div className="relative mb-4">
                        <div className="absolute inset-0 rounded-full border border-fuchsia-400/20 animate-pulse scale-125" />
                        <div className="absolute inset-0 rounded-full border border-blue-300/20 animate-pulse scale-150" />
                        <div className="relative w-20 h-20 rounded-full overflow-hidden border border-white/20 ring-4 ring-white/5 shadow-xl">
                            <img
                                src={callAvatar}
                                alt={callDisplayName}
                                className="w-full h-full object-cover"
                                width="80"
                                height="80"
                                loading="lazy"
                            />
                        </div>
                        <div className="absolute -bottom-1 -right-1 p-2 bg-white/10 border border-white/20 rounded-full text-white backdrop-blur-xl">
                            {incomingCall.type === 'video' ? <Video size={14} /> : <Phone size={14} />}
                        </div>
                    </div>

                    <h3 className="text-[29px] leading-none font-semibold tracking-tight text-white">{callDisplayName}</h3>
                    <p className="mt-2 text-[12px] font-semibold text-slate-300 uppercase tracking-[0.16em]">
                        Calling {callDisplayName}...
                    </p>

                    <button
                        onClick={onEnd}
                        className="w-full mt-6 py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-semibold tracking-[0.12em] uppercase transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(244,63,94,0.35)]"
                    >
                        <PhoneOff size={16} /> Hang Up
                    </button>
                </div>
            </div>
        );
    }

    if (activeCall) {
        if (isMinimized) {
            return (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] cursor-pointer" onClick={() => setIsMinimized(false)}>
                    <div className="bg-slate-900/95 dark:bg-black/95 backdrop-blur-2xl border border-white/10 px-4 py-2.5 rounded-[32px] shadow-2xl flex items-center gap-4 transition-all duration-500 hover:scale-105 group ring-1 ring-white/10">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full border-2 border-green-500/50 overflow-hidden shadow-inner">
                                <img src={callAvatar} alt="Call" className="w-full h-full object-cover" width="96" height="96" loading="lazy" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                                {isAudioOnly ? 'Voice Call' : 'Video Call'}
                            </span>
                            <div className="flex items-center gap-2">
                                <h4 className="text-white font-bold text-sm tracking-tight">{callDisplayName}</h4>
                                <span className="w-1 h-1 bg-white/20 rounded-full" />
                                <span className="text-green-400 font-mono text-xs font-bold">{formatTime(callDuration)}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 ml-2 pl-4 border-l border-white/10">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleMute();
                                }}
                                className={`p-2 rounded-full transition-all ${isMuted ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            >
                                {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleVideo();
                                }}
                                className={`p-2 rounded-full transition-all ${isVideoOff ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            >
                                {isVideoOff ? <VideoOff size={14} /> : <Video size={14} />}
                            </button>
                            {!isAudioOnly && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSwitchCamera?.();
                                    }}
                                    className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all"
                                    title="Flip Camera"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEnd();
                                }}
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
            <div className={`fixed inset-0 z-[1000] bg-slate-950 flex items-center justify-center transition-all duration-500 ${isMaximized ? 'p-0' : 'p-4 md:p-8'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-indigo-900/20 pointer-events-none" />
                <div className={`relative w-full h-full max-w-5xl aspect-video bg-black overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center group ${isMaximized ? 'rounded-none border-none' : 'rounded-[40px]'}`}>
                    <div className="w-full h-full relative" onClick={() => !isAudioOnly && setIsSwapped((prev) => !prev)}>
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
                                <p className="text-slate-400 font-black uppercase tracking-[0.2em]">Connecting…</p>
                            </div>
                        )}
                    </div>

                    {!isAudioOnly && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsSwapped((prev) => !prev);
                            }}
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

                    <button
                        onClick={() => setIsMinimized(true)}
                        className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 bg-black/30 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 -translate-y-4 group-hover:translate-y-0 transition-transform hover:bg-black/50 text-white/70 hover:text-white"
                        title="Minimize Call"
                    >
                        <ChevronUp size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Minimize</span>
                    </button>

                    <div className="absolute top-8 left-8 flex items-center gap-4 z-10 bg-black/30 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
                        <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
                        <span className="text-white font-black text-sm tracking-widest">{formatTime(callDuration)}</span>
                    </div>

                    <button
                        onClick={() => setIsMaximized((prev) => !prev)}
                        className="absolute bottom-8 right-8 p-3 bg-black/30 backdrop-blur-md text-white/70 hover:text-white rounded-full border border-white/10 transition-all hover:scale-110 z-10"
                    >
                        {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                    </button>

                    <div className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-3 md:gap-6 px-6 md:px-10 py-4 md:py-6 bg-black/60 rounded-[32px] md:rounded-[40px] border border-white/10 shadow-2xl transition-all duration-500 z-20 opacity-100 translate-y-0 md:opacity-0 md:group-hover:opacity-100 md:translate-y-12 md:group-hover:translate-y-0 ${isMaximized ? 'bottom-16' : 'bottom-8'}`}>
                        <button
                            onClick={toggleMute}
                            className={`p-4 md:p-5 rounded-full transition-all hover:scale-110 active:scale-90 ${isMuted ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                        </button>

                        <button
                            onClick={toggleVideo}
                            className={`p-4 md:p-5 rounded-full transition-all hover:scale-110 active:scale-90 ${isVideoOff ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                        </button>

                        {!isAudioOnly && (
                            <>
                                <button
                                    onClick={onSwitchCamera}
                                    className="p-4 md:p-5 bg-white/10 text-white rounded-full transition-all hover:scale-110 active:scale-90 hover:bg-white/20"
                                    title="Flip Camera"
                                >
                                    <RefreshCw size={24} />
                                </button>
                                <button
                                    onClick={onToggleScreenShare}
                                    className={`p-4 md:p-5 rounded-full transition-all hover:scale-110 active:scale-90 ${isSharingScreen ? 'bg-blue-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                    title={isSharingScreen ? 'Stop Sharing' : 'Share Screen'}
                                >
                                    <Monitor size={24} />
                                </button>
                            </>
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
