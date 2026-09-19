// src/firebase-messaging-sw.js
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBLbxuoY0cR_MiFuxE82mV0QeLklpjLBj0",
  authDomain: "donapaty-a8a8b.firebaseapp.com",
  projectId: "donapaty",
  storageBucket: "donapaty.firebasestorage.app",
  messagingSenderId: "1021600656444",
  appId: "1:1021600656444:web:6f978ceae0132304336739"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'DonaPaty';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Tienes una nueva actualización en tu pedido.',
    icon: '/assets/icon/favicon.png',
    badge: '/assets/icon/favicon.png',
    data: {
      url: payload.fcmOptions?.link || payload.data?.url || '/mis-pedidos',
      ...payload.data
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/mis-pedidos';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
