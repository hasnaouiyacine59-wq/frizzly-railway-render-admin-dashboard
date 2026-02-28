// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCoTZoQRtiTATNY5JCWqTMCKDxoTcIok3E",
  projectId: "frizzly-9a65f",
  messagingSenderId: "941997129015",
  appId: "1:941997129015:web:c9c18a0c76b592f8006eb2"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'New Order';
  const notificationOptions = {
    body: payload.notification?.body || 'A new order has been placed',
    icon: '/static/favicon.ico',
    badge: '/static/favicon.ico',
    tag: 'order-notification',
    requireInteraction: true,
    data: payload.data
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Open dashboard orders page
  event.waitUntil(
    clients.openWindow('/orders')
  );
});
