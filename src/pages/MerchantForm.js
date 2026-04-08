import React, { useState, useEffect } from 'react';
import { API_BASE } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// Updated product list per new form format
const PRODUCTS = ['Tide','Tide-BT','Insurance 2W-4W','PineLab','Tide Insurance','Tide-MSME','Tide Credit Card'];
const BRAND_NAMES = ['Tide','Tide-BT','Insurance 2W-4W','PineLab'];

function FormCard({ icon, title, sub, children }) {
  return (
    <div className="form-card">
      <div className="form-card-header">
        <div className="fch-icon">{icon}</div>
        <div><h3>{title}</h3><p>{sub}</p></div>
      </div>
      <div className="form-card-body">{children}</div>
    </div>
  );
}

function RadioGroup({ name, options, value, onChange }) {
  return (
    <div className="radio-group">
      {options.map(opt => (
        <label key={opt} className="radio-option" style={value === opt ? { borderColor: 'var(--green-dark)', background: 'var(--green-pale)', color: 'var(--green-dark)' } : {}}>
          <input type="radio" name={name} value={opt} checked={value === opt} onChange={() => onChange(opt)}
            style={{ accentColor: 'var(--green-dark)', width: 16, height: 16 }} />
          {opt}
        </label>
      ))}
    </div>
  );
}

