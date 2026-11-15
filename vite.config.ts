import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Serve the pinned, self-contained MapLibre 6 worker without Vite's JS/HMR
// transformation in development. Production emits the same file as a hashed
// URL asset. Revalidate worker packaging when upgrading MapLibre.
function rawMapLibreDevWorker(): Plugin {
  return {
    name: 'sentra-maplibre-dev-worker',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/__sentra-maplibre-worker.mjs' || !['GET', 'HEAD'].includes(req.method ?? '')) return next();
        try {
          const worker = readFileSync(new URL('./node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url));
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          res.setHeader('Content-Length', worker.length);
          res.setHeader('Cache-Control', 'no-cache');
          res.end(req.method === 'HEAD' ? undefined : worker);
        } catch (error) { next(error as Error); }
      });
    },
  };
}

// Precache all emitted chunks and build a versioned worker. The version also
// changes if a bundled geographic asset changes, avoiding stale offline data.
function staticPrecacheManifest(): Plugin {
  return {
    name:'sentra-precache-manifest',
    generateBundle(_options, bundle) {
      const assets=Object.keys(bundle).filter(name=>name.startsWith('assets/')).sort().map(name=>`/${name}`);
      const template=readFileSync(new URL('./scripts/service-worker-template.js',import.meta.url),'utf8');
      const hash=createHash('sha256').update(template).update(JSON.stringify(assets));
      for(const path of ['favicon.svg','data/nigeria-adm1.geojson','data/nigeria-outline.geojson','data/west-africa-context.geojson','data/demo-markers.geojson','data/geoaccess/manifest.json']) {
        hash.update(readFileSync(new URL(`./public/${path}`,import.meta.url)));
      }
      const version=hash.digest('hex').slice(0,12);
      this.emitFile({type:'asset',fileName:'precache-manifest.json',source:JSON.stringify(assets)});
      this.emitFile({type:'asset',fileName:'sw.js',source:template.replace('__BUILD_ID__',version)});
    },
  };
}
// The browser always calls same-origin /api. This optional target is read by
// Vite on the server only; never expose internal hosts or secrets to the client.
const identityApiProxy = process.env.SENTRA_API_PROXY_TARGET
  ? { '/api': { target: process.env.SENTRA_API_PROXY_TARGET, changeOrigin: true } }
  : undefined;
export default defineConfig({
  plugins: [react(), rawMapLibreDevWorker(), staticPrecacheManifest()],
  server: { host: '0.0.0.0', allowedHosts: true, proxy: identityApiProxy },
  preview: { host: '0.0.0.0', allowedHosts: true, proxy: identityApiProxy },
  build: {
    chunkSizeWarningLimit: 1500,
    // Keep deck/luma's mutually dependent modules together in one lazy chunk.
    // Splitting their re-exports across chunks can create execution-order cycles.
    rollupOptions:{output:{manualChunks(id){
      if(/\/node_modules\/(?:@deck\.gl|@luma\.gl|@math\.gl|@loaders\.gl|@probe\.gl|@vis\.gl)\//.test(id))return 'deck-runtime';
      if(/\/node_modules\/(?:maplibre-gl|@maplibre)\//.test(id))return 'maplibre-runtime';
    }}},
  },
});
