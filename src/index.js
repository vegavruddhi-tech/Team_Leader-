import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import App from './App';

// Wait for DOM to be ready
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
} else {
  console.error('Root element not found. Make sure index.html has <div id="root"></div>');
}

