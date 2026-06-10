// ui-popups.js - Global Premium Popup & Toast Utility
const RNPopups = (() => {
    // Inject HTML on load
    const init = () => {
        if (document.getElementById('rn-popup-container')) return;

        const popupHTML = `
            <div id="rn-popup-container">
                <div class="rn-modal" id="rn-modal-box">
                    <div class="rn-popup-icon" id="rn-popup-icon"></div>
                    <h2 class="rn-popup-title" id="rn-popup-title"></h2>
                    <p class="rn-popup-msg" id="rn-popup-msg"></p>
                    <div class="rn-popup-actions" id="rn-popup-actions"></div>
                </div>
            </div>
            <div id="rn-toast-container"></div>
        `;
        document.body.insertAdjacentHTML('beforeend', popupHTML);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    const showModal = ({ title, message, type = 'success', actions = [] }) => {
        const container = document.getElementById('rn-popup-container');
        const iconEl = document.getElementById('rn-popup-icon');
        const titleEl = document.getElementById('rn-popup-title');
        const msgEl = document.getElementById('rn-popup-msg');
        const actionsEl = document.getElementById('rn-popup-actions');

        // Reset
        iconEl.className = 'rn-popup-icon';
        actionsEl.innerHTML = '';

        // Set Content
        titleEl.textContent = title;
        msgEl.textContent = message;

        // Set Icon Type
        if (type === 'success') {
            iconEl.classList.add('success-icon');
            iconEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        } else if (type === 'error') {
            iconEl.classList.add('error-icon');
            iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
        } else if (type === 'warning') {
            iconEl.classList.add('warn-icon');
            iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        }

        // Add Actions
        if (actions.length === 0) {
            actions.push({ text: 'OK', type: 'primary', callback: () => hide() });
        }

        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = `rn-btn ${action.type === 'danger' ? 'rn-btn-danger' : (action.type === 'primary' ? 'rn-btn-confirm' : 'rn-btn-cancel')}`;
            btn.textContent = action.text;
            btn.onclick = () => {
                if (action.callback) action.callback();
                hide();
            };
            actionsEl.appendChild(btn);
        });

        container.classList.add('active');
    };

    const hide = () => {
        const container = document.getElementById('rn-popup-container');
        container.classList.remove('active');
    };

    const toast = (message, type = 'success', duration = 3000) => {
        const container = document.getElementById('rn-toast-container');
        const toastEl = document.createElement('div');
        toastEl.className = 'rn-toast';
        
        const icon = type === 'success' ? '<i class="fa-solid fa-circle-check" style="color: #10b981;"></i>' : 
                     (type === 'error' ? '<i class="fa-solid fa-circle-xmark" style="color: #ef4444;"></i>' : 
                     '<i class="fa-solid fa-circle-info" style="color: #3b82f6;"></i>');
        
        toastEl.innerHTML = `
            <div class="rn-toast-icon">${icon}</div>
            <div class="rn-toast-msg">${message}</div>
        `;
        
        container.appendChild(toastEl);
        
        setTimeout(() => {
            toastEl.style.animation = 'toastSlideOut 0.4s ease forwards';
            setTimeout(() => toastEl.remove(), 400);
        }, duration);
    };

    return {
        success: (msg) => showModal({ title: 'Success', message: msg, type: 'success' }),
        error: (msg) => showModal({ title: 'Error', message: msg, type: 'error' }),
        warning: (msg) => showModal({ title: 'Warning', message: msg, type: 'warning' }),
        confirm: (title, msg, onConfirm, onCancel, confirmText = 'Confirm', type = 'primary') => {
            showModal({
                title,
                message: msg,
                type: 'warning',
                actions: [
                    { text: 'Cancel', type: 'secondary', callback: onCancel },
                    { text: confirmText, type: type, callback: onConfirm }
                ]
            });
        },
        toast: (msg, type) => toast(msg, type)
    };
})();

// Override native functions to ensure zero browser popups
window.alert = (msg) => RNPopups.success(msg);
window.confirm = (msg) => {
    console.warn("Native confirm() called. Use RNPopups.confirm() for async support. Defaulting to alert behavior for safety.");
    RNPopups.success(msg);
    return true; // Simplified for native override
};
// Note: window.prompt is not overriden as it's rarely used and requires complex sync handling.
window.RNPopups = RNPopups;
