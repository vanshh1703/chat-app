import React, { useEffect, useState } from 'react';
import { Smartphone, X, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * StealthNotificationToast
 *
 * Props:
 *  message  – { senderName, text }
 *  settings – {
 *      titleOption:      'Custom' | string (e.g. 'New Message')
 *      customTitle:      string (used when titleOption === 'Custom')
 *      bodyOption:       'Custom' | string
 *      customBody:       string (used when bodyOption === 'Custom')
 *      senderVisibility: 'Hidden' | 'Initials' | 'Full'
 *      decoyAppRoute:    '/decoy/calculator' | '/decoy/clock' | '/decoy/camera' | '/decoy/settings'
 *                        (optional – falls back to localStorage → '/decoy/calculator')
 *  }
 *  onDismiss – () => void
 */
const StealthNotificationToast = ({ message, settings, onDismiss }) => {
    const navigate = useNavigate();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Tiny delay so the initial render triggers the CSS transition
        const show = requestAnimationFrame(() => setVisible(true));

        const timer = setTimeout(() => handleDismiss(), 5000);
        return () => {
            cancelAnimationFrame(show);
            clearTimeout(timer);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDismiss = () => {
        setVisible(false);
        setTimeout(onDismiss, 300);
    };

    // Resolve decoy route with backward compatibility:
    // settings.decoyAppRoute -> settings.leftTapApp -> localStorage.decoyAppRoute -> localStorage.stealthNotifSettings.leftTapApp
    const normalizeDecoyRoute = (route) => {
        if (!route) return null;
        if (route === '/decoy/calc') return '/decoy/calculator';
        return route;
    };

    const getDecoyAppRoute = () => {
        const routeFromSettings = settings?.decoyAppRoute || settings?.leftTapApp;
        const routeFromDirectStorage = localStorage.getItem('decoyAppRoute');

        let routeFromStealthSettings = null;
        try {
            const storedStealthSettings = JSON.parse(localStorage.getItem('stealthNotifSettings') || '{}');
            routeFromStealthSettings = storedStealthSettings?.decoyAppRoute || storedStealthSettings?.leftTapApp || null;
        } catch {
            routeFromStealthSettings = null;
        }

        return (
            normalizeDecoyRoute(routeFromSettings) ||
            normalizeDecoyRoute(routeFromDirectStorage) ||
            normalizeDecoyRoute(routeFromStealthSettings) ||
            '/decoy/calculator'
        );
    };

    // LEFT tap → decoy app
    const handleLeftClick = (e) => {
        e.stopPropagation();
        handleDismiss();
        navigate(getDecoyAppRoute());
    };

    // RIGHT tap → real chat
    const handleRightClick = (e) => {
        e.stopPropagation();
        handleDismiss();
        navigate('/home');
    };

    const getSenderName = () => {
        if (!settings || settings.senderVisibility === 'Hidden') return null;
        const name = message?.senderName || 'Unknown User';
        if (settings.senderVisibility === 'Initials') {
            return name.split(' ').map(n => n[0]).join('.') + '.';
        }
        return name; // 'Full'
    };

    const title =
        settings?.titleOption === 'Custom'
            ? settings.customTitle
            : settings?.titleOption || 'New Message';

    const body =
        settings?.bodyOption === 'Custom'
            ? settings.customBody
            : 'Tap to learn more';

    const senderName = getSenderName();

    return (
        <div
            className={`fixed top-4 left-4 right-4 z-9999 flex justify-center transition-all duration-300 ${
                visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
            }`}
        >
            <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">

                {/*
                 * Invisible split overlay:
                 *   Left  half → decoy app
                 *   Right half → real chat
                 * These sit above the content row (z-10) but below the dismiss button (z-20)
                 */}
                <div className="absolute inset-0 flex pointer-events-none z-10">
                    <div
                        onClick={handleLeftClick}
                        className="flex-1 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors pointer-events-auto"
                        title="Open decoy app"
                    />
                    <div
                        onClick={handleRightClick}
                        className="flex-1 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors pointer-events-auto"
                        title="Open chat"
                    />
                </div>

                {/* Content row — pointer-events-none so clicks fall through to the overlay above */}
                <div className="relative flex items-start gap-3 p-4 pointer-events-none">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-500 shrink-0">
                        <Smartphone size={20} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white truncate">
                            {title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                            {body}
                        </p>
                        {senderName && (
                            <p className="text-[10px] text-blue-500 font-bold mt-1">
                                From: {senderName}
                            </p>
                        )}
                    </div>

                    {/* Dismiss — pointer-events-auto so it works despite the parent being none */}
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-400 pointer-events-auto shrink-0 z-20 relative"
                        aria-label="Dismiss notification"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Subtle split indicator bar at the bottom */}
                <div className="flex h-0.5 pointer-events-none">
                    <div className="flex-1 bg-blue-200 dark:bg-blue-800/40" title="Decoy" />
                    <div className="flex-1 bg-emerald-200 dark:bg-emerald-800/40" title="Chat" />
                </div>
            </div>
        </div>
    );
};

export default StealthNotificationToast;