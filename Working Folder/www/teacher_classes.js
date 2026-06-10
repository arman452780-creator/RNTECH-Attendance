// teacher_classes.js - DEBUGGED VERSION
console.log("CRITICAL: teacher_classes.js loaded at " + new Date().toLocaleTimeString());

// 1. Global Modal Control
window.openClassModal = function(mode, data = null) {
    console.log("DEBUG: openClassModal triggered | Mode: " + mode);
    const modal = document.getElementById('classModal');
    const form = document.getElementById('classForm');
    
    if (!modal) {
        alert("CRITICAL ERROR: Modal element (#classModal) not found in DOM!");
        return;
    }

    // Show modal using both display and active class for maximum compatibility
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    if (form) form.reset();
    
    if (mode === 'edit' && data) {
        document.getElementById('modalTitle').textContent = 'Edit Batch Info';
        document.getElementById('editClassId').value = data.id;
        document.getElementById('courseName').value = data.courseName || '';
        document.getElementById('subjectName').value = data.subject || '';
        document.getElementById('batchName').value = data.batchName || '';
        document.getElementById('startTime').value = data.startTime || '';
        document.getElementById('endTime').value = data.endTime || '';

        document.getElementById('classType').value = data.classType || 'theory';
        if(document.getElementById('teacherName')) document.getElementById('teacherName').value = data.teacherName || '';
        
        // Load selected days
        const selectedDays = data.recurringDays || [];
        const checkboxes = document.querySelectorAll('#daySelector input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = selectedDays.includes(cb.value);
        });

        document.getElementById('deleteClassBtn').style.display = 'block';
    } else {
        document.getElementById('modalTitle').textContent = 'Create New Batch';
        document.getElementById('editClassId').value = '';
        
        // Reset checkboxes
        const checkboxes = document.querySelectorAll('#daySelector input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);

        document.getElementById('deleteClassBtn').style.display = 'none';
    }

};

