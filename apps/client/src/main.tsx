import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Demo } from './Demo';
import { ShellPreview } from './ShellPreview';
import { AnnotationLayer } from './annotate/AnnotationLayer';
import { I18nProvider } from './i18n';
import { ToastProvider } from './components/Toast';
import { DialogProvider } from './components/Dialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initTheme, setMode } from './lib/theme';
import { initAccent, isAccent, setAccent } from './lib/accent';
import './index.css';
import './styles.css';

initTheme();
initAccent();

const params = new URLSearchParams(window.location.search);

// Optional `?theme=light|dark|system` override — handy for sharing a themed link or previewing.
const themeParam = params.get('theme');
if (themeParam === 'light' || themeParam === 'dark' || themeParam === 'system') {
  setMode(themeParam);
}
// Optional `?accent=teal|blue|violet|…` override for previews.
const accentParam = params.get('accent');
if (isAccent(accentParam)) setAccent(accentParam);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

// Backend-free previews: `?demo=1` = component gallery, `?shell=1` = Tana-style app shell.
const isDemo = params.get('demo') === '1';
const isShell = params.get('shell') === '1';

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        {isDemo ? (
          <Demo />
        ) : isShell ? (
          <ToastProvider>
            <ShellPreview />
          </ToastProvider>
        ) : (
          <ToastProvider>
            <DialogProvider>
              <App />
            </DialogProvider>
          </ToastProvider>
        )}
        {/* Admin-only design annotation overlay (renders null unless admin mode is on). */}
        <AnnotationLayer />
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
