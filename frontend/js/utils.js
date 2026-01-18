/**
 * Utility Functions
 */

const Utils = {
    /**
     * Format currency
     */
    formatCurrency(amount, currency = 'IDR') {
        const num = Number(amount) || 0;
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num);
    },

    /**
     * Format date
     */
    formatDate(date, format = 'short') {
        const d = new Date(date);
        if (format === 'short') {
            return d.toLocaleDateString('id-ID');
        }
        if (format === 'time') {
            return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        }
        if (format === 'full') {
            return d.toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        return d.toISOString();
    },

    /**
     * Get today's date in YYYY-MM-DD format
     */
    today() {
        return new Date().toISOString().split('T')[0];
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Show toast notification
     */
    toast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '<svg class="toast-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
            error: '<svg class="toast-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
            warning: '<svg class="toast-icon" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
            info: '<svg class="toast-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
        };

        toast.innerHTML = `
      ${icons[type] || icons.info}
      <span class="toast-message">${message}</span>
    `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * Show modal
     */
    showModal(content, options = {}) {
        const overlay = document.getElementById('modal-overlay');
        const container = document.getElementById('modal-container');

        container.innerHTML = content;
        container.style.maxWidth = options.width || '500px';
        overlay.classList.remove('hidden');

        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay && options.closeOnClickOutside !== false) {
                Utils.closeModal();
            }
        };

        // Close on escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                Utils.closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        return container;
    },

    /**
     * Close modal
     */
    closeModal() {
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.add('hidden');
    },

    /**
     * Confirm dialog
     */
    confirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            const content = `
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
          <button class="btn btn-primary" id="confirm-yes">Confirm</button>
        </div>
      `;
            Utils.showModal(content);

            document.getElementById('confirm-yes').onclick = () => {
                Utils.closeModal();
                resolve(true);
            };
        });
    },

    /**
     * Prompt dialog
     */
    prompt(message, defaultValue = '', title = 'Input') {
        return new Promise((resolve) => {
            const content = `
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>${message}</label>
            <input type="text" id="prompt-input" class="form-control" value="${defaultValue}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
          <button class="btn btn-primary" id="prompt-ok">OK</button>
        </div>
      `;
            Utils.showModal(content);

            const input = document.getElementById('prompt-input');
            input.focus();
            input.select();

            document.getElementById('prompt-ok').onclick = () => {
                Utils.closeModal();
                resolve(input.value);
            };

            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    Utils.closeModal();
                    resolve(input.value);
                }
            };
        });
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Get element by ID
     */
    $(id) {
        return document.getElementById(id);
    },

    /**
     * Query selector
     */
    $$(selector) {
        return document.querySelectorAll(selector);
    },

    /**
     * Add event listener helper
     */
    on(element, event, handler) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.addEventListener(event, handler);
        }
    },

    /**
     * Delegate event
     */
    delegate(parent, selector, event, handler) {
        if (typeof parent === 'string') {
            parent = document.getElementById(parent);
        }
        if (parent) {
            parent.addEventListener(event, (e) => {
                const target = e.target.closest(selector);
                if (target && parent.contains(target)) {
                    handler.call(target, e);
                }
            });
        }
    },

    /**
     * Local storage helpers
     */
    storage: {
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch {
                return defaultValue;
            }
        },

        set(key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        },

        remove(key) {
            localStorage.removeItem(key);
        }
    }
};

// Export
window.Utils = Utils;
