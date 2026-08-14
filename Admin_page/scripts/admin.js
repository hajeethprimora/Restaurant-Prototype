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
    tables: document.getElementById('page-tables'),
    staff: document.getElementById('page-staff'),
};

function navigateTo(pageId) {
    Object.values(pages).forEach(p => { if (p) p.classList.remove('active'); });
    if (pages[pageId]) pages[pageId].classList.add('active');
    navItems.forEach(item => { item.classList.toggle('active', item.dataset.page === pageId); });
    closeModal();
    if (pageId === 'billing') setBillingView(currentBillingView);
    if (pageId === 'menu') { currentMenuCategory = null; currentMenuStation = null; renderAdminMenu(); }
    if (pageId === 'tables') renderAdminTables();
    if (pageId === 'staff') renderAdminStaff();
}

navItems.forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
});
window.navigateTo = navigateTo;

// ─── USER MENU (top-right avatar & logout) ─────────────────────
function initUserMenu() {
    const staff = window.FlameDineStore.getStaffUsers();
    const admin = staff.find(s => s.role === 'ADMIN') || staff[0];
    if (!admin) return;
    const initials = admin.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const roleLabel = admin.role.charAt(0) + admin.role.slice(1).toLowerCase();

    const avatarBtn = document.getElementById('userAvatarBtn');
    const nameEl = document.getElementById('userDropdownName');
    const roleEl = document.getElementById('userDropdownRole');
    if (avatarBtn) avatarBtn.textContent = initials;
    if (nameEl) nameEl.textContent = admin.name;
    if (roleEl) roleEl.textContent = `${roleLabel} · ${admin.branch}`;
}

function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}
window.toggleUserMenu = toggleUserMenu;

function handleLogout() {
    if (confirm('Logout from admin panel?')) {
        window.location.href = '../login.html';
    }
}
window.handleLogout = handleLogout;

