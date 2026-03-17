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
        const registration = await navigator.serviceWorker.ready;
        
        // Get public key from backend
        const { data: { publicKey } } = await getVapidPublicKey();
        
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

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
