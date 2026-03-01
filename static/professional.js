// Professional Dashboard Features

// Toast Notifications
function showToast(message, type = 'success') {
    const colors = {
        success: 'bg-success',
        error: 'bg-danger',
        warning: 'bg-warning',
        info: 'bg-info'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white ${colors[type]} border-0`;
    toast.setAttribute('role', 'alert');
    toast.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 9999; min-width: 300px;';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    document.body.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

// Loading Overlay
function showLoading() {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    overlay.innerHTML = '<div class="spinner-border text-light" style="width: 3rem; height: 3rem;"></div>';
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.remove();
}

// Auto-refresh
let refreshInterval;
function startAutoRefresh(seconds = 30) {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => location.reload(), seconds * 1000);
    showToast(`Auto-refresh enabled (${seconds}s)`, 'info');
}

// Export to CSV
function exportToCSV(tableId, filename = 'export.csv') {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    let csv = [];
    table.querySelectorAll('tr').forEach(row => {
        const cols = [];
        row.querySelectorAll('td, th').forEach(col => {
            cols.push('"' + col.textContent.trim().replace(/"/g, '""') + '"');
        });
        csv.push(cols.join(','));
    });
    
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

// Copy to Clipboard
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied!', 'success');
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Convert flash messages to toasts
    document.querySelectorAll('.alert').forEach(alert => {
        const type = alert.classList.contains('alert-success') ? 'success' :
                    alert.classList.contains('alert-danger') ? 'error' : 'info';
        showToast(alert.textContent.trim(), type);
        alert.remove();
    });
});
