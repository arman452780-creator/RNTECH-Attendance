// student_timetable.js - Weekly Timetable Logic
document.addEventListener('DOMContentLoaded', () => {
    const timetableContainer = document.getElementById('timetableContainer');
    let cachedTimetableClasses = [];
    let timetableTimerInterval = null;
    // 1. Main Render Logic
    async function renderTimetable() {
        try {
            const userData = window.LocalCache.getSync('currentUser');
            if (!userData) {
                timetableContainer.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">Student record not found.</p>';
                return;
            }

            const studentBatches = (Array.isArray(userData.batches) ? userData.batches : [
                userData.batch1 || userData.batch || userData.batchName || "",
                userData.batch2 || "",
                userData.batch3 || ""
            ]).filter(Boolean).map(b => b.toLowerCase().trim());

            const studentCourses = (Array.isArray(userData.courses) ? userData.courses : [
                userData.course1 || userData.course || "",
                userData.course2 || "",
                userData.course3 || ""
            ]).filter(Boolean).map(c => c.toLowerCase().trim());

            const classes = await window.LocalCache.getAll('classes');

            const matchedClasses = classes.filter(cls => {
                const classBatch = (cls.batchName || "").toLowerCase().trim();
                const classCourse = (cls.courseName || "").toLowerCase().trim();

                const isBatchMatch = studentBatches.includes(classBatch);
                const isCourseMatch = studentCourses.includes(classCourse);
                
                const isMatched = isBatchMatch || (isCourseMatch && studentBatches.length === 0);
                return isMatched;
            });

            matchedClasses.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

            renderWeeklyTimetable(matchedClasses);

        } catch (error) {
            console.error("[Timetable] Render failed:", error);
            timetableContainer.innerHTML = '<p style="color: var(--danger); padding: 20px;">Render failed.</p>';
        }
    }

    // 2. App Initialization
    let initialRenderDone = false;
    document.addEventListener('APP_READY', async (e) => {
        const { role, isCached } = e.detail;
        if (role !== 'student') return;

        if (!initialRenderDone) {
            await renderTimetable();
            initialRenderDone = true;
        }

        if (isCached) return;

        window.FirebaseSync.on('PROFILE_UPDATED', renderTimetable);
        window.FirebaseSync.on('CLASSES_UPDATED', renderTimetable);

        // Listen to Global Holiday changes
        document.addEventListener('GLOBAL_HOLIDAY_UPDATED', renderTimetable);
    });

    const startTimetableTimers = () => {
        if (timetableTimerInterval) {
            clearInterval(timetableTimerInterval);
        }
        if (!cachedTimetableClasses || cachedTimetableClasses.length === 0) return;

        const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayDay = dayOrder[new Date().getDay()];

        const todayClasses = cachedTimetableClasses.filter(cls => cls.recurringDays && cls.recurringDays.includes(todayDay));
        if (todayClasses.length === 0) return;

        timetableTimerInterval = setInterval(() => {
            let needsReRender = false;

            todayClasses.forEach(cls => {
                const currentStatus = calculateClassStatus(cls.startTime, cls.endTime, todayDay);
                const savedStatus = (cls.autoStatus && cls.autoStatus[todayDay]) ? cls.autoStatus[todayDay] : { status: 'upcoming', timeLeft: '' };

                if (currentStatus.status !== savedStatus.status) {
                    needsReRender = true;
                    return;
                }

                if (currentStatus.status === 'countdown' || currentStatus.status === 'countdown-urgent') {
                    if (!cls.autoStatus || typeof cls.autoStatus !== 'object') {
                        cls.autoStatus = {};
                    }
                    cls.autoStatus[todayDay] = currentStatus;

                    const card = document.querySelector(`#list-${todayDay} [data-item-id="${cls.id}"]`);
                    if (card) {
                        const statusBadge = card.querySelector('.class-status-badge');
                        if (statusBadge) {
                            const textSpan = statusBadge.querySelector('.status-text-content');
                            if (textSpan) {
                                const newText = `STARTED IN ${currentStatus.timeLeft}`;
                                if (textSpan.textContent !== newText) {
                                    textSpan.textContent = newText;
                                }
                            }
                        }
                    }
                }
            });

            if (needsReRender) {
                clearInterval(timetableTimerInterval);
                renderTimetable();
            }
        }, 1000);
    };

    // 3. Render Weekly Sections
    function renderWeeklyTimetable(allClasses) {
        if (timetableTimerInterval) {
            clearInterval(timetableTimerInterval);
        }
        timetableContainer.innerHTML = '';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const dayMap = {
            'Monday': 'Mon', 'Tuesday': 'Tue', 'Wednesday': 'Wed', 'Thursday': 'Thu',
            'Friday': 'Fri', 'Saturday': 'Sat', 'Sunday': 'Sun'
        };

        days.forEach(dayName => {
            const dayKey = dayMap[dayName];
            const dayClasses = allClasses.filter(cls => {
                if (!cls.recurringDays || !cls.recurringDays.includes(dayKey)) return false;
                const statusInfo = calculateClassStatus(cls.startTime, cls.endTime, dayKey);
                return statusInfo.status !== 'holiday' && statusInfo.status !== 'cancelled';
            });
            
            const isTargetDayHoliday = (() => {
                if (!window.GlobalHolidayState || !window.GlobalHolidayState.data || !window.GlobalHolidayState.data.active) return false;
                const today = new Date();
                const currentDayIndex = today.getDay();
                const dayOrderMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
                const diff = dayOrderMap[dayKey] - currentDayIndex;
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + diff);
                const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
                return targetDateStr >= window.GlobalHolidayState.data.startDate && targetDateStr <= window.GlobalHolidayState.data.endDate;
            })();
            
            // Sort by start time
            dayClasses.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

            const daySection = document.createElement('section');
            daySection.className = 'day-section';
            
            daySection.innerHTML = `
                <div class="day-header">
                    <div class="day-dot"></div>
                    <span class="day-name">${dayName}</span>
                </div>
                <div class="timetable-list" id="list-${dayKey}">
                    ${dayClasses.length === 0 ? 
                        (isTargetDayHoliday ? '<p style="color: var(--text-muted); font-size: 13px; padding-left: 18px;">Class is suspended</p>' : '<p style="color: var(--text-muted); font-size: 13px; padding-left: 18px;">No classes scheduled for this day.</p>') : ''}
                </div>
            `;

            timetableContainer.appendChild(daySection);

            if (dayClasses.length > 0) {
                const listContainer = document.getElementById(`list-${dayKey}`);
                dayClasses.forEach(cls => {
                    const statusInfo = calculateClassStatus(cls.startTime, cls.endTime, dayKey);
                    if (!cls.autoStatus || typeof cls.autoStatus !== 'object') {
                        cls.autoStatus = {};
                    }
                    cls.autoStatus[dayKey] = statusInfo;
                    const status = statusInfo.status;
                    const card = document.createElement('div');
                    card.setAttribute('data-item-id', cls.id);
                    card.className = `class-card ${status === 'live' ? 'live' : ''}`;
                    
                    const typeValue = (cls.classType || 'theory').toLowerCase();
                    const typeLabel = typeValue.toUpperCase();

                    let statusHTML = 'Upcoming';
                    if (status === 'live') statusHTML = '<span class="live-dot"></span> Live Now';
                    else if (status === 'transition') statusHTML = 'BREAK TIME';
                    else if (status === 'done') statusHTML = 'Completed';
                    else if (status === 'countdown-urgent') statusHTML = `STARTED IN ${statusInfo.timeLeft}`;
                    else if (status === 'countdown') statusHTML = `STARTED IN ${statusInfo.timeLeft}`;
                    else if (status === 'holiday') statusHTML = statusInfo.title || 'HOLIDAY';
                    else if (status === 'cancelled') statusHTML = statusInfo.title || 'CANCELLED';

                    card.innerHTML = `
                        <div class="class-main">
                            <span class="class-subject">${cls.courseName || 'Course'} • ${cls.batchName || 'No Batch'}</span>
                            <h4 class="class-name">${cls.subject || 'No Subject'}</h4>
                        </div>
                        <div class="class-meta">
                            <div class="meta-item">
                                <i class="fa-regular fa-clock"></i>
                                <span>${formatTime12(cls.startTime)} - ${formatTime12(cls.endTime)}</span>
                            </div>
                            <div class="meta-item">
                                <i class="fa-solid fa-user-tie"></i>
                                <span>${cls.teacherName || 'Instructor'}</span>
                            </div>
                        </div>
                        <div class="class-status-row" style="display: flex; align-items: center; gap: 10px; margin-top: auto;">
                            <span class="dash-type-badge ${typeValue}">
                                <i class="fa-solid ${typeValue === 'lab' ? 'fa-computer' : 'fa-book'}"></i>
                                ${typeLabel}
                            </span>
                            <span class="class-status-badge status-${status}">
                                <span class="status-text-content">${statusHTML}</span>
                            </span>
                        </div>
                    `;
                    listContainer.appendChild(card);
                });
            }
        });

        cachedTimetableClasses = allClasses;
        startTimetableTimers();
    }

    // 4. Status Helpers (Synced with Dashboard)
    function calculateClassStatus(start, end, dayKey) {
        // OVERRIDE: Check Global Holiday State for the target day
        if (window.GlobalHolidayState && window.GlobalHolidayState.data && window.GlobalHolidayState.data.active) {
            const today = new Date();
            const currentDayIndex = today.getDay();
            const dayOrderMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
            const diff = dayOrderMap[dayKey] - currentDayIndex;
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + diff);
            const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
            
            if (targetDateStr >= window.GlobalHolidayState.data.startDate && targetDateStr <= window.GlobalHolidayState.data.endDate) {
                return { 
                    status: window.GlobalHolidayState.data.statusType || 'holiday', 
                    title: window.GlobalHolidayState.data.title || 'Holiday', 
                    timeLeft: '' 
                };
            }
        }

        if (!start || !end) return { status: 'upcoming', timeLeft: '' };
        
        const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayDay = dayOrder[new Date().getDay()];

        if (dayKey !== todayDay) return { status: 'upcoming', timeLeft: '' };

        const now = new Date();
        const [sH, sM] = start.split(':').map(Number);
        const [eH, eM] = end.split(':').map(Number);
        
        const startTime = new Date();
        startTime.setHours(sH, sM, 0);
        
        const endTime = new Date();
        endTime.setHours(eH, eM, 0);
        
        const startPlus5 = new Date(startTime.getTime() + 5 * 60000);

        if (now >= startPlus5 && now <= endTime) return { status: 'live', timeLeft: '' };
        if (now >= startTime && now < startPlus5) return { status: 'transition', timeLeft: '' };
        if (now > endTime) return { status: 'done', timeLeft: '' };
        
        const diffMs = startTime - now;
        const diffMins = diffMs / (1000 * 60);
        
        if (diffMins > 0 && diffMins <= 30) {
            const m = Math.floor(diffMs / 60000);
            const s = Math.floor((diffMs % 60000) / 1000);
            const timeLeft = `${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
            if (diffMins <= 5) return { status: 'countdown-urgent', timeLeft };
            return { status: 'countdown', timeLeft };
        }
        return { status: 'upcoming', timeLeft: '' };
    }

    function formatTime12(time24) {
        if (!time24) return '--:--';
        const [hours, minutes] = time24.split(':');
        let h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${minutes} ${ampm}`;
    }
});
