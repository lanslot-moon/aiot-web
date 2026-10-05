import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './css/globals.css';
import App from './App';
import Spinner from './views/spinner/Spinner';
import { ThemeProvider } from './context/shadcntheme/ThemeContext';

// Retire the old mock worker before rendering. All API traffic uses the gateway.
async function start() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    let controlledByMock = false;
    for (const registration of registrations) {
      const workers = [registration.active, registration.waiting, registration.installing];
      if (
        workers.some(
          (worker) => worker && new URL(worker.scriptURL).pathname === '/mockServiceWorker.js',
        )
      ) {
        controlledByMock ||= navigator.serviceWorker.controller === registration.active;
        await registration.unregister();
      }
    }
    if (controlledByMock && !sessionStorage.getItem('aiot:mock-retired')) {
      sessionStorage.setItem('aiot:mock-retired', '1');
      window.location.reload();
      return;
    }
  }
  createRoot(document.getElementById('root')!).render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <Suspense fallback={<Spinner />}>
        <App />
      </Suspense>
    </ThemeProvider>,
  );
}
void start();
