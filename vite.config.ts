import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs/promises';
import svgr from '@svgr/rollup';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const gateway = env.AIOT_GATEWAY_URL || 'http://35.252.210.77:9080';
  return {
    server: { proxy: { '/api/v1': { target: gateway, changeOrigin: true } } },
    preview: { proxy: { '/api/v1': { target: gateway, changeOrigin: true } } },
    resolve: {
      alias: {
        src: resolve(__dirname, 'src'),
        '@': resolve(__dirname, 'src'),
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        plugins: [
          {
            name: 'load-js-files-as-tsx',
            setup(build: {
              onLoad: (
                arg0: { filter: RegExp },
                arg1: (args: { path: string }) => Promise<{ loader: string; contents: string }>,
              ) => void;
            }) {
              build.onLoad({ filter: /src\\.*\.js$/ }, async (args) => ({
                loader: 'tsx',
                contents: await fs.readFile(args.path, 'utf8'),
              }));
            },
          },
        ],
      },
    },

    plugins: [svgr(), react()],
  };
});
