import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const loader = document.createElement("div");
loader.id = "app-loader";
loader.innerText = "Loading Gravium OS...";
document.body.appendChild(loader);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
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
