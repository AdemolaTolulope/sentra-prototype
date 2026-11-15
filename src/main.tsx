import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import './styles.css';
import './platform/platform.css';
import App from './App';
// The pinned MapLibre 6 worker is a self-contained module. Vite serves it raw
// in development and emits a hashed URL asset for production/offline use.
setWorkerUrl(import.meta.env.DEV ? '/__sentra-maplibre-worker.mjs' : maplibreWorkerUrl);
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {}); });
}
