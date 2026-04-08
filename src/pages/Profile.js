import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../api';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Profile() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [tl, setTl]             = useState(null);
  const [reqModal, setReqModal] = useState(false);
  const [camOpen, setCamOpen]   = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [myRequest, setMyRequest] = useState(null);
  const videoRef  = useRef(); const canvasRef = useRef(); const streamRef = useRef();

  const [pf, setPf]             = useState({ name: '', phone: '', location: '', reportingManager: '' });
  const [reason, setReason]     = useState('');
  const [pfErr, setPfErr]       = useState('');
  const [pfOk, setPfOk]         = useState('');
  const [pfSaving, setPfSaving] = useState(false);

  const loadProfile = () => {
    fetch(`${API_BASE}/api/tl/profile`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => { if (r.status === 401) { localStorage.clear(); navigate('/'); } return r.json(); })
      .then(setTl).catch(console.error);
  };

  const loadMyRequest = () => {
    fetch(`${API_BASE}/api/tl/my-request`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(setMyRequest).catch(console.error);
  };

  useEffect(() => { loadProfile(); loadMyRequest(); }, []); // eslint-disable-line

  const openCamera = async () => {
    setPhotoMenu(false);
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      videoRef.current.srcObject = streamRef.current;
      setCamOpen(true);
    } catch (err) { alert('Camera error: ' + err.message); }
  };
  const stopCamera = () => { streamRef.current?.getTracks().forEach(t => t.stop()); setCamOpen(false); };
  const capture = () => {
    const c = canvasRef.current, v = videoRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob(blob => { stopCamera(); uploadPhoto(new File([blob], 'photo-' + Date.now() + '.jpg', { type: 'image/jpeg' })); }, 'image/jpeg', 0.9);
  };
  const uploadPhoto = async (file) => {
    const fd = new FormData(); fd.append('photo', file);
    const res  = await fetch(`${API_BASE}/api/tl/update-photo`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
    const data = await res.json();
    if (!res.ok) { alert(data.message || 'Upload failed'); return; }
    setTl(t => ({ ...t, image: data.image }));
  };

  const openReqModal = () => {
    setPf({ name: tl?.name || '', phone: tl?.phone || '', location: tl?.location || '', reportingManager: tl?.reportingManager || '' });
    setPfErr(''); setPfOk(''); setReason(''); setReqModal(true);
  };

  const sendRequest = async () => {
    if (!reason.trim()) { setPfErr('Please provide a reason for the change.'); return; }
    setPfSaving(true); setPfErr('');
    try {
      const res = await fetch(`${API_BASE}/api/tl/request-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ changes: pf, reason: reason.trim() })
      });
      const data = await res.json();
      if (!res.ok) { setPfErr(data.message || 'Failed'); return; }
      setPfOk('✓ Request sent to admin for approval!');
      loadMyRequest();
      setTimeout(() => setReqModal(false), 1800);
    } catch { setPfErr('Server error.'); }
    finally { setPfSaving(false); }
  };

  const initials = tl?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const joined   = tl?.createdAt ? new Date(tl.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '–';

  const statusColor = {
    pending:  { bg: '#fff8e1', color: '#f57f17', border: '#f9a825', label: '⏳ Pending' },
    approved: { bg: '#e6f4ea', color: '#2e7d32', border: '#a8d5b5', label: '✓ Approved' },
    rejected: { bg: '#fdecea', color: '#c62828', border: '#f5a5a5', label: '✗ Rejected' },
  };

  return (
    <>
      <Navbar tl={tl} />
      <div className="profile-page">

        {/* Request status banner */}
        {myRequest && (
          <div style={{ marginBottom: 20, padding: '14px 20px', borderRadius: 10, background: statusColor[myRequest.status]?.bg, border: `1.5px solid ${statusColor[myRequest.status]?.border}`, color: statusColor[myRequest.status]?.color, fontSize: 13, fontWeight: 600 }}>
            {statusColor[myRequest.status]?.label} — Your profile edit request is <strong>{myRequest.status}</strong>.
            {myRequest.status === 'pending' && ' Admin will review it soon.'}
            {myRequest.status === 'approved' && ' Your profile has been updated.'}
            {myRequest.status === 'rejected' && ' Please contact admin for more info.'}
          </div>
        )}

        <div className="profile-hero">
          <div className="avatar-edit-wrap" onClick={() => setPhotoMenu(p => !p)} title="Click to change photo">
            <div className="hero-avatar">
              {tl?.image ? <img src={tl.image} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : initials}
            </div>
            <div className="avatar-edit-overlay"><span className="eo-icon">✏</span>Edit Photo</div>
            {photoMenu && (
              <div style={{ position: 'absolute', top: 90, left: 0, background: '#fff', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.18)', zIndex: 200, overflow: 'hidden', minWidth: 200 }} onClick={e => e.stopPropagation()}>
                <button onClick={openCamera} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#1a4731' }}>📷 Take Photo</button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#1a4731', borderTop: '1px solid #f0f5f0' }}>
                  🖼 Choose from Gallery
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) { setPhotoMenu(false); uploadPhoto(e.target.files[0]); } }} />
                </label>
              </div>
            )}
          </div>
          <div className="hero-info">
            <h1>{tl?.name || '–'}</h1>
            <div className="hero-role">IT &amp; Business Consultation Services</div>
            <div className="hero-badges">
              <span className="hero-badge">Team Lead</span>
              <span className="hero-badge">{tl?.location || '–'}</span>
              <span className="hero-badge active">{tl?.status || 'Active'}</span>
            </div>
          </div>
          <a href="/dashboard" className="hero-back" onClick={e => { e.preventDefault(); navigate('/dashboard'); }}>← Dashboard</a>
        </div>

        <div className="profile-section">
          <div className="section-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="sec-icon">👤</div>
              <h3>Personal Information</h3>
            </div>
            <button
              className="prof-edit-btn"
              onClick={openReqModal}
              disabled={myRequest?.status === 'pending'}
              title={myRequest?.status === 'pending' ? 'You have a pending request' : ''}
              style={{ opacity: myRequest?.status === 'pending' ? 0.5 : 1, cursor: myRequest?.status === 'pending' ? 'not-allowed' : 'pointer' }}
            >
              🔔 Request Edit
            </button>
          </div>
          <div className="field-grid">
            {[
              ['Full Name',    tl?.name],
              ['Phone Number', tl?.phone],
              ['Login Email',  tl?.email],
              ['Email ID',     tl?.emailId],
              ['Date of Birth', tl?.dob],
            ].map(([lbl, val]) => (
              <div className="field-item" key={lbl}>
                <div className="f-label">{lbl}</div>
                <div className="f-value">{val || '–'}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="profile-section">
          <div className="section-header">
            <div className="sec-icon">💼</div>
            <h3>Work Information</h3>
          </div>
          <div className="field-grid">
            {[
              ['Position',          'Team Lead'],
              ['Location',          tl?.location],
              ['Reporting Manager', tl?.reportingManager],
              ['Joined On',         joined],
            ].map(([lbl, val]) => (
              <div className="field-item" key={lbl}>
                <div className="f-label">{lbl}</div>
                <div className="f-value">{val || '–'}</div>
              </div>
            ))}
            <div className="field-item">
              <div className="f-label">CV Document</div>
              <div className="f-value">
                {tl?.cv ? <a href={tl.cv} target="_blank" rel="noopener noreferrer">View CV</a> : 'Not uploaded'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Camera */}
      {camOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: 420, borderRadius: 12 }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={capture} style={{ padding: '12px 28px', background: '#1a4731', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>📷 Capture</button>
            <button onClick={stopCamera} style={{ padding: '12px 28px', background: '#555', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}>Cancel</button>
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}

      {/* Request Edit Modal */}
      {reqModal && (
        <div style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setReqModal(false); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f5f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--green-dark)', margin: 0 }}>🔔 Request Profile Edit</h3>
              <button onClick={() => setReqModal(false)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f5f5f5', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            <div style={{ padding: '16px 24px', background: '#e3f2fd', borderBottom: '1px solid #90caf9' }}>
              <p style={{ fontSize: 12, color: '#1565c0', margin: 0, lineHeight: 1.6 }}>
                ℹ Your request will be sent to admin for review. Changes will only be applied after admin approval.
              </p>
            </div>

            <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                ['Full Name',         'name',             'text', true],
                ['Phone Number',      'phone',            'tel',  false],
                ['Location',          'location',         'text', false],
                ['Reporting Manager', 'reportingManager', 'text', true],
              ].map(([lbl, key, type, full]) => (
                <div key={key} style={full ? { gridColumn: '1/-1' } : {}}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-mid)', marginBottom: 6 }}>{lbl}</label>
                  <input type={type} value={pf[key]} onChange={e => setPf(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #dde8dd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'var(--font)' }} />
                </div>
              ))}

              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-mid)', marginBottom: 6 }}>
                  Reason for change <span style={{ color: '#e53935' }}>*</span>
                </label>
                <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Why do you want to update your profile?"
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #dde8dd', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'var(--font)' }} />
              </div>

              {pfErr && <div className="error-msg"   style={{ display: 'block', gridColumn: '1/-1' }}>{pfErr}</div>}
              {pfOk  && <div className="success-msg" style={{ display: 'block', gridColumn: '1/-1' }}>{pfOk}</div>}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f5f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setReqModal(false)} style={{ padding: '10px 20px', background: '#f5f5f5', color: 'var(--text-dark)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={sendRequest} disabled={pfSaving} style={{ padding: '10px 24px', background: 'var(--green-dark)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {pfSaving ? 'Sending...' : '🔔 Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
