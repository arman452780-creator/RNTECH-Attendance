// student_profile.js - Instant Offline-First Profile Page
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const profileImgContainer = document.getElementById('profileImgContainer');
    const profileDisplayName = document.getElementById('profileDisplayName');
    const profileEmail = document.getElementById('profileEmail');
    const profileStudentID = document.getElementById('profileStudentID');

    const anaAttendance = document.getElementById('anaAttendance');
    const anaClasses = document.getElementById('anaClasses');
    const anaSubject = document.getElementById('anaSubject');

    const infoCourse = document.getElementById('infoCourse');
    const infoBatch = document.getElementById('infoBatch');
    const infoSubject = document.getElementById('infoSubject');
    const infoPhone = document.getElementById('infoPhone');
    const infoBio = document.getElementById('infoBio');

    const recentActivityList = document.getElementById('recentActivityList');

    const editProfileModal = document.getElementById('editProfileModal');
    const openEditModalBtn = document.getElementById('openEditModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');

    const editAvatarPreview = document.getElementById('editAvatarPreview');
    const photoInput = document.getElementById('photoInput');
    const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
    const deletePhotoBtn = document.getElementById('deletePhotoBtn');

    const editName = document.getElementById('editName');
    const editPhone = document.getElementById('editPhone');
    const editBio = document.getElementById('editBio');
    const editPass = document.getElementById('editPass');

    let studentUID = "";
    let selectedFile = null;
    let currentPhotoUrl = "";
    let initialRenderDone = false;

    // ─── INSTANT RENDER FROM CACHE ────────────────────────────────
    document.addEventListener('APP_READY', async (e) => {
        const { role, isCached } = e.detail;
        if (role !== 'student') return;

        if (!initialRenderDone) {
            await renderFromCache();
            initialRenderDone = true;
        }

        if (isCached) return; // Already fresh — skip re-subscribing

        // Only re-render when something actually changes
        window.FirebaseSync.on('PROFILE_UPDATED', renderFromCache);
        window.FirebaseSync.on('ATTENDANCE_UPDATED', renderAttendanceFromCache);
    });

    async function renderFromCache() {
        const userData = window.LocalCache.getSync('currentUser');
        if (!userData) return;
        studentUID = userData.uid || userData.id || "";

        renderProfileData(userData);
        populateEditModal(userData);
        await renderAttendanceFromCache();
    }

    async function renderAttendanceFromCache() {
        if (!studentUID) return;
        const records = await window.LocalCache.getByIndex('attendanceRecords', 'studentID', studentUID);
        const sorted = records.sort((a, b) => {
            const dA = a._ts || (a.timestamp ? new Date(a.timestamp).getTime() : new Date(a.date || 0).getTime());
            const dB = b._ts || (b.timestamp ? new Date(b.timestamp).getTime() : new Date(b.date || 0).getTime());
            return dB - dA;
        });
        calculateAttendance(sorted);
        renderActivity(sorted);
    }

    function renderProfileData(data) {
        if (profileDisplayName) profileDisplayName.textContent = (data.name || "Student").toUpperCase();
        if (profileEmail) profileEmail.textContent = data.email || "No Email";
        if (profileStudentID) profileStudentID.textContent = `ID: ${(data.id || data.uid || '').substring(0, 10).toUpperCase() || "RN-NEW"}`;

        const createBadge = (text, bg, color) => `<span style="display: inline-block; padding: 4px 10px; margin: 2px 4px 2px 0; border-radius: 6px; font-size: 11px; font-weight: 600; background: ${bg}; color: ${color}; border: 1px solid ${color}40; letter-spacing: 0.5px;">${text.toUpperCase()}</span>`;

        if (infoCourse) {
            let courses = Array.isArray(data.courses) && data.courses.length > 0 ? data.courses : [data.course1 || data.course, data.course2, data.course3];
            courses = courses.filter(Boolean).map(c => c.trim()).filter(Boolean);
            infoCourse.innerHTML = courses.length > 0 ? courses.map(c => createBadge(c, 'rgba(139, 92, 246, 0.1)', '#a78bfa')).join('') : "N/A";
        }

        if (infoBatch) {
            let batches = Array.isArray(data.batches) && data.batches.length > 0 ? data.batches : [data.batch1 || data.batchName || data.batch, data.batch2, data.batch3];
            batches = batches.filter(Boolean).map(b => b.trim()).filter(Boolean);
            infoBatch.innerHTML = batches.length > 0 ? batches.map(b => createBadge(b, 'rgba(236, 72, 153, 0.1)', '#f472b6')).join('') : "N/A";
        }

        if (infoSubject) {
            let currentSubjects = Array.isArray(data.subjects) && data.subjects.length > 0 ? data.subjects : [data.subject1 || data.subjectName || data.subject, data.subject2, data.subject3];
            currentSubjects = currentSubjects.filter(Boolean).map(s => s.trim()).filter(Boolean);
            let history = (data.subjectHistory || []).map(s => s.trim()).filter(Boolean);
            let allSubjects = [...new Set([...currentSubjects, ...history])];
            infoSubject.innerHTML = allSubjects.length > 0 ? allSubjects.map(s => createBadge(s, 'rgba(14, 165, 233, 0.1)', '#38bdf8')).join('') : "N/A";
        }
        if (infoPhone) infoPhone.textContent = data.phone || "Not Linked";
        if (infoBio) infoBio.textContent = data.bio || "Success is the goal.";

        // Profile Image
        currentPhotoUrl = data.profileImage || data.photoUrl || "";
        if (profileImgContainer) {
            if (currentPhotoUrl) {
                profileImgContainer.innerHTML = `<img src="${currentPhotoUrl}" class="profile-img" alt="Profile">`;
            } else {
                const initials = data.name ? data.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'ST';
                profileImgContainer.innerHTML = `<div style="font-size: 32px; font-weight: 800; color: var(--accent-color);">${initials}</div>`;
            }
        }
    }

    function calculateAttendance(records) {
        const total = records.length;
        const present = records.filter(r => r.attendanceStatus === 'present' || r.attendanceStatus === 'late').length;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        animateNumber(anaAttendance, pct, '%');
        animateNumber(anaClasses, total);
        if (anaAttendance) anaAttendance.style.color = pct < 60 ? "#ef4444" : (pct < 85 ? "#f59e0b" : "#10b981");
    }

    function renderActivity(records) {
        if (!recentActivityList) return;
        recentActivityList.innerHTML = '';
        const latest = records.slice(0, 5);
        if (latest.length === 0) {
            recentActivityList.innerHTML = '<p class="activity-text" style="color: var(--text-muted); opacity: 0.6; padding: 10px 0;">No history found yet.</p>';
            return;
        }
        latest.forEach(rec => {
            const date = rec._ts ? new Date(rec._ts) : (rec.timestamp ? new Date(rec.timestamp) : new Date(rec.date || 0));
            const status = (rec.attendanceStatus || 'absent').toUpperCase();
            const sub = (rec.subjectName || rec.subject || "Class").toUpperCase();
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <div class="activity-content">
                    <p class="activity-text">Attendance marked <b>${status}</b> for ${sub}</p>
                    <span class="activity-time">${formatRelativeTime(date)}</span>
                </div>
            `;
            recentActivityList.appendChild(item);
        });
    }

    // ─── MODAL HANDLING ───────────────────────────────────────────
    const bottomNav = document.querySelector('.bottom-nav');

    if (openEditModalBtn) {
        openEditModalBtn.onclick = () => {
            editProfileModal.classList.add('active');
            if (bottomNav) bottomNav.style.display = 'none';
            document.body.style.overflow = 'hidden';
        };
    }
    if (closeModalBtn) {
        closeModalBtn.onclick = () => {
            editProfileModal.classList.remove('active');
            if (bottomNav) bottomNav.style.display = 'flex';
            document.body.style.overflow = 'auto';
        };
    }

    function populateEditModal(data) {
        if (editName) editName.value = data.name || '';
        if (editPhone) editPhone.value = data.phone || '';
        if (editBio) editBio.value = data.bio || '';
        if (editAvatarPreview) {
            editAvatarPreview.innerHTML = currentPhotoUrl
                ? `<img src="${currentPhotoUrl}" alt="Preview">`
                : `<i class="fa-solid fa-user" style="font-size: 30px; color: var(--text-muted);"></i>`;
        }
    }

    // ─── IMAGE UPLOAD ─────────────────────────────────────────────
    if (uploadPhotoBtn) uploadPhotoBtn.onclick = () => photoInput && photoInput.click();

    if (photoInput) {
        photoInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 10 * 1024 * 1024) return RNPopups.error("Image must be under 10MB");
                selectedFile = file;
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (editAvatarPreview) editAvatarPreview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
                };
                reader.readAsDataURL(file);
            }
        };
    }

    if (deletePhotoBtn) {
        deletePhotoBtn.onclick = () => {
            if (!currentPhotoUrl && !selectedFile) return;
            RNPopups.confirm("Remove Photo", "Are you sure you want to remove your profile photo?",
                async () => {
                    setLoading(deletePhotoBtn, true, '<i class="fa-solid fa-spinner fa-spin"></i>');
                    try {
                        if (currentPhotoUrl && currentPhotoUrl.includes('firebasestorage')) {
                            const photoRef = storage.refFromURL(currentPhotoUrl);
                            await photoRef.delete().catch(e => console.warn("Storage delete failed:", e));
                        }
                        await db.collection('users').doc(studentUID).update({
                            profileImage: "", photoUrl: "",
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        selectedFile = null;
                        currentPhotoUrl = "";
                        if (editAvatarPreview) editAvatarPreview.innerHTML = `<i class="fa-solid fa-user" style="font-size: 30px; color: var(--text-muted);"></i>`;
                        RNPopups.toast("Photo removed", "success");
                    } catch (err) {
                        RNPopups.error("Failed to delete photo: " + err.message);
                    } finally {
                        setLoading(deletePhotoBtn, false, '<i class="fa-solid fa-trash-can"></i> Delete');
                    }
                },
                () => {}, "Remove", "danger"
            );
        };
    }

    // ─── SAVE PROFILE ─────────────────────────────────────────────
    if (saveProfileBtn) {
        saveProfileBtn.onclick = async () => {
            const name = editName.value.trim();
            const phone = editPhone.value.trim();
            const bio = editBio.value.trim();
            const pass = editPass.value.trim();
            if (!name) return RNPopups.warning("Please enter your name");
            setLoading(saveProfileBtn, true, '<i class="fa-solid fa-spinner fa-spin"></i> Saving...');
            const withTimeout = (promise, ms, msg) => Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms))
            ]);

            try {
                if (!studentUID) throw new Error("Student ID is missing. Please re-login.");
                let photoUrl = currentPhotoUrl;
                if (selectedFile) {
                    const compressImageToBase64 = (f) => {
                        return new Promise((resolve, reject) => {
                            try {
                                const r = new FileReader();
                                r.onload = (ev) => {
                                    const img = new Image();
                                    img.onload = () => {
                                        try {
                                            const cvs = document.createElement('canvas');
                                            const MAX = 400;
                                            let w = img.width;
                                            let h = img.height;
                                            if (w > h) {
                                                if (w > MAX) { h *= MAX / w; w = MAX; }
                                            } else {
                                                if (h > MAX) { w *= MAX / h; h = MAX; }
                                            }
                                            cvs.width = w; cvs.height = h;
                                            const ctx = cvs.getContext('2d');
                                            ctx.drawImage(img, 0, 0, w, h);
                                            // Return Base64 string instead of Blob!
                                            const base64String = cvs.toDataURL('image/jpeg', 0.8);
                                            resolve(base64String);
                                        } catch (e) {
                                            reject(e);
                                        }
                                    };
                                    img.onerror = (e) => reject(new Error("Image processing failed"));
                                    img.src = ev.target.result;
                                };
                                r.onerror = (e) => reject(new Error("File reading failed"));
                                r.readAsDataURL(f);
                            } catch (e) {
                                reject(e);
                            }
                        });
                    };
                    
                    // Assign the Base64 string directly to photoUrl!
                    photoUrl = await withTimeout(compressImageToBase64(selectedFile), 10000, "Image compression timed out. Please try a different or smaller photo.");
                }
                await withTimeout(db.collection('users').doc(studentUID).update({
                    name, phone, bio,
                    profileImage: photoUrl, photoUrl,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }), 15000, "Database update timed out.");

                if (pass) {
                    if (pass.length < 6) throw new Error("Password must be at least 6 characters");
                    await withTimeout(firebase.auth().currentUser.updatePassword(pass), 15000, "Password update timed out.");
                }
                // Update local cache immediately for instant reflect
                const cached = window.LocalCache.getSync('currentUser') || {};
                const newData = { ...cached, name, phone, bio, profileImage: photoUrl, photoUrl };
                window.LocalCache.setSync('currentUser', newData);
                if (typeof renderProfileData === 'function') renderProfileData(newData);
                RNPopups.success("Profile updated perfectly.");
                editProfileModal.classList.remove('active');
                if (bottomNav) bottomNav.style.display = 'flex';
                document.body.style.overflow = 'auto';
                selectedFile = null;
            } catch (err) {
                RNPopups.error("Update failed: " + err.message);
            } finally {
                setLoading(saveProfileBtn, false, '<i class="fa-solid fa-circle-check"></i> Save Changes');
            }
        };
    }

    // ─── NOTIFICATIONS TOGGLE ─────────────────────────────────────
    const notifCheckbox = document.getElementById('notifCheckbox');
    const notifToggleCard = document.getElementById('notifToggleCard');
    if (notifCheckbox && notifToggleCard) {
        const savedNotif = localStorage.getItem('rn-notif-enabled');
        if (savedNotif !== null) notifCheckbox.checked = savedNotif === 'true';
        notifToggleCard.onclick = () => {
            notifCheckbox.checked = !notifCheckbox.checked;
            localStorage.setItem('rn-notif-enabled', notifCheckbox.checked);
            if (window.RNPopups) RNPopups.toast(notifCheckbox.checked ? "Notifications Enabled" : "Notifications Disabled");
        };
    }

    // ─── LOGOUT ───────────────────────────────────────────────────
    const triggerLogout = () => {
        const confirmOverlay = document.createElement('div');
        confirmOverlay.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(5px);z-index:10000;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;`;
        const modalBox = document.createElement('div');
        modalBox.style.cssText = `background:#0f172a;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px;width:90%;max-width:320px;text-align:center;box-shadow:0 15px 40px rgba(0,0,0,0.5);transform:scale(0.9);transition:transform 0.2s cubic-bezier(0.4,0,0.2,1);`;
        modalBox.innerHTML = `
            <div style="font-size:40px;color:#ef4444;margin-bottom:15px;"><i class="fa-solid fa-arrow-right-from-bracket"></i></div>
            <h3 style="color:#fff;font-size:18px;margin-bottom:10px;">Sign Out</h3>
            <p style="color:#94a3b8;font-size:14px;margin-bottom:24px;line-height:1.5;">Are you sure you want to log out of your account?</p>
            <div style="display:flex;gap:12px;">
                <button id="cancelLogout" style="flex:1;padding:12px;border-radius:12px;background:rgba(255,255,255,0.1);color:#fff;border:none;font-weight:600;cursor:pointer;">Cancel</button>
                <button id="confirmLogout" style="flex:1;padding:12px;border-radius:12px;background:#ef4444;color:#fff;border:none;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(239,68,68,0.3);">Logout</button>
            </div>`;
        confirmOverlay.appendChild(modalBox);
        document.body.appendChild(confirmOverlay);
        requestAnimationFrame(() => { confirmOverlay.style.opacity = '1'; modalBox.style.transform = 'scale(1)'; });
        const closeModal = () => { confirmOverlay.style.opacity = '0'; modalBox.style.transform = 'scale(0.9)'; setTimeout(() => confirmOverlay.remove(), 200); };
        document.getElementById('cancelLogout').addEventListener('click', closeModal);
        confirmOverlay.addEventListener('click', evt => { if (evt.target === confirmOverlay) closeModal(); });
        document.getElementById('confirmLogout').addEventListener('click', async () => {
            const btn = document.getElementById('confirmLogout');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btn.disabled = true;
            try {
                await firebase.auth().signOut();
                localStorage.clear();
                window.location.replace('index.html');
            } catch (error) {
                closeModal();
                if (window.RNPopups) RNPopups.error("Logout failed. Please try again.");
                else alert("Logout failed. Please try again.");
            }
        });
    };

    const logoutTop = document.getElementById('logoutBtnTop');
    const logoutMain = document.getElementById('logoutBtnMain');
    if (logoutTop) logoutTop.onclick = triggerLogout;
    if (logoutMain) logoutMain.onclick = triggerLogout;

    // ─── HELPERS ──────────────────────────────────────────────────
    function setLoading(btn, isLoading, text) {
        btn.disabled = isLoading;
        btn.innerHTML = text;
        btn.style.opacity = isLoading ? "0.7" : "1";
    }

    function animateNumber(el, target, suffix = '') {
        if (!el) return;
        const current = parseInt(el.textContent) || 0;
        const duration = 600;
        const startTime = performance.now();
        function update(currentTime) {
            const progress = Math.min((currentTime - startTime) / duration, 1);
            el.textContent = Math.floor(progress * (target - current) + current) + suffix;
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    function formatRelativeTime(date) {
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    }
});
