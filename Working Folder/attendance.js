document.addEventListener('DOMContentLoaded', () => {
    // Route Guard: Ensure only teachers or assistants can access
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'teacher' && userRole !== 'assistant') {
        alert("Access Denied: Privileges required.");
        window.location.href = 'index.html';
        return;
    }

    // Toggle Nav depending on role
    if (userRole === 'assistant') {
        const teacherNav = document.getElementById('teacherNav');
        const assistantNav = document.getElementById('assistantNav');
        if (teacherNav) teacherNav.style.display = 'none';
        if (assistantNav) assistantNav.style.display = 'flex';
        
        // Connect Assistant Logout
        const assistantLogoutNavBtn = document.getElementById('assistantLogoutNavBtn');
        if (assistantLogoutNavBtn) {
            assistantLogoutNavBtn.addEventListener('click', (e) => {
                e.preventDefault();
                firebase.auth().signOut().then(() => {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = 'index.html';
                });
            });
        }
    } else {
        const teacherNav = document.getElementById('teacherNav');
        const assistantNav = document.getElementById('assistantNav');
        if (teacherNav) teacherNav.style.display = 'flex';
        if (assistantNav) assistantNav.style.display = 'none';
        
        // Show teacher-only elements
        document.querySelectorAll('.teacher-only').forEach(el => el.style.display = '');
    }

    let activeSummaryFilter = null; // State for summary pill filtering (present, late, absent)

    // 1. Live Local Date and Time Update
    let lastCheckedDate = new Date().toDateString();
    const updateDateTime = () => {
        const datetimeElement = document.getElementById('currentDateTime');
        if (!datetimeElement) return;

        const now = new Date();
        
        // Auto-refresh if date changes (Next-day auto unlock)
        if (now.toDateString() !== lastCheckedDate) {
            lastCheckedDate = now.toDateString();
            location.reload();
            return;
        }
        const dateOptions = { month: 'long', day: 'numeric', year: 'numeric' };
        const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
        
        const datePart = now.toLocaleDateString('en-US', dateOptions);
        const timePart = now.toLocaleTimeString('en-US', timeOptions);
        
        datetimeElement.innerHTML = `${datePart} &bull; ${timePart}`;
    };

    // Initial call and set interval for real-time updates
    updateDateTime();
    setInterval(updateDateTime, 1000);

    let currentAuthUser = null;
    let authInitialized = false;

    // Track auth state to prevent "Session expired" issues
    firebase.auth().onAuthStateChanged((user) => {
        authInitialized = true;
        if (user) {
            currentAuthUser = user;
            localStorage.setItem('userEmail', user.email);

            // Native Push Notification Initialization (Delayed & Safe)
            if (window.initializePushNotifications) {
                console.log('[DEBUG] Triggering delayed push init for Teacher...');
                setTimeout(() => {
                    window.initializePushNotifications().catch(err => {
                        console.error('[DEBUG] Push init failed:', err);
                    });
                }, 3000);
            }
        }
    });

    const studentList = document.getElementById('studentList');
    const loadingState = document.getElementById('loadingState');

    let allStudents = [];

    let studentCache = {}; // Cache for student data including FCM tokens

    // 2. Fetch Students from LocalCache
    const fetchStudents = async () => {
        console.log("[LocalCache] fetchStudents triggered");
        try {
            let allStudentsData = await window.LocalCache.getAll('students');

            // Apply Assistant Role Filters
            if (userRole === 'assistant') {
                const currentUser = window.LocalCache.getSync('currentUser');
                const assignedClasses = currentUser && currentUser.assignedClasses ? currentUser.assignedClasses : [];
                
                const allClasses = await window.LocalCache.getAll('classes');
                const assignedClassDocs = allClasses.filter(c => assignedClasses.includes(c.batchName));
                const allowedBatches = assignedClassDocs.map(c => c.batchName).filter(Boolean).map(b => b.trim());
                
                allStudentsData = allStudentsData.filter(studentData => {
                    let studentBatches = [];
                    if (Array.isArray(studentData.batches)) studentBatches = studentData.batches;
                    else if (studentData.batchName || studentData.batch) studentBatches = [(studentData.batchName || studentData.batch).trim()];
                    if (studentData.batch1) studentBatches.push(studentData.batch1.trim());
                    if (studentData.batch2) studentBatches.push(studentData.batch2.trim());
                    if (studentData.batch3) studentBatches.push(studentData.batch3.trim());
                    
                    return studentBatches.some(b => allowedBatches.includes(b));
                });
            }

            console.log(`[LocalCache] Fetched ${allStudentsData.length} students`);
            loadingState.style.display = 'none';
            allStudents = [];
            studentCache = {}; // Reset cache

            allStudentsData.forEach((data) => {
                
                // --- STEP 3: SAFE COURSE NORMALIZATION ---
                let normalizedCourses = [];
                if (Array.isArray(data.courses)) {
                    normalizedCourses = data.courses;
                } else if (data.course) {
                    normalizedCourses = [data.course];
                }

                // --- STEP 5: PRIORITY DISPLAY RULE ---
                const resolvedCourse = normalizedCourses.length > 0 ? normalizedCourses[0] : (data.course || 'Unassigned');

                const studentData = {
                    ...data,
                    userID: data.id || data.userID,
                    name: data.name || data.displayName || (data.email ? data.email.split('@')[0] : 'Unknown'),
                    courses: normalizedCourses,
                    course: resolvedCourse, // Primary/Fallback course
                    subject: data.subject || '—',
                    photoUrl: data.profileImage || data.photoUrl
                };

                allStudents.push(studentData);
                studentCache[data.id || data.userID] = studentData;
            });

            if (allStudents.length === 0) {
                studentList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">No students found. Please wait for sync or register students first.</div>';
                return;
            }

            const getTodayDate = () => {
                const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            };
            const currentDate = getTodayDate();

            console.log(`[LocalCache] Fetching today's records for date: ${currentDate}`);
            const allAttendance = await window.LocalCache.getAll('attendanceRecords');
            
            const lockedMap = {};
            allAttendance.forEach(data => {
                // Student is ONLY locked if the record date matches the current local date
                if (data.date === currentDate) {
                    lockedMap[data.studentID] = data.attendanceStatus;
                }
            });

            populateCourseDropdown(allStudents);
            renderStudents(allStudents, lockedMap);
            loadDraftAttendance(); // Restore draft after rendering
            updateSummary(); // Final summary check
        } catch (error) {
            console.error("[LocalCache] Error loading students:", error);
            loadingState.innerHTML = `
                <div style="color: #ef4444; padding: 20px; text-align: center;">
                    <i class="fa-solid fa-circle-exclamation"></i><br>
                    <strong>Error loading students from cache</strong><br>
                    <span style="font-size: 12px; opacity: 0.8;">${error.message}</span>
                </div>`;
        }
    };

    function populateCourseDropdown(students) {
        // ... (unchanged)
        const courseFilter = document.getElementById('courseFilter');
        if (!courseFilter) return;

        // Use a Set to collect unique courses, starting with mandatory defaults in UPPERCASE
        const courseSet = new Set(['ADCA', 'DCA', 'ENGLISH', 'COMPETITION CLASS']);
        
        students.forEach(s => {
            const courses = [];
            if (Array.isArray(s.courses)) {
                courses.push(...s.courses);
            }
            if (s.course1) courses.push(s.course1);
            if (s.course2) courses.push(s.course2);
            if (s.course3) courses.push(s.course3);
            if (s.course) courses.push(s.course);
            
            courses.filter(Boolean).forEach(c => {
                const upperC = c.toUpperCase();
                if (upperC && upperC !== 'ATTENDANCE RECORD' && upperC !== 'ADVANCED PHYSICS 301') {
                    courseSet.add(upperC);
                }
            });
        });

        const courses = [...courseSet].sort();
        
        // Clear existing options except "All Classes"
        courseFilter.innerHTML = '<option value="all">All Classes</option>';
        
        courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course;
            option.textContent = course.toUpperCase();
            courseFilter.appendChild(option);
        });
    }

    // Connect to Local-First Lifecycle
    document.addEventListener('APP_READY', async (e) => {
        const { role, isCached } = e.detail;
        if (role !== 'teacher' && role !== 'assistant') return;
        
        // Fetch and render immediately
        await fetchStudents();

        // Listen for Global Holiday State to disable UI
        document.addEventListener('GLOBAL_HOLIDAY_UPDATED', handleGlobalHolidayState);
        handleGlobalHolidayState(); // Initial check

        // If this is the cached render, don't double-bind listeners
        if (isCached) return;

        // Bind background sync listeners to auto-update attendance locks or student list
        window.FirebaseSync.on('STUDENTS_UPDATED', fetchStudents);
        window.FirebaseSync.on('ATTENDANCE_UPDATED', fetchStudents);
    });

    function renderStudents(students, lockedMap = {}) {
        // Clear existing cards (except spacer)
        const existingCards = studentList.querySelectorAll('.student-card');
        existingCards.forEach(c => c.remove());

        students.forEach((student) => {
            const displayName = student.name.toUpperCase();
            
            // Multi-course display
            const c1 = student.course1 || student.course || '';
            const c2 = student.course2 || '';
            const c3 = student.course3 || '';
            const courseArr = [c1, c2, c3].filter(Boolean).map(c => c.toUpperCase());
            const displayCourse = courseArr.length > 0 ? courseArr.join(' • ') : '—';
            
            // Multi-subject display
            const s1 = student.subject1 || student.subject || '';
            const s2 = student.subject2 || '';
            const s3 = student.subject3 || '';
            const subjectArr = [s1, s2, s3].filter(Boolean).map(s => s.toUpperCase());
            const displaySubject = subjectArr.length > 0 ? subjectArr.join(' • ') : '—';

            // --- DEBUGGING LOGS ---
            console.log("Attendance Card Course:", displayCourse);
            console.log("Subject Hidden From Attendance UI");
            console.log("Batch Hidden From Attendance UI");

            const resolvedCourse = student.course || 'Unassigned';

            const card = document.createElement('div');
            card.className = 'student-card';
            card.setAttribute('data-status', 'unmarked');
            card.setAttribute('data-uid', student.userID);
            card.setAttribute('data-course', resolvedCourse); // CRITICAL: Fix for submission logic
            
            // Data attributes for filtering
            card.setAttribute('data-course1', c1.toUpperCase());
            card.setAttribute('data-course2', c2.toUpperCase());
            card.setAttribute('data-course3', c3.toUpperCase());
            card.setAttribute('data-subject1', s1.toUpperCase());
            card.setAttribute('data-subject2', s2.toUpperCase());
            card.setAttribute('data-subject3', s3.toUpperCase());
            card.setAttribute('data-batch1', student.batch1 || student.batch || student.batchName || '');
            card.setAttribute('data-batch2', student.batch2 || '');
            card.setAttribute('data-batch3', student.batch3 || '');
            
            const isLegacyAvatar = student.photoUrl && student.photoUrl.includes('pravatar.cc');
            const avatarHtml = (student.photoUrl && !isLegacyAvatar)
                ? `<div class="student-avatar-container">
                    <img src="${student.photoUrl}" alt="Student" class="student-avatar">
                   </div>`
                : `<div class="student-avatar-placeholder"><i class="fa-solid fa-user"></i></div>`;

            card.innerHTML = `
                <div class="student-info">
                    ${avatarHtml}
                    <div class="details">
                        <h3 class="name">${displayName}</h3>
                        <p class="student-id">
                            ${displayCourse}
                        </p>
                    </div>
                </div>
                <div class="attendance-actions">
                    <button class="status-btn present" data-type="present">
                        <i class="fa-solid fa-check"></i> Present
                    </button>
                    <button class="status-btn late" data-type="late">
                        <i class="fa-regular fa-clock"></i> Late
                    </button>
                    <button class="status-btn absent" data-type="absent">
                        <i class="fa-solid fa-xmark"></i> Absent
                    </button>
                </div>
                <div class="locked-message">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-lock"></i> Attendance submitted
                    </div>
                    <button class="individual-reset-btn" title="Unlock for this student">
                        <i class="fa-solid fa-rotate-left"></i> Unlock
                    </button>
                </div>
            `;

            // Apply locked state if student already has record for today
            if (lockedMap[student.userID]) {
                const status = lockedMap[student.userID];
                card.classList.add('locked');
                card.setAttribute('data-status', 'marked');
                const btn = card.querySelector(`.status-btn[data-type="${status}"]`);
                if (btn) btn.classList.add('active');
            }
            
            studentList.insertBefore(card, studentList.querySelector('.bottom-spacer'));
            attachMarkingLogic(card);
            attachIndividualResetLogic(card, student.userID);
            attachIndividualResetLogic(card, student.userID);
        });
        updateSummary(); // Initial count after rendering
    }

    // New Function: Dynamically calculate and update today's attendance summary
    function updateSummary() {
        const cards = document.querySelectorAll('.student-card');
        let present = 0;
        let late = 0;
        let absent = 0;

        cards.forEach(card => {
            const activeBtn = card.querySelector('.status-btn.active');
            if (activeBtn) {
                const type = activeBtn.getAttribute('data-type');
                if (type === 'present') present++;
                else if (type === 'late') late++;
                else if (type === 'absent') absent++;
            }
        });

        const countPresent = document.getElementById('countPresent');
        const countLate = document.getElementById('countLate');
        const countAbsent = document.getElementById('countAbsent');

        if (countPresent) countPresent.textContent = present;
        if (countLate) countLate.textContent = late;
        if (countAbsent) countAbsent.textContent = absent;

        // Re-attach or ensure click listeners are present for interactive filtering
        setupSummaryClickHandlers();
    }

    let summaryHandlersAttached = false;
    function setupSummaryClickHandlers() {
        if (summaryHandlersAttached) return;
        
        const pills = document.querySelectorAll('.stat-pill');
        if (pills.length === 0) return;

        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                const type = pill.classList.contains('present') ? 'present' : 
                             pill.classList.contains('late') ? 'late' : 'absent';
                
                if (activeSummaryFilter === type) {
                    activeSummaryFilter = null;
                    pill.classList.remove('active');
                } else {
                    activeSummaryFilter = type;
                    pills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                }
                applyFilters();
            });
        });
        summaryHandlersAttached = true;
    }

    function attachIndividualResetLogic(card, studentID) {
        const resetBtn = card.querySelector('.individual-reset-btn');
        if (!resetBtn) return;

        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (userRole === 'assistant') {
                if (window.showToast) window.showToast("Assistants cannot unlock submitted attendance.", "error");
                else alert("Assistants cannot unlock submitted attendance.");
                return;
            }
            const studentName = card.querySelector('.name').textContent.trim();
            
            // Use the themed modal instead of confirm()
            openResetModal('individual', {
                id: studentID,
                name: studentName,
                card: card
            });
        });
    }

    function attachMarkingLogic(card) {
        const group = card.querySelector('.attendance-actions');
        const buttons = group.querySelectorAll('.status-btn');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Prevent interaction if locked, disabled, or global holiday is active
                if (window.GlobalHolidayState && window.GlobalHolidayState.isActive) {
                    window.showToast("Attendance marking is disabled during a global holiday/closure.", "error");
                    return;
                }
                if (group.classList.contains('disabled') || card.classList.contains('locked')) return;
                
                const isAlreadyActive = btn.classList.contains('active');
                
                // Reset all buttons in this card first
                buttons.forEach(b => b.classList.remove('active'));
                
                if (isAlreadyActive) {
                    // If clicking the same button, toggle it off
                    card.setAttribute('data-status', 'unmarked');
                } else {
                    // If clicking a different button, activate it
                    btn.classList.add('active');
                    card.setAttribute('data-status', 'marked');
                }

                saveDraftAttendance(); // Auto-save state to localStorage
                updateSummary(); // Update statistics summary
                applyFilters(); // Re-apply filters (important for "Unmarked" tab)
            });
        });
    }

    function applyFilters() {
        const activeTabFilter = document.querySelector('.tab.active').getAttribute('data-filter');
        const activeCourseFilter = document.getElementById('courseFilter').value;
        const searchVal = (document.getElementById('studentSearch')?.value || '').toLowerCase().trim();
        const cards = document.querySelectorAll('.student-card');

        cards.forEach(card => {
            const status = card.getAttribute('data-status');
            const studentName = (card.querySelector('.name')?.innerText || '').toLowerCase();
            
            // Multi-course check
            const c1 = (card.getAttribute('data-course1') || '').toUpperCase();
            const c2 = (card.getAttribute('data-course2') || '').toUpperCase();
            const c3 = (card.getAttribute('data-course3') || '').toUpperCase();
            
            // Multi-subject check
            const s1 = (card.getAttribute('data-subject1') || '').toUpperCase();
            const s2 = (card.getAttribute('data-subject2') || '').toUpperCase();
            const s3 = (card.getAttribute('data-subject3') || '').toUpperCase();
            
            // Multi-batch check
            const b1 = (card.getAttribute('data-batch1') || '').toLowerCase();
            const b2 = (card.getAttribute('data-batch2') || '').toLowerCase();
            const b3 = (card.getAttribute('data-batch3') || '').toLowerCase();

            // Get actual current marking for summary filter comparison
            const activeBtn = card.querySelector('.status-btn.active');
            const currentMarking = activeBtn ? activeBtn.getAttribute('data-type') : 'unmarked';
            
            const matchesTab = (activeTabFilter === 'all') || (activeTabFilter === 'unmarked' && status === 'unmarked');
            
            const targetCourse = activeCourseFilter.toUpperCase();
            const matchesCourse = (activeCourseFilter === 'all') || 
                                 (c1 === targetCourse || c2 === targetCourse || c3 === targetCourse);
            
            const matchesSearch = !searchVal || 
                                 studentName.includes(searchVal) || 
                                 c1.toLowerCase().includes(searchVal) || c2.toLowerCase().includes(searchVal) || c3.toLowerCase().includes(searchVal) ||
                                 s1.toLowerCase().includes(searchVal) || s2.toLowerCase().includes(searchVal) || s3.toLowerCase().includes(searchVal) ||
                                 b1.includes(searchVal) || b2.includes(searchVal) || b3.includes(searchVal);
            
            if (matchesSearch && searchVal) {
                // Debugging logs if needed
            }
            const matchesSummary = !activeSummaryFilter || (currentMarking === activeSummaryFilter);

            if (matchesTab && matchesCourse && matchesSearch && matchesSummary) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    }



    // 4. Tab Filtering
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            applyFilters();
        });
    });

    // 5. Course Filtering
    const courseFilter = document.getElementById('courseFilter');
    if (courseFilter) {
        courseFilter.addEventListener('change', applyFilters);
    }

    const studentSearch = document.getElementById('studentSearch');
    if (studentSearch) {
        studentSearch.addEventListener('input', applyFilters);
    }
    // 5. Submit Button
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.addEventListener('click', () => {
        const allCards = Array.from(document.querySelectorAll('.student-card'));
        
        // Filter for students that are marked but NOT yet locked
        const cardsToSubmit = allCards.filter(c => 
            c.getAttribute('data-status') === 'marked' && 
            !c.classList.contains('locked')
        );
        
        if (cardsToSubmit.length === 0) {
            window.showToast("No students to submit. Please mark at least one present/late/absent.", "error");
            return;
        }

        if (window.GlobalHolidayState && window.GlobalHolidayState.isActive) {
            window.showToast("Cannot submit attendance during a global holiday/closure.", "error");
            return;
        }

        const originalContent = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
        submitBtn.style.pointerEvents = 'none';
        
        // Collect attendance data for marked students
        const getTodayDate = () => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const currentDate = getTodayDate();
        
        const sessionData = [];
        
        cardsToSubmit.forEach(card => {
            const studentName = card.querySelector('.name').innerText.trim();
            const studentID = card.getAttribute('data-uid');
            
            let attendanceStatus = 'unmarked';
            const activeBtn = card.querySelector('.status-btn.active');
            if (activeBtn) {
                attendanceStatus = activeBtn.getAttribute('data-type');
            }

            const studentCourse = card.getAttribute('data-course') || 'Unassigned';

            // Fetch student data from cache to get the correct subject (Fixing undefined reference)
            const sData = studentCache[studentID] || {};

            const record = {
                studentName: studentName,
                studentID: studentID,
                attendanceStatus: attendanceStatus,
                date: currentDate,
                className: studentCourse.toUpperCase(),
                subjectName: sData.subject || sData.subjectName || "No Subject",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // --- STEP 9: DEBUGGING ---
            console.log("Attendance Record:", record);
            
            sessionData.push(record);
        });

        // Save to Firestore
        const promises = sessionData.map(async (record) => {
            const docId = `${record.studentID}_${record.date}`;
            
            // Send Notification BEFORE saving or in parallel
            sendAttendanceNotification(record.studentID, record.attendanceStatus, record.className);
            
            return db.collection('attendanceRecords').doc(docId).set(record);
        });

        Promise.all(promises).then(() => {
            clearDraftAttendance(); // Clear draft after successful submission
            
            // Instantly lock students that were just submitted
            cardsToSubmit.forEach(card => {
                card.classList.add('locked');
            });

            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Attendance Submitted';
            submitBtn.style.backgroundColor = '#10b981'; // Green
            
            setTimeout(() => {
                submitBtn.innerHTML = originalContent;
                submitBtn.style.backgroundColor = ''; // Reset background color
                submitBtn.style.pointerEvents = 'auto';
            }, 2000);
        }).catch(error => {
            alert("Error saving to Firestore: " + error.message);
            submitBtn.innerHTML = originalContent;
            submitBtn.style.pointerEvents = 'auto';
        });
    });


    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    // --- Logout and Other Controls ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            firebase.auth().signOut().then(() => {
                localStorage.removeItem('userRole');
                localStorage.removeItem('userEmail');
                localStorage.removeItem('currentUserID');
                window.location.href = 'index.html';
            });
        });
    }

    // Reset Today's Attendance functionality
    // Reset Today's Attendance functionality with Custom Modal
    const resetModal = document.getElementById('resetModal');
    const resetPasswordInput = document.getElementById('resetPasswordInput');
    const confirmResetBtn = document.getElementById('confirmResetBtn');
    const cancelResetBtn = document.getElementById('cancelResetBtn');
    const modalError = document.getElementById('modalError');

    // Modal state for dynamic behavior
    let resetTarget = 'all'; // 'all' or 'individual'
    let studentToReset = null;

    const openResetModal = (target = 'all', studentData = null) => {
        resetTarget = target;
        studentToReset = studentData;
        
        resetModal.classList.add('active');
        resetPasswordInput.value = '';
        resetPasswordInput.focus();
        modalError.style.display = 'none';
        confirmResetBtn.innerHTML = 'Confirm Reset';
        confirmResetBtn.style.pointerEvents = 'auto';
        confirmResetBtn.style.backgroundColor = ''; // Reset to primary color

        const modalDesc = resetModal.querySelector('.modal-header p');
        if (target === 'all') {
            modalDesc.textContent = "Please enter your teacher password to delete today's attendance records.";
        } else if (target === 'individual') {
            modalDesc.textContent = `Please enter your teacher password to reset today's attendance for ${studentData.name.toUpperCase()}.`;
        }
    };

    const closeResetModal = () => {
        resetModal.classList.remove('active');
    };

    const resetTodayBtn = document.getElementById('resetTodayBtn');
    if (resetTodayBtn) {
        resetTodayBtn.addEventListener('click', () => openResetModal('all'));
    }

    if (cancelResetBtn) {
        cancelResetBtn.addEventListener('click', closeResetModal);
    }

    // Toggle Password Visibility
    const toggleResetPassword = document.getElementById('toggleResetPassword');
    if (toggleResetPassword && resetPasswordInput) {
        toggleResetPassword.addEventListener('click', () => {
            const type = resetPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            resetPasswordInput.setAttribute('type', type);
            toggleResetPassword.classList.toggle('fa-eye');
            toggleResetPassword.classList.toggle('fa-eye-slash');
        });
    }

    // Close modal on outside click
    resetModal.addEventListener('click', (e) => {
        if (e.target === resetModal) closeResetModal();
    });

    if (confirmResetBtn) {
        confirmResetBtn.addEventListener('click', async () => {
            const password = resetPasswordInput.value;
            if (!password) {
                modalError.textContent = 'Password is required.';
                modalError.style.display = 'block';
                return;
            }

            const getTodayDate = () => {
                const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            };
            const currentDate = getTodayDate();

            try {
                confirmResetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
                confirmResetBtn.style.pointerEvents = 'none';
                modalError.style.display = 'none';

                // 1. Re-authenticate User
                let user = firebase.auth().currentUser || currentAuthUser;
                
                // If user is null, wait for auth initialization (prevents false session expiry on refresh)
                if (!user && !authInitialized) {
                    await new Promise(resolve => {
                        const unsub = firebase.auth().onAuthStateChanged((u) => {
                            user = u;
                            unsub();
                            resolve();
                        });
                        setTimeout(resolve, 2000); // Max wait 2s
                    });
                }

                if (!user) {
                    modalError.textContent = 'Session lost. Please refresh or login again.';
                    modalError.style.display = 'block';
                    confirmResetBtn.innerHTML = 'Confirm Reset';
                    confirmResetBtn.style.pointerEvents = 'auto';
                    return;
                }

                const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
                await user.reauthenticateWithCredential(credential);

                confirmResetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';

                if (resetTarget === 'all') {
                    // --- Logic for resetting ALL students ---
                    const snapshot = await db.collection('attendanceRecords')
                        .where('date', '==', currentDate)
                        .get();

                    if (snapshot.empty) {
                        modalError.textContent = "No records found for today.";
                        modalError.style.display = 'block';
                        confirmResetBtn.innerHTML = 'Confirm Reset';
                        confirmResetBtn.style.pointerEvents = 'auto';
                        return;
                    }

                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();
                    
                    clearDraftAttendance();
                    confirmResetBtn.innerHTML = '<i class="fa-solid fa-check"></i> Reset Successful';
                    confirmResetBtn.style.backgroundColor = '#10b981';

                    setTimeout(() => {
                        updateSummary(); // Update summary before reload
                        location.reload();
                    }, 1000);

                } else if (resetTarget === 'individual' && studentToReset) {
                    // --- Logic for resetting a SINGLE student ---
                    const docId = `${studentToReset.id}_${currentDate}`;
                    await db.collection('attendanceRecords').doc(docId).delete();

                    // Instantly update UI for the specific student
                    const card = studentToReset.card;
                    card.classList.remove('locked');
                    card.setAttribute('data-status', 'unmarked');
                    card.querySelectorAll('.status-btn').forEach(btn => btn.classList.remove('active'));

                    // Clear draft for this specific student
                    const draftKey = `attendanceDraft_${currentDate}`;
                    const savedDraft = localStorage.getItem(draftKey);
                    if (savedDraft) {
                        const draftData = JSON.parse(savedDraft);
                        delete draftData[studentToReset.id];
                        localStorage.setItem(draftKey, JSON.stringify(draftData));
                    }

                    confirmResetBtn.innerHTML = '<i class="fa-solid fa-check"></i> Unlock Successful';
                    confirmResetBtn.style.backgroundColor = '#10b981';

                    applyFilters();

                    setTimeout(() => {
                        closeResetModal();
                    }, 1000);

                }

            } catch (error) {
                console.error("Error resetting attendance:", error);
                let errorMessage = error.message;
                
                if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    errorMessage = "Incorrect password. Please try again.";
                }
                
                modalError.textContent = errorMessage;
                modalError.style.display = 'block';
                confirmResetBtn.innerHTML = 'Confirm Reset';
                confirmResetBtn.style.pointerEvents = 'auto';
            }
        });
    }

    // --- Draft Attendance Logic ---
    function getDraftKey() {
        const d = new Date();
        const dateFormatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return `attendanceDraft_${dateFormatted}`;
    }

    function saveDraftAttendance() {
        const draftData = {};
        const cards = document.querySelectorAll('.student-card');
        cards.forEach(card => {
            const studentID = card.getAttribute('data-uid');
            const activeBtn = card.querySelector('.status-btn.active');
            if (activeBtn) {
                draftData[studentID] = activeBtn.getAttribute('data-type');
            }
        });
        localStorage.setItem(getDraftKey(), JSON.stringify(draftData));
    }

    function loadDraftAttendance() {
        const savedDraft = localStorage.getItem(getDraftKey());
        if (!savedDraft) return;

        try {
            const draftData = JSON.parse(savedDraft);
            const cards = document.querySelectorAll('.student-card');
            cards.forEach(card => {
                // Do not overwrite locked attendance
                if (card.classList.contains('locked')) return;

                const studentID = card.getAttribute('data-uid');
                const status = draftData[studentID];
                if (status) {
                    const btn = card.querySelector(`.status-btn[data-type="${status}"]`);
                    if (btn) {
                        btn.classList.add('active');
                        card.setAttribute('data-status', 'marked');
                    }
                }
            });
            applyFilters(); // Re-apply filters in case "Unmarked" tab is active
        } catch (e) {
            console.error("Error parsing draft attendance:", e);
        }
    }

    function clearDraftAttendance() {
        localStorage.removeItem(getDraftKey());
    }

    // --- Optimized Auto-hide Control Area on Scroll ---
    const controlsSection = document.querySelector('.controls-section');
    let lastScrollTop = 0;
    let isHidden = false;
    let ticking = false;
    
    // Performance constants
    const scrollThreshold = 15; // Ignore tiny movements
    const hideThreshold = 80;   // Only hide after meaningful scroll

    if (studentList && controlsSection) {
        console.log(`[DEBUG] Scroll Container Init: Height=${studentList.offsetHeight}, ScrollHeight=${studentList.scrollHeight}`);
        
        studentList.addEventListener('scroll', () => {
            const scrollTop = studentList.scrollTop;
            // console.log(`[DEBUG] ScrollTop: ${scrollTop}`);
            
            if (scrollTop > 100) {
                if (!isHidden) {
                    controlsSection.classList.add('hidden');
                    isHidden = true;
                }
            } else {
                if (isHidden) {
                    controlsSection.classList.remove('hidden');
                    isHidden = false;
                }
            }
        }, { passive: true });
    }

    // --- Attendance Notification System (Requirement 3 & 4) ---
    async function sendAttendanceNotification(studentID, status, className) {
        try {
            // OPTIMIZATION: Use cached student data instead of a new Firestore read
            const studentData = studentCache[studentID];
            if (!studentData) {
                console.warn(`[Firestore] No cached data for student ${studentID}, skipping notification.`);
                return;
            }
            
            const fcmToken = studentData.fcmToken;
            if (!fcmToken) return;

            console.log(`[Notification] Sending to student ${studentID} via cached token`);

            const SERVER_KEY = "AAAAZ9pQ8-Y:APA91bF2v9_P-4Z8X3Z6G9W5f6U7H8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5";
            
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const payload = {
                to: fcmToken,
                notification: {
                    title: "RN-TECH: Attendance Marked",
                    body: `Class: ${className}\nStatus: ${status.toUpperCase()}\nDate: ${dateStr} at ${timeStr}`,
                    sound: "default",
                    click_action: "student_dashboard.html",
                    icon: "favicon.ico",
                    tag: `attendance_${studentID}`
                },
                data: {
                    url: "student_dashboard.html",
                    status: status,
                    className: className,
                    markedAt: `${dateStr} ${timeStr}`
                },
                priority: "high"
            };

            await fetch('https://fcm.googleapis.com/fcm/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `key=${SERVER_KEY}`
                },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error("FCM Send Error:", e);
        }
    }

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            firebase.auth().signOut().then(() => {
                localStorage.removeItem('userRole');
                localStorage.removeItem('userEmail');
                localStorage.removeItem('currentUserID');
                window.location.href = 'index.html';
            });
        });
    }
});
