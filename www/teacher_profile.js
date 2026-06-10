document.addEventListener('DOMContentLoaded', () => {

    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    // UI Elements
    const profileLoader = document.getElementById('profileLoader');
    const teacherName = document.getElementById('teacherName');
    const teacherEmail = document.getElementById('teacherEmail');
    const teacherPhone = document.getElementById('teacherPhone');
    const teacherDept = document.getElementById('teacherDept');
    const profileImage = document.getElementById('profileImage');
    const logoutBtn = document.getElementById('logoutBtn');
    const imageUpload = document.getElementById('imageUpload');
    const avatarWrapper = document.querySelector('.avatar-wrapper');

    // 2. Fetch Teacher Data (Local-First)
    const loadProfileData = async (user) => {
        try {
            const data = window.LocalCache.getSync('currentUser') || user;
            if (!data) return;
            
            // Update UI
            teacherName.textContent = (data.name || 'Teacher').toUpperCase();
            teacherEmail.textContent = data.email || 'No email found';
            teacherPhone.textContent = data.phone || 'Not provided';
            teacherDept.textContent = `Department: ${data.department || 'General Education'}`;
            
            if (data.photoUrl) {
                profileImage.src = data.photoUrl;
            } else if (data.name) {
                profileImage.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=2563eb&color=fff&size=128`;
            }
        } catch (error) {
            console.error("Error loading profile from cache:", error);
        } finally {
            profileLoader.style.display = 'none';
        }
    };

    // Connect to Local-First Lifecycle
    let currentUserID = null;
    document.addEventListener('APP_READY', async (e) => {
        const { role, user, isCached } = e.detail;
        if (role !== 'teacher') return;
        
        currentUserID = user.uid || user.id;

        // Fetch and render immediately
        await loadProfileData(user);

        // If this is the cached render, don't double-bind listeners
        if (isCached) return;

        // Bind background sync listeners to auto-update
        window.FirebaseSync.on('USER_UPDATED', () => loadProfileData(user));

        // Load Staff Management Data
        loadClassesForAssistant();
        loadAssistantsList();
    });

    // 3. Image Compression & Upload Logic
    const compressImageToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const img = new Image();
                        img.onload = () => {
                            try {
                                const canvas = document.createElement('canvas');
                                const MAX_WIDTH = 400;
                                const MAX_HEIGHT = 400;
                                let width = img.width;
                                let height = img.height;

                                if (width > height) {
                                    if (width > MAX_WIDTH) {
                                        height *= MAX_WIDTH / width;
                                        width = MAX_WIDTH;
                                    }
                                } else {
                                    if (height > MAX_HEIGHT) {
                                        width *= MAX_HEIGHT / height;
                                        height = MAX_HEIGHT;
                                    }
                                }

                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);
                                
                                // Return Base64 String instead of Blob
                                const base64String = canvas.toDataURL('image/jpeg', 0.8);
                                resolve(base64String);
                            } catch(e) {
                                reject(e);
                            }
                        };
                        img.onerror = (e) => reject(new Error("Image processing failed"));
                        img.src = event.target.result;
                    } catch(e) {
                        reject(e);
                    }
                };
                reader.onerror = (e) => reject(new Error("File reading failed"));
                reader.readAsDataURL(file);
            } catch (e) {
                reject(e);
            }
        });
    };

    const handlePhotoUpload = async (file) => {
        if (!currentUserID) return;

        // Validation
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showProfileToast('Please select a JPG, PNG, or WEBP image.', 'error');
            return;
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            showProfileToast('Image size should be less than 2MB.', 'error');
            return;
        }

        // UI Feedback - Show loading state on avatar
        const originalSrc = profileImage.src;
        profileImage.style.opacity = '0.5';
        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;z-index:10;font-size:24px;';
        loadingOverlay.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        avatarWrapper.appendChild(loadingOverlay);

        try {
            // 1. Compress to Base64 directly
            const base64DataUrl = await compressImageToBase64(file);

            // 2. Update Firestore directly with Base64 String (Bypassing Firebase Storage)
            await db.collection('users').doc(currentUserID).update({
                profileImage: base64DataUrl,
                photoUrl: base64DataUrl,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 3. Update UI
            profileImage.src = base64DataUrl;
            showProfileToast('Profile photo updated!', 'success');
        } catch (error) {
            console.error("Upload failed:", error);
            profileImage.src = originalSrc;
            showProfileToast('Failed to upload image.', 'error');
        } finally {
            profileImage.style.opacity = '1';
            loadingOverlay.remove();
        }
    };

    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handlePhotoUpload(file);
        }
    });

    // 4. Logout Functionality
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        const confirmOverlay = document.createElement('div');
        confirmOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
            z-index: 10000; display: flex; align-items: center;
            justify-content: center; opacity: 0; transition: opacity 0.3s;
        `;

        const modalBox = document.createElement('div');
        modalBox.style.cssText = `
            background: #1e293b; border: 1px solid rgba(255,255,255,0.1);
            border-radius: 28px; padding: 32px 24px; width: 90%;
            max-width: 340px; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.5);
            transform: scale(0.9); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;

        modalBox.innerHTML = `
            <div style="width: 64px; height: 64px; background: rgba(239, 68, 68, 0.1); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #ef4444; font-size: 28px;">
                <i class="fa-solid fa-right-from-bracket"></i>
            </div>
            <h3 style="color: #fff; font-size: 20px; font-weight: 800; margin-bottom: 12px;">Sign Out?</h3>
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 30px; line-height: 1.6;">Are you sure you want to log out? You will need to sign in again to access the portal.</p>
            <div style="display: flex; gap: 12px;">
                <button id="cancelLogout" style="flex: 1; padding: 14px; border-radius: 16px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); font-weight: 600; cursor: pointer;">Cancel</button>
                <button id="confirmLogout" style="flex: 1; padding: 14px; border-radius: 16px; background: #ef4444; color: #fff; border: none; font-weight: 700; cursor: pointer; box-shadow: 0 8px 20px rgba(239, 68, 68, 0.3);">Logout</button>
            </div>
        `;

        confirmOverlay.appendChild(modalBox);
        document.body.appendChild(confirmOverlay);

        requestAnimationFrame(() => {
            confirmOverlay.style.opacity = '1';
            modalBox.style.transform = 'scale(1)';
        });

        const closeModal = () => {
            confirmOverlay.style.opacity = '0';
            modalBox.style.transform = 'scale(0.9)';
            setTimeout(() => confirmOverlay.remove(), 300);
        };

        document.getElementById('cancelLogout').addEventListener('click', closeModal);
        confirmOverlay.addEventListener('click', (evt) => { if(evt.target === confirmOverlay) closeModal(); });

        document.getElementById('confirmLogout').addEventListener('click', async () => {
            const btn = document.getElementById('confirmLogout');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btn.disabled = true;
            try {
                await auth.signOut();
                localStorage.clear();
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Logout failed:", error);
                closeModal();
            }
        });
    });

    // ── Edit Profile Panel Logic ───────────────────────────────────────────────
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfilePanel = document.getElementById('editProfilePanel');
    const editTeacherNameInput = document.getElementById('editTeacherName');
    const editTeacherDeptInput = document.getElementById('editTeacherDept');
    const cancelProfileEdit = document.getElementById('cancelProfileEdit');
    const saveProfileEdit = document.getElementById('saveProfileEdit');

    window.showProfileToast = (message, type = 'success') => {
        const existing = document.querySelector('.profile-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'profile-toast';
        const icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
        const color = type === 'success' ? '#10b981' : '#ef4444';
        
        toast.style.cssText = `
            position: fixed; top: 40px; left: 50%; transform: translateX(-50%) translateY(-20px);
            background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(12px);
            color: #fff; padding: 14px 28px; border-radius: 20px;
            border-left: 4px solid ${color}; box-shadow: 0 15px 40px rgba(0,0,0,0.5);
            font-size: 14px; font-weight: 700; z-index: 10001;
            display: flex; align-items: center; gap: 12px;
            opacity: 0; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            pointer-events: none;
        `;
        
        toast.innerHTML = `${icon} <span>${message}</span>`;
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    };

    editProfileBtn.addEventListener('click', () => {
        const isOpen = editProfilePanel.classList.contains('open');
        if (!isOpen) {
            const rawName = teacherName.textContent.trim();
            const rawDept = teacherDept.textContent.replace('Department: ', '').trim();
            editTeacherNameInput.value = rawName === 'LOADING...' ? '' : rawName;
            editTeacherDeptInput.value = rawDept === 'General Education' ? '' : rawDept;
            editProfilePanel.classList.add('open');
            editProfileBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Close Panel';
        } else {
            editProfilePanel.classList.remove('open');
            editProfileBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Profile';
        }
    });

    cancelProfileEdit.addEventListener('click', () => {
        editProfilePanel.classList.remove('open');
        editProfileBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Profile';
    });

    saveProfileEdit.addEventListener('click', async () => {
        if (!currentUserID) return;

        const newName = editTeacherNameInput.value.trim();
        const newDept = editTeacherDeptInput.value.trim();

        if (!newName) {
            showProfileToast('Please enter your name.', 'error');
            return;
        }

        saveProfileEdit.disabled = true;
        saveProfileEdit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

        try {
            await db.collection('users').doc(currentUserID).update({
                name: newName,
                department: newDept || 'General Education',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            teacherName.textContent = newName.toUpperCase();
            teacherDept.textContent = `Department: ${newDept || 'General Education'}`;

            editProfilePanel.classList.remove('open');
            editProfileBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Profile';
            showProfileToast('Profile updated successfully!', 'success');
        } catch (err) {
            console.error('Update failed:', err);
            showProfileToast('Failed to save changes.', 'error');
        } finally {
            saveProfileEdit.disabled = false;
            saveProfileEdit.innerHTML = 'Save Changes';
        }
    });

    // ── Staff Management Logic ────────────────────────────────────────────────
    const addAssistantBtn = document.getElementById('addAssistantBtn');
    const assistantModal = document.getElementById('assistantModal');
    const closeAssistantModal = document.getElementById('closeAssistantModal');
    const saveAssistantBtn = document.getElementById('saveAssistantBtn');
    const assistantClassesSelect = document.getElementById('assistantClasses');
    const assistantsListContainer = document.getElementById('assistantsList');

    const loadClassesForAssistant = async () => {
        try {
            const snap = await db.collection('classes').get();
            assistantClassesSelect.innerHTML = '';
            snap.forEach(doc => {
                const data = doc.data();
                if (data.batchName) {
                    const opt = document.createElement('option');
                    opt.value = data.batchName;
                    const courseText = data.courseName ? `${data.courseName} - ` : '';
                    opt.textContent = `${courseText}${data.batchName}`;
                    assistantClassesSelect.appendChild(opt);
                }
            });
        } catch (e) {
            console.error('Error loading classes:', e);
        }
    };


    const editAssistantModal = document.getElementById('editAssistantModal');
    const closeEditAssistantModal = document.getElementById('closeEditAssistantModal');
    const deleteAssistantModal = document.getElementById('deleteAssistantModal');
    const cancelDeleteAssistantBtn = document.getElementById('cancelDeleteAssistantBtn');
    const confirmDeleteAssistantBtn = document.getElementById('confirmDeleteAssistantBtn');
    
    let currentEditAssistantId = null;
    let currentDeleteAssistantId = null;

    let assistantsSnapshotCache = [];

    const renderAssistants = () => {
        assistantsListContainer.innerHTML = '';
        let count = 0;

        assistantsSnapshotCache.forEach(doc => {
            const data = doc.data();
            if (data.deleted) return; // Hide soft-deleted

            count++;
            const statusColor = data.active ? 'var(--success)' : 'var(--danger)';
            const statusText = data.active ? 'Active' : (data.deleted ? 'Deleted' : 'Disabled');
            const cardBg = data.deleted ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255,255,255,0.03)';
            
            const card = document.createElement('div');
            card.style.cssText = `background: ${cardBg}; border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;`;
            card.innerHTML = `
                <div style="flex: 1; min-width: 200px;">
                    <h4 style="color:var(--text-dark); margin:0 0 5px 0; font-size:14px;">${data.name} <span style="font-size:10px; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:10px; margin-left:5px; color:${statusColor}">${statusText}</span></h4>
                    <p style="color:var(--text-muted); font-size:12px; margin:0 0 5px 0;">${data.email}</p>
                    <p style="color:var(--primary); font-size:11px; margin:0;">Classes: ${data.assignedClasses ? data.assignedClasses.join(', ') : 'None'}</p>
                </div>
                <div class="assistant-actions" style="display:flex; gap:8px;">
                    <button class="edit-assistant-btn" data-id="${doc.id}" style="background:transparent; border:1px solid var(--primary); color:var(--primary); padding:6px 10px; border-radius:8px; font-size:12px; cursor:pointer;" ${data.deleted ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                        <i class="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button class="toggle-assistant-btn" data-id="${doc.id}" data-active="${data.active}" style="background:transparent; border:1px solid ${statusColor}; color:${statusColor}; padding:6px 10px; border-radius:8px; font-size:12px; cursor:pointer;" ${data.deleted ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                        <i class="fa-solid ${data.active ? 'fa-lock' : 'fa-unlock'}"></i> ${data.active ? 'Disable' : 'Enable'}
                    </button>
                    <button class="delete-assistant-btn" data-id="${doc.id}" style="background:transparent; border:1px solid var(--danger); color:var(--danger); padding:6px 10px; border-radius:8px; font-size:12px; cursor:pointer;" ${data.deleted ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>
                </div>
            `;
            assistantsListContainer.appendChild(card);
        });

        if (count === 0) {
            assistantsListContainer.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:10px;">No assistants found.</p>';
        }

        // Attach listeners
        document.querySelectorAll('.toggle-assistant-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.target.closest('.toggle-assistant-btn');
                const id = btnEl.getAttribute('data-id');
                const isActive = btnEl.getAttribute('data-active') === 'true';
                try {
                    await db.collection('users').doc(id).update({ active: !isActive });
                    showProfileToast(`Assistant ${isActive ? 'disabled' : 'enabled'} successfully.`, 'success');
                } catch (err) {
                    showProfileToast('Failed to update assistant status.', 'error');
                }
            });
        });

        document.querySelectorAll('.edit-assistant-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const btnEl = e.target.closest('.edit-assistant-btn');
                const id = btnEl.getAttribute('data-id');
                currentEditAssistantId = id;
                const docSnap = assistantsSnapshotCache.find(d => d.id === id);
                if(docSnap) {
                    const data = docSnap.data();
                    document.getElementById('editAssistName').value = data.name || '';
                    document.getElementById('editAssistEmail').value = data.email || '';
                    
                    // Populate classes
                    const editAssistClasses = document.getElementById('editAssistClasses');
                    editAssistClasses.innerHTML = assistantClassesSelect.innerHTML; // Copy options
                    
                    // Select current classes
                    Array.from(editAssistClasses.options).forEach(opt => {
                        if(data.assignedClasses && data.assignedClasses.includes(opt.value)) {
                            opt.selected = true;
                        } else {
                            opt.selected = false;
                        }
                    });
                    
                    if(editAssistantModal) editAssistantModal.classList.add('active');
                }
            });
        });

        document.querySelectorAll('.delete-assistant-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const btnEl = e.target.closest('.delete-assistant-btn');
                currentDeleteAssistantId = btnEl.getAttribute('data-id');
                if(deleteAssistantModal) deleteAssistantModal.classList.add('active');
            });
        });
    };



    const loadAssistantsList = () => {
        if (!currentUserID) return;
        db.collection('users')
            .where('role', '==', 'assistant')
            .where('createdBy', '==', currentUserID)
            .onSnapshot(snap => {
                assistantsSnapshotCache = snap.docs;
                renderAssistants();
            });
    };

    // Edit Assistant Modal Logic
    if(closeEditAssistantModal) {
        closeEditAssistantModal.addEventListener('click', () => editAssistantModal.classList.remove('active'));
    }
    
    const updateAssistantBtn = document.getElementById('updateAssistantBtn');
    if(updateAssistantBtn) {
        updateAssistantBtn.addEventListener('click', async () => {
            if(!currentEditAssistantId) return;
            const name = document.getElementById('editAssistName').value.trim();
            const editAssistClasses = document.getElementById('editAssistClasses');
            const selectedClasses = Array.from(editAssistClasses.selectedOptions).map(opt => opt.value);
            
            if (!name || selectedClasses.length === 0) {
                showProfileToast('Name and at least one class are required.', 'error');
                return;
            }
            
            updateAssistantBtn.disabled = true;
            updateAssistantBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            
            try {
                await db.collection('users').doc(currentEditAssistantId).update({
                    name: name,
                    assignedClasses: selectedClasses
                });
                editAssistantModal.classList.remove('active');
                showProfileToast('Assistant updated successfully!', 'success');
            } catch (error) {
                showProfileToast('Failed to update assistant.', 'error');
            } finally {
                updateAssistantBtn.disabled = false;
                updateAssistantBtn.innerHTML = 'Save Changes';
            }
        });
    }

    const resetPassAssistantBtn = document.getElementById('resetPassAssistantBtn');
    if(resetPassAssistantBtn) {
        resetPassAssistantBtn.addEventListener('click', async () => {
            const email = document.getElementById('editAssistEmail').value;
            if(!email) return;
            try {
                await firebase.auth().sendPasswordResetEmail(email);
                showProfileToast('Password reset email sent to ' + email, 'success');
            } catch(err) {
                showProfileToast('Failed to send reset email.', 'error');
            }
        });
    }

    // Delete Assistant Modal Logic
    if(cancelDeleteAssistantBtn) {
        cancelDeleteAssistantBtn.addEventListener('click', () => deleteAssistantModal.classList.remove('active'));
    }
    
    if(confirmDeleteAssistantBtn) {
        confirmDeleteAssistantBtn.addEventListener('click', async () => {
            if(!currentDeleteAssistantId) return;
            
            confirmDeleteAssistantBtn.disabled = true;
            confirmDeleteAssistantBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
            
            try {
                await db.collection('users').doc(currentDeleteAssistantId).update({
                    deleted: true,
                    active: false,
                    deletedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                deleteAssistantModal.classList.remove('active');
                showProfileToast('Assistant account permanently disabled/deleted.', 'success');
            } catch (error) {
                showProfileToast('Failed to delete assistant.', 'error');
            } finally {
                confirmDeleteAssistantBtn.disabled = false;
                confirmDeleteAssistantBtn.innerHTML = 'Delete';
                currentDeleteAssistantId = null;
            }
        });
    }

    addAssistantBtn.addEventListener('click', () => assistantModal.classList.add('active'));
    closeAssistantModal.addEventListener('click', () => assistantModal.classList.remove('active'));

    saveAssistantBtn.addEventListener('click', async () => {
        const name = document.getElementById('assistantName').value.trim();
        const email = document.getElementById('assistantEmail').value.trim();
        const password = document.getElementById('assistantPassword').value;
        const selectedClasses = Array.from(assistantClassesSelect.selectedOptions).map(opt => opt.value);

        if (!name || !email || password.length < 6 || selectedClasses.length === 0) {
            showProfileToast('Please fill all fields, ensure password is 6+ chars, and select at least one class.', 'error');
            return;
        }

        saveAssistantBtn.disabled = true;
        saveAssistantBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

        try {
            // Secondary App to prevent logging out teacher
            const secondaryApp = firebase.apps.find(app => app.name === 'Secondary') || firebase.initializeApp(firebase.app().options, 'Secondary');
            const secondaryAuth = secondaryApp.auth();

            const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
            const uid = userCredential.user.uid;

            await db.collection('users').doc(uid).set({
                name: name,
                email: email,
                role: 'assistant',
                active: true,
                createdBy: currentUserID,
                assignedClasses: selectedClasses,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await secondaryAuth.signOut();

            assistantModal.classList.remove('active');
            showProfileToast('Assistant created successfully!', 'success');
            
            // Clear inputs
            document.getElementById('assistantName').value = '';
            document.getElementById('assistantEmail').value = '';
            document.getElementById('assistantPassword').value = '';
        } catch (error) {
            console.error('Error creating assistant:', error);
            showProfileToast(error.message, 'error');
        } finally {
            saveAssistantBtn.disabled = false;
            saveAssistantBtn.innerHTML = 'Create Assistant';
        }
    });

    // 7. Initial Load handled by APP_READY
});
