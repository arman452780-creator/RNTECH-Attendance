// theme-system.js - Global RN-TECH Theme Studio Management
(function() {
    const PRESET_THEMES = [
        { id: 'dark-blue', name: 'RN Dark Blue', color: '#2563eb', glow: 'rgba(37, 99, 235, 0.3)' },
        { id: 'neon-purple', name: 'Neon Purple', color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.3)' },
        { id: 'emerald-tech', name: 'Emerald Tech', color: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' },
        { id: 'crimson-red', name: 'Crimson Red', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)' },
        { id: 'midnight-black', name: 'Midnight Black', color: '#111111', glow: 'rgba(255, 255, 255, 0.2)' }
    ];

    const applyTheme = (themeId, customData = null) => {
        // Trigger lightweight flash animation
        document.body.classList.add('theme-transition-active');

        // Apply theme immediately — no delay, instant CSS variable update
        if (themeId === 'custom' && customData) {
            document.documentElement.setAttribute('data-theme', 'custom');
            Object.keys(customData).forEach(key => {
                document.documentElement.style.setProperty(`--${key}`, customData[key]);
            });
            localStorage.setItem('rn-tech-custom-theme', JSON.stringify(customData));
        } else {
            document.documentElement.setAttribute('data-theme', themeId);
            document.documentElement.removeAttribute('style'); // Clear custom overrides
            localStorage.removeItem('rn-tech-custom-theme');
        }

        localStorage.setItem('rn-tech-theme', themeId);
        updateSelectorUI(themeId);

        // Remove transition class after animation completes (matches 0.35s animation)
        setTimeout(() => {
            document.body.classList.remove('theme-transition-active');
        }, 400);
    };

    const updateSelectorUI = (activeId) => {
        document.querySelectorAll('.theme-card').forEach(card => {
            if (card.dataset.theme === activeId) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    };

    const getSavedTheme = () => {
        return localStorage.getItem('rn-tech-theme') || 'dark-blue';
    };

    const getCustomData = () => {
        const data = localStorage.getItem('rn-tech-custom-theme');
        return data ? JSON.parse(data) : null;
    };

    // Initial Apply (Blocking)
    const savedThemeId = getSavedTheme();
    if (savedThemeId === 'custom') {
        const customData = getCustomData();
        if (customData) {
            document.documentElement.setAttribute('data-theme', 'custom');
            Object.keys(customData).forEach(key => {
                document.documentElement.style.setProperty(`--${key}`, customData[key]);
            });
        }
    } else {
        document.documentElement.setAttribute('data-theme', savedThemeId);
    }

    // Global exposed utility
    window.RNTheme = {
        apply: applyTheme,
        current: getSavedTheme,
        customData: getCustomData,
        presets: PRESET_THEMES
    };

    // Setup UI on load
    document.addEventListener('DOMContentLoaded', () => {
        // Create Theme Transition Overlay
        if (!document.querySelector('.theme-transition-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'theme-transition-overlay';
            document.body.appendChild(overlay);
        }

        const themeContainer = document.getElementById('themeSelectorContainer');
        if (themeContainer) {
            renderThemeSelector(themeContainer);
        }
        // Note: mousemove ambient glow removed — too expensive on mobile/Android
    });

    function renderThemeSelector(container) {
        container.innerHTML = '';
        const current = getSavedTheme();
        
        PRESET_THEMES.forEach(theme => {
            const card = document.createElement('div');
            card.className = `theme-card ${theme.id === current ? 'active' : ''}`;
            card.dataset.theme = theme.id;
            card.style.setProperty('--theme-color', theme.color);
            card.style.setProperty('--theme-glow', theme.glow);
            card.innerHTML = `
                <div class="theme-card-preview" style="background: ${theme.color}">
                    <div class="theme-card-inner-glow"></div>
                </div>
                <span class="theme-card-name">${theme.name}</span>
            `;
            card.onclick = () => applyTheme(theme.id);
            container.appendChild(card);
        });

        // Add Customize Card
        const customCard = document.createElement('div');
        customCard.className = `theme-card customize-card ${current === 'custom' ? 'active' : ''}`;
        customCard.dataset.theme = 'custom';
        customCard.innerHTML = `
            <div class="theme-card-preview customize-preview">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <span class="theme-card-name">Custom Studio</span>
        `;
        customCard.onclick = () => {
            if (window.openThemeStudio) window.openThemeStudio();
        };
        container.appendChild(customCard);
    }
})();

