import React, { useState, useEffect } from 'react';
import { API_BASE } from '../api';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function MyTeam() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [tl,        setTl]        = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [teamForms, setTeamForms] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/tl/profile`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => { if (r.status === 401) { localStorage.clear(); navigate('/'); } return r.json(); })
      .then(setTl).catch(console.error);
  }, [token, navigate]);

  useEffect(() => {
    fetch(`${API_BASE}/api/tl/employees`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => setEmployees(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch(`${API_BASE}/api/tl/team-forms`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => setTeamForms(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [token]);

  const working = employees.filter(e => e.status === 'Working' || e.status === 'Active').length;
  const left    = employees.filter(e => e.status === 'Left' || e.status === 'Not Working').length;

  const totalResponses  = teamForms.length;
  const readyForOnboard = teamForms.filter(f => f.status === 'Ready for Onboarding').length;
  const notInterested   = teamForms.filter(f => f.status === 'Not Interested').length;
  const tryNotDone      = teamForms.filter(f => f.status === 'Try but not done due to error').length;
  const needVisit       = teamForms.filter(f => f.status === 'Need to visit again').length;

  const formKpis = [
    { label: 'Total Responses',    value: totalResponses,  color: '#1a4731', border: '#1a4731' },
    { label: 'Ready for Onboarding', value: readyForOnboard, color: '#2e7d32', border: '#2e7d32' },
    { label: 'Not Interested',     value: notInterested,   color: '#c62828', border: '#c62828' },
    { label: 'Try but Not Done',   value: tryNotDone,      color: '#e65100', border: '#e65100' },
    { label: 'Need to Visit Again',value: needVisit,       color: '#1565c0', border: '#1565c0' },
  ];

  return (
    <>
      <Navbar tl={tl} />
      <div className="main-content">

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '8px 16px', background: '#fff', border: '1.5px solid #dde8dd', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--green-dark)', cursor: 'pointer' }}>← Dashboard</button>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green-dark)' }}>👥 My Team</div>
        </div>

        <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
          <div className="kpi-card kpi-total">
            <div className="kpi-label">👥 Total FSE</div>
            <div className="kpi-value">{employees.length}</div>
          </div>
          <div className="kpi-card kpi-onboard">
            <div className="kpi-label">✅ Working</div>
            <div className="kpi-value">{working}</div>
          </div>
          <div className="kpi-card kpi-notint">
            <div className="kpi-label">❌ Left / Not Working</div>
            <div className="kpi-value">{left}</div>
          </div>
        </div>

        {/* FSE Form Response KPIs */}
        <div className="section-title" style={{ marginBottom: 12 }}>FSE Form Responses</div>
        <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 24 }}>
          {formKpis.map(k => (
            <div key={k.label} className="kpi-card" style={{ borderTopColor: k.border }}>
              <div className="kpi-label" style={{ fontSize: 9 }}>{k.label.toUpperCase()}</div>
              <div className="kpi-value" style={{ fontSize: 22, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="merchants-loading">Loading team members...</div>
        ) : employees.length === 0 ? (
          <div className="merchants-empty">No team members found.</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font)' }}>
              <thead>
                <tr style={{ background: 'var(--green-dark)', color: '#fff' }}>
                  {['#', 'Name', 'Phone', 'Location', 'Status'].map(h => (
                    <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => {
                  const isWorking = emp.status === 'Working' || emp.status === 'Active';
                  return (
                    <tr key={emp._id}
                      style={{ borderBottom: '1px solid #f0f5f0', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f6fbf7'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-light)', fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--green-dark), var(--green-mid))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                            {emp.newJoinerName?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>{emp.newJoinerName || '–'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{emp.position || 'FSE'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-mid)' }}>{emp.newJoinerPhone || '–'}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-mid)' }}>{emp.location || '–'}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: isWorking ? '#e6f4ea' : '#fdecea', color: isWorking ? '#2e7d32' : '#c62828' }}>
                          {isWorking ? '✓ Working' : '✗ Left'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
