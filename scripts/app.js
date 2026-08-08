

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
        let itemSheetItemId = null;
        let itemSheetQtyVal = 1;

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
        const itemNote = $('itemNote');
        const headerOrderTracker = $('headerOrderTracker');
        const themeToggleBtn = $('themeToggleBtn');

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
                                <button class="add-btn ${qty > 0 ? 'has-qty' : ''}" data-id="${item.id}">
                                    ${qty > 0 ? qty : '+'}
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            menuGrid.querySelectorAll('.product-card').forEach(card => {
                card.addEventListener('click', function(e) {
                    if (e.target.closest('.add-btn')) return;
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
        }

        function filterItems() { renderMenu(); }

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
            itemNote.value = '';
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
                const note = itemNote.value || '';
                cart.push({ ...item, qty: itemSheetQtyVal, note: note });
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
                cart.push({ ...item, qty: 1, note: '' });
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
                            <div class="meta">₹${item.price} <span class="note">${item.note ? '· ' + item.note : ''}</span></div>
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

            // Navigate to success page
            showPage('success');
        }

        // =============================================================
        // PREPARING TOAST (with avatars)
        // =============================================================
        function showPreparingToast(items) {
            const counts = { placed: 0, preparing: 0, ready: 0, served: 0 };
            items.forEach(item => {
                if (counts.hasOwnProperty(item.status)) counts[item.status]++;
            });

            const prepCountVal = counts.placed + counts.preparing;
            const readyCountVal = counts.ready;
            const totalActive = prepCountVal + readyCountVal;

            const toast = $('preparingToast');
            if (!toast) return;

            if (prepCountVal > 0) {
                toast.style.display = 'flex';
                
                // Update text counts
                const prepCountEl = $('prepCount');
                const readyCountEl = $('readyCount');
                const orderAvatarsEl = $('orderAvatars');
                const prepSectionEl = $('prepSection');
                const readySectionEl = $('readySection');

                if (prepCountEl) prepCountEl.textContent = prepCountVal;
                if (readyCountEl) readyCountEl.textContent = readyCountVal;

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

                // Generate avatars for preparing dishes
                const preparingItems = items.filter(it => it.status === 'placed' || it.status === 'preparing');
                let avatarHtml = '';
                const maxShow = 3;
                const showCount = Math.min(preparingItems.length, maxShow);
                
                for (let i = 0; i < showCount; i++) {
                    const item = preparingItems[i];
                    const imgUrl = getLocalImagePath(item);
                    avatarHtml += `
                        <div class="avatar">
                            <img src="${imgUrl}" onerror="if(this.src.indexOf('unsplash.com') === -1) { this.src = getDishFallbackImage('${item.name}'); } else { this.style.display='none'; this.nextElementSibling.style.display='block'; }" />
                            <span class="avatar-emoji" style="display:none;">${item.emoji}</span>
                        </div>
                    `;
                }
                if (preparingItems.length > maxShow) {
                    avatarHtml += `<div class="avatar more">+${preparingItems.length - maxShow}</div>`;
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
            headerOrderTracker.style.display = 'flex'; // Permanent!
            if (!currentOrder) {
                headerOrderTracker.className = 'header-tracker-btn no-active-order';
                headerOrderTracker.innerHTML = `<i class="fas fa-receipt text-sm mr-1 text-[#666]"></i> No orders`;
                return;
            }
            const items = currentOrder.items;
            const counts = { placed: 0, preparing: 0, ready: 0, served: 0 };
            items.forEach(item => {
                if (counts.hasOwnProperty(item.status)) counts[item.status]++;
            });
            const totalActive = counts.placed + counts.preparing + counts.ready;
            
            if (totalActive > 0) {
                if (counts.preparing > 0) {
                    headerOrderTracker.className = 'header-tracker-btn border-blazing-fire';
                    headerOrderTracker.innerHTML = `<i class="fas fa-fire text-sm mr-1"></i> ${counts.preparing} preparing`;
                } else if (counts.ready > 0) {
                    headerOrderTracker.className = 'header-tracker-btn border-glowing-green';
                    headerOrderTracker.innerHTML = `<i class="fas fa-check-circle text-sm mr-1"></i> ${counts.ready} ready!`;
                } else {
                    headerOrderTracker.className = 'header-tracker-btn border-glowing-blue';
                    headerOrderTracker.innerHTML = `<i class="fas fa-receipt text-sm mr-1 text-[#00bcd4]"></i> Placed`;
                }
            } else {
                headerOrderTracker.className = 'header-tracker-btn';
                headerOrderTracker.innerHTML = `<i class="fas fa-receipt text-sm mr-1 text-[#aaa]"></i> Order served`;
            }
        }



        // =============================================================
        // ORDER TRACKER
        // =============================================================
        function renderTracker(orderId, total) {
            const trackOrderId = $('trackOrderId');
            const trackTotal = $('trackTotal');
            const trackDishStatus = $('trackDishStatus');
            const trackItems = $('trackItems');

            trackOrderId.textContent = orderId;
            trackTotal.textContent = total;

            const sortedItems = [...currentOrder.items].sort((a, b) => {
                const order = { placed: 0, preparing: 1, ready: 2, served: 3 };
                return (order[a.status] || 0) - (order[b.status] || 0);
            });

            trackDishStatus.innerHTML = sortedItems.map(item => {
                const statusClass = item.status;
                const imgUrl = getLocalImagePath(item);
                return `
                        <div class="dish-status-item">
                            <div class="status-item-left">
                                <div class="tracker-item-img-wrap">
                                    <img src="${imgUrl}" onerror="if (this.src.indexOf('unsplash.com') === -1) { this.src = getDishFallbackImage('${item.name.replace(/'/g, "\\'")}'); } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }" />
                                    <div class="fallback-emoji" style="display:none;">${item.emoji}</div>
                                </div>
                                <span class="dish-name">${item.name} × ${item.qty}</span>
                            </div>
                            <span class="dish-status ${statusClass}">${statusClass.charAt(0).toUpperCase() + statusClass.slice(1)}</span>
                        </div>
                    `;
            }).join('');

            trackItems.innerHTML = sortedItems.map(item => {
                const imgUrl = getLocalImagePath(item);
                return `
                    <div class="flex justify-between items-center py-2 border-b border-[#222] last:border-0">
                        <div class="flex items-center gap-3">
                            <div class="tracker-summary-img-wrap">
                                <img src="${imgUrl}" onerror="if (this.src.indexOf('unsplash.com') === -1) { this.src = getDishFallbackImage('${item.name.replace(/'/g, "\\'")}'); } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }" />
                                <div class="fallback-emoji" style="display:none;">${item.emoji}</div>
                            </div>
                            <span class="font-medium text-white">${item.name} × ${item.qty}</span>
                        </div>
                        <span class="font-bold text-white">₹${item.price * item.qty}</span>
                    </div>
                `;
            }).join('');

            const counts = { placed: 0, preparing: 0, ready: 0, served: 0 };
            currentOrder.items.forEach(item => {
                if (counts.hasOwnProperty(item.status)) counts[item.status]++;
            });
            updateTrackerStepper(counts);

            // Simulate status changes
            if (trackInterval) clearInterval(trackInterval);
            const statuses = ['placed', 'preparing', 'ready', 'served'];
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
                    const counts = { placed: 0, preparing: 0, ready: 0, served: 0 };
                    currentOrder.items.forEach(it => {
                        if (counts.hasOwnProperty(it.status)) counts[it.status]++;
                    });
                    const totalActive = counts.placed + counts.preparing + counts.ready;
                    if (totalActive === 0) {
                        clearInterval(trackInterval);
                        trackInterval = null;
                    }
                    updateHeaderOrderTracker();
                }
            }, 3000);
        }

        function updateTrackerStepper(counts) {
            const stepPlaced = $('stepPlaced');
            const stepPreparing = $('stepPreparing');
            const stepReady = $('stepReady');
            const stepServed = $('stepServed');
            const linePlaced = $('linePlaced');
            const linePreparing = $('linePreparing');
            const lineReady = $('lineReady');
            const trackerGeneralBadge = $('trackerGeneralBadge');

            // Reset classes
            [stepPlaced, stepPreparing, stepReady, stepServed].forEach(el => {
                if (el) el.className = 'step';
            });
            if (stepReady) stepReady.classList.add('ready-step');
            if (stepServed) stepServed.classList.add('served-step');
            [linePlaced, linePreparing, lineReady].forEach(el => {
                if (el) el.className = 'step-line';
            });

            if (counts.served === currentOrder.items.length) {
                [stepPlaced, stepPreparing, stepReady, stepServed].forEach(el => el && el.classList.add('active'));
                [linePlaced, linePreparing, lineReady].forEach(el => el && el.classList.add('active', 'ready-line'));
                if (trackerGeneralBadge) {
                    trackerGeneralBadge.textContent = 'Served';
                    trackerGeneralBadge.className = 'status-badge-tracker served';
                }
            } else if (counts.ready > 0 && counts.preparing === 0 && counts.placed === 0) {
                [stepPlaced, stepPreparing, stepReady].forEach(el => el && el.classList.add('active'));
                [linePlaced, linePreparing].forEach(el => el && el.classList.add('active', 'ready-line'));
                if (trackerGeneralBadge) {
                    trackerGeneralBadge.textContent = 'Ready!';
                    trackerGeneralBadge.className = 'status-badge-tracker ready';
                }
            } else if (counts.preparing > 0 || counts.placed > 0) {
                if (stepPlaced) stepPlaced.classList.add('active');
                if (stepPreparing) stepPreparing.classList.add('active');
                if (linePlaced) linePlaced.classList.add('active');
                if (trackerGeneralBadge) {
                    trackerGeneralBadge.textContent = 'Preparing';
                    trackerGeneralBadge.className = 'status-badge-tracker preparing';
                }
            } else {
                if (stepPlaced) stepPlaced.classList.add('active');
                if (trackerGeneralBadge) {
                    trackerGeneralBadge.textContent = 'Placed';
                    trackerGeneralBadge.className = 'status-badge-tracker placed';
                }
            }
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

        // Call Waiter Handler
        const callWaiterBtn = $('callWaiterBtn');
        if (callWaiterBtn) {
            callWaiterBtn.addEventListener('click', () => {
                window.FlameDineStore.callWaiter(5);
                const notification = document.createElement('div');
                notification.className = 'order-success-widget show';
                notification.style.borderColor = 'rgba(234, 179, 8, 0.4)';
                notification.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5)';
                notification.innerHTML = `
                    <div class="success-icon" style="color: #eab308;"><i class="fas fa-hand-paper"></i></div>
                    <div class="success-details">
                        <div class="success-title">Waiter Called!</div>
                        <div class="success-meta">A server has been notified to visit Table 5.</div>
                    </div>
                `;
                document.body.appendChild(notification);
                setTimeout(() => {
                    notification.classList.remove('show');
                    setTimeout(() => notification.remove(), 500);
                }, 3000);
            });
        }

        headerOrderTracker.addEventListener('click', () => {
            const session = window.FlameDineStore.getOpenSessionForTable(5);
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
        });

        successTrackBtn.addEventListener('click', () => {
            const session = window.FlameDineStore.getOpenSessionForTable(5);
            if (session) {
                const order = window.FlameDineStore.getOrderForSession(session.id);
                const items = window.FlameDineStore.getOrderItemsForSession(session.id);
                currentOrder = { id: order ? order.orderCode : 'FL-1042', items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
            }
            showPage('tracker');
        });
        successBackMenuBtn.addEventListener('click', () => {
            showPage('menu');
        });

        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            themeToggleBtn.innerHTML = isLight ? `<i class="fas fa-moon"></i>` : `<i class="fas fa-sun"></i>`;
        });

        // =============================================================
        // REAL-TIME STORE SUBSCRIPTION
        // =============================================================
        window.FlameDineStore.subscribe(event => {
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
        const initialSession = window.FlameDineStore.getOpenSessionForTable(5);
        if (initialSession) {
            const order = window.FlameDineStore.getOrderForSession(initialSession.id);
            const items = window.FlameDineStore.getOrderItemsForSession(initialSession.id);
            currentOrder = { id: order ? order.orderCode : 'FL-1042', items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
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
