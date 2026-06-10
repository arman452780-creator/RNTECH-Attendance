/**
 * permissions.js
 * Handles first-launch permission requests for RN-TECH app.
 */

document.addEventListener('DOMContentLoaded', () => {
    const continueBtn = document.getElementById('continueBtn');
    const cards = {
        notifications: document.getElementById('card-notifications'),
        camera: document.getElementById('card-camera'),
        photos: document.getElementById('card-photos')
    };

    const statusIcons = {
        notifications: document.getElementById('status-notifications'),
        camera: document.getElementById('status-camera'),
        photos: document.getElementById('status-photos')
    };

    // Modal elements
    const modal = document.getElementById('permissionModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const settingsBtn = document.getElementById('settingsBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');

    const showModal = (title, message, showSettings = false) => {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        settingsBtn.style.display = showSettings ? 'block' : 'none';
        modal.classList.add('active');
    };

    const closeModal = () => {
        modal.classList.remove('active');
    };

    closeModalBtn.addEventListener('click', closeModal);
    settingsBtn.addEventListener('click', async () => {
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            const { App } = Capacitor.Plugins;
            if (App && App.openAppSettings) {
                await App.openAppSettings();
            } else {
                alert('Please go to App Info -> Permissions in your Android settings to enable this feature.');
            }
        }
        closeModal();
    });

    const markGranted = (type) => {
        cards[type].classList.add('granted');
        cards[type].classList.remove('active');
    };

    const markActive = (type) => {
        Object.values(cards).forEach(c => c.classList.remove('active'));
        cards[type].classList.add('active');
    };

    continueBtn.addEventListener('click', async () => {
        if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()) {
            console.log('Not a native platform. Skipping permissions.');
            completePermissions();
            return;
        }

        if (!Capacitor.Plugins) {
            console.error('Capacitor.Plugins is undefined.');
            completePermissions();
            return;
        }
        const { PushNotifications, Camera } = Capacitor.Plugins;


        try {
            continueBtn.disabled = true;
            continueBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

            // 1. Request Notifications
            markActive('notifications');
            let pushStatus = await PushNotifications.requestPermissions();
            if (pushStatus.receive === 'granted') {
                markGranted('notifications');
            } else if (pushStatus.receive === 'denied') {
                showModal('Notification Denied', 'You will not receive real-time attendance alerts.');
            }

            // 2. Request Camera Only
            markActive('camera');

            let cameraCheck = await Camera.checkPermissions();
            let cameraStatus = cameraCheck;

            if (cameraCheck.camera !== 'granted') {
                cameraStatus = await Camera.requestPermissions({ permissions: ['camera'] });
            }

            if (cameraStatus.camera === 'granted') {
                markGranted('camera');
            } else {
                showModal('Camera Required', 'Camera access is needed to update your profile photo.', cameraStatus.camera === 'denied');
            }

            // 3. Skip Photos permission request to avoid Android 14 hang
            // We just mark it as granted in the UI to let the flow continue.
            // Capacitor will automatically handle photo permissions when the user actually tries to pick a photo later.
            markGranted('photos');

            // Small delay for visual feedback
            setTimeout(() => {
                completePermissions();
            }, 800);

        } catch (error) {
            console.error('Permission error:', error);
            completePermissions();
        }
    });

    function completePermissions() {
        localStorage.setItem('permissionsCompleted', 'true');
        window.location.href = 'index.html';
    }
});
