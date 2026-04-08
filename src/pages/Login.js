import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '../api';

const GOOGLE_CLIENT_ID = '175231524136-39m136pat1dpous6u9eijhfulpmpms1i.apps.googleusercontent.com';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [isWarn,  setIsWarn]  = useState(false);

  useEffect(() => {
    if (localStorage.getItem('token')) navigate('/dashboard');
  }, [navigate]);

  const handleSignIn = () => {
    setError('');
    if (!window.google) { setError('Google Sign-In not loaded. Please refresh.'); return; }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback:  onCredential,
      ux_mode:   'popup',
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
      const res  = await fetch(`${API_BASE}/api/tl/google-login`, {
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
      navigate('/dashboard');
    } catch {
      setError('Server error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo-full.png" alt="Vegavruddhi Pvt. Ltd." />
          <span className="tagline">TL Panel — Team Lead Portal</span>
        </div>
        <hr className="auth-divider" />
        <h2>Welcome Back 👋</h2>
        <p className="subtitle">Sign in with your registered Google account to access the TL portal.</p>

        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            width: '100%', padding: '13px 20px',
            border: '1.5px solid #dde8dd', borderRadius: 8,
            background: '#fff', fontSize: 15, fontWeight: 700,
            color: 'var(--text-dark)', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, fontFamily: 'var(--font)',
            transition: 'all 0.2s', marginTop: 8,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading ? 'Signing in…' : 'Sign in with Google'}
        </button>

        <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--green-pale)', borderRadius: 8, borderLeft: '3px solid var(--green-light)' }}>
          <p style={{ fontSize: 12, color: 'var(--green-dark)', lineHeight: 1.6, margin: 0 }}>
            Use the <strong>email address you provided</strong> during TL registration.
          </p>
        </div>

        {error && (
          <div className="error-msg" style={{ display: 'block', background: isWarn ? '#fff8e1' : undefined, color: isWarn ? '#e65100' : undefined, borderColor: isWarn ? '#f57f17' : undefined }}>
            {error}
          </div>
        )}

        <div className="auth-link">
          New TL? <Link to="/register">Register here</Link>
        </div>
      </div>
    </div>
  );
}
