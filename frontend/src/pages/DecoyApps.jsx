import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft, Settings, Shield, Bell, X,
    Camera, Battery, Wifi, Signal, RefreshCw,
    ChevronRight, Moon, Sun, Bluetooth,
    Volume2, Plane, Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────
// Shared status-bar header
// ─────────────────────────────────────────────
const DecoyHeader = ({ title, showBack = true }) => {
    const navigate = useNavigate();
    const [time, setTime] = useState('');

    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
            <div className="flex items-center gap-3">
                {showBack && (
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-500 hover:text-blue-600 active:scale-90 transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}
                <h1 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h1>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                <span className="font-semibold">{time}</span>
                <Signal size={13} />
                <Wifi size={13} />
                <span>85%</span>
                <Battery size={13} />
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Decoy Settings
// ─────────────────────────────────────────────
export const DecoySettings = () => {
    const [wifiOn, setWifiOn] = useState(true);
    const [btOn, setBtOn] = useState(true);
    const [darkOn, setDarkOn] = useState(false);
    const [airOn, setAirOn] = useState(false);
    const [dndOn, setDndOn] = useState(false);

    const Toggle = ({ value, onChange }) => (
        <button
            onClick={() => onChange(!value)}
            className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${value ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
            <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${value ? 'left-5' : 'left-0.5'}`}
            />
        </button>
    );

    const rows = [
        { icon: <Wifi size={18} />, color: 'bg-blue-500', label: 'Wi-Fi', sub: wifiOn ? 'Home_Network_5G' : 'Off', toggle: wifiOn, setToggle: setWifiOn },
        { icon: <Bluetooth size={18} />, color: 'bg-blue-400', label: 'Bluetooth', sub: btOn ? 'On' : 'Off', toggle: btOn, setToggle: setBtOn },
        { icon: <Plane size={18} />, color: 'bg-orange-400', label: 'Airplane Mode', sub: airOn ? 'On' : 'Off', toggle: airOn, setToggle: setAirOn },
        { icon: <Moon size={18} />, color: 'bg-indigo-500', label: 'Do Not Disturb', sub: dndOn ? 'On' : 'Off', toggle: dndOn, setToggle: setDndOn },
    ];

    const links = [
        { icon: <Bell size={18} />, color: 'bg-red-500', label: 'Notifications' },
        { icon: <Shield size={18} />, color: 'bg-gray-500', label: 'Privacy & Security' },
        { icon: <Lock size={18} />, color: 'bg-gray-600', label: 'Screen Time' },
        { icon: <Volume2 size={18} />, color: 'bg-pink-500', label: 'Sounds & Haptics' },
        { icon: <Sun size={18} />, color: 'bg-yellow-400', label: 'Display & Brightness' },
    ];

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-slate-950">
            <DecoyHeader title="Settings" showBack />
            <div className="p-4 space-y-4 pb-20">

                {/* Profile card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold shadow-inner">
                        J
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 dark:text-white">John Doe</p>
                        <p className="text-xs text-blue-500">Apple ID, iCloud & more</p>
                    </div>
                    <ChevronRight size={18} className="ml-auto text-gray-400" />
                </div>

                {/* Toggles */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm divide-y divide-gray-100 dark:divide-slate-800">
                    {rows.map(row => (
                        <div key={row.label} className="flex items-center gap-3 px-4 py-3">
                            <div className={`p-2 ${row.color} rounded-lg text-white`}>{row.icon}</div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{row.label}</p>
                                <p className="text-[10px] text-gray-400">{row.sub}</p>
                            </div>
                            <Toggle value={row.toggle} onChange={row.setToggle} />
                        </div>
                    ))}
                </div>

                {/* Link rows */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm divide-y divide-gray-100 dark:divide-slate-800">
                    {links.map(row => (
                        <div key={row.label} className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50 dark:active:bg-slate-800">
                            <div className={`p-2 ${row.color} rounded-lg text-white`}>{row.icon}</div>
                            <p className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">{row.label}</p>
                            <ChevronRight size={16} className="text-gray-400" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Decoy Calculator (fully working)
// ─────────────────────────────────────────────
export const DecoyCalculator = () => {
    const [display, setDisplay] = useState('0');
    const [stored, setStored] = useState(null);
    const [op, setOp] = useState(null);
    const [resetNext, setResetNext] = useState(false);

    const handleNum = (n) => {
        if (resetNext) { setDisplay(String(n)); setResetNext(false); return; }
        setDisplay(prev => prev === '0' ? String(n) : prev + n);
    };

    const handleDot = () => {
        if (resetNext) { setDisplay('0.'); setResetNext(false); return; }
        if (!display.includes('.')) setDisplay(prev => prev + '.');
    };

    const handleOp = (o) => {
        setStored(parseFloat(display));
        setOp(o);
        setResetNext(true);
    };

    const handleEq = () => {
        if (op === null || stored === null) return;
        const cur = parseFloat(display);
        let result;
        switch (op) {
            case '+': result = stored + cur; break;
            case '-': result = stored - cur; break;
            case '×': result = stored * cur; break;
            case '÷': result = cur !== 0 ? stored / cur : 'Error'; break;
            default: result = cur;
        }
        setDisplay(String(parseFloat(result.toFixed(10))));
        setStored(null); setOp(null); setResetNext(true);
    };

    const handleAC = () => { setDisplay('0'); setStored(null); setOp(null); setResetNext(false); };
    const handlePlusMinus = () => setDisplay(prev => String(parseFloat(prev) * -1));
    const handlePercent = () => setDisplay(prev => String(parseFloat(prev) / 100));

    const btn = (label, onPress, style) => (
        <button
            key={label}
            onPointerDown={onPress}
            className={`aspect-square rounded-full flex items-center justify-center text-2xl font-medium select-none active:opacity-70 transition-opacity ${style}`}
        >
            {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-black flex flex-col select-none">
            <div className="flex-1" />
            <div className="p-5 pb-8 space-y-3">
                {/* Display */}
                <div className="text-right pr-2 mb-2">
                    <span className={`text-white font-light ${display.length > 9 ? 'text-4xl' : 'text-6xl'}`}>
                        {display}
                    </span>
                </div>

                {/* Buttons */}
                <div className="grid grid-cols-4 gap-3">
                    {btn('AC', handleAC, 'bg-gray-400 text-black')}
                    {btn('+/-', handlePlusMinus, 'bg-gray-400 text-black')}
                    {btn('%', handlePercent, 'bg-gray-400 text-black')}
                    {btn('÷', () => handleOp('÷'), op === '÷' ? 'bg-white text-orange-500' : 'bg-orange-500 text-white')}

                    {['7','8','9'].map(n => btn(n, () => handleNum(n), 'bg-gray-800 text-white'))}
                    {btn('×', () => handleOp('×'), op === '×' ? 'bg-white text-orange-500' : 'bg-orange-500 text-white')}

                    {['4','5','6'].map(n => btn(n, () => handleNum(n), 'bg-gray-800 text-white'))}
                    {btn('-', () => handleOp('-'), op === '-' ? 'bg-white text-orange-500' : 'bg-orange-500 text-white')}

                    {['1','2','3'].map(n => btn(n, () => handleNum(n), 'bg-gray-800 text-white'))}
                    {btn('+', () => handleOp('+'), op === '+' ? 'bg-white text-orange-500' : 'bg-orange-500 text-white')}

                    {/* 0 spans 2 cols */}
                    <button
                        onPointerDown={() => handleNum('0')}
                        className="col-span-2 rounded-full bg-gray-800 text-white text-2xl font-medium flex items-center px-8 active:opacity-70 transition-opacity py-4"
                    >
                        0
                    </button>
                    {btn('.', handleDot, 'bg-gray-800 text-white')}
                    {btn('=', handleEq, 'bg-orange-500 text-white')}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Decoy Clock (live time)
// ─────────────────────────────────────────────
export const DecoyClock = () => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const zones = [
        { city: 'Cupertino',    offset: -7  },
        { city: 'New York',     offset: -4  },
        { city: 'London',       offset: +1  },
        { city: 'Dubai',        offset: +4  },
        { city: 'Tokyo',        offset: +9  },
        { city: 'Sydney',       offset: +10 },
    ];

    const localOffset = -now.getTimezoneOffset() / 60;

    const formatZone = (offset) => {
        const d = new Date(now.getTime() + (offset - localOffset) * 3600000);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const diffLabel = (offset) => {
        const diff = offset - localOffset;
        if (diff === 0) return 'Local';
        return diff > 0 ? `+${diff}HRS` : `${diff}HRS`;
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <DecoyHeader title="World Clock" showBack />
            <div className="flex-1 p-6 space-y-1">
                {zones.map(z => (
                    <div key={z.city} className="flex justify-between items-center border-b border-gray-800 py-4">
                        <div>
                            <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">{diffLabel(z.offset)}</p>
                            <h2 className="text-xl font-semibold">{z.city}</h2>
                        </div>
                        <div className="text-4xl font-light tabular-nums">{formatZone(z.offset)}</div>
                    </div>
                ))}
            </div>

            {/* Stopwatch teaser */}
            <div className="p-6 border-t border-gray-800">
                <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Stopwatch</p>
                <div className="text-5xl font-light text-center tabular-nums text-white">
                    {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Decoy Camera (UI-only – getUserMedia optional)
// ─────────────────────────────────────────────
export const DecoyCamera = () => {
    const videoRef = useRef(null);
    const [mode, setMode] = useState('Photo'); // Video | Photo | Portrait
    const [flash, setFlash] = useState(false);
    const [front, setFront] = useState(true);
    const [streaming, setStreaming] = useState(false);

    useEffect(() => {
        let stream;
        const start = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: front ? 'user' : 'environment' },
                    audio: false,
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setStreaming(true);
                }
            } catch {
                // Camera permission denied → show placeholder
                setStreaming(false);
            }
        };
        start();
        return () => { stream?.getTracks().forEach(t => t.stop()); };
    }, [front]);

    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-black relative flex flex-col overflow-hidden">
            {/* Viewfinder */}
            <div className="flex-1 relative bg-gray-950 flex items-center justify-center overflow-hidden">
                {streaming ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${front ? '-scale-x-100' : ''}`}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-3 text-gray-700">
                        <Camera size={64} />
                        <p className="text-xs uppercase tracking-widest">Camera unavailable</p>
                    </div>
                )}

                {/* Top bar */}
                <div className="absolute top-0 inset-x-0 flex justify-between items-center p-5 text-white">
                    <button onClick={() => navigate(-1)} className="active:opacity-70">
                        <X size={26} />
                    </button>
                    <div className="flex gap-5">
                        <button
                            onClick={() => setFlash(f => !f)}
                            className={`text-sm font-bold ${flash ? 'text-yellow-400' : 'text-white/80'}`}
                        >
                            {flash ? '⚡ ON' : '⚡ OFF'}
                        </button>
                        <p className="font-bold text-white/80">HDR</p>
                    </div>
                    <div className="w-6" />
                </div>

                {/* Grid overlay */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                        {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} className="border border-white/10" />
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom controls */}
            <div className="bg-black pb-10 pt-4 space-y-5">
                {/* Mode selector */}
                <div className="flex justify-center gap-8 text-xs font-bold uppercase tracking-widest">
                    {['Video', 'Photo', 'Portrait'].map(m => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`transition-colors ${m === mode ? 'text-yellow-400' : 'text-white/50'}`}
                        >
                            {m}
                        </button>
                    ))}
                </div>

                {/* Shutter row */}
                <div className="flex justify-between items-center px-8">
                    {/* Last photo thumbnail */}
                    <div className="w-12 h-12 rounded-xl bg-gray-800 border-2 border-white/20 overflow-hidden" />

                    {/* Shutter */}
                    <button className="w-20 h-20 rounded-full border-4 border-white p-1 active:scale-90 transition-transform">
                        <div className="w-full h-full rounded-full bg-white" />
                    </button>

                    {/* Flip camera */}
                    <button
                        onClick={() => setFront(f => !f)}
                        className="w-12 h-12 rounded-full bg-gray-800/80 flex items-center justify-center text-white active:scale-90 transition-transform"
                    >
                        <RefreshCw size={22} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Route config helper (add to your router)
// ─────────────────────────────────────────────
// <Route path="/decoy/calculator" element={<DecoyCalculator />} />
// <Route path="/decoy/clock"      element={<DecoyClock />} />
// <Route path="/decoy/camera"     element={<DecoyCamera />} />
// <Route path="/decoy/settings"   element={<DecoySettings />} />