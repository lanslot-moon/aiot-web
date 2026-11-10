import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = process.argv[2];
if (!destination) throw new Error('Pass the absolute output fragment path.');
const result = await build({
  configFile: false,
  root: workspace,
  resolve: { alias: { '@': resolve(workspace, 'src'), src: resolve(workspace, 'src') } },
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    write: false,
    minify: true,
    lib: { entry: resolve(workspace, 'src/prototypes/ota/index.tsx'), name: 'OtaPreview', formats: ['iife'] },
  },
});
const output = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
const script = output.filter(item => item.type === 'chunk').map(item => item.code).join('\n');
const css = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => String(item.source)).join('\n').replace(/@font-face\s*\{[^}]*\}/g, '');
const template = await readFile(resolve(workspace, 'prototypes/ota-fragment.template.html'), 'utf8');
const fragment = template.replace('/* OTA_PREVIEW_CSS */', () => css).replace('/* OTA_PREVIEW_JS */', () => script.replaceAll('</script', '<\\/script'));
if (Buffer.byteLength(fragment) > 1000000) throw new Error('Inline preview exceeds 1 MB.');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, fragment);
console.log(`OTA preview: ${Buffer.byteLength(fragment)} bytes → ${destination}`);
