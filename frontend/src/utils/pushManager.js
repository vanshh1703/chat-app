import { getVapidPublicKey, subscribePush, unsubscribePush } from '../api/api';

const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export const subscribeToPush = async () => {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push is not supported in this browser');
            return false;
        }

        if (!('Notification' in window)) {
            console.warn('Notifications are not supported in this browser');
            return false;
        }

        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('Notification permission not granted');
                return false;
            }
        }

        const registration = await navigator.serviceWorker.ready;

        // Reuse existing subscription if available (important for reliability)
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            console.log('Fetching VAPID public key from backend...');
            const { data: { publicKey } } = await getVapidPublicKey();

            if (!publicKey) {
                console.error('VAPID public key is missing from backend response');
                return false;
            }

            console.log('Received VAPID public key');
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
        }

        console.log('Registering subscription on backend...');
        await subscribePush(subscription);
        console.log('Successfully subscribed to push notifications');
        return true;
    } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
        return false;
    }
};

export const unsubscribeFromPush = async () => {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
            await subscription.unsubscribe();
            await unsubscribePush(subscription);
        }
    } catch (error) {
        console.error('Failed to unsubscribe from push notifications:', error);
    }
};
