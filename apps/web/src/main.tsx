import React    from 'react';
import ReactDOM  from 'react-dom/client';
import App       from './App';
import './index.css';
import { initTheme } from './stores/theme.store';

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
