import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const OFFLINE_PAGE_PATH = '/offline.html';

function shouldShowOfflinePage() {
  return (
    typeof navigator !== 'undefined' &&
    navigator.onLine === false &&
    window.location.pathname !== OFFLINE_PAGE_PATH
  );
}

function redirectToOfflinePage() {
  if (!shouldShowOfflinePage()) return false;

  const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const offlineUrl = `${OFFLINE_PAGE_PATH}?from=${encodeURIComponent(returnPath)}`;

  window.location.replace(offlineUrl);
  return true;
}

window.addEventListener('offline', () => {
  redirectToOfflinePage();
});

if (!redirectToOfflinePage()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data?.type !== "GRAVIUM_NAVIGATE") return;

    const targetUrl = event.data.url;

    if (typeof targetUrl !== "string") return;

    window.location.assign(targetUrl);
  });
}
