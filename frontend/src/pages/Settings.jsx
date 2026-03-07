import React, { useState, useEffect } from 'react';
import { ArrowLeft, Moon, Sun, Bell, Shield, User, LogOut, Image as ImageIcon, Check, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('profile'))?.user;
    const [themePreference, setThemePreference] = useState(localStorage.getItem('themePreference') || 'light');
    const [notifs, setNotifs] = useState(JSON.parse(localStorage.getItem('notifSettings') || '{"individual": true, "all": true, "sound": true}'));
    const [chatWallpaper, setChatWallpaper] = useState('default');
    const fileInputRef = React.useRef(null);

    useEffect(() => {
        if (user) {
            setChatWallpaper(localStorage.getItem(`chatWallpaper_${user.id}`) || 'default');
        }
    }, [user]);

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
    }, [user, themePreference, chatWallpaper]);

    useEffect(() => {
        localStorage.setItem('notifSettings', JSON.stringify(notifs));
    }, [notifs]);

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
