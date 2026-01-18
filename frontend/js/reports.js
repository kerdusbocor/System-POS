/**
 * Reports Module
 */

const Reports = {
    async init() {
        this.setupEventListeners();
        this.setDefaultDates();
    },

    async load() {
        await this.loadReports();
    },

    setupEventListeners() {
        Utils.on('apply-report-filter', 'click', () => this.loadReports());
    },

    setDefaultDates() {
        const today = Utils.today();
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        Utils.$('report-start-date').value = weekAgo;
        Utils.$('report-end-date').value = today;
    },

    async loadReports() {
        const startDate = Utils.$('report-start-date').value;
        const endDate = Utils.$('report-end-date').value;

        await Promise.all([
            this.loadSalesSummary(startDate, endDate),
            this.loadWorkOrdersSummary(startDate, endDate),
            this.loadTopProducts(startDate, endDate)
        ]);
    },

    async loadSalesSummary(startDate, endDate) {
        try {
            const result = await API.reports.salesSummary(startDate, endDate);
            const data = result.data || result;

            Utils.$('report-total-sales').textContent = Utils.formatCurrency(data.net_sales || 0);
            Utils.$('report-tx-count').textContent = data.transaction_count || 0;

            const avgSale = data.transaction_count > 0
                ? (data.net_sales || 0) / data.transaction_count
                : 0;
            Utils.$('report-avg-sale').textContent = Utils.formatCurrency(avgSale);
        } catch (error) {
            console.error('Failed to load sales summary:', error);
            Utils.$('report-total-sales').textContent = Utils.formatCurrency(0);
            Utils.$('report-tx-count').textContent = '0';
            Utils.$('report-avg-sale').textContent = Utils.formatCurrency(0);
        }
    },

    async loadWorkOrdersSummary(startDate, endDate) {
        try {
            const result = await API.reports.workOrdersSummary(startDate, endDate);
            const data = result.data || result;

            Utils.$('report-wo-revenue').textContent = Utils.formatCurrency(data.revenue?.total || 0);
            Utils.$('report-wo-count').textContent = data.total || 0;
            Utils.$('report-wo-completed').textContent = data.by_status?.completed || 0;
        } catch (error) {
            console.error('Failed to load work orders summary:', error);
            Utils.$('report-wo-revenue').textContent = Utils.formatCurrency(0);
            Utils.$('report-wo-count').textContent = '0';
            Utils.$('report-wo-completed').textContent = '0';
        }
    },

    async loadTopProducts(startDate, endDate) {
        try {
            const result = await API.reports.salesByItem(startDate, endDate);
            const products = (result.data || result).slice(0, 5);

            const list = Utils.$('top-products-list');

            if (products.length === 0) {
                list.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No data available</div>';
                return;
            }

            list.innerHTML = products.map((p, i) => `
        <div class="top-product-item">
          <div>
            <span style="color: var(--text-muted); margin-right: 8px;">#${i + 1}</span>
            <span class="top-product-name">${p.name || 'Unknown'}</span>
          </div>
          <span class="top-product-sales">${Utils.formatCurrency(p.total || 0)}</span>
        </div>
      `).join('');
        } catch (error) {
            console.error('Failed to load top products:', error);
            Utils.$('top-products-list').innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Failed to load data</div>';
        }
    }
};

window.Reports = Reports;
