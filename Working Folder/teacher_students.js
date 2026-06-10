// teacher_students.js — RN-TECH Teacher Portal
// Fetches students from Firestore and renders a full management view.
console.log("teacher_students.js loaded");
console.log("[Diagnostics] Transparency System Active");
console.log("[Diagnostics] Bottom Nav Blend Active");

document.addEventListener('DOMContentLoaded', () => {

    // ── Firebase Init ──────────────────────────────────────────
    let db, auth;
    try {
        if (typeof firebase === 'undefined') throw new Error("Firebase SDK not loaded.");
        db   = firebase.firestore();
        auth = firebase.auth();
    } catch (err) {
        console.error("FIREBASE ERROR:", err);
        document.getElementById('studentsLoader').innerHTML =
            `<p style="color:#ef4444;padding:20px;text-align:center">Connection Error: ${err.message}</p>`;
        return;
    }

    // ── DOM Refs ───────────────────────────────────────────────
    const studentSearch      = document.getElementById('studentSearch');
    const filterToggleBtn    = document.getElementById('filterToggleBtn');
    const filterPanel        = document.getElementById('filterPanel');
    const filterCourseEl     = document.getElementById('filterCourse');
    const filterBatchEl      = document.getElementById('filterBatch');
    const filterAttendanceEl = document.getElementById('filterAttendance');
    const studentList        = document.getElementById('studentList');
    const studentsLoader     = document.getElementById('studentsLoader');
    const emptyState         = document.getElementById('emptyState');

    // Analytics elements
    const totalStudentsCount = document.getElementById('totalStudentsCount');
    const presentTodayCount  = document.getElementById('presentTodayCount');
    const avgAttendanceEl    = document.getElementById('avgAttendance');
    const lowAttendanceCount = document.getElementById('lowAttendanceCount');

    // ── Filter toggle ──────────────────────────────────────────
    filterToggleBtn.addEventListener('click', () => {
        const isOpen = filterPanel.style.display !== 'none';
        filterPanel.style.display = isOpen ? 'none' : 'flex';
        filterToggleBtn.classList.toggle('active', !isOpen);
    });

    // ── State ──────────────────────────────────────────────────
    let allStudents = []; // master list
    const getLocalTodayDate = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const todayStr = getLocalTodayDate();

    // ── Helpers ────────────────────────────────────────────────
    const getInitials = (name = '') =>
        name.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

    const getAttendanceClass = (pct) => {
        if (pct >= 75) return { fill: 'fill-good',     pct: 'pct-good',     badge: 'badge-good',     label: 'Active' };
        if (pct >= 50) return { fill: 'fill-warning',  pct: 'pct-warning',  badge: 'badge-warning',  label: 'Warning' };
        return             { fill: 'fill-critical', pct: 'pct-critical', badge: 'badge-critical', label: 'Low Attend.' };
    };

    // Avatar gradient colours (cycles by index)
    const gradients = [
        'linear-gradient(135deg,#2563eb,#7c3aed)',
        'linear-gradient(135deg,#059669,#0891b2)',
        'linear-gradient(135deg,#d97706,#dc2626)',
        'linear-gradient(135deg,#7c3aed,#db2777)',
        'linear-gradient(135deg,#0891b2,#2563eb)',
    ];

    // ── Populate filter dropdowns ──────────────────────────────
    const populateFilters = (students) => {
        const courses = [...new Set(students.map(s => s.course).filter(Boolean))].sort();
        
        // Collect batches from all 3 possible fields
        const allBatchValues = [];
        students.forEach(s => {
            if (s.batch1) allBatchValues.push(s.batch1);
            if (s.batch2) allBatchValues.push(s.batch2);
            if (s.batch3) allBatchValues.push(s.batch3);
            // Fallback for legacy data
            if (!s.batch1 && (s.batch || s.batchName)) allBatchValues.push(s.batch || s.batchName);
        });
        
        const batches = [...new Set(allBatchValues.filter(Boolean))].sort();

        filterCourseEl.innerHTML = '<option value="">All Courses</option>' +
            courses.map(c => `<option value="${c}">${c}</option>`).join('');

        filterBatchEl.innerHTML = '<option value="">All Batches</option>' +
            batches.map(b => `<option value="${b}">${b}</option>`).join('');
    };

    // ── Update Analytics strip ─────────────────────────────────
    const updateAnalytics = (students) => {
        const total = students.length;
        const low   = students.filter(s => (s._attendancePct || 0) < 75).length;
        const sum   = students.reduce((acc, s) => acc + (s._attendancePct || 0), 0);
        const avg   = total > 0 ? Math.round(sum / total) : 0;
        const presentToday = students.filter(s => s._presentToday).length;
        console.log(`[Diagnostics] Analytics Updated: ${total} students, ${presentToday} present today.`);

        totalStudentsCount.textContent = total;
        lowAttendanceCount.textContent = low;
        avgAttendanceEl.textContent    = avg + '%';
        presentTodayCount.textContent  = presentToday;
    };
    // ── Time Formatter ─────────────────────────────────────────
    const formatTime12Hr = (time24) => {
        if (!time24) return '';
        let [hours, minutes] = time24.split(':');
        hours = parseInt(hours, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; 
        return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    };

    // ── Render student cards ───────────────────────────────────
    const renderStudents = (students) => {
        studentList.innerHTML = '';

        if (students.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        students.forEach((student, idx) => {
            const pct      = student._attendancePct || 0;
            const cls      = getAttendanceClass(pct);
            const initials = getInitials(student.name);
            const gradient = gradients[idx % gradients.length];
            
            // Build multi-course display
            let courseArr = [];
            if (Array.isArray(student.courses) && student.courses.length > 0) courseArr = student.courses;
            else courseArr = [student.course1 || student.course || '', student.course2 || '', student.course3 || ''];
            courseArr = courseArr.filter(Boolean).map(c => c.toUpperCase());
            const courseDisplay = courseArr.length > 0 ? courseArr.join(' | ') : '—';
            
            // Build multi-batch display string
            let batchArr = [];
            if (Array.isArray(student.batches) && student.batches.length > 0) batchArr = student.batches;
            else batchArr = [student.batch1 || student.batch || student.batchName || '', student.batch2 || '', student.batch3 || ''];
            batchArr = batchArr.filter(Boolean).map(b => b.toUpperCase());
            const batchDisplay = batchArr.length > 0 ? batchArr.join(' • ') : '—';
            
            // Display active subjects cleanly merged from currently assigned batches ONLY
            let activeSubjects = [];
            batchArr.forEach(batch => {
                const bNorm = batch.toUpperCase().trim();
                const matchedClass = classesCache.find(c => (c.batchName || '').toUpperCase().trim() === bNorm);
                if (matchedClass && matchedClass.subject) {
                    activeSubjects.push(matchedClass.subject);
                }
            });
            
            // Fallback for legacy students (if no batches matched)
            if (activeSubjects.length === 0) {
                if (Array.isArray(student.subjects) && student.subjects.length > 0) activeSubjects = student.subjects;
                else activeSubjects = [student.subject1 || student.subjectName || student.subject || '', student.subject2 || '', student.subject3 || ''];
            }
            
            activeSubjects = [...new Set(activeSubjects.filter(Boolean).map(s => s.toUpperCase()))];
            
            // Debugging Output
            console.log("student.batches:", batchArr);
            console.log("resolvedBatchSubjects:", activeSubjects);
            console.log("displaySubjects:", activeSubjects.join(' | '));
            
            const subjectDisplay = activeSubjects.length > 0 ? activeSubjects.join(' | ') : '—';
            
            const present  = student._present || 0;
            const absent   = student._absent  || 0;
            const total    = present + absent;
            const photoUrl = student.profileImage || student.photoUrl || '';
            const isLegacyAvatar = photoUrl.includes('pravatar.cc');
            const showPhoto = photoUrl && !isLegacyAvatar;

            // Build avatar HTML — real photo or gradient initials
            const avatarHtml = showPhoto
                ? `<img class="sc-photo" src="${photoUrl}" alt="${student.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
            const initialsHtml = `<div class="sc-initials" style="background:${gradient};display:${showPhoto ? 'none' : 'flex'}">${initials || '<i class="fa-solid fa-user"></i>'}</div>`;

            const lowWarning = pct < 75
                ? `<span class="sc-low-badge"><i class="fa-solid fa-triangle-exclamation"></i> LOW ATTENDANCE</span>`
                : '';

            const subject  = student.subject ? student.subject.toUpperCase() : '';
            
            // Dynamically calculate class timings from assigned batches for the card
            let calcLabStart = null, calcLabEnd = null, calcTheoryStart = null, calcTheoryEnd = null;
            batchArr.forEach(batch => {
                const bNorm = batch.toUpperCase().trim();
                const matchedClass = classesCache.find(c => (c.batchName || '').toUpperCase().trim() === bNorm);
                if (matchedClass && matchedClass.startTime && matchedClass.endTime) {
                    const classType = (matchedClass.classType || 'theory').toLowerCase();
                    if (classType === 'lab') {
                        if (!calcLabStart || matchedClass.startTime < calcLabStart) calcLabStart = matchedClass.startTime;
                        if (!calcLabEnd || matchedClass.endTime > calcLabEnd) calcLabEnd = matchedClass.endTime;
                    } else {
                        if (!calcTheoryStart || matchedClass.startTime < calcTheoryStart) calcTheoryStart = matchedClass.startTime;
                        if (!calcTheoryEnd || matchedClass.endTime > calcTheoryEnd) calcTheoryEnd = matchedClass.endTime;
                    }
                }
            });

            const finalLabStart = calcLabStart || student.labStartTime;
            const finalLabEnd = calcLabEnd || student.labEndTime;
            const finalTheoryStart = calcTheoryStart || student.theoryStartTime;
            const finalTheoryEnd = calcTheoryEnd || student.theoryEndTime;

            const labTime  = (finalLabStart && finalLabEnd) ? `${formatTime12Hr(finalLabStart)} - ${formatTime12Hr(finalLabEnd)}` : '';
            const theoryTime = (finalTheoryStart && finalTheoryEnd) ? `${formatTime12Hr(finalTheoryStart)} - ${formatTime12Hr(finalTheoryEnd)}` : '';

            const card = document.createElement('div');
            card.className = 'student-card-profile';
            card.innerHTML = `
                <!-- Top Row: Avatar + Info + Edit -->
                <div class="sc-top">
                    <div class="sc-avatar-wrap">
                        ${avatarHtml}
                        ${initialsHtml}
                        <div class="sc-pct-ring ${cls.pct}">${pct}%</div>
                    </div>
                    <div class="sc-info">
                        <div class="sc-name">${(student.name || 'Unknown Student').toUpperCase()}</div>
                        <div class="sc-course">Course :- ${courseDisplay}</div>
                        <div class="sc-subject">Subject :- ${subjectDisplay}</div>
                        <div class="sc-batch"><i class="fa-solid fa-layer-group"></i>${batchDisplay}</div>
                        ${labTime ? `<div class="sc-time"><i class="fa-solid fa-desktop"></i>Lab: ${labTime}</div>` : ''}
                        ${theoryTime ? `<div class="sc-time"><i class="fa-solid fa-book"></i>Theory: ${theoryTime}</div>` : ''}
                    </div>
                    <div class="sc-actions">
                        <button class="sc-edit-btn" title="Edit Student" data-id="${student.id}">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="sc-bar-row">
                    <div class="sc-bar-track">
                        <div class="sc-bar-fill ${cls.fill}" style="width:${Math.min(pct,100)}%"></div>
                    </div>
                </div>

                <!-- Bottom Row: Stats -->
                <div class="sc-stats">
                    <div class="sc-stat-item">
                        <span class="sc-stat-val">${total}</span>
                        <span class="sc-stat-label">Classes</span>
                    </div>
                    <div class="sc-stat-divider"></div>
                    <div class="sc-stat-item">
                        <span class="sc-stat-val" style="color:var(--success)">✓ ${present}</span>
                        <span class="sc-stat-label">Present</span>
                    </div>
                    <div class="sc-stat-divider"></div>
                    <div class="sc-stat-item">
                        <span class="sc-stat-val" style="color:var(--danger)">✗ ${absent}</span>
                        <span class="sc-stat-label">Absent</span>
                    </div>
                    ${lowWarning ? `<div class="sc-stat-divider"></div><div class="sc-stat-item">${lowWarning}</div>` : ''}
                </div>
            `;

            // Edit button — prevent card click bubbling
            card.querySelector('.sc-edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(student);
            });

            // Card click — view student detail
            card.addEventListener('click', () => {
                localStorage.setItem('viewStudentId', student.id);
                console.log('View student:', student.id, student.name);
                // window.location.href = 'teacher_student_detail.html';
            });

            studentList.appendChild(card);
        });

    };

    // ── Filter & Search ────────────────────────────────────────
    const applyFilters = () => {
        const search     = (studentSearch.value || '').toLowerCase().trim();
        const course     = filterCourseEl.value;
        const batch      = filterBatchEl.value;
        const attendance = filterAttendanceEl.value;

        let filtered = allStudents;

        if (search) {
            filtered = filtered.filter(s => {
                const sName = (s.name || '').toLowerCase();
                
                // Multi-course check
                const sc1 = (s.course1 || s.course || '').toLowerCase();
                const sc2 = (s.course2 || '').toLowerCase();
                const sc3 = (s.course3 || '').toLowerCase();
                
                // Multi-subject check
                const ss1 = (s.subject1 || s.subjectName || s.subject || '').toLowerCase();
                const ss2 = (s.subject2 || '').toLowerCase();
                const ss3 = (s.subject3 || '').toLowerCase();
                
                // Multi-batch check
                const b1 = (s.batch1 || s.batch || s.batchName || '').toLowerCase();
                const b2 = (s.batch2 || '').toLowerCase();
                const b3 = (s.batch3 || '').toLowerCase();

                return sName.includes(search) || 
                       sc1.includes(search) || sc2.includes(search) || sc3.includes(search) ||
                       ss1.includes(search) || ss2.includes(search) || ss3.includes(search) ||
                       b1.includes(search) || b2.includes(search) || b3.includes(search);
            });
        }
        if (course) {
            filtered = filtered.filter(s => {
                const c1 = s.course1 || s.course || '';
                const c2 = s.course2 || '';
                const c3 = s.course3 || '';
                return c1 === course || c2 === course || c3 === course;
            });
        }
        if (batch) {
            filtered = filtered.filter(s => {
                const b1 = s.batch1 || s.batch || s.batchName || '';
                const b2 = s.batch2 || '';
                const b3 = s.batch3 || '';
                return b1 === batch || b2 === batch || b3 === batch;
            });
        }
        if (attendance === 'good')     filtered = filtered.filter(s => (s._attendancePct || 0) >= 75);
        if (attendance === 'warning')  filtered = filtered.filter(s => { const p = s._attendancePct || 0; return p >= 50 && p < 75; });
        if (attendance === 'critical') filtered = filtered.filter(s => (s._attendancePct || 0) < 50);

        renderStudents(filtered);
        updateAnalytics(filtered);
    };

    studentSearch.addEventListener('input', applyFilters);
    filterCourseEl.addEventListener('change', applyFilters);
    filterBatchEl.addEventListener('change', applyFilters);
    filterAttendanceEl.addEventListener('change', applyFilters);

    // ── Real-time Data State ───────────────────────────────────
    // ── Real-time Data State ───────────────────────────────────
    let studentsData = {}; // Map of studentId -> student data
    let classesCache = []; // Cache of classes for UI mapping
    let attendanceData = {}; // Map of studentId -> attendance stats
    let studentUnsub = null;
    let attendanceUnsubs = {};

    const processAndRender = () => {
        console.log("[Firestore] Processing and rendering data...");
        
        const enriched = Object.values(studentsData).map(s => {
            const att = attendanceData[s.id] || { present: 0, absent: 0, pct: 0, presentToday: false };
            return {
                ...s,
                _present:       att.present,
                _absent:        att.absent,
                _attendancePct: att.pct,
                _presentToday:  att.presentToday
            };
        });

        // Sort: lowest attendance first (most urgent at top)
        enriched.sort((a, b) => a._attendancePct - b._attendancePct);

        allStudents = enriched;
        populateFilters(enriched);
        applyFilters();
    };

    // ── Main Fetch: Optimized Fetching (Local-First) ────────────
    const loadStudents = async () => {
        console.log("[LocalCache] loadStudents triggered");
        
        try {
            console.log("[LocalCache] Fetching students (LocalCache)...");
            // 1. Fetch Students from cache
            const allLocalStudents = await window.LocalCache.getAll('students');
            
            console.log(`[LocalCache] Fetched ${allLocalStudents.length} students`);
            studentsLoader.style.display = 'none';
            
            if (allLocalStudents.length === 0) {
                emptyState.style.display = 'block';
                studentsData = {};
                processAndRender();
                return;
            }

            emptyState.style.display = 'none';
            studentsData = {};

            allLocalStudents.forEach(s => {
                const normalized = { id: s.id || s.userID, ...s };
                studentsData[normalized.id] = normalized;
            });

            // 1.5 Fetch Classes for UI mapping
            classesCache = await window.LocalCache.getAll('classes');

            // 2. Fetch All Attendance Records from cache
            console.log("[LocalCache] Fetching all attendance records (LocalCache)...");
            const allLocalRecords = await window.LocalCache.getAll('attendanceRecords');
            console.log(`[LocalCache] Fetched ${allLocalRecords.length} total attendance records`);

            // Reset attendance data
            attendanceData = {};
            
            allLocalRecords.forEach(d => {
                const sId = d.studentID;
                
                if (studentsData[sId]) {
                    if (!attendanceData[sId]) {
                        attendanceData[sId] = { present: 0, absent: 0, pct: 0, presentToday: false };
                    }
                    
                    const status = (d.attendanceStatus || '').toLowerCase();
                    if (status === 'present' || status === 'late') attendanceData[sId].present++;
                    else if (status === 'absent') attendanceData[sId].absent++;

                    if (d.date === todayStr && (status === 'present' || status === 'late')) {
                        attendanceData[sId].presentToday = true;
                    }
                }
            });

            // Calculate percentages
            Object.keys(attendanceData).forEach(id => {
                const att = attendanceData[id];
                const total = att.present + att.absent;
                att.pct = total > 0 ? Math.round((att.present / total) * 100) : 0;
            });

            processAndRender();

        } catch (err) {
            console.error("[LocalCache] LOAD ERROR:", err);
            studentsLoader.innerHTML = `<p style="color:#ef4444;padding:20px;text-align:center">Error loading students from cache: ${err.message}</p>`;
        }
    };

    // ── Edit Student Modal Logic ───────────────────────────────
    const showToast = (message, type = 'success') => {
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

    const editModal = document.getElementById('editStudentModal');
    const closeEditModalBtn = document.getElementById('closeEditModal');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const saveEditBtn = document.getElementById('saveEditBtn');
    
    // Inputs
    const editStudentName = document.getElementById('editStudentName');
    const editPhone = document.getElementById('editPhone');
    const editEmail = document.getElementById('editEmail');

    // Dynamic Courses
    const dynamicCourseContainer = document.getElementById('dynamicCourseContainer');
    const addCourseBtn = document.getElementById('addCourseBtn');
    let dynamicCourseCount = 0;

    const createCourseField = (val = '', isRequired = false) => {
        dynamicCourseCount++;
        const div = document.createElement('div');
        div.className = 'input-group';
        div.style.marginBottom = '15px';
        div.style.position = 'relative';

        const label = document.createElement('label');
        label.textContent = `Course ${dynamicCourseCount} ${isRequired ? '*' : ''}`.trim();
        
        const inputContainer = document.createElement('div');
        inputContainer.style.display = 'flex';
        inputContainer.style.gap = '8px';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'rn-input edit-course-input';
        input.placeholder = `e.g. Course ${dynamicCourseCount}`;
        input.value = val;
        input.style.flex = '1';

        inputContainer.appendChild(input);

        if (!isRequired) {
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            removeBtn.style.cssText = 'background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); width: 44px; border-radius: 12px; cursor: pointer; transition: all 0.2s;';
            removeBtn.onclick = () => div.remove();
            inputContainer.appendChild(removeBtn);
        }

        div.appendChild(label);
        div.appendChild(inputContainer);
        dynamicCourseContainer.appendChild(div);
    };

    if (addCourseBtn) addCourseBtn.addEventListener('click', () => createCourseField());

    // --- DYNAMIC SUBJECTS REMOVED ---
    // Subjects are now automatically generated from the assigned courses.

    // Dynamic Batches
    const dynamicBatchContainer = document.getElementById('dynamicBatchContainer');
    const addBatchBtn = document.getElementById('addBatchBtn');

    let dynamicBatchCount = 0;

    const syncBatchTimings = () => {
        const batchInputs = document.querySelectorAll('.edit-batch-input');
        const batchNames = Array.from(batchInputs).map(i => i.value.trim().toUpperCase()).filter(Boolean);
        
        let labStart = null;
        let labEnd = null;
        let theoryStart = null;
        let theoryEnd = null;
        
        batchNames.forEach(bName => {
            const matchedClass = classesCache.find(c => (c.batchName || '').toUpperCase().trim() === bName);
            if (!matchedClass) return;
            
            const classType = (matchedClass.classType || 'theory').toLowerCase();
            const start = matchedClass.startTime;
            const end = matchedClass.endTime;
            
            if (!start || !end) return;
            
            if (classType === 'lab') {
                if (!labStart || start < labStart) labStart = start;
                if (!labEnd || end > labEnd) labEnd = end;
            } else {
                if (!theoryStart || start < theoryStart) theoryStart = start;
                if (!theoryEnd || end > theoryEnd) theoryEnd = end;
            }
        });
        
        document.getElementById('editLabStart').value = labStart || '';
        document.getElementById('editLabEnd').value = labEnd || '';
        document.getElementById('editTheoryStart').value = theoryStart || '';
        document.getElementById('editTheoryEnd').value = theoryEnd || '';
    };

    const createBatchField = (val = '', isRequired = false) => {
        dynamicBatchCount++;
        const div = document.createElement('div');
        div.className = 'input-group';
        div.style.marginBottom = '15px';
        div.style.position = 'relative';

        const label = document.createElement('label');
        label.textContent = `Batch ${dynamicBatchCount} ${isRequired ? '*' : ''}`.trim();
        
        const inputContainer = document.createElement('div');
        inputContainer.style.display = 'flex';
        inputContainer.style.gap = '8px';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'rn-input edit-batch-input';
        input.placeholder = `e.g. Batch ${dynamicBatchCount}`;
        input.value = val;
        input.style.flex = '1';

        input.addEventListener('input', syncBatchTimings);
        inputContainer.appendChild(input);

        // Add remove button for optional batches
        if (!isRequired) {
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            removeBtn.style.cssText = 'background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); width: 44px; border-radius: 12px; cursor: pointer; transition: all 0.2s;';
            removeBtn.onclick = () => {
                div.remove();
                syncBatchTimings();
                // We don't re-index dynamically, just keep the labels as they were generated, or we can just leave it
            };
            inputContainer.appendChild(removeBtn);
        }

        div.appendChild(label);
        div.appendChild(inputContainer);
        dynamicBatchContainer.appendChild(div);
    };

    if (addBatchBtn) {
        addBatchBtn.addEventListener('click', () => {
            createBatchField();
        });
    }

    const editLabStart = document.getElementById('editLabStart');
    const editLabEnd = document.getElementById('editLabEnd');
    const editTheoryStart = document.getElementById('editTheoryStart');
    const editTheoryEnd = document.getElementById('editTheoryEnd');

    const editPhotoPreview = document.getElementById('editPhotoPreview');
    const editPhotoInput = document.getElementById('editPhotoInput');
    const deletePhotoBtn = document.getElementById('deletePhotoBtn');

    let currentEditStudentId = null;
    let currentEditPhotoBase64 = null;
    let isPhotoDeleted = false;

    window.openEditModal = (student) => {
        console.log("Loaded Student:", student);
        currentEditStudentId = student.id;
        currentEditPhotoBase64 = null;
        isPhotoDeleted = false;

        // Step 2 & 6: Populate basic details from student.name (Stop auto-clearing)
        editStudentName.value = student.name || "";
        editPhone.value = student.phone || student.phoneNumber || "";
        editEmail.value = student.email || "";
        console.log("Student Name State:", editStudentName.value);
        console.log("Edit Modal Rendered");

        // Populate multiple courses dynamically
        dynamicCourseContainer.innerHTML = '';
        dynamicCourseCount = 0;
        
        let existingCourses = [];
        if (Array.isArray(student.courses)) {
            existingCourses = student.courses;
        } else {
            if (student.course1 || student.course) existingCourses.push(student.course1 || student.course);
            if (student.course2) existingCourses.push(student.course2);
            if (student.course3) existingCourses.push(student.course3);
        }
        
        existingCourses = [...new Set(existingCourses.filter(Boolean))];
        if (existingCourses.length > 0) {
            existingCourses.forEach((c, index) => createCourseField(c, index === 0));
        } else {
            createCourseField('', true);
        }

        // --- DYNAMIC SUBJECTS REMOVED ---
        
        // Populate multiple batches dynamically
        dynamicBatchContainer.innerHTML = '';
        dynamicBatchCount = 0;
        
        let existingBatches = [];
        if (Array.isArray(student.batches)) {
            existingBatches = student.batches;
        } else {
            if (student.batch1 || student.batch || student.batchName) existingBatches.push(student.batch1 || student.batch || student.batchName);
            if (student.batch2) existingBatches.push(student.batch2);
            if (student.batch3) existingBatches.push(student.batch3);
        }
        
        existingBatches = [...new Set(existingBatches.filter(Boolean))];
        
        if (existingBatches.length > 0) {
            existingBatches.forEach((b, index) => createBatchField(b, index === 0));
        } else {
            createBatchField('', true); // Always at least one batch field required
        }

        syncBatchTimings();


        // Handle Photo
        const photoUrl = student.profileImage || student.photoUrl || '';
        const isLegacyAvatar = photoUrl.includes('pravatar.cc');
        
        if (photoUrl && !isLegacyAvatar) {
            editPhotoPreview.innerHTML = `<img src="${photoUrl}" alt="Photo">`;
        } else {
            editPhotoPreview.innerHTML = `<i class="fa-solid fa-user"></i>`;
        }

        editModal.classList.add('active');
    };

    const closeEditModal = () => {
        console.log("Closing Edit Modal - Form values preserved until next open");
        editModal.classList.remove('active');
        currentEditStudentId = null;
    };

    closeEditModalBtn.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal();
    });

    // Handle Photo Upload
    editPhotoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert('Image must be less than 2MB');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                currentEditPhotoBase64 = e.target.result;
                isPhotoDeleted = false;
                editPhotoPreview.innerHTML = `<img src="${currentEditPhotoBase64}" alt="Photo">`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Handle Photo Delete
    deletePhotoBtn.addEventListener('click', () => {
        currentEditPhotoBase64 = null;
        isPhotoDeleted = true;
        editPhotoPreview.innerHTML = `<i class="fa-solid fa-user"></i>`;
        editPhotoInput.value = ''; // Reset file input
    });

    // Async helper to get subjects from Course Master
    async function getSubjectsForCourses(courseNames) {
        // Future-proof architecture: In the future, this can fetch from Firestore.
        // For now, we use a fallback map for the core courses:
        const fallbackMap = {
            'DCA': ['Tally', 'Excel', 'C++'],
            'ADCA': ['Tally', 'Excel', 'C++', 'Photoshop'],
            'CCC': ['Basic Computer', 'Internet']
        };
        
        let generatedSubjects = [];
        courseNames.forEach(course => {
            const cNorm = course.toUpperCase().trim();
            if (fallbackMap[cNorm]) {
                generatedSubjects.push(...fallbackMap[cNorm]);
            }
        });
        return [...new Set(generatedSubjects)];
    }

    // Save Changes
    saveEditBtn.addEventListener('click', async () => {
        if (!currentEditStudentId) return;

        const name = editStudentName.value.trim();
        
        const batchInputsDOM = document.querySelectorAll('.edit-batch-input');
        const batchInputs = Array.from(batchInputsDOM).map(inp => inp.value.trim()).filter(Boolean);
        const b1 = batchInputs.length > 0 ? batchInputs[0] : '';
        
        if (!name) {
            showToast('Student name is required.', 'error');
            return;
        }
        if (!b1) {
            showToast('At least one Batch is required.', 'error');
            return;
        }

        saveEditBtn.disabled = true;
        saveEditBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const courseInputsDOM = document.querySelectorAll('.edit-course-input');
            const courseInputs = Array.from(courseInputsDOM).map(inp => inp.value.trim()).filter(Boolean);
            const courses = [...new Set(courseInputs)];
            const c1 = courses.length > 0 ? courses[0] : '';
            const c2 = courses.length > 1 ? courses[1] : '';
            const c3 = courses.length > 2 ? courses[2] : '';

            // Auto-generate subjects from courses
            const generatedSubjects = await getSubjectsForCourses(courses);
            
            // Legacy migration: preserve existing manually saved subjects
            const existingStudent = studentsData[currentEditStudentId] || {};
            const existingSubjects = Array.isArray(existingStudent.subjects) ? existingStudent.subjects : [existingStudent.subject1 || existingStudent.subjectName || existingStudent.subject].filter(Boolean);
            const existingSubjectHistory = Array.isArray(existingStudent.subjectHistory) ? existingStudent.subjectHistory : [];
            
            // Merge generated subjects with existing subjects to not break legacy students
            const subjects = [...new Set([...generatedSubjects, ...existingSubjects])];
            const s1 = subjects.length > 0 ? subjects[0] : '';
            const s2 = subjects.length > 1 ? subjects[1] : '';
            const s3 = subjects.length > 2 ? subjects[2] : '';
            
            const b2 = batchInputs.length > 1 ? batchInputs[1] : '';
            const b3 = batchInputs.length > 2 ? batchInputs[2] : '';
            
            // Step 1 & 2: Save ALL batches properly as a clean array
            // Use Set to prevent duplicates as requested in Step 9
            const batches = [...new Set(batchInputs)];

            const updateData = {
                name: name,
                course1: c1,
                course2: c2,
                course3: c3,
                subject1: s1,
                subject2: s2,
                subject3: s3,
                batch1: b1,
                batch2: b2,
                batch3: b3,
                course: c1, // Backward compatibility
                subject: s1, // Backward compatibility
                subjectName: s1, // Backward compatibility
                batch: b1, // Backward compatibility
                batchName: b1, // Backward compatibility
                courses: courses,
                subjects: subjects,
                batches: batches,
                labStartTime: editLabStart.value,
                labEndTime: editLabEnd.value,
                theoryStartTime: editTheoryStart.value,
                theoryEndTime: editTheoryEnd.value,
                phone: editPhone.value.trim(),
                phoneNumber: editPhone.value.trim(),
                email: editEmail.value.trim(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Step 7: Required Debugging Logs
            console.log("Saved Batches:", batches);
            console.log("Firestore Batch Sync Success");

            // Maintain permanent subject history
            const newHistory = [...new Set([...existingSubjectHistory, ...subjects])];
            updateData.subjectHistory = newHistory;

            // Handle image updates
            if (currentEditPhotoBase64) {
                updateData.profileImage = currentEditPhotoBase64;
                updateData.photoUrl = currentEditPhotoBase64;
            } else if (isPhotoDeleted) {
                updateData.profileImage = firebase.firestore.FieldValue.delete();
                updateData.photoUrl = firebase.firestore.FieldValue.delete();
            }

            await db.collection('users').doc(currentEditStudentId).update(updateData);
            
            console.log(`[Edit] Successfully updated student ${currentEditStudentId}`);

            // --- INSTANT CACHE UPDATE ---
            const updatedObj = { 
                id: currentEditStudentId, 
                ...studentsData[currentEditStudentId], 
                ...updateData 
            };
            
            // Strip out FieldValue objects which IndexedDB cannot clone
            delete updatedObj.updatedAt;
            if (updateData.profileImage && typeof updateData.profileImage !== 'string') {
                delete updatedObj.profileImage;
            }
            if (updateData.photoUrl && typeof updateData.photoUrl !== 'string') {
                delete updatedObj.photoUrl;
            }
            // Fix FieldValue.arrayUnion causing TypeError
            updatedObj.subjectHistory = [...(studentsData[currentEditStudentId].subjectHistory || [])];
            if (s1 && !updatedObj.subjectHistory.includes(s1)) {
                updatedObj.subjectHistory.push(s1);
            }
            
            await window.LocalCache.setItem('students', updatedObj);
            studentsData[currentEditStudentId] = updatedObj;
            processAndRender();

            showToast(`Successfully updated details for ${name}`, 'success');
            closeEditModal();
        } catch (error) {
            console.error("Error updating student:", error);
            showToast("Failed to update student details. Please try again.", 'error');
        } finally {
            saveEditBtn.disabled = false;
            saveEditBtn.innerHTML = 'Save Changes';
        }
    });

    // ── Student Deletion Logic ────────────────────────────────
    const deleteStudentBtn = document.getElementById('deleteStudentBtn');
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const closeDeleteModalBtn = document.getElementById('closeDeleteModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const deleteStudentNameDisplay = document.getElementById('deleteStudentNameDisplay');

    const openDeleteModal = () => {
        const studentName = editStudentName.value.trim();
        deleteStudentNameDisplay.textContent = studentName || 'this student';
        deleteConfirmModal.classList.add('active');
    };

    const closeDeleteModal = () => {
        deleteConfirmModal.classList.remove('active');
    };

    deleteStudentBtn.addEventListener('click', openDeleteModal);
    closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    deleteConfirmModal.addEventListener('click', (e) => {
        if (e.target === deleteConfirmModal) closeDeleteModal();
    });

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!currentEditStudentId) return;

        confirmDeleteBtn.disabled = true;
        const originalContent = confirmDeleteBtn.innerHTML;
        confirmDeleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';

        try {
            console.log(`[Delete] Starting permanent deletion for student: ${currentEditStudentId}`);
            
            // 1. Delete all Attendance Records for this student
            // We search by studentID which is the standard field in attendanceRecords
            const attSnap = await db.collection('attendanceRecords')
                .where('studentID', '==', currentEditStudentId)
                .get();
            
            console.log(`[Delete] Found ${attSnap.size} attendance records for this student.`);
            
            if (!attSnap.empty) {
                // Use batches to avoid quota issues and ensure atomicity (up to 500 docs per batch)
                let batch = db.batch();
                let count = 0;
                
                for (const doc of attSnap.docs) {
                    batch.delete(doc.ref);
                    count++;
                    
                    // Firestore batches have a limit of 500 operations
                    if (count === 500) {
                        await batch.commit();
                        batch = db.batch();
                        count = 0;
                    }
                }
                
                if (count > 0) {
                    await batch.commit();
                }
                console.log(`[Delete] Successfully deleted all ${attSnap.size} attendance records.`);
            }

            // 2. Delete the primary Student Document
            await db.collection('users').doc(currentEditStudentId).delete();
            console.log(`[Delete] Successfully deleted student user document: ${currentEditStudentId}`);

            // --- INSTANT CACHE DELETION ---
            await window.LocalCache.deleteItem('students', currentEditStudentId);
            await window.LocalCache.deleteByIndex('attendanceRecords', 'studentID', currentEditStudentId);

            // 3. Clean up local data structures to ensure instant UI update
            if (studentsData[currentEditStudentId]) delete studentsData[currentEditStudentId];
            if (attendanceData[currentEditStudentId]) delete attendanceData[currentEditStudentId];
            
            // Re-render the list immediately
            processAndRender();
            
            showToast("Student and all related data permanently deleted.", "success");
            
            // 4. Close all modals
            closeDeleteModal();
            closeEditModal();

        } catch (error) {
            console.error("[Delete] CRITICAL ERROR during deletion:", error);
            showToast("Deletion failed. Please check your permissions or connection.", "error");
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.innerHTML = originalContent;
        }
    });

    // ── Local-First Lifecycle Guard ────────────────────────────
    document.addEventListener('APP_READY', async (e) => {
        const { role, isCached } = e.detail;
        if (role !== 'teacher') return;
        
        // Fetch and render immediately
        await loadStudents();

        // If this is the cached render, don't double-bind listeners
        if (isCached) return;

        // Bind background sync listeners to auto-update
        window.FirebaseSync.on('STUDENTS_UPDATED', loadStudents);
        window.FirebaseSync.on('ATTENDANCE_UPDATED', loadStudents);
    });
});
