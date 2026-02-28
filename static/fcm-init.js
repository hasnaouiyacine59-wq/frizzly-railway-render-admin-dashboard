// Firebase Cloud Messaging for Admin Dashboard
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';

const firebaseConfig = {
  apiKey: "AIzaSyCoTZoQRtiTATNY5JCWqTMCKDxoTcIok3E",
  projectId: "frizzly-9a65f",
  messagingSenderId: "941997129015",
  appId: "1:941997129015:web:c9c18a0c76b592f8006eb2"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Request permission and get token
async function initFCM() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging);
      
      // Save token to server
      await fetch('/api/save-fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      console.log('✅ FCM token saved');
    }
  } catch (error) {
    console.error('❌ FCM init error:', error);
  }
}

// Handle foreground messages
onMessage(messaging, (payload) => {
  console.log('📬 Foreground message:', payload);
  const { title, body } = payload.data;
  new Notification(title, { body, icon: '/static/favicon.ico' });
});

// Initialize on page load
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then(() => initFCM())
    .catch(err => console.error('❌ Service worker registration failed:', err));
}
