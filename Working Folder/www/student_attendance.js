// student_attendance.js - Premium Attendance Tracking Logic
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const overallPct = document.getElementById('overallPct');
    const attendanceWheel = document.getElementById('attendanceWheel');
    const attendanceStatus = document.getElementById('attendanceStatus');
    const perfMessage = document.getElementById('perfMessage');
    
    const totalClassesEl = document.getElementById('totalClasses');
    const presentCountEl = document.getElementById('presentCount');
    const absentCountEl = document.getElementById('absentCount');
    const lateCountEl = document.getElementById('lateCount');
    
    const historyList = document.getElementById('attendanceHistoryList');
    const filterButtons = document.querySelectorAll('.filter-pill');
    
    let allRecords = [];
    let attendanceChart = null;

    // Initialize Auth
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            console.log("[Auth] Fetching attendance for:", user.uid);
            await loadAttendanceData(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    async function loadAttendanceData(studentID) {
        try {
            // 1. Fetch Student Info (to get course) from cache
            const userData = window.LocalCache.getSync('currentUser') || {};
            const studentCourse = userData.course || "General";

            // 2. Fetch All Attendance Records from cache
            const allLocalRecords = await window.LocalCache.getAll('attendanceRecords');
            allRecords = allLocalRecords.filter(doc => doc.studentID === studentID);

            // Sort by date (newest first)
            allRecords.sort((a, b) => {
                const dateA = a.timestamp ? new Date(a.timestamp) : new Date(a.date);
                const dateB = b.timestamp ? new Date(b.timestamp) : new Date(b.date);
                return dateB - dateA;
            });

            console.log("[LocalCache] Records Found:", allRecords.length);

            // 3. Update UI components
            updateSummaryStats(allRecords);
            renderHistory(allRecords);
            renderAnalytics(allRecords);
            
            // Setup Filter Listeners
            setupFilters();

        } catch (error) {
            console.error("[LocalCache] Error loading attendance data:", error);
        }
    }

    // Connect to Local-First Lifecycle
    document.addEventListener('APP_READY', async (e) => {
        const { role, user, isCached } = e.detail;
        if (role !== 'student') return;
        
        // Fetch and render immediately
        await loadAttendanceData(user.uid || user.id);

        // If this is the cached render, don't double-bind listeners
        if (isCached) return;

        // Bind background sync listeners to auto-update
        window.FirebaseSync.on('ATTENDANCE_UPDATED', () => loadAttendanceData(user.uid || user.id));
    });

    function updateSummaryStats(records) {
        const total = records.length;
        const present = records.filter(r => r.attendanceStatus === 'present').length;
        const absent = records.filter(r => r.attendanceStatus === 'absent').length;
        const late = records.filter(r => r.attendanceStatus === 'late').length;
        
        const pct = total > 0 ? Math.round(((present + (late * 0.5)) / total) * 100) : 0;

        // Animate Numbers
        animateVal(totalClassesEl, total);
        animateVal(presentCountEl, present);
        animateVal(absentCountEl, absent);
        animateVal(lateCountEl, late);
        
        // Update Wheel & Status
        updateProgressWheel(pct);
    }

    function updateProgressWheel(pct) {
        // Percentage Text Animation
        animateVal(overallPct, pct, '%');

        // Color Logic
        let statusText = "Excellent";
        let color = "#10b981"; // Green

        if (pct < 50) {
            statusText = "Low Attendance";
            color = "#ef4444"; // Red
        } else if (pct < 75) {
            statusText = "Warning";
            color = "#f59e0b"; // Yellow
        } else if (pct < 90) {
            statusText = "Good";
        }

        attendanceStatus.textContent = statusText;
        attendanceStatus.style.borderColor = color;
        attendanceStatus.style.color = color;
        attendanceStatus.style.boxShadow = `0 0 10px ${color}33`;

        attendanceWheel.style.setProperty('--wheel-color', color);
        attendanceWheel.setAttribute('stroke-dasharray', `${pct}, 100`);

        // Update Message
        if (pct >= 85) {
            perfMessage.textContent = "Outstanding! Keep maintaining this consistency.";
        } else if (pct >= 75) {
            perfMessage.textContent = "You are doing great. Stay on track!";
        } else {
            perfMessage.textContent = "Attendance is low. Try not to miss upcoming classes.";
        }
    }

    function renderHistory(records) {
        historyList.innerHTML = '';

        if (records.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-clipboard-user"></i>
                    <p>No records found for this period.</p>
                </div>
            `;
            return;
        }

        records.forEach((rec, index) => {
            const date = rec.timestamp?.toDate?.() || new Date(rec.date);
            const status = rec.attendanceStatus || 'absent';
            const item = document.createElement('div');
            item.className = 'history-item';
            item.style.animationDelay = `${index * 0.05}s`;

            const iconClass = status === 'present' ? 'status-present-icon' : (status === 'late' ? 'status-late-icon' : 'status-absent-icon');
            const icon = status === 'present' ? 'fa-check' : (status === 'late' ? 'fa-clock' : 'fa-xmark');
            const badgeClass = `badge-${status}`;

            item.innerHTML = `
                <div class="hist-status-icon ${iconClass}">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="hist-info">
                    <span class="hist-subject">${rec.courseName || 'Class'}</span>
                    <span class="hist-meta">${formatActivityDate(date)}</span>
                </div>
                <span class="hist-status-badge ${badgeClass}">${status}</span>
            `;
            historyList.appendChild(item);
        });
    }

    function renderAnalytics(records) {
        const ctx = document.getElementById('attendanceTrendChart').getContext('2d');
        
        // Group by month/last 7 sessions
        const recent = [...records].reverse().slice(-7);
        const labels = recent.map(r => {
            const d = r.timestamp?.toDate?.() || new Date(r.date);
            return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        });
        
        const data = recent.map(r => {
            if (r.attendanceStatus === 'present') return 100;
            if (r.attendanceStatus === 'late') return 50;
            return 0;
        });

        if (attendanceChart) attendanceChart.destroy();

        attendanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Session Presence',
                    data: data,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#2563eb',
                    pointBorderColor: 'rgba(255,255,255,0.2)',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }
                    }
                }
            }
        });
    }

    function setupFilters() {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const filter = btn.getAttribute('data-filter');
                let filtered = [...allRecords];
                const now = new Date();

                if (filter === 'week') {
                    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    filtered = allRecords.filter(r => (r.timestamp?.toDate?.() || new Date(r.date)) >= lastWeek);
                } else if (filter === 'month') {
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                    filtered = allRecords.filter(r => (r.timestamp?.toDate?.() || new Date(r.date)) >= lastMonth);
                }

                renderHistory(filtered);
            });
        });
    }

    // Helper Functions
    function animateVal(el, target, suffix = '') {
        const current = parseInt(el.textContent) || 0;
        const duration = 1000;
        const start = performance.now();

        function update(now) {
            const progress = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const val = Math.floor(ease * (target - current) + current);
            el.textContent = val + suffix;
            if (progress < 1) requestAnimationFrame(update);
            else el.textContent = target + suffix;
        }
        requestAnimationFrame(update);
    }

    function formatActivityDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        return `${day}-${month}-${year} | ${days[date.getDay()]}`;
    }
});
