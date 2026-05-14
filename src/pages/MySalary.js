import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:4000';

export default function MySalary() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [emp, setEmp] = useState(null);
  const [salarySlips, setSalarySlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [viewModal, setViewModal] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  // Load profile
  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    fetch(`${API_BASE}/api/auth/profile`, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => {
        if (r.status === 401) {
          localStorage.clear();
          navigate('/');
        }
        return r.json();
      })
      .then(setEmp)
      .catch(console.error);
  }, [token, navigate]);

  // Load salary slips
  const loadSalarySlips = useCallback(async () => {
    if (!emp?.email) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/salary/employee/${encodeURIComponent(emp.email)}?year=${selectedYear}`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Failed to load salary slips');
      const data = await res.json();
      setSalarySlips(data.slips || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [emp?.email, selectedYear, token]);

  useEffect(() => {
    loadSalarySlips();
  }, [loadSalarySlips]);

  // View slip details
  const handleViewSlip = (slip) => {
    setSelectedSlip(slip);
    setViewModal(true);
  };

  // Download PDF (placeholder - will implement later)
  const handleDownloadPDF = (slip) => {
    if (slip.pdfUrl) {
      setPdfUrl(slip.pdfUrl);
      setPdfViewerOpen(true);
    } else {
      alert('PDF not available yet');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return { bg: '#e6f4ea', color: '#2e7d32', label: 'Paid' };
      case 'sent': return { bg: '#e3f2fd', color: '#1565c0', label: 'Sent' };
      case 'generated': return { bg: '#fff8e1', color: '#f57f17', label: 'Generated' };
      case 'draft': return { bg: '#f5f5f5', color: '#666', label: 'Draft' };
      default: return { bg: '#f5f5f5', color: '#666', label: status };
    }
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <>
      <Navbar emp={emp} taskCount={0} token={token} />
      <div className="page-container" style={{ minHeight: 'calc(100vh - 140px)', padding: '24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a4731', marginBottom: 8 }}>
              💰 My Salary Slips
            </h1>
            <p style={{ fontSize: 14, color: '#666' }}>
              View and download your salary slips
            </p>
          </div>

          {error && (
            <div style={{ padding: 16, background: '#fdecea', border: '1px solid #c62828', borderRadius: 8, marginBottom: 24, color: '#c62828' }}>
              {error}
            </div>
          )}

          {/* Year Filter */}
          <div style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>Filter by Year:</label>
            {years.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                style={{
                  padding: '8px 20px',
                  background: selectedYear === year ? '#1a4731' : '#fff',
                  color: selectedYear === year ? '#fff' : '#333',
                  border: selectedYear === year ? 'none' : '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {year}
              </button>
            ))}
          </div>

          {/* Salary Slips List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <div>Loading salary slips...</div>
            </div>
          ) : salarySlips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: '#f9f9f9', borderRadius: 12 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#555', marginBottom: 6 }}>
                No salary slips found
              </div>
              <div style={{ fontSize: 14, color: '#aaa' }}>
                Salary slips for {selectedYear} will appear here
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {salarySlips.map(slip => {
                const statusInfo = getStatusColor(slip.status);
                return (
                  <div
                    key={slip._id}
                    style={{
                      background: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: 12,
                      padding: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                  >
                    {/* Left: Month/Year */}
                    <div style={{ flex: '0 0 140px' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#1a4731' }}>
                        {slip.month} {slip.year}
                      </div>
                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                        Generated: {new Date(slip.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>

                    {/* Middle: Points & Salary */}
                    <div style={{ flex: 1, display: 'flex', gap: 24 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                          Points Earned
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#1565c0' }}>
                          {slip.pointsEarned} pts
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                          Total Salary
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#2e7d32' }}>
                          ₹{slip.totalSalary.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Right: Status & Actions */}
                    <div style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      <div
                        style={{
                          padding: '6px 14px',
                          background: statusInfo.bg,
                          color: statusInfo.color,
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}
                      >
                        {statusInfo.label}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewSlip(slip); }}
                          style={{
                            padding: '8px 16px',
                            background: '#1a4731',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          👁 View
                        </button>
                        {slip.pdfUrl && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownloadPDF(slip); }}
                            style={{
                              padding: '8px 16px',
                              background: '#d32f2f',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            📄 PDF
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      {viewModal && selectedSlip && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setViewModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1000,
              animation: 'fadeIn 0.2s'
            }}
          />
          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#fff',
              borderRadius: 16,
              padding: 32,
              maxWidth: 600,
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              zIndex: 1001,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              animation: 'slideUp 0.3s'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1a4731', marginBottom: 4 }}>
                  Salary Slip Details
                </h2>
                <p style={{ fontSize: 14, color: '#666' }}>
                  {selectedSlip.month} {selectedSlip.year}
                </p>
              </div>
              <button
                onClick={() => setViewModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: '#999',
                  padding: 0,
                  width: 32,
                  height: 32
                }}
              >
                ✕
              </button>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 4 }}>Employee Name</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{selectedSlip.employeeName}</div>
              </div>

              <div style={{ padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{selectedSlip.employeeEmail}</div>
              </div>

              <div style={{ padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 4 }}>Role</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{selectedSlip.role}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 16, background: '#e3f2fd', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#1565c0', fontWeight: 600, marginBottom: 4 }}>Points Earned</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1565c0' }}>{selectedSlip.pointsEarned}</div>
                </div>

                <div style={{ padding: 16, background: '#e3f2fd', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#1565c0', fontWeight: 600, marginBottom: 4 }}>Point Value</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1565c0' }}>₹{selectedSlip.pointValue}</div>
                </div>
              </div>

              <div style={{ padding: 20, background: '#e6f4ea', borderRadius: 8, border: '2px solid #2e7d32' }}>
                <div style={{ fontSize: 12, color: '#2e7d32', fontWeight: 600, marginBottom: 4 }}>Total Salary</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#2e7d32' }}>
                  ₹{selectedSlip.totalSalary.toLocaleString('en-IN')}
                </div>
              </div>

              {selectedSlip.paymentDate && (
                <div style={{ padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 4 }}>Payment Date</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>
                    {new Date(selectedSlip.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              )}

              {selectedSlip.paymentMode && (
                <div style={{ padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 4 }}>Payment Mode</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{selectedSlip.paymentMode}</div>
                </div>
              )}

              {selectedSlip.remarks && (
                <div style={{ padding: 16, background: '#fff8e1', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#f57f17', fontWeight: 600, marginBottom: 4 }}>Remarks</div>
                  <div style={{ fontSize: 14, color: '#333' }}>{selectedSlip.remarks}</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              {selectedSlip.pdfUrl && (
                <button
                  onClick={() => handleDownloadPDF(selectedSlip)}
                  style={{
                    padding: '12px 24px',
                    background: '#1a4731',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📄 Download PDF
                </button>
              )}
              <button
                onClick={() => setViewModal(false)}
                style={{
                  padding: '12px 24px',
                  background: '#fff',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* PDF Viewer Modal */}
      {pdfViewerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setPdfViewerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 2000,
              animation: 'fadeIn 0.2s'
            }}
          />
          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#fff',
              borderRadius: 16,
              width: '95%',
              maxWidth: 1200,
              height: '90vh',
              zIndex: 2001,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              animation: 'slideUp 0.3s',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '20px 24px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a4731', margin: 0 }}>
                📄 Salary Slip PDF
              </h2>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  onClick={() => window.open(pdfUrl, '_blank')}
                  style={{
                    padding: '8px 16px',
                    background: '#1a4731',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Open in New Tab
                </button>
                <button
                  onClick={() => setPdfViewerOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 24,
                    cursor: 'pointer',
                    color: '#999',
                    padding: 0,
                    width: 32,
                    height: 32
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            {/* PDF Viewer */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <iframe
                src={pdfUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
                title="Salary Slip PDF"
              />
            </div>
          </div>
        </>
      )}

      <Footer />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, -45%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </>
  );
}
