document.addEventListener('DOMContentLoaded', () => {
    // Route Guard: Ensure only teachers can access
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'teacher') {
        alert("Access Denied: Teacher privileges required.");
        window.location.href = 'index.html';
        return;
    }

    // 1. Set current Date and Time
    const datetimeElement = document.getElementById('currentDateTime');
    const now = new Date();
    const options = { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' };
    
    // Format to match "October 24, 2026 • 10:00 AM"
    let dateString = now.toLocaleDateString('en-US', options);
    dateString = dateString.replace(' at ', ' &bull; ').replace(',', ',');
    datetimeElement.innerHTML = dateString;

    const studentList = document.getElementById('studentList');
    const loadingState = document.getElementById('loadingState');

    let allStudents = [];

    // 2. Fetch Students from Firestore (Requirement 2, 3, 5, 7)
    const fetchStudents = async () => {
        try {
            if (typeof db === 'undefined') {
                throw new Error("Firestore is not initialized.");
            }

            const querySnapshot = await db.collection('users')
                .where('role', '==', 'student')
                .get();

            loadingState.style.display = 'none';
            allStudents = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const studentData = {
                    ...data,
                    name: data.name || data.displayName || data.email.split('@')[0],
                    course: data.course || 'Unassigned'
                };
                allStudents.push(studentData);
            });

            if (allStudents.length === 0) {
                studentList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">No students found. Please register students first.</div>';
                return;
            }

            populateCourseDropdown(allStudents);
            renderStudents(allStudents);
        } catch (error) {
            console.error("FULL FIREBASE ERROR:", error);
            loadingState.innerHTML = `
                <div style="color: #ef4444; padding: 20px; text-align: center;">
                    <i class="fa-solid fa-circle-exclamation"></i><br>
                    <strong>Error loading students</strong><br>
                    <span style="font-size: 12px; opacity: 0.8;">${error.message}</span>
                </div>`;
        }
    };

    function populateCourseDropdown(students) {
        const courseFilter = document.getElementById('courseFilter');
        if (!courseFilter) return;

        // Use a Set to collect unique courses, starting with mandatory defaults
        const courseSet = new Set(['ADCA', 'DCA', 'English', 'Competition Class']);
        
        students.forEach(s => {
            const cName = s.course ? s.course.toUpperCase() : '';
            if (cName && cName !== 'ATTENDANCE RECORD' && cName !== 'ADVANCED PHYSICS 301') {
                courseSet.add(cName);
            }
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

    fetchStudents();

    function renderStudents(students) {
        // Clear existing cards (except spacer)
        const existingCards = studentList.querySelectorAll('.student-card');
        existingCards.forEach(c => c.remove());

        students.forEach((student) => {
            const displayName = student.name.toUpperCase();
            const displayCourse = student.course.toUpperCase();
            
            const card = document.createElement('div');
            card.className = 'student-card';
            card.setAttribute('data-status', 'unmarked');
            card.setAttribute('data-uid', student.userID);
            card.setAttribute('data-course', student.course); // Keep original for filtering
            
            const isLegacyAvatar = student.photoUrl && student.photoUrl.includes('pravatar.cc');
            const avatarHtml = (student.photoUrl && !isLegacyAvatar)
                ? `<img src="${student.photoUrl}" alt="Student" class="avatar">`
                : `<div class="avatar-placeholder" style="width: 45px; height: 45px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.05); flex-shrink: 0;"><i class="fa-solid fa-user" style="color: #94a3b8; font-size: 18px;"></i></div>`;

            card.innerHTML = `
                <div class="student-info">
                    ${avatarHtml}
                    <div class="details">
                        <h3 class="name">${displayName}</h3>
                        <p class="student-id" style="font-size: 12px; color: var(--text-muted); opacity: 0.8; font-weight: 500;">${displayCourse}</p>
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
            `;
            
            studentList.insertBefore(card, studentList.querySelector('.bottom-spacer'));
            attachMarkingLogic(card);
        });
    }

    function attachMarkingLogic(card) {
        const group = card.querySelector('.attendance-actions');
        const buttons = group.querySelectorAll('.status-btn');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (group.classList.contains('disabled')) return;
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                card.setAttribute('data-status', 'marked');

                // Auto-hide if in "unmarked" tab
                applyFilters();
            });
        });
    }

    // Combined Filtering Logic
    function applyFilters() {
        const activeTabFilter = document.querySelector('.tab.active').getAttribute('data-filter');
        const activeCourseFilter = document.getElementById('courseFilter').value;
        const cards = document.querySelectorAll('.student-card');

        cards.forEach(card => {
            const status = card.getAttribute('data-status');
            const course = card.getAttribute('data-course');
            
            const matchesTab = (activeTabFilter === 'all') || (activeTabFilter === 'unmarked' && status === 'unmarked');
            const matchesCourse = (activeCourseFilter === 'all') || (activeCourseFilter === course);

            if (matchesTab && matchesCourse) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // 3. Edit Mode Toggle
    const editModeToggle = document.getElementById('editModeToggle');
    if (editModeToggle) {
        editModeToggle.addEventListener('change', (e) => {
            const isEditMode = e.target.checked;
            const allActionContainers = document.querySelectorAll('.attendance-actions');
            allActionContainers.forEach(container => {
                if (isEditMode) {
                    container.classList.remove('disabled');
                } else {
                    container.classList.add('disabled');
                }
            });
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
    // 5. Submit Button
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.addEventListener('click', () => {
        const cards = document.querySelectorAll('.student-card');
        const total = cards.length;
        const marked = document.querySelectorAll('.student-card[data-status="marked"]').length;
        
        if (marked < total) {
            alert(`You still have ${total - marked} unmarked students.`);
        } else {
            const originalContent = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
            submitBtn.style.pointerEvents = 'none';
            
            // Collect all student attendance data
            const className = document.querySelector('.class-title').innerText;
            const now = new Date();
            const dateFormatted = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
            
            const sessionData = [];
            
            // Loop through all students in the list
            cards.forEach(card => {
                const studentName = card.querySelector('.name').innerText.trim();
                const studentID = card.getAttribute('data-uid'); // Robust retrieval via attribute
                
                // Determine status from the active button
                let attendanceStatus = 'unmarked';
                const activeBtn = card.querySelector('.status-btn.active');
                if (activeBtn) {
                    attendanceStatus = activeBtn.getAttribute('data-type');
                }

                // Create record for every student
                const record = {
                    studentName: studentName,
                    studentID: studentID,
                    attendanceStatus: attendanceStatus,
                    date: dateFormatted,
                    className: className,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                sessionData.push(record);
            });

            // Save this data to Firestore collection "attendanceRecords"
            const promises = sessionData.map(record => {
                // Use a deterministic ID to prevent duplicates (studentID + date)
                const docId = `${record.studentID}_${record.date}`;
                return db.collection('attendanceRecords').doc(docId).set(record);
            });

            Promise.all(promises).then(() => {
                submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Attendance Submitted';
                submitBtn.style.backgroundColor = '#10b981'; // Green
                
                setTimeout(() => {
                    // Navigate to AttendanceHistory screen
                    window.location.href = 'history.html';
                }, 1500); // Reduced delay since debug info is gone
            }).catch(error => {
                alert("Error saving to Firestore: " + error.message);
                submitBtn.innerHTML = originalContent;
                submitBtn.style.pointerEvents = 'auto';
            });
        }
    });
    // History button functionality
    const historyBtn = document.getElementById('historyBtn');
    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            window.location.href = 'history.html';
        });
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
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

    const openResetModal = () => {
        resetModal.classList.add('active');
        resetPasswordInput.value = '';
        resetPasswordInput.focus();
        modalError.style.display = 'none';
    };

    const closeResetModal = () => {
        resetModal.classList.remove('active');
    };

    if (resetTodayBtn) {
        resetTodayBtn.addEventListener('click', openResetModal);
    }

    if (cancelResetBtn) {
        cancelResetBtn.addEventListener('click', closeResetModal);
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

            const now = new Date();
            const dateFormatted = now.toISOString().split('T')[0];

            try {
                confirmResetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
                confirmResetBtn.style.pointerEvents = 'none';
                modalError.style.display = 'none';

                // 1. Re-authenticate User
                const user = firebase.auth().currentUser;
                if (!user) {
                    alert("Session expired. Please log in again.");
                    window.location.href = 'index.html';
                    return;
                }

                const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
                await user.reauthenticateWithCredential(credential);

                confirmResetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';

                // 2. Fetch records for today
                const snapshot = await db.collection('attendanceRecords')
                    .where('date', '==', dateFormatted)
                    .get();

                if (snapshot.empty) {
                    modalError.textContent = "No records found for today.";
                    modalError.style.display = 'block';
                    confirmResetBtn.innerHTML = 'Confirm Reset';
                    confirmResetBtn.style.pointerEvents = 'auto';
                    return;
                }

                // 3. Delete matching documents
                const batch = db.batch();
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();

                // 4. Success state
                confirmResetBtn.innerHTML = '<i class="fa-solid fa-check"></i> Reset Successful';
                confirmResetBtn.style.backgroundColor = '#10b981';

                // 5. Refresh UI
                setTimeout(() => {
                    location.reload();
                }, 1000);

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
});
