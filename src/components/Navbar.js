import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ tl, notificationCount, onNotificationClick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const logout = (e) => {
    e.preventDefault();
    localStorage.clear();
    navigate('/');
  };

  const initials = tl?.name
    ? tl.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <nav className="navbar">
      <div className="nav-logo">
        <a href="/dashboard" onClick={e => { e.preventDefault(); navigate('/dashboard'); }}>
          <img src="/logo-full.png" alt="Vegavruddhi Pvt. Ltd." />
        </a>
      </div>
      <div className="nav-right">
        {/* Tasks Link */}
        <div 
          onClick={() => navigate('/tasks')}
          style={{ 
            marginRight: 1, 
            cursor: 'pointer',
            padding: '8px 5px',
            borderRadius: 20,
            background: notificationCount > 0 ? 'rgba(255,255,255,0.15)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s',
            border: notificationCount > 0 ? '2px solid rgba(255,255,255,0.3)' : '2px solid transparent',
            position: 'relative'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = notificationCount > 0 ? 'rgba(255,255,255,0.15)' : 'transparent'}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
            Tasks
          </span>
          {notificationCount > 0 && (
            <span style={{
              background: '#d32f2f',
              color: '#fff',
              borderRadius: '50%',
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 800
            }}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </div>
        
        <div className="nav-profile" ref={ref} onClick={(e) => { if (e.target.closest('a')) return; setOpen(p => !p); }}>
          <div className="nav-avatar">
            {tl?.image ? <img src={tl.image} alt="avatar" /> : initials}
          </div>
          <div className="nav-info">
            <div className="name">{tl?.name || 'Loading...'}</div>
            <div className="status-badge">Team Lead</div>
          </div>
          <span className="nav-chevron">▾</span>
          <div className={`dropdown-menu${open ? ' open' : ''}`}>
            <div className="dropdown-header">
              <div className="dh-name">{tl?.name || '–'}</div>
              <div className="dh-email">{tl?.email || '–'}</div>
            </div>
            <a href="/dashboard" onClick={e => { e.preventDefault(); navigate('/dashboard'); }}>🏠&nbsp; Dashboard</a>
            <a href="/profile"   onClick={e => { e.preventDefault(); navigate('/profile'); }}>👤&nbsp; My Profile</a>
            <a href="#logout" className="logout" onClick={logout}>🚪&nbsp; Logout</a>
          </div>
        </div>
      </div>
    </nav>
  );
}
