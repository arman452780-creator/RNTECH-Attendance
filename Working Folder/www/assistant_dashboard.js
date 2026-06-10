// assistant_dashboard.js - Local-First Architecture

document.addEventListener('DOMContentLoaded', () => {
    // 1. UI Elements
    const greetingText = document.getElementById('greetingText');
    const teacherNameHeader = document.getElementById('teacherNameHeader');
    const headerAvatar = document.getElementById('headerAvatar');
    const dashboardDate = document.getElementById('dashboardDate');
    const logoutNavBtn = document.getElementById('logoutNavBtn');
    const logoutAvatar = document.getElementById('logoutAvatar');
    
    // Set Current Date & Session Tracking
    let currentSessionDate = new Date().toISOString().split('T')[0];
    let cachedClasses = [];
    let liveTimerInterval = null;

    const updateHeaderDate = () => {
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        if (dashboardDate) dashboardDate.textContent = new Date().toLocaleDateString('en-US', options);
    };
    updateHeaderDate();

    const hour = new Date().getHours();
    if (greetingText) {
        if (hour < 12) greetingText.textContent = "Good Morning,";
        else if (hour < 17) greetingText.textContent = "Good Afternoon,";
        else greetingText.textContent = "Good Evening,";
    }

    // 2. Core Logic Helpers
    const formatTime12 = (time24) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':');
        let h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${minutes} ${ampm}`;
    };

    const calculateStatus = (classData) => {
        if (window.GlobalHolidayState && window.GlobalHolidayState.isActive && window.GlobalHolidayState.data) {
            return { status: 'holiday', timeLeft: '' };
        }
        const { startTime, endTime, recurringDays } = classData;
        if (!startTime || !endTime) return { status: 'upcoming', timeLeft: '' };
        const now = new Date();
        const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayShort = daysShort[now.getDay()];
        let isClassToday = false;
        if (!recurringDays) isClassToday = false;
        else if (Array.isArray(recurringDays)) isClassToday = recurringDays.some(d => d.trim().toLowerCase().startsWith(todayShort.toLowerCase()));
        if (!isClassToday) return { status: 'no-class', timeLeft: '' };
        const parseTime = (timeStr) => {
            if (!timeStr) return null;
            const parts = timeStr.trim().split(/\s+|(?=[AP]M)/i);
            const timePart = parts[0];
            const meridiem = (parts[1] || '').toUpperCase();
            let [hours, minutes] = timePart.split(':').map(Number);
            if (meridiem === 'PM' && hours < 12) hours += 12;
            else if (meridiem === 'AM' && hours === 12) hours = 0;
            const d = new Date(now);
            d.setHours(hours, minutes, 0, 0);
            return d;
        };
        const start = parseTime(startTime);
        const end = parseTime(endTime);
        if (!start || !end) return { status: 'upcoming', timeLeft: '' };
        const startPlus5 = new Date(start.getTime() + 5 * 60000);
        let result = { status: 'upcoming', timeLeft: '' };
        if (now >= startPlus5 && now <= end) {
            const diffMs = end - now;
            const m = Math.floor(diffMs / 60000);
            result = { status: 'live', timeLeft: `${m}m` };
        } else if (now >= start && now < startPlus5) {
            result = { status: 'transition', timeLeft: '' };
        } else if (now > end) {
            result = { status: 'done', timeLeft: '' };
        } else {
            const diffMs = start - now;
            const diffMins = diffMs / (1000 * 60);
            if (diffMins > 0 && diffMins <= 30) {
                const m = Math.floor(diffMs / 60000);
                const s = Math.floor((diffMs % 60000) / 1000);
                const timeLeft = `${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
                if (diffMins <= 5) result = { status: 'countdown-urgent', timeLeft };
                else result = { status: 'countdown', timeLeft };
            }
        }
        return result;
    };

    // 3. Render Functions
    const renderProfile = () => {
        const data = window.LocalCache.getSync('currentUser');
        if (!data) return;
        if (teacherNameHeader) teacherNameHeader.textContent = data.name || "Assistant";
        if (headerAvatar) {
            if (data.photoUrl) headerAvatar.src = data.photoUrl;
            else headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'A')}&background=10b981&color=fff`;
        }
    };

    const startLiveTimers = () => {
        if (liveTimerInterval) clearInterval(liveTimerInterval);
        if (!cachedClasses || cachedClasses.length === 0) return;
        liveTimerInterval = setInterval(() => {
            let needsReRender = false;
            cachedClasses.forEach(cls => {
                const currentStatus = calculateStatus(cls);
                if (currentStatus.status !== cls.autoStatus.status) {
                    needsReRender = true;
                    return;
                }
                if (currentStatus.status === 'countdown' || currentStatus.status === 'countdown-urgent') {
                    cls.autoStatus.timeLeft = currentStatus.timeLeft;
                    const card = document.querySelector(`#todayClassesRow [data-item-id="${cls.id}"]`);
                    if (card) {
                        const statusBadge = card.querySelector('.status-indicator');
                        if (statusBadge) {
                            const innerSpan = statusBadge.querySelector('span[data-bind-html="statusHTML"]');
                            if (innerSpan) {
                                const newText = `STARTED IN ${currentStatus.timeLeft}`;
                                if (innerSpan.textContent !== newText) innerSpan.textContent = newText;
                            }
                        }
                    }
                }
            });
            if (needsReRender) {
                clearInterval(liveTimerInterval);
                renderClasses();
            }
        }, 1000);
    };

    const renderClasses = async () => {
        const data = window.LocalCache.getSync('currentUser');
        const assignedClasses = data && data.assignedClasses ? data.assignedClasses : [];

        const allClasses = await window.LocalCache.getAll('classes');
        const allStudents = (await window.LocalCache.getAll('students')) || [];
        
        // Filter classes by assigned classes
        const filteredClasses = allClasses.filter(cls => assignedClasses.includes(cls.batchName));

        const processedClasses = filteredClasses.map(cls => {
            const autoStatus = calculateStatus(cls);
            let cCount = 0;
            const targetBatchName = (cls.batchName || "").trim();
            if (targetBatchName) {
                allStudents.forEach(studentData => {
                    let studentBatches = [];
                    if (Array.isArray(studentData.batches)) studentBatches = studentData.batches;
                    else if (studentData.batchName || studentData.batch) studentBatches = [(studentData.batchName || studentData.batch).trim()];
                    if (studentData.batch1) studentBatches.push(studentData.batch1.trim());
                    if (studentData.batch2) studentBatches.push(studentData.batch2.trim());
                    if (studentData.batch3) studentBatches.push(studentData.batch3.trim());
                    if (studentBatches.includes(targetBatchName)) cCount++;
                });
            }
            let statusHTML = 'UPCOMING';
            if (autoStatus.status === 'live') statusHTML = `<span class="live-dot"></span> LIVE NOW • ${autoStatus.timeLeft}`;
            else if (autoStatus.status === 'transition') statusHTML = `BREAK TIME`;
            else if (autoStatus.status === 'countdown-urgent') statusHTML = `STARTED IN ${autoStatus.timeLeft}`;
            else if (autoStatus.status === 'countdown') statusHTML = `STARTED IN ${autoStatus.timeLeft}`;
            else if (autoStatus.status === 'done') statusHTML = 'COMPLETED';
            else if (autoStatus.status === 'no-class') statusHTML = 'NO CLASS';

            return {
                ...cls,
                studentCount: cCount || cls.studentCount || 0,
                autoStatus,
                statusHTML,
                timeRange: `${formatTime12(cls.startTime)} - ${formatTime12(cls.endTime)}`,
                isLab: cls.classType === 'lab',
                isTheory: cls.classType !== 'lab',
                classTypeUpper: (cls.classType || 'THEORY').toUpperCase(),
                subjectFormatted: cls.subject ? ` · ${cls.subject}` : ''
            };
        });

        const liveClasses = processedClasses.filter(c => c.autoStatus.status === 'live');
        const upcomingClasses = processedClasses.filter(c => 
            c.autoStatus.status === 'upcoming' || 
            c.autoStatus.status === 'countdown' || 
            c.autoStatus.status === 'countdown-urgent' ||
            c.autoStatus.status === 'transition'
        );
        const completedClasses = processedClasses.filter(c => c.autoStatus.status === 'done');
        liveClasses.sort((a, b) => (a.endTime || '').localeCompare(b.endTime || ''));
        upcomingClasses.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        const sortedClasses = [...liveClasses, ...upcomingClasses];
        const noClassesMsg = document.getElementById('noClassesMsg');

        if (sortedClasses.length === 0) {
            cachedClasses = [];
            if (liveTimerInterval) clearInterval(liveTimerInterval);
            if (noClassesMsg) {
                const isHolidayActive = window.GlobalHolidayState && window.GlobalHolidayState.isActive;
                if (isHolidayActive) noClassesMsg.innerHTML = '';
                else if (completedClasses.length > 0) {
                    noClassesMsg.innerHTML = `
                        <div style="text-align: center; padding: 20px 0;">
                            <i class="fa-solid fa-champagne-glasses" style="color: var(--accent-color); font-size: 32px; margin-bottom: 12px; filter: drop-shadow(0 0 10px var(--accent-glow));"></i>
                            <p style="font-size: 18px; font-weight: 700; color: var(--text-dark); margin: 0;">All done for today!</p>
                        </div>
                    `;
                } else {
                    noClassesMsg.innerHTML = `
                        <i class="fa-solid fa-calendar-day"></i>
                        <p>No classes scheduled for today.</p>
                    `;
                }
                noClassesMsg.style.display = 'flex';
            }
            window.RenderEngine.renderList('todayClassesRow', 'tpl-teacher-class-card', []);
            return;
        }

        if (noClassesMsg) noClassesMsg.style.display = 'none';
        const setupCallback = (element, data) => {
            element.onclick = () => {
                localStorage.setItem('selectedClassId', data.id);
                window.location.href = 'attendance.html';
            };
        };
        window.RenderEngine.renderList('todayClassesRow', 'tpl-teacher-class-card', sortedClasses, setupCallback);
        cachedClasses = sortedClasses;
        startLiveTimers();
    };

    // Logout
    const doLogout = async (e) => {
        e.preventDefault();
        await firebase.auth().signOut();
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'index.html';
    };
    if (logoutNavBtn) logoutNavBtn.addEventListener('click', doLogout);
    if (logoutAvatar) logoutAvatar.addEventListener('click', doLogout);

    // 4. Initialization via APP_READY
    document.addEventListener('APP_READY', async (e) => {
        const { role, isCached } = e.detail;
        if (role !== 'assistant') return;

        renderProfile();
        await renderClasses();

        if (isCached) return;

        window.FirebaseSync.on('PROFILE_UPDATED', renderProfile);
        window.FirebaseSync.on('CLASSES_UPDATED', renderClasses);
        document.addEventListener('GLOBAL_HOLIDAY_UPDATED', renderClasses);

        setInterval(() => {
            const todayStr = new Date().toISOString().split('T')[0];
            if (todayStr !== currentSessionDate) {
                currentSessionDate = todayStr;
                updateHeaderDate();
                renderClasses();
            }
        }, 1000);
    });
});
