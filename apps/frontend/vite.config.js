import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// function copyCanvasKitWasm() {
//   return {
//     name: 'copy-canvaskit-wasm',
//     buildStart() {
//       const src = path.resolve(__dirname, 'node_modules/canvaskit-wasm/bin/canvaskit.wasm');
//       const dest = path.resolve(__dirname, 'public/canvaskit.wasm');
//       if (fs.existsSync(src) && !fs.existsSync(dest)) {
//         fs.copyFileSync(src, dest);
//       }
//     },
//   };
// }

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
