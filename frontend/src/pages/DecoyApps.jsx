import React from 'react';
import { ArrowLeft, Settings, Shield, User, Bell, Search, Plus, Menu, X, Camera, Clock, Calculator, Battery, Wifi, Signal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DecoyHeader = ({ title }) => {
    const navigate = useNavigate();
    return (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/home')} className="text-gray-500 hover:text-gray-700">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h1>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-gray-400">
                <div className="flex items-center gap-1"><Signal size={12} /> <span>LTE</span></div>
                <div className="flex items-center gap-1"><Wifi size={12} /></div>
                <div className="flex items-center gap-1"><span>85%</span> <Battery size={12} /></div>
            </div>
        </div>
    );
};

export const DecoySettings = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <DecoyHeader title="Settings" />
            <div className="p-4 space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500 rounded-lg text-white"><Wifi size={18} /></div>
                        <div>
                            <p className="text-sm font-semibold">Wi-Fi</p>
                            <p className="text-[10px] text-gray-400">Home_Network_5G</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-400 rounded-lg text-white"><Signal size={18} /></div>
                        <div>
                            <p className="text-sm font-semibold">Bluetooth</p>
                            <p className="text-[10px] text-gray-400">On</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500 rounded-lg text-white"><Bell size={18} /></div>
                        <p className="text-sm font-semibold">Notifications</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-500 rounded-lg text-white"><Shield size={18} /></div>
                        <p className="text-sm font-semibold">Privacy & Security</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const DecoyCalculator = () => {
    return (
        <div className="min-h-screen bg-black flex flex-col">
            <div className="flex-1 flex flex-col justify-end p-6 gap-4">
                <div className="text-right text-6xl text-white font-light mb-8">0</div>
                <div className="grid grid-cols-4 gap-3">
                    {['AC', '+/-', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+'].map(btn => (
                        <button key={btn} className={`aspect-square rounded-full flex items-center justify-center text-2xl font-medium 
                            ${isNaN(btn) && btn !== '.' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-white'}`}>
                            {btn}
                        </button>
                    ))}
                    <button className="col-span-2 bg-gray-800 text-white rounded-full flex items-center px-8 text-2xl font-medium">0</button>
                    <button className="bg-gray-800 text-white rounded-full flex items-center justify-center text-2xl font-medium">.</button>
                    <button className="bg-orange-500 text-white rounded-full flex items-center justify-center text-2xl font-medium">=</button>
                </div>
            </div>
        </div>
    );
};

export const DecoyClock = () => {
    return (
        <div className="min-h-screen bg-black text-white p-6">
            <h1 className="text-3xl font-bold mb-8">World Clock</h1>
            <div className="space-y-6">
                {[
                    { city: 'Cupertino', time: '5:21 AM', diff: 'Today, -3HRS' },
                    { city: 'New York', time: '8:21 AM', diff: 'Today, +0HRS' },
                    { city: 'London', time: '1:21 PM', diff: 'Today, +5HRS' },
                    { city: 'Tokyo', time: '9:21 PM', diff: 'Today, +13HRS' },
                ].map(item => (
                    <div key={item.city} className="flex justify-between items-center border-b border-gray-800 pb-4">
                        <div>
                            <p className="text-gray-400 text-xs uppercase tracking-widest">{item.diff}</p>
                            <h2 className="text-2xl font-semibold">{item.city}</h2>
                        </div>
                        <div className="text-4xl font-light">{item.time}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const DecoyCamera = () => {
    return (
        <div className="min-h-screen bg-black relative flex flex-col justify-between">
            <div className="p-6 flex justify-between text-white">
                <X size={24} />
                <div className="flex gap-6"><p className="font-bold">HDR</p><p>LIVE</p></div>
                <div className="w-6"></div>
            </div>
            <div className="flex-1 bg-gray-950 flex items-center justify-center">
                <Camera size={64} className="text-gray-900" />
            </div>
            <div className="p-8 space-y-8">
                <div className="flex justify-center gap-8 text-yellow-500 text-xs font-bold uppercase tracking-widest">
                    <span>Video</span>
                    <span className="text-white">Photo</span>
                    <span>Portrait</span>
                </div>
                <div className="flex justify-between items-center px-4">
                    <div className="w-12 h-12 rounded-lg bg-gray-800 border-2 border-white/20"></div>
                    <div className="w-20 h-20 rounded-full border-4 border-white p-1">
                        <div className="w-full h-full rounded-full bg-white"></div>
                    </div>
                    <button className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-white">
                        <RefreshCw size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
};

import { RefreshCw } from 'lucide-react';
