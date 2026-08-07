// ─── DATE DISPLAY ──────────────────────────────────────────────
document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
});

// ─── NAVIGATION ──────────────────────────────────────────────
const navItems = document.querySelectorAll('.nav-item[data-page]');
const pages = {
    dashboard: document.getElementById('page-dashboard'),
    billing: document.getElementById('page-billing'),
    'billing-history': document.getElementById('page-billing-history'),
    menu: document.getElementById('page-menu'),
    stations: document.getElementById('page-stations'),
    tables: document.getElementById('page-tables'),
    staff: document.getElementById('page-staff'),
    'print-settings': document.getElementById('page-print-settings'),
};

function navigateTo(pageId) {
    Object.values(pages).forEach(p => { if (p) p.classList.remove('active'); });
    if (pages[pageId]) pages[pageId].classList.add('active');
    navItems.forEach(item => { item.classList.toggle('active', item.dataset.page === pageId); });
    closeModal();
    if (pageId === 'billing') renderBillingFloor();
}

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (page === 'logout') { if (confirm('Logout from admin panel?')) { alert('🔒 Logged out successfully.'); } return; }
        navigateTo(page);
    });
});
window.navigateTo = navigateTo;

// ─── MODAL SYSTEM ────────────────────────────────────────────
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');

const MODAL_TEMPLATES = {
    settleBill: (table, total) => `
        <div class="modal-header"><h3>Settle Bill</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Table ${table}</span><span>${total}</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>3x Spring Rolls</span><span>$26.97</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>2x Garlic Bread</span><span>$11.00</span></div>
            <div style="border-top:1px solid #d1d9e6;padding-top:8px;font-weight:700;display:flex;justify-content:space-between;"><span>Total</span><span>${total}</span></div>
        </div>
        <div class="form-group"><label>Payment Method</label><select><option>Cash</option><option>Card</option><option>UPI</option></select></div>
        <div class="alert-success"><i class="fas fa-check-circle"></i><span>This will close the session and generate a bill.</span></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-success" onclick="closeModal();alert('✅ Bill settled successfully! Session closed.')">Confirm Settlement</button></div>
    `,
    addCategory: () => `
        <div class="modal-header"><h3>Add Category</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Category Name</label><input type="text" placeholder="e.g. Starters" /></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal();alert('✅ Category added successfully!')">Save</button></div>
    `,
    editCategory: (name) => `
        <div class="modal-header"><h3>Edit Category</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Category Name</label><input type="text" value="${name}" /></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal();alert('✅ Category updated successfully!')">Update</button></div>
    `,
    addItem: (category) => `
        <div class="modal-header"><h3>Add Menu Item</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Item Name</label><input type="text" placeholder="e.g. Pizza" /></div>
        <div class="form-group"><label>Price ($)</label><input type="number" placeholder="9.99" /></div>
        <div class="form-group"><label>Station</label><select><option>Grill</option><option>Beverage</option><option>Desserts</option></select></div>
        <div class="form-group"><label>Category</label><select><option>${category}</option><option>Starters</option><option>Main Course</option><option>Desserts</option></select></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal();alert('✅ Item added successfully!')">Save</button></div>
    `,
    editItem: (name, price, station) => `
        <div class="modal-header"><h3>Edit Item</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Item Name</label><input type="text" value="${name}" /></div>
        <div class="form-group"><label>Price ($)</label><input type="number" value="${price.replace('$','')}" /></div>
        <div class="form-group"><label>Station</label><select><option selected>${station}</option><option>Grill</option><option>Beverage</option><option>Desserts</option></select></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal();alert('✅ Item updated successfully!')">Update</button></div>
    `,
    reassignStation: (itemName, currentStation) => `
        <div class="modal-header"><h3>Reassign Station</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:16px;"><strong>${itemName}</strong> is currently in <span class="badge badge-blue">${currentStation}</span></div>
        <div class="form-group"><label>New Station</label><select><option ${currentStation==='Grill'?'selected':''}>Grill</option><option ${currentStation==='Beverage'?'selected':''}>Beverage</option><option ${currentStation==='Desserts'?'selected':''}>Desserts</option></select></div>
        <div class="alert-info"><i class="fas fa-info-circle"></i><span>This only affects <strong>future orders</strong>. Existing orders will still go to the original station.</span></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal();alert('✅ Station reassigned!')">Reassign</button></div>
    `,
    addStation: () => `
        <div class="modal-header"><h3>Add Station</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Station Name</label><input type="text" placeholder="e.g. Pizza Station" /></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal();alert('✅ Station added successfully!')">Save</button></div>
    `,
    editStation: (name) => `
        <div class="modal-header"><h3>Edit Station</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Station Name</label><input type="text" value="${name}" /></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal();alert('✅ Station updated successfully!')">Update</button></div>
    `,
    addTable: () => `
        <div class="modal-header"><h3>Add Table</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Table Number</label><input type="text" placeholder="e.g. 6" /></div>
        <div class="form-group"><label>Status</label><select><option>Active</option><option>Inactive</option></select></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal();alert('✅ Table added! QR code generated.')">Save</button></div>
    `,
    editTable: (number, status) => `
        <div class="modal-header"><h3>Edit Table</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Table Number</label><input type="text" value="${number}" /></div>
        <div class="form-group"><label>Status</label><select><option ${status==='Active'?'selected':''}>Active</option><option ${status==='Inactive'?'selected':''}>Inactive</option></select></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal();alert('✅ Table updated successfully!')">Update</button></div>
    `,
    regenerateQR: (table, token) => `
        <div class="modal-header"><h3>Regenerate QR Code</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="qr-preview" id="qrPreview"><i class="fas fa-qrcode"></i><p style="margin-top:8px;font-size:13px;color:#64748b;">Current QR for ${table}</p><span class="token" id="oldToken">${token}</span></div>
        <div class="alert-warning"><i class="fas fa-exclamation-triangle"></i><span>Regenerating will invalidate the old QR. Customers using the old QR will need a new one.</span></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-danger" onclick="regenerateQR('${table}')"><i class="fas fa-qrcode"></i> Regenerate QR</button></div>
    `,
    assignRole: () => `
        <div class="modal-header"><h3>Assign Role</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>User</label><select><option>Rajesh Kumar</option><option selected>Priya Sharma</option><option>Vikram Singh</option><option>Ananya Reddy</option><option>Deepak Gupta</option></select></div>
        <div class="form-group"><label>Role</label><select><option>Admin</option><option>Server</option><option>Kitchen Staff</option></select></div>
        <div class="alert-info"><i class="fas fa-info-circle"></i><span>User will have access to the assigned dashboard and permissions.</span></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal();alert('✅ Role assigned successfully!')">Assign</button></div>
    `
};

