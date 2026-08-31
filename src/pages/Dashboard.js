import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import TideMerchantTimeline from '../components/TideMerchantTimeline';
import { subscribeUserToPush } from '../pushSubscriptionHelper';

// 🔧 VERIFICATION KEY CONSISTENCY FIX:
// Helper functions ensure consistent product extraction and key generation
// across all verification operations (fetch, count, lookup).
// This prevents key mismatches that caused "Fully Verified: 0" KPI issue.

const STATUS_COLOR = {
  'Ready for Onboarding':          { color: '#2e7d32', bg: '#e6f4ea' },
  'Not Interested':                { color: '#c62828', bg: '#fdecea' },
  'Try but not done due to error': { color: '#e65100', bg: '#fff3e0' },
  'Need to visit again':           { color: '#1565c0', bg: '#e3f2fd' },
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

// 🔧 Helper function to extract product consistently across all operations
const getFormProduct = (form) => {
  return (form.formFillingFor || form.tideProduct || form.brand || '').toLowerCase().trim();
};

// 🔧 Helper function to generate verification key consistently
const getVerificationKey = (form) => {
  const product = getFormProduct(form);
  const month = form.createdAt ? new Date(form.createdAt).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : '';
  return product ? `${form.customerNumber}__${product}__${month}` : `${form.customerNumber}__${month}`;
};

function formatProductDisplay(f, info) {
  const baseProduct = f.formFillingFor
    || (f.attemptedProducts?.join(', '))
    || (f.brand && f.tideProduct ? `${f.tideProduct}` : f.brand)
    || '–';

  if (baseProduct === '–') return baseProduct;
  if (baseProduct.includes('(')) return baseProduct;

  let subType = '';
  const productKey = baseProduct.toLowerCase().trim();
  const cfg = window.dynamicPointsMap?.[productKey];

  if (cfg) {
    if (cfg.type === 'mapped' && cfg.fieldMapping?.mappedColumn) {
      const col = cfg.fieldMapping.mappedColumn;
      let val = String(f[col] || '').trim();
      if (!val && info?.record) {
        val = String(info.record[col] || info.record[col.toLowerCase()] || '').trim();
      }
      if (!val && info?.checks && Array.isArray(info.checks)) {
        const match = info.checks.find(c => c.field && c.field.toLowerCase() === col.toLowerCase());
        if (match?.sheetValue) val = String(match.sheetValue).trim();
        if (!val) {
          const broader = info.checks.find(c => c.field && c.field.toLowerCase().includes(col.toLowerCase()));
          if (broader?.sheetValue) val = String(broader.sheetValue).trim();
        }
      }
      if (!val && info?.points !== undefined && Array.isArray(cfg.valueMapping)) {
        const mapped = cfg.valueMapping.find(m => Number(m.points) === Number(info.points));
        if (mapped && mapped.value) val = String(mapped.value).trim();
      }
      if (val) {
        const num = parseFloat(val);
        subType = !isNaN(num) ? `${num}` : val;
      }
    } else if (cfg.type === 'complex' && cfg.fieldMapping) {
      const planField = cfg.fieldMapping.planField || 'planName';
      const tierField = cfg.fieldMapping.tierField || 'tierName';
      const planVal = String(f[planField] || '').trim();
      const tierVal = String(f[tierField] || '').trim();
      if (planVal && tierVal) subType = `${planVal} - ${tierVal}`;
      else if (planVal) subType = planVal;
      else if (tierVal) subType = tierVal;
    }
  }

  // Generic fallback if cfg didn't catch it or wasn't loaded (specifically for Tide Insurance)
  if (!subType && productKey === 'tide insurance') {
    let val = String(f.ins_amount || f.tideIns_amount || f.amount || '').trim();
    if (!val && info?.checks && Array.isArray(info.checks)) {
      const match = info.checks.find(c => c.field && (c.field.toLowerCase() === 'amount' || c.field.toLowerCase().includes('amount') || c.field.toLowerCase().includes('plan')));
      if (match?.sheetValue) val = String(match.sheetValue).trim();
    }
    if (!val && info?.record) {
      val = String(info.record.amount || info.record.Amount || '').trim();
    }
    if (val) {
      const num = parseFloat(val);
      subType = !isNaN(num) ? `${num}` : val;
    }
  }

  let insuranceType = '';
  if (productKey === 'tide insurance' || productKey === 'insurance' || productKey.includes('insurance')) {
    const getVal = (...keys) => {
      for (const k of keys) {
        if (f?.[k]) return f[k];
        if (info?.record?.[k]) return info.record[k];
        if (info?.checks && Array.isArray(info.checks)) {
          const check = info.checks.find(c => c.field && c.field.toLowerCase() === k.toLowerCase());
          if (check?.actual || check?.sheetValue) return check.actual || check.sheetValue;
        }
      }
      return '';
    };
    insuranceType = getVal('tideIns_type', 'tideInsType', 'insurance_plan', 'ins_insuranceType', 'insuranceType', 'insurance_type');
  }

  let displayLabel = baseProduct;
  if (subType) {
    const cleanSub = String(subType).replace('₹', '');
    displayLabel += ` (₹${cleanSub})`;
  }
  if (insuranceType) {
    displayLabel += ` (${insuranceType})`;
  }
  return displayLabel;
}

export default function Dashboard() {
  const navigate = useNavigate();

  // ✅ Admin impersonation support — initialized SYNCHRONOUSLY from URL/sessionStorage
  // This runs before any useEffect so token is valid on first render
  const _initImpersonation = () => {
    const params = new URLSearchParams(window.location.search);
    const viewAs = params.get('viewAs');
    const urlToken = params.get('token') || params.get('adminToken');
    if (viewAs && urlToken) {
      sessionStorage.setItem('tl_impersonationToken', urlToken);
      sessionStorage.setItem('tl_viewAsEmail', viewAs);
      window.history.replaceState({}, '', window.location.pathname);
      return { isAdminView: true, adminViewEmail: viewAs, impersonationToken: urlToken };
    }
    const sessToken = sessionStorage.getItem('tl_impersonationToken');
    const sessEmail = sessionStorage.getItem('tl_viewAsEmail');
    if (sessToken && sessEmail) {
      return { isAdminView: true, adminViewEmail: sessEmail, impersonationToken: sessToken };
    }
    return { isAdminView: false, adminViewEmail: '', impersonationToken: null };
  };

  const [isAdminView, setIsAdminView] = useState(() => _initImpersonation().isAdminView);
  const [adminViewEmail, setAdminViewEmail] = useState(() => _initImpersonation().adminViewEmail);
  const [impersonationToken, setImpersonationToken] = useState(() => _initImpersonation().impersonationToken);

  const token = isAdminView ? impersonationToken : localStorage.getItem('token');

  const handleExitAdminView = () => {
    sessionStorage.removeItem('tl_impersonationToken');
    sessionStorage.removeItem('tl_viewAsEmail');
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      const adminUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://vegavruddhi-admin-tide-bt-cyej.vercel.app';
      window.location.href = adminUrl;
    }
  };

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
  const [verificationStats, setVerificationStats] = useState({ fullyVerified: 0, partiallyDone: 0, notFound: 0 }); // Verification KPIs
  const [verificationModal, setVerificationModal] = useState(null); // { status, products: { productName: count } }
  const [verificationDrillDown, setVerificationDrillDown] = useState(null); // { status, product, forms: [] }
  const [verificationMap, setVerificationMap] = useState({}); // Store full verification map for drill-down
  const [isLoadingVerification, setIsLoadingVerification] = useState(false); // Loading state for verification fetch
  const [taskModal, setTaskModal] = useState(null); // { form: merchantForm, verification, existingTask, canSendReminder, daysSinceCreated }
  const [taskNotificationCount, setTaskNotificationCount] = useState(0);
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate,   setFromDate]   = useState('');
  const [toDate,     setToDate]     = useState('');
  const [selYear,    setSelYear]    = useState(new Date().getFullYear().toString());
  const [selMonth,   setSelMonth]   = useState(new Date().getMonth().toString());
  const [selProduct, setSelProduct] = useState('');

  useEffect(() => {
    if (!token) return; // Don't fetch with null token
    fetch(`${API_BASE}/api/tl/profile`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => { if (r.status === 401 && !isAdminView) { localStorage.clear(); navigate('/'); } return r.json(); })
      .then(setTl).catch(console.error);
  }, [token, navigate, isAdminView]);

  // Subscribe to push notifications when profile is loaded
  useEffect(() => {
    if (token && tl) {
      subscribeUserToPush(API_BASE, token);
    }
  }, [token, tl]);

  // Load dynamic points map for formatting product badges (e.g. Tide Insurance (699))
  useEffect(() => {
    fetch(`${API_BASE}/api/points-config`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.configs) {
          const map = {};
          data.configs.forEach(cfg => {
            const productKey = cfg.productName.toLowerCase().trim();
            const configData = {
              type: cfg.productType,
              fieldMapping: cfg.fieldMapping || {},
            };
            if (cfg.productType === 'simple') {
              configData.points = cfg.simplePoints;
            } else if (cfg.productType === 'complex') {
              configData.plans = {};
              (cfg.plans || []).forEach(plan => {
                const planKey = plan.planName.toLowerCase();
                configData.plans[planKey] = {};
                (plan.tiers || []).forEach(tier => {
                  const tierKey = tier.name.toLowerCase();
                  configData.plans[planKey][tierKey] = {
                    points: tier.points,
                    price: tier.price
                  };
                });
              });
            } else if (cfg.productType === 'mapped') {
              configData.valueMapping = cfg.valueMapping || [];
            }
            map[productKey] = configData;
          });
          window.dynamicPointsMap = map;
        }
      })
      .catch(console.error);
  }, []);

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

  // Fetch task notifications for TL
  useEffect(() => {
    if (!token) return;
    
    fetch(`${API_BASE}/api/tasks/tl-notifications/count`, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(data => setTaskNotificationCount(data.count || 0))
      .catch(console.error);

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetch(`${API_BASE}/api/tasks/tl-notifications/count`, {
        headers: { Authorization: 'Bearer ' + token }
      })
        .then(r => r.json())
        .then(data => setTaskNotificationCount(data.count || 0))
        .catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, [token]);

  // 🔧 NEW APPROACH: Fetch verification on-demand for active forms only
  // This uses the same working API pattern as individual form verification
  // Benefits:
  // - Uses the proven working API call (same as individual forms)
  // - Only fetches verification for currently displayed forms (faster)
  // - Automatically updates when filters change
  // - No failed bulk API calls at page load
  useEffect(() => {
    // Calculate active forms based on current filters
    let list = activeTab === 'my' ? myForms : teamForms;
    const now = new Date();
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
        if (toDate && d > new Date(toDate + 'T23:59:59')) return false;
        return true;
      });
    }
    
    if (selYear) list = list.filter(f => new Date(f.createdAt).getFullYear() === parseInt(selYear));
    if (selMonth !== '') list = list.filter(f => new Date(f.createdAt).getMonth() === parseInt(selMonth));


    // Fetch verification for filtered forms
    if (list.length === 0) {
      setVerificationStats({ fullyVerified: 0, partiallyDone: 0, notFound: 0 });
      setVerificationMap({});
      setIsLoadingVerification(false);
      return;
    }

    // 1️⃣ Build initial map instantly from database fields (0 latency, 0 errors)
    const initialMap = {};
    let fullyVerified = 0, partiallyDone = 0, notFound = 0, alreadyVerified = 0;
    const pointsByFSE = {};

    list.forEach(form => {
      const vstatus = form.verificationStatus || form.verificationChecks?.status || 'Not Found';
      const vpoints = form.verificationChecks?.points || 0;
      const isFound = vstatus !== 'Not Found';
      const vinfo = {
        status: vstatus,
        points: vpoints,
        phoneMatch: isFound ? true : (form.verificationChecks?.phoneMatch || false),
        inSheet: isFound ? true : (form.verificationChecks?.inSheet || false),
        ...form.verificationChecks,
        status: vstatus
      };
      if (isFound) {
        vinfo.phoneMatch = true;
        vinfo.inSheet = true;
      }
      const vKey = getVerificationKey(form);
      initialMap[vKey] = vinfo;
      if (form.customerNumber) initialMap[form.customerNumber] = vinfo;

      if (vstatus === 'Fully Verified') fullyVerified++;
      else if (vstatus === 'Already Verified') alreadyVerified++;
      else if (vstatus === 'Partially Done') partiallyDone++;
      else notFound++;

      if (vstatus === 'Fully Verified') {
        const fseName = form.employeeName || 'Unknown';
        const productName = form.formFillingFor || (form.brand === 'Tide' && form.tideProduct ? form.tideProduct : form.brand) || '';
        if (!pointsByFSE[fseName]) {
          pointsByFSE[fseName] = { total: 0, counted: new Set() };
        }
        const dedupKey = `${form.customerNumber}__${productName.toLowerCase().trim()}`;
        if (!pointsByFSE[fseName].counted.has(dedupKey)) {
          pointsByFSE[fseName].counted.add(dedupKey);
          pointsByFSE[fseName].total += vpoints;
        }
      }
    });

    setVerificationStats({ fullyVerified, alreadyVerified, partiallyDone, notFound });
    setVerificationMap(initialMap);

    const finalPoints = {};
    Object.keys(pointsByFSE).forEach(name => {
      finalPoints[name] = Math.round(pointsByFSE[name].total * 10) / 10;
    });
    setFsePoints(finalPoints);
    setIsLoadingVerification(false);

    // 2️⃣ Background fetch ONLY for unverified forms
    const unverified = list.filter(f => !f.verificationStatus || f.verificationStatus === 'Not Found').slice(0, 30);
    if (unverified.length === 0) return;

    const phones = unverified.map(f => f.customerNumber).join(',');
    const names = unverified.map(f => encodeURIComponent(f.customerName || '')).join(',');
    const products = unverified.map(f => encodeURIComponent(getFormProduct(f))).join(',');
    const months = unverified.map(f => encodeURIComponent(new Date(f.createdAt).toLocaleString('en-US', { month: 'long', year: 'numeric' }))).join(',');

    fetch(
      `${API_BASE}/api/verify/bulk-admin?phones=${encodeURIComponent(phones)}&names=${names}&products=${products}&months=${months}`,
      { headers: { Authorization: 'Bearer ' + token } }
    )
      .then(r => {
        if (!r.ok) return null;
        return r.json();
      })
      .then(verifyMap => {
        if (!verifyMap || Object.keys(verifyMap).length === 0) return;
        const updatedMap = { ...initialMap };
        let fv = 0, av = 0, pd = 0, nf = 0;
        const ptsByFSE = {};

        list.forEach(form => {
          const vKey = getVerificationKey(form);
          const backendInfo = verifyMap[vKey] || verifyMap[form.customerNumber];
          if (backendInfo) {
            updatedMap[vKey] = backendInfo;
            if (form.customerNumber) updatedMap[form.customerNumber] = backendInfo;
          }
          const curStatus = updatedMap[vKey]?.status || 'Not Found';
          if (curStatus === 'Fully Verified') fv++;
          else if (curStatus === 'Already Verified') av++;
          else if (curStatus === 'Partially Done') pd++;
          else nf++;

          if (curStatus === 'Fully Verified') {
            const fseName = form.employeeName || 'Unknown';
            const productName = form.formFillingFor || (form.brand === 'Tide' && form.tideProduct ? form.tideProduct : form.brand) || '';
            const pts = updatedMap[vKey]?.points || 0;
            if (!ptsByFSE[fseName]) ptsByFSE[fseName] = { total: 0, counted: new Set() };
            const dedupKey = `${form.customerNumber}__${productName.toLowerCase().trim()}`;
            if (!ptsByFSE[fseName].counted.has(dedupKey)) {
              ptsByFSE[fseName].counted.add(dedupKey);
              ptsByFSE[fseName].total += pts;
            }
          }
        });

        setVerificationStats({ fullyVerified: fv, alreadyVerified: av, partiallyDone: pd, notFound: nf });
        setVerificationMap(updatedMap);
        const finPts = {};
        Object.keys(ptsByFSE).forEach(n => finPts[n] = Math.round(ptsByFSE[n].total * 10) / 10);
        setFsePoints(finPts);
      })
      .catch(() => {});
  }, [activeTab, teamForms, myForms, dateFilter, fromDate, toDate, selYear, selMonth, selProduct, token]);

  // Fetch verification data when FSE modal opens
  useEffect(() => {
    if (!selectedFSE) return;
    const map = {};
    selectedFSE.forms.forEach(form => {
      const vstatus = form.verificationStatus || form.verificationChecks?.status || 'Not Found';
      const vpoints = form.verificationChecks?.points || 0;
      const isFound = vstatus !== 'Not Found';
      const vKey = getVerificationKey(form);
      const verification = verificationMap[vKey] || {
        status: vstatus,
        points: vpoints,
        phoneMatch: isFound ? true : (form.verificationChecks?.phoneMatch || false),
        inSheet: isFound ? true : (form.verificationChecks?.inSheet || false),
        ...form.verificationChecks,
        status: vstatus
      };
      if (isFound) {
        verification.phoneMatch = true;
        verification.inSheet = true;
      }
      map[form._id] = { verification, phoneCheck: {} };
    });
    setFseVerifyData(map);
    setLoadingVerify(false);

    const unverified = selectedFSE.forms.filter(f => !f.verificationStatus || f.verificationStatus === 'Not Found').slice(0, 20);
    if (unverified.length === 0) return;

    const phones   = unverified.map(f => f.customerNumber).join(',');
    const names    = unverified.map(f => encodeURIComponent(f.customerName || '')).join(',');
    const products = unverified.map(f => encodeURIComponent(getFormProduct(f))).join(',');
    const months   = unverified.map(f => encodeURIComponent(new Date(f.createdAt).toLocaleString('en-US', { month: 'long', year: 'numeric' }))).join(',');
    
    fetch(`${API_BASE}/api/verify/bulk-admin?phones=${encodeURIComponent(phones)}&names=${names}&products=${products}&months=${months}&_t=${Date.now()}`, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(verifyMap => {
        const updated = { ...map };
        selectedFSE.forms.forEach(form => {
          const vKey = getVerificationKey(form);
          const backendVer = verifyMap[vKey] || verifyMap[form.customerNumber];
          if (backendVer) {
            updated[form._id] = { verification: backendVer, phoneCheck: {} };
          }
        });
        setFseVerifyData(updated);
      })
      .catch(() => {});
  }, [selectedFSE, token, verificationMap]);

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

  const handleVerificationClick = (status) => {
    // Calculate product-wise breakdown for the selected status using activeForms
    const productCounts = {};
    
    activeForms.forEach(form => {
      const vKey = getVerificationKey(form); // Use helper function
      const verification = verificationMap[vKey];
      
      const vStatus = verification ? verification.status : 'Not Found';
      
      if (vStatus === status) {
        const productName = form.formFillingFor || (form.brand === 'Tide' && form.tideProduct ? form.tideProduct : form.brand) || 'Unknown';
        productCounts[productName] = (productCounts[productName] || 0) + 1;
      }
    });
    
    setVerificationModal({ status, products: productCounts });
  };

  const handleProductClick = (product) => {
    // Get all forms for this product with the selected verification status using activeForms
    const forms = activeForms.filter(form => {
      const formProduct = form.formFillingFor || (form.brand === 'Tide' && form.tideProduct ? form.tideProduct : form.brand) || 'Unknown';
      if (formProduct !== product) return false;
      
      const vKey = getVerificationKey(form); // Use helper function
      const verification = verificationMap[vKey];
      const vStatus = verification ? verification.status : 'Not Found';
      
      return vStatus === verificationModal.status;
    });
    
    setVerificationDrillDown({ status: verificationModal.status, product, forms });
  };

  const handleRaiseAlert = async (form) => {
    const vKey = getVerificationKey(form);
    const vstatus = form.verificationStatus || form.verificationChecks?.status || 'Not Found';
    const vpoints = form.verificationChecks?.points || 0;
    const isFound = vstatus !== 'Not Found';
    const verification = verificationMap[vKey] || verificationMap[form.customerNumber] || {
      status: vstatus,
      points: vpoints,
      phoneMatch: isFound ? true : (form.verificationChecks?.phoneMatch || false),
      inSheet: isFound ? true : (form.verificationChecks?.inSheet || false),
      ...form.verificationChecks,
      status: vstatus
    };

    try {
      const checkResponse = await fetch(`${API_BASE}/api/tasks/check-merchant-task/${form._id}`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      const checkData = await checkResponse.json();
      setTaskModal({ 
        form, 
        verification,
        existingTask: checkData.exists ? checkData.task : null,
        canSendReminder: checkData.canSendReminder || false,
        daysSinceCreated: checkData.daysSinceCreated || 0
      });
    } catch (err) {
      console.error('Failed to check existing task:', err);
      setTaskModal({ form, verification, existingTask: null, canSendReminder: false, daysSinceCreated: 0 });
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const reason = formData.get('reason');
    const instructions = formData.get('instructions');
    const isUrgent = formData.get('isUrgent') === 'on';
    const deadline = formData.get('deadline');

    if (!reason || !instructions) {
      alert('Please fill all fields');
      return;
    }

    if (isUrgent && !deadline) {
      alert('Please select a deadline for urgent tasks');
      return;
    }

    // Prepare verification details
    const verification = taskModal.verification || {};
    const verificationDetails = {
      status: verification.status || 'Not Found',
      passedConditions: (verification.checks || []).filter(c => c.pass).map(c => c.label),
      failedConditions: (verification.checks || []).filter(c => !c.pass).map(c => c.label),
    };

    try {
      // Check if this is a reminder or new task
      const isReminder = taskModal.existingTask && taskModal.canSendReminder;
      const endpoint = isReminder 
        ? `${API_BASE}/api/tasks/${taskModal.existingTask._id}/send-reminder`
        : `${API_BASE}/api/tasks/create`;
      
      const method = isReminder ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          merchantId: taskModal.form._id,
          reason,
          instructions,
          isUrgent,
          deadline: isUrgent ? deadline : null,
          verificationDetails
        })
      });

      if (response.ok) {
        alert(isReminder ? 'Reminder sent successfully!' : 'Task created successfully!');
        setTaskModal(null);
        // Refresh the page data
        loadForms();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to create task');
      }
    } catch (err) {
      alert('Error creating task');
      console.error(err);
    }
  };

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
    if (selYear)  list = list.filter(f => new Date(f.createdAt).getFullYear() === parseInt(selYear));
    if (selMonth) list = list.filter(f => new Date(f.createdAt).getMonth()    === parseInt(selMonth));
    if (selProduct) {
      list = list.filter(f => {
        const info = verificationMap[getVerificationKey(f)] || {};
        const label = formatProductDisplay(f, info);
        return label === selProduct;
      });
    }
    return list;
  })();

  return (
    <>
      <Navbar tl={tl} notificationCount={taskNotificationCount} />
      <div className="main-content">
        {/* Admin Impersonation Banner */}
        {isAdminView && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 10,
            padding: '10px 18px', marginBottom: 12, flexWrap: 'wrap', gap: 8
          }}>
            <span style={{ fontWeight: 700, color: '#0d47a1', fontSize: 13 }}>
              👁️ Viewing TL Dashboard as <strong>{tl?.name || adminViewEmail}</strong> ({adminViewEmail}) — Admin Mode
            </span>
            <button onClick={handleExitAdminView} style={{
              background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer'
            }}>⬅ Return to Admin Approvals</button>
          </div>
        )}

        {/* Welcome */}
        <div className="welcome-card" style={{ flexDirection: 'row', alignItems: 'center', padding: '16px 20px', position: 'relative', display: 'flex', gap: 10 }}>
          <div className="welcome-avatar" style={{ width: 44, height: 44, fontSize: 16, flexShrink: 0 }}>
            {tl?.image ? <img src={tl.image} alt="avatar" /> : initials}
          </div>
          <div className="welcome-text" style={{ textAlign: 'left', marginLeft: 12, flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 16, marginBottom: 2 }}>Welcome, {tl?.name?.split(' ')[0] || ''}!</h2>
            <p style={{ fontSize: 12, opacity: 0.85 }}>Team Lead · {tl?.location}</p>
          </div>
          {/* Total Points badge */}
          {(() => {
            let totalPoints = 0;
            activeForms.forEach(form => {
              const vKey = getVerificationKey(form);
              const verification = verificationMap[vKey];
              if (verification?.status === 'Fully Verified') {
                totalPoints += verification.points || 0;
              }
            });
            totalPoints = Math.round(totalPoints * 10) / 10;
            return (
              <div style={{
                background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)',
                borderRadius: 12, padding: '8px 16px', textAlign: 'center',
                backdropFilter: 'blur(4px)', flexShrink: 0
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '1px' }}>TOTAL POINTS</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 2 }}>{totalPoints}</div>
              </div>
            );
          })()}
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
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: 'Total',      value: activeForms.length,                                                              color: '#1a4731', border: '#1a4731', filter: () => activeForms },
            { label: 'Onboarding', value: activeForms.filter(f => f.status === 'Ready for Onboarding').length,            color: '#2e7d32', border: '#2e7d32', filter: () => activeForms.filter(f => f.status === 'Ready for Onboarding') },
            { label: 'Not Int.',   value: activeForms.filter(f => f.status === 'Not Interested').length,                  color: '#c62828', border: '#c62828', filter: () => activeForms.filter(f => f.status === 'Not Interested') },
            { label: 'Try/Err',    value: activeForms.filter(f => f.status === 'Try but not done due to error').length,   color: '#e65100', border: '#e65100', filter: () => activeForms.filter(f => f.status === 'Try but not done due to error') },
            { label: 'Revisit',    value: activeForms.filter(f => f.status === 'Need to visit again' || f.status === 'Need to Visit again').length, color: '#1565c0', border: '#1565c0', filter: () => activeForms.filter(f => f.status === 'Need to visit again' || f.status === 'Need to Visit again') },
          ].map(k => (
            <div key={k.label} className="kpi-card" style={{ padding: '4px 8px', flex: '1 1 auto', minWidth: 60, borderTopColor: k.border, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1 }}
              onClick={() => setFseFormModal({ title: k.label, forms: k.filter() })}>
              <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-light)', lineHeight: 1.2 }}>{k.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            </div>
          ))}
          {/* Verification Status KPIs */}
          {isLoadingVerification ? (
            <div style={{ padding: '12px', flex: '1 1 auto', minWidth: 180, textAlign: 'center', color: 'var(--text-light)', fontSize: 11 }}>
              Loading verification...
            </div>
          ) : (
            [
              { label: 'Fully Verified', value: verificationStats.fullyVerified, icon: '✓', color: '#2e7d32', status: 'Fully Verified' },
              { label: 'Already Verified', value: verificationStats.alreadyVerified, icon: '⧉', color: '#e65100', status: 'Already Verified' },
              { label: 'Partial',        value: verificationStats.partiallyDone, icon: '◑', color: '#f57f17', status: 'Partially Done' },
              { label: 'Not Found',      value: verificationStats.notFound,      icon: '–', color: '#888',    status: 'Not Found' },
            ].map(k => (
              <div key={k.label} className="kpi-card"
                style={{ padding: '4px 8px', flex: '1 1 auto', minWidth: 60, borderTop: `3px solid ${k.color}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1 }}
                onClick={() => handleVerificationClick(k.status)}>
                <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-light)', lineHeight: 1.2 }}>{k.icon} {k.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
              </div>
            ))
          )}
        </div>

        {/* Merchant Forms Section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>Merchant Visit Forms</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setActiveTab('team')} style={{ padding: '6px 16px', borderRadius: 20, border: '1.5px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: activeTab === 'team' ? 'var(--green-dark)' : '#fff', color: activeTab === 'team' ? '#fff' : 'var(--green-dark)', borderColor: 'var(--green-dark)' }}>
              Team Forms ({activeTab === 'team' ? activeForms.length : teamForms.length})
            </button>
            <button onClick={() => setActiveTab('my')} style={{ padding: '6px 16px', borderRadius: 20, border: '1.5px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: activeTab === 'my' ? 'var(--green-dark)' : '#fff', color: activeTab === 'my' ? '#fff' : 'var(--green-dark)', borderColor: 'var(--green-dark)' }}>
              My Forms ({activeTab === 'my' ? activeForms.length : myForms.length})
            </button>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div className="date-filter-bar">
            {['all','today','week'].map(f => (
              <button key={f} className={`date-filter-btn${dateFilter === f ? ' active' : ''}`}
                onClick={() => { setDateFilter(f); setFromDate(''); setToDate(''); }}>
                {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'This Week'}
              </button>
            ))}
            <div className="date-filter-custom">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              <span style={{ color: '#888', fontSize: 12 }}>to</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              <button className="date-filter-btn" onClick={() => setDateFilter('custom')}>Apply</button>
            </div>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ position: 'absolute', top: -9, left: 10, fontSize: 11, color: '#40916c', background: '#fff', padding: '0 4px', fontWeight: 600, zIndex: 1, pointerEvents: 'none' }}>Year</span>
              <select value={selYear} onChange={e => setSelYear(e.target.value)}
                style={{ padding: '10px 32px 10px 12px', borderRadius: 10, border: '1.5px solid #40916c', fontSize: 14, color: selYear ? '#1a4731' : '#888', background: '#fff', cursor: 'pointer', appearance: 'none', minWidth: 100, outline: 'none' }}>
                <option value=""></option>
                {[2026,2025,2024,2023,2022,2021].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#40916c', fontSize: 12 }}>▼</span>
            </div>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ position: 'absolute', top: -9, left: 10, fontSize: 11, color: '#40916c', background: '#fff', padding: '0 4px', fontWeight: 600, zIndex: 1, pointerEvents: 'none' }}>Month</span>
              <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
                style={{ padding: '10px 32px 10px 12px', borderRadius: 10, border: '1.5px solid #40916c', fontSize: 14, color: selMonth !== '' ? '#1a4731' : '#888', background: '#fff', cursor: 'pointer', appearance: 'none', minWidth: 130, outline: 'none' }}>
                <option value="">All Months</option>
                {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m,i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#40916c', fontSize: 12 }}>▼</span>
            </div>
          </div>
        </div>

        {/* Product filter chips with verified counts */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, marginTop: 4, alignItems: 'center' }}>
          {(() => {
            let allList = activeTab === 'my' ? myForms : teamForms;
            
            // Apply ALL filters (date, month, year) to match activeForms logic
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            if (dateFilter === 'today') allList = allList.filter(f => new Date(f.createdAt) >= today);
            else if (dateFilter === 'week') {
              const ws = new Date(today); ws.setDate(today.getDate() - today.getDay());
              allList = allList.filter(f => new Date(f.createdAt) >= ws);
            } else if (dateFilter === 'month') {
              const ms = new Date(now.getFullYear(), now.getMonth(), 1);
              allList = allList.filter(f => new Date(f.createdAt) >= ms);
            } else if (dateFilter === 'custom' && (fromDate || toDate)) {
              allList = allList.filter(f => {
                const d = new Date(f.createdAt);
                if (fromDate && d < new Date(fromDate)) return false;
                if (toDate && d > new Date(toDate + 'T23:59:59')) return false;
                return true;
              });
            }
            
            if (selYear) allList = allList.filter(f => new Date(f.createdAt).getFullYear() === parseInt(selYear));
            if (selMonth !== '') allList = allList.filter(f => new Date(f.createdAt).getMonth() === parseInt(selMonth));

            const productSet = new Set();
            
            allList.forEach(f => {
              const vKey = getVerificationKey(f);
              const info = verificationMap[vKey] || {};
              if (info.status === 'Fully Verified') {
                const label = formatProductDisplay(f, info);
                if (label && label !== '–') productSet.add(label);
              }
            });

            const baseProducts = ['Tide', 'Tide Insurance', 'Tide MSME', 'Tide Credit Card'];
            baseProducts.forEach(p => productSet.add(p));

            const products = Array.from(productSet).sort();
            const counts = {};
            
            products.forEach(p => {
              counts[p] = allList.filter(f => {
                const vKey = getVerificationKey(f);
                const info = verificationMap[vKey] || {};
                const label = formatProductDisplay(f, info);
                return label === p && info?.status === 'Fully Verified';
              }).length;
            });
            
            const visibleProducts = products.filter(p => counts[p] > 0 || (baseProducts.includes(p) && p !== 'Tide Insurance'));
            return (
              <>
                <button onClick={() => setSelProduct('')}
                  style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: selProduct === '' ? '2px solid #1a4731' : '1.5px solid #c8e6c9',
                    background: selProduct === '' ? '#1a4731' : '#fff',
                    color: selProduct === '' ? '#fff' : '#1a4731', transition: 'all 0.15s' }}>
                  All Products
                </button>
                {visibleProducts.map(p => (
                  <button key={p} onClick={() => setSelProduct(p)}
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: selProduct === p ? '2px solid #1a4731' : '1.5px solid #c8e6c9',
                      background: selProduct === p ? '#1a4731' : '#fff',
                      color: selProduct === p ? '#fff' : '#1a4731', transition: 'all 0.15s' }}>
                    {p}: {counts[p]} ✓
                  </button>
                ))}
              </>
            );
          })()}
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
              <div key={form._id} style={{ marginBottom: '12px', position: 'relative' }}>
                <Link to={`/merchant/${form._id}`} className="merchant-row" style={{ animationDelay: `${i * 0.05}s`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="mr-avatar">{form.customerName?.charAt(0).toUpperCase()}</div>
                  <div className="mr-info" style={{ flex: 1 }}>
                    <div className="mr-name">{form.customerName}</div>
                    <div className="mr-meta">
                      <span>📍 {form.location}</span>
                      <span>📄 {formatProductDisplay(form, verificationMap[getVerificationKey(form)])}</span>
                      <span>📞 {form.customerNumber}</span>
                    </div>
                  </div>
                  <div className="mr-right">
                    <span className="mr-status" style={{ background: sc.bg, color: sc.color }}>{form.status}</span>
                    <span className="mr-date">{date}</span>
                  </div>
                </Link>
                {/* Timeline button - below the date, inline */}
                {(form.brand === 'Tide' && form.tideProduct === 'Tide') && (
                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 4, marginTop: 4 }}>
                    <TideMerchantTimeline phone={form.customerNumber} customerName={form.customerName} />
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // Team Forms — group by FSE name, show FSE list
          (() => {
            // Group forms by employeeName
            const grouped = {};
            activeForms.forEach(f => {
              const name = f.employeeName || 'Unknown';
              if (!grouped[name]) grouped[name] = [];
              grouped[name].push(f);
            });
            return Object.entries(grouped).filter(([, forms]) => forms.length > 0).map(([fseName, forms], i) => {
              const ready   = forms.filter(f => f.status === 'Ready for Onboarding').length;
              const notInt  = forms.filter(f => f.status === 'Not Interested').length;
              const tryErr  = forms.filter(f => f.status === 'Try but not done due to error').length;
              const revisit = forms.filter(f => f.status === 'Need to visit again' || f.status === 'Need to Visit again').length;
              const points = fsePoints[fseName] || 0;
              
              return (
                <div key={fseName} className="merchant-row" style={{ cursor: 'pointer', animationDelay: `${i * 0.05}s`, flexWrap: 'wrap', padding: '8px 12px' }}
                  onClick={() => {
                    // Filter forms based on selected product
                    let filteredForms = forms;
                    
                    if (selProduct) {
                      const sp = selProduct.toLowerCase().trim();
                      filteredForms = forms.filter(f => {
                        const p1 = (f.formFillingFor || '').toLowerCase().trim();
                        const p2 = (f.tideProduct || '').toLowerCase().trim();
                        const p3 = (f.brand || '').toLowerCase().trim();
                        
                        if (sp === 'tide msme') {
                          return p1.includes('msme') || p2.includes('msme') || p3.includes('msme');
                        } else if (sp === 'tide insurance') {
                          return p1.includes('insurance') || p2.includes('insurance') || p3.includes('insurance');
                        } else if (sp === 'tide credit card') {
                          return p1.includes('credit') || p2.includes('credit') || p3.includes('credit');
                        } else if (sp === 'tide') {
                          return (p1 === 'tide' || p2 === 'tide' || p3 === 'tide') && 
                                 !p1.includes('msme') && !p1.includes('insurance') && !p1.includes('credit');
                        }
                        return p1 === sp || p2 === sp || p3 === sp;
                      });
                    }
                    
                    setSelectedFSE({ name: fseName, forms: filteredForms });
                  }}>
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
                    setLoadingVerify(true);
                    const map = {};
                    selectedFSE.forms.forEach(form => {
                      const vKey = getVerificationKey(form);
                      const verification = verificationMap[vKey] || {
                        status: form.verificationStatus || 'Not Found',
                        points: form.verificationChecks?.points || 0,
                        ...form.verificationChecks
                      };
                      map[form._id] = { verification, phoneCheck: {} };
                    });
                    setFseVerifyData(map);
                    setLoadingVerify(false);

                    const phones   = selectedFSE.forms.map(f => f.customerNumber).join(',');
                    const names    = selectedFSE.forms.map(f => encodeURIComponent(f.customerName || '')).join(',');
                    const products = selectedFSE.forms.map(f => encodeURIComponent(getFormProduct(f))).join(',');
                    const months   = selectedFSE.forms.map(f => encodeURIComponent(new Date(f.createdAt).toLocaleString('en-US', { month: 'long', year: 'numeric' }))).join(',');
                    
                    fetch(`${API_BASE}/api/verify/bulk-admin?phones=${encodeURIComponent(phones)}&names=${names}&products=${products}&months=${months}&_t=${Date.now()}`, {
                      headers: { Authorization: 'Bearer ' + token }
                    })
                      .then(r => r.json())
                      .then(verifyMap => {
                        const updated = { ...map };
                        selectedFSE.forms.forEach(form => {
                          const vKey = getVerificationKey(form);
                          const backendVer = verifyMap[vKey] || verifyMap[form.customerNumber];
                          if (backendVer) {
                            updated[form._id] = { verification: backendVer, phoneCheck: {} };
                          }
                        });
                        setFseVerifyData(updated);
                      })
                      .catch(() => {});
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
                const BADGE_MAP = { 
                  'Fully Verified': { bg: '#e6f4ea', color: '#2e7d32', icon: '✓' }, 
                  'Already Verified': { bg: '#fff3e0', color: '#e65100', icon: '⧉' },
                  'Critical Failure': { bg: '#ffebee', color: '#c62828', icon: '⚠' }, 
                  'Partially Done': { bg: '#fff8e1', color: '#f57f17', icon: '◑' }, 
                  'Not Verified': { bg: '#fdecea', color: '#c62828', icon: '✗' }, 
                  'Not Found': { bg: '#f5f5f5', color: '#888', icon: '–' } 
                };
                const vb = BADGE_MAP[v.status] || BADGE_MAP['Not Found'];
                
                return (
                  <div key={form._id}
                    style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', marginBottom: 10, border: '1.5px solid #e8f0e8', position: 'relative' }}>
                    
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
                    {/* Timeline button - below the date, inline */}
                    {(form.brand === 'Tide' && form.tideProduct === 'Tide') && (
                      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 4, marginBottom: 4 }}>
                        <TideMerchantTimeline phone={form.customerNumber} customerName={form.customerName} />
                      </div>
                    )}
                    
                    {/* Details Grid - Mobile Optimized */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
                      {/* Product */}
                      <div style={{ background: '#f9f9f9', padding: '4px 6px', borderRadius: 6 }}>
                        <div style={{ fontSize: 8, color: 'var(--text-light)', marginBottom: 1 }}>Product</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatProductDisplay(form, v)}
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

      {/* Verification Product Breakdown Modal */}
      {verificationModal && !verificationDrillDown && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setVerificationModal(null); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '80vh', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ 
              padding: '18px 20px', 
              background: verificationModal.status === 'Fully Verified' ? 'linear-gradient(135deg, #2e7d32, #1b5e20)' : 
                          verificationModal.status === 'Partially Done' ? 'linear-gradient(135deg, #f57f17, #e65100)' : 
                          'linear-gradient(135deg, #616161, #424242)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 18 }}>
                    {verificationModal.status === 'Fully Verified' ? '✓' : 
                     verificationModal.status === 'Partially Done' ? '◑' : '–'}
                  </span>
                  {verificationModal.status}
                </h3>
                <div style={{ fontSize: 11, opacity: 0.9, marginTop: 3 }}>
                  {Object.values(verificationModal.products).reduce((a, b) => a + b, 0)} forms across {Object.keys(verificationModal.products).length} products
                </div>
              </div>
              <button onClick={() => setVerificationModal(null)} 
                style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>
                ✕
              </button>
            </div>

            {/* Product List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
              {Object.keys(verificationModal.products).length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>No forms found</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {Object.entries(verificationModal.products)
                    .sort((a, b) => b[1] - a[1])
                    .map(([product, count]) => {
                      const color = verificationModal.status === 'Fully Verified' ? '#2e7d32' : 
                                    verificationModal.status === 'Partially Done' ? '#f57f17' : '#757575';
                      const bg = verificationModal.status === 'Fully Verified' ? '#e8f5e9' : 
                                 verificationModal.status === 'Partially Done' ? '#fff3e0' : '#f5f5f5';
                      
                      return (
                        <div key={product} 
                          onClick={() => handleProductClick(product)}
                          style={{ 
                            background: '#fff',
                            padding: '12px 14px', 
                            borderRadius: 10, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            border: `2px solid ${bg}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                            e.currentTarget.style.borderColor = color;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                            e.currentTarget.style.borderColor = bg;
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                            <div style={{ 
                              width: 38, 
                              height: 38, 
                              borderRadius: 10, 
                              background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                              color: '#fff', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontSize: 15, 
                              fontWeight: 800,
                              flexShrink: 0
                            }}>
                              {product.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 1 }}>{product}</div>
                              <div style={{ fontSize: 10, color: '#666' }}>
                                {count} form{count !== 1 ? 's' : ''} • Click to view
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ 
                              fontSize: 20, 
                              fontWeight: 800, 
                              color: color,
                              minWidth: 32,
                              textAlign: 'right'
                            }}>
                              {count}
                            </div>
                            <div style={{ fontSize: 16, color: '#999' }}>›</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drill-Down: Merchant & FSE Details */}
      {verificationDrillDown && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 501, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setVerificationDrillDown(null); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '85vh', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ 
              padding: '18px 20px', 
              background: verificationDrillDown.status === 'Fully Verified' ? 'linear-gradient(135deg, #2e7d32, #1b5e20)' : 
                          verificationDrillDown.status === 'Partially Done' ? 'linear-gradient(135deg, #f57f17, #e65100)' : 
                          'linear-gradient(135deg, #616161, #424242)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ flex: 1 }}>
                <button 
                  onClick={() => setVerificationDrillDown(null)}
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', marginBottom: 6 }}>
                  ← Back
                </button>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{verificationDrillDown.product}</h3>
                <div style={{ fontSize: 11, opacity: 0.9, marginTop: 3 }}>
                  {verificationDrillDown.forms.length} form{verificationDrillDown.forms.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button onClick={() => { setVerificationDrillDown(null); setVerificationModal(null); }} 
                style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>
                ✕
              </button>
            </div>

            {/* Forms List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
              <div style={{ display: 'grid', gap: 10 }}>
                {verificationDrillDown.forms.map((form, i) => (
                  <div key={form._id} style={{ 
                    background: '#fff',
                    padding: '12px 14px', 
                    borderRadius: 10, 
                    border: '2px solid #f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }}>
                    <Link 
                      to={`/merchant/${form._id}`}
                      onClick={() => { setVerificationDrillDown(null); setVerificationModal(null); }}
                      style={{ 
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flex: 1,
                        minWidth: 0
                      }}>
                      {/* Merchant Avatar */}
                      <div style={{ 
                        width: 38, 
                        height: 38, 
                        borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #1a4731, #2d6a4f)',
                        color: '#fff', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: 15, 
                        fontWeight: 800,
                        flexShrink: 0
                      }}>
                        {form.customerName?.charAt(0).toUpperCase()}
                      </div>
                      
                      {/* Merchant Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>{form.customerName}</div>
                        <div style={{ fontSize: 10, color: '#666', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span>📞 {form.customerNumber}</span>
                          <span>•</span>
                          <span>👤 {form.employeeName}</span>
                        </div>
                      </div>
                      
                      {/* Arrow */}
                      <div style={{ fontSize: 16, color: '#999', flexShrink: 0 }}>›</div>
                    </Link>
                    
                    {/* Raise Alert Button - For Partially Done and Not Found */}
                    {(verificationDrillDown.status === 'Partially Done' || verificationDrillDown.status === 'Not Found') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRaiseAlert(form);
                        }}
                        style={{
                          background: verificationDrillDown.status === 'Partially Done' ? '#ff9800' : '#757575',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = verificationDrillDown.status === 'Partially Done' ? '#f57c00' : '#616161'}
                        onMouseLeave={e => e.currentTarget.style.background = verificationDrillDown.status === 'Partially Done' ? '#ff9800' : '#757575'}>
                        🔔 Alert
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {taskModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 502, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setTaskModal(null); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', background: taskModal.existingTask && !taskModal.canSendReminder ? 'linear-gradient(135deg, #757575, #616161)' : 'linear-gradient(135deg, #ff9800, #f57c00)', color: '#fff' }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                {taskModal.existingTask && taskModal.canSendReminder ? '🔔 Send Reminder' : 
                 taskModal.existingTask ? '⚠️ Task Already Sent' : 
                 '🔔 Raise Alert'}
              </h3>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
                {taskModal.existingTask && taskModal.canSendReminder ? `Update task for ${taskModal.form.employeeName}` :
                 taskModal.existingTask ? `Task sent ${taskModal.daysSinceCreated} day${taskModal.daysSinceCreated !== 1 ? 's' : ''} ago` :
                 `Create task for ${taskModal.form.employeeName}`}
              </div>
            </div>
            
            {/* Existing Task Warning */}
            {taskModal.existingTask && !taskModal.canSendReminder && (
              <div style={{ padding: '20px 24px', background: '#fff3e0', border: '2px solid #ff9800', margin: '20px 24px', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                  <span style={{ fontSize: 32 }}>⏳</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#e65100', marginBottom: 6 }}>
                      Task Already Sent
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                      You sent a task to <strong>{taskModal.form.employeeName}</strong> {taskModal.daysSinceCreated} day{taskModal.daysSinceCreated !== 1 ? 's' : ''} ago.
                    </div>
                    <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>
                      💡 You can send a reminder after 3 days if the task is still pending.
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #ffe082' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#666', marginBottom: 6, textTransform: 'uppercase' }}>
                    Previous Instructions:
                  </div>
                  <div style={{ fontSize: 12, color: '#333', background: '#fff', padding: '8px 10px', borderRadius: 6 }}>
                    {taskModal.existingTask.instructions}
                  </div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setTaskModal(null)}
                    style={{ padding: '10px 20px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Form - Only show if no existing task OR can send reminder */}
            {(!taskModal.existingTask || taskModal.canSendReminder) && (
            <form onSubmit={handleCreateTask} style={{ padding: '20px 24px' }}>
              {/* Reminder Notice */}
              {taskModal.existingTask && taskModal.canSendReminder && (
                <div style={{ background: '#e3f2fd', border: '1.5px solid #2196f3', padding: '12px', borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>💬</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1565c0', marginBottom: 4 }}>
                        Sending Reminder
                      </div>
                      <div style={{ fontSize: 11, color: '#666' }}>
                        Task was sent {taskModal.daysSinceCreated} days ago. Update the instructions below to send a reminder to {taskModal.form.employeeName}.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Merchant Info */}
              <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Merchant Details</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{taskModal.form.customerName}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                  📞 {taskModal.form.customerNumber} • {taskModal.form.formFillingFor || taskModal.form.brand}
                </div>
              </div>

              {/* Verification Status */}
              {taskModal.verification && (
                <div style={{ background: '#fff8e1', border: '1.5px solid #ffb74d', padding: '12px', borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#e65100', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🔍</span>
                    <span>Verification Status: {taskModal.verification.status || 'Not Found'}</span>
                  </div>
                  
                  {taskModal.verification.checks && taskModal.verification.checks.length > 0 && (
                    <>
                      {/* Passed Conditions */}
                      {taskModal.verification.checks.filter(c => c.pass).length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, color: '#2e7d32', fontWeight: 700, marginBottom: 4 }}>✓ Verified Conditions:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {taskModal.verification.checks.filter(c => c.pass).map((check, i) => (
                              <span key={i} style={{ background: '#e6f4ea', color: '#2e7d32', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600 }}>
                                ✓ {check.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Failed Conditions */}
                      {taskModal.verification.checks.filter(c => !c.pass).length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: '#c62828', fontWeight: 700, marginBottom: 4 }}>✗ Pending Conditions:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {taskModal.verification.checks.filter(c => !c.pass).map((check, i) => (
                              <span key={i} style={{ background: '#fdecea', color: '#c62828', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600 }}>
                                ✗ {check.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Reason */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#333', marginBottom: 6 }}>
                  Reason (Why Partially Done?) *
                </label>
                <textarea
                  name="reason"
                  required
                  rows={3}
                  placeholder="e.g., Missing documents, incorrect phone number..."
                  style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              {/* Instructions */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#333', marginBottom: 6 }}>
                  Instructions (What FSE Should Do?) *
                </label>
                <textarea
                  name="instructions"
                  required
                  rows={4}
                  placeholder="e.g., Please collect missing documents and resubmit..."
                  style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              {/* Urgent Checkbox */}
              <div style={{ marginBottom: 16, background: '#fff3e0', border: '1.5px solid #ff9800', padding: '12px', borderRadius: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    name="isUrgent" 
                    id="isUrgent"
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#ff9800' }}
                    onChange={(e) => {
                      const deadlineInput = document.getElementById('deadline');
                      if (deadlineInput) {
                        deadlineInput.disabled = !e.target.checked;
                        if (!e.target.checked) deadlineInput.value = '';
                      }
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#e65100' }}>
                    ⚡ Mark as Urgent (High Priority)
                  </span>
                </label>
                
                {/* Deadline Picker */}
                <div style={{ marginTop: 10, paddingLeft: 26 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 4 }}>
                    Deadline:
                  </label>
                  <input 
                    type="date" 
                    name="deadline"
                    id="deadline"
                    disabled
                    min={new Date().toISOString().split('T')[0]}
                    style={{ 
                      padding: '8px 10px', 
                      border: '1.5px solid #e0e0e0', 
                      borderRadius: 6, 
                      fontSize: 12,
                      width: '100%',
                      maxWidth: 200
                    }}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setTaskModal(null)}
                  style={{ padding: '10px 20px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f57c00'}
                  onMouseLeave={e => e.currentTarget.style.background = '#ff9800'}>
                  {taskModal.existingTask && taskModal.canSendReminder ? '🔔 Send Reminder' : '✓ Create Task'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

    </>
  );
}