document.addEventListener('click', (e) => {
    const menu = document.getElementById('userMenu');
    const dropdown = document.getElementById('userDropdown');
    if (menu && dropdown && !menu.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// ─── MODAL SYSTEM ────────────────────────────────────────────
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');

function openModal(templateKey, ...args) {
    const template = MODAL_TEMPLATES[templateKey];
    if (!template) { console.warn('Unknown modal:', templateKey); return; }
    modalContent.innerHTML = typeof template === 'function' ? template(...args) : template;
    modalOverlay.classList.add('active');
    wireCombos();
}
window.openModal = openModal;

function closeModal() {
    modalOverlay.classList.remove('active');
    modalContent.innerHTML = '';
}
window.closeModal = closeModal;

modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// MODAL TEMPLATES WITH REAL STORE BINDINGS
const MODAL_TEMPLATES = {
    settleBillModal: (tableNum) => {
        tableNum = parseInt(tableNum);
        const session = window.FlameDineStore.getOpenSessionForTable(tableNum);
        if (!session) return `<div>No active session</div>`;
        const items = window.FlameDineStore.getOrderItemsForSession(session.id).filter(i => i.status !== 'cancelled');
        const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0);
        const sst = Math.round(subtotal * 0.06 * 100) / 100;
        const svc = Math.round(subtotal * 0.05 * 100) / 100;
        const total = Math.round((subtotal + sst + svc) * 100) / 100;

        const itemsListHtml = items.map(i => `
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;">
                <span>${i.qty}x ${i.name}</span>
                <span>₹${i.price * i.qty}</span>
            </div>
        `).join('');

        return `
            <div class="modal-header"><h3>Settle Bill &middot; Table ${tableNum}</h3><button class="close" onclick="closeModal()">&times;</button></div>
            <div style="background:#f8fafc;padding:16px;border-radius:10px;margin-bottom:16px;border:1px solid #e2e8f0;">
                <div style="font-weight:700;margin-bottom:8px;border-bottom:1px solid #cbd5e1;padding-bottom:6px;">Itemized Order Summary</div>
                ${itemsListHtml}
                <div style="border-top:1px solid #cbd5e1;margin-top:8px;padding-top:8px;" id="settlementCalcArea">
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;"><span>Subtotal</span><span>₹${subtotal}</span></div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;"><span>Discount</span><span id="calcDiscountText">-₹0</span></div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;"><span>SST (6%)</span><span id="calcSstText">₹${sst}</span></div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;"><span>Service Tax (5%)</span><span id="calcSvcText">₹${svc}</span></div>
                    <div style="border-top:1px solid #cbd5e1;padding-top:6px;margin-top:6px;font-weight:800;font-size:16px;display:flex;justify-content:space-between;color:#18181b;">
                        <span>Final Bill Amount</span><span id="calcFinalTotalText" style="color:#e53935;">₹${total}</span>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label>Discount Amount (₹)</label>
                <input type="number" id="discountInput" placeholder="0" min="0" oninput="updateSettlementCalc(${subtotal})" />
            </div>

            <div class="form-group">
                <label>Payment Method</label>
                <select id="paymentMethodSelect">
                    <option value="Cash">Cash</option>
                    <option value="Card">Credit/Debit Card</option>
                    <option value="UPI">UPI / Digital Wallet</option>
                    <option value="UNPAID">UNPAID (Walkout Override)</option>
                </select>
            </div>

            <div class="alert-info"><i class="fas fa-info-circle"></i><span>Settles session and moves table to available state.</span></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn btn-success" onclick="executeSettlement(${tableNum})"><i class="fas fa-check-circle"></i> Confirm Settlement</button>
            </div>
        `;
    },

    correctPaymentModal: (billId) => `
        <div class="modal-header"><h3>Correct Payment Method</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="alert-warning"><i class="fas fa-exclamation-triangle"></i><span>Void and replace original bill record with corrected payment details.</span></div>
        <div class="form-group"><label>New Payment Method</label>
            <select id="newPaymentSelect">
                <option value="Cash">Cash</option>
                <option value="Card">Credit / Debit Card</option>
                <option value="UPI">UPI / Digital Wallet</option>
            </select>
        </div>
        <div class="form-group"><label>Reason for Correction</label>
            <input type="text" id="correctionReasonInput" placeholder="e.g. Customer originally selected cash but paid via card" required />
        </div>
        <div class="modal-actions">
            <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn btn-danger" onclick="executePaymentCorrection('${billId}')">Void &amp; Replace Bill</button>
        </div>
    `,

    addCategory: () => `
        <div class="modal-header"><h3>Add Category</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Category Name</label><input type="text" id="catNameInput" placeholder="e.g. Snacks" /></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="executeSaveCategory()">Save</button></div>
    `,

    addStation: () => `
        <div class="modal-header"><h3>Add Kitchen Station</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Station Name</label><input type="text" id="stationNameInput" placeholder="e.g. Tandoor" /></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="executeSaveStation()">Save</button></div>
    `,

    addItem: (category, station) => `
        <div class="modal-header"><h3>Add Menu Item</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group">
            <label>Item Image</label>
            <div class="image-upload-box" id="itemImageBox" onclick="document.getElementById('itemImageInput').click()">
                <img id="itemImagePreview" style="display:none;" />
                <div id="itemImagePlaceholder">
                    <i class="fas fa-camera"></i>
                    <span>Click to upload photo</span>
                </div>
            </div>
            <input type="file" id="itemImageInput" accept="image/*" style="display:none;" onchange="previewItemImage(event)" />
        </div>
        <div class="form-group"><label>Item Name</label><input type="text" id="itemNameInput" placeholder="e.g. Pasta Alfredo" /></div>
        <div class="form-group"><label>Price (₹)</label><input type="number" id="itemPriceInput" placeholder="199" /></div>
        <div class="form-group"><label>Category</label>${renderComboField('categoryCombo', 'category', category)}</div>
        <div class="form-group"><label>Kitchen Station</label>${renderComboField('stationCombo', 'station', station || '')}</div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="executeSaveItem()">Save Item</button></div>
    `,

    editItem: (itemId) => {
        const items = window.FlameDineStore.getMenuItems();
        const item = items.find(i => i.id === parseInt(itemId));
        if (!item) return `<div class="modal-header"><h3>Item Not Found</h3><button class="close" onclick="closeModal()">&times;</button></div>`;

        const thumbSrc = getItemThumbnailSrc(item);
        const imagePreviewStyle = thumbSrc ? `display:block;width:100%;height:100%;object-fit:cover;border-radius:10px;` : `display:none;`;
        const placeholderStyle = thumbSrc ? `display:none;` : ``;

        return `
            <div class="modal-header">
                <h3>✏️ Edit Dish &middot; ${item.name}</h3>
                <button class="close" onclick="closeModal()">&times;</button>
            </div>
            <div class="form-group">
                <label>Dish Photo</label>
                <div class="image-upload-box" id="itemImageBox" onclick="document.getElementById('itemImageInput').click()" style="height:100px;border:2px dashed #cbd5e1;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;background:#f8fafc;position:relative;">
                    <img id="itemImagePreview" src="${thumbSrc || ''}" style="${imagePreviewStyle}" />
                    <div id="itemImagePlaceholder" style="${placeholderStyle}text-align:center;color:#94a3b8;">
                        <i class="fas fa-camera text-xl block mb-1"></i>
                        <span style="font-size:12px;font-weight:600;">Click to upload photo</span>
                    </div>
                </div>
                <input type="file" id="itemImageInput" accept="image/*" style="display:none;" onchange="previewItemImage(event)" />
            </div>
            <div class="form-group"><label>Dish Name</label><input type="text" id="itemNameInput" value="${item.name.replace(/"/g, '&quot;')}" /></div>
            <div class="form-group"><label>Price (₹)</label><input type="number" id="itemPriceInput" value="${item.price}" /></div>
            <div class="form-group"><label>Category</label>${renderComboField('categoryCombo', 'category', item.category)}</div>
            <div class="form-group"><label>Kitchen Station (Re-assign Station)</label>${renderComboField('stationCombo', 'station', item.station)}</div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="executeSaveEditItem(${item.id})"><i class="fas fa-check-circle"></i> Save Changes</button>
            </div>
        `;
    },

    addTable: () => `
        <div class="modal-header"><h3>Add Table</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Table Number</label><input type="number" placeholder="13" /></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="closeModal();alert('✅ Table added!')">Save</button></div>
    `,

    regenerateQR: (tableNum, token) => `
        <div class="modal-header"><h3>Regenerate QR Code &middot; Table ${tableNum}</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="qr-preview" id="qrPreview"><i class="fas fa-qrcode"></i><p style="margin-top:8px;font-size:13px;color:#64748b;">Current Token for Table ${tableNum}</p><span class="token" id="oldToken">${token}</span></div>
        <div class="alert-warning"><i class="fas fa-exclamation-triangle"></i><span>Invalidates old QR token immediately.</span></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-danger" onclick="executeRegenerateQR(${tableNum})"><i class="fas fa-qrcode"></i> Regenerate Token</button></div>
    `,

    assignRole: () => `
        <div class="modal-header"><h3>Assign Staff Role</h3><button class="close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Staff Member</label><select id="staffUserSelect"><option value="priya@softnix.com">Priya Sharma</option><option value="vikram@softnix.com">Vikram Singh</option><option value="rajesh@softnix.com">Rajesh Kumar</option></select></div>
        <div class="form-group"><label>Role</label><select id="staffRoleSelect"><option value="ADMIN">Admin</option><option value="SERVER">Server</option><option value="KITCHEN_STAFF">Kitchen Staff</option></select></div>
        <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="executeAssignRole()">Save Role</button></div>
    `,

    branchModal: () => {
        const branches = window.FlameDineStore.getBranches();
        const current = window.FlameDineStore.getCurrentBranch();

        const branchItemsHtml = branches.map(b => {
            const isCurrent = b.id === current.id;
            return `
                <div class="branch-option-item" onclick="executeSwitchBranch('${b.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid ${isCurrent ? '#10b981' : '#e2e8f0'};background:${isCurrent ? 'rgba(16,185,129,0.06)' : '#fff'};border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <i class="fas fa-building" style="color:${isCurrent ? '#10b981' : '#94a3b8'};font-size:18px;"></i>
                        <div>
                            <div style="font-weight:700;font-size:14px;color:${isCurrent ? '#065f46' : '#1e293b'};">${b.name}</div>
                            <div style="font-size:12px;color:#64748b;">📍 ${b.location || 'Main City'}</div>
                        </div>
                    </div>
                    ${isCurrent ? `<span class="badge badge-green"><i class="fas fa-check"></i> Active</span>` : `<span class="btn btn-sm btn-outline">Switch</span>`}
                </div>
            `;
        }).join('');

        return `
            <div class="modal-header">
                <h3>🏢 Switch or Add Branch</h3>
                <button class="close" onclick="closeModal()">&times;</button>
            </div>
            <div style="margin-bottom:16px;">
                <label style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:8px;">Available Branches</label>
                ${branchItemsHtml}
            </div>
            <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:16px;">
                <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:8px;"><i class="fas fa-plus-circle" style="color:#E53935;margin-right:6px;"></i>Add New Branch</label>
                <div class="form-group" style="margin-bottom:10px;">
                    <input type="text" id="newBranchNameInput" placeholder="Branch Name (e.g. The Grand Dine - Marina)" />
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <input type="text" id="newBranchLocInput" placeholder="Location / City (e.g. Marina Beach Road)" />
                </div>
                <button class="btn btn-primary" style="width:100%;justify-content:center;" onclick="executeAddBranch()">
                    <i class="fas fa-plus"></i> Add &amp; Switch Branch
                </button>
            </div>
        `;
    }
};

// ─── CREATABLE COMBO DROPDOWN (Station / Category) ────────────
// Lists existing values with a trailing "+ Add new" option that lets
// the user type a brand new station/category inline, without leaving the form.
function comboSourceList(kind) {
    return kind === 'station'
        ? window.FlameDineStore.getStations().map(s => s.name)
        : window.FlameDineStore.getCategories();
}

function renderComboField(comboId, kind, selectedValue) {
    const label = selectedValue || `Select ${kind}`;
    return `
        <div class="combo-select" id="${comboId}" data-kind="${kind}">
            <button type="button" class="combo-trigger" onclick="toggleCombo('${comboId}')">
                <span class="combo-value" id="${comboId}_valueLabel">${label}</span>
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="combo-panel hidden" id="${comboId}_panel">
                <div class="combo-options" id="${comboId}_options"></div>
                <div class="combo-add-row" id="${comboId}_addRow">
                    <button type="button" class="combo-add-btn" onclick="startComboAdd('${comboId}')"><i class="fas fa-plus"></i> Add new ${kind}</button>
                </div>
            </div>
            <input type="hidden" id="${comboId}_hidden" value="${selectedValue || ''}" />
        </div>
    `;
}

function wireCombos() {
    document.querySelectorAll('.combo-select').forEach(el => {
        renderComboOptions(el.id);
    });
}

function renderComboOptions(comboId) {
    const el = document.getElementById(comboId);
    const optionsEl = document.getElementById(comboId + '_options');
    const hidden = document.getElementById(comboId + '_hidden');
    if (!el || !optionsEl) return;
    const kind = el.dataset.kind;
    const list = comboSourceList(kind);
    const selected = hidden ? hidden.value : '';

    optionsEl.innerHTML = list.map(opt => `
        <div class="combo-option ${opt === selected ? 'selected' : ''}" onclick="selectComboOption('${comboId}', '${opt.replace(/'/g, "\\'")}')">
            <span>${opt}</span>${opt === selected ? '<i class="fas fa-check"></i>' : ''}
        </div>
    `).join('') || `<div class="combo-empty">No ${kind}s yet — add one below.</div>`;
}

function toggleCombo(comboId) {
    document.querySelectorAll('.combo-panel').forEach(p => {
        if (p.id !== comboId + '_panel') p.classList.add('hidden');
    });
    const panel = document.getElementById(comboId + '_panel');
    if (panel) panel.classList.toggle('hidden');
}

function selectComboOption(comboId, value) {
    const hidden = document.getElementById(comboId + '_hidden');
    const label = document.getElementById(comboId + '_valueLabel');
    if (hidden) hidden.value = value;
    if (label) label.textContent = value;
    renderComboOptions(comboId);
    const panel = document.getElementById(comboId + '_panel');
    if (panel) panel.classList.add('hidden');
}

function startComboAdd(comboId) {
    const el = document.getElementById(comboId);
    const addRow = document.getElementById(comboId + '_addRow');
    if (!el || !addRow) return;
    const kind = el.dataset.kind;
    addRow.innerHTML = `
        <input type="text" class="combo-add-input" id="${comboId}_newInput" placeholder="New ${kind} name" />
        <button type="button" class="combo-add-confirm" onclick="confirmComboAdd('${comboId}')"><i class="fas fa-check"></i></button>
        <button type="button" class="combo-add-cancel" onclick="cancelComboAdd('${comboId}')"><i class="fas fa-times"></i></button>
    `;
    const input = document.getElementById(comboId + '_newInput');
    if (input) {
        input.focus();
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); confirmComboAdd(comboId); }
            if (e.key === 'Escape') { e.preventDefault(); cancelComboAdd(comboId); }
        });
    }
}

