document.addEventListener('DOMContentLoaded', async () => {
    const displayStudentName = document.getElementById('displayStudentName');
    const displayStudentCourse = document.getElementById('displayStudentCourse');
    const studentHeader = document.getElementById('studentHeader');
    const historyTimeline = document.getElementById('historyTimeline');

    // Delete Modal Elements
    const deleteHistoryModal = document.getElementById('deleteHistoryModal');
    const deletePasswordInput = document.getElementById('deletePasswordInput');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const resetHistoryBtn = document.getElementById('resetHistoryBtn');
    
    let targetDeleteDate = null;
    let targetDeleteElement = null;
    let currentUser = null;

    // Monitor Auth State
    firebase.auth().onAuthStateChanged((user) => {
        currentUser = user;
    });

    // Get Student ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');

    if (!studentId) {
        alert("Student ID missing!");
        window.location.href = 'fee_management.html';
        return;
    }

    const loadHistoryData = async () => {
        try {
            const student = await window.LocalCache.getItem('students', studentId);
            if (!student) {
                alert("Student not found in local cache.");
                window.location.href = 'fee_management.html';
                return;
            }

            // Populate Display Info
            displayStudentName.textContent = student.name || 'Unknown Student';
            
            const c1 = student.course1 || student.course || '';
            const c2 = student.course2 || '';
            const courseArr = [c1, c2].filter(Boolean).map(c => c.toUpperCase());
            displayStudentCourse.textContent = courseArr.length > 0 ? courseArr.join(' | ') : 'No Course';

            const photoUrl = student.profileImage || student.photoUrl || '';
            const isLegacyAvatar = photoUrl.includes('pravatar.cc');
            if (photoUrl && !isLegacyAvatar) {
                studentHeader.innerHTML = `
                    <div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden;">
                        <img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Profile">
                    </div>
                    <div>
                        <h2>${displayStudentName.textContent}</h2>
                        <p>${displayStudentCourse.textContent}</p>
                    </div>
                `;
            }

            // Render History
            historyTimeline.innerHTML = '';
            
            const historyRaw = (student.feeDetails && student.feeDetails.paymentHistory) || [];
            
            // STRICT DUPLICATE PREVENTION
            const uniqueHistoryMap = new Map();
            historyRaw.forEach(entry => {
                if (!entry) return;
                const mLabel = entry.monthLabel || '';
                const tStamp = entry.date || '';
                const pId = entry.paymentId || '';
                const uniqueKey = pId ? pId : `${mLabel}_${tStamp}`;
                uniqueHistoryMap.set(uniqueKey, entry);
            });
            
            const history = Array.from(uniqueHistoryMap.values());
            
            if (history.length === 0) {
                historyTimeline.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                        <i class="fa-solid fa-clock-rotate-left" style="font-size: 32px; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p>No fee history recorded yet.</p>
                    </div>
                `;
                return;
            }

            // Sort history by date descending
            const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

            sortedHistory.forEach(entry => {
                const item = document.createElement('div');
                const isPayment = entry.type === 'Payment' || entry.status === 'Paid';
                const isExtension = entry.type === 'Extension';
                
                item.className = `timeline-item ${isPayment ? 'payment' : (isExtension ? 'extension' : '')}`;
                
                const dateObj = new Date(entry.date);
                const dateFormatted = isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                item.innerHTML = `
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <div class="timeline-title">${entry.monthLabel || entry.type || 'Update'}</div>
                                <div class="timeline-date">${dateFormatted}</div>
                            </div>
                            <button class="btn-delete-history" style="background: transparent; border: none; color: var(--danger); font-size: 14px; cursor: pointer; padding: 4px; opacity: 0.7; transition: opacity 0.2s;" title="Delete History">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                            <div class="timeline-desc">${entry.status || 'Recorded'}</div>
                            ${entry.amount ? `<div class="timeline-amount">₹${entry.amount}</div>` : ''}
                        </div>
                        ${entry.lateDays && entry.lateDays > 0 ? `<div class="timeline-desc" style="color: var(--danger); font-size: 11px; font-weight: 600; margin-top: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> Paid ${entry.lateDays} days late</div>` : ''}
                        ${entry.remarks ? `<div class="timeline-desc" style="font-style: italic; margin-top: 8px;">"${entry.remarks}"</div>` : ''}
                    </div>
                `;
                
                const deleteBtn = item.querySelector('.btn-delete-history');
                deleteBtn.addEventListener('click', () => {
                    targetDeleteDate = entry.date;
                    targetDeleteElement = item;
                    deleteHistoryModal.classList.add('active');
                    deletePasswordInput.value = '';
                    deletePasswordInput.focus();
                });
                
                historyTimeline.appendChild(item);
            });

        } catch (error) {
            console.error("Error loading history:", error);
            historyTimeline.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--danger);">
                    Error loading fee history.
                </div>
            `;
        }
    };

    // Modal Events
    if (resetHistoryBtn) {
        resetHistoryBtn.addEventListener('click', () => {
            targetDeleteDate = 'ALL';
            targetDeleteElement = historyTimeline;
            document.querySelector('#deleteHistoryModal h3').textContent = 'Reset All Fee History';
            document.querySelector('#deleteHistoryModal p').textContent = 'Enter Admin Password to permanently delete ALL payment records and reset the fee cycle for this student.';
            deleteHistoryModal.classList.add('active');
            deletePasswordInput.value = '';
            deletePasswordInput.focus();
        });
    }

    cancelDeleteBtn.addEventListener('click', () => {
        deleteHistoryModal.classList.remove('active');
        deletePasswordInput.value = '';
        document.querySelector('#deleteHistoryModal h3').textContent = 'Delete History Entry';
        document.querySelector('#deleteHistoryModal p').textContent = 'Enter Admin Password to permanently delete this payment record.';
    });

    confirmDeleteBtn.addEventListener('click', async () => {
        const password = deletePasswordInput.value.trim();
        if (!password) {
            deletePasswordInput.classList.add('error');
            setTimeout(() => deletePasswordInput.classList.remove('error'), 800);
            return;
        }

        if (!currentUser || !currentUser.email) {
            console.error("Auth Error: No authenticated user found.");
            alert("Authentication session expired. Please refresh the page.");
            return;
        }

        const originalBtnText = confirmDeleteBtn.innerHTML;
        confirmDeleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        confirmDeleteBtn.disabled = true;

        // ── Helper: show input shake + placeholder error ──
        const showInputError = (msg) => {
            deletePasswordInput.classList.add('error');
            deletePasswordInput.value = '';
            deletePasswordInput.placeholder = msg;
            setTimeout(() => {
                deletePasswordInput.classList.remove('error');
                deletePasswordInput.placeholder = 'Admin Password';
            }, 2000);
        };

        // ── Helper: show RN-TECH toast ──
        const showToast = (message, type = 'success') => {
            const t = document.createElement('div');
            t.className = `rn-toast ${type}`;
            const icon = type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation';
            t.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;
            document.body.appendChild(t);
            setTimeout(() => t.classList.add('show'), 10);
            setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
        };

        try {
            // ── DEBUG: Log auth state before reauthentication ──
            console.log('[FeeHistory] Auth user email:', currentUser.email);
            console.log('[FeeHistory] Starting reauthentication...');

            const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
            await currentUser.reauthenticateWithCredential(credential);

            console.log('[FeeHistory] Reauthentication SUCCESS for:', currentUser.email);

            const student = await window.LocalCache.getItem('students', studentId);
            if (!student || !student.feeDetails || !student.feeDetails.paymentHistory) {
                throw new Error("StudentDataMissing");
            }

            if (targetDeleteDate === 'ALL') {
                student.feeDetails.paymentHistory = [];
                student.feeDetails.paidMonths = 0;
                student.feeDetails.isLocked = false;
                
                let currentDue = new Date();
                if (student.feeDetails.joiningDate) {
                    currentDue = new Date(student.feeDetails.joiningDate);
                    const extensionDays = parseInt(student.feeDetails.extensionDays) || 0;
                    if (extensionDays > 0) currentDue.setDate(currentDue.getDate() + extensionDays);
                    currentDue.setHours(0,0,0,0);
                }
                student.feeDetails.nextDueDate = currentDue.toISOString();

            } else {
                // Identify deleted entry to roll back fee status
                const deletedEntry = student.feeDetails.paymentHistory.find(entry => entry.date === targetDeleteDate);

                // Filter out the deleted record
                const updatedHistory = student.feeDetails.paymentHistory.filter(
                    entry => entry.date !== targetDeleteDate
                );
                student.feeDetails.paymentHistory = updatedHistory;

                // Rollback Logic
                let newPaidMonths = parseInt(student.feeDetails.paidMonths) || 0;
                const isPayment = deletedEntry && (deletedEntry.type === 'Payment' || deletedEntry.status === 'Paid');
                if (isPayment && newPaidMonths > 0) {
                    newPaidMonths -= 1;
                }

                student.feeDetails.paidMonths = newPaidMonths;
                student.feeDetails.isLocked = false; // Always unlock if we are deleting history

                // Recalculate next due date
                let currentDue = new Date();
                if (student.feeDetails.joiningDate) {
                    currentDue = new Date(student.feeDetails.joiningDate);
                    currentDue.setMonth(currentDue.getMonth() + newPaidMonths);
                    const extensionDays = parseInt(student.feeDetails.extensionDays) || 0;
                    if (extensionDays > 0) {
                        currentDue.setDate(currentDue.getDate() + extensionDays);
                    }
                    currentDue.setHours(0,0,0,0);
                }
                student.feeDetails.nextDueDate = currentDue.toISOString();
            }

            // 1. Persist to Firestore (in 'users' collection)
            const docRef = firebase.firestore().collection('users').doc(studentId);
            try {
                // Try update first (preferred)
                await docRef.update({ 
                    'feeDetails.paymentHistory': student.feeDetails.paymentHistory,
                    'feeDetails.paidMonths': student.feeDetails.paidMonths,
                    'feeDetails.isLocked': student.feeDetails.isLocked,
                    'feeDetails.nextDueDate': student.feeDetails.nextDueDate
                });
                console.log('[FeeHistory] Firestore update SUCCESS (document existed).');
            } catch (updateErr) {
                if (updateErr.code === 'not-found' || updateErr.code === 'firestore/not-found') {
                    console.warn('[FeeHistory] Document not found in Firestore. Using set() to create it.');
                    await docRef.set(student);
                } else {
                    throw updateErr;
                }
            }

            // 2. Update Local Cache
            // Ensure the 'id' field is present (IndexedDB keyPath requirement)
            if (!student.id) student.id = studentId;
            await window.LocalCache.setItem('students', student);

            // 3. Patch DOM (Zero Rerender)
            if (targetDeleteDate === 'ALL') {
                historyTimeline.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: var(--text-muted); opacity: 0; animation: fadeIn 0.4s ease forwards;">
                        <i class="fa-solid fa-clock-rotate-left" style="font-size: 32px; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p>No fee history recorded yet.</p>
                    </div>
                `;
            } else if (targetDeleteElement) {
                targetDeleteElement.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
                targetDeleteElement.style.transform = 'scale(0.95)';
                targetDeleteElement.style.opacity = '0';
                setTimeout(() => targetDeleteElement.remove(), 220);
            }

            // 4. Success UI
            deleteHistoryModal.classList.remove('active');
            deletePasswordInput.value = '';
            document.querySelector('#deleteHistoryModal h3').textContent = 'Delete History Entry';
            document.querySelector('#deleteHistoryModal p').textContent = 'Enter Admin Password to permanently delete this payment record.';
            showToast(targetDeleteDate === 'ALL' ? 'Fee cycle reset successfully.' : 'History entry deleted successfully.', 'success');

        } catch (error) {
            const code = error.code || '';
            console.error('[FeeHistory] Delete error. Code:', code, '| Message:', error.message);

            // ── Granular Firebase error handling ──
            if (
                code === 'auth/wrong-password' ||
                code === 'auth/invalid-credential' ||
                code === 'auth/invalid-login-credentials'
            ) {
                showInputError('Invalid Admin Password');

            } else if (code === 'auth/user-mismatch') {
                showInputError('Account mismatch');
                showToast('Auth account mismatch. Please re-login.', 'error');

            } else if (code === 'auth/too-many-requests') {
                showInputError('Too many attempts');
                showToast('Too many failed attempts. Try again later.', 'error');

            } else if (code === 'auth/network-request-failed') {
                deleteHistoryModal.classList.remove('active');
                showToast('Network error. Check your connection and retry.', 'error');

            } else if (code === 'auth/user-not-found' || code === 'auth/user-disabled') {
                deleteHistoryModal.classList.remove('active');
                showToast('Admin session not found. Please re-login.', 'error');

            } else if (error.message === 'StudentDataMissing') {
                deleteHistoryModal.classList.remove('active');
                showToast('Student data not found. Please refresh the page.', 'error');

            } else {
                // Fallback for unexpected errors
                showInputError('Verification failed');
                showToast(`Unexpected error: ${error.message || 'Please try again.'}`, 'error');
            }

        } finally {
            confirmDeleteBtn.innerHTML = originalBtnText;
            confirmDeleteBtn.disabled = false;
        }
    });

    loadHistoryData();
});
