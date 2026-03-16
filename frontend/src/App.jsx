import { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Home = lazy(() => import('./pages/Home'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
const CallLogs = lazy(() => import('./pages/CallLogs'))
const { DecoySettings, DecoyCalculator, DecoyClock, DecoyCamera } = lazy(() => import('./pages/DecoyApps'))


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
        <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-slate-950 text-slate-800 dark:text-white font-medium text-lg">Loading...</div>}>
          <main>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/home" element={<Home />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/calls" element={<CallLogs />} />
              <Route path="/decoy/settings" element={<DecoySettings />} />
              <Route path="/decoy/calc" element={<DecoyCalculator />} />
              <Route path="/decoy/clock" element={<DecoyClock />} />
              <Route path="/decoy/camera" element={<DecoyCamera />} />
            </Routes>
          </main>
        </Suspense>
      </BrowserRouter>
    </>
  )
}

export default App
