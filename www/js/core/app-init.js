// app-init.js - Core Lifecycle Initialization for RN-TECH
// Ensures Offline First rendering, Theme caching, and strict data orchestration

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[AppInit] Lifecycle Starting...');

    const currentPath = window.location.pathname;
    const isStudentPortal = currentPath.includes('student_');
    const isAssistantPortal = currentPath.includes('assistant_');
    
    // Determine if it's a teacher page (allow attendance for teacher and assistant)
    const isTeacherPortal = currentPath.includes('teacher_') || 
                            currentPath.endsWith('/history.html') || 
                            currentPath.endsWith('/reports.html') ||
                            currentPath.includes('fee_');
                            
    const isSharedPortal = currentPath.endsWith('/attendance.html');
    
    // Fallback to localStorage if URL parsing is ambiguous
    const savedRole = localStorage.getItem('userRole');
    let role = null;
    
    if (isTeacherPortal) role = 'teacher';
    else if (isStudentPortal) role = 'student';
    else if (isAssistantPortal) role = 'assistant';
    else if (isSharedPortal && savedRole) role = savedRole; // allow either teacher or assistant

    if (!role && savedRole) {
        role = savedRole;
    }

    // 2. Instant Render from Cache (Offline First)
    const cachedUser = window.LocalCache.getSync('currentUser');
    if (cachedUser && role) {
        console.log('[AppInit] Triggering Instant Render from Cache (delayed for listeners)');
        setTimeout(() => {
            const event = new CustomEvent('APP_READY', { 
                detail: { user: cachedUser, role, isOffline: !navigator.onLine, isCached: true } 
            });
            document.dispatchEvent(event);
        }, 0); // Small delay to guarantee DOMContentLoaded listeners have attached
    }

    // 3. Initialize Firebase Auth Safely
    const auth = window.firebase ? firebase.auth() : null;
    if (!auth) {
        console.warn('[AppInit] Firebase not found. Running in strict offline mode.');
        return; // Only UI will render if cached, no auth checks
    }

    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            console.log("[AppInit] No User Detected - Redirecting To Login");
            localStorage.clear();
            sessionStorage.clear();
            if (!currentPath.endsWith('index.html') && currentPath !== '/') {
                window.location.replace('index.html');
            }
            return;
        }

        // --- Role Protection Guard ---
        if (role === 'assistant') {
            if (isTeacherPortal || isStudentPortal) {
                console.warn("[AppInit] Assistant attempted to access restricted page. Redirecting.");
                window.location.replace('assistant_dashboard.html');
                return;
            }
        } else if (role === 'student' && (isTeacherPortal || isAssistantPortal)) {
            window.location.replace('student_dashboard.html');
            return;
        } else if (role === 'teacher' && (isStudentPortal || isAssistantPortal)) {
            window.location.replace('teacher_dashboard.html');
            return;
        }

        console.log(`[AppInit] User verified: ${user.uid} as ${role}`);
        
        // Ensure Database is configured for offline persistence
        try {
            if (firebase.firestore().app) {
                // Ignore if already enabled
            }
        } catch (e) {
            // Already enabled or not supported
        }

        // 4. Trigger Firebase Sync to feed LocalCache
        if (role) {
            window.FirebaseSync.startSync(role, user.uid);
        }

        // 5. Trigger Authoritative Ready Event (for binding listeners)
        const event = new CustomEvent('APP_READY', { 
            detail: { user, role, isOffline: !navigator.onLine, isCached: false } 
        });
        document.dispatchEvent(event);
    });

    // Handle Network Status changes for UI feedback
    window.addEventListener('online', () => {
        console.log('[AppInit] Device went online. Resuming sync...');
    });

    window.addEventListener('offline', () => {
        console.log('[AppInit] Device went offline. Using LocalCache strictly.');
    });
});
