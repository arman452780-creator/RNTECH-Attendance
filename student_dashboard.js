document.addEventListener('DOMContentLoaded', () => {
    // Route Guard: Ensure only students can access
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'student') {
        alert("Access Denied: Student privileges required.");
        window.location.href = 'index.html';
        return;
    }

    const studentRecordsList = document.getElementById('studentRecordsList');
    const totalClassesEl = document.getElementById('totalClasses');
    const attendedCountEl = document.getElementById('attendedCount');
    const todayStatusEl = document.getElementById('todayStatus');
    const overallPercentageEl = document.getElementById('overallPercentage');
    const progressCircle = document.getElementById('progressCircle');
    const logoutBtn = document.getElementById('logoutBtn');

    // Use Firebase Auth to get the current user ID
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            const currentStudentID = user.uid;
            initializeDashboard(currentStudentID);
        } else {
            // No user is signed in
            window.location.href = 'index.html';
        }
    });

    function initializeDashboard(currentStudentID) {
        // Fetch user profile first to get the correct course name
        db.collection('users').doc(currentStudentID).get().then(userDoc => {
            const userData = userDoc.exists ? userDoc.data() : {};
            const name = (userData.name || userData.displayName || userData.email.split('@')[0]).toUpperCase();
            const studentCourse = (userData.course || "General Course").toUpperCase();
            const photoUrl = userData.photoUrl;
            
            document.getElementById('welcomeMsg').textContent = `WELCOME, ${name}`;

            // Update Header Profile Pic
            const headerPic = document.getElementById('headerProfilePic');
            const profileImg = document.getElementById('profileImg');
            
            if (headerPic && profileImg) {
                const isLegacyAvatar = photoUrl && photoUrl.includes('pravatar.cc');
                headerPic.style.display = 'block'; // Always show the container
                if (photoUrl && !isLegacyAvatar) {
                    profileImg.src = photoUrl;
                    profileImg.style.display = 'block';
                } else {
                    // Show a generic icon if no real photo exists (or legacy one)
                    headerPic.innerHTML = `<div style="width: 100%; height: 100%; background: #f1f5f9; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-user" style="color: #94a3b8; font-size: 16px;"></i></div>`;
                }
            }

            // Start real-time attendance listener
            db.collection('attendanceRecords')
              .where('studentID', '==', currentStudentID)
              .onSnapshot((snapshot) => {
                  const myRecords = [];
                  snapshot.forEach(doc => {
                      myRecords.push(doc.data());
                  });

                  // Clear existing list before re-rendering
                  studentRecordsList.innerHTML = '';

                  // 1. Calculate and Display Stats
                  if (myRecords.length > 0) {
                      myRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

                      const totalClasses = myRecords.length;
                      const attendedClasses = myRecords.filter(r => r.attendanceStatus === 'present').length;
                      
                      let percentage = 0;
                      if (totalClasses > 0) {
                          percentage = Math.round((attendedClasses / totalClasses) * 100);
                      }
                      
                      totalClassesEl.textContent = totalClasses;
                      attendedCountEl.textContent = attendedClasses;
                      overallPercentageEl.textContent = `${percentage}%`;

                      const latestRecord = myRecords[0];
                      todayStatusEl.textContent = latestRecord.attendanceStatus;
                      todayStatusEl.className = `stat-value status-${latestRecord.attendanceStatus}`;
                      
                      const circumference = 2 * Math.PI * 54;
                      const offset = circumference - (percentage / 100) * circumference;
                      
                      if (progressCircle) {
                          progressCircle.style.strokeDasharray = circumference;
                          progressCircle.style.strokeDashoffset = offset;
                      }

                      // 2. Render Record Cards (Latest 5)
                      const recentSessions = myRecords.slice(0, 5);

                      recentSessions.forEach(record => {
                          const card = document.createElement('div');
                          card.className = 'history-card';
                          card.innerHTML = `
                              <div class="history-card-header">
                                  <div class="class-info">
                                      <p class="class-name">${studentCourse}</p>
                                  </div>
                                  <span class="status-badge ${record.attendanceStatus}">${record.attendanceStatus.toUpperCase()}</span>
                              </div>
                              <div class="history-card-footer">
                                  <i class="fa-regular fa-calendar"></i>
                                  <span>${record.date}</span>
                              </div>
                          `;
                          studentRecordsList.appendChild(card);
                      });
                  } else {
                      // ... (empty state handling)
                      totalClassesEl.textContent = '0';
                      attendedCountEl.textContent = '0';
                      overallPercentageEl.textContent = '0%';
                      todayStatusEl.textContent = 'Unmarked';
                      
                      if (progressCircle) {
                          progressCircle.style.strokeDashoffset = 2 * Math.PI * 54;
                      }

                      studentRecordsList.innerHTML = `
                          <div class="empty-state" style="text-align:center; padding: 60px 20px; background: white; border-radius: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); margin-top: 20px;">
                              <div style="background: #f1f5f9; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                                  <i class="fa-solid fa-clipboard-question" style="font-size: 32px; color: #94a3b8;"></i>
                              </div>
                              <h3 style="color: #1e293b; font-size: 18px; margin-bottom: 8px;">No records yet</h3>
                              <p style="color: #64748b; font-size: 14px; line-height: 1.5; max-width: 200px; margin: 0 auto;">Please wait for your teacher to mark the attendance for today's session.</p>
                          </div>`;
                  }
              }, (error) => {
                  console.error("Error fetching Firestore records:", error);
              });
        });
    }

    // Logout functionality
    logoutBtn.addEventListener('click', () => {
        firebase.auth().signOut().then(() => {
            localStorage.removeItem('userRole');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('currentUserID');
            window.location.href = 'index.html';
        });
    });
});
