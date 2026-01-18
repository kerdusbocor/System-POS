/**
 * API Module - Backend communication layer
 */

const API = {
    baseUrl: 'http://localhost:3000/api/v1',
    token: null,

    /**
     * Set auth token
     */
    setToken(token) {
        this.token = token;
        localStorage.setItem('pos_token', token);
    },

    /**
     * Get stored token
     */
    getToken() {
        if (!this.token) {
            this.token = localStorage.getItem('pos_token');
        }
        return this.token;
    },

    /**
     * Clear auth
     */
    clearAuth() {
        this.token = null;
        localStorage.removeItem('pos_token');
        localStorage.removeItem('pos_user');
        localStorage.removeItem('pos_refresh_token');
    },

    /**
     * Make API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const token = this.getToken();

        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers
            }
        };

        if (options.body) {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                // Handle 401 - try refresh token
                if (response.status === 401 && options.retry !== false) {
                    const refreshed = await this.refreshToken();
                    if (refreshed) {
                        return this.request(endpoint, { ...options, retry: false });
                    }
                }
                throw new Error(data.error?.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    /**
     * Refresh access token
     */
    async refreshToken() {
        const refreshToken = localStorage.getItem('pos_refresh_token');
        if (!refreshToken) return false;

        try {
            const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (!response.ok) {
                this.clearAuth();
                return false;
            }

            const data = await response.json();
            this.setToken(data.data.accessToken);
            localStorage.setItem('pos_refresh_token', data.data.refreshToken);
            return true;
        } catch {
            this.clearAuth();
            return false;
        }
    },

    // =========================================================================
    // AUTH
    // =========================================================================

    auth: {
        async login(email, password) {
            const data = await API.request('/auth/login', {
                method: 'POST',
                body: { email, password }
            });
            API.setToken(data.data.session.accessToken);
            localStorage.setItem('pos_refresh_token', data.data.session.refreshToken);
            localStorage.setItem('pos_user', JSON.stringify(data.data.user));
            return data.data;
        },

        async loginPin(pin) {
            const data = await API.request('/auth/login/pin', {
                method: 'POST',
                body: { pin_code: pin }
            });
            API.setToken(data.data.session.accessToken);
            localStorage.setItem('pos_user', JSON.stringify(data.data.user));
            return data.data;
        },

        async logout() {
            try {
                await API.request('/auth/logout', { method: 'POST' });
            } finally {
                API.clearAuth();
            }
        },

        async getProfile() {
            return API.request('/auth/me');
        },

        getStoredUser() {
            const user = localStorage.getItem('pos_user');
            return user ? JSON.parse(user) : null;
        }
    },

    // =========================================================================
    // PRODUCTS
    // =========================================================================

    products: {
        async list(params = {}) {
            const query = new URLSearchParams(params).toString();
            return API.request(`/products${query ? '?' + query : ''}`);
        },

        async get(id) {
            return API.request(`/products/${id}`);
        },

        async getByBarcode(barcode) {
            return API.request(`/products/barcode/${barcode}`);
        },

        async create(data) {
            return API.request('/products', { method: 'POST', body: data });
        },

        async update(id, data) {
            return API.request(`/products/${id}`, { method: 'PUT', body: data });
        },

        async delete(id) {
            return API.request(`/products/${id}`, { method: 'DELETE' });
        },

        async getCategories() {
            return API.request('/products/meta/categories');
        },

        async getUnits() {
            return API.request('/products/meta/units');
        }
    },

    // =========================================================================
    // INVENTORY
    // =========================================================================

    inventory: {
        async list(params = {}) {
            const query = new URLSearchParams(params).toString();
            return API.request(`/inventory${query ? '?' + query : ''}`);
        },

        async getWarehouses() {
            return API.request('/inventory/warehouses');
        },

        async adjust(data) {
            return API.request('/inventory/adjustments', { method: 'POST', body: data });
        },

        async transfer(data) {
            return API.request('/inventory/transfers', { method: 'POST', body: data });
        }
    },

    // =========================================================================
    // TRANSACTIONS
    // =========================================================================

    transactions: {
        async list(params = {}) {
            const query = new URLSearchParams(params).toString();
            return API.request(`/transactions${query ? '?' + query : ''}`);
        },

        async get(id) {
            return API.request(`/transactions/${id}`);
        },

        async create(data) {
            return API.request('/transactions', { method: 'POST', body: data });
        },

        async void(id, reason) {
            return API.request(`/transactions/${id}/void`, {
                method: 'POST',
                body: { reason }
            });
        },

        async addPayment(id, payment) {
            return API.request(`/transactions/${id}/payments`, {
                method: 'POST',
                body: payment
            });
        },

        async getPaymentMethods() {
            return API.request('/transactions/meta/payment-methods');
        },

        async hold(data) {
            return API.request('/transactions/hold', { method: 'POST', body: data });
        },

        async getHolds() {
            return API.request('/transactions/holds');
        },

        async releaseHold(id) {
            return API.request(`/transactions/holds/${id}`, { method: 'DELETE' });
        }
    },

    // =========================================================================
    // CUSTOMERS
    // =========================================================================

    customers: {
        async list(params = {}) {
            const query = new URLSearchParams(params).toString();
            return API.request(`/customers${query ? '?' + query : ''}`);
        },

        async get(id) {
            return API.request(`/customers/${id}`);
        },

        async create(data) {
            return API.request('/customers', { method: 'POST', body: data });
        },

        async update(id, data) {
            return API.request(`/customers/${id}`, { method: 'PUT', body: data });
        },

        async delete(id) {
            return API.request(`/customers/${id}`, { method: 'DELETE' });
        },

        async getGroups() {
            return API.request('/customers/meta/groups');
        }
    },

    // =========================================================================
    // WORK ORDERS
    // =========================================================================

    workOrders: {
        async list(params = {}) {
            const query = new URLSearchParams(params).toString();
            return API.request(`/work-orders${query ? '?' + query : ''}`);
        },

        async get(id) {
            return API.request(`/work-orders/${id}`);
        },

        async create(data) {
            return API.request('/work-orders', { method: 'POST', body: data });
        },

        async update(id, data) {
            return API.request(`/work-orders/${id}`, { method: 'PUT', body: data });
        },

        async updateStatus(id, status, notes) {
            return API.request(`/work-orders/${id}/status`, {
                method: 'POST',
                body: { status, notes }
            });
        },

        async addItem(id, item) {
            return API.request(`/work-orders/${id}/items`, {
                method: 'POST',
                body: item
            });
        },

        async getTechnicians() {
            return API.request('/work-orders/meta/technicians');
        }
    },

    // =========================================================================
    // CASH
    // =========================================================================

    cash: {
        async getRegisters() {
            return API.request('/cash/registers');
        },

        async getSessions(params = {}) {
            const query = new URLSearchParams(params).toString();
            return API.request(`/cash/sessions${query ? '?' + query : ''}`);
        },

        async getCurrentSession() {
            return API.request('/cash/sessions/current');
        },

        async openSession(registerId, openingAmount) {
            return API.request('/cash/sessions/open', {
                method: 'POST',
                body: { cash_register_id: registerId, opening_amount: openingAmount }
            });
        },

        async closeSession(id, actualAmount, notes) {
            return API.request(`/cash/sessions/${id}/close`, {
                method: 'POST',
                body: { actual_amount: actualAmount, notes }
            });
        },

        async addMovement(sessionId, type, amount, reason) {
            return API.request('/cash/movements', {
                method: 'POST',
                body: { cash_session_id: sessionId, movement_type: type, amount, reason }
            });
        }
    },

    // =========================================================================
    // REPORTS
    // =========================================================================

    reports: {
        async salesSummary(startDate, endDate) {
            return API.request(`/reports/sales/summary?start_date=${startDate}&end_date=${endDate}`);
        },

        async salesByItem(startDate, endDate) {
            return API.request(`/reports/sales/by-item?start_date=${startDate}&end_date=${endDate}`);
        },

        async workOrdersSummary(startDate, endDate) {
            return API.request(`/reports/work-orders/summary?start_date=${startDate}&end_date=${endDate}`);
        },

        async inventoryValuation() {
            return API.request('/reports/inventory/valuation');
        }
    }
};

// Export for use
window.API = API;
