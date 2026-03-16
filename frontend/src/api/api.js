import axios from 'axios';

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });

// Add JWT to requests
API.interceptors.request.use((req) => {
    const profile = JSON.parse(localStorage.getItem('profile'));
    if (profile && profile.token) {
        req.headers.Authorization = `Bearer ${profile.token}`;
    }
    return req;
});

export const signIn = (formData) => API.post('/auth/login', formData);
export const signUp = (formData) => API.post('/auth/register', formData);
export const searchUsers = (query) => API.get(`/users/search?q=${query}`);
export const getSidebar = () => API.get('/users/sidebar');
export const getSharedMedia = (otherId) => API.get(`/messages/shared/${otherId}`);
export const getMessages = (otherId, limit = 20, offset = 0) => API.get(`/messages/${otherId}?limit=${limit}&offset=${offset}`);
export const markAsRead = (data) => API.post('/messages/mark-read', data);
export const uploadFile = (formData) => API.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
});
export const pinChat = (data) => API.post('/users/pin-chat', data);
export const muteChat = (data) => API.post('/users/mute-chat', data);
export const getLinkPreview = (url) => API.get(`/utils/link-preview?url=${encodeURIComponent(url)}`);
export const pinMessage = (data) => API.post('/messages/pin', data);
export const setAlias = (data) => API.post('/users/set-alias', data);
export const getUserProfile = (userId) => API.get(`/users/profile/${userId}`);
export const getCallHistory = () => API.get('/calls/history');
export const getLoginActivity = () => API.get('/users/login-activity');

// E2EE Public Key APIs
export const uploadPublicKey = (publicKey) => API.post('/keys', { publicKey });
export const getPublicKey = (userId) => API.get(`/keys/${userId}`);
