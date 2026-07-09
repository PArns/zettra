import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initTheme } from './lib/theme';
import './styles.css';

initTheme();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
