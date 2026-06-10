document.addEventListener('DOMContentLoaded', async () => {
    const profileLoader = document.getElementById('profileLoader');
    const assistantName = document.getElementById('assistantName');
    const assistantEmail = document.getElementById('assistantEmail');
    const profileImage = document.getElementById('profileImage');
    const assistantStatus = document.getElementById('assistantStatus');
    const logoutBtn = document.getElementById('logoutBtn');

    // Display Loader
    if (profileLoader) profileLoader.style.display = 'flex';

    // Fetch user from auth/cache
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            try {
                // Try to get from cache first
                let userData = window.LocalCache ? window.LocalCache.getSync('currentUser') : null;
                
                console.log("=== PROFILE DEBUG LOGS ===");
                console.log("1. auth.currentUser.uid:", user.uid);
                console.log("2. cached userData:", userData);
                
                if (!userData || (userData.uid !== user.uid && userData.id !== user.uid)) {
                    console.log("3. Fetching users/" + user.uid + " from Firestore...");
                    const doc = await db.collection('users').doc(user.uid).get();
                    if (doc.exists) {
                        userData = { id: doc.id, uid: doc.id, ...doc.data() };
                        console.log("4. Fetched userData:", userData);
                        if (window.LocalCache) window.LocalCache.set('currentUser', userData);
                    } else {
                        console.error("User document DOES NOT EXIST in users collection for uid:", user.uid);
                    }
                }

                if (userData) {
                    console.log("5. Checking fields:");
                    console.log(" - name/fullName:", userData.name || userData.fullName);
                    console.log(" - email:", userData.email);
                    console.log(" - role:", userData.role);
                    console.log(" - assignedClasses:", userData.assignedClasses);
                    console.log(" - active:", userData.active);
                    console.log(" - createdBy:", userData.createdBy);
                }

                if (userData && userData.role === 'assistant') {
                    // Populate UI
                    assistantName.textContent = userData.name || userData.fullName || 'Assistant User';
                    assistantEmail.textContent = userData.email || user.email || 'No email provided';
                    
                    if (userData.photoUrl) {
                        profileImage.src = userData.photoUrl;
                    } else {
                        profileImage.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'Assistant')}&background=10b981&color=fff`;
                    }

                    if (userData.active === false) {
                        assistantStatus.innerHTML = '<i class="fa-solid fa-ban"></i> Disabled Account';
                        assistantStatus.style.color = '#ef4444';
                    }


                } else {
                    console.error("6. Redirecting! Role is not assistant or userData is missing.", userData);
                    // Commented out redirect so we can debug
                    // window.location.href = 'index.html';
                }
            } catch (error) {
                console.error("=== ERROR LOADING PROFILE ===", error);
                alert("Profile load error: " + error.message);
            } finally {
                if (profileLoader) profileLoader.style.display = 'none';
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            firebase.auth().signOut().then(() => {
                if (window.LocalCache) {
                    window.LocalCache.clearAll();
                }
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = 'index.html';
            }).catch((error) => {
                console.error('Logout error:', error);
            });
        });
    }
});
