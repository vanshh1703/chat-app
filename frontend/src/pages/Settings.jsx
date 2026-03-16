import React, { useState, useEffect } from 'react';
import { ArrowLeft, Moon, Sun, Bell, Shield, User, LogOut, Image as ImageIcon, Check, Plus, Monitor, Smartphone, MapPin, Activity, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getLoginActivity } from '../api/api';

const Settings = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('profile'))?.user;
    const [themePreference, setThemePreference] = useState(localStorage.getItem('themePreference') || 'light');
    const [notifs, setNotifs] = useState(JSON.parse(localStorage.getItem('notifSettings') || '{"individual": true, "all": true, "sound": true}'));
    const [stealthNotifs, setStealthNotifs] = useState(JSON.parse(localStorage.getItem('stealthNotifSettings') || JSON.stringify({
        enabled: false,
        titleOption: 'Software Update Ready',
        customTitle: '',
        bodyOption: 'Default',
        customBody: '',
        leftTapApp: '/decoy/settings',
        senderVisibility: 'Hidden', // Hidden, Initials, Full
        sound: 'Default'
    })));
    const [chatWallpaper, setChatWallpaper] = useState('default');
    const [loginActivities, setLoginActivities] = useState([]);
    const [isLoadingActivities, setIsLoadingActivities] = useState(false);
    const fileInputRef = React.useRef(null);

    useEffect(() => {
        const fetchActivities = async () => {
            if (!user) return;
            setIsLoadingActivities(true);
            try {
                const { data } = await getLoginActivity();
                setLoginActivities(data);
            } catch (err) {
                console.error("Failed to fetch login activities", err);
            } finally {
                setIsLoadingActivities(false);
            }
        };
        fetchActivities();
    }, [user?.id]);

    useEffect(() => {
        if (user) {
            setChatWallpaper(localStorage.getItem(`chatWallpaper_${user.id}`) || 'default');
        }
    }, [user?.id]);

    useEffect(() => {
        const applyTheme = (theme) => {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else if (theme === 'light') {
                document.documentElement.classList.remove('dark');
            } else if (theme === 'system') {
                const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.toggle('dark', isDark);
            }
        };

        applyTheme(themePreference);
        localStorage.setItem('themePreference', themePreference);

        // Update legacy 'theme' for backward compatibility in other components if needed
        if (themePreference !== 'system') {
            localStorage.setItem('theme', themePreference);
        } else {
            localStorage.removeItem('theme'); // Let App.jsx handle system
        }

        if (user) {
            localStorage.setItem(`chatWallpaper_${user.id}`, chatWallpaper);
        }
    }, [user?.id, themePreference, chatWallpaper]);

    useEffect(() => {
        localStorage.setItem('notifSettings', JSON.stringify(notifs));
    }, [notifs]);

    useEffect(() => {
        localStorage.setItem('stealthNotifSettings', JSON.stringify(stealthNotifs));
    }, [stealthNotifs]);

    const handleToggleNotif = (key) => {
        setNotifs(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const sendTestNotification = () => {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            new Notification("Test Notification", {
                body: "This is a test to verify your notification settings are working!",
                icon: "/vite.svg"
            });
            if (notifs.sound) {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                audio.play().catch(e => console.error("Sound play failed", e));
            }
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    };

    const handleToggleStealth = (key) => {
        setStealthNotifs(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const stealthTitles = [
        "Software Update Ready",
        "Battery Optimization Tip",
        "Storage Cleanup Suggested",
        "System Maintenance Required",
        "Security Scan Complete",
        "Custom"
    ];

    const decoyApps = [
        { name: 'Settings', path: '/decoy/settings' },
        { name: 'Calculator', path: '/decoy/calc' },
        { name: 'Clock', path: '/decoy/clock' },
        { name: 'Camera', path: '/decoy/camera' }
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] transition-colors duration-300 font-sans">
            <div className="max-w-2xl mx-auto p-4 md:p-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/home')}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Settings</h1>
                </div>

                <div className="space-y-6">
                    {/* Appearance Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 font-sans">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400">
                                <Sun size={20} />
                            </div>
                            <h2 className="font-bold text-gray-800 dark:text-white">Appearance</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Theme Preference</p>
                                    <p className="text-xs text-gray-400 dark:text-slate-400">Choose how the app looks</p>
                                </div>
                                <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-xl">
                                    {['light', 'dark', 'system'].map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setThemePreference(t)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${themePreference === t
                                                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                                : 'text-gray-500 dark:text-slate-500 hover:text-gray-700'
                                                }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chat Wallpaper Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400">
                                <ImageIcon size={20} />
                            </div>
                            <h2 className="font-bold text-gray-800 dark:text-white">Chat Wallpaper</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { id: 'default', label: 'Default', bg: 'bg-gray-100 dark:bg-slate-700' },
                                    { id: 'gradient', label: 'Gradient', bg: 'bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500' },
                                    { id: 'stars', label: 'Stars', bg: 'bg-slate-900' },
                                ].map((wp) => (
                                    <button
                                        key={wp.id}
                                        onClick={() => setChatWallpaper(wp.id)}
                                        className={`group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${chatWallpaper === wp.id ? 'border-blue-500 scale-95 shadow-lg' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <div className={`w-full h-full ${wp.bg} flex items-center justify-center`}>
                                            <span className="text-[10px] font-bold text-white drop-shadow-md">{wp.label}</span>
                                        </div>
                                        {chatWallpaper === wp.id && (
                                            <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center text-blue-600">
                                                <div className="bg-white rounded-full p-1 shadow-md">
                                                    <Check size={12} strokeWidth={4} />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                ))}

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`group relative aspect-square rounded-2xl overflow-hidden border-2 border-dashed transition-all flex flex-col items-center justify-center gap-1 ${chatWallpaper.startsWith('data:')
                                        ? 'border-blue-500 scale-95 shadow-lg'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-800'
                                        }`}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        hidden
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => setChatWallpaper(reader.result);
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                    {chatWallpaper.startsWith('data:') ? (
                                        <img src={chatWallpaper} className="w-full h-full object-cover" alt="Custom" />
                                    ) : (
                                        <>
                                            <Plus size={20} className="text-slate-400 group-hover:text-blue-500" />
                                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500">Gallery</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            <p className="text-xs text-gray-400 dark:text-slate-400">Animated presets or choose a custom photo for your chat background.</p>
                        </div>
                    </div>

                    {/* Notifications Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-500 dark:text-purple-400">
                                <Bell size={20} />
                            </div>
                            <h2 className="font-bold text-gray-800 dark:text-white">Notifications</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Individual Chats</p>
                                    <p className="text-xs text-gray-400 dark:text-slate-400">Receive alerts for direct messages</p>
                                </div>
                                <button
                                    onClick={() => handleToggleNotif('individual')}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${notifs.individual ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifs.individual ? 'right-1' : 'left-1'}`}></div>
                                </button>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">All Notifications</p>
                                    <p className="text-xs text-gray-400 dark:text-slate-400">Enable or disable all browser alerts</p>
                                </div>
                                <button
                                    onClick={() => handleToggleNotif('all')}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${notifs.all ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifs.all ? 'right-1' : 'left-1'}`}></div>
                                </button>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Notification Sound</p>
                                    <p className="text-xs text-gray-400 dark:text-slate-400">Play a sound on new messages</p>
                                </div>
                                <button
                                    onClick={() => handleToggleNotif('sound')}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${notifs.sound ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifs.sound ? 'right-1' : 'left-1'}`}></div>
                                </button>
                            </div>

                            <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                                <button
                                    onClick={sendTestNotification}
                                    className="w-full py-3 px-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl font-bold text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all border border-blue-100 dark:border-blue-800/50"
                                >
                                    Send Test Notification
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stealth Notifications Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-rose-500 dark:text-rose-400">
                                <Shield size={20} />
                            </div>
                            <h2 className="font-bold text-gray-800 dark:text-white">Stealth Notifications</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Enable Stealth Mode</p>
                                    <p className="text-xs text-gray-400 dark:text-slate-400">Mask real chat alerts with fake ones</p>
                                </div>
                                <button
                                    onClick={() => handleToggleStealth('enabled')}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${stealthNotifs.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${stealthNotifs.enabled ? 'right-1' : 'left-1'}`}></div>
                                </button>
                            </div>

                            {stealthNotifs.enabled && (
                                <div className="space-y-6 pt-4 border-t border-gray-50 dark:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* Fake Title */}
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Fake Title Option</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {stealthTitles.map(title => (
                                                <button
                                                    key={title}
                                                    onClick={() => setStealthNotifs(prev => ({ ...prev, titleOption: title }))}
                                                    className={`px-3 py-2 text-left text-xs font-semibold rounded-xl border transition-all ${stealthNotifs.titleOption === title
                                                        ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                                                        : 'bg-gray-50 border-gray-100 text-gray-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
                                                        }`}
                                                >
                                                    {title}
                                                </button>
                                            ))}
                                        </div>
                                        {stealthNotifs.titleOption === 'Custom' && (
                                            <input
                                                type="text"
                                                placeholder="Enter custom title..."
                                                value={stealthNotifs.customTitle}
                                                onChange={(e) => setStealthNotifs(prev => ({ ...prev, customTitle: e.target.value }))}
                                                className="mt-3 w-full px-4 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-sans"
                                            />
                                        )}
                                    </div>

                                    {/* Fake Body */}
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Fake Body Text</p>
                                        <div className="flex gap-2 mb-3">
                                            {['Default', 'Custom'].map(opt => (
                                                <button
                                                    key={opt}
                                                    onClick={() => setStealthNotifs(prev => ({ ...prev, bodyOption: opt }))}
                                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${stealthNotifs.bodyOption === opt
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-100 dark:bg-slate-900 text-gray-500'
                                                        }`}
                                                >
                                                    {opt === 'Default' ? 'Tap to learn more' : 'Custom Body'}
                                                </button>
                                            ))}
                                        </div>
                                        {stealthNotifs.bodyOption === 'Custom' && (
                                            <input
                                                type="text"
                                                placeholder="Enter custom body text..."
                                                value={stealthNotifs.customBody}
                                                onChange={(e) => setStealthNotifs(prev => ({ ...prev, customBody: e.target.value }))}
                                                className="w-full px-4 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-sans"
                                            />
                                        )}
                                    </div>

                                    {/* Tap Behavior */}
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Tap LEFT opens decoy app</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {decoyApps.map(app => (
                                                <button
                                                    key={app.path}
                                                    onClick={() => setStealthNotifs(prev => ({ ...prev, leftTapApp: app.path }))}
                                                    className={`px-3 py-2 text-center text-xs font-semibold rounded-xl border transition-all ${stealthNotifs.leftTapApp === app.path
                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                                                        : 'bg-gray-50 border-gray-100 text-gray-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
                                                        }`}
                                                >
                                                    {app.name}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-2 italic">* Tap RIGHT always opens the real chat.</p>
                                    </div>

                                    {/* Sender Visibility */}
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Real Sender Name</p>
                                        <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-xl">
                                            {['Hidden', 'Initials', 'Full'].map((v) => (
                                                <button
                                                    key={v}
                                                    onClick={() => setStealthNotifs(prev => ({ ...prev, senderVisibility: v }))}
                                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${stealthNotifs.senderVisibility === v
                                                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                                        : 'text-gray-500 dark:text-slate-500'
                                                        }`}
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Preview Card */}
                                    <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                                        <p className="text-[10px] font-bold text-gray-400 mb-3 uppercase tracking-tighter">Preview</p>
                                        <div className="relative group overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700 p-3 max-w-sm mx-auto">
                                            <div className="flex gap-3">
                                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-500">
                                                    <Smartphone size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-xs font-bold text-gray-800 dark:text-white truncate font-sans">
                                                        {stealthNotifs.titleOption === 'Custom' ? (stealthNotifs.customTitle || 'Fake Title') : stealthNotifs.titleOption}
                                                    </h4>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 font-sans">
                                                        {stealthNotifs.bodyOption === 'Custom' ? (stealthNotifs.customBody || 'Fake body...') : 'Tap to learn more'}
                                                    </p>
                                                    {stealthNotifs.senderVisibility !== 'Hidden' && (
                                                        <p className="text-[9px] text-blue-500 font-bold mt-1 font-sans">
                                                            {stealthNotifs.senderVisibility === 'Initials' ? 'From: J.D.' : 'From: John Doe'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Visual helper for tap zones */}
                                            <div className="absolute inset-0 flex opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                <div className="flex-1 bg-red-500/10 flex items-center justify-center border-r border-white/20">
                                                    <span className="text-[8px] font-black text-red-500/50 uppercase font-sans">Decoy</span>
                                                </div>
                                                <div className="flex-1 bg-emerald-500/10 flex items-center justify-center">
                                                    <span className="text-[8px] font-black text-emerald-500/50 uppercase font-sans">Real Chat</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Login Activity Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400">
                                <Activity size={20} />
                            </div>
                            <h2 className="font-bold text-gray-800 dark:text-white">Login Activity</h2>
                        </div>

                        <div className="space-y-4">
                            {isLoadingActivities ? (
                                <div className="py-4 text-center text-sm text-gray-400">Loading activity...</div>
                            ) : loginActivities.length === 0 ? (
                                <div className="py-4 text-center text-sm text-gray-400">No recent activity found</div>
                            ) : (
                                loginActivities.map((activity, idx) => (
                                    <div key={activity.id || idx} className="flex items-start gap-4 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-900/40 transition-colors">
                                        <div className="p-2 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400">
                                            {activity.device_name.toLowerCase().includes('mobile') || activity.device_name.toLowerCase().includes('android') || activity.device_name.toLowerCase().includes('iphone') ? (
                                                <Smartphone size={20} />
                                            ) : (
                                                <Monitor size={20} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-gray-800 dark:text-white truncate">
                                                    {(activity.device_name && activity.device_name.split('(')[0]) || 'Unknown Device'}
                                                </p>
                                                {idx === 0 && (
                                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                                                        Current Session
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 mt-1">
                                                <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-400">
                                                    <MapPin size={12} />
                                                    <span>{activity.location || 'Unknown Location'}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-400">
                                                    <Activity size={12} />
                                                    <span>{activity.ip_address}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-400">
                                                    <Clock size={12} />
                                                    <span>{new Date(activity.last_active).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-6 leading-relaxed">
                            We use your device type, IP address, and general location to help you recognize your login sessions.
                        </p>
                    </div>

                    {/* Account Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400">
                                <User size={20} />
                            </div>
                            <h2 className="font-bold text-gray-800 dark:text-white">Account</h2>
                        </div>

                        <button
                            onClick={() => navigate('/profile')}
                            className="flex items-center gap-3 w-full p-3 mb-2 rounded-2xl text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-900/40 transition-colors"
                        >
                            <User size={20} className="text-blue-500" />
                            <span className="font-semibold text-sm">Edit Profile</span>
                        </button>

                        <button
                            onClick={() => {
                                localStorage.removeItem('profile');
                                window.location.href = '/';
                            }}
                            className="flex items-center gap-3 w-full p-3 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                        >
                            <LogOut size={20} />
                            <span className="font-semibold text-sm">Sign Out</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
