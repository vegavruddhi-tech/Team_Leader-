import React, { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../api';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', location: '', phone: '',
    emailId: '', reportingManager: '', position: 'Team Lead', dob: '',
  });
  const [photo, setPhoto]               = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [cvFile, setCvFile]             = useState(null);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');

  // Clear error on mount
  useEffect(() => { setError(''); }, []);
  const [loading, setLoading]           = useState(false);
  const [camOpen, setCamOpen]           = useState(false);
  const videoRef  = useRef();
  const canvasRef = useRef();
  const streamRef = useRef();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const setPhotoFile = (file) => {
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      setCamOpen(true);
    } catch (err) { alert('Camera error: ' + err.message); }
  };

  useEffect(() => {
    if (!camOpen) return;
    if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [camOpen]);

  const capture = () => {
    const canvas = canvasRef.current, video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      setPhotoFile(new File([blob], 'photo-' + Date.now() + '.jpg', { type: 'image/jpeg' }));
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCamOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!photo) { setError('Profile photo is required'); return; }

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('photo', photo);
    if (cvFile) fd.append('cv', cvFile);

    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/tl/register`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Registration failed'); return; }
      setSuccess('✓ Registration successful! Redirecting to login...');
      setTimeout(() => navigate('/'), 2000);
    } catch { setError('Server error. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-logo">
          <img src="/logo-full.png" alt="Vegavruddhi Pvt. Ltd." />
          <span className="tagline">TL Panel — Registration</span>
        </div>
        <hr className="auth-divider" />
        <h2>Team Lead Registration</h2>
        <p className="subtitle">VV – TL Registration Details</p>

        {error   && <div className="error-msg"   style={{ display: 'block' }}>{error}</div>}
        {success && <div className="success-msg" style={{ display: 'block' }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Profile Photo <span className="req">*</span></label>
            <div className="photo-upload-box">
              <div className="photo-preview-wrap">
                <div className="photo-preview" style={photoPreview ? { backgroundImage: `url(${photoPreview})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                  {!photoPreview && '👤'}
                </div>
              </div>
              <div className="photo-actions">
                <button type="button" className="photo-btn" onClick={openCamera}>📷 Take Photo</button>
                <label className="photo-btn">
                  🖼 Choose from Gallery
                  <input type="file" accept="image/*" onChange={e => e.target.files[0] && setPhotoFile(e.target.files[0])} />
                </label>
              </div>
              <div className="file-name">{photo ? photo.name : 'No photo selected'}</div>
            </div>
          </div>

          <div className="form-group">
            <label>Upload CV <span className="req">*</span></label>
            <div className="file-upload-box">
              <label className="file-label">
                📄 Add File <small style={{ fontWeight: 400, color: '#888' }}>(PDF/DOC · Max 10 MB)</small>
                <input type="file" accept=".pdf,.doc,.docx" onChange={e => setCvFile(e.target.files[0])} />
              </label>
              <div className="file-name">{cvFile ? cvFile.name : 'No file chosen'}</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Full Name <span className="req">*</span></label>
              <input type="text" value={form.name} onChange={set('name')} placeholder="Full name" required />
            </div>
            <div className="form-group">
              <label>Location <span className="req">*</span></label>
              <input type="text" value={form.location} onChange={set('location')} placeholder="City / Office" required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone Number <span className="req">*</span></label>
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 XXXXX XXXXX" required />
            </div>
            <div className="form-group">
              <label>Email ID <span className="req">*</span></label>
              <input type="email" value={form.emailId} onChange={set('emailId')} placeholder="joiner@email.com" required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Reporting Manager <span className="req">*</span></label>
              <input type="text" value={form.reportingManager} onChange={set('reportingManager')} placeholder="Manager name" required />
            </div>
            <div className="form-group">
              <label>Date of Birth <span className="req">*</span></label>
              <input type="date" value={form.dob} onChange={set('dob')} required max={new Date().toISOString().split('T')[0]} />
            </div>

          </div>
<input type="hidden" value="Team Lead" />
          {/* <div className="form-row">
            <div className="form-group">
              <label>Date of Birth <span className="req">*</span></label>
              <input type="date" value={form.dob} onChange={set('dob')} required max={new Date().toISOString().split('T')[0]} />
            </div>
          </div> */}

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Registration'}
          </button>
        </form>

        <div className="auth-link">
          Already registered? <Link to="/">Sign in here</Link>
        </div>
      </div>

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
    </div>
  );
}
