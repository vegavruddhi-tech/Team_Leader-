import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../api';

function TLNotificationPanel({ token, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch(`${API_BASE}/api/tl/my-notifications`, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(data => { setNotifications(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    await fetch(`${API_BASE}/api/tl/my-notifications/${id}/acknowledge`, {
      method: 'PUT', headers: { Authorization: 'Bearer ' + token }
    });
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, acknowledged: true } : n));
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.acknowledged);
    await Promise.all(unread.map(n =>
      fetch(`${API_BASE}/api/tl/my-notifications/${n._id}/acknowledge`, {
        method: 'PUT', headers: { Authorization: 'Bearer ' + token }
      })
    ));
    setNotifications(prev => prev.map(n => ({ ...n, acknowledged: true })));
  };

  const unreadCount = notifications.filter(n => !n.acknowledged).length;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.25)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, maxWidth: '95vw',
        background: '#fff', zIndex: 1001, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a4731' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>🔔 Team Updates</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Mark all read
              </button>
            )}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading…</div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔕</div>
              <div style={{ fontWeight: 700, color: '#555' }}>No updates yet</div>
            </div>
          ) : notifications.map(n => {
            const isRead = n.acknowledged;
            const isAdd = Number(n.adjustment) >= 0;
            const accentColor = isAdd ? '#1565c0' : '#c62828';
            const date = new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            return (
              <div key={n._id} style={{
                padding: '14px 16px', borderBottom: '1px solid #f0f0f0',
                background: isRead ? '#fff' : '#f0f7ff',
                borderLeft: `4px solid ${accentColor}`,
                opacity: isRead ? 0.8 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{isAdd ? '⭐' : '📉'}</span>
                      <span style={{ fontWeight: 800, fontSize: 13, color: accentColor }}>
                        FSE Points {isAdd ? 'Added' : 'Deducted'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 600, marginBottom: 4 }}>
                      <b style={{ color: accentColor }}>{n.fseName}</b> — {isAdd ? '+' : ''}{n.adjustment} pts
                    </div>
                    {n.beforeTotal !== undefined && n.newTotal !== undefined && (
                      <div style={{ display: 'flex', gap: 0, background: '#f5f5f5', borderRadius: 6, overflow: 'hidden', marginBottom: 6, border: `1px solid ${accentColor}20` }}>
                        <div style={{ flex: 1, textAlign: 'center', padding: '4px 8px', background: '#f5f5f5' }}>
                          <div style={{ fontSize: 9, color: '#888', fontWeight: 600 }}>BEFORE</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#555' }}>{n.beforeTotal} pts</div>
                        </div>
                        <div style={{ padding: '0 6px', fontSize: 14, color: accentColor, fontWeight: 800, display: 'flex', alignItems: 'center' }}>→</div>
                        <div style={{ flex: 1, textAlign: 'center', padding: '4px 8px', background: isAdd ? '#e8f4fd' : '#fdecea' }}>
                          <div style={{ fontSize: 9, color: accentColor, fontWeight: 600 }}>AFTER</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: accentColor }}>{n.newTotal} pts</div>
                        </div>
                      </div>
                    )}
                    {n.reason && <div style={{ fontSize: 11, color: '#333', marginBottom: 3 }}>📝 {n.reason}</div>}
                    <div style={{ fontSize: 10, color: '#999' }}>{date}</div>
                  </div>
                  {!isRead ? (
                    <button onClick={() => markRead(n._id)} style={{ padding: '4px 10px', background: accentColor, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      Mark read
                    </button>
                  ) : (
                    <span style={{ fontSize: 10, color: '#aaa', flexShrink: 0 }}>✓ Read</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #eee', fontSize: 11, color: '#aaa', textAlign: 'center' }}>
          {notifications.length} total · history is never deleted
        </div>
      </div>
    </>
  );
}

export default function Navbar({ tl, notificationCount, onNotificationClick }) {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const refreshCount = useCallback(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/tl/my-notifications`, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUnreadCount(data.filter(n => !n.acknowledged).length); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 15000);
    return () => clearInterval(interval);
  }, [refreshCount]);

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
    <>
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
            marginRight: 8,
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 20,
            background: notificationCount > 0 ? 'rgba(255,255,255,0.15)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s',
            border: notificationCount > 0 ? '2px solid rgba(255,255,255,0.3)' : '2px solid transparent',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = notificationCount > 0 ? 'rgba(255,255,255,0.15)' : 'transparent'}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Tasks</span>
          {notificationCount > 0 && (
            <span style={{ background: '#d32f2f', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </div>

        {/* 🔔 Points Update Notification Bell */}
        <div
          onClick={() => setNotifOpen(true)}
          style={{
            position: 'relative', marginRight: 8, cursor: 'pointer',
            width: 40, height: 40, borderRadius: '50%',
            background: unreadCount > 0 ? '#1a4731' : 'rgba(26,71,49,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: unreadCount > 0 ? '2px solid #40916c' : '2px solid transparent',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 18 }}>🔔</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: '#e53935', color: '#fff', borderRadius: '50%',
              width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, border: '2px solid #fff',
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
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
            <a href="/my-team"   onClick={e => { e.preventDefault(); navigate('/my-team'); }}>👥&nbsp; My Team</a>
            <a href="/profile"   onClick={e => { e.preventDefault(); navigate('/profile'); }}>👤&nbsp; My Profile</a>
            <a href="#logout" className="logout" onClick={logout}>🚪&nbsp; Logout</a>
          </div>
        </div>
      </div>
    </nav>
    {notifOpen && (
      <TLNotificationPanel
        token={token}
        onClose={() => { setNotifOpen(false); refreshCount(); }}
      />
    )}
    </>
  );
}
