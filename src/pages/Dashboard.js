import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const STATUS_COLOR = {
  'Ready for Onboarding':          { color: '#2e7d32', bg: '#e6f4ea' },
  'Not Interested':                { color: '#c62828', bg: '#fdecea' },
  'Try but not done due to error': { color: '#e65100', bg: '#fff3e0' },
  'Need to visit again':           { color: '#1565c0', bg: '#e3f2fd' },
};

const POINTS_MAP = { 
  'Tide': 2, 
  'Tide MSME': 0.3,
  'Tide Insurance': 1, 
  'Tide Credit Card': 1,
  'Tide BT': 1,
};

const normalizeProduct = (product) => {
  const p = (product || '').toLowerCase().trim();
  if (p === 'tide insurance' || p === 'insurance') return 'Tide Insurance';
  if (p === 'tide' || p === 'tide onboarding') return 'Tide';
  if (p === 'msme' || p === 'tide msme') return 'Tide MSME';
  if (p === 'tide credit card' || p === 'credit card') return 'Tide Credit Card';
  if (p === 'tide bt' || p === 'bt') return 'Tide BT';
  return product; // fallback
};

export default function Dashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [tl,         setTl]         = useState(null);
  const [stats,      setStats]      = useState({ total: 0, working: 0, left: 0 });
  const [employees,  setEmployees]  = useState([]);
  const [myForms,    setMyForms]    = useState([]);
  const [teamForms,  setTeamForms]  = useState([]);
  const [modal,      setModal]      = useState(null);
  const [activeTab,  setActiveTab]  = useState('team'); // 'my' | 'team'
  const [fseFormModal, setFseFormModal] = useState(null); // { title, forms[] }
  const [selectedFSE, setSelectedFSE] = useState(null); // { name, forms[] }
  const [fseVerifyData, setFseVerifyData] = useState({}); // { formId: verificationData }
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [fsePoints, setFsePoints] = useState({}); // { fseName: points }
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate,   setFromDate]   = useState('');
  const [toDate,     setToDate]     = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/tl/profile`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => { if (r.status === 401) { localStorage.clear(); navigate('/'); } return r.json(); })
      .then(setTl).catch(console.error);
  }, [token, navigate]);

  const loadStats = useCallback(() => {
    fetch(`${API_BASE}/api/tl/stats`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(data => setStats(data || { total: 0, working: 0, left: 0 }))
      .catch(console.error);
  }, [token]);

  const loadEmployees = useCallback(() => {
    fetch(`${API_BASE}/api/tl/employees`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(data => setEmployees(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [token]);

  const loadForms = useCallback(() => {
    fetch(`${API_BASE}/api/tl/my-forms`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(data => setMyForms(Array.isArray(data) ? data : []))
      .catch(console.error);
    fetch(`${API_BASE}/api/tl/team-forms`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(data => setTeamForms(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [token]);

  useEffect(() => { loadStats(); loadEmployees(); loadForms(); }, [loadStats, loadEmployees, loadForms]);

  // Calculate points for each FSE
  useEffect(() => {
    if (teamForms.length === 0) return;
    
    // Fetch verification for all team forms
    const phones   = teamForms.map(f => f.customerNumber).join(',');
    const names    = teamForms.map(f => encodeURIComponent(f.customerName || '')).join(',');
    const products = teamForms.map(f => encodeURIComponent((f.formFillingFor || f.tideProduct || f.brand || '').toLowerCase().trim())).join(',');
    const months   = teamForms.map(f => encodeURIComponent(new Date(f.createdAt).toLocaleString('en-US', { month: 'long', year: 'numeric' }))).join(',');
    
    fetch(`${API_BASE}/api/verify/bulk-admin?phones=${encodeURIComponent(phones)}&names=${names}&products=${products}&months=${months}`, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(verifyMap => {
        // Calculate points per FSE
        const pointsByFSE = {};
        
        teamForms.forEach(form => {
          const fseName = form.employeeName || 'Unknown';
          const product = (form.formFillingFor || form.tideProduct || form.brand || '').toLowerCase().trim();
          const vKey = product ? `${form.customerNumber}__${product}` : form.customerNumber;
          const verification = verifyMap[vKey];
          
          if (verification && verification.status === 'Fully Verified') {
            const productName = form.formFillingFor || (form.brand === 'Tide' && form.tideProduct ? form.tideProduct : form.brand) || '';
            const points = POINTS_MAP[normalizeProduct(productName)] || 0;
            
            if (!pointsByFSE[fseName]) {
              pointsByFSE[fseName] = { total: 0, counted: new Set() };
            }
            
            // Deduplicate by customerNumber + product
            const dedupKey = `${form.customerNumber}__${productName.toLowerCase().trim()}`;
            if (!pointsByFSE[fseName].counted.has(dedupKey)) {
              pointsByFSE[fseName].counted.add(dedupKey);
              pointsByFSE[fseName].total += points;
            }
          }
        });
        
        // Convert to simple object with just totals
        const finalPoints = {};
        Object.keys(pointsByFSE).forEach(name => {
          finalPoints[name] = Math.round(pointsByFSE[name].total * 10) / 10;
        });
        
        setFsePoints(finalPoints);
      })
      .catch(console.error);
  }, [teamForms, token]);

  // Fetch verification data when FSE modal opens
  useEffect(() => {
    if (!selectedFSE) return;
    setLoadingVerify(true);
    setFseVerifyData({}); // Clear old data first
    
    // Use bulk-admin API (same as admin panel) for consistent results
    const phones   = selectedFSE.forms.map(f => f.customerNumber).join(',');
    const names    = selectedFSE.forms.map(f => encodeURIComponent(f.customerName || '')).join(',');
    const products = selectedFSE.forms.map(f => encodeURIComponent((f.formFillingFor || f.tideProduct || f.brand || '').toLowerCase().trim())).join(',');
    const months   = selectedFSE.forms.map(f => encodeURIComponent(new Date(f.createdAt).toLocaleString('en-US', { month: 'long', year: 'numeric' }))).join(',');
    
    fetch(`${API_BASE}/api/verify/bulk-admin?phones=${encodeURIComponent(phones)}&names=${names}&products=${products}&months=${months}&_t=${Date.now()}`, {
      headers: { 
        Authorization: 'Bearer ' + token,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
      .then(r => r.json())
      .then(verifyMap => {
        const map = {};
        selectedFSE.forms.forEach(form => {
          const product = (form.formFillingFor || form.tideProduct || form.brand || '').toLowerCase().trim();
          const vKey = product ? `${form.customerNumber}__${product}` : form.customerNumber;
          const verification = verifyMap[vKey];
          if (verification) {
            map[form._id] = { verification, phoneCheck: {} };
          }
        });
        setFseVerifyData(map);
        setLoadingVerify(false);
      })
      .catch(() => {
        setFseVerifyData({});
        setLoadingVerify(false);
      });
  }, [selectedFSE, token]);

  const kpis = [
    { label: 'Total FSE',          value: stats.total,   cls: 'kpi-total',  icon: '👥', key: 'total' },
    { label: 'Working',            value: stats.working, cls: 'kpi-onboard',icon: '✅', key: 'working' },
    { label: 'Left / Not Working', value: stats.left,    cls: 'kpi-notint', icon: '❌', key: 'left' },
  ];

  const initials = tl?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const getModalFSEs = () => {
    if (modal === 'total')   return employees;
    if (modal === 'working') return employees.filter(e => e.status === 'Active' || e.status === 'Working');
    if (modal === 'left')    return employees.filter(e => e.status !== 'Active' && e.status !== 'Working');
    return [];
  };

  const modalTitles = { total: '👥 All FSEs', working: '✅ Working FSEs', left: '❌ Left / Not Working FSEs' };

  const activeForms = (() => {
    let list = activeTab === 'my' ? myForms : teamForms;
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateFilter === 'today') list = list.filter(f => new Date(f.createdAt) >= today);
    else if (dateFilter === 'week') {
      const ws = new Date(today); ws.setDate(today.getDate() - today.getDay());
      list = list.filter(f => new Date(f.createdAt) >= ws);
    } else if (dateFilter === 'month') {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1);
      list = list.filter(f => new Date(f.createdAt) >= ms);
    } else if (dateFilter === 'custom' && (fromDate || toDate)) {
      list = list.filter(f => {
        const d = new Date(f.createdAt);
        if (fromDate && d < new Date(fromDate)) return false;
        if (toDate   && d > new Date(toDate + 'T23:59:59')) return false;
        return true;
      });
    }
    return list;
  })();

  return (
    <>
      <Navbar tl={tl} />
      <div className="main-content">

        {/* Welcome */}
        <div className="welcome-card" style={{ flexDirection: 'row', alignItems: 'center', padding: '16px 20px', position: 'relative' }}>
          <div className="welcome-avatar" style={{ width: 44, height: 44, fontSize: 16, flexShrink: 0 }}>
            {tl?.image ? <img src={tl.image} alt="avatar" /> : initials}
          </div>
          <div className="welcome-text" style={{ textAlign: 'left', marginLeft: 12 }}>
            <h2 style={{ fontSize: 16, marginBottom: 2 }}>Welcome, {tl?.name?.split(' ')[0] || ''}!</h2>
            <p style={{ fontSize: 12, opacity: 0.85 }}>Team Lead · {tl?.location}</p>
          </div>
        </div>

        {/* Quick Overview */}
        <div className="section-title">Quick Overview</div>
        <div className="info-grid" style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
          {[
            { icon: '💼', label: 'Position',         value: 'Team Lead' },
            { icon: '📍', label: 'Location',          value: tl?.location },
            { icon: '👤', label: 'Reporting Manager', value: tl?.reportingManager },
            { icon: '●',  label: 'Status',            value: tl?.status || 'Active' },
          ].map(c => (
            <div className="info-card" key={c.label} style={{ padding: '4px 8px', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div className="label" style={{ fontSize: 7, marginBottom: 0 }}>{c.label}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value || '–'}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="section-title" style={{ marginTop: 10 }}>Actions</div>
        <Link to="/merchant-form" className="action-card">
          <div className="action-icon">📋</div>
          <div className="action-text">
            <div className="action-title">Fill Merchant Visit Form</div>
            <div className="action-sub">Submit details after a merchant meeting</div>
          </div>
          <div className="action-arrow">›</div>
        </Link>
        

        {/* Team KPIs */}
        <div className="section-title" style={{ marginTop: 10 }}>Team KPIs</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
          {kpis.map(k => (
            <div key={k.label} className={`kpi-card ${k.cls}`}
              style={{ padding: '4px 8px', flex: 1, minWidth: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1 }}
              onClick={() => setModal(k.key)}>
              <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-light)', lineHeight: 1.2 }}>{k.icon} {k.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1 }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="section-title" style={{ marginTop: 10 }}>FSE Form Responses</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
          {[
            { label: 'Total',      value: teamForms.length,                                                              color: '#1a4731', border: '#1a4731', filter: () => teamForms },
            { label: 'Onboarding', value: teamForms.filter(f => f.status === 'Ready for Onboarding').length,            color: '#2e7d32', border: '#2e7d32', filter: () => teamForms.filter(f => f.status === 'Ready for Onboarding') },
            { label: 'Not Int.',   value: teamForms.filter(f => f.status === 'Not Interested').length,                  color: '#c62828', border: '#c62828', filter: () => teamForms.filter(f => f.status === 'Not Interested') },
            { label: 'Try/Err',    value: teamForms.filter(f => f.status === 'Try but not done due to error').length,   color: '#e65100', border: '#e65100', filter: () => teamForms.filter(f => f.status === 'Try but not done due to error') },
            { label: 'Revisit',    value: teamForms.filter(f => f.status === 'Need to visit again' || f.status === 'Need to Visit again').length, color: '#1565c0', border: '#1565c0', filter: () => teamForms.filter(f => f.status === 'Need to visit again' || f.status === 'Need to Visit again') },
          ].map(k => (
            <div key={k.label} className="kpi-card" style={{ padding: '4px 8px', flex: 1, minWidth: 0, borderTopColor: k.border, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1 }}
              onClick={() => setFseFormModal({ title: k.label, forms: k.filter() })}>
              <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-light)', lineHeight: 1.2 }}>{k.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Merchant Forms Section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>Merchant Visit Forms</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setActiveTab('team')} style={{ padding: '6px 16px', borderRadius: 20, border: '1.5px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: activeTab === 'team' ? 'var(--green-dark)' : '#fff', color: activeTab === 'team' ? '#fff' : 'var(--green-dark)', borderColor: 'var(--green-dark)' }}>
              Team Forms ({teamForms.length})
            </button>
            <button onClick={() => setActiveTab('my')} style={{ padding: '6px 16px', borderRadius: 20, border: '1.5px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: activeTab === 'my' ? 'var(--green-dark)' : '#fff', color: activeTab === 'my' ? '#fff' : 'var(--green-dark)', borderColor: 'var(--green-dark)' }}>
              My Forms ({myForms.length})
            </button>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div className="date-filter-bar">
            {['all','today','week','month'].map(f => (
              <button key={f} className={`date-filter-btn${dateFilter === f ? ' active' : ''}`}
                onClick={() => { setDateFilter(f); setFromDate(''); setToDate(''); }}>
                {f === 'all' ? 'All' : f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
            <div className="date-filter-custom">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              <span style={{ color: '#888', fontSize: 12 }}>to</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              <button className="date-filter-btn" onClick={() => setDateFilter('custom')}>Apply</button>
            </div>
          </div>
        </div>

        {activeForms.length === 0 ? (
          <div className="merchants-empty">
            {activeTab === 'my' ? 'No merchant visits yet. Fill your first form above.' : 'No forms submitted by your team yet.'}
          </div>
        ) : activeTab === 'my' ? (
          // My Forms — show list directly
          activeForms.map((form, i) => {
            const sc   = STATUS_COLOR[form.status] || { color: '#333', bg: '#f5f5f5' };
            const date = new Date(form.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            return (
              <Link to={`/merchant/${form._id}`} key={form._id} className="merchant-row" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="mr-avatar">{form.customerName?.charAt(0).toUpperCase()}</div>
                <div className="mr-info">
                  <div className="mr-name">{form.customerName}</div>
                  <div className="mr-meta">
                    <span>📞 {form.customerNumber}</span>
                    <span>📍 {form.location}</span>
                  </div>
                </div>
                <div className="mr-right">
                  <span className="mr-status" style={{ background: sc.bg, color: sc.color }}>{form.status}</span>
                  <span className="mr-date">{date}</span>
                </div>
              </Link>
            );
          })
        ) : (
          // Team Forms — group by FSE name, show FSE list
          (() => {
            // Group forms by employeeName
            const grouped = {};
            teamForms.forEach(f => {
              const name = f.employeeName || 'Unknown';
              if (!grouped[name]) grouped[name] = [];
              grouped[name].push(f);
            });
            return Object.entries(grouped).map(([fseName, forms], i) => {
              const ready   = forms.filter(f => f.status === 'Ready for Onboarding').length;
              const notInt  = forms.filter(f => f.status === 'Not Interested').length;
              const tryErr  = forms.filter(f => f.status === 'Try but not done due to error').length;
              const revisit = forms.filter(f => f.status === 'Need to visit again' || f.status === 'Need to Visit again').length;
              const points = fsePoints[fseName] || 0;
              
              return (
                <div key={fseName} className="merchant-row" style={{ cursor: 'pointer', animationDelay: `${i * 0.05}s`, flexWrap: 'wrap', padding: '8px 12px' }}
                  onClick={() => setSelectedFSE({ name: fseName, forms })}>
                  <div className="mr-avatar" style={{ background: 'linear-gradient(135deg, #1a4731, #2d6a4f)', width: 30, height: 30, fontSize: 12 }}>
                    {fseName.charAt(0).toUpperCase()}
                  </div>
                  <div className="mr-info" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="mr-name" style={{ fontSize: 12 }}>{fseName}</div>
                      {points > 0 && (
                        <span style={{ background: '#e6f4ea', color: '#2e7d32', padding: '1px 6px', borderRadius: 10, fontSize: 8, fontWeight: 800, border: '1.5px solid #a8d5b5' }}>
                          ⭐ {points} pts
                        </span>
                      )}
                    </div>
                    <div className="mr-meta" style={{ gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                      <span style={{ background: '#e6f4ea', color: '#2e7d32', padding: '1px 6px', borderRadius: 10, fontSize: 9, fontWeight: 700 }}>✅ Onboarding: {ready}</span>
                      <span style={{ background: '#fdecea', color: '#c62828', padding: '1px 6px', borderRadius: 10, fontSize: 9, fontWeight: 700 }}>❌ Not Int: {notInt}</span>
                      <span style={{ background: '#fff3e0', color: '#e65100', padding: '1px 6px', borderRadius: 10, fontSize: 9, fontWeight: 700 }}>⚠️ Try: {tryErr}</span>
                      <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '1px 6px', borderRadius: 10, fontSize: 9, fontWeight: 700 }}>🔄 Revisit: {revisit}</span>
                    </div>
                  </div>
                  <div className="mr-right">
                    <span style={{ background: '#e6f4ea', color: '#2e7d32', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{forms.length}</span>
                    <span className="mr-date" style={{ fontSize: 9 }}>View Forms ›</span>
                  </div>
                </div>
              );
            });
          })()
        )}

      </div>
      <Footer />

      {/* FSE Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
        <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '85vh', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f5f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--green-dark)', margin: 0 }}>{modalTitles[modal]}</h3>
              <button onClick={() => setModal(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#f5f5f5', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', overflowX: 'auto', flex: 1 }}>
              {getModalFSEs().length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)' }}>No FSEs found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font)', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '18%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--green-dark)', color: '#fff', position: 'sticky', top: 0 }}>
                      {['#','Name','Email','Phone','Status'].map(h => (
                        <th key={h} style={{ padding: '10px 6px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', overflow: 'hidden' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getModalFSEs().map((emp, i) => {
                      const isWorking = emp.status === 'Active' || emp.status === 'Working';
                      return (
                        <tr key={emp._id || i} style={{ borderBottom: '1px solid #f0f5f0' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f6fbf7'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                          <td style={{ padding: '10px 6px', fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ padding: '10px 6px', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--green-dark), var(--green-mid))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                                {(emp.newJoinerName || '?').charAt(0).toUpperCase()}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.newJoinerName || '–'}</div>
                            </div>
                          </td>
                          <td style={{ padding: '10px 6px', fontSize: 10, color: 'var(--text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.emailId || '–'}</td>
                          <td style={{ padding: '10px 6px', fontSize: 10, color: 'var(--text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.newJoinerPhone || '–'}</td>
                          <td style={{ padding: '10px 6px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 20, fontSize: 9, fontWeight: 700, background: isWorking ? '#e6f4ea' : '#fdecea', color: isWorking ? '#2e7d32' : '#c62828', whiteSpace: 'nowrap' }}>
                              {isWorking ? '✓ Work' : '✗ Left'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f5f0', textAlign: 'right' }}>
              <button onClick={() => setModal(null)} style={{ padding: '8px 18px', background: 'var(--green-dark)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}
      {/* FSE Form KPI Modal */}
      {fseFormModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}
          onClick={e => { if (e.target === e.currentTarget) setFseFormModal(null); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '80vh', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f5f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--green-dark)', margin: 0 }}>📋 {fseFormModal.title}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>{fseFormModal.forms.length} form{fseFormModal.forms.length !== 1 ? 's' : ''}</div>
              </div>
              <button onClick={() => setFseFormModal(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#f5f5f5', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {fseFormModal.forms.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)' }}>No forms found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font)', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '24%' }} />
                    <col style={{ width: '24%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--green-dark)', color: '#fff', position: 'sticky', top: 0 }}>
                      {['#', 'FSE', 'Customer', 'Phone', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 6px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fseFormModal.forms.map((form, i) => {
                      const sc = STATUS_COLOR[form.status] || { color: '#333', bg: '#f5f5f5' };
                      const shortStatus = form.status === 'Ready for Onboarding' ? 'Onboarding'
                        : form.status === 'Not Interested' ? 'Not Int.'
                        : form.status === 'Try but not done due to error' ? 'Try/Err'
                        : (form.status === 'Need to visit again' || form.status === 'Need to Visit again') ? 'Revisit'
                        : form.status;
                      return (
                        <tr key={form._id || i} style={{ borderBottom: '1px solid #f0f5f0' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f6fbf7'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                          <td style={{ padding: '10px 6px', fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ padding: '10px 6px', fontSize: 12, fontWeight: 700, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.employeeName || '–'}</td>
                          <td style={{ padding: '10px 6px', fontSize: 12, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.customerName || '–'}</td>
                          <td style={{ padding: '10px 6px', fontSize: 11, color: 'var(--text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.customerNumber || '–'}</td>
                          <td style={{ padding: '10px 6px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 5px', borderRadius: 20, fontSize: 9, fontWeight: 700, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
                              {shortStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f5f0', textAlign: 'right' }}>
              <button onClick={() => setFseFormModal(null)} style={{ padding: '8px 18px', background: 'var(--green-dark)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* FSE Forms Modal */}
      {selectedFSE && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedFSE(null); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '85vh', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f0f5f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--green-dark)', margin: 0 }}>📋 {selectedFSE.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>{selectedFSE.forms.length} form{selectedFSE.forms.length > 1 ? 's' : ''} submitted</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button 
                  onClick={() => {
                    // Force refresh verification data using bulk-admin API
                    setLoadingVerify(true);
                    setFseVerifyData({});
                    
                    const phones   = selectedFSE.forms.map(f => f.customerNumber).join(',');
                    const names    = selectedFSE.forms.map(f => encodeURIComponent(f.customerName || '')).join(',');
                    const products = selectedFSE.forms.map(f => encodeURIComponent((f.formFillingFor || f.tideProduct || f.brand || '').toLowerCase().trim())).join(',');
                    const months   = selectedFSE.forms.map(f => encodeURIComponent(new Date(f.createdAt).toLocaleString('en-US', { month: 'long', year: 'numeric' }))).join(',');
                    
                    fetch(`${API_BASE}/api/verify/bulk-admin?phones=${encodeURIComponent(phones)}&names=${names}&products=${products}&months=${months}&_t=${Date.now()}`, {
                      headers: { 
                        Authorization: 'Bearer ' + token,
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache'
                      }
                    })
                      .then(r => r.json())
                      .then(verifyMap => {
                        const map = {};
                        selectedFSE.forms.forEach(form => {
                          const product = (form.formFillingFor || form.tideProduct || form.brand || '').toLowerCase().trim();
                          const vKey = product ? `${form.customerNumber}__${product}` : form.customerNumber;
                          const verification = verifyMap[vKey];
                          if (verification) {
                            map[form._id] = { verification, phoneCheck: {} };
                          }
                        });
                        setFseVerifyData(map);
                        setLoadingVerify(false);
                      })
                      .catch(() => {
                        setFseVerifyData({});
                        setLoadingVerify(false);
                      });
                  }}
                  style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#e6f4ea', color: 'var(--green-dark)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Refresh verification data">
                  🔄
                </button>
                <button onClick={() => setSelectedFSE(null)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f5f5f5', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
              {loadingVerify && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-light)' }}>Loading verification data...</div>
              )}
              {selectedFSE.forms.map((form, i) => {
                const sc   = STATUS_COLOR[form.status] || { color: '#333', bg: '#f5f5f5' };
                const date = new Date(form.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                const vData = fseVerifyData[form._id];
                const v = vData?.verification || {};
                const VBADGE = { 
                  'Fully Verified': { bg: '#e6f4ea', color: '#2e7d32', icon: '✓' }, 
                  'Partially Done': { bg: '#fff8e1', color: '#f57f17', icon: '◑' }, 
                  'Not Verified': { bg: '#fdecea', color: '#c62828', icon: '✗' }, 
                  'Not Found': { bg: '#f5f5f5', color: '#888', icon: '–' } 
                };
                const vb = VBADGE[v.status] || VBADGE['Not Found'];
                
                return (
                  <div key={form._id}
                    style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', marginBottom: 10, border: '1.5px solid #e8f0e8' }}>
                    {/* Header Row */}
                    <Link to={`/merchant/${form._id}`}
                      onClick={() => setSelectedFSE(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--green-dark), var(--green-mid))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                        {form.customerName?.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.customerName}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 1 }}>📞 {form.customerNumber}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 700, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>{form.status}</span>
                        <div style={{ fontSize: 9, color: 'var(--text-light)', marginTop: 2 }}>{date}</div>
                      </div>
                    </Link>
                    
                    {/* Details Grid - Mobile Optimized */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
                      {/* Product */}
                      <div style={{ background: '#f9f9f9', padding: '4px 6px', borderRadius: 6 }}>
                        <div style={{ fontSize: 8, color: 'var(--text-light)', marginBottom: 1 }}>Product</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {form.formFillingFor || form.tideProduct || form.brand || '–'}
                        </div>
                      </div>
                      
                      {/* Location */}
                      <div style={{ background: '#f9f9f9', padding: '4px 6px', borderRadius: 6 }}>
                        <div style={{ fontSize: 8, color: 'var(--text-light)', marginBottom: 1 }}>Location</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {form.location || '–'}
                        </div>
                      </div>
                      
                      {/* Verification Status */}
                      <div style={{ background: vb.bg, padding: '4px 6px', borderRadius: 6, gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 8, color: vb.color, marginBottom: 1, opacity: 0.8 }}>Verification Status</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: vb.color }}>
                          {vb.icon} {v.status || 'Not Found'}
                          {v.passed !== undefined && (
                            <span style={{ marginLeft: 6, fontSize: 8, opacity: 0.9 }}>
                              ({v.passed}/{v.total} checks passed)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Verification Conditions - Only if available */}
                    {v.checks && v.checks.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {v.checks.map((check, idx) => (
                          <span key={idx} style={{ 
                            fontSize: 8, 
                            padding: '2px 5px', 
                            borderRadius: 10, 
                            background: check.pass ? '#e6f4ea' : '#fdecea',
                            color: check.pass ? '#2e7d32' : '#c62828',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                          }}>
                            {check.pass ? '✓' : '✗'} {check.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f0f5f0', textAlign: 'right' }}>
              <button onClick={() => setSelectedFSE(null)} style={{ padding: '9px 20px', background: 'var(--green-dark)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
