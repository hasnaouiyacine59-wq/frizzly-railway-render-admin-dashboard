// Firebase Configuration - REPLACE WITH YOUR ACTUAL CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyBOaVhKxGxLxGxLxGxLxGxLxGxLxGxLxGx", // ⚠️ REPLACE THIS
    authDomain: "frizzly-9a65f.firebaseapp.com",
    projectId: "frizzly-9a65f",
    storageBucket: "frizzly-9a65f.appspot.com",
    messagingSenderId: "123456789", // ⚠️ REPLACE THIS
    appId: "1:123456789:web:abcdef" // ⚠️ REPLACE THIS
};

// Initialize Firebase
let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    window.db = db; // Make available globally for firebase-sync.js
    console.log('✅ Firebase initialized successfully');
    
    // Test connection
    db.collection('orders').limit(1).get()
        .then(() => {
            console.log('✅ Firebase connection working');
            setupOrderListener();
        })
        .catch(err => {
            console.error('❌ Firebase connection failed:', err);
            console.error('⚠️ Check Firebase Security Rules - they may be blocking access');
        });
} catch (error) {
    console.error('❌ Firebase initialization failed:', error);
}

// Notification sound
const notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTKXh8bllHAU2jdXvzn0pBSh+zPLaizsKGGe67OmiUhELTqfj8bllHAU3j9bwz38qBSh/zfPbjDwLGGi77OqjUxEMUKjk8rpmHQU4kNfx0IEsBSqAzvPcjT0LGWm87OukUxIMUank87toHgU5ktjx0YMtBSuBz/PdjT4LGmq97OylVBIMU6vl87xpHwU6k9ny0oQuBSyCz/TejT8LG2u+7O2mVRMNVKzm9L1qIAU7lNrz04UvBSyC0PTejUALHGy/7O6nVhMNVa3m9L5rIQU8ldrz1IYwBi2D0fTfjUELHW3A7e+oVxQOVq7n9b9sIgU9ltvz1YcxBi6E0vXgjUILHm7B7fCpWBQOV6/o9cBtIwU+l9v01ogzBi+F0/XhjUMLH2/C7vCqWRUPWLDp9sFuJAY/mNz01Yk0BzCG1PbijkQMIHHD7/GrWhUPWbHq98FvJQZAmdz11Yo1BzGH1fbkj0UNIXLEBzKI1vblkEYNInPF8PKsWxYQW7Lr+MJwJgZBmtz21os2BzKJ1/fmkUcOI3TG8fOtXBYRXLPs+cNxJwZCm9331ow3BzOK2PfnkkgOJHXH8vSuXRcRXbTt+sRyKAdDnN741o04CDSLBzWM2fjpk0kPJXbI8/WvXhcSXrXu+8VzKQdEnN/51484CDaMBzeN2vnqlEoPJnfJ9PawXxgTX7bv/MZ0KgdFnd/62J05CTiOBziO2/rrlUsSJ3jK9fexYBkUYLfw/cd1KwhGnt/72Z86CTmP');

let lastOrderId = null;

function setupOrderListener() {
    if (!db) return;
    
    // Listen for new orders
    db.collection('orders').orderBy('timestamp', 'desc').limit(1)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const order = change.doc.data();
                    const orderId = change.doc.id;
                    
                    // Skip first load
                    if (lastOrderId === null) {
                        lastOrderId = orderId;
                        return;
                    }
                    
                    // New order detected
                    if (orderId !== lastOrderId) {
                        lastOrderId = orderId;
                        showNotification(order, orderId);
                    }
                }
            });
        });
    
    // Also update bell dropdown with recent orders
    updateBellNotifications();
}

function updateBellNotifications() {
    if (!db) return;
    
    db.collection('orders').orderBy('timestamp', 'desc').limit(50)
        .onSnapshot((snapshot) => {
            const notificationList = document.getElementById('notificationList');
            const badge = document.getElementById('notificationBadge');
            
            if (!notificationList) return;
            
            let newOrdersCount = 0;
            let html = '';
            let displayCount = 0;
            
            snapshot.docs.forEach((doc) => {
                const order = doc.data();
                const orderId = doc.id;
                
                // Check if order is new (less than 1 hour old)
                const orderTime = order.timestamp || 0;
                const isNew = (Date.now() - orderTime) < 3600000;
                
                if (isNew) newOrdersCount++;
                
                // Only show first 10 in dropdown
                if (displayCount < 10) {
                    html += `
                        <li>
                            <a class="dropdown-item ${isNew ? 'bg-light' : ''}" href="/orders/${orderId}">
                                <div class="d-flex align-items-start">
                                    <i class="bi bi-cart-check text-success me-2 mt-1"></i>
                                    <div class="flex-grow-1">
                                        <div class="fw-bold">Order #${orderId.slice(-8)}</div>
                                        <small class="text-muted">$${order.totalAmount || 0} - ${order.customerName || 'Customer'}</small>
                                        <br><small class="text-muted">${new Date(orderTime).toLocaleString()}</small>
                                    </div>
                                </div>
                            </a>
                        </li>
                    `;
                    displayCount++;
                }
            });
            
            if (html === '') {
                html = `
                    <li class="text-center text-muted py-3">
                        <i class="bi bi-bell-slash fs-4 d-block mb-2"></i>
                        No new notifications
                    </li>
                `;
            }
            
            notificationList.innerHTML = html;
            
            // Update badge with actual new orders count
            if (newOrdersCount > 0) {
                badge.textContent = newOrdersCount > 99 ? '99+' : newOrdersCount;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        });
}

function clearNotifications() {
    const badge = document.getElementById('notificationBadge');
    if (badge) badge.style.display = 'none';
}

function showNotification(order, orderId) {
    // Play sound
    notificationSound.play().catch(e => console.log('Sound play failed:', e));
    
    // Show browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('New Order! 🎉', {
            body: `Order #${orderId.slice(-8)} - $${order.totalAmount || 0}`,
            icon: '/static/logo.png',
            badge: '/static/logo.png',
            tag: orderId
        });
        
        // Redirect to order when clicked
        notification.onclick = function() {
            window.focus();
            window.location.href = `/orders/${orderId}`;
            notification.close();
        };
    }
    
    // Show toast notification
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cursor = 'pointer';
    toast.onclick = function() {
        window.location.href = `/orders/${orderId}`;
    };
    toast.innerHTML = `
        <div class="toast-header">
            <strong>🎉 New Order!</strong>
            <button onclick="event.stopPropagation(); this.parentElement.parentElement.remove()">&times;</button>
        </div>
        <div class="toast-body">
            Order #${orderId.slice(-8)}<br>
            Amount: $${order.totalAmount || 0}<br>
            Customer: ${order.customerName || 'N/A'}<br>
            <small class="text-muted">Click to view details</small>
        </div>
    `;
    document.body.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => toast.remove(), 5000);
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}
