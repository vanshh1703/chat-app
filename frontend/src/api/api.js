import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API = axios.create({ baseURL: BASE_URL });

// Add JWT to requests
API.interceptors.request.use((req) => {
    const profile = JSON.parse(localStorage.getItem('profile'));
    if (profile && profile.token) {
        req.headers.Authorization = `Bearer ${profile.token}`;
    }
    return req;
});

export const signIn = (formData) => API.post('/api/auth/login', formData);
export const signUp = (formData) => API.post('/api/auth/register', formData);
export const searchUsers = (query) => API.get(`/api/users/search?q=${query}`);
export const getSidebar = () => API.get('/api/users/sidebar');
export const getSharedMedia = (otherId) => API.get(`/api/messages/shared/${otherId}`);
export const getMessages = (otherId, limit = 20, offset = 0) => API.get(`/api/messages/${otherId}?limit=${limit}&offset=${offset}`);
export const markAsRead = (data) => API.post('/api/messages/mark-read', data);
export const uploadFile = (formData) => API.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
});
export const pinChat = (data) => API.post('/api/users/pin-chat', data);
export const muteChat = (data) => API.post('/api/users/mute-chat', data);
export const getLinkPreview = (url) => API.get(`/api/utils/link-preview?url=${encodeURIComponent(url)}`);
export const pinMessage = (data) => API.post('/api/messages/pin', data);
export const setAlias = (data) => API.post('/api/users/set-alias', data);
export const getUserProfile = (userId) => API.get(`/api/users/profile/${userId}`);
export const getCallHistory = () => API.get('/api/calls/history');
export const getLoginActivity = () => API.get('/api/users/login-activity');
export const updateProfile = (data) => API.post('/api/users/update-profile', data);
export const changePassword = (data) => API.post('/api/users/change-password', data);

// E2EE Public Key APIs
export const uploadPublicKey = (publicKey) => API.post('/api/keys', { publicKey });
export const getPublicKey = (userId) => API.get(`/api/keys/${userId}`);
