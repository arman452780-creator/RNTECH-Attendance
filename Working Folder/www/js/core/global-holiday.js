// js/core/global-holiday.js
// Handles real-time listening and rendering of global class status (Holiday/Closed)

window.GlobalHolidayState = {
    isActive: false,
    data: null,
    listeners: []
};

// Immediately load cached state to prevent UI flashes on initial load
try {
    const cached = localStorage.getItem('GlobalHolidayState');
    if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.data) {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            if (parsed.data.active && todayStr >= parsed.data.startDate && todayStr <= parsed.data.endDate) {
                window.GlobalHolidayState.isActive = true;
            }
            window.GlobalHolidayState.data = parsed.data;
        }
    }
} catch(e) {
    console.error("Error loading cached holiday state", e);
}

document.addEventListener('DOMContentLoaded', () => {
    // Inject custom styles for the announcement card
    const style = document.createElement('style');
    style.innerHTML = `
        .global-announcement-card {
            background: linear-gradient(135deg, rgba(30, 58, 138, 0.9), rgba(15, 23, 42, 0.95));
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 20px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            position: relative;
            overflow: hidden;
            animation: slideDownFade 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .global-announcement-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; height: 4px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
        }
        .gac-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }
        .gac-icon {
            font-size: 28px;
            color: #60a5fa;
            text-shadow: 0 0 15px rgba(96, 165, 250, 0.6);
        }
        .gac-title {
            font-size: 20px;
            font-weight: 800;
            color: #fff;
            margin: 0;
            letter-spacing: 0.5px;
        }
        .gac-badge {
            margin-left: auto;
            background: rgba(239, 68, 68, 0.2);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.3);
            padding: 4px 10px;
            border-radius: 100px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .gac-badge.holiday {
            background: rgba(16, 185, 129, 0.2);
            color: #34d399;
            border-color: rgba(16, 185, 129, 0.3);
        }
        .gac-reason {
            color: #cbd5e1;
            font-size: 15px;
            line-height: 1.5;
            margin-bottom: 16px;
        }
        .gac-dates {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            background: rgba(0, 0, 0, 0.3);
            padding: 8px 16px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            color: #94a3b8;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .gac-dates i {
            color: #3b82f6;
        }
        @keyframes slideDownFade {
            from { opacity: 0; transform: translateY(-20px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        
        /* FESTIVAL BACKGROUND SYSTEM */
        .gac-content-layer {
            position: relative;
            z-index: 2;
        }
        .gac-background-layer {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 0;
            overflow: hidden;
            border-radius: 20px;
        }
        .gac-overlay {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.5);
            backdrop-filter: blur(2px);
            z-index: 1;
        }
        
        .theme-default { background: linear-gradient(135deg, rgba(30, 58, 138, 0.9), rgba(15, 23, 42, 0.95)); }
                /* THEME: EID */
        .theme-eid { background: linear-gradient(to bottom, #0f172a, #1e3a8a); }
        .theme-eid ~ .gac-content-layer .gac-icon { color: #fde047; text-shadow: 0 0 20px rgba(253, 224, 71, 0.6); }
        .theme-eid ~ .gac-content-layer .gac-badge { background: rgba(34, 197, 94, 0.2); color: #4ade80; border-color: rgba(34, 197, 94, 0.3); }
        .theme-eid .moon {
            position: absolute; top: -30px; right: 10px; width: 140px; height: 140px;
            border-radius: 50%; box-shadow: 20px 20px 0 0 rgba(253, 224, 71, 0.15);
            animation: float 6s ease-in-out infinite;
        }
        .theme-eid .star {
            position: absolute; width: 4px; height: 4px; background: #fff; border-radius: 50%;
            animation: twinkle 3s infinite;
        }
        
        /* THEME: DIWALI */
        .theme-diwali { background: linear-gradient(135deg, #450a0a, #7f1d1d); }
        .theme-diwali ~ .gac-content-layer .gac-icon { color: #fbbf24; text-shadow: 0 0 20px rgba(251, 191, 36, 0.8); }
        .theme-diwali ~ .gac-content-layer .gac-badge { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3); }
        .theme-diwali .spark {
            position: absolute; width: 5px; height: 5px; background: #fbbf24; border-radius: 50%;
            box-shadow: 0 0 12px #fbbf24, 0 0 20px #f59e0b;
            animation: rise 3s linear infinite;
        }
        
        /* THEME: HOLI */
        .theme-holi { background: #0f172a; }
        .theme-holi ~ .gac-content-layer .gac-icon { color: #ec4899; text-shadow: 0 0 20px rgba(236, 72, 153, 0.6); }
        .theme-holi ~ .gac-content-layer .gac-badge { background: rgba(236, 72, 153, 0.2); color: #f472b6; border-color: rgba(236, 72, 153, 0.3); }
        .theme-holi .powder {
            position: absolute; border-radius: 50%; filter: blur(40px); opacity: 0.6;
            animation: float 8s ease-in-out infinite;
        }
        
        /* THEME: CHRISTMAS */
        .theme-christmas { background: linear-gradient(135deg, #064e3b, #7f1d1d); }
        .theme-christmas ~ .gac-content-layer .gac-icon { color: #ef4444; text-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
        .theme-christmas ~ .gac-content-layer .gac-badge { background: rgba(239, 68, 68, 0.2); color: #f87171; border-color: rgba(239, 68, 68, 0.3); }
        .theme-christmas .snow {
            position: absolute; width: 6px; height: 6px; background: #fff; border-radius: 50%;
            filter: blur(1px);
            animation: snowFall 4s linear infinite;
        }

        /* THEME: INDEPENDENCE */
        .theme-independence { background: linear-gradient(135deg, #ea580c 0%, #ffffff 50%, #16a34a 100%); background-size: 200% 200%; animation: gradientShift 10s ease infinite; }
        .theme-independence ~ .gac-content-layer .gac-icon { color: #f8fafc; text-shadow: 0 0 20px rgba(255, 255, 255, 0.8); }
        .theme-independence ~ .gac-content-layer .gac-badge { background: rgba(234, 88, 12, 0.2); color: #fb923c; border-color: rgba(234, 88, 12, 0.3); }
        .theme-independence .gac-overlay { background: rgba(15, 23, 42, 0.85); }

        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
        }
        @keyframes twinkle {
            0%, 100% { opacity: 0.2; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.5); box-shadow: 0 0 10px #fff; }
        }
        @keyframes rise {
            0% { transform: translateY(150px) scale(0); opacity: 0; }
            30% { opacity: 1; }
            100% { transform: translateY(-100px) scale(1); opacity: 0; }
        }
        @keyframes snowFall {
            0% { transform: translateY(-50px) translateX(0); opacity: 0; }
            20% { opacity: 1; }
            100% { transform: translateY(150px) translateX(30px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // Ensure firebase is loaded
    if (typeof firebase === 'undefined') return;

    const db = firebase.firestore();

    const checkGlobalStatus = (data) => {
        if (!data || !data.active) return false;

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        if (todayStr >= data.startDate && todayStr <= data.endDate) {
            return true;
        }
        return false;
    };

    const renderAnnouncementCard = (data) => {
        const container = document.getElementById('globalAnnouncementCard');
        if (!container) return;

        if (!window.GlobalHolidayState.isActive) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';

        const formatDate = (dateStr) => {
            const [y, m, d] = dateStr.split('-');
            return `${d}-${m}-${y}`;
        };

        const isHoliday = data.statusType === 'holiday';
        const titleLower = data.title ? data.title.toLowerCase() : '';
        
        let iconClass = isHoliday ? 'fa-solid fa-umbrella-beach' : 'fa-solid fa-door-closed';
        let themeClass = 'theme-default';
        let particlesHTML = '';

        if (isHoliday && data.title) {
            if (/(diwali|dussehra|navratri)/i.test(titleLower)) {
                iconClass = 'fa-solid fa-fire-flame-curved';
                themeClass = 'theme-diwali';
                particlesHTML = `
                    <div class="spark" style="left:15%; animation-delay:0s; animation-duration: 3s;"></div>
                    <div class="spark" style="left:35%; animation-delay:1s; animation-duration: 4s;"></div>
                    <div class="spark" style="left:65%; animation-delay:2s; animation-duration: 2.5s;"></div>
                    <div class="spark" style="left:85%; animation-delay:0.5s; animation-duration: 3.5s;"></div>
                `;
            } else if (/(eid|ramadan|muharram|bakrid|milad)/i.test(titleLower)) {
                iconClass = 'fa-solid fa-moon';
                themeClass = 'theme-eid';
                particlesHTML = `
                    <div class="moon"></div>
                    <div class="star" style="top:20%; left:20%; animation-delay:0s;"></div>
                    <div class="star" style="top:60%; left:80%; animation-delay:1s;"></div>
                    <div class="star" style="top:75%; left:30%; animation-delay:0.5s;"></div>
                    <div class="star" style="top:30%; left:60%; animation-delay:1.5s;"></div>
                `;
            } else if (/(holi|rang)/i.test(titleLower)) {
                iconClass = 'fa-solid fa-palette';
                themeClass = 'theme-holi';
                particlesHTML = `
                    <div class="powder" style="top:-60px; left:-40px; width:180px; height:180px; background:#ec4899;"></div>
                    <div class="powder" style="bottom:-50px; right:-20px; width:220px; height:220px; background:#3b82f6; animation-delay:2s;"></div>
                    <div class="powder" style="top:10px; right:30%; width:120px; height:120px; background:#eab308; animation-delay:4s;"></div>
                `;
            } else if (/(christmas|easter|good friday)/i.test(titleLower)) {
                iconClass = 'fa-solid fa-gift';
                themeClass = 'theme-christmas';
                particlesHTML = `
                    <div class="snow" style="left:10%; animation-delay:0s; animation-duration: 4s;"></div>
                    <div class="snow" style="left:40%; animation-delay:2s; animation-duration: 5s;"></div>
                    <div class="snow" style="left:70%; animation-delay:1s; animation-duration: 3s;"></div>
                    <div class="snow" style="left:90%; animation-delay:3s; animation-duration: 6s;"></div>
                `;
            } else if (/(independence|republic)/i.test(titleLower)) {
                iconClass = 'fa-solid fa-flag';
                themeClass = 'theme-independence';
            } else if (/(guru|baisakhi|lohri)/i.test(titleLower)) {
                iconClass = 'fa-solid fa-wheat-awn';
            } else if (/(shivratri|raksha|janmashtami|ganesh|puja|makar|pongal)/i.test(titleLower)) {
                iconClass = 'fa-solid fa-sun';
            }
        }
        
        const badgeClass = isHoliday ? 'holiday' : 'closed';
        const displayType = isHoliday ? 'HOLIDAY' : (data.statusType === 'cancelled' ? 'CANCELLED' : 'CLOSED');

        container.innerHTML = `
            <div class="global-announcement-card" style="background: transparent;">
                <div class="gac-background-layer ${themeClass}">
                    ${particlesHTML}
                    <div class="gac-overlay"></div>
                </div>
                <div class="gac-content-layer">
                    <div class="gac-header">
                        <i class="${iconClass} gac-icon"></i>
                        <h3 class="gac-title">${data.title || 'Classes are Closed'}</h3>
                        <span class="gac-badge ${badgeClass}">${displayType}</span>
                    </div>
                    <p class="gac-reason">${data.reason || 'Reason: Not specified'}</p>
                    <div class="gac-dates">
                        <i class="fa-regular fa-calendar"></i>
                        <span>${formatDate(data.startDate)} &rarr; ${formatDate(data.endDate)}</span>
                    </div>
                </div>
            </div>
        `;
    };

    // Initial render from cache to avoid visual lag
    if (window.GlobalHolidayState.data) {
        renderAnnouncementCard(window.GlobalHolidayState.data);
    }

    // Listen to Firebase
    db.collection('globalSettings').doc('classStatus').onSnapshot((doc) => {
        const data = doc.exists ? doc.data() : null;
        const isActive = checkGlobalStatus(data);
        
        window.GlobalHolidayState.isActive = isActive;
        window.GlobalHolidayState.data = data;
        
        try {
            if (data) {
                localStorage.setItem('GlobalHolidayState', JSON.stringify({ data }));
            } else {
                localStorage.removeItem('GlobalHolidayState');
            }
        } catch(e) {}
        
        renderAnnouncementCard(data);

        // Dispatch custom event
        const event = new CustomEvent('GLOBAL_HOLIDAY_UPDATED', { detail: { isActive, data } });
        document.dispatchEvent(event);
    }, (error) => {
        console.error("Global Holiday Listener Error:", error);
    });
});
