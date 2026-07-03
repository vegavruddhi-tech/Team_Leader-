import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import MyTeam from './pages/MyTeam';
import MerchantForm from './pages/MerchantForm';
import MerchantDetail from './pages/MerchantDetail';
import Tasks from './pages/Tasks';
import MySalary from './pages/MySalary';
import InstallPWA from './components/InstallPWA';
import PullToRefresh from './components/PullToRefresh';

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/" replace />;
}

function AutoUpdateChecker() {
  useEffect(() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
    const CURRENT_SCRIPT_SRCS = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);

    const checkForUpdate = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        }
        const res = await fetch(window.location.origin + window.location.pathname + '?t=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (!res.ok) return;
        const htmlText = await res.text();
        const scriptMatches = htmlText.match(/src=["']([^"']+\.js[^"']*)["']/g);
        if (scriptMatches && CURRENT_SCRIPT_SRCS.length > 0) {
          const hasNewScript = scriptMatches.some(matchStr => {
            const src = matchStr.replace(/src=["']|["']/g, '');
            if (src.includes('http') && !src.includes(window.location.host)) return false;
            return !CURRENT_SCRIPT_SRCS.some(cur => cur.includes(src));
          });
          if (hasNewScript) {
            console.log('🚀 New deployment detected! Hard refreshing app...');
            if ('caches' in window) {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
            Object.keys(localStorage).forEach(key => {
              if (key.includes('cache') || key.includes('forms')) localStorage.removeItem(key);
            });
            window.location.reload(true);
          }
        }
      } catch (e) {}
    };

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
    window.addEventListener('focus', checkForUpdate);
    const interval = setInterval(checkForUpdate, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  return null;
}

export default function App() {
  return (
    <PullToRefresh onRefresh={() => window.location.reload(true)}>
      <BrowserRouter>
        <AutoUpdateChecker />
        <InstallPWA />
        <Routes>
          <Route path="/"              element={<Login />} />
          <Route path="/register"      element={<Register />} />
          <Route path="/dashboard"     element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/profile"       element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/my-team"       element={<PrivateRoute><MyTeam /></PrivateRoute>} />
          <Route path="/my-salary"     element={<PrivateRoute><MySalary /></PrivateRoute>} />
          <Route path="/merchant-form" element={<PrivateRoute><MerchantForm /></PrivateRoute>} />
          <Route path="/merchant/:id"  element={<PrivateRoute><MerchantDetail /></PrivateRoute>} />
          <Route path="/tasks"         element={<PrivateRoute><Tasks /></PrivateRoute>} />
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </PullToRefresh>
  );
}
