import React, { useState, useEffect } from 'react';
import { API_BASE } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Tasks() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [tl, setTl] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [adminTasks, setAdminTasks] = useState([]);
  const [filter, setFilter] = useState('unread'); // 'unread', 'all'
  const [adminFilter, setAdminFilter] = useState('pending'); // 'pending', 'completed', 'all'
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('team'); // 'team' | 'my'
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/tl/profile`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => { if (r.status === 401) { localStorage.clear(); navigate('/'); } return r.json(); })
      .then(setTl).catch(console.error);
  }, [token, navigate]);

  useEffect(() => {
    loadTasks();
    loadAdminTasks();
  }, [token]);

  const loadTasks = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/tasks/tl-tasks?status=completed`, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(data => {
        setTasks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const loadAdminTasks = () => {
    fetch(`${API_BASE}/api/tasks/my-admin-tasks`, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(data => {
        setAdminTasks(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error(err);
      });
  };

  const handleTaskClick = async (task) => {
    // Mark as read
    await fetch(`${API_BASE}/api/tasks/tl-notifications/${task._id}/read`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token }
    });

    // Refresh tasks
    loadTasks();

    // Navigate to merchant form
    navigate(`/merchant/${task.merchantId}`);
  };

  const handleCompleteTask = (task) => {
    setSelectedTask(task);
    setCompletionNotes('');
    setCompleteModalOpen(true);
  };

  const handleSubmitCompletion = async () => {
    if (!completionNotes.trim()) {
      alert('Please provide completion notes');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${selectedTask._id}/complete-tl`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          completionNotes: completionNotes.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to complete task');
      }

      alert('Task marked as completed!');
      setCompleteModalOpen(false);
      setSelectedTask(null);
      setCompletionNotes('');
      loadAdminTasks();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks = filter === 'unread' 
    ? tasks.filter(t => !t.tlNotified)
    : tasks;

  const filteredAdminTasks = adminFilter === 'all'
    ? adminTasks
    : adminFilter === 'urgent'
    ? adminTasks.filter(t => t.status === 'pending' && t.priority === 'urgent')
    : adminTasks.filter(t => t.status === adminFilter);

  const unreadCount = tasks.filter(t => !t.tlNotified).length;
  const pendingAdminCount = adminTasks.filter(t => t.status === 'pending').length;
  const completedAdminCount = adminTasks.filter(t => t.status === 'completed').length;

  return (
    <>
      <Navbar tl={tl} notificationCount={unreadCount + pendingAdminCount} />
      <div className="main-content">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--green-dark)', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>📋</span>
            <span>Task Management</span>
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-light)', marginTop: 8 }}>
            Manage tasks from your team and admin
          </p>
        </div>

        {/* Main Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #f0f0f0' }}>
          {[
            { key: 'team', label: 'Team Tasks', count: unreadCount, icon: '👥' },
            { key: 'my', label: 'My Tasks', count: pendingAdminCount, icon: '📌' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 24px',
                background: activeTab === tab.key ? 'var(--green-dark)' : 'transparent',
                color: activeTab === tab.key ? '#fff' : 'var(--text-mid)',
                border: 'none',
                borderBottom: activeTab === tab.key ? '3px solid var(--green-dark)' : '3px solid transparent',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                borderRadius: '12px 12px 0 0',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span style={{
                  background: activeTab === tab.key ? '#fff' : '#ff9800',
                  color: activeTab === tab.key ? 'var(--green-dark)' : '#fff',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800
                }}>
                  {tab.count > 9 ? '9+' : tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Team Tasks Tab */}
        {activeTab === 'team' && (
          <>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 150, background: 'linear-gradient(135deg, #ff9800, #f57c00)', padding: '16px 20px', borderRadius: 16, color: '#fff', boxShadow: '0 4px 12px rgba(255,152,0,0.3)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', opacity: 0.9 }}>New Notifications</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{unreadCount}</div>
              </div>
              <div style={{ flex: 1, minWidth: 150, background: 'linear-gradient(135deg, #2e7d32, #1b5e20)', padding: '16px 20px', borderRadius: 16, color: '#fff', boxShadow: '0 4px 12px rgba(46,125,50,0.3)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', opacity: 0.9 }}>Total Completed</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{tasks.length}</div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #f0f0f0' }}>
              {[
                { key: 'unread', label: 'New', count: unreadCount },
                { key: 'all', label: 'All', count: tasks.length }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  style={{
                    padding: '12px 24px',
                    background: filter === tab.key ? 'var(--green-dark)' : 'transparent',
                    color: filter === tab.key ? '#fff' : 'var(--text-mid)',
                    border: 'none',
                    borderBottom: filter === tab.key ? '3px solid var(--green-dark)' : '3px solid transparent',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    borderRadius: '12px 12px 0 0',
                    transition: 'all 0.2s'
                  }}>
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Tasks List */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-light)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Loading tasks...</div>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-light)' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No tasks found</div>
                <div style={{ fontSize: 14 }}>
                  {filter === 'unread' ? 'You have no new notifications' : 'No completed tasks yet'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {filteredTasks.map(task => {
                  const isNew = !task.tlNotified;
                  const isFullyVerified = task.verificationAfterCompletion?.status === 'Fully Verified';

                  return (
                    <div
                      key={task._id}
                      onClick={() => handleTaskClick(task)}
                      style={{
                        background: '#fff',
                        borderRadius: 16,
                        padding: '20px 24px',
                        border: isNew ? '3px solid #ff9800' : '2px solid #e0e0e0',
                        boxShadow: isNew ? '0 4px 16px rgba(255,152,0,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                      
                      {/* New Badge */}
                      {isNew && (
                        <div style={{
                          position: 'absolute',
                          top: -10,
                          right: 20,
                          background: '#ff9800',
                          color: '#fff',
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 10,
                          fontWeight: 800,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}>
                          🔔 NEW
                        </div>
                      )}

                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <div style={{
                              width: 48,
                              height: 48,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 18,
                              fontWeight: 800,
                              flexShrink: 0
                            }}>
                              {task.fseName ? task.fseName.charAt(0).toUpperCase() : 'F'}
                            </div>
                            <div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-dark)' }}>
                                Task Completed by {task.fseName || 'FSE'}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>
                                {new Date(task.completedAt).toLocaleString('en-IN')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Merchant Info */}
                      <div style={{
                        background: '#f9f9f9',
                        padding: '14px 16px',
                        borderRadius: 12,
                        marginBottom: 16
                      }}>
                        <div style={{ fontSize: 11, color: '#666', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>
                          Merchant Details
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
                          {task.merchantName}
                        </div>
                        <div style={{ fontSize: 13, color: '#666' }}>
                          📞 {task.merchantPhone} • {task.product}
                        </div>
                      </div>

                      {/* Verification Status After Completion */}
                      {task.verificationAfterCompletion && task.verificationAfterCompletion.status && (
                        <div style={{ 
                          background: isFullyVerified ? '#e6f4ea' : '#fff8e1',
                          border: `2px solid ${isFullyVerified ? '#2e7d32' : '#ff9800'}`,
                          padding: '14px 16px',
                          borderRadius: 12,
                          marginBottom: 16
                        }}>
                          <div style={{ 
                            fontSize: 13, 
                            fontWeight: 800, 
                            color: isFullyVerified ? '#2e7d32' : '#e65100',
                            marginBottom: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}>
                            <span style={{ fontSize: 18 }}>{isFullyVerified ? '✅' : '🔍'}</span>
                            <span>Current Verification: {task.verificationAfterCompletion.status}</span>
                          </div>
                          
                          {task.verificationAfterCompletion.passedConditions && task.verificationAfterCompletion.passedConditions.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 10, color: '#2e7d32', fontWeight: 700, marginBottom: 4 }}>✓ Verified:</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {task.verificationAfterCompletion.passedConditions.map((cond, i) => (
                                  <span key={i} style={{ 
                                    background: '#e6f4ea', 
                                    color: '#2e7d32', 
                                    padding: '4px 10px', 
                                    borderRadius: 12, 
                                    fontSize: 11, 
                                    fontWeight: 600,
                                    border: '1px solid #a8d5b5'
                                  }}>
                                    ✓ {cond}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {task.verificationAfterCompletion.failedConditions && task.verificationAfterCompletion.failedConditions.length > 0 && (
                            <div>
                              <div style={{ fontSize: 10, color: '#c62828', fontWeight: 700, marginBottom: 4 }}>✗ Still Pending:</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {task.verificationAfterCompletion.failedConditions.map((cond, i) => (
                                  <span key={i} style={{ 
                                    background: '#fdecea', 
                                    color: '#c62828', 
                                    padding: '4px 10px', 
                                    borderRadius: 12, 
                                    fontSize: 11, 
                                    fontWeight: 600,
                                    border: '1px solid #f5a5a5'
                                  }}>
                                    ✗ {cond}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Completion Notes */}
                      {task.completionNotes && (
                        <div style={{ 
                          background: '#e3f2fd', 
                          padding: '12px 14px', 
                          borderRadius: 10,
                          border: '1px solid #90caf9',
                          marginBottom: 12
                        }}>
                          <div style={{ fontSize: 10, color: '#1565c0', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>
                            FSE Notes:
                          </div>
                          <div style={{ fontSize: 13, color: '#1a1a1a', fontStyle: 'italic' }}>
                            "{task.completionNotes}"
                          </div>
                        </div>
                      )}

                      {/* View Details Button */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'flex-end',
                        paddingTop: 12,
                        borderTop: '1px solid #f0f0f0'
                      }}>
                        <div style={{
                          color: 'var(--green-dark)',
                          fontSize: 13,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          View Merchant Details
                          <span style={{ fontSize: 16 }}>→</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* My Tasks Tab (Admin Assigned) */}
        {activeTab === 'my' && (
          <>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 150, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', padding: '16px 20px', borderRadius: 16, color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', opacity: 0.9 }}>Pending Tasks</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{pendingAdminCount}</div>
              </div>
              <div style={{ flex: 1, minWidth: 150, background: 'linear-gradient(135deg, #2e7d32, #1b5e20)', padding: '16px 20px', borderRadius: 16, color: '#fff', boxShadow: '0 4px 12px rgba(46,125,50,0.3)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', opacity: 0.9 }}>Completed</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{completedAdminCount}</div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #f0f0f0' }}>
              {[
                { key: 'pending', label: 'Pending', count: pendingAdminCount },
                { key: 'urgent', label: '🔥 Urgent', count: adminTasks.filter(t => t.status === 'pending' && t.priority === 'urgent').length },
                { key: 'completed', label: 'Completed', count: completedAdminCount },
                { key: 'all', label: 'All', count: adminTasks.length }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setAdminFilter(tab.key)}
                  style={{
                    padding: '12px 24px',
                    background: adminFilter === tab.key ? (tab.key === 'urgent' ? '#d32f2f' : '#7c3aed') : 'transparent',
                    color: adminFilter === tab.key ? '#fff' : 'var(--text-mid)',
                    border: 'none',
                    borderBottom: adminFilter === tab.key ? `3px solid ${tab.key === 'urgent' ? '#d32f2f' : '#7c3aed'}` : '3px solid transparent',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    borderRadius: '12px 12px 0 0',
                    transition: 'all 0.2s'
                  }}>
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Admin Tasks List */}
            {filteredAdminTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-light)' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No tasks found</div>
                <div style={{ fontSize: 14 }}>
                  {adminFilter === 'pending' ? 'No pending tasks from admin' : adminFilter === 'completed' ? 'No completed tasks yet' : 'No tasks assigned yet'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {filteredAdminTasks.map(task => {
                  const isPending = task.status === 'pending';
                  const isUrgent = task.priority === 'urgent';

                  return (
                    <div
                      key={task._id}
                      style={{
                        background: '#fff',
                        borderRadius: 16,
                        padding: '20px 24px',
                        border: isUrgent ? '3px solid #d32f2f' : isPending ? '2px solid #7c3aed' : '2px solid #e0e0e0',
                        boxShadow: isUrgent ? '0 4px 16px rgba(211,47,47,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}>
                      
                      {/* Urgent Badge */}
                      {isUrgent && (
                        <div style={{
                          position: 'absolute',
                          top: -10,
                          right: 20,
                          background: '#d32f2f',
                          color: '#fff',
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 10,
                          fontWeight: 800,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}>
                          🔥 URGENT
                        </div>
                      )}

                      {/* Header */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            fontWeight: 800,
                            flexShrink: 0
                          }}>
                            👤
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-dark)' }}>
                              {task.title}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>
                              From: {task.assignedByName} • {new Date(task.createdAt).toLocaleString('en-IN')}
                            </div>
                          </div>
                          {isPending && (
                            <div style={{
                              background: '#7c3aed',
                              color: '#fff',
                              padding: '6px 12px',
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 800
                            }}>
                              PENDING
                            </div>
                          )}
                          {!isPending && (
                            <div style={{
                              background: '#2e7d32',
                              color: '#fff',
                              padding: '6px 12px',
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 800
                            }}>
                              ✓ COMPLETED
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Instructions */}
                      <div style={{
                        background: '#f9f9f9',
                        padding: '14px 16px',
                        borderRadius: 12,
                        marginBottom: 16
                      }}>
                        <div style={{ fontSize: 11, color: '#666', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>
                          Instructions
                        </div>
                        <div style={{ fontSize: 14, color: '#1a1a1a', lineHeight: 1.6 }}>
                          {task.instructions}
                        </div>
                      </div>

                      {/* Deadline */}
                      {task.deadline && (
                        <div style={{
                          background: isUrgent ? '#fdecea' : '#fff8e1',
                          border: `1px solid ${isUrgent ? '#d32f2f' : '#ff9800'}`,
                          padding: '10px 14px',
                          borderRadius: 10,
                          marginBottom: 16,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          <span style={{ fontSize: 16 }}>⏰</span>
                          <div>
                            <div style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Deadline</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: isUrgent ? '#d32f2f' : '#e65100' }}>
                              {new Date(task.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Completion Notes */}
                      {task.completionNotes && (
                        <div style={{ 
                          background: '#e6f4ea', 
                          padding: '12px 14px', 
                          borderRadius: 10,
                          border: '1px solid #a8d5b5',
                          marginBottom: 12
                        }}>
                          <div style={{ fontSize: 10, color: '#2e7d32', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>
                            Your Completion Notes:
                          </div>
                          <div style={{ fontSize: 13, color: '#1a1a1a', fontStyle: 'italic' }}>
                            "{task.completionNotes}"
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      {isPending && (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'flex-end',
                          paddingTop: 12,
                          borderTop: '1px solid #f0f0f0'
                        }}>
                          <button
                            onClick={() => handleCompleteTask(task)}
                            style={{
                              background: '#7c3aed',
                              color: '#fff',
                              border: 'none',
                              padding: '10px 20px',
                              borderRadius: 10,
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#6d28d9'}
                            onMouseLeave={e => e.currentTarget.style.background = '#7c3aed'}>
                            ✓ Mark as Complete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Complete Task Modal */}
        {completeModalOpen && selectedTask && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}>
            <div style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 500,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '2px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed' }}>✓ Complete Task</div>
                  <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 4 }}>
                    {selectedTask.title}
                  </div>
                </div>
                <button
                  onClick={() => !submitting && setCompleteModalOpen(false)}
                  disabled={submitting}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 24,
                    cursor: 'pointer',
                    color: '#666',
                    padding: 0,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: 24 }}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 8 }}>
                    Completion Notes *
                  </label>
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Describe what you did to complete this task..."
                    disabled={submitting}
                    style={{
                      width: '100%',
                      minHeight: 120,
                      padding: 12,
                      border: '2px solid #e0e0e0',
                      borderRadius: 10,
                      fontSize: 14,
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '2px solid #f0f0f0',
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setCompleteModalOpen(false)}
                  disabled={submitting}
                  style={{
                    background: '#f5f5f5',
                    color: '#666',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}>
                  Cancel
                </button>
                <button
                  onClick={handleSubmitCompletion}
                  disabled={submitting}
                  style={{
                    background: '#7c3aed',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: submitting ? 0.6 : 1
                  }}>
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
