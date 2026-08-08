/**
 * Server Staff Dashboard Logic for Flame Dine
 */

(function () {
    let staffUser = { name: 'Priya Sharma', role: 'SERVER' };
    let activeDrawerTable = null;

    // DOM Elements
    const serverNameDisplayEl = document.getElementById('serverNameDisplay');
    const readyGridEl = document.getElementById('readyGrid');
    const emptyReadyFeedEl = document.getElementById('emptyReadyFeed');
    const tablesGridEl = document.getElementById('tablesGrid');
    const readyBadgeEl = document.getElementById('readyBadge');
    const batchPickupBtnEl = document.getElementById('batchPickupBtn');
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

    function init() {
        const savedUser = localStorage.getItem('flame_dine_user');
        if (savedUser) {
            try {
                const u = JSON.parse(savedUser);
                if (u.name) staffUser.name = u.name;
            } catch (e) {}
        }
        if (serverNameDisplayEl) serverNameDisplayEl.textContent = staffUser.name;

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

    function renderServerDashboard() {
        const readyItems = window.FlameDineStore.getServerQueue();
        const allItems = window.FlameDineStore.load().orderItems || [];
        const tables = window.FlameDineStore.getTables();
        const waiterCalls = window.FlameDineStore.getWaiterCalls();

        // Stats
        const readyCount = readyItems.filter(i => i.status === 'ready').length;
        const pickedCount = readyItems.filter(i => i.status === 'picked_up').length;
        const servedCount = allItems.filter(i => i.status === 'served').length;

        if (statReadyCountEl) statReadyCountEl.textContent = readyCount;
        if (statPickedCountEl) statPickedCountEl.textContent = pickedCount;
        if (statServedCountEl) statServedCountEl.textContent = servedCount;
        if (readyBadgeEl) readyBadgeEl.textContent = `${readyCount} Ready`;

        if (batchPickupBtnEl) {
            if (readyCount > 0) batchPickupBtnEl.classList.remove('hidden');
            else batchPickupBtnEl.classList.add('hidden');
        }

        // Render Waiter Calls
        renderWaiterCalls(waiterCalls);

        // Render Ready Items
        renderReadyFeed(readyItems);

        // Render Tables Floor Map
        renderTablesFloor(tables, allItems);
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

    function renderReadyFeed(items) {
        if (items.length === 0) {
            readyGridEl.innerHTML = '';
            emptyReadyFeedEl.classList.remove('hidden');
            return;
        }

        emptyReadyFeedEl.classList.add('hidden');

        // Group ready items by table
        const grouped = {};
        items.forEach(item => {
            const table = item.tableNumber;
            if (!grouped[table]) grouped[table] = [];
            grouped[table].push(item);
        });

        readyGridEl.innerHTML = Object.keys(grouped).map(tableNum => {
            const tableItems = grouped[tableNum];
            const itemsHtml = tableItems.map(item => {
                let actionBtn = '';
                if (item.status === 'ready') {
                    actionBtn = `
                        <button onclick="updateStatus('${item.id}', 'picked_up')" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition active:scale-95">
                            <i class="fas fa-hand-holding mr-1"></i> Pick Up
                        </button>
                    `;
                } else if (item.status === 'picked_up') {
                    actionBtn = `
                        <button onclick="updateStatus('${item.id}', 'served')" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-95">
                            <i class="fas fa-check-circle mr-1"></i> Mark Served
                        </button>
                    `;
                }

                const statusTag = item.status === 'ready'
                    ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">READY</span>`
                    : `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">PICKED UP</span>`;

                return `
                    <div class="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                        <div>
                            <div class="font-bold text-sm text-white">${item.name} <span class="text-emerald-400 font-black">×${item.qty}</span></div>
                            <div class="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                                <span class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold text-[10px]">${item.station}</span>
                                <span>Round ${item.round_no || 1}</span>
                            </div>
                            ${item.note ? `<div class="text-xs text-amber-300/80 italic mt-0.5">"${item.note}"</div>` : ''}
                        </div>
                        <div class="flex flex-col items-end gap-1.5">
                            ${statusTag}
                            ${actionBtn}
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="ready-card p-5">
                    <div class="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
                        <div class="flex items-center gap-2">
                            <span class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-base border border-emerald-500/30">
                                T${tableNum}
                            </span>
                            <div class="font-black text-base text-white">Table ${tableNum}</div>
                        </div>
                        <button onclick="openTableDrawer(${tableNum})" class="text-xs font-bold text-emerald-400 hover:underline">
                            View All Orders &rarr;
                        </button>
                    </div>
                    <div class="space-y-2">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderTablesFloor(tables, allItems) {
        tablesGridEl.innerHTML = tables.map(t => {
            const tableItems = allItems.filter(i => i.tableNumber === t.number);
            const hasReady = tableItems.some(i => i.status === 'ready');
            const hasPreparing = tableItems.some(i => i.status === 'preparing' || i.status === 'placed' || i.status === 'claimed');
            const activeSession = window.FlameDineStore.getOpenSessionForTable(t.number);

            let borderClass = 'border-zinc-800';
            let badgeHtml = `<span class="text-[10px] text-zinc-500">Empty</span>`;

            if (hasReady) {
                borderClass = 'border-emerald-500 bg-emerald-500/10 pulse-green';
                badgeHtml = `<span class="text-[10px] font-bold text-emerald-400 flex items-center gap-1"><i class="fas fa-bell"></i> Ready!</span>`;
            } else if (hasPreparing) {
                borderClass = 'border-amber-500/70 bg-amber-500/5';
                badgeHtml = `<span class="text-[10px] font-bold text-amber-400">Preparing</span>`;
            } else if (activeSession) {
                borderClass = 'border-blue-500/50 bg-blue-500/5';
                badgeHtml = `<span class="text-[10px] font-bold text-blue-400">Open Session</span>`;
            }

            return `
                <div onclick="openTableDrawer(${t.number})" class="table-tile ${borderClass} p-4 flex flex-col items-center justify-center text-center relative">
                    <div class="text-xs text-zinc-500 font-semibold mb-1">TABLE</div>
                    <div class="text-2xl font-black text-white">${t.number}</div>
                    <div class="mt-2">${badgeHtml}</div>
                </div>
            `;
        }).join('');
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
        const readyItems = window.FlameDineStore.getServerQueue().filter(i => i.status === 'ready');
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

    document.addEventListener('DOMContentLoaded', init);
})();