function openModal(templateKey, ...args) {
    const template = MODAL_TEMPLATES[templateKey];
    if (!template) { console.warn('Unknown modal:', templateKey); return; }
    modalContent.innerHTML = typeof template === 'function' ? template(...args) : template;
    modalOverlay.classList.add('active');
}
window.openModal = openModal;

function closeModal() {
    modalOverlay.classList.remove('active');
    modalContent.innerHTML = '';
}
window.closeModal = closeModal;

modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ─── DINING TABLE FLOOR (BILLING) ───────────────────────────
const TABLE_SESSIONS = [
    { table: 5, session: '#S-0421', items: 6, total: 84.50, status: 'ready', statusLabel: '3 ready' },
    { table: 12, session: '#S-0418', items: 9, total: 142.00, status: 'served', statusLabel: 'All served' },
    { table: 3, session: '#S-0423', items: 4, total: 56.00, status: 'delayed', statusLabel: 'Delayed' },
    { table: 7, session: '#S-0415', items: 2, total: 28.50, status: 'served', statusLabel: 'All served' },
    { table: 9, session: '#S-0422', items: 5, total: 67.00, status: 'ready', statusLabel: '2 ready' },
];
const EMPTY_TABLES = [1, 2, 4, 6, 8, 10, 11];

const TABLE_HISTORY = {
    5: [
        { bill: '#B-0390', date: 'Aug 5, 2026', total: 62.00, method: 'Cash' },
        { bill: '#B-0355', date: 'Aug 2, 2026', total: 45.50, method: 'Card' },
    ],
    12: [
        { bill: '#B-0401', date: 'Aug 6, 2026', total: 98.00, method: 'UPI' },
    ],
    3: [
        { bill: '#B-0312', date: 'Jul 30, 2026', total: 39.00, method: 'Cash' },
        { bill: '#B-0288', date: 'Jul 25, 2026', total: 71.20, method: 'Card' },
        { bill: '#B-0260', date: 'Jul 20, 2026', total: 52.00, method: 'Cash' },
    ],
    7: [],
    9: [
        { bill: '#B-0398', date: 'Aug 6, 2026', total: 33.50, method: 'UPI' },
    ],
};

