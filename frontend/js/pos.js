/**
 * POS Module - Point of Sale functionality
 */

const POS = {
    cart: [],
    products: [],
    categories: [],
    paymentMethods: [],
    selectedCustomer: null,

    /**
     * Initialize POS
     */
    async init() {
        this.setupEventListeners();
        await this.loadProducts();
        await this.loadCategories();
        await this.loadPaymentMethods();
        this.renderCart();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Product search
        const searchInput = Utils.$('product-search');
        searchInput.addEventListener('input', Utils.debounce((e) => {
            this.filterProducts(e.target.value);
        }, 300));

        // Barcode scan (Enter key)
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleBarcodeScan(e.target.value);
                e.target.value = '';
            }
        });

        // Category tabs
        Utils.delegate('category-tabs', '.category-tab', 'click', function () {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            POS.filterByCategory(this.dataset.category);
        });

        // Product grid click
        Utils.delegate('product-grid', '.product-card', 'click', function () {
            POS.addToCart(this.dataset.id);
        });

        // Cart item quantity
        Utils.delegate('cart-items', '.qty-btn', 'click', function (e) {
            e.stopPropagation();
            const itemId = this.closest('.cart-item').dataset.id;
            const action = this.dataset.action;
            POS.updateQuantity(itemId, action);
        });

        // Remove item
        Utils.delegate('cart-items', '.cart-item-remove', 'click', function (e) {
            e.stopPropagation();
            const itemId = this.closest('.cart-item').dataset.id;
            POS.removeFromCart(itemId);
        });

        // Clear cart
        Utils.on('clear-cart-btn', 'click', async () => {
            if (this.cart.length > 0) {
                const confirmed = await Utils.confirm('Clear all items from cart?', 'Clear Cart');
                if (confirmed) {
                    this.clearCart();
                }
            }
        });

        // Hold transaction
        Utils.on('hold-btn', 'click', () => this.holdTransaction());

        // Pay button
        Utils.on('pay-btn', 'click', () => this.showPaymentModal());

        // Discount button
        Utils.on('discount-btn', 'click', () => this.showDiscountModal());

        // Customer select
        Utils.on('select-customer-btn', 'click', () => this.showCustomerSelect());

        // Mobile cart toggle
        const posCart = Utils.$('pos-screen')?.querySelector('.pos-cart');
        if (posCart) {
            posCart.querySelector('.cart-header').addEventListener('click', () => {
                posCart.classList.toggle('expanded');
            });
        }
    },

    /**
     * Load products
     */
    async loadProducts() {
        try {
            const result = await API.products.list({ limit: 100, is_active: true });
            this.products = result.data || [];
            this.renderProducts();
        } catch (error) {
            console.error('Failed to load products:', error);
            // Use demo data if API fails
            this.products = this.getDemoProducts();
            this.renderProducts();
        }
    },

    /**
     * Load categories
     */
    async loadCategories() {
        try {
            const result = await API.products.getCategories();
            this.categories = result.data || [];
            this.renderCategories();
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    },

    /**
     * Load payment methods
     */
    async loadPaymentMethods() {
        try {
            const result = await API.transactions.getPaymentMethods();
            this.paymentMethods = result.data || [];
        } catch (error) {
            // Default payment methods
            this.paymentMethods = [
                { id: '1', code: 'cash', name: 'Cash' },
                { id: '2', code: 'card', name: 'Card' },
                { id: '3', code: 'transfer', name: 'Transfer' }
            ];
        }
    },

    /**
     * Demo products for offline/testing
     */
    getDemoProducts() {
        return [
            { id: '1', name: 'Coffee Latte', selling_price: 25000, type: 'product', sku: 'COF001' },
            { id: '2', name: 'Cappuccino', selling_price: 28000, type: 'product', sku: 'COF002' },
            { id: '3', name: 'Green Tea', selling_price: 20000, type: 'product', sku: 'TEA001' },
            { id: '4', name: 'Croissant', selling_price: 18000, type: 'product', sku: 'BKR001' },
            { id: '5', name: 'Sandwich', selling_price: 35000, type: 'product', sku: 'FOD001' },
            { id: '6', name: 'Phone Repair', selling_price: 150000, type: 'service', sku: 'SVC001' },
            { id: '7', name: 'Screen Replacement', selling_price: 500000, type: 'service', sku: 'SVC002' },
            { id: '8', name: 'Laptop Cleaning', selling_price: 100000, type: 'service', sku: 'SVC003' }
        ];
    },

    /**
     * Render products grid
     */
    renderProducts(products = this.products) {
        const grid = Utils.$('product-grid');

        if (products.length === 0) {
            grid.innerHTML = '<div class="cart-empty"><p>No products found</p></div>';
            return;
        }

        grid.innerHTML = products.map(p => `
      <div class="product-card" data-id="${p.id}">
        <div class="product-card-image">
          ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : this.getTypeIcon(p.type)}
        </div>
        <div class="product-card-name">${p.name}</div>
        <div class="product-card-price">${Utils.formatCurrency(p.selling_price)}</div>
      </div>
    `).join('');
    },

    /**
     * Get icon for product type
     */
    getTypeIcon(type) {
        const icons = {
            product: '📦',
            service: '🔧',
            bundle: '📋'
        };
        return icons[type] || '📦';
    },

    /**
     * Render categories
     */
    renderCategories() {
        const tabs = Utils.$('category-tabs');
        const categoryHtml = this.categories.map(c =>
            `<button class="category-tab" data-category="${c.id}">${c.name}</button>`
        ).join('');
        tabs.innerHTML = '<button class="category-tab active" data-category="all">All</button>' + categoryHtml;
    },

    /**
     * Filter products by search
     */
    filterProducts(query) {
        if (!query) {
            this.renderProducts();
            return;
        }
        const filtered = this.products.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.sku?.toLowerCase().includes(query.toLowerCase()) ||
            p.barcode?.includes(query)
        );
        this.renderProducts(filtered);
    },

    /**
     * Filter by category
     */
    filterByCategory(categoryId) {
        if (categoryId === 'all') {
            this.renderProducts();
        } else {
            const filtered = this.products.filter(p => p.category_id === categoryId);
            this.renderProducts(filtered);
        }
    },

    /**
     * Handle barcode scan
     */
    async handleBarcodeScan(barcode) {
        if (!barcode) return;

        // First check local products
        const localProduct = this.products.find(p =>
            p.barcode === barcode || p.sku === barcode
        );

        if (localProduct) {
            this.addToCart(localProduct.id);
            return;
        }

        // Try API lookup
        try {
            const result = await API.products.getByBarcode(barcode);
            if (result.data) {
                this.products.push(result.data);
                this.addToCart(result.data.id);
            }
        } catch (error) {
            Utils.toast('Product not found', 'warning');
        }
    },

    /**
     * Add product to cart
     */
    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        const existingItem = this.cart.find(item => item.id === productId);

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                price: Number(product.selling_price),
                quantity: 1,
                type: product.type
            });
        }

        this.renderCart();
        Utils.toast(`Added ${product.name}`, 'success');
    },

    /**
     * Update item quantity
     */
    updateQuantity(itemId, action) {
        const item = this.cart.find(i => i.id === itemId);
        if (!item) return;

        if (action === 'increase') {
            item.quantity += 1;
        } else if (action === 'decrease') {
            item.quantity -= 1;
            if (item.quantity <= 0) {
                this.removeFromCart(itemId);
                return;
            }
        }

        this.renderCart();
    },

    /**
     * Remove item from cart
     */
    removeFromCart(itemId) {
        this.cart = this.cart.filter(i => i.id !== itemId);
        this.renderCart();
    },

    /**
     * Clear cart
     */
    clearCart() {
        this.cart = [];
        this.selectedCustomer = null;
        Utils.$('selected-customer-name').textContent = 'Walk-in Customer';
        this.renderCart();
    },

    /**
     * Calculate totals
     */
    calculateTotals() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discount = 0; // Can be extended
        const tax = subtotal * 0.1; // 10% tax
        const total = subtotal - discount + tax;

        return { subtotal, discount, tax, total };
    },

    /**
     * Render cart
     */
    renderCart() {
        const cartItems = Utils.$('cart-items');
        const totals = this.calculateTotals();

        if (this.cart.length === 0) {
            cartItems.innerHTML = `
        <div class="cart-empty">
          <svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
          <p>Cart is empty</p>
        </div>
      `;
        } else {
            cartItems.innerHTML = this.cart.map(item => `
        <div class="cart-item" data-id="${item.id}">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${Utils.formatCurrency(item.price)}</div>
          </div>
          <div class="cart-item-qty">
            <button class="qty-btn" data-action="decrease">−</button>
            <span class="qty-value">${item.quantity}</span>
            <button class="qty-btn" data-action="increase">+</button>
          </div>
          <div class="cart-item-total">${Utils.formatCurrency(item.price * item.quantity)}</div>
          <button class="cart-item-remove" title="Remove">✕</button>
        </div>
      `).join('');
        }

        // Update totals
        Utils.$('cart-subtotal').textContent = Utils.formatCurrency(totals.subtotal);
        Utils.$('cart-tax').textContent = Utils.formatCurrency(totals.tax);
        Utils.$('cart-total').textContent = Utils.formatCurrency(totals.total);

        // Enable/disable pay button
        Utils.$('pay-btn').disabled = this.cart.length === 0;
    },

    /**
     * Show payment modal
     */
    showPaymentModal() {
        if (this.cart.length === 0) return;

        const totals = this.calculateTotals();
        const methodsHtml = this.paymentMethods.map(m =>
            `<button class="btn btn-secondary payment-method-btn" data-id="${m.id}" data-code="${m.code}">${m.name}</button>`
        ).join('');

        const content = `
      <div class="modal-header">
        <h2>Payment</h2>
        <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="payment-total">
          <span>Total</span>
          <span class="payment-amount">${Utils.formatCurrency(totals.total)}</span>
        </div>
        <div class="form-group">
          <label>Payment Method</label>
          <div class="payment-methods">${methodsHtml}</div>
        </div>
        <div class="form-group">
          <label>Amount Received</label>
          <input type="number" id="payment-received" class="form-control" value="${totals.total}" step="1000">
        </div>
        <div class="payment-change">
          <span>Change</span>
          <span id="payment-change">Rp 0</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn btn-primary btn-large" id="complete-payment-btn">Complete Payment</button>
      </div>
    `;

        Utils.showModal(content, { width: '450px' });

        // Calculate change
        const receivedInput = Utils.$('payment-received');
        receivedInput.addEventListener('input', () => {
            const received = Number(receivedInput.value) || 0;
            const change = Math.max(0, received - totals.total);
            Utils.$('payment-change').textContent = Utils.formatCurrency(change);
        });

        // Select payment method
        let selectedMethod = this.paymentMethods[0];
        document.querySelectorAll('.payment-method-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedMethod = this.paymentMethods.find(m => m.id === btn.dataset.id);
            });
        });
        document.querySelector('.payment-method-btn')?.classList.add('active');

        // Complete payment
        Utils.on('complete-payment-btn', 'click', () => this.completePayment(selectedMethod, totals));
    },

    /**
     * Complete payment
     */
    async completePayment(paymentMethod, totals) {
        const received = Number(Utils.$('payment-received').value) || 0;

        if (received < totals.total) {
            Utils.toast('Insufficient payment amount', 'error');
            return;
        }

        const btn = Utils.$('complete-payment-btn');
        btn.disabled = true;
        btn.textContent = 'Processing...';

        try {
            const transactionData = {
                items: this.cart.map(item => ({
                    item_id: item.id,
                    quantity: item.quantity,
                    unit_price: item.price
                })),
                payments: [{
                    payment_method_id: paymentMethod.id,
                    amount: totals.total
                }],
                customer_id: this.selectedCustomer?.id
            };

            await API.transactions.create(transactionData);

            Utils.closeModal();
            this.clearCart();

            Utils.toast('Payment completed successfully!', 'success');

            // Show receipt option
            // this.showReceipt(result.data);
        } catch (error) {
            Utils.toast(error.message || 'Payment failed', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Complete Payment';
        }
    },

    /**
     * Hold transaction
     */
    async holdTransaction() {
        if (this.cart.length === 0) {
            Utils.toast('Cart is empty', 'warning');
            return;
        }

        const holdName = await Utils.prompt('Enter a name for this hold:', '', 'Hold Transaction');
        if (holdName === null) return;

        try {
            await API.transactions.hold({
                items: this.cart,
                totals: this.calculateTotals(),
                customer_id: this.selectedCustomer?.id,
                hold_name: holdName || `Hold ${new Date().toLocaleTimeString()}`
            });

            this.clearCart();
            Utils.toast('Transaction held', 'success');
        } catch (error) {
            Utils.toast(error.message || 'Failed to hold transaction', 'error');
        }
    },

    /**
     * Show discount modal
     */
    showDiscountModal() {
        const content = `
      <div class="modal-header">
        <h2>Apply Discount</h2>
        <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Discount Type</label>
          <select id="discount-type" class="form-control">
            <option value="percent">Percentage (%)</option>
            <option value="amount">Fixed Amount</option>
          </select>
        </div>
        <div class="form-group">
          <label>Value</label>
          <input type="number" id="discount-value" class="form-control" min="0" step="1">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="POS.applyDiscount()">Apply</button>
      </div>
    `;
        Utils.showModal(content);
    },

    /**
     * Apply discount
     */
    applyDiscount() {
        // Discount logic would go here
        Utils.toast('Discount applied', 'success');
        Utils.closeModal();
        this.renderCart();
    },

    /**
     * Show customer select
     */
    async showCustomerSelect() {
        const content = `
      <div class="modal-header">
        <h2>Select Customer</h2>
        <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="search-box" style="margin-bottom: 16px;">
          <input type="text" id="customer-search-modal" placeholder="Search customers..." style="width: 100%; padding: 12px;">
        </div>
        <div id="customer-list-modal" style="max-height: 300px; overflow-y: auto;">
          <div style="text-align: center; color: var(--text-muted);">Loading...</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="POS.selectCustomer(null)">Walk-in Customer</button>
      </div>
    `;
        Utils.showModal(content);

        try {
            const result = await API.customers.list({ limit: 50 });
            this.renderCustomerList(result.data || []);
        } catch (error) {
            Utils.$('customer-list-modal').innerHTML = '<div style="color: var(--danger);">Failed to load customers</div>';
        }

        Utils.on('customer-search-modal', 'input', Utils.debounce(async (e) => {
            const result = await API.customers.list({ search: e.target.value, limit: 50 });
            this.renderCustomerList(result.data || []);
        }, 300));
    },

    /**
     * Render customer list in modal
     */
    renderCustomerList(customers) {
        const list = Utils.$('customer-list-modal');
        if (customers.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: var(--text-muted);">No customers found</div>';
            return;
        }

        list.innerHTML = customers.map(c => `
      <div class="customer-item" onclick="POS.selectCustomer(${JSON.stringify(c).replace(/"/g, '&quot;')})" 
           style="padding: 12px; border-bottom: 1px solid var(--border-color); cursor: pointer;">
        <div style="font-weight: 500;">${c.name}</div>
        <div style="font-size: 12px; color: var(--text-muted);">${c.phone || c.email || ''}</div>
      </div>
    `).join('');
    },

    /**
     * Select customer
     */
    selectCustomer(customer) {
        this.selectedCustomer = customer;
        Utils.$('selected-customer-name').textContent = customer ? customer.name : 'Walk-in Customer';
        Utils.closeModal();
    }
};

window.POS = POS;
