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
            const students = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Ensure field 'name' is used (Requirement 3 from previous task)
                const studentData = {
                    ...data,
                    name: data.name || data.displayName || data.email.split('@')[0]
                };
                students.push(studentData);
            });

            if (students.length === 0) {
                studentList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">No students found. Please register students first.</div>';
                return;
            }

            renderStudents(students);
        } catch (error) {
            // Detailed Error Logging (Requirement 1, 4, 6)
            console.error("FULL FIREBASE ERROR:", error);
            console.error("ERROR CODE:", error.code);
            console.error("ERROR MESSAGE:", error.message);
            
            loadingState.innerHTML = `
                <div style="color: #ef4444; padding: 20px; text-align: center;">
                    <i class="fa-solid fa-circle-exclamation"></i><br>
                    <strong>Error loading students</strong><br>
                    <span style="font-size: 12px; opacity: 0.8;">${error.message} (${error.code || 'unknown'})</span>
                </div>`;
        }
    };

    fetchStudents();

    function renderStudents(students) {
        students.forEach((student) => {
            const displayName = student.name || student.email.split('@')[0];
            const card = document.createElement('div');
            card.className = 'student-card';
            card.setAttribute('data-status', 'unmarked');
            card.setAttribute('data-uid', student.userID); // Use userID attribute
            const isLegacyAvatar = student.photoUrl && student.photoUrl.includes('pravatar.cc');
            const avatarHtml = (student.photoUrl && !isLegacyAvatar)
                ? `<img src="${student.photoUrl}" alt="Student" class="avatar">`
                : `<div class="avatar-placeholder" style="width: 45px; height: 45px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.05); flex-shrink: 0;"><i class="fa-solid fa-user" style="color: #94a3b8; font-size: 18px;"></i></div>`;

            card.innerHTML = `
                <div class="student-info">
                    ${avatarHtml}
                    <div class="details">
                        <h3 class="name" style="text-transform: capitalize;">${displayName}</h3>
                        <p class="student-id" style="font-size: 12px; color: var(--text-muted); opacity: 0.8; font-weight: 500;">${student.course || 'No Course'}</p>
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
            
            // Inset before bottom spacer
            studentList.insertBefore(card, studentList.querySelector('.bottom-spacer'));
            
            // Attach individual marking logic
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
                const activeTab = document.querySelector('.tab.active').getAttribute('data-filter');
                if (activeTab === 'unmarked') {
                    setTimeout(() => {
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.95)';
                        setTimeout(() => {
                            card.style.display = 'none';
                            card.style.opacity = '1';
                            card.style.transform = 'scale(1)';
                        }, 300);
                    }, 400);
                }
            });
        });
    }

    // 3. Edit Mode Toggle
    const editModeToggle = document.getElementById('editModeToggle');
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

    // 4. Tab Filtering
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const filter = tab.getAttribute('data-filter');
            const cards = document.querySelectorAll('.student-card');
            cards.forEach(card => {
                if (filter === 'all') {
                    card.style.display = 'flex';
                } else {
                    card.style.display = card.getAttribute('data-status') === 'unmarked' ? 'flex' : 'none';
                }
            });
        });
    });

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
                    className: className
                };
                
                sessionData.push(record);
            });

            // Save this data to Firestore collection "attendanceRecords"
            const promises = sessionData.map(record => {
                return db.collection('attendanceRecords').add(record);
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
});
