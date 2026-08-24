import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function updateDarkClass(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
}

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  updateDarkClass(savedTheme === 'dark');
} else {
  updateDarkClass(darkQuery.matches);
}

darkQuery.addEventListener('change', (e) => {
  if (!localStorage.getItem('theme')) {
    updateDarkClass(e.matches);
  }
});

// Értesítés engedély kérés — csak egyszer, első indításkor (3mp késleltetéssel)
if ('Notification' in window && Notification.permission === 'default' && !localStorage.getItem('notifPermAsked')) {
  setTimeout(() => {
    Notification.requestPermission().then(() => {
      localStorage.setItem('notifPermAsked', '1');
    });
  }, 3000);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