function statusBadgeClass(status) {
    if (status === 'ready') return 'badge-yellow';
    if (status === 'served') return 'badge-green';
    if (status === 'delayed') return 'badge-red';
    return 'badge-gray';
}

function diningTableTile(t) {
    const hasSession = !!t.session;
    const popover = hasSession ? `
        <div class="table-popover">
            <div class="popover-header">Table ${t.table} <span class="badge ${statusBadgeClass(t.status)}">${t.statusLabel}</span></div>
            <div class="popover-row"><span>Session</span><span>${t.session}</span></div>
            <div class="popover-row"><span>Items</span><span>${t.items}</span></div>
            <div class="popover-row total"><span>Total</span><span>$${t.total.toFixed(2)}</span></div>
        </div>
    ` : `
        <div class="table-popover">
            <div class="popover-header">Table ${t.table}</div>
            <div class="popover-empty">No active session</div>
        </div>
    `;
    return `
        <div class="dining-table-wrap">
            <div class="dining-table status-${t.status}" onclick="openBillingHistory(${t.table})">
                <span class="chair chair-top"></span>
                <span class="chair chair-bottom"></span>
                <span class="chair chair-left"></span>
                <span class="chair chair-right"></span>
                <div class="table-number">${t.table}</div>
                ${hasSession ? '<div class="table-status-dot"></div>' : ''}
            </div>
            ${popover}
        </div>
    `;
}

function renderBillingFloor() {
    const grid = document.getElementById('billingFloorGrid');
    if (!grid) return;
    let html = '';
    TABLE_SESSIONS.forEach(t => { html += diningTableTile(t); });
    EMPTY_TABLES.forEach(num => { html += diningTableTile({ table: num, status: 'empty' }); });
    grid.innerHTML = html;
}

function renderBillingHistory(tableNumber) {
    const session = TABLE_SESSIONS.find(t => t.table === tableNumber);
    const history = TABLE_HISTORY[tableNumber] || [];
    const title = document.getElementById('billingHistoryTitle');
    if (title) title.textContent = 'Table ' + tableNumber;

    let html = '';
    if (session) {
        html += `
            <div class="card" style="margin-bottom:20px;">
                <div class="card-title"><span><i class="fas fa-receipt" style="color:#2563eb;margin-right:6px;"></i> Current Open Session</span></div>
                <div style="background:#f8fafc;padding:16px;border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Session</span><strong>${session.session}</strong></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Items</span><strong>${session.items}</strong></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Status</span><span class="badge ${statusBadgeClass(session.status)}">${session.statusLabel}</span></div>
                    <div style="display:flex;justify-content:space-between;border-top:1px solid #d1d9e6;padding-top:8px;font-weight:700;"><span>Total</span><span>$${session.total.toFixed(2)}</span></div>
                </div>
                <button class="btn btn-success" style="margin-top:14px;width:100%;justify-content:center;" onclick="openModal('settleBill','Table ${tableNumber}','$${session.total.toFixed(2)}')"><i class="fas fa-check-circle"></i> Settle This Bill</button>
            </div>
        `;
    } else {
        html += `<div class="alert-info" style="margin-bottom:20px;"><i class="fas fa-info-circle"></i><span>No active session right now for this table.</span></div>`;
    }

    html += `<div class="card-title" style="margin:0 0 12px;"><span><i class="fas fa-clock-rotate-left" style="color:#64748b;margin-right:6px;"></i> Past Bills</span></div>`;
    if (history.length === 0) {
        html += `<div class="card" style="text-align:center;color:#94a3b8;padding:32px;">No billing history yet for this table.</div>`;
    } else {
        html += `<div class="table-wrap"><table><thead><tr><th>Bill</th><th>Date</th><th>Total</th><th>Payment</th></tr></thead><tbody>`;
        history.forEach(h => {
            html += `<tr><td><strong>${h.bill}</strong></td><td>${h.date}</td><td>$${h.total.toFixed(2)}</td><td>${h.method}</td></tr>`;
        });
        html += `</tbody></table></div>`;
    }

    const container = document.getElementById('billingHistoryContent');
    if (container) container.innerHTML = html;
}

