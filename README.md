# 🛡️ Vegavruddhi Team Leader Panel (Core)

Dedicated operational dashboard for **Team Leaders (TLs)** to monitor field operations, track onboarding applications, and handle authentication.

---

## 📐 Architecture & Port Mapping

```
Team_Leader-/
├── public/           # Application assets
└── src/              # React 19 Frontend Web Application
```

| Service | Technology | Port | Proxy target |
| :--- | :--- | :--- | :--- |
| **Frontend** | React 19, MUI v9, React Router v6 | `3000` (default) | `http://localhost:4000` |

---

## ✨ Key Features

- 🔐 **Secure TL Authentication**: Dedicated login workflow with authorization checks.
- 📋 **Merchant Onboarding Tracking**: Real-time status list of merchant registration forms submitted by FSEs.
- 📊 **Field Activity Overview**: Live view of daily visits, attendance logs, and active field executive presence.
- 🔗 **Proxy Integration**: Automatically routes API requests to the backend server on `http://localhost:4000`.

---

## 🛠️ Tech Stack & Dependencies

- **Frontend Framework**: React 19
- **UI System**: Material-UI (`@mui/material` v9) with Emotion styling engine
- **Routing**: `react-router-dom` v6
- **Test Tools**: `@testing-library/react`

---

## 🚀 Quick Start Guide

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm start
```

---

## 📄 License
Internal Proprietary Software – Vegavruddhi Technologies.
