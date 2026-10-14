import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '../api';
import TideSelectionPopup from '../components/TideSelectionPopup';

const GOOGLE_CLIENT_ID = '175231524136-39m136pat1dpous6u9eijhfulpmpms1i.apps.googleusercontent.com';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isWarn, setIsWarn] = useState(false);
  const [showTidePopup, setShowTidePopup] = useState(false);
  const [gsiReady, setGsiReady] = useState(!!window.google);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
    } else {
      if (!window.google) {
        const interval = setInterval(() => {
          if (window.google) {
            setGsiReady(true);
            clearInterval(interval);
          }
        }, 200);
        return () => clearInterval(interval);
      }
    }
  }, [navigate]);

  const handleSignIn = () => {
    setError('');
    if (!window.google) { setError('Google Sign-In not loaded. Please refresh.'); return; }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: onCredential,
      ux_mode: 'popup',
    });
    window.google.accounts.id.prompt((n) => {
      if (n.isNotDisplayed() || n.isSkippedMoment()) {
        const div = document.createElement('div');
        div.style.display = 'none';
        document.body.appendChild(div);
        window.google.accounts.id.renderButton(div, { type: 'standard' });
        div.querySelector('div[role=button]')?.click();
      }
    });
  };

  const onCredential = async (response) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tl/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIsWarn(res.status === 403);
        setError(data.message || 'Sign-in failed');
        setLoading(false);
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('tl', JSON.stringify(data.tl));

      // Check if TL has Tide BT access
      try {
        const tideBTRes = await fetch(`${API_BASE}/api/tl/check-tidebt-access`, {
          headers: { 'Authorization': `Bearer ${data.token}` }
        });

        if (!tideBTRes.ok) {
          navigate('/dashboard');
          return;
        }

        const tideBTData = await tideBTRes.json();

        if (tideBTData.hasTideBTAccess) {
          setShowTidePopup(true);
          setLoading(false);
        } else {
          navigate('/dashboard');
        }
      } catch (err) {
        navigate('/dashboard');
      }
    } catch {
      setError('Server error. Please try again.');
      setLoading(false);
    }
  };

  const handleSelectTide = () => {
    setShowTidePopup(false);
    navigate('/dashboard');
  };

  const handleSelectTideBT = () => {
    setShowTidePopup(false);
    const token = localStorage.getItem('token');
    const tideBTUrl = process.env.REACT_APP_TIDEBT_URL
      || (window.location.hostname === 'localhost'
          ? 'http://localhost:3005'
          : 'https://vegavruddhi-tl-tide-bt.vercel.app');
    window.location.href = `${tideBTUrl}?token=${encodeURIComponent(token)}`;
  };

  return (
    <div style={{
      fontFamily: "'Inter', sans-serif",
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a192f 0%, #0b3c6d 50%, #0284c7 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '48px 44px',
        width: '100%', maxWidth: 420, boxShadow: '0 24px 80px rgba(0,0,0,0.35)', textAlign: 'center'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <img src="/logo-full.png" alt="Synchronous Build Digital" style={{ height: 64, width: 64, objectFit: 'contain' }} />
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0369a1', letterSpacing: '1px', textTransform: 'uppercase' }}>Synchronous</div>
          <div style={{ fontSize: 11, color: '#0284c7', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }}>Digital & Technology Solutions</div>
        </div>

        <hr style={{ border: 'none', borderTop: '1.5px solid #e2e8f0', marginBottom: 32 }} />

        <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Welcome Back 👋</div>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 36, lineHeight: 1.5 }}>
          Sign in with your registered Google account to access the TL portal.
        </p>

        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            width: '100%', padding: '14px 20px', border: '2px solid #e0e8e3',
            borderRadius: 12, background: '#fff', fontSize: 15, fontWeight: 700,
            color: '#1a2e22', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, fontFamily: "'Inter', sans-serif",
            transition: 'all 0.2s',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          {loading ? 'Signing in…' : !gsiReady ? 'Loading Google…' : 'Sign in with Google'}
        </button>

        <div style={{ marginTop: 24, padding: '14px 16px', background: '#f0f9ff', borderRadius: 10, borderLeft: '3px solid #0284c7', textAlign: 'left' }}>
          <p style={{ fontSize: 12, color: '#0369a1', lineHeight: 1.6, margin: 0 }}>
            Use the <strong style={{ color: '#0284c7' }}>email address you provided</strong> during TL registration.
          </p>
        </div>

        {error && (
          <div style={{
            marginTop: 20, padding: '14px 16px', borderRadius: 10, textAlign: 'left',
            background: isWarn ? '#fff8e1' : '#fdecea',
            borderLeft: `3px solid ${isWarn ? '#f59e0b' : '#c62828'}`,
          }}>
            <p style={{ fontSize: 13, color: isWarn ? '#e65100' : '#c62828', lineHeight: 1.5, margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ marginTop: 28, fontSize: 13, color: '#64748b' }}>
          New TL? <Link to="/register" style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}>Register here</Link>
        </div>
      </div>

      {/* Tide Selection Popup */}
      <TideSelectionPopup
        open={showTidePopup}
        onClose={() => setShowTidePopup(false)}
        onSelectTide={handleSelectTide}
        onSelectTideBT={handleSelectTideBT}
      />
    </div>
  );
}