function openBillingHistory(tableNumber) {
    Object.values(pages).forEach(p => { if (p) p.classList.remove('active'); });
    if (pages['billing-history']) pages['billing-history'].classList.add('active');
    navItems.forEach(item => { item.classList.toggle('active', item.dataset.page === 'billing'); });
    renderBillingHistory(tableNumber);
    closeModal();
}
window.openBillingHistory = openBillingHistory;

function backToBilling() {
    navigateTo('billing');
}
window.backToBilling = backToBilling;

// ─── REGENERATE QR ─────────────────────────────────────────
function regenerateQR(table) {
    const newToken = 'qr_' + Math.random().toString(36).substring(2, 10) + '-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 6);
    const oldTokenEl = document.getElementById('oldToken');
    if (oldTokenEl) { oldTokenEl.textContent = 'NEW: ' + newToken; oldTokenEl.style.color = '#16a34a'; oldTokenEl.style.fontWeight = 'bold'; }
    const preview = document.getElementById('qrPreview');
    if (preview) {
        const success = document.createElement('div');
        success.className = 'alert-success';
        success.style.marginTop = '12px';
        success.innerHTML = `<i class="fas fa-check-circle"></i> New QR code generated for ${table}!`;
        preview.appendChild(success);
    }
    const btns = document.querySelectorAll('.modal-actions .btn-danger');
    btns.forEach(b => { b.disabled = true; b.textContent = '✅ Done'; });
    setTimeout(() => { closeModal(); alert('✅ QR code regenerated successfully!\nNew token: ' + newToken); }, 1200);
}
window.regenerateQR = regenerateQR;

// ─── TOGGLE AVAILABILITY ────────────────────────────────────
function toggleAvailability(el) {
    el.classList.toggle('active');
    const label = el.querySelector('.label');
    if (el.classList.contains('active')) { label.textContent = 'Active'; label.style.color = '#166534'; const row = el.closest('.menu-item-row'); if (row) row.style.borderLeft = '3px solid #22c55e'; }
    else { label.textContent = 'Inactive'; label.style.color = '#991b1b'; const row = el.closest('.menu-item-row'); if (row) row.style.borderLeft = '3px solid #ef4444'; }
}
window.toggleAvailability = toggleAvailability;

// ─── DELETE CATEGORY ────────────────────────────────────────
function deleteCategory(categoryName, itemCount) {
    if (itemCount > 0) { alert(`⚠️ Cannot delete "${categoryName}" because it contains ${itemCount} item(s).\n\nPlease move or delete the items first.`); return; }
    if (confirm(`⚠️ Are you sure you want to delete the category "${categoryName}"?`)) { alert(`🗑️ Category "${categoryName}" deleted successfully.`); }
}
window.deleteCategory = deleteCategory;

// ─── DELETE STATION ─────────────────────────────────────────
function deleteStation(stationName, itemCount) {
    if (itemCount > 0) { alert(`⚠️ Cannot delete "${stationName}" because ${itemCount} menu item(s) are assigned to it.\n\nPlease reassign or delete the items first.`); return; }
    if (confirm(`⚠️ Are you sure you want to delete the station "${stationName}"?`)) { alert(`🗑️ Station "${stationName}" deleted successfully.`); }
}
window.deleteStation = deleteStation;

// ─── CONFIRM DELETE ─────────────────────────────────────────
function confirmDelete(type, name) {
    const displayName = name || type;
    if (confirm(`⚠️ Are you sure you want to delete this ${type.toLowerCase()}?`)) { alert(`🗑️ ${type} "${displayName}" deleted successfully.`); }
}
window.confirmDelete = confirmDelete;

// ─── BAR CHART ANIMATION ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const bars = document.querySelectorAll('.bar');
    bars.forEach((bar, i) => {
        const height = parseInt(bar.style.height);
        bar.style.height = '4px';
        setTimeout(() => { bar.style.height = height + 'px'; }, 100 + (i * 80));
    });
});

console.log('📊 Enhanced Admin Dashboard with Full Mock Data loaded successfully.');
console.log('📈 Pages: Dashboard, Billing, Menu, Stations, Tables, Staff, Print Settings.');
console.log('✅ All pages populated with realistic mock data.');
