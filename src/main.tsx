import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './utils/offlineManager.ts'; // Initialize global window.fetch interceptor for full offline support
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Register Service Worker for offline load capability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[SW] Service Worker registered successfully:', reg.scope))
      .catch((err) => console.warn('[SW] Service Worker registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

