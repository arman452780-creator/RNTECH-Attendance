// student_reports.js - Instant Offline-First Reports & Analytics
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const overallPct = document.getElementById('overallPct');
    const attendanceWheel = document.getElementById('attendanceWheel');
    const attendanceStatus = document.getElementById('attendanceStatus');
    const totalClassesEl = document.getElementById('totalClasses');
    const presentCountEl = document.getElementById('presentCount');
    const absentCountEl = document.getElementById('absentCount');
    const lateCountEl = document.getElementById('lateCount');
    const historyList = document.getElementById('historyList');
    const filterButtons = document.querySelectorAll('.filter-pill');

    const subjectList = document.getElementById('subjectAnalyticsList');
    const monthlyList = document.getElementById('monthlyBreakdownList');
    const currentStreakEl = document.getElementById('currentStreak');
    const bestStreakEl = document.getElementById('bestStreak');
    const aiInsightText = document.getElementById('aiInsightText');

    let allRecords = [];
    let attendanceChart = null;
    let studentData = { subjectName: "", subjectHistory: [], courseName: "", batchName: "" };
    let studentUID = "";
    let initialRenderDone = false;

    // ─── INSTANT RENDER FROM CACHE ────────────────────────────────
    document.addEventListener('APP_READY', async (e) => {
        const { role, isCached } = e.detail;
        if (role !== 'student') return;

        if (!initialRenderDone) {
            await renderFromCache();
            initialRenderDone = true;
        }

        if (isCached) return; // Data already fresh, skip re-subscribing

        // Subscribe to live updates only when data changes
        window.FirebaseSync.on('ATTENDANCE_UPDATED', renderFromCache);
        window.FirebaseSync.on('PROFILE_UPDATED', renderFromCache);
    });

    async function renderFromCache() {
        const userData = window.LocalCache.getSync('currentUser');
        if (!userData) return;
        studentUID = userData.uid || userData.id || "";

        // Build student subject data from cached profile
        let history = userData.subjectHistory || [];
        
        // Add all current subjects to history
        let currentSubjects = [];
        if (Array.isArray(userData.subjects) && userData.subjects.length > 0) {
            currentSubjects = userData.subjects;
        } else {
            currentSubjects = [
                userData.subject1 || userData.subjectName || userData.subject || "",
                userData.subject2 || "",
                userData.subject3 || ""
            ];
        }
        currentSubjects.forEach(sub => {
            if (sub && typeof sub === 'string' && sub.trim() !== "" && !history.includes(sub.trim())) {
                history.push(sub.trim());
            }
        });
        const currentSub = history.length > 0 ? history[0] : "";

        let normalizedCourses = Array.isArray(userData.courses) ? userData.courses : (userData.course ? [userData.course] : []);
        const resolvedCourse = normalizedCourses.length > 0 ? normalizedCourses[0] : (userData.course || 'Unassigned');

        studentData = {
            subjectName: currentSub,
            subjectHistory: history,
            currentSubjects: currentSubjects.map(s => (typeof s === 'string' ? s.trim() : "")).filter(Boolean),
            courseName: (resolvedCourse || '').trim(),
            batchName: (userData.batchName || userData.batch || "Unassigned").trim()
        };

        // Load attendance records from IndexedDB cache
        const cachedRecords = studentUID
            ? await window.LocalCache.getByIndex('attendanceRecords', 'studentID', studentUID)
            : [];

        allRecords = cachedRecords.sort((a, b) => {
            const tsA = a._ts || (a.timestamp ? new Date(a.timestamp).getTime() : new Date(a.date || 0).getTime());
            const tsB = b._ts || (b.timestamp ? new Date(b.timestamp).getTime() : new Date(b.date || 0).getTime());
            return tsB - tsA;
        });

        refreshUI();
    }

    function refreshUI() {
        calculateSummaryStats(allRecords);
        renderHistory(allRecords);
        renderAnalytics(allRecords);
        updateSubjectWisePerformance(allRecords);
        renderMonthlyBreakdown(allRecords);
        setupFilters();
    }

    function calculateSummaryStats(records) {
        const total = records.length;
        const present = records.filter(r => r.attendanceStatus === 'present').length;
        const absent = records.filter(r => r.attendanceStatus === 'absent').length;
        const late = records.filter(r => r.attendanceStatus === 'late').length;
        const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

        animateNumber(totalClassesEl, total);
        animateNumber(presentCountEl, present);
        animateNumber(absentCountEl, absent);
        animateNumber(lateCountEl, late);
        updatePerformanceWheel(pct);
    }

    function updatePerformanceWheel(pct) {
        animateNumber(overallPct, pct, '%');
        let statusText = "Excellent";
        let color = "#10b981";
        if (pct < 50) { statusText = "Critical"; color = "#ef4444"; }
        else if (pct < 75) { statusText = "Warning"; color = "#f59e0b"; }
        else if (pct < 90) { statusText = "Good"; }

        if (attendanceStatus) {
            attendanceStatus.textContent = statusText;
            attendanceStatus.style.borderColor = color;
            attendanceStatus.style.color = color;
            attendanceStatus.style.boxShadow = `0 0 10px ${color}33`;
        }
        if (attendanceWheel) {
            attendanceWheel.style.setProperty('--wheel-color', color);
            attendanceWheel.setAttribute('stroke-dasharray', `${pct}, 100`);
        }
    }

    function updateSubjectWisePerformance(records) {
        if (!subjectList) return;
        
        // Extract any subjects from records that might not be in the profile history
        let allSubjects = new Set(studentData.subjectHistory.filter(Boolean));
        records.forEach(r => {
            const recSub = (r.subjectName || r.subject || "").trim();
            if (recSub) {
                // Find case-insensitive match or add new
                const exists = Array.from(allSubjects).find(s => s.toLowerCase() === recSub.toLowerCase());
                if (!exists) allSubjects.add(recSub);
            }
        });
        
        let history = Array.from(allSubjects);
        const allStats = [];

        const currentSubjectsNorm = (studentData.currentSubjects || []).map(s => s.toLowerCase());

        // Sort so that current subjects appear first, then sort alphabetically
        history.sort((a, b) => {
            const aNorm = a.toLowerCase().trim();
            const bNorm = b.toLowerCase().trim();
            const aIsCurrent = currentSubjectsNorm.includes(aNorm);
            const bIsCurrent = currentSubjectsNorm.includes(bNorm);

            if (aIsCurrent && !bIsCurrent) return -1;
            if (!aIsCurrent && bIsCurrent) return 1;
            return a.localeCompare(b);
        });

        subjectList.innerHTML = ''; // Clear previous items to avoid duplicates
        history.forEach(subName => {
            const normalizedSub = subName.toLowerCase().trim();
            const isCurrentSubject = currentSubjectsNorm.includes(normalizedSub);

            const filteredAttendance = records.filter(r => {
                const recSub = (r.subjectName || r.subject || "").toLowerCase().trim();
                if (recSub === normalizedSub) return true;
                
                // If it's a currently assigned subject, count ALL of the student's records towards it
                if (isCurrentSubject) return true;

                return false;
            });

            const stats = {
                displayName: subName,
                present: filteredAttendance.filter(r => r.attendanceStatus === 'present').length,
                late: filteredAttendance.filter(r => r.attendanceStatus === 'late').length,
                absent: filteredAttendance.filter(r => r.attendanceStatus === 'absent').length,
                total: filteredAttendance.length
            };
            stats.percentage = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;
            allStats.push(stats);

            const cardID = `subject-card-${normalizedSub.replace(/\s+/g, '-')}`;
            let card = document.getElementById(cardID);
            if (!card) {
                card = document.createElement('div');
                card.id = cardID;
                card.className = 'subject-card';
                subjectList.appendChild(card);
            }
            renderSubjectCardContent(card, stats);
        });

        updateStreaks(records);
        generateInsights(records, allStats);
    }

    function renderSubjectCardContent(card, stats) {
        const pct = stats.percentage;
        let color = "#10b981";
        let glow = "rgba(16, 185, 129, 0.3)";
        if (pct < 50) { color = "#ef4444"; glow = "rgba(239, 68, 68, 0.3)"; }
        else if (pct < 75) { color = "#f59e0b"; glow = "rgba(245, 158, 11, 0.3)"; }

        card.style.setProperty('--sub-color', color);
        card.style.setProperty('--sub-glow', glow);
        card.innerHTML = `
            <div class="sub-header">
                <div style="display: flex; flex-direction: column;">
                    <span class="sub-name">${stats.displayName.toUpperCase()}</span>
                    <span style="font-size: 10px; color: var(--text-muted);">SUBJECT ATTENDANCE</span>
                </div>
                <span class="sub-pct">${pct}%</span>
            </div>
            <div class="sub-progress-container">
                <div class="sub-progress-bar" style="width: ${pct}%"></div>
            </div>
            <div class="sub-stats">
                <div class="sub-stat-item"><span class="sub-stat-val">${stats.total}</span><span class="sub-stat-lbl">Total</span></div>
                <div class="sub-stat-item"><span class="sub-stat-val">${stats.present}</span><span class="sub-stat-lbl">Pres</span></div>
                <div class="sub-stat-item"><span class="sub-stat-val">${stats.late}</span><span class="sub-stat-lbl">Late</span></div>
                <div class="sub-stat-item"><span class="sub-stat-val">${stats.absent}</span><span class="sub-stat-lbl">Abs</span></div>
            </div>
        `;
    }

    function renderMonthlyBreakdown(records) {
        if (!monthlyList) return;
        monthlyList.innerHTML = '';
        if (records.length === 0) return;

        const monthlyData = {};
        records.forEach(r => {
            const date = r._ts ? new Date(r._ts) : (r.timestamp ? new Date(r.timestamp) : new Date(r.date || 0));
            const monthName = date.toLocaleString('default', { month: 'long' });
            const key = `${monthName} ${date.getFullYear()}`;
            const sortKey = date.getFullYear() * 100 + date.getMonth();
            if (!monthlyData[key]) monthlyData[key] = { name: key, sortKey, present: 0, absent: 0, late: 0, total: 0 };
            monthlyData[key].total++;
            if (r.attendanceStatus === 'present') monthlyData[key].present++;
            else if (r.attendanceStatus === 'late') monthlyData[key].late++;
            else if (r.attendanceStatus === 'absent') monthlyData[key].absent++;
        });

        const groupedMonths = Object.values(monthlyData).sort((a, b) => b.sortKey - a.sortKey);
        groupedMonths.forEach((stats, index) => {
            const pct = Math.round(((stats.present + stats.late) / stats.total) * 100);
            let trend = "up", trendIcon = "fa-arrow-trend-up";
            if (index < groupedMonths.length - 1) {
                const prev = groupedMonths[index + 1];
                const prevPct = Math.round(((prev.present + prev.late) / prev.total) * 100);
                if (pct < prevPct) { trend = "down"; trendIcon = "fa-arrow-trend-down"; }
            }
            let color = "#10b981";
            if (pct < 50) color = "#ef4444";
            else if (pct < 75) color = "#f59e0b";

            const item = document.createElement('div');
            item.className = 'month-item premium-card';
            item.innerHTML = `
                <div class="month-main-info">
                    <span class="month-name">${stats.name}</span>
                    <span class="month-pct" style="color: ${color}">${pct}%</span>
                </div>
                <div class="month-trend trend-${trend}">
                    <i class="fa-solid ${trendIcon}"></i>
                    <span>${trend === 'up' ? 'Improving' : 'Declining'}</span>
                </div>
            `;
            monthlyList.appendChild(item);
        });
    }

    function updateStreaks(records) {
        const sortedAsc = [...records].sort((a, b) => {
            const dA = a._ts || (a.timestamp ? new Date(a.timestamp).getTime() : new Date(a.date || 0).getTime());
            const dB = b._ts || (b.timestamp ? new Date(b.timestamp).getTime() : new Date(b.date || 0).getTime());
            return dA - dB;
        });
        let bestStreak = 0, tempStreak = 0, currentStreak = 0;
        sortedAsc.forEach(r => {
            if (r.attendanceStatus === 'present' || r.attendanceStatus === 'late') {
                tempStreak++;
                if (tempStreak > bestStreak) bestStreak = tempStreak;
            } else tempStreak = 0;
        });
        const sortedDesc = [...sortedAsc].reverse();
        for (let i = 0; i < sortedDesc.length; i++) {
            if (sortedDesc[i].attendanceStatus === 'present' || sortedDesc[i].attendanceStatus === 'late') currentStreak++;
            else break;
        }
        animateNumber(currentStreakEl, currentStreak);
        animateNumber(bestStreakEl, bestStreak);
    }

    function generateInsights(records, allStats) {
        if (!aiInsightText) return;
        const lowSubs = allStats.filter(s => s.total > 0 && s.percentage < 75);
        let insight = "Your attendance is consistent. Keep it up!";
        if (lowSubs.length > 0) insight = `${lowSubs[0].displayName} attendance is below 75%. Prioritize this subject!`;
        aiInsightText.textContent = insight;
    }

    function renderHistory(records) {
        if (!historyList) return;
        historyList.innerHTML = '';
        records.forEach(rec => {
            const date = rec._ts ? new Date(rec._ts) : (rec.timestamp ? new Date(rec.timestamp) : new Date(rec.date || 0));
            const status = rec.attendanceStatus || 'absent';
            const item = document.createElement('div');
            item.className = 'report-item';
            const iconClass = status === 'present' ? 'status-present-icon' : (status === 'late' ? 'status-late-icon' : 'status-absent-icon');
            const icon = status === 'present' ? 'fa-check' : (status === 'late' ? 'fa-clock' : 'fa-xmark');
            item.innerHTML = `
                <div class="report-status-icon ${iconClass}"><i class="fa-solid ${icon}"></i></div>
                <div class="report-info">
                    <span class="report-subject">${(rec.subjectName || rec.subject || rec.className || 'Class').toUpperCase()}</span>
                    <span class="report-meta"><i class="fa-regular fa-calendar"></i> ${formatReportDate(date)}</span>
                </div>
                <span class="report-badge badge-${status}">${status}</span>
            `;
            historyList.appendChild(item);
        });
    }

    function renderAnalytics(records) {
        const chartEl = document.getElementById('attendanceTrendChart');
        if (!chartEl) return;
        const ctx = chartEl.getContext('2d');
        const recent = [...records].reverse().slice(-7);
        const labels = recent.map(r => {
            const d = r._ts ? new Date(r._ts) : (r.timestamp ? new Date(r.timestamp) : new Date(r.date || 0));
            return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        });
        const data = recent.map(r => (r.attendanceStatus === 'present' || r.attendanceStatus === 'late') ? 100 : 0);
        if (attendanceChart) attendanceChart.destroy();
        attendanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{ label: 'Attendance', data, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#2563eb' }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } }
                }
            }
        });
    }

    function setupFilters() {
        filterButtons.forEach(btn => {
            btn.onclick = () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filter = btn.getAttribute('data-filter');
                let filtered = [...allRecords];
                const now = new Date();
                const getDate = r => r._ts ? new Date(r._ts) : (r.timestamp ? new Date(r.timestamp) : new Date(r.date || 0));
                if (filter === 'week') filtered = allRecords.filter(r => getDate(r) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
                else if (filter === 'month') filtered = allRecords.filter(r => getDate(r) >= new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()));
                else if (filter === 'today') filtered = allRecords.filter(r => getDate(r).toLocaleDateString() === now.toLocaleDateString());
                renderHistory(filtered);
            };
        });
    }

    function animateNumber(el, target, suffix = '') {
        if (!el) return;
        const current = parseInt(el.textContent) || 0;
        const duration = 600;
        const start = performance.now();
        function update(now) {
            const progress = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(ease * (target - current) + current) + suffix;
            if (progress < 1) requestAnimationFrame(update);
            else el.textContent = target + suffix;
        }
        requestAnimationFrame(update);
    }

    function formatReportDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        return `${day}-${months[date.getMonth()]}-${date.getFullYear()} | ${days[date.getDay()]}`;
    }
});
