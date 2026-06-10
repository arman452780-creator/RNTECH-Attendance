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

    // --- Custom Modal Logic ---
    const authModal = document.getElementById('authModal');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const closeModalBtn = document.getElementById('closeModalBtn');

    const showModal = (title, message, type = 'error') => {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        
        // Update icon based on type
        modalIcon.className = `modal-icon ${type}`;
        modalIcon.innerHTML = type === 'success' 
            ? '<i class="fa-solid fa-circle-check"></i>' 
            : '<i class="fa-solid fa-circle-exclamation"></i>';

        authModal.classList.add('active');
    };

    const closeModal = () => {
        authModal.classList.remove('active');
    };

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    // Close on outside click
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeModal();
    });

    // Firebase Error Mapping
    const mapAuthError = (code) => {
        switch (code) {
            case 'auth/invalid-credential':
                return "Invalid email or password.";
            case 'auth/user-not-found':
                return "Account not found.";
            case 'auth/wrong-password':
                return "Incorrect password.";
            case 'auth/too-many-requests':
                return "Too many attempts. Try again later.";
            case 'auth/invalid-email':
                return "Please enter a valid email address.";
            case 'auth/network-request-failed':
                return "Network error. Check your internet connection.";
            case 'auth/email-already-in-use':
                return "This email is already registered.";
            case 'auth/weak-password':
                return "Password should be at least 6 characters.";
            default:
                return "An unexpected error occurred. Please try again.";
        }
    };

    // --- Forgot Password Logic ---
    const forgotModal = document.getElementById('forgotModal');
    const forgotPasswordLink = document.getElementById('forgotPassword');
    const forgotEmailInput = document.getElementById('forgotEmailInput');
    const sendResetBtn = document.getElementById('sendResetBtn');
    const cancelResetBtn = document.getElementById('cancelResetBtn');

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Pre-fill if main email is entered
        forgotEmailInput.value = document.getElementById('emailInput').value.trim();
        forgotModal.classList.add('active');
    });

    const closeForgotModal = () => {
        forgotModal.classList.remove('active');
    };

    cancelResetBtn.addEventListener('click', closeForgotModal);
    forgotModal.addEventListener('click', (e) => {
        if (e.target === forgotModal) closeForgotModal();
    });

    sendResetBtn.addEventListener('click', async () => {
        const email = forgotEmailInput.value.trim();

        if (!email) {
            showModal('Email Required', 'Please enter your registered email address.');
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showModal('Invalid Email', 'Please enter a valid email address.');
            return;
        }

        const originalBtnText = sendResetBtn.textContent;
        sendResetBtn.disabled = true;
        sendResetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

        try {
            await auth.sendPasswordResetEmail(email);
            closeForgotModal();
            showModal('Email Sent', 'A password reset link has been sent to your email. Please check your inbox.', 'success');
        } catch (error) {
            showModal('Reset Failed', mapAuthError(error.code));
        } finally {
            sendResetBtn.disabled = false;
            sendResetBtn.textContent = originalBtnText;
        }
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
                document.querySelector('.login-container').classList.add('signup-mode');
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
                document.querySelector('.login-container').classList.remove('signup-mode');
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
            try {
                const userRef = db.collection('users').doc(user.uid);
                const doc = await userRef.get();

                if (doc.exists) {
                    const userData = doc.data();
                    proceedToDashboard(user.uid, user.email, userData.role);
                } else {
                    initialLoader.style.display = 'none';
                }
            } catch (error) {
                console.error("Error fetching user data on start:", error);
                initialLoader.style.display = 'none';
            }
        } else {
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

        try {
            authAction
                .then((userCredential) => {
                    const user = userCredential.user;

                    const syncUserDocument = async (uid, email, name, role, course) => {
                        try {
                            const userRef = db.collection('users').doc(uid);
                            const doc = await userRef.get();
                            let existingData = doc.exists ? doc.data() : null;

                            const updatedData = {
                                userID: uid,
                                name: name || (existingData ? (existingData.name || existingData.displayName) : null) || email.split('@')[0],
                                email: email,
                                role: role || (existingData ? existingData.role : null) || 'student',
                                course: course || (existingData ? existingData.course : null) || 'DCA'
                            };

                            if (existingData && existingData.photoUrl) {
                                updatedData.photoUrl = existingData.photoUrl;
                            }

                            await userRef.set(updatedData, { merge: true });
                            return updatedData;
                        } catch (syncErr) {
                            console.error('[DEBUG] syncUserDocument failed:', syncErr);
                            // Return dummy data to at least try navigating
                            return { role: 'student' };
                        }
                    };

                    if (authMode === 'signup') {
                        const fullName = nameInput.value.trim();
                        const selectedCourse = courseInput.value;
                        const signupRole = 'student';

                        if (!selectedCourse) {
                            showModal('Course Missing', 'Please select a course to continue.');
                            // Reset button state
                            loginBtn.innerHTML = originalContent;
                            loginBtn.style.opacity = '1';
                            loginBtn.style.pointerEvents = 'auto';
                            return;
                        }

                        return syncUserDocument(user.uid, user.email, fullName, signupRole, selectedCourse)
                            .then((finalData) => {
                                proceedToDashboard(user.uid, user.email, finalData.role);
                            });
                    } else {
                        return syncUserDocument(user.uid, user.email, null, null, null)
                            .then((finalData) => {
                                proceedToDashboard(user.uid, user.email, finalData.role);
                            });
                    }
                })
                .catch((error) => {
                    showModal('Authentication Failed', mapAuthError(error.code));

                    // Reset button state
                    loginBtn.innerHTML = originalContent;
                    loginBtn.style.opacity = '1';
                    loginBtn.style.pointerEvents = 'auto';
                });
        } catch (fatalErr) {
            console.error('[FATAL] Auth flow crashed:', fatalErr);
            showModal('System Error', 'Authentication process crashed. Please restart the app.');
        }
    });

    function proceedToDashboard(uid, email, role) {
        try {
            console.log('[DEBUG] Proceeding to dashboard for role:', role);
            localStorage.setItem('userRole', role);
            localStorage.setItem('userEmail', email);
            localStorage.setItem('currentUserID', uid);

            if (role === 'teacher') {
                window.location.href = 'teacher_dashboard.html';
            } else if (role === 'assistant') {
                window.location.href = 'assistant_dashboard.html';
            } else if (role === 'student') {
                window.location.href = 'student_dashboard.html';
            } else {
                showModal('Access Denied', 'No valid role assigned to this account.');
            }
        } catch (err) {
            console.error('[CRITICAL] proceedToDashboard failed:', err);
            showModal('Navigation Error', 'App failed to redirect. Please try again.');
        }
    }
});
