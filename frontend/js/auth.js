/**
 * Auth Module - Login and session management
 */

const Auth = {
    user: null,

    /**
     * Initialize auth state
     */
    init() {
        this.user = API.auth.getStoredUser();
        this.setupEventListeners();
        return this.isAuthenticated();
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!API.getToken() && !!this.user;
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Login form
        Utils.on('login-form', 'submit', (e) => {
            e.preventDefault();
            this.handleEmailLogin();
        });

        // PIN login toggle
        Utils.on('pin-login-btn', 'click', () => {
            Utils.$('login-form').classList.add('hidden');
            Utils.$('pin-login-form').classList.remove('hidden');
            Utils.$('pin-input').value = '';
            Utils.$('pin-input').focus();
        });

        // Back to email login
        Utils.on('back-to-login', 'click', () => {
            Utils.$('pin-login-form').classList.add('hidden');
            Utils.$('login-form').classList.remove('hidden');
        });

        // PIN keypad
        Utils.delegate('pin-login-form', '.pin-key', 'click', function () {
            const key = this.dataset.key;
            const input = Utils.$('pin-input');

            if (key === 'clear') {
                input.value = '';
            } else if (key === 'enter') {
                Auth.handlePinLogin();
            } else {
                if (input.value.length < 6) {
                    input.value += key;
                }
            }
        });

        // PIN input keyboard
        Utils.on('pin-input', 'keydown', (e) => {
            if (e.key === 'Enter') {
                this.handlePinLogin();
            }
        });

        // Logout
        Utils.on('logout-btn', 'click', () => {
            this.logout();
        });
    },

    /**
     * Handle email/password login
     */
    async handleEmailLogin() {
        const email = Utils.$('login-email').value;
        const password = Utils.$('login-password').value;
        const btn = Utils.$('login-form').querySelector('button[type="submit"]');

        try {
            btn.disabled = true;
            btn.innerHTML = '<span>Signing in...</span>';

            const result = await API.auth.login(email, password);
            this.user = result.user;

            Utils.toast('Login successful!', 'success');
            App.showMainApp();
        } catch (error) {
            Utils.toast(error.message || 'Login failed', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>Sign In</span>';
        }
    },

    /**
     * Handle PIN login
     */
    async handlePinLogin() {
        const pin = Utils.$('pin-input').value;

        if (pin.length < 4) {
            Utils.toast('PIN must be at least 4 digits', 'warning');
            return;
        }

        try {
            const result = await API.auth.loginPin(pin);
            this.user = result.user;

            Utils.toast('Login successful!', 'success');
            App.showMainApp();
        } catch (error) {
            Utils.toast(error.message || 'Invalid PIN', 'error');
            Utils.$('pin-input').value = '';
        }
    },

    /**
     * Logout
     */
    async logout() {
        const confirmed = await Utils.confirm('Are you sure you want to logout?', 'Logout');

        if (confirmed) {
            try {
                await API.auth.logout();
            } finally {
                this.user = null;
                App.showLogin();
                Utils.toast('Logged out successfully', 'info');
            }
        }
    },

    /**
     * Update UI with user info
     */
    updateUserUI() {
        if (this.user) {
            Utils.$('user-name').textContent = this.user.fullName || this.user.email;
            Utils.$('user-role').textContent = this.user.roles?.[0] || 'User';
            Utils.$('user-avatar').textContent = (this.user.fullName || 'U')[0].toUpperCase();
        }
    },

    /**
     * Check permission
     */
    hasPermission(permission) {
        if (!this.user) return false;
        if (this.user.roles?.includes('Super Admin')) return true;
        return this.user.permissions?.includes(permission);
    }
};

window.Auth = Auth;