function cancelComboAdd(comboId) {
    const el = document.getElementById(comboId);
    const addRow = document.getElementById(comboId + '_addRow');
    if (!el || !addRow) return;
    const kind = el.dataset.kind;
    addRow.innerHTML = `<button type="button" class="combo-add-btn" onclick="startComboAdd('${comboId}')"><i class="fas fa-plus"></i> Add new ${kind}</button>`;
}

function confirmComboAdd(comboId) {
    const el = document.getElementById(comboId);
    const input = document.getElementById(comboId + '_newInput');
    if (!el || !input) return;
    const kind = el.dataset.kind;
    const value = input.value.trim();
    if (!value) return;

    if (kind === 'station') {
        window.FlameDineStore.saveStation(value);
    } else {
        window.FlameDineStore.addCategory(value);
    }

    cancelComboAdd(comboId);
    selectComboOption(comboId, value);
}

document.addEventListener('click', (e) => {
    document.querySelectorAll('.combo-select').forEach(el => {
        if (!el.contains(e.target)) {
            const panel = document.getElementById(el.id + '_panel');
            if (panel) panel.classList.add('hidden');
        }
    });
});

window.toggleCombo = toggleCombo;
window.selectComboOption = selectComboOption;
window.startComboAdd = startComboAdd;
window.cancelComboAdd = cancelComboAdd;
window.confirmComboAdd = confirmComboAdd;

// ─── BILLING FLOOR & HISTORY ──────────────────────────────────
function renderBillingFloor() {
    const grid = document.getElementById('billingFloorGrid');
    if (!grid) return;

    const tables = window.FlameDineStore.getTables();
    const allItems = window.FlameDineStore.load().orderItems || [];

    grid.innerHTML = tables.map(t => {
        const session = window.FlameDineStore.getOpenSessionForTable(t.number);
        const sessionItems = session ? window.FlameDineStore.getOrderItemsForSession(session.id) : [];
        const hasSession = !!session;

        const readyCount = sessionItems.filter(i => i.status === 'ready').length;
        const servedCount = sessionItems.filter(i => i.status === 'served').length;
        const total = sessionItems.reduce((s, i) => s + i.price * i.qty, 0);

        let statusClass = 'empty';
        let statusLabel = 'Available';

        if (hasSession) {
            if (readyCount > 0) {
                statusClass = 'ready';
                statusLabel = `${readyCount} ready`;
            } else if (servedCount === sessionItems.length && sessionItems.length > 0) {
                statusClass = 'served';
                statusLabel = 'All served';
            } else {
                statusClass = 'delayed';
                statusLabel = 'Preparing';
            }
        }

        const popover = hasSession ? `
            <div class="table-popover">
                <div class="popover-header">Table ${t.number} <span class="badge ${statusBadgeClass(statusClass)}">${statusLabel}</span></div>
                <div class="popover-row"><span>Session</span><span>${session.id.substring(0, 10)}</span></div>
                <div class="popover-row"><span>Items</span><span>${sessionItems.length}</span></div>
                <div class="popover-row total"><span>Total</span><span>₹${total}</span></div>
            </div>
        ` : `
            <div class="table-popover">
                <div class="popover-header">Table ${t.number}</div>
                <div class="popover-empty">No active session</div>
            </div>
        `;

        return `
            <div class="dining-table-wrap">
                <div class="dining-table status-${statusClass}" onclick="openBillingHistory(${t.number})">
                    <span class="chair chair-top"></span>
                    <span class="chair chair-bottom"></span>
                    <span class="chair chair-left"></span>
                    <span class="chair chair-right"></span>
                    <div class="table-number">${t.number}</div>
                    ${hasSession ? `<div class="table-summary"><span>${sessionItems.length} item${sessionItems.length === 1 ? '' : 's'}</span><span>₹${total}</span></div>` : ''}
                    ${hasSession ? '<div class="table-status-dot"></div>' : ''}
                </div>
                ${popover}
            </div>
        `;
    }).join('');
}

