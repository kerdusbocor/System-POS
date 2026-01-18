/**
 * PWA Registration and Installation Handler
 */

const PWA = {
    deferredPrompt: null,
    installButton: null,

    /**
     * Initialize PWA
     */
    init() {
        this.registerServiceWorker();
        this.setupInstallPrompt();
        this.checkOnlineStatus();
    },

    /**
     * Register service worker
     */
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.log('[PWA] Service workers not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });

            console.log('[PWA] Service worker registered:', registration.scope);

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('[PWA] New service worker installing...');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New version available
                        this.showUpdateNotification();
                    }
                });
            });

            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                console.log('[PWA] Message from SW:', event.data);

                if (event.data.type === 'SYNC_COMPLETE') {
                    Utils?.toast?.('Data synced successfully', 'success');
                }
            });

        } catch (error) {
            console.error('[PWA] Service worker registration failed:', error);
        }
    },

    /**
     * Setup install prompt
     */
    setupInstallPrompt() {
        // Capture install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('[PWA] Install prompt captured');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // Detect successful installation
        window.addEventListener('appinstalled', () => {
            console.log('[PWA] App installed');
            this.deferredPrompt = null;
            this.hideInstallButton();
            Utils?.toast?.('App installed successfully!', 'success');
        });
    },

    /**
     * Show install button
     */
    showInstallButton() {
        // Create install button if it doesn't exist
        if (!this.installButton) {
            this.installButton = document.createElement('button');
            this.installButton.id = 'pwa-install-btn';
            this.installButton.className = 'pwa-install-btn';
            this.installButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        <span>Install App</span>
      `;
            this.installButton.addEventListener('click', () => this.promptInstall());

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
        .pwa-install-btn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: white;
          border: none;
          border-radius: 25px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
          z-index: 9999;
          animation: slideUp 0.3s ease;
        }
        .pwa-install-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
        }
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .pwa-offline-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          padding: 10px;
          background: #ef4444;
          color: white;
          text-align: center;
          font-size: 14px;
          z-index: 10000;
        }
        .pwa-update-banner {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 16px;
          background: #1e293b;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10000;
        }
        .pwa-update-banner button {
          padding: 8px 16px;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
      `;
            document.head.appendChild(style);
        }

        document.body.appendChild(this.installButton);
    },

    /**
     * Hide install button
     */
    hideInstallButton() {
        if (this.installButton && this.installButton.parentNode) {
            this.installButton.parentNode.removeChild(this.installButton);
        }
    },

    /**
     * Prompt user to install
     */
    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('[PWA] No install prompt available');
            return;
        }

        console.log('[PWA] Showing install prompt');
        this.deferredPrompt.prompt();

        const { outcome } = await this.deferredPrompt.userChoice;
        console.log('[PWA] User choice:', outcome);

        this.deferredPrompt = null;
        this.hideInstallButton();
    },

    /**
     * Check online status
     */
    checkOnlineStatus() {
        const updateOnlineStatus = () => {
            const isOnline = navigator.onLine;
            console.log('[PWA] Online status:', isOnline);

            // Remove existing banner
            const existingBanner = document.querySelector('.pwa-offline-banner');
            if (existingBanner) {
                existingBanner.remove();
            }

            if (!isOnline) {
                const banner = document.createElement('div');
                banner.className = 'pwa-offline-banner';
                banner.textContent = '⚠️ You are offline. Some features may not be available.';
                document.body.insertBefore(banner, document.body.firstChild);
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        // Initial check
        updateOnlineStatus();
    },

    /**
     * Show update notification
     */
    showUpdateNotification() {
        const banner = document.createElement('div');
        banner.className = 'pwa-update-banner';
        banner.innerHTML = `
      <span>A new version is available!</span>
      <button onclick="PWA.applyUpdate()">Update Now</button>
    `;
        document.body.appendChild(banner);
    },

    /**
     * Apply update
     */
    async applyUpdate() {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
    },

    /**
     * Request notification permission
     */
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('[PWA] Notifications not supported');
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }

        return false;
    },

    /**
     * Check if app is installed
     */
    isInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;
    }
};

// Initialize PWA when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PWA.init());
} else {
    PWA.init();
}

// Export
window.PWA = PWA;
