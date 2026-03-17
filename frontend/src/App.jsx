import { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Home = lazy(() => import('./pages/Home'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
const CallLogs = lazy(() => import('./pages/CallLogs'))
const { DecoySettings, DecoyCalculator, DecoyClock, DecoyCamera } = lazy(() => import('./pages/DecoyApps'))

const ProtectedRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('profile'));
  return user ? children : <Navigate to="/" />;
};

const PublicRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('profile'));
  return user ? <Navigate to="/home" /> : children;
};

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
              <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/calls" element={<ProtectedRoute><CallLogs /></ProtectedRoute>} />
              <Route path="/decoy/settings" element={<ProtectedRoute><DecoySettings /></ProtectedRoute>} />
              <Route path="/decoy/calc" element={<ProtectedRoute><DecoyCalculator /></ProtectedRoute>} />
              <Route path="/decoy/clock" element={<ProtectedRoute><DecoyClock /></ProtectedRoute>} />
              <Route path="/decoy/camera" element={<ProtectedRoute><DecoyCamera /></ProtectedRoute>} />
            </Routes>
          </main>
        </Suspense>
      </BrowserRouter>
    </>
  )
}

export default App
