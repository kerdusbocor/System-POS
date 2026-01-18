/**
 * Main App Module - Application controller
 */

const App = {
    currentScreen: 'pos',

    /**
     * Initialize application
     */
    async init() {
        console.log('Initializing POS Application...');

        // Initialize auth
        const isAuthenticated = Auth.init();

        // Initialize all modules
        await Products.init();
        await Customers.init();
        await WorkOrders.init();
        await Reports.init();

        // Setup navigation
        this.setupNavigation();

        // Show appropriate screen
        if (isAuthenticated) {
            this.showMainApp();
        } else {
            this.showLogin();
        }

        console.log('POS Application initialized!');
    },

    /**
     * Setup navigation
     */
    setupNavigation() {
        // Sidebar navigation
        Utils.delegate('sidebar-nav', '.nav-item', 'click', function (e) {
            e.preventDefault();
            const screen = this.dataset.screen;
            if (screen) {
                App.navigateTo(screen);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // F1 - POS
            if (e.key === 'F1') {
                e.preventDefault();
                this.navigateTo('pos');
            }
            // F2 - Products
            if (e.key === 'F2') {
                e.preventDefault();
                this.navigateTo('products');
            }
            // F3 - Customers
            if (e.key === 'F3') {
                e.preventDefault();
                this.navigateTo('customers');
            }
            // Escape - Close modal
            if (e.key === 'Escape') {
                Utils.closeModal();
            }
        });
    },

    /**
     * Navigate to screen
     */
    async navigateTo(screen) {
        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.screen === screen);
        });

        // Hide all screens
        document.querySelectorAll('.content-screen').forEach(s => {
            s.classList.remove('active');
        });

        // Show target screen
        const targetScreen = Utils.$(`${screen}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        // Load screen data
        switch (screen) {
            case 'pos':
                await POS.init();
                setTimeout(() => Utils.$('product-search')?.focus(), 100);
                break;
            case 'products':
                await Products.load();
                break;
            case 'customers':
                await Customers.load();
                break;
            case 'workorders':
                await WorkOrders.load();
                break;
            case 'reports':
                await Reports.load();
                break;
        }

        this.currentScreen = screen;
    },

    /**
     * Show main app
     */
    showMainApp() {
        Utils.$('login-screen').classList.remove('active');
        Utils.$('main-app').classList.remove('hidden');

        // Update user info
        Auth.updateUserUI();

        // Navigate to POS
        this.navigateTo('pos');
    },

    /**
     * Show login screen
     */
    showLogin() {
        Utils.$('main-app').classList.add('hidden');
        Utils.$('login-screen').classList.add('active');

        // Reset forms
        Utils.$('login-form').reset();
        Utils.$('login-form').classList.remove('hidden');
        Utils.$('pin-login-form').classList.add('hidden');

        // Focus email input
        setTimeout(() => Utils.$('login-email')?.focus(), 100);
    },

    /**
     * Toggle sidebar (mobile)
     */
    toggleSidebar() {
        Utils.$('sidebar').classList.toggle('open');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export
window.App = App;
