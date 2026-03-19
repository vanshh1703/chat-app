import axios from 'axios';

// Ensure baseURL always ends with '/' so relative paths append correctly
const getDefaultApiOrigin = () => {
    if (typeof window === 'undefined') {
        return 'http://localhost:5000';
    }

    const { protocol, hostname } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocalhost) return 'http://localhost:5000';

    return `${protocol}//${hostname}`;
};

const rawUrl = import.meta.env.VITE_API_URL || getDefaultApiOrigin();
// Strip any trailing /api or /api/ that may already be in the env var, then add /api/
const BASE_URL = rawUrl.replace(/\/api\/?$/, '') + '/api/';

const API = axios.create({ baseURL: BASE_URL });

// Add JWT to requests
API.interceptors.request.use((req) => {
    const profile = JSON.parse(localStorage.getItem('profile'));
    if (profile && profile.token) {
        req.headers.Authorization = `Bearer ${profile.token}`;
    }
    return req;
});

export const signIn = (formData) => API.post('auth/login', formData);
export const signUp = (formData) => API.post('auth/register', formData);
export const searchUsers = (query) => API.get(`users/search?q=${query}`);
export const getSidebar = () => API.get('users/sidebar');
export const getSharedMedia = (otherId) => API.get(`messages/shared/${otherId}`);
export const getMessages = (otherId, limit = 20, offset = 0) => API.get(`messages/${otherId}?limit=${limit}&offset=${offset}`);
export const markAsRead = (data) => API.post('messages/mark-read', data);
export const uploadFile = (formData) => API.post('upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
});
export const pinChat = (data) => API.post('users/pin-chat', data);
export const muteChat = (data) => API.post('users/mute-chat', data);
export const getLinkPreview = (url) => API.get(`utils/link-preview?url=${encodeURIComponent(url)}`);
export const pinMessage = (data) => API.post('messages/pin', data);
export const getChatWallpaper = (otherId) => API.get(`chats/${otherId}/wallpaper`);
export const setChatWallpaperForChat = (otherUserId, wallpaper) => API.post('chats/wallpaper', { otherUserId, wallpaper });
// Accepts (contactId, alias) for clarity
export const setAlias = (contactId, alias) =>
    API.post('users/set-alias', { contactId, alias });
export const getUserProfile = (userId) => API.get(`users/profile/${userId}`);
export const getCallHistory = () => API.get('calls/history');
export const getLoginActivity = () => API.get('users/login-activity');
export const updateProfile = (data) => API.post('users/update-profile', data);
export const changePassword = (data) => API.post('users/change-password', data);

// Push Notification APIs
export const getVapidPublicKey = () => API.get('push/vapid-public-key');
export const subscribePush = (subscription) => API.post('push/subscribe', { subscription });
export const unsubscribePush = (subscription) => API.post('push/unsubscribe', { subscription });
export const resetPushSubscriptions = () => API.post('push/reset');
export const testPush = (message) => API.post('push/test', { message });

export default API;