export default function MerchantForm() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [tl, setTl] = useState(null);

  const [customerName,   setCustomerName]   = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [location,       setLocation]       = useState('');
  const [status,         setStatus]         = useState('');
  const [brandNames,     setBrandNames]     = useState([]);
  const [product,        setProduct]        = useState('');

  // Tide fields
  const [tideQR,       setTideQR]       = useState('');
  const [tideUPI,      setTideUPI]      = useState('');
  // Tide-BT fields
  const [tideBtTxn,    setTideBtTxn]    = useState('');
  // Insurance fields
  const [insVehicleNo, setInsVehicleNo] = useState('');
  const [insVehicle,   setInsVehicle]   = useState('');
  const [insType,      setInsType]      = useState('');
  // PineLab fields
  const [pineCard,     setPineCard]     = useState('');
  const [pineWifi,     setPineWifi]     = useState('');
  // Tide Insurance fields
  const [tideInsType,  setTideInsType]  = useState('');

  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [dupModal, setDupModal] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/tl/profile`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(setTl).catch(console.error);
  }, [token]);

  const isOnboarding = status === 'Ready for Onboarding';

  const toggleBrand = (val) => setBrandNames(prev =>
    prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!status) { setError('Please select a visit status.'); return; }
    if (isOnboarding && !product) { setError('Please select a product for onboarding.'); return; }

    const payload = {
      customerName, customerNumber, location, status,
      ...(isOnboarding && product ? { formFillingFor: product } : {}),
      attemptedProducts: isOnboarding ? [] : brandNames,
      tide_qrPosted:     tideQR,
      tide_upiTxnDone:   tideUPI,
      tideBt_txnDone:    tideBtTxn,
      ins_vehicleNumber: insVehicleNo,
      ins_vehicleType:   insVehicle,
      ins_insuranceType: insType,
      pine_cardTxn:      pineCard,
      pine_wifiConnected: pineWifi,
      tideIns_type:      tideInsType,
    };

    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/forms/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicate) {
        setDupModal({ name: customerName, product, existingId: data.existingId });
        return;
      }
      if (!res.ok) { setError(data.message || 'Submission failed'); return; }
      setSuccess('✓ Form submitted successfully! Redirecting...');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch { setError('Server error. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <>
      <Navbar tl={tl} />
      <div className="form-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#fff', border: '1.5px solid #dde8dd', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--green-dark)', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
          <div className="page-title" style={{ marginBottom: 0 }}>📋 VV – Day Working</div>
        </div>
        <div className="page-sub">Form Fill for Day to Day Activity</div>

        {error   && <div className="error-msg"   style={{ display: 'block' }}>{error}</div>}
        {success && <div className="success-msg" style={{ display: 'block' }}>{success}</div>}

        <form onSubmit={handleSubmit}>

          {/* Section 1 — Customer Details */}
          <FormCard icon="👥" title="Customer Details" sub="Basic merchant information">
            <div className="form-group">
              <label>Customer Name <span className="req">*</span></label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Enter customer name" required />
            </div>
            <div className="form-group">
              <label>Customer Number <span className="req">*</span></label>
              <input type="tel" value={customerNumber} onChange={e => setCustomerNumber(e.target.value)} placeholder="Enter phone number" required />
            </div>
            <div className="form-group">
              <label>Location <span className="req">*</span></label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Enter location" required />
            </div>
            <div className="form-group">
              <label>Status <span className="req">*</span></label>
              <div className="radio-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {['Ready for Onboarding','Not Interested','Try but not done due to error','Need to Visit again'].map(opt => (
                  <label key={opt} className="radio-option" style={status === opt ? { borderColor: 'var(--green-dark)', background: 'var(--green-pale)', color: 'var(--green-dark)' } : {}}>
                    <input type="radio" name="status" value={opt} checked={status === opt} onChange={() => setStatus(opt)}
                      style={{ accentColor: 'var(--green-dark)', width: 16, height: 16 }} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          </FormCard>

          {/* Section 2 — Brand Name (shown when NOT onboarding) */}
          {status && !isOnboarding && (
            <FormCard icon="🏷️" title="Brand Name" sub="Select the company/brand discussed">
              <div className="form-group">
                <label>Name of the company</label>
                <div className="checkbox-group">
                  {BRAND_NAMES.map(b => (
                    <label key={b} className="checkbox-option"
                      style={brandNames.includes(b) ? { borderColor: 'var(--green-dark)', background: 'var(--green-pale)', color: 'var(--green-dark)', fontWeight: 600 } : {}}>
                      <input type="checkbox" checked={brandNames.includes(b)} onChange={() => toggleBrand(b)}
                        style={{ accentColor: 'var(--green-dark)', width: 16, height: 16, flexShrink: 0 }} />
                      {b}
                    </label>
                  ))}
                </div>
              </div>
            </FormCard>
          )}

          {/* Section 3 — Onboarding Details */}
          {isOnboarding && (
            <FormCard icon="📄" title="Onboarding Details" sub="Select the Option">
              <div className="form-group">
                <label>Form Filling For <span className="req">*</span></label>
                <div className="radio-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {PRODUCTS.map(opt => (
                    <label key={opt} className="radio-option" style={product === opt ? { borderColor: 'var(--green-dark)', background: 'var(--green-pale)', color: 'var(--green-dark)' } : {}}>
                      <input type="radio" name="product" value={opt} checked={product === opt} onChange={() => setProduct(opt)}
                        style={{ accentColor: 'var(--green-dark)', width: 16, height: 16 }} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              {/* Tide */}
              {product === 'Tide' && (<>
                <div className="form-group"><label>QR Posted <span className="req">*</span></label><RadioGroup name="tide_qr" options={['Yes','No']} value={tideQR} onChange={setTideQR} /></div>
                <div className="form-group"><label>Rs 10/30 UPI Txn Done <span className="req">*</span></label><RadioGroup name="tide_upi" options={['Yes','No']} value={tideUPI} onChange={setTideUPI} /></div>
              </>)}

              {/* Tide-BT */}
              {product === 'Tide-BT' && (
                <div className="form-group"><label>Rs 10 Txn Done <span className="req">*</span></label><RadioGroup name="tidebt_txn" options={['Yes','No']} value={tideBtTxn} onChange={setTideBtTxn} /></div>
              )}

              {/* Insurance 2W-4W */}
              {product === 'Insurance 2W-4W' && (<>
                <div className="form-group"><label>Vehicle Number <span className="req">*</span></label><input type="text" value={insVehicleNo} onChange={e => setInsVehicleNo(e.target.value)} placeholder="e.g. MH12AB1234" style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #dde8dd', borderRadius: 8, fontSize: 14, background: '#fafcfa', outline: 'none' }} /></div>
                <div className="form-group"><label>Vehicle Type <span className="req">*</span></label><RadioGroup name="ins_vehicle" options={['2 Wheeler','4 Wheeler','Commercial']} value={insVehicle} onChange={setInsVehicle} /></div>
                <div className="form-group"><label>Insurance Type <span className="req">*</span></label><RadioGroup name="ins_type" options={['3rd Party','Only OD','OD + 3rd Party']} value={insType} onChange={setInsType} /></div>
              </>)}

              {/* PineLab */}
              {product === 'PineLab' && (<>
                <div className="form-group"><label>1 Card Txn done of Rs 100 <span className="req">*</span></label><RadioGroup name="pine_card" options={['Yes','No']} value={pineCard} onChange={setPineCard} /></div>
                <div className="form-group"><label>Machine connected with Wi-Fi <span className="req">*</span></label><RadioGroup name="pine_wifi" options={['Yes','No']} value={pineWifi} onChange={setPineWifi} /></div>
              </>)}

              {/* Tide Insurance */}
              {product === 'Tide Insurance' && (
                <div className="form-group"><label>Type of Insurance <span className="req">*</span></label><RadioGroup name="tideins" options={['Cyber Security','Accidental']} value={tideInsType} onChange={setTideInsType} /></div>
              )}

            </FormCard>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Submitting...' : '✓ Submit Form Response'}
          </button>
        </form>
      </div>

      {dupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 440, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ color: '#1a4731', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Duplicate Entry Detected</h3>
            <p style={{ color: '#555', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              You have already submitted a form for<br />
              <strong style={{ color: '#1a4731' }}>{dupModal.name}</strong> with product <strong style={{ color: '#1a4731' }}>{dupModal.product}</strong>.<br /><br />
              If the details are different, please edit the existing entry instead.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setDupModal(null)} style={{ padding: '10px 22px', border: '1.5px solid #dde8dd', borderRadius: 8, background: '#fff', color: '#1a4731', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => navigate(`/merchant/${dupModal.existingId}`)} style={{ padding: '10px 22px', border: 'none', borderRadius: 8, background: '#1a4731', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Edit Existing Entry</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
