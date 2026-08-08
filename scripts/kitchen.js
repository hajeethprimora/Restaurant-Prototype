/**
 * Kitchen Display System (KDS) Logic for Flame Dine
 */

(function () {
    let currentStationFilter = 'All';
    let soundEnabled = true;
    let staffUser = { name: 'Vikram Singh', role: 'KITCHEN_STAFF' };

    // DOM Elements
    const stationTabsEl = document.getElementById('stationTabs');
    const kitchenQueueGridEl = document.getElementById('kitchenQueueGrid');
    const emptyQueueStateEl = document.getElementById('emptyQueueState');
    const staffNameDisplayEl = document.getElementById('staffNameDisplay');
    const soundToggleBtnEl = document.getElementById('soundToggleBtn');
    const soundIconEl = document.getElementById('soundIcon');
    const kitchenToastEl = document.getElementById('kitchenToast');
    const toastTitleEl = document.getElementById('toastTitle');
    const toastBodyEl = document.getElementById('toastBody');

    // Stat Elements
    const statPendingEl = document.getElementById('statPending');
    const statClaimedEl = document.getElementById('statClaimed');
    const statPreparingEl = document.getElementById('statPreparing');
    const statReadyEl = document.getElementById('statReady');

    // Audio Chime Generator using Web Audio API (no external sound file needed)
    function playChime() {
        if (!soundEnabled) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.log('Audio chime error:', e);
        }
    }

    function init() {
        // Load logged in user if available
        const savedUser = localStorage.getItem('flame_dine_user');
        if (savedUser) {
            try {
                const u = JSON.parse(savedUser);
                if (u.name) staffUser.name = u.name;
            } catch (e) {}
        }
        if (staffNameDisplayEl) staffNameDisplayEl.textContent = staffUser.name;

        renderStationTabs();
        renderQueue();

        // Subscribe to store events for real-time updates
        window.FlameDineStore.subscribe(event => {
            if (event.type === 'NEW_ORDER_PLACED') {
                showToast('New Order Received!', `Table ${event.tableNumber} placed ${event.itemsCount} item(s).`);
                playChime();
            }
            renderQueue();
        });

        // Periodic timer refresh for elapsed prep times
        setInterval(updateTimers, 10000);
    }

    function renderStationTabs() {
        const stations = window.FlameDineStore.getStations();
        const tabList = [{ id: 'All', name: 'All Stations' }, ...stations];

        stationTabsEl.innerHTML = tabList.map(st => `
            <button class="station-tab ${currentStationFilter === st.name || (currentStationFilter === 'All' && st.id === 'All') ? 'active' : ''}" data-station="${st.name}">
                ${st.name}
            </button>
        `).join('');

        stationTabsEl.querySelectorAll('.station-tab').forEach(btn => {
            btn.addEventListener('click', function () {
                currentStationFilter = this.dataset.station;
                renderStationTabs();
                renderQueue();
            });
        });
    }

    function renderQueue() {
        const queueItems = window.FlameDineStore.getKitchenQueue(currentStationFilter);

        // Update stats counters
        const allItems = window.FlameDineStore.load().orderItems || [];
        const pendingCount = allItems.filter(i => i.status === 'placed').length;
        const claimedCount = allItems.filter(i => i.status === 'claimed').length;
        const preparingCount = allItems.filter(i => i.status === 'preparing').length;
        const readyCount = allItems.filter(i => i.status === 'ready').length;

        if (statPendingEl) statPendingEl.textContent = pendingCount;
        if (statClaimedEl) statClaimedEl.textContent = claimedCount;
        if (statPreparingEl) statPreparingEl.textContent = preparingCount;
        if (statReadyEl) statReadyEl.textContent = readyCount;

        if (queueItems.length === 0) {
            kitchenQueueGridEl.innerHTML = '';
            emptyQueueStateEl.classList.remove('hidden');
            return;
        }

        emptyQueueStateEl.classList.add('hidden');

        // Group queue items by Table Number & Order
        const grouped = {};
        queueItems.forEach(item => {
            const key = `Table_${item.tableNumber}_Session_${item.sessionId}`;
            if (!grouped[key]) {
                grouped[key] = {
                    tableNumber: item.tableNumber,
                    sessionId: item.sessionId,
                    orderId: item.orderId,
                    items: []
                };
            }
            grouped[key].items.push(item);
        });

        kitchenQueueGridEl.innerHTML = Object.values(grouped).map(group => {
            const earliestItem = group.items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
            const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(earliestItem.createdAt).getTime()) / 60000));
            
            const cardStatusClass = group.items.some(i => i.status === 'preparing') ? 'status-preparing'
                : group.items.some(i => i.status === 'claimed') ? 'status-claimed' : 'status-placed';

            const itemsHtml = group.items.map(item => {
                let actionBtnHtml = '';
                if (item.status === 'placed') {
                    actionBtnHtml = `
                        <button onclick="claimItem('${item.id}')" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition active:scale-95">
                            <i class="fas fa-hand-paper mr-1"></i> Claim
                        </button>
                    `;
                } else if (item.status === 'claimed') {
                    actionBtnHtml = `
                        <button onclick="updateStatus('${item.id}', 'preparing')" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition active:scale-95">
                            <i class="fas fa-fire mr-1"></i> Prepare
                        </button>
                    `;
                } else if (item.status === 'preparing') {
                    actionBtnHtml = `
                        <button onclick="updateStatus('${item.id}', 'ready')" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-95">
                            <i class="fas fa-check-circle mr-1"></i> Mark Ready
                        </button>
                    `;
                }

                const statusBadgeHtml = item.status === 'placed'
                    ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">NEW</span>`
                    : item.status === 'claimed'
                    ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">CLAIMED (${item.claimedBy || 'Chef'})</span>`
                    : `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase">PREPARING</span>`;

                return `
                    <div class="item-row">
                        <div class="flex items-start justify-between gap-2">
                            <div>
                                <div class="font-bold text-sm text-white flex items-center gap-2">
                                    ${item.name} <span class="text-orange-400 font-black">×${item.qty}</span>
                                </div>
                                <div class="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                                    <span class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold text-[10px]">${item.station}</span>
                                    <span>Round ${item.round_no || 1}</span>
                                </div>
                                ${item.note ? `<div class="text-xs text-amber-300/90 font-medium italic mt-1"><i class="fas fa-comment-dots mr-1"></i>"${item.note}"</div>` : ''}
                            </div>
                            <div class="flex flex-col items-end gap-2">
                                ${statusBadgeHtml}
                                ${actionBtnHtml}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="order-card ${cardStatusClass} p-5 flex flex-col justify-between">
                    <div>
                        <!-- Card Header -->
                        <div class="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                            <div class="flex items-center gap-2">
                                <span class="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-base border border-orange-500/30">
                                    T${group.tableNumber}
                                </span>
                                <div>
                                    <div class="font-black text-base text-white">Table ${group.tableNumber}</div>
                                    <div class="text-[11px] text-zinc-500 font-mono">Session ${group.sessionId.substring(0, 10)}</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-xs font-bold text-orange-400 flex items-center gap-1 justify-end">
                                    <i class="fas fa-clock text-[10px]"></i> ${elapsedMinutes}m ago
                                </div>
                                <div class="text-[10px] text-zinc-500">${group.items.length} item(s)</div>
                            </div>
                        </div>

                        <!-- Item List -->
                        <div class="space-y-2">
                            ${itemsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function updateTimers() {
        renderQueue();
    }

    // Global Window Action Binds
    window.claimItem = function (itemId) {
        const res = window.FlameDineStore.claimOrderItem(itemId, staffUser.name);
        if (!res.success) {
            alert(res.message);
        }
    };

    window.updateStatus = function (itemId, newStatus) {
        const res = window.FlameDineStore.updateOrderItemStatus(itemId, newStatus, staffUser.name);
        if (!res.success) {
            alert(res.message);
        }
    };

    window.toggleSound = function () {
        soundEnabled = !soundEnabled;
        if (soundToggleBtnEl) {
            soundToggleBtnEl.querySelector('span').textContent = soundEnabled ? 'Chime On' : 'Chime Off';
            soundIconEl.className = soundEnabled ? 'fas fa-volume-up text-orange-400' : 'fas fa-volume-mute text-zinc-500';
        }
    };

    function showToast(title, body) {
        if (!kitchenToastEl) return;
        toastTitleEl.textContent = title;
        toastBodyEl.textContent = body;
        kitchenToastEl.classList.remove('hidden');
        setTimeout(dismissToast, 6000);
    }

    window.dismissToast = function () {
        if (kitchenToastEl) kitchenToastEl.classList.add('hidden');
    };

    // Run on load
    document.addEventListener('DOMContentLoaded', init);
})();
