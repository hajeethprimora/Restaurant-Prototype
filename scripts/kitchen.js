/**
 * Kitchen Display System (KDS) Logic for Flame Dine
 *
 * Dishes are grouped by kitchen stage (New / Preparing / Ready), not by table —
 * chefs work station-and-stage, not table-by-table, so the table number is just
 * a small tag on each card rather than the grouping key.
 */

(function () {
    let currentStationFilter = 'All';
    let soundEnabled = true;
    let staffUser = { name: 'Vikram Singh', role: 'KITCHEN_STAFF' };

    // --- SERVING URGENCY ---
    // Minutes-since-placed thresholds. Below `relaxed` = no rush; at/above `critical` = customer is waiting too long.
    const URGENCY_THRESHOLDS = { relaxed: 5, medium: 15, urgent: 30 };

    function getUrgency(elapsedMinutes) {
        if (elapsedMinutes < URGENCY_THRESHOLDS.relaxed) {
            return { level: 'relaxed', label: 'On Time', icon: 'fa-check-circle' };
        }
        if (elapsedMinutes < URGENCY_THRESHOLDS.medium) {
            return { level: 'medium', label: 'Watch', icon: 'fa-clock' };
        }
        if (elapsedMinutes < URGENCY_THRESHOLDS.urgent) {
            return { level: 'urgent', label: 'Urgent', icon: 'fa-triangle-exclamation' };
        }
        return { level: 'critical', label: 'Serve Now', icon: 'fa-fire' };
    }

    function elapsedSecondsSince(isoTimestamp) {
        return Math.max(0, Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000));
    }
    function elapsedMinutesSince(isoTimestamp) {
        return Math.floor(elapsedSecondsSince(isoTimestamp) / 60);
    }
    function formatMMSS(totalSeconds) {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    // DOM Elements
    const stationTabsEl = document.getElementById('stationTabs');
    const kanbanBoardEl = document.getElementById('kanbanBoard');
    const emptyQueueStateEl = document.getElementById('emptyQueueState');
    const staffNameDisplayEl = document.getElementById('staffNameDisplay');
    const soundToggleBtnEl = document.getElementById('soundToggleBtn');
    const soundIconEl = document.getElementById('soundIcon');
    const kitchenToastEl = document.getElementById('kitchenToast');
    const toastTitleEl = document.getElementById('toastTitle');
    const toastBodyEl = document.getElementById('toastBody');
    // Stat Elements
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

        window.FlameDineTheme.wireToggleButton('themeToggleBtn', 'themeToggleIcon');

        renderStationTabs();
        renderKanban();

        // Subscribe to store events for real-time updates
        window.FlameDineStore.subscribe(event => {
            if (event.type === 'NEW_ORDER_PLACED') {
                showToast('New Order Received!', `Table ${event.tableNumber} placed ${event.itemsCount} item(s).`);
                playChime();
            } else if (event.type === 'ITEM_STATUS_CHANGED' && event.status === 'cancelled') {
                showToast('Item Cancelled', `${event.item?.name || 'An item'} for Table ${event.item?.tableNumber || ''} was cancelled.`);
            }
            renderKanban();
        });

        // Cheap per-second tick: only patches the live timer text/urgency classes,
        // no full re-render, so the board doesn't flicker or lose scroll position.
        setInterval(tickTimers, 1000);
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
                renderKanban();
            });
        });
    }

    function renderCard(item) {
        const itemElapsedSec = elapsedSecondsSince(item.createdAt);
        const urgency = getUrgency(Math.floor(itemElapsedSec / 60));

        let actionBtnHtml = '';
        if (item.status === 'placed') {
            actionBtnHtml = `<button onclick="claimItem('${item.id}')" class="text-xs font-bold px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition active:scale-95 w-full mt-2"><i class="fas fa-fire mr-1"></i> Start Preparing</button>`;
        } else if (item.status === 'claimed' || item.status === 'preparing') {
            actionBtnHtml = `<button onclick="updateStatus('${item.id}', 'ready')" class="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-95 w-full mt-2"><i class="fas fa-check-circle mr-1"></i> Mark Ready</button>`;
        }

        const timerHtml = `<div class="live-timer-wrap ${urgency.level}" data-created-at="${item.createdAt}"><i class="fas fa-stopwatch"></i> <span class="live-timer-value">${formatMMSS(itemElapsedSec)}</span></div>`;

        return `
            <div class="kanban-card urgency-${urgency.level}">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <div class="font-bold text-sm text-white truncate">${item.name} <span class="text-orange-400 font-black">×${item.qty}</span></div>
                        <div class="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1 flex-wrap">
                            <span class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold">T${item.tableNumber}</span>
                            <span class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold">${item.station}</span>
                        </div>
                    </div>
                    ${statusBadgeHtml}
                </div>
                <div class="flex items-center justify-between gap-2 flex-wrap">
                    ${timerHtml}
                </div>
                ${item.note ? `<div class="text-[11px] text-amber-300/90 font-medium italic mt-1"><i class="fas fa-comment-dots mr-1"></i>"${item.note}"</div>` : ''}
                ${actionBtnHtml}
            </div>
        `;
    }

    function renderKanban() {
        const queueItems = window.FlameDineStore.getKitchenQueue(currentStationFilter);

        const newItems = queueItems.filter(i => i.status === 'placed');
        const preparingItems = queueItems.filter(i => i.status === 'claimed' || i.status === 'preparing');

        const totalVisible = newItems.length + preparingItems.length;
        if (totalVisible === 0) {
            kanbanBoardEl.innerHTML = '';
            emptyQueueStateEl.classList.remove('hidden');
            return;
        }
        emptyQueueStateEl.classList.add('hidden');

        const columns = [
            { title: 'New Orders', icon: 'fa-inbox', color: 'blue', items: newItems },
            { title: 'Preparing', icon: 'fa-fire', color: 'orange', items: preparingItems }
        ];

        kanbanBoardEl.innerHTML = columns.map(col => `
            <div class="kanban-column">
                <div class="kanban-column-header">
                    <div class="kanban-column-title text-${col.color}-400"><i class="fas ${col.icon}"></i> ${col.title}</div>
                    <span class="kanban-count bg-${col.color}-500/15 text-${col.color}-400 border border-${col.color}-500/30">${col.items.length}</span>
                </div>
                ${col.items.length === 0
                    ? `<div class="kanban-empty-col">Nothing here right now</div>`
                    : col.items.map(renderCard).join('')}
            </div>
        `).join('');
    }

    // Cheap per-second refresh of just the elapsed-time text + urgency coloring —
    // avoids rebuilding the whole board every tick.
    function tickTimers() {
        document.querySelectorAll('.live-timer-wrap[data-created-at]').forEach(wrap => {
            const elapsedSec = elapsedSecondsSince(wrap.dataset.createdAt);
            const urgency = getUrgency(Math.floor(elapsedSec / 60));
            const valueEl = wrap.querySelector('.live-timer-value');
            if (valueEl) valueEl.textContent = formatMMSS(elapsedSec);

            ['relaxed', 'medium', 'urgent', 'critical'].forEach(l => wrap.classList.remove(l));
            wrap.classList.add(urgency.level);

            const card = wrap.closest('.kanban-card');
            if (card && !card.classList.contains('status-ready')) {
                ['urgency-relaxed', 'urgency-medium', 'urgency-urgent', 'urgency-critical'].forEach(c => card.classList.remove(c));
                card.classList.add('urgency-' + urgency.level);
            }
        });
    }

    // Global Window Action Binds
    window.claimItem = function (itemId) {
        const res = window.FlameDineStore.updateOrderItemStatus(itemId, 'preparing', staffUser.name);
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

    window.reloadDemoData = function () {
        if (confirm('Reset the shared demo data (orders, sessions, bills) back to the seed state? This affects all open FlameDine tabs.')) {
            window.FlameDineStore.resetToDefaults();
            renderKanban();
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
