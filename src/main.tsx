import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initOmniConsole } from 'omniconsole';

initOmniConsole({
  defaultDock: "bottom",
});

createRoot(document.getElementById('root')!).render(<App />);