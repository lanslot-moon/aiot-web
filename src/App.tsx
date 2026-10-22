import { RouterProvider } from 'react-router';
import { SWRConfig } from 'swr';
import { applicationSWRConfig } from './lib/swr-config';
import { Toaster } from 'src/components/ui/sonner';
import { OpenPlatformProvider } from 'src/context/open-platform-context';
import { IamProvider } from './context/iam-context';
import router from './routes/Router';
import './css/globals.css';

function App() {
  return (
    <SWRConfig value={applicationSWRConfig}>
      <IamProvider>
        <OpenPlatformProvider>
          <RouterProvider router={router} />
          <Toaster />
        </OpenPlatformProvider>
      </IamProvider>
    </SWRConfig>
  );
}

export default App;
