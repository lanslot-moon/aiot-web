import { RouterProvider } from 'react-router';
import { Toaster } from 'src/components/ui/sonner';
import { OpenPlatformProvider } from 'src/context/open-platform-context';
import { IamProvider } from './context/iam-context';
import router from './routes/Router';
import './css/globals.css';

function App() {
  return (
    <IamProvider>
      <OpenPlatformProvider>
        <RouterProvider router={router} />
        <Toaster />
      </OpenPlatformProvider>
    </IamProvider>
  );
}

export default App;
