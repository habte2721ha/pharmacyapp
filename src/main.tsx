import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './utils/offlineManager.ts'; // Initialize global window.fetch interceptor for full offline support
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Manage Service Worker for offline load capability
if ('serviceWorker' in navigator) {
  if ((import.meta as any).env?.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('[SW] Service Worker registered successfully:', reg.scope))
        .catch((err) => console.warn('[SW] Service Worker registration failed:', err));
    });
  } else {
    // In dev mode, unregister any active service worker to avoid stale React chunk collisions
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    });
    // Invalidate stale caches from previous dev runs
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const k of keys) {
          if (k.startsWith('sonan-pharmacy')) {
            caches.delete(k).catch(() => {});
          }
        }
      });
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

