

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
        const successOrderId = $('successOrderId');
        const preparingFloating = $('preparingFloating');
        const headerOrderTracker = $('headerOrderTracker');

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
        const trackFromSuccessBtn = $('trackFromSuccessBtn');
        const orderMoreFromSuccessBtn = $('orderMoreFromSuccessBtn');

        // =============================================================
        // CORE NAVIGATION
        // =============================================================
        function showPage(page) {
            pageLanding.style.display = 'none';
            pageMenu.style.display = 'none';
            pageCart.style.display = 'none';
            pageTracker.style.display = 'none';
            pageSuccess.classList.remove('show');

            if (page === 'landing') {
                pageLanding.style.display = 'flex';
            } else if (page === 'menu') {
                pageMenu.style.display = 'block';
                renderCategories();
                renderMenu();
                updateCartUI();
            } else if (page === 'cart') {
                pageCart.style.display = 'block';
                renderCartPage();
            } else if (page === 'tracker') {
                pageTracker.style.display = 'block';
            } else if (page === 'success') {
                pageSuccess.classList.add('show');
                pageSuccess.style.display = 'flex';
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
            preparingFloating.classList.remove('show');
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
                this.style.display = 'none';
                this.nextElementSibling.style.display = 'flex';
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

            let itemsHtml = cart.map(item => `
                    <div class="cart-item-card fade-in">
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
                `).join('');

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
        // PLACE ORDER
        // =============================================================
        function placeOrder() {
            if (cart.length === 0) return;
            const orderId = 'FL-' + String(1000 + Math.floor(Math.random() * 9000));
            const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

            const orderItems = cart.map((item, idx) => {
                let status = 'placed';
                if (idx % 3 === 1) status = 'preparing';
                else if (idx % 3 === 2) status = 'ready';
                return { ...item, status };
            });

            currentOrder = { id: orderId, items: orderItems, total: total };

            cart = [];
            updateCartUI();

            successOrderId.textContent = orderId;
            showPage('success');

            // Show preparing floating toast with avatars
            showPreparingToast(orderItems);
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

            if (totalActive > 0) {
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

                // Update bottom floating bar
                preparingFloating.innerHTML = `
                    <span class="fire-icon"><i class="fas fa-fire"></i></span>
                    <span><span class="highlight">${prepCountVal}</span> preparing • <span class="highlight-green">${readyCountVal}</span> ready</span>
                `;
                preparingFloating.classList.add('show');
            } else {
                toast.style.display = 'none';
                preparingFloating.classList.remove('show');
            }
            updateHeaderOrderTracker();
        }

        function updateHeaderOrderTracker() {
            if (!currentOrder) {
                headerOrderTracker.style.display = 'none';
                return;
            }
            const items = currentOrder.items;
            const counts = { placed: 0, preparing: 0, ready: 0, served: 0 };
            items.forEach(item => {
                if (counts.hasOwnProperty(item.status)) counts[item.status]++;
            });
            const totalActive = counts.placed + counts.preparing + counts.ready;
            
            if (totalActive > 0) {
                headerOrderTracker.style.display = 'flex';
                if (counts.preparing > 0) {
                    headerOrderTracker.className = 'header-tracker-btn border-blazing-fire';
                    headerOrderTracker.innerHTML = `<i class="fas fa-fire text-sm mr-1"></i> ${counts.preparing} preparing`;
                } else if (counts.ready > 0) {
                    headerOrderTracker.className = 'header-tracker-btn border-glowing-green';
                    headerOrderTracker.innerHTML = `<i class="fas fa-check-circle text-sm mr-1"></i> ${counts.ready} ready!`;
                } else {
                    headerOrderTracker.className = 'header-tracker-btn';
                    headerOrderTracker.innerHTML = `<i class="fas fa-receipt text-sm mr-1"></i> Placed`;
                }
            } else {
                headerOrderTracker.style.display = 'none';
            }
        }

        // =============================================================
        // TRACK ORDER FROM SUCCESS
        // =============================================================
        trackFromSuccessBtn.addEventListener('click', function() {
            if (currentOrder) {
                showPage('tracker');
                renderTracker(currentOrder.id, currentOrder.total);
            }
        });

        orderMoreFromSuccessBtn.addEventListener('click', function() {
            goBackToMenu();
        });

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
                return `
                        <div class="dish-status-item">
                            <span class="dish-name">${item.name} × ${item.qty}</span>
                            <span class="dish-status ${statusClass}">${statusClass.charAt(0).toUpperCase() + statusClass.slice(1)}</span>
                        </div>
                    `;
            }).join('');

            trackItems.innerHTML = sortedItems.map(item =>
                `<div class="flex justify-between"><span>${item.name} × ${item.qty}</span><span>₹${item.price * item.qty}</span></div>`
            ).join('');

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

        headerOrderTracker.addEventListener('click', () => {
            if (currentOrder) {
                showPage('tracker');
                renderTracker(currentOrder.id, currentOrder.total);
            }
        });

        // =============================================================
        // INIT
        // =============================================================
        headerOrderTracker.style.display = 'none';
        showPage('landing');

// Global bindings for inline event handlers

window.goBackToMenu = goBackToMenu;
