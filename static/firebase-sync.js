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

// Bulk update Firebase
function bulkUpdateFirebase(orderIds, status, progressCallback) {
    if (!window.db) return Promise.resolve();
    
    const batch = window.db.batch();
    const total = orderIds.length;
    let completed = 0;
    
    orderIds.forEach(orderId => {
        const ref = window.db.collection('orders').doc(orderId);
        batch.update(ref, { 
            status: status, 
            updatedAt: Date.now() 
        });
    });
    
    return batch.commit()
        .then(() => {
            console.log(`✅ ${orderIds.length} orders updated in Firebase`);
            if (progressCallback) progressCallback(total, total);
            return true;
        })
        .catch(err => {
            console.error('❌ Bulk update failed:', err);
            return false;
        });
}
