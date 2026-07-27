import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { SpringProvider } from '@/components/ui/Spring';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SpringProvider>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </SpringProvider>
  </React.StrictMode>
);