let currentBillingView = 'table';

function setBillingView(view) {
    currentBillingView = view;
    document.querySelectorAll('.billing-view-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.billingView === view);
    });
    const tableViewEl = document.getElementById('billingTableView');
    const dishViewEl = document.getElementById('billingDishView');
    if (tableViewEl) tableViewEl.classList.toggle('hidden', view !== 'table');
    if (dishViewEl) dishViewEl.classList.toggle('hidden', view !== 'dish');
    if (view === 'table') renderBillingFloor();
    else renderBillingDishKanban();
}
window.setBillingView = setBillingView;

function dishKanbanCardHtml(item) {
    return `
        <div class="dish-kanban-card">
            <div class="dk-name">${item.name} <span style="color:#E53935;">×${item.qty}</span></div>
            <div class="dk-meta">
                <span>T${item.tableNumber}</span>
                <span>${item.station || ''}</span>
                <span>Rnd ${item.round_no || 1}</span>
            </div>
        </div>
    `;
}

function renderBillingDishKanban() {
    const board = document.getElementById('billingDishKanbanBoard');
    if (!board) return;
    const allItems = (window.FlameDineStore.load().orderItems || []).filter(i => i.status !== 'cancelled');

    const preparingItems = allItems.filter(i => ['placed', 'claimed', 'preparing'].includes(i.status));
    const readyItems = allItems.filter(i => i.status === 'ready');
    const pickedUpItems = allItems.filter(i => i.status === 'picked_up');
    const servedItems = allItems.filter(i => i.status === 'served');

    const total = preparingItems.length + readyItems.length + pickedUpItems.length + servedItems.length;
    const emptyEl = document.getElementById('billingDishKanbanEmpty');
    if (emptyEl) emptyEl.classList.toggle('hidden', total > 0);
    if (total === 0) { board.innerHTML = ''; return; }

    const columns = [
        { title: 'Preparing', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', items: preparingItems },
        { title: 'Ready', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', items: readyItems },
        { title: 'Picked Up', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', items: pickedUpItems },
        { title: 'Served', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', items: servedItems },
    ];

    board.innerHTML = columns.map(col => `
        <div class="dish-kanban-column">
            <div class="dish-kanban-column-header">
                <span>${col.title}</span>
                <span class="dish-kanban-count" style="color:${col.color}; background:${col.bg};">${col.items.length}</span>
            </div>
            ${col.items.length === 0 ? `<div class="dish-kanban-empty-col">Nothing here</div>` : col.items.map(dishKanbanCardHtml).join('')}
        </div>
    `).join('');
}
window.renderBillingDishKanban = renderBillingDishKanban;

function statusBadgeClass(status) {
    if (status === 'ready') return 'badge-yellow';
    if (status === 'served') return 'badge-green';
    if (status === 'delayed') return 'badge-red';
    return 'badge-gray';
}

function itemStatusBadgeClass(status) {
    if (status === 'placed') return 'badge-gray';
    if (status === 'claimed' || status === 'preparing') return 'badge-blue';
    if (status === 'ready' || status === 'picked_up') return 'badge-yellow';
    if (status === 'served') return 'badge-green';
    return 'badge-gray';
}

function renderBillingHistory(tableNumber) {
    tableNumber = parseInt(tableNumber);
    const session = window.FlameDineStore.getOpenSessionForTable(tableNumber);
    const bills = window.FlameDineStore.getBills().filter(b => b.tableNumber === tableNumber);
    const title = document.getElementById('billingHistoryTitle');
    if (title) title.textContent = 'Table ' + tableNumber;

    let html = '';
    if (session) {
        const items = window.FlameDineStore.getOrderItemsForSession(session.id).filter(i => i.status !== 'cancelled');
        const total = items.reduce((s, i) => s + (i.price * i.qty), 0);

        const itemRows = items.map(i => `
            <tr>
                <td data-label="Item">
                    <strong>${i.name}</strong>
                    ${i.note ? `<div style="font-size:11px;color:#94a3b8;">${i.note}</div>` : ''}
                </td>
                <td data-label="Qty" style="text-align:center;">${i.qty}</td>
                <td data-label="Price" style="text-align:right;">₹${i.price}</td>
                <td data-label="Amount" style="text-align:right;"><strong>₹${i.price * i.qty}</strong></td>
                <td data-label="Status" style="text-align:center;"><span class="badge ${itemStatusBadgeClass(i.status)}">${i.status.replace('_', ' ')}</span></td>
            </tr>
        `).join('');

        html += `
            <div class="card" style="margin-bottom:20px;">
                <div class="card-title"><span><i class="fas fa-receipt" style="color:#E53935;margin-right:6px;"></i> Current Open Session</span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;color:#64748b;font-size:13px;">
                    <span>Session ID</span><strong>${session.id.substring(0, 14)}</strong>
                </div>
                ${items.length ? `
                <div class="table-wrap" style="margin-bottom:10px;">
                    <table>
                        <thead><tr><th>Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Amount</th><th style="text-align:center;">Status</th></tr></thead>
                        <tbody>${itemRows}</tbody>
                    </table>
                </div>
                ` : `<div class="alert-info" style="margin-bottom:10px;"><i class="fas fa-info-circle"></i><span>No items ordered yet.</span></div>`}
                <div style="background:#f8fafc;padding:16px;border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;font-weight:700;"><span>Total Amount</span><span>₹${total}</span></div>
                </div>
                <button class="btn btn-success" style="margin-top:14px;width:100%;justify-content:center;" onclick="openModal('settleBillModal', ${tableNumber})">
                    <i class="fas fa-check-circle"></i> Settle Bill &amp; Close Session
                </button>
            </div>
        `;
    } else {
        html += `<div class="alert-info" style="margin-bottom:20px;"><i class="fas fa-info-circle"></i><span>No active session right now for Table ${tableNumber}.</span></div>`;
    }

    html += `<div class="card-title" style="margin:0 0 12px;"><span><i class="fas fa-clock-rotate-left" style="color:#64748b;margin-right:6px;"></i> Past Settled Bills</span></div>`;
    if (bills.length === 0) {
        html += `<div class="card" style="text-align:center;color:#94a3b8;padding:32px;">No billing history yet for this table.</div>`;
    } else {
        html += `<div class="table-wrap"><table><thead><tr><th>Bill Code</th><th>Date</th><th>Method</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>`;
        bills.forEach(b => {
            const isVoid = b.status === 'VOIDED';
            html += `
                <tr style="${isVoid ? 'opacity:0.5;text-decoration:line-through;' : ''}">
                    <td data-label="Bill Code"><strong>${b.billCode}</strong></td>
                    <td data-label="Date">${new Date(b.settledAt).toLocaleDateString()}</td>
                    <td data-label="Method"><span class="badge badge-blue">${b.paymentMethod}</span></td>
                    <td data-label="Total"><strong>₹${b.finalTotal}</strong></td>
                    <td data-label="Status"><span class="badge ${isVoid ? 'badge-red' : 'badge-green'}">${b.status}</span></td>
                    <td data-label="Action">
                        ${!isVoid && b.paymentMethod !== 'UNPAID' ? `<button class="btn btn-xs btn-outline" onclick="openModal('correctPaymentModal', '${b.id}')">Correct Payment</button>` : '—'}
                    </td>
                </tr>
            `;
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
window.backToBilling = function() { navigateTo('billing'); };

// SETTLEMENT HELPER CALCULATOR
window.updateSettlementCalc = function (subtotal) {
    const discVal = parseFloat(document.getElementById('discountInput')?.value || 0) || 0;
    const discount = Math.min(subtotal, Math.max(0, discVal));
    const taxable = subtotal - discount;
    const sst = Math.round(taxable * 0.06 * 100) / 100;
    const svc = Math.round(taxable * 0.05 * 100) / 100;
    const total = Math.round((taxable + sst + svc) * 100) / 100;

    document.getElementById('calcDiscountText').textContent = `-₹${discount}`;
    document.getElementById('calcSstText').textContent = `₹${sst}`;
    document.getElementById('calcSvcText').textContent = `₹${svc}`;
    document.getElementById('calcFinalTotalText').textContent = `₹${total}`;
};

window.executeSettlement = function (tableNum) {
    const discountAmount = parseFloat(document.getElementById('discountInput')?.value || 0) || 0;
    const paymentMethod = document.getElementById('paymentMethodSelect')?.value || 'Cash';

    const res = window.FlameDineStore.settleSession(tableNum, { paymentMethod, discountAmount, staffName: 'Rajesh Kumar (Admin)' });
    if (res.success) {
        closeModal();
        alert(`✅ Bill ${res.bill.billCode} settled successfully via ${res.bill.paymentMethod}!\nFinal Amount: ₹${res.bill.finalTotal}`);
        renderBillingFloor();
        if (pages['billing-history']?.classList.contains('active')) renderBillingHistory(tableNum);
    } else {
        alert(`⚠️ ${res.message}`);
    }
};

window.executePaymentCorrection = function (billId) {
    const newMethod = document.getElementById('newPaymentSelect')?.value;
    const reason = document.getElementById('correctionReasonInput')?.value;
    if (!reason) { alert('Please provide a reason for payment correction.'); return; }

    const res = window.FlameDineStore.correctPaymentMethod(billId, newMethod, reason);
    if (res.success) {
        closeModal();
        alert(`✅ Original bill voided and replaced with new bill ${res.replacementBill.billCode} (${newMethod}).`);
        navigateTo('billing');
    } else {
        alert(`⚠️ ${res.message}`);
    }
};

// ─── ADMIN MENU & STATIONS ────────────────────────────────────
let menuViewMode = 'category'; // 'all' | 'category' | 'station'
let menuLayoutMode = 'list'; // 'list' | 'grid' (defaults to List View for mobile optimization & fast admin control)
let currentMenuCategory = null;
let currentMenuStation = null;

const CATEGORY_ICON_RULES = [
    { keywords: ['starter', 'appetizer', 'snack'], icon: 'fa-bowl-food' },
    { keywords: ['main', 'course', 'entree'], icon: 'fa-drumstick-bite' },
    { keywords: ['beverage', 'drink', 'juice', 'shake'], icon: 'fa-mug-saucer' },
    { keywords: ['dessert', 'sweet', 'ice cream'], icon: 'fa-ice-cream' },
    { keywords: ['soup'], icon: 'fa-bowl-rice' },
    { keywords: ['salad'], icon: 'fa-leaf' },
    { keywords: ['bread', 'bakery'], icon: 'fa-bread-slice' },
    { keywords: ['seafood', 'fish'], icon: 'fa-fish' },
    { keywords: ['pizza'], icon: 'fa-pizza-slice' },
    { keywords: ['pasta', 'noodle'], icon: 'fa-bowl-food' },
    { keywords: ['grill', 'bbq', 'barbecue', 'tandoor'], icon: 'fa-fire' },
];
function categoryIcon(cat) {
    const lower = cat.toLowerCase();
    const match = CATEGORY_ICON_RULES.find(r => r.keywords.some(k => lower.includes(k)));
    return match ? match.icon : 'fa-utensils';
}

function renderAdminMenu() {
    const container = document.getElementById('page-menu');
    if (!container) return;

    if (currentMenuCategory) {
        renderMenuGroupDetail(container, { type: 'category', value: currentMenuCategory });
    } else if (currentMenuStation) {
        renderMenuGroupDetail(container, { type: 'station', value: currentMenuStation });
    } else {
        renderMenuTopGrid(container);
    }
}

function renderMenuTopGrid(container) {
    const subtitle = menuViewMode === 'category' ? 'Select a category to view and manage its items'
        : menuViewMode === 'station' ? 'Select a station to view and manage its items'
        : 'Every item across all categories and stations';

    let headerAction = '';
    if (menuViewMode === 'category') headerAction = `<button class="btn btn-primary" onclick="openModal('addCategory')"><i class="fas fa-plus"></i> Add Category</button>`;
    else if (menuViewMode === 'station') headerAction = `<button class="btn btn-primary" onclick="openModal('addStation')"><i class="fas fa-plus"></i> Add Station</button>`;
    else headerAction = `<button class="btn btn-primary" onclick="openModal('addItem')"><i class="fas fa-plus"></i> Add Item</button>`;

    let html = `
        <div class="page-header">
            <div><h1>Menu Management</h1><div class="sub">${subtitle}</div></div>
            <div class="actions">${headerAction}</div>
        </div>
        <div class="view-toggle-wrap">
            <div class="view-toggle" style="margin-bottom:0;">
                <button class="view-toggle-btn ${menuViewMode === 'all' ? 'active' : ''}" onclick="switchMenuView('all')"><i class="fas fa-border-all"></i> All Items</button>
                <button class="view-toggle-btn ${menuViewMode === 'category' ? 'active' : ''}" onclick="switchMenuView('category')"><i class="fas fa-layer-group"></i> By Category</button>
                <button class="view-toggle-btn ${menuViewMode === 'station' ? 'active' : ''}" onclick="switchMenuView('station')"><i class="fas fa-fire-burner"></i> By Station</button>
            </div>
        </div>
    `;

    if (menuViewMode === 'category') html += renderCategoryCardsHtml();
    else if (menuViewMode === 'station') html += renderStationCardsHtml();
    else html += renderMenuItemsHtml(window.FlameDineStore.getMenuItems(true), 'all');

    container.innerHTML = html;
}

function renderCategoryCardsHtml() {
    const items = window.FlameDineStore.getMenuItems(true);
    const categories = window.FlameDineStore.getCategories();

    let html = `<div class="grid-cards">`;
    categories.forEach(cat => {
        const catItems = items.filter(i => i.category === cat);
        const activeCount = catItems.filter(i => i.available && !i.isDeleted).length;
        html += `
            <div class="card-item menu-category-card" onclick="openMenuCategory('${cat.replace(/'/g, "\\'")}')">
                <div class="card-header">
                    <h4><i class="fas ${categoryIcon(cat)}" style="font-size:19px;color:#E53935;width:22px;"></i> ${cat}</h4>
                    <i class="fas fa-chevron-right" style="color:#cbd5e1;"></i>
                </div>
                <div class="card-body">${catItems.length} item${catItems.length === 1 ? '' : 's'} &middot; ${activeCount} active</div>
            </div>
        `;
    });
    html += `
            <div class="card-empty" onclick="openModal('addCategory')"><i class="fas fa-plus-circle"></i><span>Add New Category</span></div>
        </div>
    `;
    return html;
}

function renderStationCardsHtml() {
    const items = window.FlameDineStore.getMenuItems();
    const stations = window.FlameDineStore.getStations();

    let html = `<div class="grid-cards">`;
    stations.forEach(st => {
        const stItems = items.filter(i => i.station === st.name);
        const activeCount = stItems.filter(i => i.available).length;
        html += `
            <div class="card-item menu-category-card" onclick="openMenuStation('${st.name.replace(/'/g, "\\'")}')">
                <div class="card-header">
                    <h4><i class="fas ${st.icon}" style="font-size:19px;color:#E53935;width:22px;"></i> ${st.name}</h4>
                    <i class="fas fa-chevron-right" style="color:#cbd5e1;"></i>
                </div>
                <div class="card-body">${stItems.length} item${stItems.length === 1 ? '' : 's'} &middot; ${activeCount} active</div>
            </div>
        `;
    });
    html += `
            <div class="card-empty" onclick="openModal('addStation')"><i class="fas fa-plus-circle"></i><span>Add New Station</span></div>
        </div>
    `;
    return html;
}

// Chooses between List View and Grid View based on menuLayoutMode
function renderMenuItemsHtml(items, badgeMode) {
    if (menuLayoutMode === 'list') {
        return renderMenuItemListHtml(items, badgeMode);
    }
    return renderMenuItemGridHtml(items, badgeMode);
}

const DISH_PHOTO_MAP = {
    'spring rolls': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300&q=80',
    'garlic bread': 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=300&q=80',
    'butter chicken': 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=300&q=80',
    'paneer tikka': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=300&q=80',
    'fresh lime soda': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=300&q=80',
    'mango lassi': 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=300&q=80',
    'gulab jamun': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&q=80',
    'brownie sundae': 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=300&q=80',
    'chicken wings': 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=300&q=80',
    'french fries': 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=300&q=80',
    'chicken biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&q=80',
    'dal makhani': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&q=80'
};

function getItemThumbnailSrc(item) {
    if (item.image && (item.image.startsWith('data:') || item.image.startsWith('http://') || item.image.startsWith('https://'))) {
        return item.image;
    }
    const nameLower = (item.name || '').toLowerCase();
    for (const key in DISH_PHOTO_MAP) {
        if (nameLower.includes(key)) return DISH_PHOTO_MAP[key];
    }
    return item.image ? ('../' + item.image) : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&q=80';
}

function getItemThumbnailHtml(item) {
    const src = getItemThumbnailSrc(item);
    return `
        <div class="item-list-thumb">
            <img src="${src}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&q=80';" />
        </div>
    `;
}

// Renders a List View for items (Mobile & Admin density friendly)
function renderMenuItemListHtml(items, badgeMode) {
    let html = `<div class="menu-item-list">`;
    if (items.length === 0) {
        html += `<div style="text-align:center;color:#94a3b8;padding:32px;">No items here yet.</div>`;
    }
    items.forEach(i => {
        const isDeleted = !!i.isDeleted;
        const badges = isDeleted
            ? `<span class="badge badge-red"><i class="fas fa-ban" style="margin-right:4px;"></i> Blocked</span>`
            : badgeMode === 'all'
                ? `<span class="badge badge-gray">${i.category}</span><span class="badge badge-blue">${i.station}</span>`
                : badgeMode === 'category'
                    ? `<span class="badge badge-blue">${i.station}</span>`
                    : `<span class="badge badge-gray">${i.category}</span>`;
        html += `
            <div class="menu-item-list-row ${isDeleted ? 'is-deleted opacity-60' : !i.available ? 'is-disabled' : ''}">
                <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;cursor:${isDeleted ? 'default' : 'pointer'};" onclick="${isDeleted ? '' : `openModal('editItem', ${i.id})`}" title="${isDeleted ? 'Item is blocked/deleted.' : 'Click to edit dish info & re-assign station'}">
                    ${getItemThumbnailHtml(i)}
                    <div class="item-list-details">
                        <span class="item-list-name ${isDeleted ? 'line-through text-slate-400' : ''}">${i.name}</span>
                        <span class="item-list-badges">${badges}</span>
                    </div>
                </div>
                <span class="item-list-price" onclick="${isDeleted ? '' : `openModal('editItem', ${i.id})`}" style="cursor:${isDeleted ? 'default' : 'pointer'};">₹${i.price}</span>
                <div class="item-list-actions">
                    ${isDeleted ? `
                        <button class="btn btn-sm btn-outline" onclick="executeRecoverItem(${i.id})" title="Recover dish and make active again" style="border:1px solid #10b981;color:#10b981;background:rgba(16,185,129,0.08);font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                            <i class="fas fa-undo"></i> Recover
                        </button>
                    ` : `
                        <div class="toggle-switch ${i.available ? 'active' : ''}" onclick="window.FlameDineStore.toggleItemAvailability(${i.id});renderAdminMenu();" title="Toggle active status">
                            <span class="track"><span class="thumb"></span></span>
                            <span class="label hidden-mobile">${i.available ? 'Active' : 'Inactive'}</span>
                        </div>
                        <button class="btn btn-sm btn-danger" onclick="executeDeleteItem(${i.id})" title="Block / Soft delete item"><i class="fas fa-trash"></i></button>
                    `}
                </div>
            </div>
        `;
    });
    html += `</div>`;
    return html;
}

// Renders a Grid View of item cards
function renderMenuItemGridHtml(items, badgeMode) {
    let html = `<div class="menu-item-grid">`;
    if (items.length === 0) {
        html += `<div style="text-align:center;color:#94a3b8;padding:32px;">No items here yet.</div>`;
    }
    items.forEach(i => {
        const isDeleted = !!i.isDeleted;
        const imgUrl = getDishFallbackImage(i.name);
        const badges = isDeleted
            ? `<span class="badge badge-red"><i class="fas fa-ban" style="margin-right:4px;"></i> Blocked</span>`
            : badgeMode === 'all'
                ? `<span class="badge badge-gray">${i.category}</span><span class="badge badge-blue">${i.station}</span>`
                : badgeMode === 'category'
                    ? `<span class="badge badge-blue">${i.station}</span>`
                    : `<span class="badge badge-gray">${i.category}</span>`;
        html += `
            <div class="menu-item-card ${isDeleted ? 'opacity-60' : ''}">
                <div class="menu-item-card-img" onclick="${isDeleted ? '' : `openModal('editItem', ${i.id})`}" style="cursor:${isDeleted ? 'default' : 'pointer'};" title="${isDeleted ? 'Item is blocked/deleted.' : 'Click to edit dish info'}">
                    <img src="${imgUrl}" alt="${i.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <span class="item-thumb-fallback">${i.emoji}</span>
                    <span class="menu-item-card-status ${isDeleted ? 'bg-red-500 text-white' : i.available ? 'is-active' : 'is-inactive'}">${isDeleted ? 'Blocked' : i.available ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="menu-item-card-info" onclick="${isDeleted ? '' : `openModal('editItem', ${i.id})`}" style="cursor:${isDeleted ? 'default' : 'pointer'};">
                    <div class="menu-item-card-name ${isDeleted ? 'line-through text-slate-400' : ''}">${i.name}</div>
                    <div class="menu-item-card-meta"><span class="menu-item-card-badges">${badges}</span><span class="price">₹${i.price}</span></div>
                </div>
                <div class="menu-item-card-actions">
                    ${isDeleted ? `
                        <button class="btn btn-sm btn-outline" onclick="executeRecoverItem(${i.id})" title="Recover dish and make active again" style="border:1px solid #10b981;color:#10b981;background:rgba(16,185,129,0.08);font-weight:600;width:100%;justify-content:center;display:inline-flex;align-items:center;gap:4px;">
                            <i class="fas fa-undo"></i> Recover Dish
                        </button>
                    ` : `
                        <div class="toggle-switch ${i.available ? 'active' : ''}" onclick="window.FlameDineStore.toggleItemAvailability(${i.id});renderAdminMenu();">
                            <span class="track"><span class="thumb"></span></span>
                        </div>
                        <button class="btn btn-sm btn-danger" onclick="executeDeleteItem(${i.id})" title="Block / Soft delete item"><i class="fas fa-trash"></i></button>
                    `}
                </div>
            </div>
        `;
    });
    html += `</div>`;
    return html;
}

function renderMenuGroupDetail(container, group) {
    const items = window.FlameDineStore.getMenuItems(true);
    const groupItems = group.type === 'category'
        ? items.filter(i => i.category === group.value)
        : items.filter(i => i.station === group.value);

    const backFn = group.type === 'category' ? 'backToMenuCategories' : 'backToMenuStations';
    const escapedValue = group.value.replace(/'/g, "\\'");
    const addItemArgs = group.type === 'category' ? `'addItem','${escapedValue}'` : `'addItem','','${escapedValue}'`;

    let html = `
        <div class="billing-history-header">
            <button class="back-btn" onclick="${backFn}()"><i class="fas fa-arrow-left"></i></button>
            <div><h1 style="font-size:24px;">${group.value}</h1><div class="sub">${groupItems.length} item${groupItems.length === 1 ? '' : 's'} ${group.type === 'category' ? 'in this category' : 'routed to this station'}</div></div>
            <div class="actions" style="margin-left:auto; display:flex; gap:10px; align-items:center;">
                <div class="layout-toggle">
                    <button class="layout-toggle-btn ${menuLayoutMode === 'list' ? 'active' : ''}" onclick="switchMenuLayout('list')" title="List View"><i class="fas fa-list"></i> List</button>
                    <button class="layout-toggle-btn ${menuLayoutMode === 'grid' ? 'active' : ''}" onclick="switchMenuLayout('grid')" title="Grid View"><i class="fas fa-th-large"></i> Grid</button>
                </div>
                <button class="btn btn-primary" onclick="openModal(${addItemArgs})"><i class="fas fa-plus"></i> Add Item</button>
            </div>
        </div>
    `;
    html += renderMenuItemsHtml(groupItems, group.type);
    container.innerHTML = html;
}

window.switchMenuView = function (mode) {
    menuViewMode = mode;
    renderAdminMenu();
};

window.switchMenuLayout = function (layout) {
    menuLayoutMode = layout;
    renderAdminMenu();
};

window.openMenuCategory = function (cat) {
    currentMenuCategory = cat;
    renderAdminMenu();
};

window.backToMenuCategories = function () {
    currentMenuCategory = null;
    renderAdminMenu();
};

window.openMenuStation = function (station) {
    currentMenuStation = station;
    renderAdminMenu();
};

window.backToMenuStations = function () {
    currentMenuStation = null;
    renderAdminMenu();
};

window.executeSaveCategory = function () {
    const name = document.getElementById('catNameInput')?.value?.trim();
    if (!name) { alert('Please enter a category name'); return; }
    window.FlameDineStore.addCategory(name);
    closeModal();
    renderAdminMenu();
};

window.executeSaveStation = function () {
    const name = document.getElementById('stationNameInput')?.value?.trim();
    if (!name) { alert('Please enter a station name'); return; }
    window.FlameDineStore.saveStation(name);
    closeModal();
    renderAdminMenu();
};

window.previewItemImage = function (event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = document.getElementById('itemImagePreview');
    const placeholder = document.getElementById('itemImagePlaceholder');
    const reader = new FileReader();
    reader.onload = (e) => {
        if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
};

window.executeSaveItem = function () {
    const name = document.getElementById('itemNameInput')?.value;
    const price = document.getElementById('itemPriceInput')?.value;
    const category = document.getElementById('categoryCombo_hidden')?.value;
    const station = document.getElementById('stationCombo_hidden')?.value;
    if (!name || !price) { alert('Please enter name and price'); return; }
    if (!category || !station) { alert('Please choose a category and a kitchen station'); return; }

    window.FlameDineStore.saveMenuItem({ name, price, category, station });
    closeModal();
    renderAdminMenu();
};

window.executeSaveEditItem = function (itemId) {
    const name = document.getElementById('itemNameInput')?.value?.trim();
    const priceInput = document.getElementById('itemPriceInput')?.value?.trim();
    const desc = document.getElementById('itemDescInput')?.value?.trim() || '';
    const category = document.getElementById('categoryCombo_hidden')?.value;
    const station = document.getElementById('stationCombo_hidden')?.value;

    if (!name || !priceInput) {
        alert('Please enter a valid item name and price');
        return;
    }

    const price = parseFloat(priceInput);
    const previewImg = document.getElementById('itemImagePreview');
    const imageData = (previewImg && previewImg.style.display !== 'none') ? previewImg.src : null;

    const updateData = {
        id: parseInt(itemId),
        name,
        price,
        desc
    };
    if (category) updateData.category = category;
    if (station) updateData.station = station;
    if (imageData && (imageData.startsWith('data:') || imageData.startsWith('http'))) {
        updateData.image = imageData;
    }

    window.FlameDineStore.saveMenuItem(updateData);
    closeModal();
    renderAdminMenu();
};

window.executeReassignStation = function (itemId) {
    const newStation = document.getElementById('stationCombo_hidden')?.value;
    if (!newStation) { alert('Please choose a station'); return; }
    window.FlameDineStore.reassignItemStation(itemId, newStation);
    closeModal();
    renderAdminMenu();
};

window.executeDeleteItem = function (itemId) {
    if (confirm('Block / Soft-delete this menu item? It will be hidden from customer ordering, but preserved for historical billing.')) {
        window.FlameDineStore.deleteMenuItem(itemId);
        renderAdminMenu();
    }
};

window.executeRecoverItem = function (itemId) {
    window.FlameDineStore.recoverMenuItem(itemId);
    renderAdminMenu();
};

function renderAdminTables() {
    const tables = window.FlameDineStore.getTables();
    const container = document.getElementById('page-tables');
    if (!container) return;

    let html = `
        <div class="page-header"><div><h1>Tables &amp; QR Tokens</h1><div class="sub">Manage table QR tokens</div></div><div class="actions"><button class="btn btn-primary" onclick="openModal('addTable')"><i class="fas fa-plus"></i> Add Table</button></div></div>
        <div class="grid-cards">
    `;

    tables.forEach(t => {
        html += `
            <div class="card-item">
                <div class="card-header"><h4><i class="fas fa-qrcode" style="color:#E53935;margin-right:8px;"></i>Table ${t.number}</h4><span class="badge badge-green">Active</span></div>
                <div class="card-body"><div style="font-size:11px;color:#94a3b8;font-family:monospace;word-break:break-all;">Token: ${t.token}</div></div>
                <div class="card-actions">
                    <button class="btn btn-sm btn-outline" onclick="openModal('regenerateQR', ${t.number}, '${t.token}')"><i class="fas fa-qrcode"></i> Regenerate QR</button>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

window.executeRegenerateQR = function (tableNum) {
    const newToken = window.FlameDineStore.regenerateTableQR(tableNum);
    alert(`✅ Token regenerated for Table ${tableNum}:\n${newToken}`);
    closeModal();
    renderAdminTables();
};

function renderAdminStaff() {
    const staff = window.FlameDineStore.getStaffUsers();
    const container = document.getElementById('page-staff');
    if (!container) return;

    let html = `
        <div class="page-header"><div><h1>Staff Management</h1><div class="sub">Assign staff roles</div></div><div class="actions"><button class="btn btn-primary" onclick="openModal('assignRole')"><i class="fas fa-user-plus"></i> Assign Role</button></div></div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th></tr></thead>
                <tbody>
    `;

    staff.forEach(s => {
        html += `
            <tr>
                <td data-label="Name"><strong>${s.name}</strong></td>
                <td data-label="Email">${s.email}</td>
                <td data-label="Role"><span class="badge ${s.role === 'ADMIN' ? 'badge-purple' : s.role === 'SERVER' ? 'badge-green' : 'badge-blue'}">${s.role}</span></td>
                <td data-label="Branch">${s.branch}</td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

window.executeAssignRole = function () {
    const email = document.getElementById('staffUserSelect')?.value;
    const role = document.getElementById('staffRoleSelect')?.value;
    window.FlameDineStore.assignStaffRole(email, role);
    closeModal();
    renderAdminStaff();
};

// ─── BRANCH MANAGEMENT HANDLERS ─────────────────────────────
function updateBranchHeaderUI() {
    const current = window.FlameDineStore.getCurrentBranch();
    const selectorText = document.getElementById('branchSelectorText');
    if (selectorText) {
        selectorText.textContent = `🏢 ${current.name}`;
    }
    const subDisplay = document.getElementById('branchSubDisplay');
    if (subDisplay) {
        subDisplay.textContent = current.name;
    }
    const userRoleEl = document.getElementById('userDropdownRole');
    if (userRoleEl) {
        userRoleEl.textContent = `Admin · ${current.name}`;
    }
}

window.executeSwitchBranch = function (branchId) {
    const res = window.FlameDineStore.switchBranch(branchId);
    if (res.success) {
        updateBranchHeaderUI();
        closeModal();
    }
};

window.executeAddBranch = function () {
    const nameEl = document.getElementById('newBranchNameInput');
    const locEl = document.getElementById('newBranchLocInput');
    const name = nameEl ? nameEl.value.trim() : '';
    const loc = locEl ? locEl.value.trim() : '';
    if (!name) {
        alert('Please enter a branch name.');
        return;
    }
    const res = window.FlameDineStore.addBranch({ name, location: loc });
    if (res.success) {
        updateBranchHeaderUI();
        closeModal();
    }
};

// ─── INIT & STORE SUBSCRIPTION ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initUserMenu();
    window.FlameDineTheme.wireToggleButton('themeToggleBtn', 'themeToggleIcon');
    updateBranchHeaderUI();

    window.FlameDineStore.subscribe(event => {
        if (event.type === 'BRANCH_SWITCHED' || event.type === 'BRANCH_ADDED') {
            updateBranchHeaderUI();
        }
        if (currentBillingView === 'dish') renderBillingDishKanban();
        else renderBillingFloor();
    });
    renderBillingFloor();
});

console.log('✅ Admin Panel successfully connected to FlameDineStore.');
