import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs/promises';
import svgr from '@svgr/rollup';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const gateway = env.AIOT_GATEWAY_URL || 'http://8.229.57.42:9080';
  // Node 不会自动使用 Windows 系统代理，开发环境按需显式指定网关请求出口。
  const gatewayProxy = env.AIOT_GATEWAY_PROXY_URL;
  const agentOptions = gatewayProxy
    ? { proxyEnv: { HTTP_PROXY: gatewayProxy, HTTPS_PROXY: gatewayProxy } }
    : undefined;
  const agent = agentOptions
    ? (new URL(gateway).protocol === 'https:' ? new HttpsAgent(agentOptions) : new HttpAgent(agentOptions))
    : undefined;
  return {
    server: { proxy: { '/api/v1': { target: gateway, changeOrigin: true, agent } } },
    preview: { proxy: { '/api/v1': { target: gateway, changeOrigin: true, agent } } },
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
