document.addEventListener('DOMContentLoaded', () => {
    // Signup is restricted to students only
    let selectedRole = 'student';

    // Password visibility toggle
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('passwordInput');

    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        // Toggle icon classes
        if (type === 'text') {
            togglePasswordBtn.className = 'fa-solid fa-eye-slash eye-icon';
        } else {
            togglePasswordBtn.className = 'fa-solid fa-eye eye-icon';
        }
    });

    // Forgot Password Logic
    const forgotPasswordLink = document.getElementById('forgotPassword');
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        const email = document.getElementById('emailInput').value.trim();

        console.log("Attempting password reset for:", email);

        if (!email) {
            alert('Enter your email first');
            return;
        }

        auth.sendPasswordResetEmail(email)
            .then(() => {
                console.log("Password reset success response received");
                console.log(`Password reset email sent to: ${email}`);
                alert('Password reset link sent to your email');
            })
            .catch((error) => {
                console.log("Password reset error response received");
                console.log(error.code);
                console.log(error.message);

                if (error.code === 'auth/user-not-found') {
                    alert('Email not registered');
                } else if (error.code === 'auth/invalid-email') {
                    alert('Invalid email format');
                } else if (error.code === 'auth/network-request-failed') {
                    alert('Check internet connection');
                } else {
                    alert(`Error: ${error.message}`);
                }
            });
    });

    // Auth Mode Toggle (Login vs Signup)
    let authMode = 'login';
    const authHeader = document.querySelector('.header h1');
    const authDesc = document.querySelector('.header p');
    const submitBtnText = document.getElementById('submitBtnText');
    const toggleMsg = document.getElementById('toggleMsg');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const loginBtn = document.querySelector('.login-btn');

    const nameField = document.getElementById('nameField');
    const nameInput = document.getElementById('nameInput');
    const courseField = document.getElementById('courseField');
    const courseInput = document.getElementById('courseInput');

    // Photo preview logic removed

    // Fetch existing courses to populate signup dropdown
    const populateCourseDropdown = async () => {
        try {
            const courseInput = document.getElementById('courseInput');
            if (!courseInput) return;

            const querySnapshot = await db.collection('users')
                .where('role', '==', 'student')
                .get();

            const courses = new Set(['ADCA', 'DCA', 'ENGLISH', 'COMPETITION CLASS']); // Defaults
            querySnapshot.forEach(doc => {
                const data = doc.data();
                const cName = data.course ? data.course.toUpperCase() : '';
                if (cName && cName !== 'ADVANCED PHYSICS 301') courses.add(cName);
            });

            // Preserve initial disabled option
            courseInput.innerHTML = '<option value="" disabled selected>Select Course</option>';
            
            // Sort and add unique courses
            [...courses].sort().forEach(course => {
                const option = document.createElement('option');
                option.value = course;
                option.textContent = course.toUpperCase();
                courseInput.appendChild(option);
            });
        } catch (error) {
            console.error("Error fetching existing courses:", error);
        }
    };

    populateCourseDropdown();

    toggleAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Start fade out
        const formContent = document.querySelector('.login-form');
        formContent.style.opacity = '0';
        formContent.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            if (authMode === 'login') {
                authMode = 'signup';
                authHeader.textContent = 'Create Account';
                authDesc.textContent = 'Join RNTECH Today !';
                submitBtnText.textContent = 'Create Account';
                toggleMsg.textContent = 'Already have an account?';
                toggleAuthMode.textContent = 'Login';
                nameField.style.display = 'block';
                nameInput.required = true;
                courseField.style.display = 'block';
                courseInput.required = true;
            } else {
                authMode = 'login';
                authHeader.innerHTML = `
                    <span style="font-weight: 800; background: linear-gradient(135deg, #2563eb, #3b82f6); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -1px;">RN</span>
                    <span style="font-weight: 300; color: #64748b; letter-spacing: 0;">TECH</span>
                `;
                authDesc.textContent = 'Sign in to your account';
                submitBtnText.textContent = 'Login';
                toggleMsg.textContent = "Don't have an account?";
                toggleAuthMode.textContent = 'Sign Up';
                nameField.style.display = 'none';
                nameInput.required = false;
                courseField.style.display = 'none';
                courseInput.required = false;
            }
            
            // Fade back in
            formContent.style.opacity = '1';
            formContent.style.transform = 'translateY(0)';
        }, 300);
    });

    // Firebase Auth is initialized globally in firebase-init.js
    const auth = firebase.auth();
    const initialLoader = document.getElementById('initialLoader');

    // Requirement 1 & 2: onAuthStateChanged to check session on app start
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("Session detected for:", user.email);
            try {
                // Requirement 3: Fetch user document from Firestore
                const userRef = db.collection('users').doc(user.uid);
                const doc = await userRef.get();

                if (doc.exists) {
                    const userData = doc.data();
                    // Requirement 4: Redirect based on role
                    proceedToDashboard(user.uid, user.email, userData.role);
                } else {
                    console.error("No user document found for active session.");
                    initialLoader.style.display = 'none'; // Show login if data missing
                }
            } catch (error) {
                console.error("Error fetching user data on start:", error);
                initialLoader.style.display = 'none';
            }
        } else {
            // Requirement 5: If no user, show login screen
            console.log("No active session. Showing login screen.");
            initialLoader.style.display = 'none';
        }
    });

    // Form submission with Firebase Auth
    const loginForm = document.getElementById('loginForm');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;

        const originalContent = loginBtn.innerHTML;
        loginBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>${authMode === 'login' ? 'Logging in...' : 'Creating account...'}</span>`;
        loginBtn.style.opacity = '0.8';
        loginBtn.style.pointerEvents = 'none';

        // Choose Firebase Auth Method
        const authAction = authMode === 'login'
            ? auth.signInWithEmailAndPassword(email, password)
            : auth.createUserWithEmailAndPassword(email, password);

        authAction
            .then((userCredential) => {
                const user = userCredential.user;

                // Helper to ensure user document consistency (Task Requirement 2, 3, 4, 5)
                const syncUserDocument = async (uid, email, name, role, course) => {
                    const userRef = db.collection('users').doc(uid);
                    const doc = await userRef.get();
                    let existingData = doc.exists ? doc.data() : null;

                    // Requirement 6: Log error if document not found
                    if (!existingData) {
                        console.error(`Error: Firestore document not found for UID: ${uid}`);
                    } else {
                        // Requirement 6: Log error if UID mismatch
                        if (existingData.userID && existingData.userID !== uid) {
                            console.error(`Error: UID mismatch! Auth UID: ${uid}, Firestore userID: ${existingData.userID}`);
                        }
                    }

                    // Requirement 3: Mandatory structure
                    const updatedData = {
                        userID: uid,
                        name: name || (existingData ? (existingData.name || existingData.displayName) : null) || email.split('@')[0],
                        email: email,
                        role: role || (existingData ? existingData.role : null) || 'student',
                        course: course || (existingData ? existingData.course : null) || 'DCA'
                    };

                    // Preserve photoUrl if it exists to satisfy Requirement: "Do not change UI"
                    if (existingData && existingData.photoUrl) {
                        updatedData.photoUrl = existingData.photoUrl;
                    }

                    // Requirement 4 & 5: Update missing fields and ensure UID matches exactly
                    await userRef.set(updatedData); // Overwrite to ensure clean structure, but with photoUrl preserved
                    return updatedData;
                };

                if (authMode === 'signup') {
                    const fullName = nameInput.value.trim();
                    const selectedCourse = courseInput.value;
                    const signupRole = 'student';

                    if (!selectedCourse) {
                        alert("Please select a course to continue.");
                        return;
                    }

                    return syncUserDocument(user.uid, user.email, fullName, signupRole, selectedCourse)
                        .then((finalData) => {
                            proceedToDashboard(user.uid, user.email, finalData.role);
                        });
                } else {
                    // For Login: Fetch and sync
                    return syncUserDocument(user.uid, user.email, null, null, null)
                        .then((finalData) => {
                            proceedToDashboard(user.uid, user.email, finalData.role);
                        });
                }
            })
            .catch((error) => {
                const errorMessage = error.message;
                alert(`Authentication Failed: ${errorMessage}`);

                // Reset button state
                loginBtn.innerHTML = originalContent;
                loginBtn.style.opacity = '1';
                loginBtn.style.pointerEvents = 'auto';
            });
    });

    function proceedToDashboard(uid, email, role) {
        // Store local session info
        localStorage.setItem('userRole', role);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('currentUserID', uid);

        // Redirect based on role from database
        if (role === 'teacher') {
            window.location.href = 'attendance.html';
        } else if (role === 'student') {
            window.location.href = 'student_dashboard.html';
        } else {
            alert("Invalid role assigned to this account.");
        }
    }
});
