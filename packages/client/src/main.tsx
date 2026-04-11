import React from 'react';
import ReactDOM from 'react-dom/client';
import './ui/global.css';
import App from './App';
import { preloadCardImages } from './ui/cardImages';

preloadCardImages();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
