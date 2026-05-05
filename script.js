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
    
    toggleAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        if (authMode === 'login') {
            authMode = 'signup';
            authHeader.textContent = 'Create Account';
            authDesc.textContent = 'Join RN-TECH Today !';
            submitBtnText.textContent = 'Create Account';
            toggleMsg.textContent = 'Already have an account?';
            toggleAuthMode.textContent = 'Login';
            nameField.style.display = 'block';   // Show name field
            nameInput.required = true;
            courseField.style.display = 'block'; // Show course field
            courseInput.required = true;
        } else {
            authMode = 'login';
            authHeader.textContent = 'RN-TECH';
            authDesc.textContent = 'Sign in to your account';
            submitBtnText.textContent = 'Login';
            toggleMsg.textContent = "Don't have an account?";
            toggleAuthMode.textContent = 'Sign Up';
            nameField.style.display = 'none';    // Hide name field
            nameInput.required = false;
            courseField.style.display = 'none';   // Hide course field
            courseInput.required = false;
        }
    });

    // Firebase Auth is initialized globally in firebase-init.js
    const auth = firebase.auth();

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
                
                if (authMode === 'signup') {
                    // 1. For Signup: Save details as student only
                    const fullName = nameInput.value.trim();
                    const selectedCourse = courseInput.value;
                    const signupRole = 'student'; 

                    if (!selectedCourse) {
                        alert("Please select a course to continue.");
                        return;
                    }

                    return db.collection('users').doc(user.uid).set({
                        userID: user.uid,
                        email: user.email,
                        displayName: fullName,
                        role: signupRole,
                        course: selectedCourse,
                        photoUrl: null 
                    }, { merge: true }).then(() => {
                        proceedToDashboard(user.uid, user.email, signupRole);
                    });
                } else {
                    // 2. For Login: Fetch role from Firestore
                    return db.collection('users').doc(user.uid).get().then((doc) => {
                        if (doc.exists) {
                            const userData = doc.data();
                            proceedToDashboard(user.uid, user.email, userData.role);
                        } else {
                            throw new Error("User profile not found in database.");
                        }
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
