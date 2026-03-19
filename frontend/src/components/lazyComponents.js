import { lazy } from 'react';

// Wrap emoji-picker-react because it might use default export
export const EmojiPicker = lazy(() => import('emoji-picker-react'));

// Heavy features/modals
export const CallUI = lazy(() => import('./CallUI'));
export const DrawingModal = lazy(() => import('./DrawingModal'));
export const ProfileOrganizer = lazy(() => import('./ProfileOrganizer'));
export const OfflineChatManager = lazy(() => import('./OfflineChatManager'));

// QR Scanner (assuming it exists in components, e.g., QRScanner component or relying on html5-qrcode)
