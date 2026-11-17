import React from 'react';
import { createRoot } from 'react-dom/client';
import './design/global.css';
import './design/components.css';
import './i18n';
import App from './app/App';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
