/**
 * Server Staff Dashboard Logic for Flame Dine
 */

(function () {
    let staffUser = { name: 'Priya Sharma', role: 'SERVER' };
    let activeDrawerTable = null;
    let soundEnabled = true;
    let floorSearchQuery = '';
    let floorStatusFilter = 'all'; // all | ready | preparing | open | empty
    let showAllEmptyTables = false;
    let activeView = 'table'; // table | dish

    const FLOOR_FILTERS = [
        { id: 'all', label: 'All' },
        { id: 'ready', label: 'Ready' },
        { id: 'preparing', label: 'Preparing' },
        { id: 'open', label: 'Open' },
        { id: 'empty', label: 'Empty' }
    ];

    // A single shared login covers several servers in this demo store, so each
    // server picks exactly which tables they're covering this shift. "All Tables"
    // shows everything; "Select Tables" narrows the whole dashboard (waiter calls,
    // both views) down to whatever combination they choose.
    const TABLE_FILTER_MODE_KEY = 'flame_dine_table_filter_mode';
    const SELECTED_TABLES_KEY = 'flame_dine_selected_tables';
    let tableFilterMode = localStorage.getItem(TABLE_FILTER_MODE_KEY) || 'all'; // all | selected
    let selectedTables = [];
    let pendingSelectedTables = []; // working copy while the picker modal is open
    try {
        selectedTables = JSON.parse(localStorage.getItem(SELECTED_TABLES_KEY) || '[]');
    } catch (e) { selectedTables = []; }

    const STATUS_TAGS = {
        placed: `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">NEW</span>`,
        claimed: `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">CLAIMED</span>`,
        preparing: `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase">PREPARING</span>`,
        ready: `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">READY</span>`,
        picked_up: `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">PICKED UP</span>`
    };

    // DOM Elements
    const serverNameDisplayEl = document.getElementById('serverNameDisplay');
    const tablesGridEl = document.getElementById('tablesGrid');
    const dishKanbanBoardEl = document.getElementById('dishKanbanBoard');
    const emptyDishKanbanEl = document.getElementById('emptyDishKanban');
    const waiterCallAreaEl = document.getElementById('waiterCallArea');

    // Stat Elements
    const statReadyCountEl = document.getElementById('statReadyCount');
    const statPickedCountEl = document.getElementById('statPickedCount');
    const statServedCountEl = document.getElementById('statServedCount');

    // Drawer Elements
    const tableDrawerEl = document.getElementById('tableDrawer');
    const drawerTitleEl = document.getElementById('drawerTitle');
    const drawerSubtitleEl = document.getElementById('drawerSubtitle');
    const drawerContentEl = document.getElementById('drawerContent');

    function playServerBell() {
        if (!soundEnabled) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6 bell
            gain.gain.setValueAtTime(0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.8);
        } catch (e) {}
    }

    function inSection(tableNumber) {
        if (tableFilterMode !== 'selected') return true;
        return selectedTables.includes(tableNumber);
    }

    function init() {
        const savedUser = localStorage.getItem('flame_dine_user');
        if (savedUser) {
            try {
                const u = JSON.parse(savedUser);
                if (u.name) staffUser.name = u.name;
            } catch (e) {}
        }
        if (serverNameDisplayEl) serverNameDisplayEl.textContent = staffUser.name;

        window.FlameDineTheme.wireToggleButton('themeToggleBtn', 'themeToggleIcon');

        renderTableFilterButtons();
        renderFloorFilterChips();
        const floorSearchInputEl = document.getElementById('floorSearchInput');
        if (floorSearchInputEl) {
            floorSearchInputEl.addEventListener('input', (e) => {
                floorSearchQuery = e.target.value.trim();
                renderServerDashboard();
            });
        }

        renderServerDashboard();

        // Subscribe to store events
        window.FlameDineStore.subscribe(event => {
            if (event.type === 'ITEM_STATUS_CHANGED' && (event.status === 'ready' || event.status === 'picked_up')) {
                playServerBell();
            }
            if (event.type === 'WAITER_CALLED') {
                playServerBell();
            }
            renderServerDashboard();
            if (activeDrawerTable) {
                openTableDrawer(activeDrawerTable);
            }
        });
    }

    function renderTableFilterButtons() {
        const allBtn = document.getElementById('allTablesBtn');
        const selectBtn = document.getElementById('selectTablesBtn');
        if (allBtn) allBtn.classList.toggle('active', tableFilterMode === 'all');
        if (selectBtn) {
            selectBtn.classList.toggle('active', tableFilterMode === 'selected');
            selectBtn.innerHTML = tableFilterMode === 'selected' && selectedTables.length > 0
                ? `<i class="fas fa-check-square mr-1.5"></i>Select Tables (${selectedTables.length})`
                : `<i class="fas fa-check-square mr-1.5"></i>Select Tables`;
        }
    }

    window.setTableFilterMode = function (mode) {
        tableFilterMode = mode;
        localStorage.setItem(TABLE_FILTER_MODE_KEY, mode);
        renderTableFilterButtons();
        renderServerDashboard();
    };

    function renderTableSelectorGrid() {
        const grid = document.getElementById('tableSelectorGrid');
        if (!grid) return;
        const tables = window.FlameDineStore.getTables();
        grid.innerHTML = tables.map(t => `
            <button onclick="toggleTableInSelector(${t.number})" class="table-selector-chip ${pendingSelectedTables.includes(t.number) ? 'active' : ''}">${t.number}</button>
        `).join('');
    }

    window.openTableSelector = function () {
        pendingSelectedTables = [...selectedTables];
        renderTableSelectorGrid();
        const modal = document.getElementById('tableSelectorModal');
        if (modal) modal.classList.remove('hidden');
    };

    window.closeTableSelector = function () {
        const modal = document.getElementById('tableSelectorModal');
        if (modal) modal.classList.add('hidden');
    };

    window.toggleTableInSelector = function (num) {
        const idx = pendingSelectedTables.indexOf(num);
        if (idx === -1) pendingSelectedTables.push(num);
        else pendingSelectedTables.splice(idx, 1);
        renderTableSelectorGrid();
    };

    window.applyTableSelection = function () {
        selectedTables = [...pendingSelectedTables];
        localStorage.setItem(SELECTED_TABLES_KEY, JSON.stringify(selectedTables));
        tableFilterMode = 'selected';
        localStorage.setItem(TABLE_FILTER_MODE_KEY, 'selected');
        renderTableFilterButtons();
        window.closeTableSelector();
        renderServerDashboard();
    };

    window.setActiveView = function (view) {
        activeView = view;
        document.querySelectorAll('#viewTabs .view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
        const tableSection = document.getElementById('tableViewSection');
        const dishSection = document.getElementById('dishViewSection');
        if (tableSection) tableSection.classList.toggle('hidden', view !== 'table');
        if (dishSection) dishSection.classList.toggle('hidden', view !== 'dish');
    };

    function renderServerDashboard() {
        const allItems = (window.FlameDineStore.load().orderItems || []).filter(i => inSection(i.tableNumber));
        const tables = window.FlameDineStore.getTables().filter(t => inSection(t.number));
        const waiterCalls = window.FlameDineStore.getWaiterCalls().filter(c => inSection(c.tableNumber));
        const readyItems = window.FlameDineStore.getServerQueue().filter(i => inSection(i.tableNumber));

        // Stats
        const readyCount = readyItems.filter(i => i.status === 'ready').length;
        const pickedCount = readyItems.filter(i => i.status === 'picked_up').length;
        const servedCount = allItems.filter(i => i.status === 'served').length;

        if (statReadyCountEl) statReadyCountEl.textContent = readyCount;
        if (statPickedCountEl) statPickedCountEl.textContent = pickedCount;
        if (statServedCountEl) statServedCountEl.textContent = servedCount;

        renderWaiterCalls(waiterCalls);
        renderTablesFloor(tables, allItems);
        renderDishKanban(allItems);
    }

    function renderWaiterCalls(calls) {
        if (!waiterCallAreaEl) return;
        const pendingCalls = calls.filter(c => c.status === 'PENDING');
        if (pendingCalls.length === 0) {
            waiterCallAreaEl.classList.add('hidden');
            waiterCallAreaEl.innerHTML = '';
            return;
        }

        waiterCallAreaEl.classList.remove('hidden');
        waiterCallAreaEl.innerHTML = pendingCalls.map(c => `
            <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between animate-pulse">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black text-lg">
                        T${c.tableNumber}
                    </div>
                    <div>
                        <div class="font-bold text-sm text-amber-300">Call Waiter Request &middot; Table ${c.tableNumber}</div>
                        <div class="text-xs text-amber-200/80">Guest requested staff assistance at table.</div>
                    </div>
                </div>
                <button onclick="ackWaiterCall('${c.id}')" class="text-xs font-bold px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition active:scale-95">
                    Acknowledge &amp; Clear
                </button>
            </div>
        `).join('');
    }

    function renderFloorFilterChips() {
        const wrap = document.getElementById('floorFilterChips');
        if (!wrap) return;
        wrap.innerHTML = FLOOR_FILTERS.map(f => `
            <button onclick="setFloorFilter('${f.id}')" class="filter-chip ${floorStatusFilter === f.id ? 'active' : ''}">${f.label}</button>
        `).join('');
    }
    window.setFloorFilter = function (id) {
        floorStatusFilter = id;
        renderFloorFilterChips();
        renderServerDashboard();
    };

    window.toggleEmptyTables = function () {
        showAllEmptyTables = !showAllEmptyTables;
        renderServerDashboard();
    };

    function tableStatus(tableNumber, allItems) {
        const tableItems = allItems.filter(i => i.tableNumber === tableNumber);
        const hasReady = tableItems.some(i => i.status === 'ready');
        const hasPreparing = tableItems.some(i => i.status === 'preparing' || i.status === 'placed' || i.status === 'claimed');
        const activeSessionForTable = window.FlameDineStore.getOpenSessionForTable(tableNumber);
        if (hasReady) return 'ready';
        if (hasPreparing) return 'preparing';
        if (activeSessionForTable) return 'open';
        return 'empty';
    }

    function tileVisual(status) {
        if (status === 'ready') {
            return {
                borderClass: 'border-emerald-500 bg-emerald-500/10 pulse-green',
                badgeHtml: `<span class="text-[10px] font-bold text-emerald-400 flex items-center gap-1"><i class="fas fa-bell"></i> Ready!</span>`
            };
        }
        if (status === 'preparing') {
            return {
                borderClass: 'border-amber-500/70 bg-amber-500/5',
                badgeHtml: `<span class="text-[10px] font-bold text-amber-400">Preparing</span>`
            };
        }
        if (status === 'open') {
            return {
                borderClass: 'border-blue-500/50 bg-blue-500/5',
                badgeHtml: `<span class="text-[10px] font-bold text-blue-400">Open Session</span>`
            };
        }
        return { borderClass: 'border-zinc-800', badgeHtml: `<span class="text-[10px] text-zinc-500">Empty</span>` };
    }

    function renderTablesFloor(tables, allItems) {
        const computed = tables.map(t => ({ table: t, status: tableStatus(t.number, allItems) }));

        const query = floorSearchQuery.toLowerCase();
        let visible = computed.filter(c => {
            if (query && !String(c.table.number).includes(query)) return false;
            if (floorStatusFilter !== 'all' && c.status !== floorStatusFilter) return false;
            return true;
        });

        // Only collapse empty tables when the user isn't actively searching/filtering —
        // an idle floor of a dozen tables is mostly noise, so tuck them away by default.
        const isDefaultView = !query && floorStatusFilter === 'all';
        let hiddenEmptyCount = 0;
        if (isDefaultView && !showAllEmptyTables) {
            const nonEmpty = visible.filter(c => c.status !== 'empty');
            hiddenEmptyCount = visible.length - nonEmpty.length;
            visible = nonEmpty;
        }

        const countBadge = document.getElementById('floorCountBadge');
        if (countBadge) countBadge.textContent = `(${visible.length} of ${tables.length})`;

        if (visible.length === 0) {
            tablesGridEl.innerHTML = `
                <div class="col-span-full text-center py-10 text-zinc-600 text-sm">
                    <i class="fas fa-filter text-2xl block mb-2 opacity-50"></i>
                    No tables match this filter.
                </div>
            `;
        } else {
            tablesGridEl.innerHTML = visible.map(({ table: t, status }) => {
                const { borderClass, badgeHtml } = tileVisual(status);
                return `
                    <div onclick="openTableDrawer(${t.number})" class="table-tile fade-in ${borderClass} p-4 flex flex-col items-center justify-center text-center relative">
                        <div class="text-xs text-zinc-500 font-semibold mb-1">TABLE</div>
                        <div class="text-2xl font-black text-white">${t.number}</div>
                        <div class="mt-2">${badgeHtml}</div>
                    </div>
                `;
            }).join('');
        }

        const toggleWrap = document.getElementById('emptyTablesToggleWrap');
        const toggleBtn = document.getElementById('emptyTablesToggleBtn');
        if (toggleWrap && toggleBtn) {
            if (isDefaultView && (hiddenEmptyCount > 0 || showAllEmptyTables)) {
                toggleWrap.classList.remove('hidden');
                toggleBtn.innerHTML = showAllEmptyTables
                    ? `<i class="fas fa-chevron-up mr-1"></i> Hide empty tables`
                    : `<i class="fas fa-chevron-down mr-1"></i> Show ${hiddenEmptyCount} empty table${hiddenEmptyCount === 1 ? '' : 's'}`;
            } else {
                toggleWrap.classList.add('hidden');
            }
        }
    }

    // Dish View: a kanban board grouped by stage (Preparing / Ready / Picked Up) —
    // same visual pattern as the Kitchen board. Table number is just a tag on each
    // card, since this view is about pickup/serve workflow, not floor layout.
    function dishKanbanCard(item, actionBtnHtml) {
        return `
            <div class="kanban-card">
                <div class="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <div class="font-bold text-sm text-white">${item.name} <span class="text-emerald-400 font-black">×${item.qty}</span></div>
                        <div class="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold">T${item.tableNumber}</span>
                            <span class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold">${item.station}</span>
                            <span>Rnd ${item.round_no || 1}</span>
                        </div>
                    </div>
                    ${STATUS_TAGS[item.status] || ''}
                </div>
                ${actionBtnHtml}
            </div>
        `;
    }

    function renderDishKanban(allItems) {
        if (!dishKanbanBoardEl) return;
        const query = floorSearchQuery.toLowerCase();
        const filtered = query ? allItems.filter(i => String(i.tableNumber).includes(query)) : allItems;

        const readyItems = filtered
            .filter(i => i.status === 'ready')
            .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
        const pickedUpItems = filtered
            .filter(i => i.status === 'picked_up')
            .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));

        const total = readyItems.length + pickedUpItems.length;
        if (emptyDishKanbanEl) emptyDishKanbanEl.classList.toggle('hidden', total > 0);
        if (total === 0) {
            dishKanbanBoardEl.innerHTML = '';
            return;
        }

        const columns = [
            {
                title: 'Ready for Pickup', icon: 'fa-bell', color: 'emerald', items: readyItems,
                render: item => dishKanbanCard(item, `<button onclick="updateStatus('${item.id}', 'picked_up')" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition active:scale-95 w-full mt-1"><i class="fas fa-hand-holding mr-1"></i> Pick Up</button>`)
            },
            {
                title: 'Picked Up', icon: 'fa-person-walking', color: 'blue', items: pickedUpItems,
                render: item => dishKanbanCard(item, `<button onclick="updateStatus('${item.id}', 'served')" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-95 w-full mt-1"><i class="fas fa-check-circle mr-1"></i> Mark Served</button>`)
            }
        ];

        dishKanbanBoardEl.innerHTML = columns.map(col => `
            <div class="kanban-column">
                <div class="kanban-column-header">
                    <div class="kanban-column-title text-${col.color}-400"><i class="fas ${col.icon}"></i> ${col.title}</div>
                    <div class="flex items-center gap-2">
                        ${col.title === 'Ready for Pickup' && col.items.length > 0
                            ? `<button onclick="pickupAllReady()" class="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition">Pick Up All</button>`
                            : ''}
                        <span class="kanban-count bg-${col.color}-500/15 text-${col.color}-400 border border-${col.color}-500/30">${col.items.length}</span>
                    </div>
                </div>
                ${col.items.length === 0 ? `<div class="kanban-empty-col">Nothing here right now</div>` : col.items.map(col.render).join('')}
            </div>
        `).join('');
    }

    window.openTableDrawer = function (tableNum) {
        activeDrawerTable = tableNum;
        drawerTitleEl.textContent = `Table ${tableNum} Orders`;
        const session = window.FlameDineStore.getOpenSessionForTable(tableNum);
        drawerSubtitleEl.textContent = session ? `Session ${session.id.substring(0, 12)}` : 'No active session';

        const items = session ? window.FlameDineStore.getOrderItemsForSession(session.id) : [];

        if (items.length === 0) {
            drawerContentEl.innerHTML = `
                <div class="text-center py-10 text-zinc-500 text-sm">
                    <i class="fas fa-utensils text-2xl block mb-2 opacity-50"></i>
                    No order items placed for Table ${tableNum} yet.
                </div>
            `;
        } else {
            const groupedRounds = {};
            items.forEach(i => {
                const r = i.round_no || 1;
                if (!groupedRounds[r]) groupedRounds[r] = [];
                groupedRounds[r].push(i);
            });

            drawerContentEl.innerHTML = Object.keys(groupedRounds).map(roundNo => `
                <div class="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                    <div class="text-xs font-extrabold text-orange-400 uppercase tracking-wider mb-2 flex justify-between">
                        <span>Round ${roundNo}</span>
                        <span>${groupedRounds[roundNo].length} items</span>
                    </div>
                    <div class="space-y-2">
                        ${groupedRounds[roundNo].map(it => `
                            <div class="flex items-center justify-between text-xs py-1.5 border-b border-zinc-900 last:border-0">
                                <div>
                                    <div class="font-bold text-white">${it.name} × ${it.qty}</div>
                                    <div class="text-[10px] text-zinc-500">${it.station}</div>
                                </div>
                                <span class="px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                                    it.status === 'served' ? 'bg-zinc-800 text-zinc-400'
                                    : it.status === 'ready' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-400'
                                }">${it.status}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }

        tableDrawerEl.classList.remove('hidden');
    };

    window.closeTableDrawer = function () {
        activeDrawerTable = null;
        tableDrawerEl.classList.add('hidden');
    };

    window.updateStatus = function (itemId, newStatus) {
        window.FlameDineStore.updateOrderItemStatus(itemId, newStatus, staffUser.name);
    };

    window.pickupAllReady = function () {
        const readyItems = window.FlameDineStore.getServerQueue().filter(i => i.status === 'ready' && inSection(i.tableNumber));
        readyItems.forEach(item => {
            window.FlameDineStore.updateOrderItemStatus(item.id, 'picked_up', staffUser.name);
        });
    };

    window.ackWaiterCall = function (callId) {
        window.FlameDineStore.clearWaiterCall(callId);
    };

    window.simulateCallWaiter = function () {
        window.FlameDineStore.callWaiter(5);
    };

    window.toggleSound = function () {
        soundEnabled = !soundEnabled;
        const btn = document.getElementById('soundToggleBtn');
        const icon = document.getElementById('soundIcon');
        if (btn) btn.querySelector('span').textContent = soundEnabled ? 'Bell On' : 'Bell Off';
        if (icon) icon.className = soundEnabled ? 'fas fa-volume-up text-emerald-400' : 'fas fa-volume-mute text-zinc-500';
    };

    window.reloadDemoData = function () {
        if (confirm('Reset the shared demo data (orders, sessions, bills) back to the seed state? This affects all open FlameDine tabs.')) {
            window.FlameDineStore.resetToDefaults();
            renderServerDashboard();
        }
    };

    document.addEventListener('DOMContentLoaded', init);
})();
