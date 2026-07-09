import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Demo } from './Demo';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initTheme, setMode } from './lib/theme';
import './index.css';
import './styles.css';

initTheme();

const params = new URLSearchParams(window.location.search);

// Optional `?theme=light|dark|system` override — handy for sharing a themed link or previewing.
const themeParam = params.get('theme');
if (themeParam === 'light' || themeParam === 'dark' || themeParam === 'system') {
  setMode(themeParam);
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

// `?demo=1` renders the standalone component gallery (no backend required).
const isDemo = params.get('demo') === '1';

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isDemo ? (
        <Demo />
      ) : (
        <ToastProvider>
          <App />
        </ToastProvider>
      )}
    </ErrorBoundary>
  </React.StrictMode>,
);