window.closeClassModal = function() {
    const modal = document.getElementById('classModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
};

window.openStatusModal = function(course) {
    const modal = document.getElementById('statusModal');
    const form = document.getElementById('statusForm');
    
    if (!modal) return;
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    if (form) form.reset();
    
    document.getElementById('statusClassId').value = course.id;
    document.getElementById('classStatusSelect').value = course.status || 'active';
    document.getElementById('cancelReasonInput').value = course.cancelReason || '';
    document.getElementById('holidayTitleInput').value = course.holidayTitle || '';
    
    const event = new Event('change');
    document.getElementById('classStatusSelect').dispatchEvent(event);
};

window.closeStatusModal = function() {
    const modal = document.getElementById('statusModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
};

// Global Status Modal Control
window.openGlobalStatusModal = function() {
    const modal = document.getElementById('globalStatusModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    const form = document.getElementById('globalStatusForm');
    const restoreBtn = document.getElementById('restoreNormalBtn');
    
    if (window.GlobalHolidayState && window.GlobalHolidayState.isActive) {
        const data = window.GlobalHolidayState.data;
        document.getElementById('gsStatusType').value = data.statusType || 'holiday';
        document.getElementById('gsTitle').value = data.title || '';
        document.getElementById('gsReason').value = data.reason || '';
        document.getElementById('gsStartDate').value = data.startDate || '';
        document.getElementById('gsEndDate').value = data.endDate || '';
        restoreBtn.style.display = 'block';
    } else {
        if (form) form.reset();
        
        // Default to today
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        document.getElementById('gsStartDate').value = todayStr;
        document.getElementById('gsEndDate').value = todayStr;
        
        restoreBtn.style.display = 'none';
    }
};

window.closeGlobalStatusModal = function() {
    const modal = document.getElementById('globalStatusModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
};

// 2. Main Initialization
// ── Custom UI Helpers ──────────────────────────────────────────
window.showToast = function(message, type = 'success') {
    const toast = document.createElement('div');
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
    const color = type === 'success' ? '#10b981' : '#ef4444';
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.95);
        color: #fff;
        padding: 12px 24px;
        border-radius: 12px;
        border-left: 4px solid ${color};
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        font-size: 14px;
        font-weight: 600;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        backdrop-filter: blur(10px);
        white-space: nowrap;
    `;
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.top = '40px';
    });
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.top = '20px';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.showConfirmModal = function(title, message, onConfirm) {
    const confirmOverlay = document.createElement('div');
    confirmOverlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(5px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
    `;

    const modalBox = document.createElement('div');
    modalBox.style.cssText = `
        background: #0f172a;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 20px;
        padding: 24px;
        width: 90%;
        max-width: 320px;
        text-align: center;
        box-shadow: 0 15px 40px rgba(0,0,0,0.5);
        transform: scale(0.9);
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    modalBox.innerHTML = `
        <div style="font-size: 40px; color: #ef4444; margin-bottom: 15px;">
            <i class="fa-solid fa-trash-can"></i>
        </div>
        <h3 style="color: #fff; font-size: 18px; margin-bottom: 10px;">${title}</h3>
        <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px; line-height: 1.5;">${message}</p>
        <div style="display: flex; gap: 12px;">
            <button id="cancelConfirm" style="flex: 1; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.1); color: #fff; border: none; font-weight: 600; cursor: pointer; transition: background 0.2s;">Cancel</button>
            <button id="okConfirm" style="flex: 1; padding: 12px; border-radius: 12px; background: #ef4444; color: #fff; border: none; font-weight: 600; cursor: pointer; transition: background 0.2s; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">Delete</button>
        </div>
    `;

    confirmOverlay.appendChild(modalBox);
    document.body.appendChild(confirmOverlay);

    requestAnimationFrame(() => {
        confirmOverlay.style.opacity = '1';
        modalBox.style.transform = 'scale(1)';
    });

    const closeModal = () => {
        confirmOverlay.style.opacity = '0';
        modalBox.style.transform = 'scale(0.9)';
        setTimeout(() => confirmOverlay.remove(), 200);
    };

    document.getElementById('cancelConfirm').addEventListener('click', closeModal);
    confirmOverlay.addEventListener('click', (evt) => {
        if(evt.target === confirmOverlay) closeModal();
    });

    document.getElementById('okConfirm').addEventListener('click', async () => {
        const btn = document.getElementById('okConfirm');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;
        await onConfirm();
        closeModal();
    });
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG: DOMContentLoaded fired");

    // Initialize Firebase safely
    let db;
    try {
        if (typeof firebase === 'undefined') {
            throw new Error("Firebase SDK not loaded! Check your internet connection or script tags.");
        }
        db = firebase.firestore();
        console.log("DEBUG: Firebase initialized successfully");
    } catch (err) {
        console.error("FIREBASE ERROR:", err);
        const loader = document.getElementById('classesLoader');
        if (loader) loader.innerHTML = `<p style="color:red; padding:20px;">Connection Error: ${err.message}</p>`;
        // Don't return, let UI work at least
    }

    // New: Sync Course Suggestions from DB
    const syncCourseSuggestions = async () => {
        if (!db) return;
        console.log("DEBUG: Syncing course suggestions...");
        const courseSet = new Set();
        
        try {
            // 1. Get courses from existing class batches
            const classSnap = await db.collection('classes').get();
            classSnap.forEach(doc => {
                if (doc.data().courseName) courseSet.add(doc.data().courseName);
            });

            // 2. Get courses from student profiles
            const studentSnap = await db.collection('users').where('role', '==', 'student').get();
            studentSnap.forEach(doc => {
                if (doc.data().course) courseSet.add(doc.data().course);
            });

            console.log(`DEBUG: Found ${courseSet.size} unique courses for sync`);
            const datalist = document.getElementById('courseList');
            if (datalist) {
                datalist.innerHTML = Array.from(courseSet)
                    .sort()
                    .map(course => `<option value="${course}">`)
                    .join('');
            }
        } catch (err) {
            console.error("SYNC ERROR:", err);
        }
    };

    // Bind Event Listeners
    const addClassBtn = document.getElementById('addClassBtn');
    const closeModal = document.getElementById('closeModal');
    const classForm = document.getElementById('classForm');

    if (addClassBtn) {
        console.log("DEBUG: Found #addClassBtn, attaching listener");
        addClassBtn.addEventListener('click', (e) => {
            console.log("DEBUG: Click event fired on FAB");
            e.preventDefault();
            window.openClassModal('create');
        });
    } else {
        console.error("CRITICAL: #addClassBtn NOT FOUND!");
    }

    if (closeModal) {
        closeModal.addEventListener('click', window.closeClassModal);
    }
    
    const closeStatusModal = document.getElementById('closeStatusModal');
    if (closeStatusModal) {
        closeStatusModal.addEventListener('click', window.closeStatusModal);
    }

    const statusSelect = document.getElementById('classStatusSelect');
    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            document.getElementById('cancelReasonGroup').style.display = val === 'cancelled' ? 'flex' : 'none';
            document.getElementById('holidayTitleGroup').style.display = val === 'holiday' ? 'flex' : 'none';
        });
    }

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('classModal');
        const sModal = document.getElementById('statusModal');
        const gsModal = document.getElementById('globalStatusModal');
        if (e.target === modal) window.closeClassModal();
        if (e.target === sModal) window.closeStatusModal();
        if (e.target === gsModal) window.closeGlobalStatusModal();
    });

    const statusForm = document.getElementById('statusForm');
    if (statusForm && db) {
        statusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('statusClassId').value;
            const status = document.getElementById('classStatusSelect').value;
            const cancelReason = document.getElementById('cancelReasonInput').value.trim();
            const holidayTitle = document.getElementById('holidayTitleInput').value.trim();
            const submitBtn = document.getElementById('saveStatusBtn');
            const originalText = submitBtn.textContent;

            const updateData = { status };
            if (status === 'cancelled') updateData.cancelReason = cancelReason;
            if (status === 'holiday') updateData.holidayTitle = holidayTitle;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

            try {
                await db.collection('classes').doc(id).update(updateData);
                window.closeStatusModal();
                window.showToast("Class status updated", "success");
            } catch (error) {
                console.error("STATUS UPDATE ERROR:", error);
                window.showToast("Failed to update status: " + error.message, "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // Save Logic
    if (classForm && db) {
        classForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editClassId').value;
            const submitBtn = document.getElementById('saveClassBtn');
            const originalText = submitBtn.textContent;
            
            // Collect selected days
            const selectedDays = Array.from(document.querySelectorAll('#daySelector input[type="checkbox"]:checked'))
                .map(cb => cb.value);

            const targetBatchName = document.getElementById('batchName').value.trim();
            
            let calculatedStudentCount = 0;
            try {
                // Fetch students matching this batch to calculate studentCount
                const studentsSnap = await db.collection('users').where('role', '==', 'student').get();
                studentsSnap.forEach(doc => {
                    const studentData = doc.data();
                    let studentBatches = [];
                    if (Array.isArray(studentData.batches)) {
                        studentBatches = studentData.batches;
                    } else if (studentData.batchName || studentData.batch) {
                        studentBatches = [(studentData.batchName || studentData.batch).trim()];
                    }
                    // check legacy fields as well
                    if (studentData.batch1) studentBatches.push(studentData.batch1.trim());
                    if (studentData.batch2) studentBatches.push(studentData.batch2.trim());
                    if (studentData.batch3) studentBatches.push(studentData.batch3.trim());

                    if (studentBatches.includes(targetBatchName)) {
                        calculatedStudentCount++;
                    }
                });
            } catch (err) {
                console.warn("Could not calculate student count:", err);
            }

            const classData = {
                courseName: document.getElementById('courseName').value.trim(),
                subject: document.getElementById('subjectName').value.trim(),
                batchName: targetBatchName,
                startTime: document.getElementById('startTime').value,
                endTime: document.getElementById('endTime').value,
                studentCount: calculatedStudentCount,
                classType: document.getElementById('classType').value,
                teacherName: document.getElementById('teacherName') ? document.getElementById('teacherName').value.trim() : '',
                recurringDays: selectedDays, // Added recurring days
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };


            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            try {
                if (id) {
                    console.log("Batch Input Value:", classData.batchName);
                    await db.collection('classes').doc(id).update(classData);
                    console.log("Saved Batch:", classData.batchName);
                } else {
                    console.log("Batch Input Value:", classData.batchName);
                    classData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('classes').add(classData);
                    console.log("Saved Batch:", classData.batchName);
                }
                window.closeClassModal();
                syncCourseSuggestions(); // Refresh list after adding new one
            } catch (error) {
                console.error("SAVE ERROR:", error);
                showToast("Failed to save class: " + error.message, "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    const deleteClassBtn = document.getElementById('deleteClassBtn');
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    if (deleteClassBtn && db) {
        deleteClassBtn.addEventListener('click', () => {
            const id = document.getElementById('editClassId').value;
            const batchName = document.getElementById('batchName').value;
            if (!id) return;
            
            document.getElementById('deleteClassBatchDisplay').textContent = batchName;
            deleteConfirmModal.classList.add('active');
        });
        
        cancelDeleteBtn.addEventListener('click', () => {
            deleteConfirmModal.classList.remove('active');
        });
        
        confirmDeleteBtn.addEventListener('click', async () => {
            const id = document.getElementById('editClassId').value;
            if (!id) return;
            
            const originalText = confirmDeleteBtn.textContent;
            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
            
            try {
                await db.collection('classes').doc(id).delete();
                deleteConfirmModal.classList.remove('active');
                window.closeClassModal();
                window.showToast("Class deleted successfully!", "success");
            } catch (error) {
                console.error("DELETE ERROR:", error);
                window.showToast("Failed to delete class: " + error.message, "error");
            } finally {
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = originalText;
            }
        });
    }

    // Global Status Form Submission
    const globalStatusForm = document.getElementById('globalStatusForm');
    if (globalStatusForm && db) {
        globalStatusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('saveGlobalStatusBtn');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying...';

            const payload = {
                statusType: document.getElementById('gsStatusType').value,
                title: document.getElementById('gsTitle').value.trim(),
                reason: document.getElementById('gsReason').value.trim(),
                startDate: document.getElementById('gsStartDate').value,
                endDate: document.getElementById('gsEndDate').value,
                active: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('globalSettings').doc('classStatus').set(payload, { merge: true });
                window.closeGlobalStatusModal();
                window.showToast("Global status applied successfully!", "success");
            } catch (error) {
                console.error("GLOBAL STATUS ERROR:", error);
                window.showToast("Failed to apply global status: " + error.message, "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });

        const restoreBtn = document.getElementById('restoreNormalBtn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', async () => {
                const originalText = restoreBtn.textContent;
                restoreBtn.disabled = true;
                restoreBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Restoring...';
                
                try {
                    await db.collection('globalSettings').doc('classStatus').update({ active: false });
                    window.closeGlobalStatusModal();
                    window.showToast("Normal classes restored", "success");
                } catch (error) {
                    console.error("RESTORE ERROR:", error);
                    window.showToast("Failed to restore: " + error.message, "error");
                } finally {
                    restoreBtn.disabled = false;
                    restoreBtn.textContent = originalText;
                }
            });
        }
    }

    // Helper to calculate status based on scheduling data
    const calculateStatus = (classData) => {
        // OVERRIDE: Check Global Holiday State
        if (window.GlobalHolidayState && window.GlobalHolidayState.isActive && window.GlobalHolidayState.data) {
            return { 
                status: window.GlobalHolidayState.data.statusType || 'holiday', 
                title: window.GlobalHolidayState.data.title || 'Holiday',
                timeLeft: '' 
            };
        }

        if (classData.status === 'cancelled') return { status: 'cancelled', title: classData.cancelReason || 'Cancelled' };
        if (classData.status === 'holiday') return { status: 'holiday', title: classData.holidayTitle || 'Holiday' };
        if (classData.status === 'completed') return { status: 'completed' };

        const { startTime, endTime, recurringDays } = classData;
        if (!startTime || !endTime) return { status: 'upcoming' };

        const now = new Date();
        const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayShort = daysShort[now.getDay()]; // e.g. "Sun"

        // 1. Check Day Schedule
        let isClassToday = false;

        if (!recurringDays) {
            isClassToday = false;
        } else if (Array.isArray(recurringDays)) {
            isClassToday = recurringDays.some(d => {
                const normalized = d.trim().toLowerCase();
                return normalized.startsWith(todayShort.toLowerCase());
            });
        } else if (typeof recurringDays === 'string') {
            const daysStr = recurringDays.toUpperCase();
            if (daysStr === 'DAILY') {
                isClassToday = true;
            } else if (daysStr === 'MON-SAT') {
                isClassToday = now.getDay() >= 1 && now.getDay() <= 6;
            } else if (daysStr === 'MON-FRI') {
                isClassToday = now.getDay() >= 1 && now.getDay() <= 5;
            } else if (daysStr === 'SUN') {
                isClassToday = now.getDay() === 0;
            } else {
                const daysList = daysStr.split(/[•,\s-]+/).filter(d => d.length > 0);
                isClassToday = daysList.some(d => d.trim().toUpperCase().startsWith(todayShort.toUpperCase()));
            }
        }

        if (!isClassToday) return { status: 'no-class' };

        // 2. Robust Time Parsing (handles AM/PM and 24h formats)
        const parseTime = (timeStr) => {
            if (!timeStr) return null;
            // Handle both "08:00 AM" and "08:00AM" or "14:00"
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

        if (!start || !end) return { status: 'upcoming' };

        // 3. Status logic with premium countdowns
        const startPlus5 = new Date(start.getTime() + 5 * 60000);
        let result = { status: 'upcoming' };
        
        if (now >= startPlus5 && now <= end) {
            const diffMs = end - now;
            const m = Math.floor(diffMs / 60000);
            result = { status: 'live', timeLeft: `${m}m` };
        } else if (now >= start && now < startPlus5) {
            result = { status: 'transition', timeLeft: '' };
        } else if (now > end) {
            result = { status: 'done' };
        } else {
            const diffMs = start - now;
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins >= 0 && diffMins <= 60) {
                const m = diffMins;
                const s = Math.floor((diffMs % 60000) / 1000);
                const timeLeft = `${m}m`;
                
                if (diffMins <= 5) {
                    const urgentTime = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                    result = { status: 'countdown-urgent', timeLeft: urgentTime };
                } else {
                    result = { status: 'countdown', timeLeft };
                }
            }
        }

        // 4. Debugging Logs (Requirement 9)
        console.log("Current Time:", now.toLocaleTimeString());
        console.log("Class End Time:", endTime);
        console.log("Parsed End Minutes:", end.getHours() * 60 + end.getMinutes());
        console.log("Completed Status:", result.status === 'done' ? 'TRUE' : 'FALSE');

        return result;
    };

    // Helper to format 24h time to 12h format
    const formatTime12 = (time24) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':');
        let h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${minutes} ${ampm}`;
    };

    // Helper to format days for card display with intelligent range detection

    const formatDays = (days) => {
        if (!days || !Array.isArray(days) || days.length === 0) return 'Days Not Set';
        if (days.length === 7) return 'DAILY';
        
        const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        // Sort input days based on master order
        const sortedDays = [...days].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
        
        // Find consecutive ranges
        const ranges = [];
        if (sortedDays.length > 0) {
            let start = sortedDays[0];
            let prev = sortedDays[0];
            
            for (let i = 1; i <= sortedDays.length; i++) {
                const current = sortedDays[i];
                const prevIdx = dayOrder.indexOf(prev);
                const currIdx = current ? dayOrder.indexOf(current) : -1;
                
                if (currIdx !== prevIdx + 1) {
                    // Range ended
                    if (start === prev) {
                        ranges.push(start.toUpperCase());
                    } else {
                        ranges.push(`${start.toUpperCase()}-${prev.toUpperCase()}`);
                    }
                    start = current;
                }
                prev = current;
            }
        }
        
        // If it's all one range, return START-END
        // If it's broken, return with bullets
        return ranges.join(' • ');
    };



    // Load Classes
    let cachedAllClassesData = [];
    const renderAllClasses = async (allClasses) => {
        const classesGrid = document.getElementById('classesGrid');
        const emptyState = document.getElementById('emptyState');
        if (!classesGrid) return;
        
        let allStudents = [];
        try {
            if (window.LocalCache) {
                allStudents = (await window.LocalCache.getAll('students')) || [];
            } else {
                const snap = await db.collection('users').where('role', '==', 'student').get();
                allStudents = snap.docs.map(d => d.data());
            }
        } catch (e) {
            console.error("Error fetching students for count:", e);
        }

        // 1. Calculate status and priority for sorting
        const processed = allClasses.map(cls => {
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
            cls.computedStudentCount = cCount || cls.studentCount || 0;

            const statusObj = calculateStatus(cls);
            let priority = 4; // Default: Completed
            let subPriority = 0;

            if (statusObj.status === 'live') {
                priority = 1;
                // Sub-priority: nearest ending first
                const [eH, eM] = cls.endTime.split(':').map(Number);
                subPriority = eH * 60 + eM;
            } else if (['upcoming', 'countdown', 'countdown-urgent', 'transition'].includes(statusObj.status)) {
                priority = 2;
                // Sub-priority: nearest starting first
                const [sH, sM] = cls.startTime.split(':').map(Number);
                subPriority = sH * 60 + sM;
            } else if (statusObj.status === 'no-class') {
                priority = 3;
            }

            return { ...cls, autoStatus: statusObj, priority, subPriority };
        });

        // 2. Sorting Logic (Step 4 & 8)
        const liveClasses = processed.filter(c => c.priority === 1).sort((a, b) => a.subPriority - b.subPriority);
        const upcomingClasses = processed.filter(c => c.priority === 2).sort((a, b) => a.subPriority - b.subPriority);
        const noClassClasses = processed.filter(c => c.priority === 3);
        const completedClasses = processed.filter(c => c.priority === 4);

        const sortedClasses = [...liveClasses, ...upcomingClasses, ...noClassClasses, ...completedClasses];

        // 3. Debugging Logs (Step 9)
        console.log("Live Classes:", liveClasses);
        console.log("Upcoming Classes:", upcomingClasses);
        console.log("No Class:", noClassClasses);
        console.log("Completed Classes:", completedClasses);
        console.log("Sorted Classes:", sortedClasses);

        // 4. FLIP Animation - Part 1: Record current positions
        const cards = Array.from(classesGrid.querySelectorAll('.class-card'));
        const firstPositions = cards.map(card => {
            const rect = card.getBoundingClientRect();
            return { id: card.dataset.id, top: rect.top, left: rect.left };
        });

        // 5. Update DOM
        classesGrid.innerHTML = '';
        if (sortedClasses.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
        } else {
            if (emptyState) emptyState.style.display = 'none';
            sortedClasses.forEach(course => {
                const card = document.createElement('div');
                card.className = 'class-card';
                card.dataset.id = course.id;
                
                // Store metadata for auto-refresh
                card.dataset.startTime = course.startTime || '';
                card.dataset.endTime = course.endTime || '';
                card.dataset.days = JSON.stringify(course.recurringDays || []);
                card.dataset.statusStr = course.status || 'active';
                card.dataset.lastStatusPhase = course.autoStatus.status;

                card.innerHTML = `
                    <div class="card-actions">
                        <div class="action-hint status-hint"><i class="fa-solid fa-list-check"></i></div>
                        <div class="action-hint edit-hint"><i class="fa-solid fa-pen"></i></div>
                    </div>
                    <div class="class-info">
                        <h4>${course.courseName}</h4>
                        <p><i class="fa-solid fa-layer-group"></i> ${course.subject ? course.subject + ' | ' : ''}${course.batchName}</p>
                        <p><i class="fa-regular fa-clock"></i> ${formatTime12(course.startTime)} - ${formatTime12(course.endTime)}</p>
                        <p class="card-recurring-days"><i class="fa-solid fa-calendar-week"></i> ${formatDays(course.recurringDays)}</p>
                        <span class="class-type-badge ${course.classType || 'theory'}"><i class="fa-solid ${course.classType === 'lab' ? 'fa-computer' : 'fa-book'}"></i> ${course.classType === 'lab' ? 'LAB' : 'THEORY'}</span>
                    </div>
                    <div class="class-footer">
                        <span class="student-count"><i class="fa-solid fa-users"></i> ${course.computedStudentCount} Students</span>
                        <span class="status-indicator ${course.autoStatus.status === 'completed' ? 'done' : course.autoStatus.status}">
                            ${course.autoStatus.status === 'live' ? '<span class="live-dot"></span> LIVE NOW • ' + course.autoStatus.timeLeft : 
                              (course.autoStatus.status === 'cancelled' ? 'CANCELLED' + (course.autoStatus.title && course.autoStatus.title !== 'Cancelled' ? ` • ${course.autoStatus.title}` : '') :
                              (course.autoStatus.status === 'holiday' ? 'HOLIDAY' + (course.autoStatus.title && course.autoStatus.title !== 'Holiday' ? ` • ${course.autoStatus.title}` : '') :
                              (course.autoStatus.status === 'transition' ? 'BREAK TIME' :
                              (course.autoStatus.status === 'countdown-urgent' ? 'LIVE IN ' + course.autoStatus.timeLeft :
                              (course.autoStatus.status === 'countdown' ? 'UPCOMING • ' + course.autoStatus.timeLeft :
                              (course.autoStatus.status === 'done' || course.autoStatus.status === 'completed' ? 'COMPLETED' : 
                              (course.autoStatus.status === 'no-class' ? 'NO CLASS' : 'UPCOMING')))))))}
                        </span>
                    </div>
                `;
                
                // Re-bind listeners
                card.querySelector('.status-hint').onclick = (e) => {
                    e.stopPropagation();
                    window.openStatusModal(course);
                };
                card.onclick = () => window.openClassModal('edit', course);
                classesGrid.appendChild(card);
            });
        }

        // 6. FLIP Animation - Part 2: Play transition
        const newCards = Array.from(classesGrid.querySelectorAll('.class-card'));
        newCards.forEach(card => {
            const first = firstPositions.find(p => p.id === card.dataset.id);
            if (first) {
                const last = card.getBoundingClientRect();
                const deltaY = first.top - last.top;
                if (deltaY !== 0) {
                    card.style.transition = 'none';
                    card.style.transform = `translateY(${deltaY}px)`;
                    requestAnimationFrame(() => {
                        card.style.transition = 'transform 0.5s cubic-bezier(0.2, 0, 0.2, 1)';
                        card.style.transform = 'none';
                    });
                }
            }
        });
    };

    if (db) {
        const classesLoader = document.getElementById('classesLoader');
        
        // 1. Instant Render from LocalCache
        if (window.LocalCache) {
            window.LocalCache.getAll('classes').then(cachedData => {
                if (cachedData && cachedData.length > 0) {
                    // Sort descending by createdAt or just use as is since onSnapshot will overwrite soon
                    cachedAllClassesData = cachedData;
                    renderAllClasses(cachedAllClassesData);
                    if (classesLoader) classesLoader.style.display = 'none';
                }
            });
        }

        // 2. Real-time Firebase Sync
        db.collection('classes').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
            cachedAllClassesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAllClasses(cachedAllClassesData);
            if (classesLoader) classesLoader.style.display = 'none';
        }, (err) => {
            console.error("FETCH ERROR:", err);
            if (classesLoader) classesLoader.style.display = 'none';
        });
    }

    // Search Logic
    const classSearch = document.getElementById('classSearch');
    if (classSearch) {
        classSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const cards = document.querySelectorAll('.class-card');
            let visibleCount = 0;
            
            cards.forEach(card => {
                const title = card.querySelector('h4').textContent.toLowerCase();
                const subBatch = card.querySelector('p:nth-child(2)').textContent.toLowerCase();
                
                if (term === '') {
                    card.style.display = 'flex';
                    visibleCount++;
                    return;
                }

                // Precise Matching: Check if any word starts with the search term
                // This ensures "DCA" matches "DCA" or "DCA MORNING" but NOT "ADCA"
                const titleWords = title.split(/\s+/);
                const subBatchWords = subBatch.split(/[|\s\-\.]+/).filter(w => w.length > 0);
                
                const isMatch = titleWords.some(word => word.startsWith(term)) || 
                                subBatchWords.some(word => word.startsWith(term));
                
                if (isMatch) {
                    card.style.display = 'flex';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            // Update empty state if search returns nothing
            const emptyState = document.getElementById('emptyState');
            if (emptyState) {
                if (visibleCount === 0 && term !== '') {
                    emptyState.style.display = 'block';
                    emptyState.querySelector('h3').textContent = 'No Matches Found';
                    emptyState.querySelector('p').innerHTML = `No classes match "<b>${term}</b>"`;
                } else if (visibleCount === 0 && term === '') {
                    emptyState.style.display = 'block';
                    emptyState.querySelector('h3').textContent = 'No Classes Found';
                } else {
                    emptyState.style.display = 'none';
                }
            }
        });
    }



    // Initial Sync
    syncCourseSuggestions();

    // Listen to Global Holiday changes to force re-render
    document.addEventListener('GLOBAL_HOLIDAY_UPDATED', () => {
        if (cachedAllClassesData.length > 0) {
            console.log("[All Classes] Global holiday state changed. Re-sorting list...");
            renderAllClasses(cachedAllClassesData);
        }
    });

    // Auto-refresh status labels every second (Realtime Animated Counters)
    setInterval(() => {
        const cards = document.querySelectorAll('.class-card');
        let needsResort = false;

        cards.forEach(card => {
            const classData = {
                startTime: card.dataset.startTime,
                endTime: card.dataset.endTime,
                recurringDays: JSON.parse(card.dataset.days || '[]'),
                status: card.dataset.statusStr
            };
            const autoStatus = calculateStatus(classData);
            const indicator = card.querySelector('.status-indicator');
            const lastPhase = card.dataset.lastStatusPhase;

            if (lastPhase && lastPhase !== autoStatus.status) {
                needsResort = true;
            }

            if (indicator) {
                indicator.className = `status-indicator ${autoStatus.status === 'completed' ? 'done' : autoStatus.status}`;
                indicator.innerHTML = autoStatus.status === 'live' ? `<span class="live-dot"></span> LIVE NOW • ${autoStatus.timeLeft}` : 
                                      (autoStatus.status === 'cancelled' ? 'CANCELLED' + (autoStatus.title && autoStatus.title !== 'Cancelled' ? ` • ${autoStatus.title}` : '') :
                                      (autoStatus.status === 'holiday' ? 'HOLIDAY' + (autoStatus.title && autoStatus.title !== 'Holiday' ? ` • ${autoStatus.title}` : '') :
                                      (autoStatus.status === 'transition' ? 'BREAK TIME' :
                                      (autoStatus.status === 'countdown-urgent' ? `LIVE IN ${autoStatus.timeLeft}` :
                                      (autoStatus.status === 'countdown' ? `UPCOMING • ${autoStatus.timeLeft}` :
                                      (autoStatus.status === 'done' || autoStatus.status === 'completed' ? 'COMPLETED' : 
                                      (autoStatus.status === 'no-class' ? 'NO CLASS' : 'UPCOMING')))))));
            }
        });

        if (needsResort && cachedAllClassesData.length > 0) {
            console.log("[All Classes] Status change detected. Re-sorting list...");
            renderAllClasses(cachedAllClassesData);
        }
    }, 1000);
});
