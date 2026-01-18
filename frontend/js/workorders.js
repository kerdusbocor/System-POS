/**
 * Work Orders Module
 */

const WorkOrders = {
    workOrders: [],
    technicians: [],

    async init() {
        this.setupEventListeners();
    },

    async load() {
        await Promise.all([
            this.loadWorkOrders(),
            this.loadTechnicians()
        ]);
    },

    setupEventListeners() {
        Utils.on('add-workorder-btn', 'click', () => this.showWorkOrderForm());

        Utils.on('workorders-search', 'input', Utils.debounce((e) => {
            this.filterWorkOrders(e.target.value);
        }, 300));

        Utils.on('workorders-filter', 'change', (e) => {
            this.filterByStatus(e.target.value);
        });

        Utils.delegate('workorder-cards', '.workorder-card', 'click', function () {
            WorkOrders.showWorkOrderDetail(this.dataset.id);
        });
    },

    async loadWorkOrders() {
        try {
            const result = await API.workOrders.list({ limit: 50 });
            this.workOrders = result.data || [];
            this.renderWorkOrders();
        } catch (error) {
            Utils.toast('Failed to load work orders', 'error');
        }
    },

    async loadTechnicians() {
        try {
            const result = await API.workOrders.getTechnicians();
            this.technicians = result.data || [];
        } catch (error) {
            console.error('Failed to load technicians:', error);
        }
    },

    renderWorkOrders(workOrders = this.workOrders) {
        const container = Utils.$('workorder-cards');

        if (workOrders.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 60px; color: var(--text-muted);">No work orders found</div>';
            return;
        }

        container.innerHTML = workOrders.map(wo => `
      <div class="workorder-card" data-id="${wo.id}">
        <div class="workorder-card-header">
          <span class="workorder-number">${wo.work_order_number}</span>
          <span class="workorder-status status-${wo.status}">${this.formatStatus(wo.status)}</span>
        </div>
        <div class="workorder-device">${[wo.device_brand, wo.device_model].filter(Boolean).join(' ') || 'No device info'}</div>
        <div class="workorder-customer">${wo.customer?.name || 'Unknown Customer'}</div>
        <div class="workorder-problem">${wo.problem_description}</div>
        <div class="workorder-footer">
          <span>${Utils.formatDate(wo.received_at)}</span>
          <span>${wo.total_cost ? Utils.formatCurrency(wo.total_cost) : 'Pending'}</span>
        </div>
      </div>
    `).join('');
    },

    formatStatus(status) {
        const labels = {
            pending: 'Pending',
            in_progress: 'In Progress',
            waiting_parts: 'Waiting Parts',
            completed: 'Completed',
            delivered: 'Delivered',
            cancelled: 'Cancelled'
        };
        return labels[status] || status;
    },

    filterWorkOrders(query) {
        if (!query) {
            this.renderWorkOrders();
            return;
        }
        const filtered = this.workOrders.filter(wo =>
            wo.work_order_number.toLowerCase().includes(query.toLowerCase()) ||
            wo.customer?.name?.toLowerCase().includes(query.toLowerCase()) ||
            wo.device_model?.toLowerCase().includes(query.toLowerCase())
        );
        this.renderWorkOrders(filtered);
    },

    filterByStatus(status) {
        if (status === 'all') {
            this.renderWorkOrders();
        } else {
            const filtered = this.workOrders.filter(wo => wo.status === status);
            this.renderWorkOrders(filtered);
        }
    },

    showWorkOrderForm() {
        const techOptions = this.technicians.map(t =>
            `<option value="${t.id}">${t.name}</option>`
        ).join('');

        const content = `
      <div class="modal-header">
        <h2>New Work Order</h2>
        <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <form id="workorder-form">
          <div class="form-group">
            <label>Customer *</label>
            <input type="text" id="wo-customer-search" placeholder="Search customer...">
            <input type="hidden" id="wo-customer-id">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label>Device Brand</label>
              <input type="text" id="wo-device-brand" placeholder="e.g. Apple, Samsung">
            </div>
            <div class="form-group">
              <label>Device Model</label>
              <input type="text" id="wo-device-model" placeholder="e.g. iPhone 14, Galaxy S23">
            </div>
          </div>
          <div class="form-group">
            <label>Problem Description *</label>
            <textarea id="wo-problem" rows="3" placeholder="Describe the issue..." required></textarea>
          </div>
          <div class="form-group">
            <label>Technician</label>
            <select id="wo-technician" class="select-input">
              <option value="">Assign Later</option>
              ${techOptions}
            </select>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label>Priority</label>
              <select id="wo-priority" class="select-input">
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div class="form-group">
              <label>Estimated Cost</label>
              <input type="number" id="wo-estimated-cost" min="0">
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="save-wo-btn">Create Work Order</button>
      </div>
    `;

        Utils.showModal(content, { width: '550px' });
        Utils.on('save-wo-btn', 'click', () => this.saveWorkOrder());
    },

    async saveWorkOrder() {
        const data = {
            customer_id: Utils.$('wo-customer-id').value,
            device_brand: Utils.$('wo-device-brand').value,
            device_model: Utils.$('wo-device-model').value,
            problem_description: Utils.$('wo-problem').value,
            technician_id: Utils.$('wo-technician').value || undefined,
            priority: Utils.$('wo-priority').value,
            estimated_cost: Number(Utils.$('wo-estimated-cost').value) || undefined
        };

        if (!data.problem_description) {
            Utils.toast('Problem description is required', 'warning');
            return;
        }

        try {
            await API.workOrders.create(data);
            Utils.toast('Work order created', 'success');
            Utils.closeModal();
            await this.loadWorkOrders();
        } catch (error) {
            Utils.toast(error.message || 'Failed to create work order', 'error');
        }
    },

    async showWorkOrderDetail(id) {
        try {
            const result = await API.workOrders.get(id);
            const wo = result.data;

            const statusOptions = ['pending', 'in_progress', 'waiting_parts', 'completed', 'delivered']
                .map(s => `<option value="${s}" ${wo.status === s ? 'selected' : ''}>${this.formatStatus(s)}</option>`)
                .join('');

            const content = `
        <div class="modal-header">
          <h2>${wo.work_order_number}</h2>
          <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display: flex; gap: 16px; margin-bottom: 20px;">
            <div style="flex: 1;">
              <label style="font-size: 12px; color: var(--text-muted);">Customer</label>
              <div>${wo.customer?.name || 'Unknown'}</div>
            </div>
            <div>
              <label style="font-size: 12px; color: var(--text-muted);">Status</label>
              <select id="wo-status-update" class="select-input">${statusOptions}</select>
            </div>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="font-size: 12px; color: var(--text-muted);">Device</label>
            <div>${[wo.device_brand, wo.device_model].filter(Boolean).join(' ') || 'Not specified'}</div>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="font-size: 12px; color: var(--text-muted);">Problem</label>
            <div>${wo.problem_description}</div>
          </div>
          ${wo.diagnosis ? `<div style="margin-bottom: 16px;"><label style="font-size: 12px; color: var(--text-muted);">Diagnosis</label><div>${wo.diagnosis}</div></div>` : ''}
          <div style="display: flex; gap: 16px;">
            <div style="flex: 1;">
              <label style="font-size: 12px; color: var(--text-muted);">Received</label>
              <div>${Utils.formatDate(wo.received_at, 'full')}</div>
            </div>
            <div>
              <label style="font-size: 12px; color: var(--text-muted);">Total Cost</label>
              <div style="font-size: 20px; font-weight: 600; color: var(--primary);">${Utils.formatCurrency(wo.total_cost || 0)}</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Close</button>
          <button class="btn btn-primary" id="update-wo-status-btn">Update Status</button>
        </div>
      `;

            Utils.showModal(content, { width: '500px' });

            Utils.on('update-wo-status-btn', 'click', async () => {
                const newStatus = Utils.$('wo-status-update').value;
                if (newStatus !== wo.status) {
                    try {
                        await API.workOrders.updateStatus(id, newStatus, '');
                        Utils.toast('Status updated', 'success');
                        Utils.closeModal();
                        await this.loadWorkOrders();
                    } catch (error) {
                        Utils.toast(error.message || 'Failed to update status', 'error');
                    }
                } else {
                    Utils.closeModal();
                }
            });
        } catch (error) {
            Utils.toast('Failed to load work order details', 'error');
        }
    }
};

window.WorkOrders = WorkOrders;
