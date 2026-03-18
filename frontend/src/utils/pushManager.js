import { getVapidPublicKey, subscribePush, unsubscribePush, resetPushSubscriptions } from '../api/api';

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

const uint8ArrayEquals = (a, b) => {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
    }
    return true;
};

const getStealthMeta = () => {
    try {
        const settings = JSON.parse(localStorage.getItem('stealthNotifSettings') || '{}');
        const title = settings.titleOption === 'Custom'
            ? (settings.customTitle || 'Software Update Ready')
            : (settings.titleOption || 'Software Update Ready');
        const body = settings.bodyOption === 'Custom'
            ? (settings.customBody || 'Tap to learn more')
            : 'Tap to learn more';

        return {
            stealthEnabled: Boolean(settings.enabled),
            decoyAppRoute: settings.decoyAppRoute || settings.leftTapApp || '/decoy/settings',
            fakeTitle: title,
            fakeBody: body,
            senderVisibility: settings.senderVisibility || 'Hidden'
        };
    } catch {
        return {
            stealthEnabled: false,
            decoyAppRoute: '/decoy/settings',
            fakeTitle: 'Software Update Ready',
            fakeBody: 'Tap to learn more',
            senderVisibility: 'Hidden'
        };
    }
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

        console.log('Fetching VAPID public key from backend...');
        const { data: { publicKey } } = await getVapidPublicKey();

        if (!publicKey) {
            console.error('VAPID public key is missing from backend response');
            return false;
        }

        const backendKey = urlBase64ToUint8Array(publicKey);
        console.log('Received VAPID public key');

        // Reuse existing subscription when possible, but rotate if key mismatches
        let subscription = await registration.pushManager.getSubscription();

        if (subscription?.options?.applicationServerKey) {
            const currentKey = new Uint8Array(subscription.options.applicationServerKey);
            const isKeyMatch = uint8ArrayEquals(currentKey, backendKey);

            if (!isKeyMatch) {
                console.warn('Existing push subscription uses old VAPID key, re-subscribing...');
                try {
                    await unsubscribePush(subscription);
                } catch (err) {
                    console.warn('Backend unsubscribe during key-rotation failed:', err);
                }
                try {
                    await subscription.unsubscribe();
                } catch (err) {
                    console.warn('Local unsubscribe during key-rotation failed:', err);
                }
                subscription = null;
            }
        }

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: backendKey
            });
        }

        const subscriptionPayload = {
            ...subscription.toJSON(),
            meta: getStealthMeta()
        };

        console.log('Registering subscription on backend...');
        await subscribePush(subscriptionPayload);
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

export const forceResubscribeToPush = async () => {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return false;
        }

        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();

        if (existingSubscription) {
            try {
                await existingSubscription.unsubscribe();
            } catch (err) {
                console.warn('Local push unsubscribe during recovery failed:', err);
            }
        }

        try {
            await resetPushSubscriptions();
        } catch (err) {
            console.warn('Backend push reset failed during recovery:', err);
        }

        return await subscribeToPush();
    } catch (error) {
        console.error('Failed to force re-subscribe to push notifications:', error);
        return false;
    }
};
