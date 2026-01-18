/**
 * Products Module - Product management
 */

const Products = {
    products: [],
    categories: [],
    units: [],

    /**
     * Initialize
     */
    async init() {
        this.setupEventListeners();
    },

    /**
     * Load when screen is shown
     */
    async load() {
        await Promise.all([
            this.loadProducts(),
            this.loadCategories(),
            this.loadUnits()
        ]);
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Add product
        Utils.on('add-product-btn', 'click', () => this.showProductForm());

        // Search
        Utils.on('products-search', 'input', Utils.debounce((e) => {
            this.filterProducts(e.target.value);
        }, 300));

        // Filter by type
        Utils.on('products-filter', 'change', (e) => {
            this.filterByType(e.target.value);
        });

        // Table actions
        Utils.delegate('products-tbody', '.btn-edit', 'click', function () {
            Products.editProduct(this.dataset.id);
        });

        Utils.delegate('products-tbody', '.btn-delete', 'click', function () {
            Products.deleteProduct(this.dataset.id);
        });
    },

    /**
     * Load products
     */
    async loadProducts() {
        try {
            const result = await API.products.list({ limit: 100 });
            this.products = result.data || [];
            this.renderProducts();
        } catch (error) {
            Utils.toast('Failed to load products', 'error');
        }
    },

    /**
     * Load categories
     */
    async loadCategories() {
        try {
            const result = await API.products.getCategories();
            this.categories = result.data || [];
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    },

    /**
     * Load units
     */
    async loadUnits() {
        try {
            const result = await API.products.getUnits();
            this.units = result.data || [];
        } catch (error) {
            console.error('Failed to load units:', error);
        }
    },

    /**
     * Render products table
     */
    renderProducts(products = this.products) {
        const tbody = Utils.$('products-tbody');

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No products found</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(p => `
      <tr>
        <td>${p.sku || '-'}</td>
        <td>${p.name}</td>
        <td><span class="badge badge-${p.type}">${p.type}</span></td>
        <td>${p.category?.name || '-'}</td>
        <td>${Utils.formatCurrency(p.selling_price)}</td>
        <td>${p.type === 'product' ? (p.stock || 0) : '-'}</td>
        <td class="actions">
          <button class="btn btn-sm btn-secondary btn-edit" data-id="${p.id}">Edit</button>
          <button class="btn btn-sm btn-danger btn-delete" data-id="${p.id}">Delete</button>
        </td>
      </tr>
    `).join('');
    },

    /**
     * Filter products
     */
    filterProducts(query) {
        if (!query) {
            this.renderProducts();
            return;
        }
        const filtered = this.products.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.sku?.toLowerCase().includes(query.toLowerCase())
        );
        this.renderProducts(filtered);
    },

    /**
     * Filter by type
     */
    filterByType(type) {
        if (type === 'all') {
            this.renderProducts();
        } else {
            const filtered = this.products.filter(p => p.type === type);
            this.renderProducts(filtered);
        }
    },

    /**
     * Show product form
     */
    showProductForm(product = null) {
        const isEdit = !!product;
        const categoriesOptions = this.categories.map(c =>
            `<option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`
        ).join('');

        const unitsOptions = this.units.map(u =>
            `<option value="${u.id}" ${product?.unit_id === u.id ? 'selected' : ''}>${u.name}</option>`
        ).join('');

        const content = `
      <div class="modal-header">
        <h2>${isEdit ? 'Edit Product' : 'Add Product'}</h2>
        <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <form id="product-form">
          <div class="form-group">
            <label>Type</label>
            <select id="product-type" class="select-input" required>
              <option value="product" ${product?.type === 'product' ? 'selected' : ''}>Product</option>
              <option value="service" ${product?.type === 'service' ? 'selected' : ''}>Service</option>
              <option value="bundle" ${product?.type === 'bundle' ? 'selected' : ''}>Bundle</option>
            </select>
          </div>
          <div class="form-group">
            <label>Name *</label>
            <input type="text" id="product-name" value="${product?.name || ''}" required>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label>SKU</label>
              <input type="text" id="product-sku" value="${product?.sku || ''}">
            </div>
            <div class="form-group">
              <label>Barcode</label>
              <input type="text" id="product-barcode" value="${product?.barcode || ''}">
            </div>
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="product-category" class="select-input">
              <option value="">Select Category</option>
              ${categoriesOptions}
            </select>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label>Cost Price</label>
              <input type="number" id="product-cost" value="${product?.cost_price || 0}" min="0">
            </div>
            <div class="form-group">
              <label>Selling Price *</label>
              <input type="number" id="product-price" value="${product?.selling_price || 0}" min="0" required>
            </div>
          </div>
          <div class="form-group">
            <label>Unit</label>
            <select id="product-unit" class="select-input">
              <option value="">Select Unit</option>
              ${unitsOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="product-description" rows="3">${product?.description || ''}</textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="save-product-btn">${isEdit ? 'Update' : 'Create'}</button>
      </div>
    `;

        Utils.showModal(content, { width: '550px' });

        Utils.on('save-product-btn', 'click', () => this.saveProduct(product?.id));
    },

    /**
     * Save product
     */
    async saveProduct(productId) {
        const data = {
            type: Utils.$('product-type').value,
            name: Utils.$('product-name').value,
            sku: Utils.$('product-sku').value || undefined,
            barcode: Utils.$('product-barcode').value || undefined,
            category_id: Utils.$('product-category').value || undefined,
            cost_price: Number(Utils.$('product-cost').value) || 0,
            selling_price: Number(Utils.$('product-price').value),
            unit_id: Utils.$('product-unit').value || undefined,
            description: Utils.$('product-description').value || undefined
        };

        if (!data.name || !data.selling_price) {
            Utils.toast('Please fill required fields', 'warning');
            return;
        }

        try {
            if (productId) {
                await API.products.update(productId, data);
                Utils.toast('Product updated', 'success');
            } else {
                await API.products.create(data);
                Utils.toast('Product created', 'success');
            }
            Utils.closeModal();
            await this.loadProducts();
        } catch (error) {
            Utils.toast(error.message || 'Failed to save product', 'error');
        }
    },

    /**
     * Edit product
     */
    async editProduct(id) {
        const product = this.products.find(p => p.id === id);
        if (product) {
            this.showProductForm(product);
        }
    },

    /**
     * Delete product
     */
    async deleteProduct(id) {
        const confirmed = await Utils.confirm('Are you sure you want to delete this product?', 'Delete Product');
        if (!confirmed) return;

        try {
            await API.products.delete(id);
            Utils.toast('Product deleted', 'success');
            await this.loadProducts();
        } catch (error) {
            Utils.toast(error.message || 'Failed to delete product', 'error');
        }
    }
};

window.Products = Products;
