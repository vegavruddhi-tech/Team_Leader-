# 🛡️ Vegavruddhi Team Leader Panel (Core System)

A dedicated operational command center designed for **Team Leaders (TLs)** to manage Field Sales Executives (FSEs), inspect merchant onboarding applications, assign tasks, track salary slips, and audit field attendance.

---

## 🎯 1. Purpose of the Panel
The **Team Leader Panel** is the operational bridge between ground-level sales agents and upper management. It gives Team Leaders complete visibility over their assigned team of FSEs, allowing them to verify merchant applications, assign field visit tasks, track team performance against targets, and verify agent attendance.

---

## 👥 2. Target Users & User Roles

| User Role | Target Audience | Primary Responsibilities | Access & Privileges |
| :--- | :--- | :--- | :--- |
| **Team Leader (TL)** | Field Sales Supervisors & Team Leads | Managing FSE team roster, auditing merchant forms, assigning daily tasks, approving attendance | Read/write access to assigned team FSE data, verification rights for merchant forms |
| **Assistant TL** | Senior Field Agents acting as Lead Support | Assisting in task assignment and daily visit verification | Read access for team reports, task creation privileges |

---

## ✨ 3. Features & Functionalities

### 📊 TL Operational Dashboard (`Dashboard.js`)
- **Real-Time KPI Cards**: Total onboardings by team today, active FSE count, pending form approvals, and target achievement gauge.
- **Team Activity Feed**: Live stream of FSE check-ins, form submissions, and visit logs.

### 👥 Team Roster Management (`MyTeam.js`)
- **FSE Member Directory**: Inspect complete profiles of all assigned field executives.
- **Agent Status Toggle**: Track active, inactive, or on-leave field agents.
- **Individual Performance Counters**: Total forms submitted today, approval rate, and visit count per agent.

### 📋 Merchant Application Audit (`MerchantDetail.js` & `MerchantForm.js`)
- **Detailed Form Inspection**: View full merchant onboarding details including business name, owner details, GST/PAN numbers, and bank account info.
- **Document & Photo Viewer**: Audit uploaded store front photos, QR codes, and government identity proofs.
- **Verify or Reject Workflow**: Approve valid applications or return incorrect forms to FSEs with specific correction feedback notes.

### 📋 Task Allocation & Management (`Tasks.js`)
- **Create & Assign Tasks**: Create specific merchant visit tasks or merchant re-visit requests for FSEs.
- **Task Status Tracking**: Monitor tasks by status (Pending, In Progress, Completed, Re-opened).

### 💰 Salary & Compensation Overview (`MySalary.js`)
- **TL Earnings Summary**: Overview of monthly salary slips, incentive calculations, target bonuses, and payout history.

---

## 📄 4. Section, Page & Module Breakdown

| Page / File | Module Purpose | Key Elements & Components | User Actions Available |
| :--- | :--- | :--- | :--- |
| [`pages/Dashboard.js`](file:///c:/VegaProject/Team_Leader-/src/pages/Dashboard.js) | Main Supervisor Dashboard | KPI cards, team productivity charts, activity logs | View metrics, filter date ranges |
| [`pages/MyTeam.js`](file:///c:/VegaProject/Team_Leader-/src/pages/MyTeam.js) | FSE Team Management | FSE roster grid, performance cards, status indicators | View agent profile, inspect agent submission history |
| [`pages/MerchantDetail.js`](file:///c:/VegaProject/Team_Leader-/src/pages/MerchantDetail.js) | Merchant Audit Details | Comprehensive form view, document image viewer | Approve, reject, or request re-verification |
| [`pages/MerchantForm.js`](file:///c:/VegaProject/Team_Leader-/src/pages/MerchantForm.js) | Form Submission / Edit Module | Multi-step form input, validation triggers | Create/edit merchant registration on behalf of FSE |
| [`pages/Tasks.js`](file:///c:/VegaProject/Team_Leader-/src/pages/Tasks.js) | Task Assignment System | Task creation modal, status filter tabs, priority tags | Create task, assign FSE, update task status |
| [`pages/MySalary.js`](file:///c:/VegaProject/Team_Leader-/src/pages/MySalary.js) | Earnings & Payslip Portal | Monthly breakdown, incentive calculators, slip downloads | Download payslip PDF, view incentive details |
| [`pages/Profile.js`](file:///c:/VegaProject/Team_Leader-/src/pages/Profile.js) | TL Account Settings | Profile info, password change form | Edit profile, update password |
| [`pages/Login.js`](file:///c:/VegaProject/Team_Leader-/src/pages/Login.js) | Security Login Portal | Credentials input, session validation | Log in to TL panel |

---

## 🔄 5. Complete End-to-End Workflow

```
[ FSE Field Submission ] ──► [ TEAM LEADER PANEL ]
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
[ Audit Merchant Form ]    [ Assign Daily Tasks ]     [ Verify Attendance ]
       │                            │                            │
       ▼                            ▼                            ▼
[ Approve / Reject ]       [ Track Task Progress ]     [ Forward to Admin ]
```

1. **Morning Check-In**: Team Leader logs in to `Dashboard.js` to inspect morning attendance check-ins from FSEs.
2. **Task Assignment**: TL assigns targeted merchant visit tasks via `Tasks.js` to field executives.
3. **Form Audit**: As FSEs submit onboarding forms, TL inspects applications on `MerchantDetail.js`, verifying photos and bank proofs.
4. **Approve / Reject**: TL approves valid forms (forwarding them to Admin) or returns rejected forms with notes for FSE correction.

---

## ⚡ 6. Key Actions & Operations

- **Approve or Reject Merchant Applications**: Verify document proofs and authorize application submission to backend.
- **Assign & Track Tasks**: Allocate merchant visit goals to individual team members.
- **Inspect FSE Productivity**: Audit individual sales executive performance and submission history.
- **Download Payslips**: Access and download monthly salary breakdowns and performance bonus statements.

---

## 🔗 7. Cross-Panel Connections & Integrations

- ⬆️ **Manager Panel (`Manager_Panel`)**: Reports regional metrics to Managers and receives assigned target quotas.
- ⬆️ **Admin Panel (`Vegavruddhi-admin-tideBT`)**: Escalates approved forms to central database and receives salary slip data.
- ⬇️ **Employee Panel (`vegavruddhi-employee-panel/employee-app` & `Vegavruddhi-employee-tideBT`)**: Directly supervises FSE applications, returns feedback on rejected forms, and sends task assignments.

---

## 🛠️ 8. Tech Stack & Environment Setup

- **Frontend Framework**: React 19 (`react`, `react-dom`)
- **UI & Styling**: Material-UI (`@mui/material` v9), Emotion
- **Routing**: `react-router-dom` v6
- **Backend Proxy**: `"proxy": "http://localhost:4000"` in `package.json`

### Startup Instructions
```bash
cd c:\VegaProject\Team_Leader-
npm install
npm start   # Runs on http://localhost:3000
```

---

## 📄 License
Internal Proprietary Software – Vegavruddhi Technologies. All Rights Reserved.
