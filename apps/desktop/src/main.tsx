import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import './styles/globals.css';
import i18n from './i18n/i18n';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  );
} else {
  console.error('Root container not found');
}