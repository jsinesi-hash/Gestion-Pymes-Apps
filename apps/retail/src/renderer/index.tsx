import React from 'react';
import { createRoot } from 'react-dom/client';
import { configurarBridge } from '@core/ui';
import '@core/ui/styles/fonts.css';
import '@core/ui/styles/global.css';
import App from './App';

configurarBridge('ferreteria');

// Red de seguridad recomendada para Electron: sin esto, soltar un archivo FUERA de una
// zona de drop propia (aunque sea por un par de píxeles) hace que Chromium navegue la
// ventana entera a file://<ruta>, reemplazando la app. No debería hacer falta para que
// las zonas de arrastrar-y-soltar de la app funcionen (esas ya llaman preventDefault),
// pero es la práctica estándar documentada por Electron para no perder la ventana entera
// por un drop que cae unos píxeles afuera del target.
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found in index.html');
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
