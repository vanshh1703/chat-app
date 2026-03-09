import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import CallLogs from './pages/CallLogs'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  useEffect(() => {
    const applyTheme = () => {
      const pref = localStorage.getItem('themePreference') || 'light';
      if (pref === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (pref === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', isDark);
      }
    };

    applyTheme();

    const storageListener = (e) => {
      if (e.key === 'themePreference') applyTheme();
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const mediaListener = () => {
      if (localStorage.getItem('themePreference') === 'system') applyTheme();
    };

    window.addEventListener('storage', storageListener);
    mediaQuery.addEventListener('change', mediaListener);

    return () => {
      window.removeEventListener('storage', storageListener);
      mediaQuery.removeEventListener('change', mediaListener);
    };
  }, []);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/home" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/calls" element={<CallLogs />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
