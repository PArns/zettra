import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Demo } from './Demo';
import { ShellPreview } from './ShellPreview';
import { AnnotationLayer } from './annotate/AnnotationLayer';
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

// Backend-free previews: `?demo=1` = component gallery, `?shell=1` = Tana-style app shell.
const isDemo = params.get('demo') === '1';
const isShell = params.get('shell') === '1';

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isDemo ? (
        <Demo />
      ) : isShell ? (
        <ToastProvider>
          <ShellPreview />
        </ToastProvider>
      ) : (
        <ToastProvider>
          <App />
        </ToastProvider>
      )}
      {/* Admin-only design annotation overlay (renders null unless admin mode is on). */}
      <AnnotationLayer />
    </ErrorBoundary>
  </React.StrictMode>,
);
