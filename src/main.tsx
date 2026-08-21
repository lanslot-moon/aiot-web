import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/css/globals.css';
import App from './App.tsx';
import Spinner from './views/spinner/Spinner.tsx';

import { ThemeProvider } from './context/shadcntheme/ThemeContext.tsx';
import {
  clearMockWorkerRecovery,
  reloadForMockWorkerRecovery,
} from './lib/mock-worker-recovery.ts';

const MOCK_WORKER_URL = '/mockServiceWorker.js';

function isMockWorkerScript(scriptUrl: string | undefined): boolean {
  if (!scriptUrl) return false;
  try {
    return new URL(scriptUrl, window.location.href).pathname === MOCK_WORKER_URL;
  } catch {
    return false;
  }
}

async function unregisterMockWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) =>
        [registration.active, registration.waiting, registration.installing].some(
          (worker) => isMockWorkerScript(worker?.scriptURL),
        ),
      )
      .map((registration) => registration.unregister()),
  );
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('application/json')) return null;

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function mockWorkerHealthCheck(): Promise<boolean> {
  try {
    const [healthResponse, productResponse] = await Promise.all([
      fetch('/api/v1/mock/health', { cache: 'no-store' }),
      // Probe a real product route as well. The health endpoint alone can be
      // served by an old worker while feature handlers are stale or missing.
      fetch('/api/v1/products/prod_gateway_01', { cache: 'no-store' }),
    ]);
    const healthBody = await readJsonResponse<{
      data?: { mocked?: boolean };
    }>(healthResponse);
    const productBody = await readJsonResponse<unknown>(productResponse);
    return healthBody?.data?.mocked === true && productBody != null;
  } catch {
    return false;
  }
}

async function deferRender() {
  const { worker } = await import('./api/mocks/browser.ts');
  const startOptions = {
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: MOCK_WORKER_URL,
      options: {
        updateViaCache: 'none',
        scope: '/',
      },
    },
  } as const;

  let started = false;
  try {
    await worker.start(startOptions);
    started = true;
    if (await mockWorkerHealthCheck()) {
      clearMockWorkerRecovery();
      return;
    }
  } catch (error) {
    console.warn('[mock-api] initial Service Worker start failed', error);
  }

  if (started) worker.stop();
  await unregisterMockWorker();

  try {
    await worker.start(startOptions);
    if (await mockWorkerHealthCheck()) {
      clearMockWorkerRecovery();
      return;
    }
  } catch (error) {
    console.warn('[mock-api] Service Worker recovery failed', error);
  }

  if (reloadForMockWorkerRecovery()) return;

  console.warn(
    '[mock-api] Service Worker health check failed; API requests may be unavailable.',
  );
}

deferRender().then(() => {
  createRoot(document.getElementById('root')!).render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <Suspense fallback={<Spinner />}>
        <App />
      </Suspense>
    </ThemeProvider>,
  );
});
