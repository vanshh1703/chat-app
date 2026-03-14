import React, { useState, useEffect, useRef } from 'react';
import { X, Wifi, Smartphone, Scan, QrCode, ArrowRight, ArrowLeft, MessageSquare, Send } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

const OfflineChatManager = ({ isOpen, onClose, currentUser }) => {
    const [mode, setMode] = useState(null); // 'host', 'join', 'chat'
    const [step, setStep] = useState(1);
    
    // WebRTC State
    const peerConnection = useRef(null);
    const dataChannel = useRef(null);
    const [connectionState, setConnectionState] = useState('disconnected'); // disconnected, connecting, connected
    
    // Signaling State
    const [localOffer, setLocalOffer] = useState(null);
    const [remoteAnswer, setRemoteAnswer] = useState(null);
    const scannerRef = useRef(null);
    const [scannerError, setScannerError] = useState(null);

    // Chat State
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState('');
    const messagesEndRef = useRef(null);

    // Initialize WebRTC
    const initWebRTC = (currentMode) => {
        const pc = new RTCPeerConnection({
            iceServers: [] // No STUN/TURN, entirely local LAN/Hotspot
        });
        
        pc.onicecandidate = (event) => {
            // Wait for candidate gathering to finalize before using the SDP
            if (event.candidate === null) {
                const sdp = JSON.stringify(pc.localDescription);
                if (currentMode === 'host') {
                    setLocalOffer(sdp);
                } else if (currentMode === 'join') {
                    setLocalOffer(sdp);
                }
            }
        };

        pc.onicegatheringstatechange = () => {
             // Fallback: If gathering completes but fires no null candidate
             if (pc.iceGatheringState === 'complete') {
                 const sdp = JSON.stringify(pc.localDescription);
                 if (currentMode === 'host') setLocalOffer(prev => prev || sdp);
                 if (currentMode === 'join') setLocalOffer(prev => prev || sdp);
             }
        };

        pc.onconnectionstatechange = () => {
            setConnectionState(pc.connectionState);
            if (pc.connectionState === 'connected') {
                setMode('chat');
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                alert("Offline connection lost.");
                handleReset();
            }
        };

        peerConnection.current = pc;
    };

    const setupDataChannel = (channel) => {
        channel.onopen = () => console.log("Data channel opened");
        channel.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                setMessages(prev => [...prev, msg]);
            } catch (e) {
                console.error("Failed to parse message", e);
            }
        };
        dataChannel.current = channel;
    };

    // Host Flow
    const handleStartHost = async () => {
        setMode('host');
        setStep(1);
        initWebRTC('host');
        
        // Host creates the data channel before creating offer
        const channel = peerConnection.current.createDataChannel('offline-chat');
        setupDataChannel(channel);

        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        // ICE gathering starts here. onicecandidate will fire.
    };

    // Join Flow
    const handleStartJoin = () => {
        setMode('join');
        setStep(1);
        initWebRTC('join');
        
        // Joiner waits for data channel from host
        peerConnection.current.ondatachannel = (event) => {
            setupDataChannel(event.channel);
        };
    };

    // Scanner Initialization
    useEffect(() => {
        let scanner = null;
        
        const startScanner = async () => {
            if ((mode === 'host' && step === 2) || (mode === 'join' && step === 1)) {
                try {
                    // Small delay to ensure the DOM element "reader" is painted
                    await new Promise(res => setTimeout(res, 100));
                    
                    if (!document.getElementById('reader')) return;

                    scanner = new Html5Qrcode("reader");
                    scannerRef.current = scanner;

                    await scanner.start(
                        { facingMode: "environment" },
                        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                        async (decodedText) => {
                            if (scannerRef.current) {
                                await scannerRef.current.stop();
                                scannerRef.current.clear();
                                scannerRef.current = null;
                            }
                            
                            try {
                                const sdp = JSON.parse(decodedText);
                                
                                if (mode === 'join' && step === 1) {
                                    // Joiner scanned Host's offer
                                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp));
                                    const answer = await peerConnection.current.createAnswer();
                                    await peerConnection.current.setLocalDescription(answer);
                                    setStep(2); // Move to showing answer QR
                                } else if (mode === 'host' && step === 2) {
                                    // Host scanned Joiner's answer
                                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp));
                                    // Connection should state change to connected
                                }
                            } catch (err) {
                                setScannerError("Invalid QR code scanned.");
                                setTimeout(() => setScannerError(null), 3000);
                            }
                        },
                        (err) => {
                            // Ignored: mostly just "QR code not found yet" errors per frame
                        }
                    );
                } catch (err) {
                    console.error("Camera access failed", err);
                    setScannerError("Camera access denied or unavailable.");
                }
            }
        };

        startScanner();

        return () => {
            if (scannerRef.current) {
                try {
                    const stopPromise = scannerRef.current.stop();
                    if (stopPromise && stopPromise.then) {
                        stopPromise.then(() => {
                            try { scannerRef.current.clear(); } catch(e) {}
                            scannerRef.current = null;
                        }).catch(e => {
                            try { scannerRef.current.clear(); } catch(err) {}
                            scannerRef.current = null;
                        });
                    } else {
                        try { scannerRef.current.clear(); } catch(e) {}
                        scannerRef.current = null;
                    }
                } catch(e) {
                    try { scannerRef.current.clear(); } catch(err) {}
                    scannerRef.current = null;
                }
            }
        };
    }, [mode, step]);

    // Compression utility for large SDPs in QR codes
    // WebRTC SDP strings can be large. Let's map it into a generic compact JSON
    const compressSDP = (sdpString) => {
        try {
            const parsed = JSON.parse(sdpString);
            // Just returning the raw string for now. If it's too big for QR, we'd need pako or lz-string
            return JSON.stringify({ type: parsed.type, sdp: parsed.sdp }); 
        } catch { return ''; }
    };

    const handleReset = () => {
        // Optimistically clear the UI state immediately so the screen doesn't freeze or go blank
        setMode(null);
        setStep(1);
        setLocalOffer(null);
        setRemoteAnswer(null);
        setConnectionState('disconnected');
        setMessages([]);

        // Then clean up the hardware/connections in the background
        if (scannerRef.current) {
            try {
                const stopPromise = scannerRef.current.stop();
                if (stopPromise && stopPromise.then) {
                    stopPromise.then(() => {
                        try { scannerRef.current.clear(); } catch(e) {}
                        scannerRef.current = null;
                    }).catch(e => {
                        try { scannerRef.current.clear(); } catch(err) {} 
                        scannerRef.current = null;
                    });
                } else {
                    try { scannerRef.current.clear(); } catch(e) {}
                    scannerRef.current = null;
                }
            } catch(e) {
                try { scannerRef.current.clear(); } catch(err) {}
                scannerRef.current = null;
            }
        }
        
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (dataChannel.current) {
            dataChannel.current = null;
        }
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!messageText.trim() || !dataChannel.current || dataChannel.current.readyState !== 'open') return;

        const msg = {
            id: Date.now(),
            senderId: currentUser.id,
            senderName: currentUser.username || "You",
            content: messageText,
            timestamp: new Date().toISOString()
        };

        try {
            dataChannel.current.send(JSON.stringify(msg));
            setMessages(prev => [...prev, msg]);
            setMessageText('');
        } catch (err) {
            console.error("Failed to send", err);
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-200 flex bg-white dark:bg-slate-900 flex-col animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={mode === null ? handleClose : handleReset} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-gray-500">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Wifi size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-800 dark:text-white">Offline Mesh Chat</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="relative flex h-2 w-2">
                                {connectionState === 'connected' ? (
                                    <><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></>
                                ) : (
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400"></span>
                                )}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {connectionState === 'connected' ? 'Connected via Direct Link' : 'Not Connected'}
                            </span>
                        </div>
                    </div>
                </div>
                <button onClick={handleClose} className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-600 dark:text-gray-300">
                    <X size={20} />
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto flex flex-col relative">
                
                {mode === null && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6 text-blue-500">
                            <Smartphone size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-2">No Internet? No Problem.</h3>
                        <p className="text-gray-500 dark:text-slate-400 max-w-sm mb-8">
                            Connect your phones to the same Wi-Fi router, or turn on your mobile hotspot and have your friend connect to it. Then, select a role below.
                        </p>

                        <div className="flex flex-col gap-4 w-full max-w-sm">
                            <button onClick={handleStartHost} className="flex items-center justify-between w-full p-5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl transition-all group">
                                <div className="flex items-center gap-4 text-left">
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl group-hover:scale-110 transition-transform"><QrCode size={24} /></div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 dark:text-white">Host a Chat</h4>
                                        <p className="text-xs text-gray-500">Generate a QR code to invite</p>
                                    </div>
                                </div>
                                <ArrowRight className="text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                            </button>

                            <button onClick={handleStartJoin} className="flex items-center justify-between w-full p-5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl transition-all group">
                                <div className="flex items-center gap-4 text-left">
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform"><Scan size={24} /></div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 dark:text-white">Join a Chat</h4>
                                        <p className="text-xs text-gray-500">Scan a friend's QR code</p>
                                    </div>
                                </div>
                                <ArrowRight className="text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Host Mode UI */}
                {mode === 'host' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto w-full">
                        {step === 1 ? (
                            <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                <h3 className="text-xl font-black text-gray-800 dark:text-white mb-2">Step 1: Share Offer</h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">Ask your friend to select <b>Join</b> and scan this code.</p>
                                
                                {localOffer ? (
                                    <div className="p-4 bg-white rounded-3xl shadow-xl mb-8 border-4 border-slate-100">
                                        <QRCodeSVG value={compressSDP(localOffer)} size={240} />
                                    </div>
                                ) : (
                                    <div className="w-[240px] h-[240px] flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-3xl mb-8 border border-gray-200 animate-pulse">
                                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="mt-4 text-xs font-bold text-gray-400">Generating Keys...</p>
                                    </div>
                                )}
                                
                                <button onClick={() => setStep(2)} disabled={!localOffer} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-colors disabled:opacity-50 shadow-md">
                                    Next: Scan their Answer
                                </button>
                            </div>
                        ) : step === 2 ? (
                            <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                <h3 className="text-xl font-black text-gray-800 dark:text-white mb-2">Step 2: Scan Answer</h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Scan the QR code shown on your friend's screen to connect.</p>
                                
                                <div className="w-full rounded-3xl overflow-hidden bg-black aspect-square shadow-xl mb-6 relative border-4 border-slate-200">
                                    <div id="reader" className="w-full h-full"></div>
                                    {scannerError && <div className="absolute top-4 left-4 right-4 bg-rose-500 text-white text-xs font-bold px-4 py-2 rounded-lg text-center">{scannerError}</div>}
                                </div>
                                <button onClick={handleReset} className="mt-4 text-sm text-gray-500 font-bold hover:text-gray-800">Cancel</button>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Join Mode UI */}
                {mode === 'join' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto w-full">
                        {step === 1 ? (
                            <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                <h3 className="text-xl font-black text-gray-800 dark:text-white mb-2">Step 1: Scan Offer</h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Scan the QR code shown on the host's screen.</p>
                                
                                <div className="w-full rounded-3xl overflow-hidden bg-black aspect-square shadow-xl mb-6 relative border-4 border-slate-200">
                                    <div id="reader" className="w-full h-full bg-black"></div>
                                    {scannerError && <div className="absolute top-4 left-4 right-4 bg-rose-500 text-white text-xs font-bold px-4 py-2 rounded-lg text-center">{scannerError}</div>}
                                </div>
                            </div>
                        ) : step === 2 ? (
                            <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                <h3 className="text-xl font-black text-gray-800 dark:text-white mb-2">Step 2: Share Answer</h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">Show this code to the host so they can scan it.</p>
                                
                                {localOffer ? (
                                    <div className="p-4 bg-white rounded-3xl shadow-xl mb-8 border-4 border-slate-100">
                                        <QRCodeSVG value={compressSDP(localOffer)} size={240} />
                                    </div>
                                ) : (
                                    <div className="w-[240px] h-[240px] flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-3xl mb-8 border border-gray-200 animate-pulse">
                                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="mt-4 text-xs font-bold text-gray-400">Generating Keys...</p>
                                    </div>
                                )}
                                
                                <p className="text-xs text-blue-500 font-bold animate-pulse">Waiting for host to scan...</p>
                                <button onClick={() => setStep(1)} className="mt-8 text-sm text-gray-500 font-bold hover:text-gray-800">Cancel</button>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Chat Mode UI */}
                {mode === 'chat' && (
                    <div className="flex-1 flex flex-col bg-[#f0f2f5] dark:bg-slate-900 absolute inset-0 z-20">
                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div className="flex justify-center mb-6">
                                <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                    Direct peer-to-peer connection established
                                </div>
                            </div>
                            
                            {messages.map((msg, i) => {
                                const isMine = msg.senderId === currentUser.id;
                                return (
                                    <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-sm ${isMine ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-white rounded-tl-sm'}`}>
                                            {!isMine && <p className="text-[10px] font-bold opacity-60 mb-0.5">{msg.senderName}</p>}
                                            <p className="text-sm">{msg.content}</p>
                                            <p className={`text-[9px] mt-1 text-right opacity-70`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                            <form onSubmit={sendMessage} className="flex gap-2 items-center bg-gray-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-gray-200 dark:border-slate-700">
                                <input 
                                    value={messageText} 
                                    onChange={e => setMessageText(e.target.value)} 
                                    placeholder="Type an offline message..." 
                                    className="flex-1 bg-transparent outline-none text-sm px-3 py-2 text-gray-800 dark:text-white" 
                                />
                                <button type="submit" disabled={!messageText.trim()} className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors">
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default OfflineChatManager;
