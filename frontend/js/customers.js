/**
 * Customers Module
 */

const Customers = {
    customers: [],
    groups: [],

    async init() {
        this.setupEventListeners();
    },

    async load() {
        await Promise.all([
            this.loadCustomers(),
            this.loadGroups()
        ]);
    },

    setupEventListeners() {
        Utils.on('add-customer-btn', 'click', () => this.showCustomerForm());

        Utils.on('customers-search', 'input', Utils.debounce((e) => {
            this.filterCustomers(e.target.value);
        }, 300));

        Utils.delegate('customers-tbody', '.btn-edit', 'click', function () {
            Customers.editCustomer(this.dataset.id);
        });

        Utils.delegate('customers-tbody', '.btn-delete', 'click', function () {
            Customers.deleteCustomer(this.dataset.id);
        });
    },

    async loadCustomers() {
        try {
            const result = await API.customers.list({ limit: 100 });
            this.customers = result.data || [];
            this.renderCustomers();
        } catch (error) {
            Utils.toast('Failed to load customers', 'error');
        }
    },

    async loadGroups() {
        try {
            const result = await API.customers.getGroups();
            this.groups = result.data || [];
        } catch (error) {
            console.error('Failed to load groups:', error);
        }
    },

    renderCustomers(customers = this.customers) {
        const tbody = Utils.$('customers-tbody');

        if (customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No customers found</td></tr>';
            return;
        }

        tbody.innerHTML = customers.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.phone || '-'}</td>
        <td>${c.email || '-'}</td>
        <td>${c.total_orders || 0}</td>
        <td class="actions">
          <button class="btn btn-sm btn-secondary btn-edit" data-id="${c.id}">Edit</button>
          <button class="btn btn-sm btn-danger btn-delete" data-id="${c.id}">Delete</button>
        </td>
      </tr>
    `).join('');
    },

    filterCustomers(query) {
        if (!query) {
            this.renderCustomers();
            return;
        }
        const filtered = this.customers.filter(c =>
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            c.phone?.includes(query) ||
            c.email?.toLowerCase().includes(query.toLowerCase())
        );
        this.renderCustomers(filtered);
    },

    showCustomerForm(customer = null) {
        const isEdit = !!customer;
        const groupsOptions = this.groups.map(g =>
            `<option value="${g.id}" ${customer?.group_id === g.id ? 'selected' : ''}>${g.name}</option>`
        ).join('');

        const content = `
      <div class="modal-header">
        <h2>${isEdit ? 'Edit Customer' : 'Add Customer'}</h2>
        <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <form id="customer-form">
          <div class="form-group">
            <label>Name *</label>
            <input type="text" id="customer-name" value="${customer?.name || ''}" required>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" id="customer-phone" value="${customer?.phone || ''}">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="customer-email" value="${customer?.email || ''}">
            </div>
          </div>
          <div class="form-group">
            <label>Group</label>
            <select id="customer-group" class="select-input">
              <option value="">Select Group</option>
              ${groupsOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Address</label>
            <textarea id="customer-address" rows="2">${customer?.address || ''}</textarea>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea id="customer-notes" rows="2">${customer?.notes || ''}</textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="save-customer-btn">${isEdit ? 'Update' : 'Create'}</button>
      </div>
    `;

        Utils.showModal(content, { width: '500px' });
        Utils.on('save-customer-btn', 'click', () => this.saveCustomer(customer?.id));
    },

    async saveCustomer(customerId) {
        const data = {
            name: Utils.$('customer-name').value,
            phone: Utils.$('customer-phone').value || undefined,
            email: Utils.$('customer-email').value || undefined,
            group_id: Utils.$('customer-group').value || undefined,
            address: Utils.$('customer-address').value || undefined,
            notes: Utils.$('customer-notes').value || undefined
        };

        if (!data.name) {
            Utils.toast('Name is required', 'warning');
            return;
        }

        try {
            if (customerId) {
                await API.customers.update(customerId, data);
                Utils.toast('Customer updated', 'success');
            } else {
                await API.customers.create(data);
                Utils.toast('Customer created', 'success');
            }
            Utils.closeModal();
            await this.loadCustomers();
        } catch (error) {
            Utils.toast(error.message || 'Failed to save customer', 'error');
        }
    },

    async editCustomer(id) {
        const customer = this.customers.find(c => c.id === id);
        if (customer) {
            this.showCustomerForm(customer);
        }
    },

    async deleteCustomer(id) {
        const confirmed = await Utils.confirm('Are you sure you want to delete this customer?', 'Delete Customer');
        if (!confirmed) return;

        try {
            await API.customers.delete(id);
            Utils.toast('Customer deleted', 'success');
            await this.loadCustomers();
        } catch (error) {
            Utils.toast(error.message || 'Failed to delete customer', 'error');
        }
    }
};

window.Customers = Customers;
