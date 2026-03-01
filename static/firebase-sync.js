// Update Firebase when order status changes
function updateFirebaseOrder(orderId, status) {
    if (!window.db) {
        console.warn('Firebase not initialized');
        return;
    }
    
    window.db.collection('orders').doc(orderId).update({
        status: status,
        updatedAt: Date.now()
    })
    .then(() => console.log('✅ Firebase order updated'))
    .catch(err => console.error('❌ Firebase update failed:', err));
}

// Intercept order update forms
document.addEventListener('DOMContentLoaded', function() {
    const orderForms = document.querySelectorAll('form[action*="/update"]');
    
    orderForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const orderId = form.action.split('/orders/')[1]?.split('/')[0];
            const status = form.querySelector('[name="status"]')?.value;
            
            if (orderId && status) {
                updateFirebaseOrder(orderId, status);
            }
        });
    });
});

// Bulk update
function bulkUpdateFirebase(orderIds, status) {
    if (!window.db) return;
    
    const batch = window.db.batch();
    
    orderIds.forEach(orderId => {
        const ref = window.db.collection('orders').doc(orderId);
        batch.update(ref, { status: status, updatedAt: Date.now() });
    });
    
    batch.commit()
        .then(() => console.log(`✅ ${orderIds.length} orders updated in Firebase`))
        .catch(err => console.error('❌ Bulk update failed:', err));
}
