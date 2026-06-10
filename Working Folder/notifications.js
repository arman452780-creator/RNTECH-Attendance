/**
 * notifications.js
 * Deeply Diagnosed & Hardened Push Notification Support for Capacitor Android.
 * 
 * FIX: This version prevents crashes by isolating initialization and using 
 * defensive programming for all native bridge calls.
 */

// Global state
let isPushInitialized = false;

/**
 * Main initialization function for Push Notifications.
 * MUST be called explicitly after UI is ready.
 */
const initializePushNotifications = async () => {
    console.log('[DEBUG-FCM] initializePushNotifications called');

    try {
        // 1. Double-initialization guard
        if (isPushInitialized) {
            console.log('[DEBUG-FCM] Already initialized. Skipping.');
            return;
        }

        // 2. Environment Validation
        if (typeof window === 'undefined') return;
        
        // Use the safe Capacitor check requested by user
        const isNative = window.Capacitor?.isNativePlatform?.();
        if (!isNative) {
            console.log('[DEBUG-FCM] Non-native platform. Push disabled.');
            return;
        }

        const platform = window.Capacitor.getPlatform();
        if (platform !== 'android') {
            console.log('[DEBUG-FCM] Platform is ' + platform + '. Skipping Android setup.');
            return;
        }

        // 3. Plugin Availability
        const PushNotifications = window.Capacitor.Plugins?.PushNotifications;
        if (!PushNotifications) {
            console.warn('[DEBUG-FCM] PushNotifications plugin not found. Check capacitor.config.json and sync.');
            return;
        }

        console.log('[DEBUG-FCM] Plugin found. Checking permissions...');

        // 4. Permission Flow (Wrapped in try/catch)
        let permStatus;
        try {
            permStatus = await PushNotifications.checkPermissions();
            console.log('[DEBUG-FCM] Permission status:', permStatus.receive);
        } catch (e) {
            console.error('[DEBUG-FCM] checkPermissions failed:', e);
            return; // Exit safely
        }

        if (permStatus.receive === 'prompt') {
            try {
                permStatus = await PushNotifications.requestPermissions();
            } catch (e) {
                console.error('[DEBUG-FCM] requestPermissions failed:', e);
                return;
            }
        }

        if (permStatus.receive !== 'granted') {
            console.warn('[DEBUG-FCM] Permissions not granted. Exiting.');
            return;
        }

        // 5. Native Event Listeners (Set up BEFORE registration)
        try {
            // Remove existing to be safe
            await PushNotifications.removeAllListeners();

            PushNotifications.addListener('registration', (token) => {
                console.log('[DEBUG-FCM] Registration success. Syncing token...');
                if (token?.value) {
                    saveTokenToFirestoreSafely(token.value);
                }
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('[DEBUG-FCM] Registration error:', JSON.stringify(error));
            });

            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('[DEBUG-FCM] Notification received:', notification.title);
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                console.log('[DEBUG-FCM] Notification action:', action.notification.title);
                if (action.notification.data?.url) {
                    window.location.href = action.notification.data.url;
                }
            });
        } catch (e) {
            console.error('[DEBUG-FCM] Listener setup failed:', e);
            // Continue anyway, registration might still work
        }

        // 6. Channel Creation (Android Specific)
        try {
            await PushNotifications.createChannel({
                id: 'rn-tech-attendance',
                name: 'RN-TECH Attendance',
                description: 'Attendance alerts',
                importance: 5,
                visibility: 1,
                vibration: true,
                sound: 'default'
            });
            console.log('[DEBUG-FCM] Android channel created.');
        } catch (e) {
            console.warn('[DEBUG-FCM] Channel creation failed (non-critical):', e);
        }

        // 7. Register (Final step)
        try {
            console.log('[DEBUG-FCM] Calling register()...');
            await PushNotifications.register();
            isPushInitialized = true;
            console.log('[DEBUG-FCM] Initialization complete.');
        } catch (e) {
            console.error('[DEBUG-FCM] register() call failed:', e);
        }

    } catch (globalError) {
        console.error('[DEBUG-FCM] CRITICAL FAILURE in initializePushNotifications:', globalError);
    }
};

/**
 * Safely saves the FCM token to Firestore.
 */
const saveTokenToFirestoreSafely = async (token) => {
    try {
        if (typeof firebase === 'undefined') return;

        const user = firebase.auth().currentUser;
        if (!user) {
            console.log('[DEBUG-FCM] No authenticated user. Storing token in localStorage.');
            localStorage.setItem('pending_fcm_token', token);
            return;
        }

        const db = firebase.firestore();
        await db.collection('users').doc(user.uid).set({
            fcmToken: token,
            lastTokenUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            platform: 'android'
        }, { merge: true });

        console.log('[DEBUG-FCM] Token synced to Firestore.');
        localStorage.removeItem('pending_fcm_token');
    } catch (e) {
        console.error('[DEBUG-FCM] Firestore sync failed:', e);
    }
};

// EXPORT to global scope for other scripts
window.initializePushNotifications = initializePushNotifications;
