import React, { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StealthNotificationToast = ({ message, settings, onDismiss }) => {
    const navigate = useNavigate();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(true);
        const timer = setTimeout(() => {
            handleDismiss();
        }, 5000); // Show for 5 seconds
        return () => clearTimeout(timer);
    }, []);

    const handleDismiss = () => {
        setVisible(false);
        setTimeout(onDismiss, 300); // Wait for fade out
    };


    // Get decoy app route from localStorage or fallback
    const getDecoyAppRoute = () => {
        // Example: '/decoy/calculator', '/decoy/clock', '/decoy/camera', '/decoy/settings'
        return localStorage.getItem('decoyAppRoute') || '/decoy/calculator';
    };

    const handleLeftClick = (e) => {
        e.stopPropagation();
        handleDismiss();
        navigate(getDecoyAppRoute());
    };

    const handleRightClick = (e) => {
        e.stopPropagation();
        handleDismiss();
        // In a real app, this would navigate to the specific chat
        navigate('/home'); 
    };

    const getSenderName = () => {
        if (settings.senderVisibility === 'Hidden') return null;
        const name = message.senderName || 'Unknown User';
        if (settings.senderVisibility === 'Initials') {
            return name.split(' ').map(n => n[0]).join('.') + '.';
        }
        return name;
    };

    const title = settings.titleOption === 'Custom' ? settings.customTitle : settings.titleOption;
    const body = settings.bodyOption === 'Custom' ? settings.customBody : 'Tap to learn more';

    return (
        <div 
            className={`fixed top-4 left-4 right-4 z-[9999] flex justify-center transition-all duration-300 transform ${
                visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
            }`}
        >
            <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden flex cursor-pointer">
                {/* Left Half - Decoy */}
                <div 
                    onClick={handleLeftClick}
                    className="absolute inset-y-0 left-0 w-1/2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    title="Tap to see info"
                ></div>
                
                {/* Right Half - Real Chat */}
                <div 
                    onClick={handleRightClick}
                    className="absolute inset-y-0 right-0 w-1/2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                ></div>

                <div className="relative flex-1 p-4 flex gap-3 pointer-events-none">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-500 shrink-0">
                        <Smartphone size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <h4 className="text-sm font-bold text-gray-800 dark:text-white truncate">
                                {title}
                            </h4>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                            {body}
                        </p>
                        {settings.senderVisibility !== 'Hidden' && (
                            <p className="text-[10px] text-blue-500 font-bold mt-1">
                                From: {getSenderName()}
                            </p>
                        )}
                    </div>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDismiss();
                        }}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-400 pointer-events-auto"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StealthNotificationToast;
