import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Add polyfills for WebRTC
window.global = window;
window.process = { env: {} };

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);