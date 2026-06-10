// student_dashboard.js - Local-First Architecture

document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM Elements
    const studentNameEl = document.getElementById('studentName');
    const headerAvatar = document.getElementById('headerAvatar');
    const dashboardDateEl = document.getElementById('dashboardDate');
    const greetingTextEl = document.getElementById('greetingText');
    
    const statAttendancePct = document.getElementById('statAttendancePct');
    const statTotalClasses = document.getElementById('statTotalClasses');
    const statPresentCount = document.getElementById('statPresentCount');
    const statAbsentCount = document.getElementById('statAbsentCount');
    
    const performanceCircle = document.getElementById('performanceCircle');
    const performancePct = document.getElementById('performancePct');
    const performanceDesc = document.getElementById('performanceDesc');

    let cachedProfile = null;
    let cachedClasses = [];
    let liveTimerInterval = null;

    // 2. Initial Static UI Setup
    const setupStaticUI = () => {
        const now = new Date();
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        if (dashboardDateEl) dashboardDateEl.textContent = now.toLocaleDateString('en-US', options);
        
        const hour = now.getHours();
        if (greetingTextEl) {
            if (hour < 12) greetingTextEl.textContent = "Good Morning,";
            else if (hour < 17) greetingTextEl.textContent = "Good Afternoon,";
            else greetingTextEl.textContent = "Good Evening,";
        }
    };
    setupStaticUI();

    // 3. Helper Functions
    const formatTime12 = (time24) => {
        if (!time24) return '--:--';
        const [hours, minutes] = time24.split(':');
        let h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${minutes} ${ampm}`;
    };

    const formatActivityDate = (date) => {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        const dayName = days[d.getDay()];
        return `${day}-${month}-${year} | ${dayName}`;
    };

    const calculateClassStatus = (cls) => {
        // OVERRIDE: Check Global Holiday State
        if (window.GlobalHolidayState && window.GlobalHolidayState.isActive && window.GlobalHolidayState.data) {
            return { 
                status: window.GlobalHolidayState.data.statusType || 'holiday', 
                title: window.GlobalHolidayState.data.title || 'Holiday', 
                timeLeft: '' 
            };
        }

        if (cls.status === 'cancelled') return { status: 'cancelled', title: cls.cancelReason || 'Cancelled', timeLeft: '' };
        if (cls.status === 'holiday') return { status: 'holiday', title: cls.holidayTitle || 'Holiday', timeLeft: '' };
        const start = cls.startTime;
        const end = cls.endTime;
        if (!start || !end) return { status: 'upcoming', timeLeft: '' };
        const now = new Date();
        const [sH, sM] = start.split(':').map(Number);
        const [eH, eM] = end.split(':').map(Number);
        
        const startTime = new Date();
        startTime.setHours(sH, sM, 0);
        
        const endTime = new Date();
        endTime.setHours(eH, eM, 0);
        
        if (now > endTime) {
            const diffMs = now.getTime() - endTime.getTime();
            if (diffMs >= 30000) {
                return { status: 'hidden', timeLeft: '' };
            }
            return { status: 'done', timeLeft: '' };
        }

        if (cls.status === 'completed') return { status: 'completed', timeLeft: '' };
        
        const startPlus5 = new Date(startTime.getTime() + 5 * 60000);

        if (now >= startPlus5 && now <= endTime) return { status: 'live', timeLeft: '' };
        if (now >= startTime && now < startPlus5) return { status: 'transition', timeLeft: '' };
        
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
    };

    const startLiveTimers = () => {
        if (liveTimerInterval) {
            clearInterval(liveTimerInterval);
        }
        if (!cachedClasses || cachedClasses.length === 0) return;

        liveTimerInterval = setInterval(() => {
            let needsReRender = false;

            cachedClasses.forEach(cls => {
                const currentStatus = calculateClassStatus(cls);

                if (currentStatus.status !== cls.autoStatus.status) {
                    needsReRender = true;
                    return;
                }

                if (currentStatus.status === 'countdown' || currentStatus.status === 'countdown-urgent') {
                    cls.autoStatus.timeLeft = currentStatus.timeLeft;

                    const card = document.querySelector(`#todayClassesRow [data-item-id="${cls.id}"]`);
                    if (card) {
                        const statusBadge = card.querySelector('.class-status-badge');
                        if (statusBadge) {
                            const innerSpan = statusBadge.querySelector('span[data-bind-html="statusHTML"]');
                            if (innerSpan) {
                                const newText = `STARTED IN ${currentStatus.timeLeft}`;
                                if (innerSpan.textContent !== newText) {
                                    innerSpan.textContent = newText;
                                }
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

    // 4. Render Logic Using LocalCache & RenderEngine
    const renderProfile = () => {
        const data = window.LocalCache.getSync('currentUser');
        if (!data) return;
        cachedProfile = data;

        const name = data.name || data.displayName || "Student";
        if (studentNameEl) studentNameEl.textContent = name.split(' ')[0];
        
        if (headerAvatar) {
            if (data.profileImage || data.photoUrl) {
                headerAvatar.src = data.profileImage || data.photoUrl;
            } else {
                headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&bold=true`;
            }
        }
    };

    const renderFeeDetails = () => {
        const feeSection = document.getElementById('feeStatusSection');
        if (!cachedProfile || !cachedProfile.feeDetails) {
            if (feeSection) feeSection.style.display = 'none';
            return;
        }

        const fee = cachedProfile.feeDetails;
        if (!fee.joiningDate || !fee.courseDuration) {
            if (feeSection) feeSection.style.display = 'none';
            return;
        }

        if (feeSection) feeSection.style.display = 'block';

        const monthlyFeeEl = document.getElementById('studentMonthlyFee');
        const totalFeeTextEl = document.getElementById('studentTotalFeeText');
        const nextDueEl = document.getElementById('studentNextDueDate');
        const remainingEl = document.getElementById('studentRemainingMonths');
        const badgeEl = document.getElementById('studentFeeStatusBadge');
        const progressTextEl = document.getElementById('studentCourseProgressText');
        const progressBarEl = document.getElementById('studentCourseProgressBar');
        const subtextEl = document.getElementById('studentFeeSubtext');

        const monthlyFee = parseInt(fee.monthlyFee) || 0;
        const duration = parseInt(fee.courseDuration) || 0;
        const totalFeeRaw = parseInt(fee.totalFee) || 0;
        const computedTotalFee = totalFeeRaw > 0 ? totalFeeRaw : (monthlyFee * duration);

        if (monthlyFeeEl) monthlyFeeEl.textContent = monthlyFee;
        
        if (totalFeeTextEl) {
            if (computedTotalFee > 0) {
                totalFeeTextEl.innerHTML = `/ ₹${computedTotalFee} Total`;
            } else {
                totalFeeTextEl.innerHTML = `/ month`;
            }
        }

        const paid = parseInt(fee.paidMonths) || 0;
        const extensionDays = parseInt(fee.extensionDays) || 0;
        
        let elapsedMonths = 0;
        if (fee.joiningDate) {
            const joinDate = new Date(fee.joiningDate);
            if (!isNaN(joinDate.getTime())) {
                const today = new Date();
                elapsedMonths = (today.getFullYear() - joinDate.getFullYear()) * 12 + today.getMonth() - joinDate.getMonth();
                if (today.getDate() < joinDate.getDate()) {
                    elapsedMonths--;
                }
                elapsedMonths = Math.max(0, elapsedMonths);
            }
        }
        
        const completedMonths = Math.min(elapsedMonths, duration);
        const remaining = Math.max(0, duration - completedMonths);
        
        if (remainingEl) remainingEl.textContent = `${remaining} months`;
        
        const remainingFeesEl = document.getElementById('studentRemainingFees');
        const remainingFeesRowEl = document.getElementById('studentRemainingFeesRow');

        if (computedTotalFee > 0) {
            const regFee = parseInt(fee.registrationFee) || 0;
            const payableFee = Math.max(0, computedTotalFee - regFee);
            const feesPaid = paid * monthlyFee;
            const remainingFees = Math.max(0, payableFee - feesPaid);
            if (remainingFeesEl) remainingFeesEl.textContent = `₹${remainingFees}`;
            if (remainingFeesRowEl) remainingFeesRowEl.style.display = 'grid';
        } else {
            if (remainingFeesRowEl) remainingFeesRowEl.style.display = 'none';
        }
        
        // Progress Bar
        if (progressTextEl) progressTextEl.textContent = `${completedMonths} / ${duration} Months`;
        if (progressBarEl) {
            const pct = duration > 0 ? Math.min(100, Math.round((completedMonths / duration) * 100)) : 0;
            // Delay for animation
            setTimeout(() => {
                progressBarEl.style.width = `${pct}%`;
            }, 300);
        }

        if (subtextEl) {
            subtextEl.textContent = '';
            subtextEl.style.color = 'inherit';
        }

        // Calculate Next Due Date and Status
        const joinDate = new Date(fee.joiningDate);
        if (!isNaN(joinDate.getTime())) {
            const nextDue = new Date(joinDate);
            nextDue.setMonth(nextDue.getMonth() + paid);
            
            // Apply extension days
            if (extensionDays > 0) {
                nextDue.setDate(nextDue.getDate() + extensionDays);
            }
            
            if (nextDueEl) nextDueEl.textContent = nextDue.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            
            // Check status
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const nextDueNoTime = new Date(nextDue);
            nextDueNoTime.setHours(0,0,0,0);
            
            const diffTime = today - nextDueNoTime;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            const fiveDaysFromNow = new Date(today);
            fiveDaysFromNow.setDate(today.getDate() + 5);

            const d = new Date();
            const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            let isLocked = false;
            if (fee.isLocked === true && fee.lastPaidMonth === currentMonthStr) {
                isLocked = true;
            }

            // Calculate Remaining Fees if total fee exists
            let remainingFees = 0;
            const totalFee = parseInt(fee.totalFee) || 0;
            const monthlyFee = parseInt(fee.monthlyFee) || 0;
            let calculatedTotalFee = 0;
            
            if (totalFee > 0) {
                calculatedTotalFee = totalFee;
            } else if (monthlyFee > 0 && duration > 0) {
                calculatedTotalFee = monthlyFee * duration;
            }
            
            if (calculatedTotalFee > 0) {
                const regFee = parseInt(fee.registrationFee) || 0;
                const payableFee = Math.max(0, calculatedTotalFee - regFee);
                const feesPaid = paid * monthlyFee;
                remainingFees = Math.max(0, payableFee - feesPaid);
            }

            let isFullyPaid = false;
            if (duration > 0 && paid >= duration) isFullyPaid = true;
            if (calculatedTotalFee > 0 && remainingFees <= 0) isFullyPaid = true;
            if (duration > 0 && remaining <= 0) isFullyPaid = true;

            if (isFullyPaid) {
                if (nextDueEl) nextDueEl.textContent = 'Fully Paid';
                if (badgeEl) {
                    badgeEl.className = 'fee-status-badge status-paid';
                    badgeEl.innerHTML = '<span><i class="fa-solid fa-check"></i> All Paid</span>';
                }
            } else if (isLocked) {
                if (badgeEl) {
                    badgeEl.className = 'fee-status-badge status-paid';
                    badgeEl.innerHTML = '<span><i class="fa-solid fa-lock"></i> Payment Received</span>';
                }
            } else if (today > nextDueNoTime) {
                if (badgeEl) {
                    badgeEl.className = 'fee-status-badge status-overdue';
                    badgeEl.innerHTML = '<span><i class="fa-solid fa-circle-exclamation"></i> Overdue</span>';
                }
                if (subtextEl) {
                    subtextEl.textContent = `Overdue by ${diffDays} Day${diffDays > 1 ? 's' : ''}`;
                    subtextEl.style.color = 'var(--danger)';
                }
            } else if (fiveDaysFromNow >= nextDueNoTime) {
                if (badgeEl) {
                    badgeEl.className = 'fee-status-badge status-due';
                    badgeEl.innerHTML = '<span><i class="fa-solid fa-clock"></i> Due Soon</span>';
                }
                if (subtextEl) {
                    const absDays = Math.abs(diffDays);
                    subtextEl.textContent = absDays === 0 ? 'Due Today' : `Due in ${absDays} Day${absDays > 1 ? 's' : ''}`;
                    subtextEl.style.color = 'var(--warning)';
                }
            } else {
                if (badgeEl) {
                    badgeEl.className = 'fee-status-badge status-paid';
                    badgeEl.innerHTML = '<span><i class="fa-solid fa-check"></i> Paid Up</span>';
                }
            }
        }
    };

    const renderStats = async () => {
        const records = await window.LocalCache.getAll('attendanceRecords');
        const total = records.length;
        const present = records.filter(r => r.attendanceStatus === 'present').length;
        const absent = records.filter(r => r.attendanceStatus === 'absent').length;
        const late = records.filter(r => r.attendanceStatus === 'late').length;
        
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;

        if (statAttendancePct) statAttendancePct.textContent = pct + '%';
        if (performancePct) performancePct.textContent = pct + '%';

        if (performanceCircle) {
            if (!performanceCircle.getAttribute('stroke-dasharray')) {
                performanceCircle.setAttribute('stroke-dasharray', '0, 100');
            }
            setTimeout(() => {
                performanceCircle.setAttribute('stroke-dasharray', `${pct}, 100`);
            }, 50);
            
            let wheelColor = '#10b981';
            if (pct < 50) wheelColor = '#ef4444';
            else if (pct < 75) wheelColor = '#f59e0b';

            performanceCircle.style.setProperty('--wheel-color', wheelColor);
            if (performancePct) performancePct.style.color = wheelColor;
        }

        if (performanceDesc) {
            if (pct >= 75) performanceDesc.textContent = "Great job! You're maintaining a healthy attendance record.";
            else if (pct >= 60) performanceDesc.textContent = "You're close to the target. Attend a few more classes to stay safe.";
            else if (total > 0) performanceDesc.textContent = "Your attendance is below the required threshold. Please attend more classes.";
            else performanceDesc.textContent = "Start attending classes to see your performance analysis here.";
        }
        
        if (statTotalClasses) statTotalClasses.textContent = total;
        if (statPresentCount) statPresentCount.textContent = present;
        if (statAbsentCount) statAbsentCount.textContent = absent;
    };

    const renderClasses = async () => {
        if (!cachedProfile) return;

        const studentBatches = (Array.isArray(cachedProfile.batches) ? cachedProfile.batches : [
            cachedProfile.batch1 || cachedProfile.batch || cachedProfile.batchName || "",
            cachedProfile.batch2 || "",
            cachedProfile.batch3 || ""
        ]).filter(Boolean).map(b => b.toLowerCase().trim());

        const studentCourses = (Array.isArray(cachedProfile.courses) ? cachedProfile.courses : [
            cachedProfile.course1 || cachedProfile.course || "",
            cachedProfile.course2 || "",
            cachedProfile.course3 || ""
        ]).filter(Boolean).map(c => c.toLowerCase().trim());

        const allClasses = await window.LocalCache.getAll('classes');
        const now = new Date();
        const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const currentDay = dayOrder[now.getDay()];
        const todayFullName = now.toLocaleDateString('en-US', { weekday: 'long' });

        const filteredClasses = allClasses.filter(data => {
            const classCourse = (data.courseName || "").toLowerCase().trim();
            const classBatch = (data.batchName || "").toLowerCase().trim();
            const isBatchMatch = studentBatches.includes(classBatch);
            const isCourseMatch = studentCourses.includes(classCourse);
            const isMatched = isBatchMatch || (isCourseMatch && studentBatches.length === 0);
            const isDayMatch = data.recurringDays && data.recurringDays.includes(currentDay);
            
            return isMatched && isDayMatch;
        });

        filteredClasses.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        const mappedData = filteredClasses.map(cls => {
            const statusInfo = calculateClassStatus(cls);
            let statusHTML = 'Upcoming';
            if (statusInfo.status === 'live') statusHTML = '<span class="live-dot"></span> Live Now';
            else if (statusInfo.status === 'cancelled') statusHTML = `❌ Class Cancelled${statusInfo.title && statusInfo.title !== 'Cancelled' ? ' - ' + statusInfo.title : ''}`;
            else if (statusInfo.status === 'holiday') statusHTML = `🎉 Holiday${statusInfo.title && statusInfo.title !== 'Holiday' ? ' - ' + statusInfo.title : ''}`;
            else if (statusInfo.status === 'completed' || statusInfo.status === 'done') statusHTML = 'CLASS COMPLETED';
            else if (statusInfo.status === 'transition') statusHTML = 'BREAK TIME';
            else if (statusInfo.status === 'countdown-urgent' || statusInfo.status === 'countdown') statusHTML = `STARTED IN ${statusInfo.timeLeft}`;
            
            const isLab = (cls.classType || '').toLowerCase() === 'lab';
            return {
                ...cls,
                autoStatus: statusInfo,
                subjectTitle: cls.subject || 'No Subject',
                batchName: `${cls.courseName || 'Course'} • ${cls.batchName || 'No Batch'}`,
                todayFullName,
                timeRange: `${formatTime12(cls.startTime)} - ${formatTime12(cls.endTime)}`,
                teacherName: cls.teacherName || 'RN-TECH Instructor',
                classType: (cls.classType || 'theory').toLowerCase(),
                classTypeUpper: (cls.classType || 'theory').toUpperCase(),
                isLab,
                isTheory: !isLab,
                statusHTML
            };
        }).filter(cls => cls.autoStatus.status !== 'holiday' && cls.autoStatus.status !== 'cancelled' && cls.autoStatus.status !== 'hidden');

        if (mappedData.length === 0) {
            cachedClasses = [];
            if (liveTimerInterval) {
                clearInterval(liveTimerInterval);
            }
            const isHolidayActive = window.GlobalHolidayState && window.GlobalHolidayState.isActive;
            const container = document.getElementById('todayClassesRow');
            
            if (container) {
                if (isHolidayActive) {
                    container.innerHTML = '';
                } else {
                    container.innerHTML = `
                        <div class="empty-state" style="min-width: 100%; padding: 30px;">
                            <i class="fa-solid fa-calendar-day"></i>
                            <p style="color: var(--text-muted); font-size: 14px; margin-top: 10px;">No classes scheduled for today.</p>
                        </div>
                    `;
                }
            }
            return;
        }

        window.RenderEngine.renderList('todayClassesRow', 'tpl-student-class-card', mappedData);
        cachedClasses = mappedData;
        startLiveTimers();
    };

    const renderActivity = async () => {
        const records = await window.LocalCache.getAll('attendanceRecords');
        records.sort((a, b) => (b._ts || 0) - (a._ts || 0));

        const mappedData = records.slice(0, 5).map(rec => {
            const status = rec.attendanceStatus || 'absent';
            const dateStr = formatActivityDate(rec._ts);
            return {
                ...rec,
                mappedStatus: status === 'completed' ? 'present' : status,
                isPresent: status === 'present' || status === 'completed',
                isLate: status === 'late',
                isAbsent: status === 'absent',
                courseName: rec.className || rec.course || 'Course',
                dateStr,
                statusText: status.toUpperCase()
            };
        });

        const container = document.getElementById('recentActivityList');
        if (mappedData.length === 0) {
            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-clipboard-question"></i>
                        <p style="color: var(--text-muted); font-size: 14px;">No recent activity.</p>
                    </div>
                `;
            }
            return;
        }

        window.RenderEngine.renderList('recentActivityList', 'tpl-student-activity-row', mappedData);
    };

    // 5. App Initialization
    let initialRenderDone = false;
    document.addEventListener('APP_READY', async (e) => {
        const { role, isCached } = e.detail;
        if (role !== 'student') return;

        if (!initialRenderDone) {
            renderProfile();
            renderFeeDetails();
            await renderStats();
            await renderClasses();
            await renderActivity();
            initialRenderDone = true;
        }

        // If this is the instant cached render, we stop here to avoid duplicate listeners
        if (isCached) return;

        window.FirebaseSync.on('PROFILE_UPDATED', () => {
            renderProfile();
            renderFeeDetails();
            renderClasses();
        });
        window.FirebaseSync.on('CLASSES_UPDATED', renderClasses);
        window.FirebaseSync.on('ATTENDANCE_UPDATED', async () => {
            await renderStats();
            await renderActivity();
        });

        // Listen to Global Holiday changes
        document.addEventListener('GLOBAL_HOLIDAY_UPDATED', renderClasses);
    });
});
