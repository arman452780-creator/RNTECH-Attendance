// teacher_dashboard.js - Local-First Architecture

document.addEventListener('DOMContentLoaded', () => {
    // 1. UI Elements
    const greetingText = document.getElementById('greetingText');
    const teacherNameHeader = document.getElementById('teacherNameHeader');
    const headerAvatar = document.getElementById('headerAvatar');
    const dashboardDate = document.getElementById('dashboardDate');
    
    // Set Current Date & Session Tracking
    let currentSessionDate = new Date().toISOString().split('T')[0];
    let currentWeekOffset = 0;
    let cachedClasses = [];
    let liveTimerInterval = null;

    const prevWeekBtn = document.getElementById('prevWeek');
    const nextWeekBtn = document.getElementById('nextWeek');

    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', async () => {
            currentWeekOffset--;
            await renderAnalytics(currentWeekOffset);
        });
    }

    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', async () => {
            if (currentWeekOffset < 0) {
                currentWeekOffset++;
                await renderAnalytics(currentWeekOffset);
            }
        });
    }

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
        // OVERRIDE: Check Global Holiday State
        if (window.GlobalHolidayState && window.GlobalHolidayState.isActive && window.GlobalHolidayState.data) {
            return { status: 'holiday', timeLeft: '' };
        }

        const { startTime, endTime, recurringDays } = classData;
        if (!startTime || !endTime) return { status: 'upcoming', timeLeft: '' };

        const now = new Date();
        const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayShort = daysShort[now.getDay()];

        let isClassToday = false;
        if (!recurringDays) {
            isClassToday = false;
        } else if (Array.isArray(recurringDays)) {
            isClassToday = recurringDays.some(d => d.trim().toLowerCase().startsWith(todayShort.toLowerCase()));
        }

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
                if (diffMins <= 5) {
                    result = { status: 'countdown-urgent', timeLeft };
                } else {
                    result = { status: 'countdown', timeLeft };
                }
            }
        }
        return result;
    };

    // 3. Render Functions (Using LocalCache & RenderEngine)
    const renderProfile = () => {
        const data = window.LocalCache.getSync('currentUser');
        if (!data) return;
        if (teacherNameHeader) teacherNameHeader.textContent = data.name || "Teacher";
        if (headerAvatar) {
            if (data.photoUrl) headerAvatar.src = data.photoUrl;
            else headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'T')}&background=2563eb&color=fff`;
        }
    };

    const startLiveTimers = () => {
        if (liveTimerInterval) {
            clearInterval(liveTimerInterval);
        }
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

    const renderClasses = async () => {
        const allClasses = await window.LocalCache.getAll('classes');
        const allStudents = (await window.LocalCache.getAll('students')) || [];
        
        const processedClasses = allClasses.map(cls => {
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
                    
                    if (studentBatches.includes(targetBatchName)) {
                        cCount++;
                    }
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
            if (liveTimerInterval) {
                clearInterval(liveTimerInterval);
            }
            if (noClassesMsg) {
                const isHolidayActive = window.GlobalHolidayState && window.GlobalHolidayState.isActive;
                if (isHolidayActive) {
                    noClassesMsg.innerHTML = '';
                } else if (completedClasses.length > 0) {
                    noClassesMsg.innerHTML = `
                        <div style="text-align: center; padding: 20px 0;">
                            <i class="fa-solid fa-champagne-glasses" style="color: var(--accent-color); font-size: 32px; margin-bottom: 12px; filter: drop-shadow(0 0 10px var(--accent-glow));"></i>
                            <p style="font-size: 18px; font-weight: 700; color: var(--text-dark); margin: 0;">All done for today!</p>
                            <p style="font-size: 13px; color: var(--text-muted); margin-top: 5px;">Great job completing all ${completedClasses.length} classes.</p>
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

        // Set up click handlers during component creation
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

    const renderActivity = async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        // For performance, we fetch all from local cache. In a huge dataset, we would use an index.
        const allAtt = await window.LocalCache.getAll('attendanceRecords');
        const todayAtt = allAtt.filter(r => r.date === todayStr);

        todayAtt.sort((a, b) => (b._ts || 0) - (a._ts || 0));
        const recent = todayAtt.slice(0, 10).map(data => {
            let timeStr = 'Just now';
            const tsVal = data._ts || (data.timestamp && typeof data.timestamp === 'object' && 'seconds' in data.timestamp ? data.timestamp.seconds * 1000 : data.timestamp);
            if (tsVal) {
                const dateObj = new Date(tsVal);
                if (!isNaN(dateObj.getTime())) {
                    timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }
            }
            const initials = data.studentName ? data.studentName.split(' ').map(n => n[0]).join('').toUpperCase() : 'S';
            return {
                ...data,
                initials,
                timeStr,
                resolvedCourse: data.className || data.course || 'UNASSIGNED',
                statusText: (data.attendanceStatus || 'PRESENT').toUpperCase()
            };
        });

        const container = document.getElementById('recentActivityList');
        if (recent.length === 0) {
            if (container) container.innerHTML = '<p class="activity-loader">No attendance activity today.</p>';
            return;
        }

        window.RenderEngine.renderList('recentActivityList', 'tpl-teacher-activity-row', recent);
    };

    const renderStats = async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Use local cache for students count
        // Note: we might not sync all students unless needed. Alternatively we sync stats separately.
        // For now, we fallback to simple math if students are loaded.
        // Ideally stats should be computed locally from cached records.
        const allAtt = await window.LocalCache.getAll('attendanceRecords');
        const todayAtt = allAtt.filter(r => r.date === todayStr);
        
        // Get Total Students
        const allStudents = await window.LocalCache.getAll('students');
        const statTotalStudents = document.getElementById('statTotalStudents');
        if (statTotalStudents) statTotalStudents.textContent = allStudents.length;

        let present = 0;
        let absent = 0;
        todayAtt.forEach(doc => {
            const status = doc.attendanceStatus;
            if (status === 'present' || status === 'late') present++;
            else if (status === 'absent') absent++;
        });

        const statPresentToday = document.getElementById('statPresentToday');
        const statAbsentToday = document.getElementById('statAbsentToday');
        const statAvgAttendance = document.getElementById('statAvgAttendance');

        if (statPresentToday) statPresentToday.textContent = present;
        if (statAbsentToday) statAbsentToday.textContent = absent;
        
        const total = present + absent;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;
        if (statAvgAttendance) statAvgAttendance.textContent = `${rate}%`;
    };

    // --- MINI FEE ALERTS SYSTEM ---
    const updateMiniFeeAlerts = async () => {
        const students = await window.LocalCache.getAll('students');
        let overdueCount = 0;
        let dueSoonCount = 0;
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const fiveDaysFromNow = new Date(today);
        fiveDaysFromNow.setDate(today.getDate() + 5);

        for (const student of students) {
            if (student.feeDetails && student.feeDetails.joiningDate && student.feeDetails.courseDuration) {
                const duration = parseInt(student.feeDetails.courseDuration) || 0;
                const paid = parseInt(student.feeDetails.paidMonths) || 0;
                const extensionDays = parseInt(student.feeDetails.extensionDays) || 0;
                const totalFee = parseInt(student.feeDetails.totalFee) || 0;
                const monthlyFee = parseInt(student.feeDetails.monthlyFee) || 0;
                let calculatedTotalFee = totalFee > 0 ? totalFee : (monthlyFee > 0 && duration > 0 ? monthlyFee * duration : 0);
                let remainingFees = 0;
                if (calculatedTotalFee > 0) {
                    const regFee = parseInt(student.feeDetails.registrationFee) || 0;
                    const payableFee = Math.max(0, calculatedTotalFee - regFee);
                    remainingFees = Math.max(0, payableFee - (paid * monthlyFee));
                }

                let isFullyPaid = false;
                if (duration > 0 && paid >= duration) isFullyPaid = true;
                if (calculatedTotalFee > 0 && remainingFees <= 0) isFullyPaid = true;

                if (!isFullyPaid) {
                    const joinDate = new Date(student.feeDetails.joiningDate);
                    if (!isNaN(joinDate.getTime())) {
                        const nextDue = new Date(joinDate);
                        nextDue.setMonth(nextDue.getMonth() + paid);
                        
                        if (extensionDays > 0) {
                            nextDue.setDate(nextDue.getDate() + extensionDays);
                        }
                        
                        const nextDueNoTime = new Date(nextDue);
                        nextDueNoTime.setHours(0,0,0,0);

                        let status = 'paid';
                        if (today > nextDueNoTime) status = 'overdue';
                        else if (fiveDaysFromNow >= nextDueNoTime) status = 'due-soon';

                        // Auto-Extension Logic (Still needs to run here so dashboard can passively auto-extend)
                        if (status === 'overdue' && !student.feeDetails.autoExtended) {
                            try {
                                const newExtension = extensionDays + 5;
                                await firebase.firestore().collection('users').doc(student.id).update({
                                    'feeDetails.extensionDays': newExtension,
                                    'feeDetails.autoExtended': true,
                                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                                });
                                student.feeDetails.extensionDays = newExtension;
                                student.feeDetails.autoExtended = true;
                                await window.LocalCache.set('students', student);
                                
                                nextDueNoTime.setDate(nextDueNoTime.getDate() + 5);
                                status = (today > nextDueNoTime) ? 'overdue' : ((fiveDaysFromNow >= nextDueNoTime) ? 'due-soon' : 'paid');
                            } catch (error) {
                                console.error("Error auto-extending fee date:", error);
                            }
                        }

                        if (status === 'overdue') overdueCount++;
                        else if (status === 'due-soon') dueSoonCount++;
                    }
                }
            }
        }

        const miniAlertsContainer = document.getElementById('miniFeeAlerts');
        const overdueAlert = document.getElementById('miniOverdueAlert');
        const overdueCountEl = document.getElementById('miniOverdueCount');
        const dueSoonAlert = document.getElementById('miniDueSoonAlert');
        const dueSoonCountEl = document.getElementById('miniDueSoonCount');

        if (miniAlertsContainer) {
            if (overdueCount === 0 && dueSoonCount === 0) {
                miniAlertsContainer.style.display = 'none';
            } else {
                miniAlertsContainer.style.display = 'flex';
                
                if (overdueCount > 0) {
                    if (overdueAlert) overdueAlert.style.display = 'flex';
                    if (overdueCountEl) overdueCountEl.textContent = overdueCount;
                } else {
                    if (overdueAlert) overdueAlert.style.display = 'none';
                }

                if (dueSoonCount > 0) {
                    if (dueSoonAlert) dueSoonAlert.style.display = 'flex';
                    if (dueSoonCountEl) dueSoonCountEl.textContent = dueSoonCount;
                } else {
                    if (dueSoonAlert) dueSoonAlert.style.display = 'none';
                }
            }
        }
    };
    // --- END MINI FEE ALERTS SYSTEM ---

    const renderAnalytics = async (offset = 0) => {
        const formatLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        const getWeekDates = (date, offset = 0) => {
            const current = new Date(date);
            current.setDate(current.getDate() + (offset * 7));
            const week = [];
            const diff = current.getDate() - current.getDay() + (current.getDay() === 0 ? -6 : 1);
            const monday = new Date(current.setDate(diff));
            for (let i = 0; i < 6; i++) {
                const d = new Date(monday);
                d.setDate(monday.getDate() + i);
                week.push(formatLocalDate(d));
            }
            return week;
        };

        const today = new Date();
        const currentWeek = getWeekDates(today, offset);
        const lastWeek = getWeekDates(today, offset - 1);

        const allAtt = await window.LocalCache.getAll('attendanceRecords');

        const calculateWeek = (weekArray) => {
            const results = {};
            weekArray.forEach(d => results[d] = { present: 0, total: 0 });
            
            allAtt.forEach(data => {
                const d = data.date;
                if (results[d]) {
                    if (data.attendanceStatus === 'present' || data.attendanceStatus === 'late') results[d].present++;
                    results[d].total++;
                }
            });

            const finalResults = {};
            weekArray.forEach(d => {
                finalResults[d] = results[d].total > 0 ? (results[d].present / results[d].total) * 100 : 0;
            });
            return finalResults;
        };

        const currentResults = calculateWeek(currentWeek);
        const lastResults = calculateWeek(lastWeek);

        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let currentTotalPct = 0, currentDaysWithData = 0, lastTotalPct = 0;
        const todayStr = formatLocalDate(today);

        currentWeek.forEach((date, index) => {
            const pct = currentResults[date];
            const bar = document.getElementById(`bar${days[index]}`);
            if (bar) {
                bar.style.height = `${pct}%`;
                if (date === todayStr) bar.classList.add('active');
                else bar.classList.remove('active');
            }
            if (pct > 0 || date <= todayStr) {
                currentTotalPct += pct;
                currentDaysWithData++;
            }
        });

        lastWeek.forEach(date => lastTotalPct += lastResults[date]);

        const currentAvg = currentDaysWithData > 0 ? currentTotalPct / currentDaysWithData : 0;
        const lastAvg = lastTotalPct / 6;

        const trendInfo = document.getElementById('trendInfo');
        const trendIcon = document.getElementById('trendIcon');
        const trendText = document.getElementById('trendText');

        if (trendInfo) {
            trendInfo.style.display = 'flex';
            const diff = currentAvg - lastAvg;
            const absDiff = Math.abs(Math.round(diff));
            const comparisonLabel = offset === 0 ? "last week" : "previous week";
            if (diff >= 0) {
                trendIcon.className = 'fa-solid fa-arrow-up';
                trendInfo.style.color = 'var(--success)';
                trendText.textContent = `${absDiff}% increase from ${comparisonLabel}`;
            } else {
                trendIcon.className = 'fa-solid fa-arrow-down';
                trendInfo.style.color = 'var(--danger)';
                trendText.textContent = `${absDiff}% decrease from ${comparisonLabel}`;
            }
        }

        // Update Week Navigation Label and Buttons
        const weekRangeLabel = document.getElementById('weekRangeLabel');
        const nextWeek = document.getElementById('nextWeek');

        if (weekRangeLabel) {
            if (offset === 0) {
                weekRangeLabel.textContent = "Current Week";
            } else if (offset === -1) {
                weekRangeLabel.textContent = "Previous Week";
            } else {
                const parseDate = (str) => {
                    const [year, month, day] = str.split('-').map(Number);
                    return new Date(year, month - 1, day);
                };
                const mon = parseDate(currentWeek[0]);
                const sat = parseDate(currentWeek[5]);
                const options = { month: 'short', day: 'numeric' };
                weekRangeLabel.textContent = `${mon.toLocaleDateString('en-US', options)} - ${sat.toLocaleDateString('en-US', options)}`;
            }
        }

        if (nextWeek) {
            nextWeek.disabled = (offset >= 0);
        }
    };

    // 4. Initialization via APP_READY
    document.addEventListener('APP_READY', async (e) => {
        const { role, isCached } = e.detail;
        if (role !== 'teacher') return;

        // Render immediately from Cache
        renderProfile();
        await renderClasses();
        await renderActivity();
        await renderStats();
        await renderAnalytics(currentWeekOffset);
        await updateMiniFeeAlerts();

        // If this is the instant cached render, we stop here to avoid duplicate listeners
        if (isCached) return;

        // Listen for Firebase Sync updates to re-render
        window.FirebaseSync.on('PROFILE_UPDATED', renderProfile);
        window.FirebaseSync.on('CLASSES_UPDATED', () => {
            renderClasses();
            // Optional: re-calc activity if completions are tied to classes
        });
        document.addEventListener('GLOBAL_HOLIDAY_UPDATED', () => {
            renderClasses();
        });
        window.FirebaseSync.on('ATTENDANCE_UPDATED', async () => {
            await renderActivity();
            await renderStats();
            await renderAnalytics(currentWeekOffset);
        });
        window.FirebaseSync.on('STUDENTS_UPDATED', async () => {
            renderStats();
            await updateMiniFeeAlerts();
        });

        // 5. Setup Local Interval for Time-based UI Updates
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
