import { createRoot } from 'react-dom/client';
import OtaPrototype from './OtaPrototype';
import '@/css/globals.css';
import './preview.css';

const root = document.getElementById('aiot-ota-preview');
if (root) createRoot(root).render(<OtaPrototype />);
