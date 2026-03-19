import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, User, Mail, Lock, Camera, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/api';

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
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!user) {
            navigate('/');
        }
    }, [user, navigate]);


    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const { data } = await api.updateProfile({ username, bio });
            const profile = JSON.parse(localStorage.getItem('profile'));
            profile.user = data;
            localStorage.setItem('profile', JSON.stringify(profile));
            setUser(data);
            setAvatarUrl(data.avatar_url || avatarUrl);
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Update failed' });
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
            await api.changePassword({ oldPassword, newPassword });
            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Password change failed' });
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
            const { data } = await api.uploadAvatar(formData);
            const resolvedAvatarUrl = data?.avatarUrl || data?.user?.avatar_url || '';
            setAvatarUrl(resolvedAvatarUrl);

            if (data?.user) {
                const profile = JSON.parse(localStorage.getItem('profile'));
                profile.user = data.user;
                localStorage.setItem('profile', JSON.stringify(profile));
                setUser(data.user);
            }

            setMessage({ type: 'success', text: 'Encrypted avatar uploaded successfully.' });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Upload failed' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-linear-to-b from-[#8f6a5d] via-[#2b2224] to-black transition-colors duration-300 font-sans pb-12 text-white">
            <div className="max-w-2xl mx-auto p-4 md:p-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/home')}
                        className="p-2 rounded-xl bg-black/45 backdrop-blur-xl border border-white/10 text-white/75 hover:bg-black/60 transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-2xl font-bold text-white">Profile</h1>
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
                    <div className="bg-black/40 backdrop-blur-xl rounded-3xl p-8 shadow-sm border border-white/10 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-24 bg-linear-to-r from-[#b98a79]/40 to-[#4b2d2f]/30 pointer-events-none"></div>

                        <div className="relative inline-block mt-4">
                            <div className="w-32 h-32 rounded-full border-4 border-white/20 shadow-xl overflow-hidden bg-black/35">
                                <img
                                    src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
                                    }}
                                />
                            </div>
                            <button
                                onClick={() => fileInputRef.current.click()}
                                className="absolute bottom-1 right-1 p-2.5 bg-white/15 text-white rounded-full shadow-lg hover:bg-white/25 transition-all hover:scale-110 border-4 border-black/60"
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
                            <h2 className="text-xl font-bold text-white">{user?.username}</h2>
                            <p className="text-sm text-white/60">{user?.email}</p>
                        </div>
                    </div>

                    {/* Basic Info Form */}
                    <div className="bg-black/40 backdrop-blur-xl rounded-3xl p-6 shadow-sm border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-white/10 text-amber-300">
                                <User size={20} />
                            </div>
                            <h2 className="font-bold text-white">Basic Information</h2>
                        </div>

                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-white/80 ml-1">Username</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3.5 bg-black/35 border border-white/10 rounded-2xl outline-hidden focus:ring-2 focus:ring-amber-400/20 focus:border-amber-300 text-white font-medium transition-all"
                                        placeholder="Username"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-white/80 ml-1">Bio</label>
                                <div className="relative group">
                                    <textarea
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-black/35 border border-white/10 rounded-2xl outline-hidden focus:ring-2 focus:ring-amber-400/20 focus:border-amber-300 text-white font-medium transition-all resize-none h-24"
                                        placeholder="Tell us about yourself..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 opacity-60">
                                <label className="text-sm font-semibold text-white/70 ml-1">Email (Read-only)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        readOnly
                                        value={user?.email || ''}
                                        className="w-full pl-11 pr-4 py-3.5 bg-black/30 border border-white/10 rounded-2xl text-white/50 cursor-not-allowed font-medium"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-4 flex items-center justify-center gap-2 bg-[#f59e0b] hover:bg-[#f2a51f] text-black font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Save Changes'}
                            </button>
                        </form>
                    </div>

                    {/* Security Section */}
                    <div className="bg-black/40 backdrop-blur-xl rounded-3xl p-6 shadow-sm border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-white/10 text-amber-300">
                                <Lock size={20} />
                            </div>
                            <h2 className="font-bold text-white">Security</h2>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="space-y-2">
                                    <label className="text-sm font-semibold text-white/80 ml-1">Current Password</label>
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-black/35 border border-white/10 rounded-2xl outline-hidden focus:ring-2 focus:ring-amber-400/20 focus:border-amber-300 text-white font-medium transition-all"
                                    placeholder="Enter current password"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-white/80 ml-1">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-black/35 border border-white/10 rounded-2xl outline-hidden focus:ring-2 focus:ring-amber-400/20 focus:border-amber-300 text-white font-medium transition-all"
                                        placeholder="New password"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-white/80 ml-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-black/35 border border-white/10 rounded-2xl outline-hidden focus:ring-2 focus:ring-amber-400/20 focus:border-amber-300 text-white font-medium transition-all"
                                        placeholder="Confirm new password"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-4 bg-white/12 hover:bg-white/20 text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
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
