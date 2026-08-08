/**
 * Unified Shared Data Store & Event Bus for Flame Dine (QR Dine-In & KDS)
 * Uses BroadcastChannel & localStorage sync for real-time inter-tab communication.
 */

(function (window) {
    const STORAGE_KEY = 'flame_dine_store_v1';
    const CHANNEL_NAME = 'flame_dine_channel';
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

    // Default Seed Data
    const defaultData = {
        branch: {
            id: 'br_01',
            name: 'The Grand Dine',
            taxComponents: [
                { name: 'SST', rate: 0.06 },
                { name: 'Service Tax', rate: 0.05 }
            ]
        },
        stations: [
            { id: 'st_grill', name: 'Grill', icon: 'fa-fire' },
            { id: 'st_beverage', name: 'Beverage', icon: 'fa-mug-saucer' },
            { id: 'st_dessert', name: 'Desserts', icon: 'fa-cake' },
            { id: 'st_main', name: 'Main Kitchen', icon: 'fa-utensils' }
        ],
        categories: ['Starters', 'Main Course', 'Beverages', 'Desserts'],
        menuItems: [
            { id: 1, name: 'Spring Rolls', desc: 'Crispy veg rolls', price: 149, category: 'Starters', station: 'Grill', emoji: '🌯', available: true },
            { id: 2, name: 'Garlic Bread', desc: 'Toasted herb butter', price: 99, category: 'Starters', station: 'Beverage', emoji: '🍞', available: true },
            { id: 3, name: 'Butter Chicken', desc: 'Creamy tomato gravy', price: 349, category: 'Main Course', station: 'Main Kitchen', emoji: '🍗', available: true },
            { id: 4, name: 'Paneer Tikka', desc: 'Grilled cottage cheese', price: 299, category: 'Main Course', station: 'Grill', emoji: '🧀', available: true },
            { id: 5, name: 'Fresh Lime Soda', desc: 'Tangy & refreshing', price: 89, category: 'Beverages', station: 'Beverage', emoji: '🍋', available: true },
            { id: 6, name: 'Mango Lassi', desc: 'Sweet yogurt smoothie', price: 119, category: 'Beverages', station: 'Beverage', emoji: '🥭', available: true },
            { id: 7, name: 'Gulab Jamun', desc: 'Soft milk dumplings', price: 79, category: 'Desserts', station: 'Desserts', emoji: '🍡', available: true },
            { id: 8, name: 'Brownie Sundae', desc: 'Warm with vanilla ice cream', price: 149, category: 'Desserts', station: 'Desserts', emoji: '🍫', available: true },
            { id: 9, name: 'Chicken Wings', desc: 'Spicy BBQ glazed wings', price: 249, category: 'Starters', station: 'Grill', emoji: '🍗', available: true },
            { id: 10, name: 'French Fries', desc: 'Crispy salted golden fries', price: 119, category: 'Starters', station: 'Grill', emoji: '🍟', available: true },
            { id: 11, name: 'Chicken Biryani', desc: 'Aromatic basmati rice with chicken', price: 329, category: 'Main Course', station: 'Main Kitchen', emoji: '🍲', available: true },
            { id: 12, name: 'Dal Makhani', desc: 'Slow cooked black lentils with butter', price: 219, category: 'Main Course', station: 'Main Kitchen', emoji: '🥣', available: true }
        ],
        tables: [
            { number: 1, status: 'active', token: 'tbl_token_01_a8b9' },
            { number: 2, status: 'active', token: 'tbl_token_02_c3d4' },
            { number: 3, status: 'active', token: 'tbl_token_03_e5f6' },
            { number: 4, status: 'active', token: 'tbl_token_04_g7h8' },
            { number: 5, status: 'active', token: 'tbl_token_05_i9j0' },
            { number: 6, status: 'active', token: 'tbl_token_06_k1l2' },
            { number: 7, status: 'active', token: 'tbl_token_07_m3n4' },
            { number: 8, status: 'active', token: 'tbl_token_08_o5p6' },
            { number: 9, status: 'active', token: 'tbl_token_09_q7r8' },
            { number: 10, status: 'active', token: 'tbl_token_10_s9t0' },
            { number: 11, status: 'active', token: 'tbl_token_11_u1v2' },
            { number: 12, status: 'active', token: 'tbl_token_12_w3x4' }
        ],
        sessions: [
            // Pre-populated active session for Table 5 & Table 12
            {
                id: 'sess_t5_1001',
                tableNumber: 5,
                status: 'OPEN',
                createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
                currentRound: 1
            },
            {
                id: 'sess_t12_1002',
                tableNumber: 12,
                status: 'OPEN',
                createdAt: new Date(Date.now() - 40 * 60000).toISOString(),
                currentRound: 1
            }
        ],
        orders: [
            { id: 'ord_1001', sessionId: 'sess_t5_1001', tableNumber: 5, orderCode: 'FL-1042', createdAt: new Date(Date.now() - 25 * 60000).toISOString() },
            { id: 'ord_1002', sessionId: 'sess_t12_1002', tableNumber: 12, orderCode: 'FL-1038', createdAt: new Date(Date.now() - 40 * 60000).toISOString() }
        ],
        orderItems: [
            {
                id: 'item_101',
                orderId: 'ord_1001',
                sessionId: 'sess_t5_1001',
                tableNumber: 5,
                menuItemId: 1,
                name: 'Spring Rolls',
                qty: 2,
                price: 149,
                station: 'Grill',
                status: 'preparing', // placed -> claimed -> preparing -> ready -> picked_up -> served
                round_no: 1,
                claimedBy: 'Vikram Singh',
                note: 'Extra crispy',
                createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
                updatedAt: new Date(Date.now() - 15 * 60000).toISOString()
            },
            {
                id: 'item_102',
                orderId: 'ord_1001',
                sessionId: 'sess_t5_1001',
                tableNumber: 5,
                menuItemId: 5,
                name: 'Fresh Lime Soda',
                qty: 2,
                price: 89,
                station: 'Beverage',
                status: 'ready',
                round_no: 1,
                claimedBy: 'Ananya Reddy',
                note: 'Less sugar',
                createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
                updatedAt: new Date(Date.now() - 5 * 60000).toISOString()
            },
            {
                id: 'item_103',
                orderId: 'ord_1001',
                sessionId: 'sess_t5_1001',
                tableNumber: 5,
                menuItemId: 3,
                name: 'Butter Chicken',
                qty: 1,
                price: 349,
                station: 'Main Kitchen',
                status: 'placed',
                round_no: 1,
                claimedBy: null,
                note: 'Medium spice',
                createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
                updatedAt: new Date(Date.now() - 10 * 60000).toISOString()
            },
            {
                id: 'item_104',
                orderId: 'ord_1002',
                sessionId: 'sess_t12_1002',
                tableNumber: 12,
                menuItemId: 4,
                name: 'Paneer Tikka',
                qty: 1,
                price: 299,
                station: 'Grill',
                status: 'ready',
                round_no: 1,
                claimedBy: 'Vikram Singh',
                note: '',
                createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
                updatedAt: new Date(Date.now() - 12 * 60000).toISOString()
            },
            {
                id: 'item_105',
                orderId: 'ord_1002',
                sessionId: 'sess_t12_1002',
                tableNumber: 12,
                menuItemId: 6,
                name: 'Mango Lassi',
                qty: 2,
                price: 119,
                station: 'Beverage',
                status: 'served',
                round_no: 1,
                claimedBy: 'Ananya Reddy',
                note: '',
                createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
                updatedAt: new Date(Date.now() - 15 * 60000).toISOString()
            }
        ],
        bills: [
            {
                id: 'bill_0390',
                sessionId: 'sess_old_390',
                tableNumber: 5,
                billCode: '#B-0390',
                subtotal: 62.00,
                discount: 0,
                taxTotal: 6.82,
                finalTotal: 68.82,
                paymentMethod: 'Cash',
                status: 'SETTLED',
                settledAt: new Date(Date.now() - 24 * 3600000).toISOString()
            }
        ],
        waiterCalls: [],
        staffUsers: [
            { email: 'admin@softnix.com', role: 'ADMIN', name: 'Rajesh Kumar', branch: 'The Grand Dine' },
            { email: 'server@softnix.com', role: 'SERVER', name: 'Priya Sharma', branch: 'The Grand Dine' },
            { email: 'kitchen@softnix.com', role: 'KITCHEN_STAFF', name: 'Vikram Singh', branch: 'The Grand Dine' }
        ]
    };

    // Store Class
    class Store {
        constructor() {
            this.listeners = [];
            this.init();
        }

        init() {
            const existing = localStorage.getItem(STORAGE_KEY);
            if (!existing) {
                this.save(defaultData);
            }
            // Listen for cross-tab events
            if (channel) {
                channel.onmessage = (e) => {
                    this.notifyListeners(e.data);
                };
            }
            window.addEventListener('storage', (e) => {
                if (e.key === STORAGE_KEY) {
                    this.notifyListeners({ type: 'STORE_UPDATED' });
                }
            });
        }

        load() {
            try {
                const data = localStorage.getItem(STORAGE_KEY);
                return data ? JSON.parse(data) : defaultData;
            } catch (err) {
                console.error('Failed to load store:', err);
                return defaultData;
            }
        }

        save(data) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            } catch (err) {
                console.error('Failed to save store:', err);
            }
        }

        broadcast(event) {
            if (channel) {
                channel.postMessage(event);
            }
            this.notifyListeners(event);
        }

        subscribe(callback) {
            this.listeners.push(callback);
            return () => {
                this.listeners = this.listeners.filter(cb => cb !== callback);
            };
        }

        notifyListeners(event) {
            this.listeners.forEach(cb => {
                try { cb(event); } catch (e) { console.error('Store listener error:', e); }
            });
        }

        // --- READ APIS ---

        getBranch() { return this.load().branch; }
        getStations() { return this.load().stations; }
        getCategories() { return this.load().categories; }
        getMenuItems() { return this.load().menuItems; }
        getTables() { return this.load().tables; }
        getStaffUsers() { return this.load().staffUsers; }

        getOpenSessionForTable(tableNumber) {
            const data = this.load();
            return data.sessions.find(s => s.tableNumber === parseInt(tableNumber) && s.status === 'OPEN');
        }

        getAllSessions() {
            return this.load().sessions;
        }

        getOrderForSession(sessionId) {
            const data = this.load();
            return data.orders.find(o => o.sessionId === sessionId);
        }

        getOrderItemsForSession(sessionId) {
            const data = this.load();
            return data.orderItems.filter(i => i.sessionId === sessionId);
        }

        getKitchenQueue(stationFilter = 'All') {
            const data = this.load();
            // Show placed, claimed, preparing
            return data.orderItems.filter(item => {
                const matchesStatus = ['placed', 'claimed', 'preparing'].includes(item.status);
                const matchesStation = stationFilter === 'All' || item.station === stationFilter;
                return matchesStatus && matchesStation;
            }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }

        getServerQueue() {
            const data = this.load();
            // Show ready & picked_up items
            return data.orderItems.filter(item => ['ready', 'picked_up'].includes(item.status))
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        }

        getBills() {
            const data = this.load();
            return data.bills || [];
        }

        getWaiterCalls() {
            const data = this.load();
            return data.waiterCalls || [];
        }

        // --- WRITE ACTIONS ---

        // Customer placing order
        placeOrder({ tableNumber, cartItems }) {
            const data = this.load();
            tableNumber = parseInt(tableNumber);

            let session = data.sessions.find(s => s.tableNumber === tableNumber && s.status === 'OPEN');
            let isNewSession = false;

            if (!session) {
                isNewSession = true;
                session = {
                    id: 'sess_' + Date.now(),
                    tableNumber: tableNumber,
                    status: 'OPEN',
                    createdAt: new Date().toISOString(),
                    currentRound: 1
                };
                data.sessions.push(session);
            } else {
                session.currentRound = (session.currentRound || 1) + 1;
            }

            let order = data.orders.find(o => o.sessionId === session.id);
            if (!order) {
                order = {
                    id: 'ord_' + Date.now(),
                    sessionId: session.id,
                    tableNumber: tableNumber,
                    orderCode: 'FL-' + Math.floor(1000 + Math.random() * 9000),
                    createdAt: new Date().toISOString()
                };
                data.orders.push(order);
            }

            const newItems = cartItems.map((cartItem, idx) => {
                const menuItem = data.menuItems.find(m => m.id === cartItem.id) || cartItem;
                return {
                    id: 'item_' + Date.now() + '_' + idx,
                    orderId: order.id,
                    sessionId: session.id,
                    tableNumber: tableNumber,
                    menuItemId: menuItem.id,
                    name: menuItem.name,
                    qty: cartItem.qty || 1,
                    price: menuItem.price,
                    station: menuItem.station || 'Main Kitchen',
                    status: 'placed',
                    round_no: session.currentRound,
                    claimedBy: null,
                    note: cartItem.note || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            });

            data.orderItems.push(...newItems);
            this.save(data);

            this.broadcast({
                type: 'NEW_ORDER_PLACED',
                tableNumber: tableNumber,
                orderCode: order.orderCode,
                itemsCount: newItems.length
            });

            return { session, order, newItems };
        }

        // Kitchen Claim Item
        claimOrderItem(itemId, staffName) {
            const data = this.load();
            const item = data.orderItems.find(i => i.id === itemId);
            if (!item) return { success: false, message: 'Item not found' };
            if (item.status !== 'placed') {
                return { success: false, message: `Item already ${item.status}` };
            }

            item.status = 'claimed';
            item.claimedBy = staffName;
            item.updatedAt = new Date().toISOString();

            this.save(data);
            this.broadcast({ type: 'ITEM_STATUS_CHANGED', itemId, status: 'claimed', item });
            return { success: true, item };
        }

        // Update Item Status (State machine: placed -> claimed -> preparing -> ready -> picked_up -> served / cancelled)
        updateOrderItemStatus(itemId, newStatus, staffName = null) {
            const data = this.load();
            const item = data.orderItems.find(i => i.id === itemId);
            if (!item) return { success: false, message: 'Item not found' };

            const validTransitions = {
                placed: ['claimed', 'preparing', 'cancelled'],
                claimed: ['preparing', 'cancelled'],
                preparing: ['ready', 'cancelled'],
                ready: ['picked_up', 'served', 'cancelled'],
                picked_up: ['served', 'cancelled'],
                served: [],
                cancelled: []
            };

            if (!validTransitions[item.status]?.includes(newStatus)) {
                return { success: false, message: `Invalid transition from ${item.status} to ${newStatus}` };
            }

            item.status = newStatus;
            if (staffName && !item.claimedBy) item.claimedBy = staffName;
            item.updatedAt = new Date().toISOString();

            this.save(data);
            this.broadcast({ type: 'ITEM_STATUS_CHANGED', itemId, status: newStatus, item });
            return { success: true, item };
        }

        // Call Waiter Signal
        callWaiter(tableNumber) {
            const data = this.load();
            if (!data.waiterCalls) data.waiterCalls = [];
            const call = {
                id: 'call_' + Date.now(),
                tableNumber: parseInt(tableNumber),
                createdAt: new Date().toISOString(),
                status: 'PENDING'
            };
            data.waiterCalls.push(call);
            this.save(data);
            this.broadcast({ type: 'WAITER_CALLED', call });
            return call;
        }

        clearWaiterCall(callId) {
            const data = this.load();
            if (data.waiterCalls) {
                data.waiterCalls = data.waiterCalls.filter(c => c.id !== callId);
                this.save(data);
                this.broadcast({ type: 'WAITER_CALL_CLEARED', callId });
            }
        }

        // Billing Settlement
        settleSession(tableNumber, { paymentMethod = 'Cash', discountAmount = 0, staffName = 'Admin' }) {
            const data = this.load();
            tableNumber = parseInt(tableNumber);

            const session = data.sessions.find(s => s.tableNumber === tableNumber && s.status === 'OPEN');
            if (!session) return { success: false, message: 'No open session found for this table' };

            const sessionItems = data.orderItems.filter(i => i.sessionId === session.id && i.status !== 'cancelled');
            const unfulfilledItems = sessionItems.filter(i => !['served', 'cancelled'].includes(i.status));

            if (unfulfilledItems.length > 0 && paymentMethod !== 'UNPAID') {
                return {
                    success: false,
                    message: `Cannot settle bill: ${unfulfilledItems.length} item(s) are not served yet. Use UNPAID override if customer walked out.`
                };
            }

            // If UNPAID, auto cancel remaining unfulfilled items
            if (paymentMethod === 'UNPAID') {
                unfulfilledItems.forEach(item => {
                    item.status = 'cancelled';
                    item.updatedAt = new Date().toISOString();
                });
            }

            const subtotal = sessionItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
            const discount = Math.min(subtotal, Math.max(0, parseFloat(discountAmount) || 0));
            const taxableSubtotal = subtotal - discount;

            // Calculate taxes
            const taxComponents = data.branch.taxComponents || [];
            let taxTotal = 0;
            const taxBreakdown = taxComponents.map(tax => {
                const amount = Math.round(taxableSubtotal * tax.rate * 100) / 100;
                taxTotal += amount;
                return { name: tax.name, rate: tax.rate, amount };
            });

            const finalTotal = Math.round((taxableSubtotal + taxTotal) * 100) / 100;

            const bill = {
                id: 'bill_' + Date.now(),
                sessionId: session.id,
                tableNumber: tableNumber,
                billCode: '#B-' + Math.floor(1000 + Math.random() * 9000),
                subtotal,
                discount,
                taxBreakdown,
                taxTotal,
                finalTotal,
                paymentMethod,
                status: 'SETTLED',
                settledBy: staffName,
                settledAt: new Date().toISOString()
            };

            // Close session
            session.status = 'CLOSED';
            session.closedAt = new Date().toISOString();

            if (!data.bills) data.bills = [];
            data.bills.push(bill);

            this.save(data);
            this.broadcast({ type: 'SESSION_SETTLED', tableNumber, bill });
            return { success: true, bill };
        }

        // Void & Replace Payment Correction (within same day)
        correctPaymentMethod(billId, newPaymentMethod, reason) {
            const data = this.load();
            const originalBill = data.bills.find(b => b.id === billId);
            if (!originalBill) return { success: false, message: 'Original bill not found' };
            if (originalBill.status === 'VOIDED') return { success: false, message: 'Bill is already voided' };
            if (originalBill.paymentMethod === 'UNPAID') return { success: false, message: 'Cannot correct UNPAID bills' };

            // Mark original bill as voided
            originalBill.status = 'VOIDED';
            originalBill.voidedAt = new Date().toISOString();
            originalBill.voidReason = reason;

            // Create replacement bill
            const replacementBill = {
                ...originalBill,
                id: 'bill_' + Date.now(),
                billCode: originalBill.billCode + '-R',
                paymentMethod: newPaymentMethod,
                status: 'SETTLED',
                replacedBillId: originalBill.id,
                correctionReason: reason,
                settledAt: new Date().toISOString()
            };

            data.bills.push(replacementBill);
            this.save(data);
            this.broadcast({ type: 'BILL_CORRECTED', originalBill, replacementBill });
            return { success: true, replacementBill };
        }

        // Menu Management APIs
        saveMenuItem(itemData) {
            const data = this.load();
            if (itemData.id) {
                const idx = data.menuItems.findIndex(m => m.id === parseInt(itemData.id));
                if (idx !== -1) {
                    data.menuItems[idx] = { ...data.menuItems[idx], ...itemData };
                }
            } else {
                const newItem = {
                    id: Date.now(),
                    name: itemData.name,
                    desc: itemData.desc || '',
                    price: parseFloat(itemData.price),
                    category: itemData.category,
                    station: itemData.station,
                    emoji: itemData.emoji || '🍽️',
                    available: true
                };
                data.menuItems.push(newItem);
            }
            this.save(data);
            this.broadcast({ type: 'MENU_UPDATED' });
        }

        toggleItemAvailability(itemId) {
            const data = this.load();
            const item = data.menuItems.find(m => m.id === parseInt(itemId));
            if (item) {
                item.available = !item.available;
                this.save(data);
                this.broadcast({ type: 'MENU_UPDATED' });
            }
        }

        reassignItemStation(itemId, newStation) {
            const data = this.load();
            const item = data.menuItems.find(m => m.id === parseInt(itemId));
            if (item) {
                item.station = newStation;
                this.save(data);
                this.broadcast({ type: 'MENU_UPDATED' });
            }
        }

        deleteMenuItem(itemId) {
            const data = this.load();
            data.menuItems = data.menuItems.filter(m => m.id !== parseInt(itemId));
            this.save(data);
            this.broadcast({ type: 'MENU_UPDATED' });
        }

        // Station Management
        saveStation(stationName) {
            const data = this.load();
            const id = 'st_' + stationName.toLowerCase().replace(/\s+/g, '_');
            if (!data.stations.find(s => s.name === stationName)) {
                data.stations.push({ id, name: stationName, icon: 'fa-utensils' });
                this.save(data);
                this.broadcast({ type: 'STATIONS_UPDATED' });
            }
        }

        deleteStation(stationName) {
            const data = this.load();
            data.stations = data.stations.filter(s => s.name !== stationName);
            this.save(data);
            this.broadcast({ type: 'STATIONS_UPDATED' });
        }

        // Table & QR Management
        regenerateTableQR(tableNumber) {
            const data = this.load();
            const table = data.tables.find(t => t.number === parseInt(tableNumber));
            if (table) {
                table.token = 'tbl_token_' + tableNumber + '_' + Math.random().toString(36).substring(2, 8);
                this.save(data);
                this.broadcast({ type: 'TABLES_UPDATED' });
                return table.token;
            }
            return null;
        }

        // Staff Role Management
        assignStaffRole(email, role) {
            const data = this.load();
            const staff = data.staffUsers.find(s => s.email === email);
            if (staff) {
                staff.role = role;
                this.save(data);
                this.broadcast({ type: 'STAFF_UPDATED' });
            }
        }

        // Reset Store to Initial Defaults
        resetToDefaults() {
            this.save(defaultData);
            this.broadcast({ type: 'STORE_RESET' });
        }
    }

    // Attach singleton to window
    window.FlameDineStore = new Store();

})(window);
