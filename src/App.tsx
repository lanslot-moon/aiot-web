import { RouterProvider } from 'react-router';
import { Toaster } from 'src/components/ui/sonner';
import { OpenPlatformProvider } from 'src/context/open-platform-context';
import router from './routes/Router';
import './css/globals.css';

function App() {
  return (
    <OpenPlatformProvider>
      <RouterProvider router={router} />
      <Toaster />
    </OpenPlatformProvider>
  );
}

export default App;
