

        // =============================================================
        // DATA
        // =============================================================


        // =============================================================
        // STATE
        // =============================================================
        let cart = [];
        let selectedCategory = 'All';
        let currentOrder = null;
        let trackInterval = null;
        let autoTrackTimer = null;
        let itemSheetItemId = null;
        let itemSheetQtyVal = 1;

        // Table 5's session in the shared store is pre-seeded with demo data for the
        // kitchen/server dashboards. It must not be mistaken for an order this customer
        // actually placed, so the order-tracker UI stays gated behind this session flag.
        const HAS_ORDERED_KEY = 'flame_dine_has_ordered_t5';
        function hasPlacedOrderThisSession() {
            return sessionStorage.getItem(HAS_ORDERED_KEY) === '1';
        }
        function markOrderPlacedThisSession() {
            sessionStorage.setItem(HAS_ORDERED_KEY, '1');
        }

        // =============================================================
        // DOM REFS
        // =============================================================
        const $ = (id) => document.getElementById(id);
        const pageLanding = $('page-landing');
        const pageMenu = $('page-menu');
        const pageCart = $('page-cart');
        const pageTracker = $('page-tracker');
        const pageSuccess = $('page-success');
        
        const successOrderId = $('successOrderId');
        const successTable = $('successTable');
        const successTotal = $('successTotal');
        const successEstTime = $('successEstTime');
        const successTrackBtn = $('successTrackBtn');
        const successBackMenuBtn = $('successBackMenuBtn');

        const menuGrid = $('menuGrid');
        const categorySidebar = $('categorySidebar');
        const searchInput = $('searchInput');
        const cartBar = $('cartBar');
        const cartBarBadge = $('cartBarBadge');
        const cartBarItems = $('cartBarItems');
        const cartBarTotal = $('cartBarTotal');
        const cartContent = $('cartContent');
        const cartItemCount = $('cartItemCount');
        const overlay = $('overlay');
        const itemSheet = $('itemSheet');
        const itemSheetName = $('itemSheetName');
        const itemSheetDesc = $('itemSheetDesc');
        const itemSheetPrice = $('itemSheetPrice');
        const itemSheetImg = $('itemSheetImg');
        const itemSheetQty = $('itemSheetQty');
        const headerOrderTracker = $('headerOrderTracker');
        const preparingToastEl = $('preparingToast');

        // Buttons
        const scanBtn = $('scanButton');
        const qrScanArea = $('qrScanArea');
        const closeItemBtn = $('closeItemSheetBtn');
        const addFromSheetBtn = $('addFromSheetBtn');
        const itemSheetMinus = $('itemSheetMinus');
        const itemSheetPlus = $('itemSheetPlus');
        const backToMenuBtn = $('backToMenuBtn');
        const orderMoreBtn = $('orderMoreBtn');
        const cartBackBtn = $('cartBackBtn');
        const viewCartBtn = $('viewCartBtn');

        // =============================================================
        // CORE NAVIGATION
        // =============================================================
        const pageRegistry = {
            landing: { el: pageLanding, display: 'flex' },
            menu: { el: pageMenu, display: 'block' },
            cart: { el: pageCart, display: 'block' },
            tracker: { el: pageTracker, display: 'block' },
            success: { el: pageSuccess, display: 'flex' }
        };

        function showPage(page) {
            const target = pageRegistry[page];
            if (!target) return;

            Object.values(pageRegistry).forEach(({ el }) => {
                if (el !== target.el) {
                    el.classList.remove('page-visible');
                    el.style.display = 'none';
                }
            });

            target.el.style.display = target.display;
            // Force a reflow so the browser registers the pre-transition state
            // before the class flip, otherwise the fade/slide-in never plays.
            void target.el.offsetHeight;
            requestAnimationFrame(() => target.el.classList.add('page-visible'));

            if (page === 'menu') {
                renderCategories();
                renderMenu();
                updateCartUI();
                showPreparingToast(currentOrder ? currentOrder.items : []);
            } else if (page === 'cart') {
                renderCartPage();
            }
        }

        function simulateQRScan() {
            showPage('menu');
        }

        function goBackToMenu() {
            if (trackInterval) {
                clearInterval(trackInterval);
                trackInterval = null;
            }
            showPage('menu');
        }

        function goToCartPage() {
            if (cart.length === 0) return;
            showPage('cart');
        }

        // =============================================================
        // CATEGORY SIDEBAR
        // =============================================================
        function renderCategories() {
            categorySidebar.innerHTML = categories.map(cat => `
                    <div class="cat-item ${cat === selectedCategory ? 'active' : ''}" data-cat="${cat}">
                        <img src="${getCategoryImage(cat)}" alt="${cat}" class="cat-img" onerror="this.onerror=null; this.src='${getCategoryFallbackImage(cat)}';" />
                        <span>${cat}</span>
                    </div>
                `).join('');

            categorySidebar.querySelectorAll('.cat-item').forEach(el => {
                el.addEventListener('click', function() {
                    selectedCategory = this.dataset.cat;
                    renderCategories();
                    renderMenu();
                });
            });
        }

        // =============================================================
        // MENU GRID
        // =============================================================
        function renderMenu() {
            const query = searchInput.value.toLowerCase().trim();
            let filtered = menuItems;
            if (selectedCategory !== 'All') {
                filtered = filtered.filter(item => item.category === selectedCategory);
            }
            if (query) {
                filtered = filtered.filter(item =>
                    item.name.toLowerCase().includes(query) ||
                    item.desc.toLowerCase().includes(query)
                );
            }
            if (filtered.length === 0) {
                menuGrid.innerHTML =
                    `<div class="col-span-2 text-center py-12 text-[#888]"><i class="fas fa-search text-4xl text-[#ddd] block mb-3"></i><p class="font-medium">No items found</p></div>`;
                return;
            }
            menuGrid.innerHTML = filtered.map(item => {
                const inCart = cart.find(c => c.id === item.id);
                const qty = inCart ? inCart.qty : 0;
                const imgUrl = getLocalImagePath(item);
                const qtyControlHtml = qty > 0 ? `
                    <div class="qty-stepper" data-id="${item.id}">
                        <button class="qty-step-btn qty-step-minus" data-id="${item.id}">−</button>
                        <span class="qty-step-value">${qty}</span>
                        <button class="qty-step-btn qty-step-plus" data-id="${item.id}">+</button>
                    </div>
                ` : `
                    <button class="add-btn" data-id="${item.id}">+</button>
                `;
                return `
                    <div class="product-card fade-in" data-id="${item.id}">
                        <div class="img-wrap">
                            <img src="${imgUrl}" alt="${item.name}" loading="lazy" onerror="if (this.src.indexOf('unsplash.com') === -1) { this.src = getDishFallbackImage('${item.name}'); } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }" />
                            <div class="fallback-emoji" style="display:none;">${item.emoji}</div>
                        </div>
                        <div class="info">
                            <div class="name">${item.name}</div>
                            <div class="price-row">
                                <span class="price">₹${item.price}</span>
                                ${qtyControlHtml}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            menuGrid.querySelectorAll('.product-card').forEach(card => {
                card.addEventListener('click', function(e) {
                    if (e.target.closest('.add-btn') || e.target.closest('.qty-stepper')) return;
                    const id = parseInt(this.dataset.id);
                    openItemSheet(id);
                });
            });

            menuGrid.querySelectorAll('.add-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const id = parseInt(this.dataset.id);
                    addToCart(id);
                });
            });

            menuGrid.querySelectorAll('.qty-step-plus').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const id = parseInt(this.dataset.id);
                    addToCart(id);
                });
            });

            menuGrid.querySelectorAll('.qty-step-minus').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const id = parseInt(this.dataset.id);
                    removeFromCart(id);
                });
            });
        }

        function filterItems() { renderMenu(); }

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const clearBtn = document.getElementById('searchClearBtn');
                if (clearBtn) clearBtn.classList.toggle('hidden', !this.value.trim());
                filterItems();
            });
        }
        window.clearSearchInput = function() {
            if (searchInput) {
                searchInput.value = '';
                const clearBtn = document.getElementById('searchClearBtn');
                if (clearBtn) clearBtn.classList.add('hidden');
                filterItems();
            }
        };

        // =============================================================
        // ITEM SHEET
        // =============================================================
        function openItemSheet(id) {
            const item = menuItems.find(i => i.id === id);
            if (!item) return;
            itemSheetItemId = id;
            itemSheetQtyVal = 1;
            const inCart = cart.find(c => c.id === id);
            if (inCart) itemSheetQtyVal = inCart.qty;

            itemSheetName.textContent = item.name;
            itemSheetDesc.textContent = item.desc;
            itemSheetPrice.textContent = '₹' + item.price;
            itemSheetQty.textContent = itemSheetQtyVal;
            const imgUrl = getLocalImagePath(item);
            itemSheetImg.src = imgUrl;
            itemSheetImg.onerror = function() {
                if (this.src.indexOf('unsplash.com') === -1) {
                    this.src = getDishFallbackImage(item.name);
                } else {
                    this.style.display = 'none';
                    this.nextElementSibling.style.display = 'flex';
                }
            };
            itemSheetImg.style.display = 'block';
            itemSheetImg.nextElementSibling.style.display = 'none';

            itemSheet.classList.add('open');
            overlay.classList.add('show');
        }

        function closeItemSheet() {
            itemSheet.classList.remove('open');
            overlay.classList.remove('show');
        }

        function updateSheetQty(delta) {
            itemSheetQtyVal = Math.max(1, itemSheetQtyVal + delta);
            itemSheetQty.textContent = itemSheetQtyVal;
        }

        function addFromItemSheet() {
            const item = menuItems.find(i => i.id === itemSheetItemId);
            if (!item) return;
            const existing = cart.find(c => c.id === itemSheetItemId);
            if (existing) {
                existing.qty += itemSheetQtyVal;
            } else {
                cart.push({ ...item, qty: itemSheetQtyVal });
            }
            closeItemSheet();
            updateCartUI();
        }

        closeItemBtn.addEventListener('click', closeItemSheet);
        itemSheetMinus.addEventListener('click', () => updateSheetQty(-1));
        itemSheetPlus.addEventListener('click', () => updateSheetQty(1));
        addFromSheetBtn.addEventListener('click', addFromItemSheet);

        // =============================================================
        // CART LOGIC
        // =============================================================
        function addToCart(id) {
            const item = menuItems.find(i => i.id === id);
            if (!item) return;
            const existing = cart.find(c => c.id === id);
            if (existing) {
                existing.qty += 1;
            } else {
                cart.push({ ...item, qty: 1 });
            }
            updateCartUI();

            const btn = menuGrid.querySelector(`.add-btn[data-id="${id}"]`);
            if (btn) {
                btn.style.transform = 'scale(1.4)';
                setTimeout(() => {
                    btn.style.transform = 'scale(1)';
                    renderMenu();
                }, 300);
            }
        }

        function removeFromCart(id) {
            const item = cart.find(c => c.id === id);
            if (!item) return;
            item.qty -= 1;
            if (item.qty <= 0) {
                cart = cart.filter(c => c.id !== id);
            }
            updateCartUI();
        }

        function updateCartUI() {
            const count = cart.reduce((sum, i) => sum + i.qty, 0);
            const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

            if (count > 0) {
                cartBar.style.display = 'flex';
                cartBarBadge.textContent = count;
                cartBarItems.textContent = count + ' items';
                cartBarTotal.textContent = total;
            } else {
                cartBar.style.display = 'none';
            }

            renderMenu();
        }

        // =============================================================
        // CART PAGE
        // =============================================================
        function renderCartPage() {
            const count = cart.reduce((sum, i) => sum + i.qty, 0);
            cartItemCount.textContent = count + ' items';

            if (cart.length === 0) {
                cartContent.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-shopping-bag"></i>
                            <h3>Your cart is empty</h3>
                            <p>Start adding delicious items!</p>
                            <button class="btn-browse" onclick="goBackToMenu()"><i class="fas fa-utensils mr-2"></i> Browse Menu</button>
                        </div>
                    `;
                return;
            }

            const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

            let itemsHtml = cart.map(item => {
                const imgUrl = getLocalImagePath(item);
                return `
                    <div class="cart-item-card fade-in">
                        <div class="cart-item-img-wrap">
                            <img src="${imgUrl}" onerror="if (this.src.indexOf('unsplash.com') === -1) { this.src = getDishFallbackImage('${item.name.replace(/'/g, "\\'")}'); } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }" />
                            <div class="fallback-emoji" style="display:none;">${item.emoji}</div>
                        </div>
                        <div class="item-info">
                            <div class="name">${item.name}</div>
                            <div class="meta">₹${item.price}</div>
                        </div>
                        <div class="item-right">
                            <div class="qty-ctrl-premium">
                                <button class="cart-minus" data-id="${item.id}">−</button>
                                <span class="qty-num">${item.qty}</span>
                                <button class="cart-plus" data-id="${item.id}">+</button>
                            </div>
                            <span class="item-price">₹${item.price * item.qty}</span>
                        </div>
                    </div>
                `;
            }).join('');

            cartContent.innerHTML = `
                    ${itemsHtml}
                    <div class="cart-summary">
                        <div class="row"><span>Subtotal</span><span>₹${total}</span></div>
                        <div class="row"><span>Tax (5%)</span><span>₹${Math.round(total * 0.05)}</span></div>
                        <div class="row total"><span>Total</span><span class="amount">₹${Math.round(total * 1.05)}</span></div>
                    </div>
                    <div class="cart-actions">
                        <button class="btn-add-more" id="addMoreBtn"><i class="fas fa-plus mr-1"></i> Add More</button>
                        <button class="btn-place-order" id="placeOrderBtn"><i class="fas fa-bolt mr-1"></i> Place Order</button>
                    </div>
                `;

            cartContent.querySelectorAll('.cart-minus').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = parseInt(this.dataset.id);
                    removeFromCart(id);
                    renderCartPage();
                    updateCartUI();
                });
            });
            cartContent.querySelectorAll('.cart-plus').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = parseInt(this.dataset.id);
                    addToCart(id);
                    renderCartPage();
                    updateCartUI();
                });
            });

            const addMoreBtn = $('addMoreBtn');
            if (addMoreBtn) addMoreBtn.addEventListener('click', goBackToMenu);

            const placeBtn = $('placeOrderBtn');
            if (placeBtn) placeBtn.addEventListener('click', placeOrder);
        }

        // =============================================================
        // CART NAVIGATION
        // =============================================================
        cartBackBtn.addEventListener('click', goBackToMenu);
        viewCartBtn.addEventListener('click', goToCartPage);
        document.querySelector('.cart-status')?.addEventListener('click', goToCartPage);

        // =============================================================
        // PLACE ORDER (Connected to Shared FlameDineStore)
        // =============================================================
        function placeOrder() {
            if (cart.length === 0) return;
            
            const res = window.FlameDineStore.placeOrder({ tableNumber: 5, cartItems: cart });
            const orderId = res.order.orderCode;
            const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

            markOrderPlacedThisSession();
            currentOrder = {
                id: orderId,
                items: res.newItems,
                total: total
            };

            cart = [];
            updateCartUI();

            // Populate success page detail fields
            successOrderId.textContent = '#' + orderId;
            successTable.textContent = 'Table 5';
            successTotal.textContent = '₹' + Math.round(total * 1.11);
            successEstTime.textContent = '10-15 mins';

            // Initialize tracker with live store data
            renderTracker(orderId, total);

            // Navigate to success page, then auto-forward to the live tracker
            showPage('success');
            clearAutoTrackTimer();
            autoTrackTimer = setTimeout(() => {
                showPage('tracker');
            }, 2000);
        }

        function clearAutoTrackTimer() {
            if (autoTrackTimer) {
                clearTimeout(autoTrackTimer);
                autoTrackTimer = null;
            }
        }

        // =============================================================
        // PREPARING TOAST (with avatars)
        // =============================================================
        function shuffled(arr) {
            const copy = [...arr];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        }

        function showPreparingToast(items) {
            const counts = { placed: 0, claimed: 0, preparing: 0, ready: 0, served: 0 };
            items.forEach(item => {
                if (counts.hasOwnProperty(item.status)) counts[item.status]++;
            });

            const prepCountVal = counts.placed + counts.claimed + counts.preparing;
            const readyCountVal = counts.ready;
            const totalActive = prepCountVal + readyCountVal;

            const toast = $('preparingToast');
            if (!toast) return;

            if (totalActive > 0) {
                toast.style.display = 'flex';

                const prepCountEl = $('prepCount');
                const orderAvatarsEl = $('orderAvatars');
                const prepSectionEl = $('prepSection');
                const readySectionEl = $('readySection');

                if (prepCountEl) prepCountEl.textContent = prepCountVal;

                // Opacities & Classes for premium UI feel
                if (prepCountVal > 0) {
                    prepSectionEl.style.opacity = '1';
                    const fireIcon = prepSectionEl.querySelector('.fire-icon');
                    if (fireIcon) {
                        fireIcon.style.animation = 'flamePulse 1.2s infinite alternate';
                        fireIcon.style.borderColor = 'rgba(255, 85, 0, 0.4)';
                    }
                } else {
                    prepSectionEl.style.opacity = '0.35';
                    const fireIcon = prepSectionEl.querySelector('.fire-icon');
                    if (fireIcon) {
                        fireIcon.style.animation = 'none';
                        fireIcon.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }
                }

                if (readyCountVal > 0) {
                    readySectionEl.style.opacity = '1';
                    readySectionEl.classList.add('pulse-green-glow');
                } else {
                    readySectionEl.style.opacity = '0.35';
                    readySectionEl.classList.remove('pulse-green-glow');
                }

                // Show up to 3 random dish images for ready items; beyond that, a "N+" badge
                const readyItemsForAvatars = items.filter(it => it.status === 'ready');
                const maxShow = 3;
                const shownItems = shuffled(readyItemsForAvatars).slice(0, maxShow);

                let avatarHtml = shownItems.map(item => {
                    const imgUrl = getLocalImagePath(item);
                    return `
                        <div class="avatar">
                            <img src="${imgUrl}" onerror="if(this.src.indexOf('unsplash.com') === -1) { this.src = getDishFallbackImage('${item.name}'); } else { this.style.display='none'; this.nextElementSibling.style.display='block'; }" />
                            <span class="avatar-emoji" style="display:none;">${item.emoji}</span>
                        </div>
                    `;
                }).join('');
                if (readyItemsForAvatars.length > maxShow) {
                    avatarHtml += `<div class="avatar more">${readyItemsForAvatars.length}+</div>`;
                }
                if (orderAvatarsEl) {
                    orderAvatarsEl.innerHTML = avatarHtml;
                }

            } else {
                toast.style.display = 'none';
            }
            updateHeaderOrderTracker();
        }

        function updateHeaderOrderTracker() {
            if (!currentOrder) {
                headerOrderTracker.style.display = 'none';
                return;
            }
            headerOrderTracker.style.display = 'flex';
            headerOrderTracker.className = 'header-tracker-btn';
            headerOrderTracker.innerHTML = `<span class="btn-label">Orders</span>`;
        }



        // =============================================================
        // ORDER TRACKER
        // =============================================================
        const itemStatusMeta = {
            placed: { label: 'Placed', className: 'status-placed' },
            claimed: { label: 'Claimed', className: 'status-claimed' },
            preparing: { label: 'Preparing', className: 'status-preparing' },
            ready: { label: 'Ready', className: 'status-ready' },
            served: { label: 'Served', className: 'status-served' },
            cancelled: { label: 'Cancelled', className: 'status-cancelled' }
        };

        window.cancelCustomerItem = function(itemId, itemName) {
            if (confirm(`Are you sure you want to cancel "${itemName}"?`)) {
                const res = window.FlameDineStore.updateOrderItemStatus(itemId, 'cancelled');
                if (res.success) {
                    const session = window.FlameDineStore.getOpenSessionForTable(5);
                    if (session) {
                        const order = window.FlameDineStore.getOrderForSession(session.id);
                        const items = window.FlameDineStore.getOrderItemsForSession(session.id);
                        const activeTotal = items.reduce((s, i) => i.status !== 'cancelled' ? s + i.price * i.qty : s, 0);
                        currentOrder = { id: order ? order.orderCode : 'FL-1042', items, total: activeTotal };
                        renderTracker(currentOrder.id, currentOrder.total);
                    }
                } else {
                    alert(res.message || 'Cannot cancel item at this stage.');
                }
            }
        };

        function renderTracker(orderId, total) {
            const trackTotal = $('trackTotal');
            const trackItems = $('trackItems');

            const activeItems = (currentOrder?.items || []).filter(i => i.status !== 'cancelled');
            const calculatedTotal = activeItems.reduce((sum, item) => sum + item.price * item.qty, 0);
            trackTotal.textContent = calculatedTotal;

            const sortedItems = [...(currentOrder?.items || [])].sort((a, b) => {
                const order = { placed: 0, claimed: 1, preparing: 2, ready: 3, served: 4, cancelled: 5 };
                return (order[a.status] || 0) - (order[b.status] || 0);
            });

            trackItems.innerHTML = sortedItems.map(item => {
                const imgUrl = getLocalImagePath(item);
                const meta = itemStatusMeta[item.status] || itemStatusMeta.placed;
                const isCancellable = item.status === 'placed' || item.status === 'claimed';
                const isCancelled = item.status === 'cancelled';

                const cancelBtnHtml = isCancellable ? `
                    <button onclick="window.cancelCustomerItem('${item.id}', '${item.name.replace(/'/g, "\\'")}')" class="text-[11px] font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded transition ml-1.5" title="Cancel before preparation starts">
                        <i class="fas fa-times mr-1"></i>Cancel
                    </button>
                ` : '';

                return `
                    <div class="flex justify-between items-center py-2.5 border-b border-[#f0edeb] last:border-0 ${isCancelled ? 'opacity-60' : ''}">
                        <div class="flex items-center gap-3">
                            <div class="tracker-summary-img-wrap">
                                <img src="${imgUrl}" onerror="if (this.src.indexOf('unsplash.com') === -1) { this.src = getDishFallbackImage('${item.name.replace(/'/g, "\\'")}'); } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }" />
                                <div class="fallback-emoji" style="display:none;">${item.emoji}</div>
                            </div>
                            <div>
                                <span class="font-medium block ${isCancelled ? 'line-through text-zinc-400' : ''}" style="color:${isCancelled ? '#999' : '#1A1A1A'};">${item.name} × ${item.qty}</span>
                                <div class="flex items-center gap-1 mt-0.5">
                                    <span class="item-status-badge ${meta.className}">${meta.label}</span>
                                    ${cancelBtnHtml}
                                </div>
                            </div>
                        </div>
                        <span class="font-bold ${isCancelled ? 'line-through text-zinc-400' : ''}" style="color:${isCancelled ? '#999' : '#1A1A1A'};">₹${item.price * item.qty}</span>
                    </div>
                `;
            }).join('');

            // Simulate status changes
            if (trackInterval) clearInterval(trackInterval);
            const statuses = ['placed', 'claimed', 'preparing', 'ready', 'served'];
            trackInterval = setInterval(() => {
                let changed = false;
                currentOrder.items.forEach((item) => {
                    if (item.status !== 'served') {
                        const currentIdx = statuses.indexOf(item.status);
                        if (currentIdx < statuses.length - 1) {
                            item.status = statuses[currentIdx + 1];
                            changed = true;
                        }
                    }
                });
                if (changed) {
                    renderTracker(orderId, total);
                    showPreparingToast(currentOrder.items);
                    const counts = { placed: 0, claimed: 0, preparing: 0, ready: 0, served: 0 };
                    currentOrder.items.forEach(it => {
                        if (counts.hasOwnProperty(it.status)) counts[it.status]++;
                    });
                    const totalActive = counts.placed + counts.claimed + counts.preparing + counts.ready;
                    if (totalActive === 0) {
                        clearInterval(trackInterval);
                        trackInterval = null;
                    }
                    updateHeaderOrderTracker();
                }
            }, 3000);
        }

        // =============================================================
        // BACK TO MENU FROM TRACKER
        // =============================================================
        backToMenuBtn.addEventListener('click', goBackToMenu);
        orderMoreBtn.addEventListener('click', goBackToMenu);

        // =============================================================
        // OVERLAY CLOSE
        // =============================================================
        overlay.addEventListener('click', function() {
            closeItemSheet();
        });

        // =============================================================
        // SCAN BUTTON
        // =============================================================
        scanBtn.addEventListener('click', simulateQRScan);
        qrScanArea.addEventListener('click', simulateQRScan);

        // =============================================================
        // SEARCH
        // =============================================================
        searchInput.addEventListener('input', filterItems);

        function goToOrderTracker() {
            const session = hasPlacedOrderThisSession() ? window.FlameDineStore.getOpenSessionForTable(5) : null;
            if (session) {
                const order = window.FlameDineStore.getOrderForSession(session.id);
                const items = window.FlameDineStore.getOrderItemsForSession(session.id);
                currentOrder = { id: order ? order.orderCode : 'FL-1042', items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
                showPage('tracker');
                renderTracker(currentOrder.id, currentOrder.total);
            } else {
                const notification = document.createElement('div');
                notification.className = 'order-success-widget show';
                notification.style.borderColor = 'rgba(255, 85, 0, 0.4)';
                notification.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(255, 85, 0, 0.15)';
                notification.innerHTML = `
                    <div class="success-icon" style="color: #ff5500;"><i class="fas fa-exclamation-circle"></i></div>
                    <div class="success-details">
                        <div class="success-title">No Active Orders</div>
                        <div class="success-meta">Add dishes to cart to place one!</div>
                    </div>
                `;
                document.body.appendChild(notification);
                setTimeout(() => {
                    notification.classList.remove('show');
                    setTimeout(() => notification.remove(), 500);
                }, 2500);
            }
        }
        headerOrderTracker.addEventListener('click', goToOrderTracker);
        if (preparingToastEl) preparingToastEl.addEventListener('click', goToOrderTracker);

        successTrackBtn.addEventListener('click', () => {
            clearAutoTrackTimer();
            const session = window.FlameDineStore.getOpenSessionForTable(5);
            if (session) {
                const order = window.FlameDineStore.getOrderForSession(session.id);
                const items = window.FlameDineStore.getOrderItemsForSession(session.id);
                currentOrder = { id: order ? order.orderCode : 'FL-1042', items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
            }
            showPage('tracker');
        });
        successBackMenuBtn.addEventListener('click', () => {
            clearAutoTrackTimer();
            showPage('menu');
        });

        // =============================================================
        // REAL-TIME STORE SUBSCRIPTION
        // =============================================================
        window.FlameDineStore.subscribe(event => {
            if (!hasPlacedOrderThisSession()) return;
            const session = window.FlameDineStore.getOpenSessionForTable(5);
            if (session) {
                const order = window.FlameDineStore.getOrderForSession(session.id);
                const items = window.FlameDineStore.getOrderItemsForSession(session.id);
                currentOrder = { id: order ? order.orderCode : 'FL-1042', items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
                showPreparingToast(items);
                if (pageTracker.style.display === 'block') {
                    renderTracker(currentOrder.id, currentOrder.total);
                }
            } else {
                currentOrder = null;
                updateHeaderOrderTracker();
            }
        });

        // =============================================================
        // INIT
        // =============================================================
        if (hasPlacedOrderThisSession()) {
            const initialSession = window.FlameDineStore.getOpenSessionForTable(5);
            if (initialSession) {
                const order = window.FlameDineStore.getOrderForSession(initialSession.id);
                const items = window.FlameDineStore.getOrderItemsForSession(initialSession.id);
                currentOrder = { id: order ? order.orderCode : 'FL-1042', items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
            }
        }
        updateHeaderOrderTracker();
        showPage('landing');

        // Hold the boot loader for a minimum beat so it reads as a real
        // loading step rather than a flash, then fade it out.
        const pageLoader = $('pageLoader');
        if (pageLoader) {
            setTimeout(() => {
                pageLoader.classList.add('loader-hidden');
            }, 600);
        }

        window.goBackToMenu = goBackToMenu;
