import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, User, Mail, Lock, Camera, Check, AlertCircle, Loader2, Trophy, Swords, TrendingUp, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('profile'))?.user || null);
    const [username, setUsername] = useState(user?.username || '');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [debateStats, setDebateStats] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!user) {
            navigate('/');
        } else {
            const fetchDebateStats = async () => {
                try {
                    const response = await fetch(`http://localhost:5000/api/user/${user.id}/debate-stats`, {
                        headers: {
                            'Authorization': `Bearer ${JSON.parse(localStorage.getItem('profile')).token}`
                        }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        setDebateStats(data);
                    }
                } catch (err) {
                    console.error('Failed to fetch debate stats:', err);
                }
            };
            fetchDebateStats();
        }
    }, [user, navigate]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const token = localStorage.getItem('profile') ? JSON.parse(localStorage.getItem('profile')).token : null;
            const response = await fetch('http://localhost:5000/api/users/update-profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username, avatar_url: avatarUrl, bio })
            });

            if (response.ok) {
                const updatedUser = await response.json();
                const profile = JSON.parse(localStorage.getItem('profile'));
                profile.user = updatedUser;
                localStorage.setItem('profile', JSON.stringify(profile));
                setUser(updatedUser);
                setMessage({ type: 'success', text: 'Profile updated successfully!' });
            } else {
                const error = await response.json();
                setMessage({ type: 'error', text: error.error || 'Update failed' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Server error' });
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            return setMessage({ type: 'error', text: 'Passwords do not match' });
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const token = localStorage.getItem('profile') ? JSON.parse(localStorage.getItem('profile')).token : null;
            const response = await fetch('http://localhost:5000/api/users/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ oldPassword, newPassword })
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'Password changed successfully!' });
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                const error = await response.json();
                setMessage({ type: 'error', text: error.error || 'Password change failed' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Server error' });
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        try {
            const token = localStorage.getItem('profile') ? JSON.parse(localStorage.getItem('profile')).token : null;
            const response = await fetch('http://localhost:5000/api/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                setAvatarUrl(data.fileUrl);
                setMessage({ type: 'success', text: 'Photo uploaded! Don\'t forget to save changes.' });
            } else {
                setMessage({ type: 'error', text: 'Upload failed' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Upload error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] transition-colors duration-300 font-sans pb-12">
            <div className="max-w-2xl mx-auto p-4 md:p-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/home')}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Profile</h1>
                </div>

                {message.text && (
                    <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 ${message.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/50'
                        }`}>
                        {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
                        <p className="text-sm font-bold">{message.text}</p>
                    </div>
                )}

                <div className="space-y-6">
                    {/* Avatar Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-24 bg-linear-to-r from-blue-500 to-indigo-600 opacity-10 dark:opacity-20 pointer-events-none"></div>

                        <div className="relative inline-block mt-4">
                            <div className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-700 shadow-xl overflow-hidden bg-gray-100 dark:bg-slate-900">
                                <img
                                    src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <button
                                onClick={() => fileInputRef.current.click()}
                                className="absolute bottom-1 right-1 p-2.5 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 border-4 border-white dark:border-slate-800"
                            >
                                <Camera size={18} />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileUpload}
                            />
                        </div>

                        <div className="mt-4">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{user?.username}</h2>
                            <p className="text-sm text-gray-400 dark:text-slate-400">{user?.email}</p>
                        </div>
                    </div>

                    {/* Debate Performance Stats */}
                    {debateStats && (
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-8 opacity-5 text-blue-600">
                                <Swords size={120} />
                            </div>
                            <div className="flex items-center gap-3 mb-6 relative z-10">
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400">
                                    <Trophy size={20} />
                                </div>
                                <h2 className="font-bold text-gray-800 dark:text-white">Debate Performance</h2>
                            </div>

                            <div className="grid grid-cols-3 gap-4 relative z-10">
                                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 text-center">
                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Elo Rating</p>
                                    <div className="flex items-center justify-center gap-1">
                                        <Zap size={14} className="text-yellow-500" />
                                        <span className="text-xl font-black text-blue-600 dark:text-blue-400">{debateStats.rating}</span>
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 text-center">
                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Global Rank</p>
                                    <span className="text-xl font-black text-gray-800 dark:text-white">#{debateStats.rank}</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 text-center">
                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Win Rate</p>
                                    <div className="flex items-center justify-center gap-1">
                                        <TrendingUp size={14} className="text-emerald-500" />
                                        <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{debateStats.winRate}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-center gap-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-800/20">
                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Record:</span>
                                <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">{debateStats.wins}W</span>
                                <span className="text-gray-300 mx-1">|</span>
                                <span className="text-xs font-black text-red-600 uppercase tracking-wider">{debateStats.losses}L</span>
                                <span className="text-gray-300 mx-1">|</span>
                                <span className="text-xs font-black text-gray-500 uppercase tracking-wider">{debateStats.draws}D</span>
                            </div>
                        </div>
                    )}

                    {/* Basic Info Form */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400">
                                <User size={20} />
                            </div>
                            <h2 className="font-bold text-gray-800 dark:text-white">Basic Information</h2>
                        </div>

                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-600 dark:text-slate-300 ml-1">Username</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-700 dark:text-white font-medium transition-all"
                                        placeholder="Username"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-600 dark:text-slate-300 ml-1">Bio</label>
                                <div className="relative group">
                                    <textarea
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-700 dark:text-white font-medium transition-all resize-none h-24"
                                        placeholder="Tell us about yourself..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 opacity-60">
                                <label className="text-sm font-semibold text-gray-600 dark:text-slate-300 ml-1">Email (Read-only)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        readOnly
                                        value={user?.email || ''}
                                        className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 rounded-2xl text-gray-400 cursor-not-allowed font-medium"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Save Changes'}
                            </button>
                        </form>
                    </div>

                    {/* Security Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400">
                                <Lock size={20} />
                            </div>
                            <h2 className="font-bold text-gray-800 dark:text-white">Security</h2>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-600 dark:text-slate-300 ml-1">Current Password</label>
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-700 dark:text-white font-medium transition-all"
                                    placeholder="Enter current password"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-600 dark:text-slate-300 ml-1">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-700 dark:text-white font-medium transition-all"
                                        placeholder="New password"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-600 dark:text-slate-300 ml-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-700 dark:text-white font-medium transition-all"
                                        placeholder="Confirm new password"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-4 bg-gray-800 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Update Password'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
