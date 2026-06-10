document.addEventListener('DOMContentLoaded', async () => {
    if (window.feeCenterInitialized) return;
    window.feeCenterInitialized = true;
    console.log("Fee Center initialized once");

    const feeStudentList = document.getElementById('feeStudentList');
    const filterChips = document.querySelectorAll('.filter-chip');
    const searchInput = document.getElementById('feeSearchInput');
    const chipOverdueCount = document.getElementById('chipOverdueCount');
    const chipDueSoonCount = document.getElementById('chipDueSoonCount');
    const feeSummaryText = document.getElementById('feeSummaryText');

    const unlockFeeModal = document.getElementById('unlockFeeModal');
    const unlockPasswordInput = document.getElementById('unlockPasswordInput');
    const confirmUnlockBtn = document.getElementById('confirmUnlockBtn');
    const cancelUnlockBtn = document.getElementById('cancelUnlockBtn');
    let targetUnlockStudentId = null;

    let allStudents = [];
    let currentFilter = 'all';

    const gradients = [
        'linear-gradient(135deg, #FF6B6B, #FF8E53)',
        'linear-gradient(135deg, #4FACFE, #00F2FE)',
        'linear-gradient(135deg, #43E97B, #38F9D7)',
        'linear-gradient(135deg, #FA709A, #FEE140)',
        'linear-gradient(135deg, #A18CD1, #FBC2EB)'
    ];

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const loadFeeData = async () => {
        try {
            if (!window.LocalCache) throw new Error("LocalCache missing");
            const students = await window.LocalCache.getAll('students') || [];
            console.log("Students loaded:", students.length);
            
            const today = new Date();
            today.setHours(0,0,0,0);
            const fiveDaysFromNow = new Date(today);
            fiveDaysFromNow.setDate(today.getDate() + 5);

            let processedData = [];

            for (const student of students) {
                // Ensure feeDetails exists so we can safely read it
                const feeDetails = student.feeDetails || {};
                
                const duration = parseInt(feeDetails.courseDuration) || 0;
                const paid = parseInt(feeDetails.paidMonths) || 0;
                
                const remaining = Math.max(0, duration - paid);
                
                let nextDueNoTime = null;
                let status = 'upcoming';
                let diffDays = 0;
                
                if (feeDetails.joiningDate && duration > 0) {
                    const joinDate = new Date(feeDetails.joiningDate);
                    if (!isNaN(joinDate.getTime())) {
                        const nextDue = new Date(joinDate);
                        nextDue.setMonth(nextDue.getMonth() + paid);
                        
                        const extensionDays = parseInt(feeDetails.extensionDays) || 0;
                        if (extensionDays > 0) {
                            nextDue.setDate(nextDue.getDate() + extensionDays);
                        }
                        
                        nextDueNoTime = new Date(nextDue);
                        nextDueNoTime.setHours(0,0,0,0);

                        const diffTime = today - nextDueNoTime;
                        diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                        const totalFee = parseInt(feeDetails.totalFee) || 0;
                        const monthlyFee = parseInt(feeDetails.monthlyFee) || 0;
                        let remainingFees = 0;
                        let calculatedTotalFee = 0;
                        if (totalFee > 0) {
                            calculatedTotalFee = totalFee;
                        } else if (monthlyFee > 0 && duration > 0) {
                            calculatedTotalFee = monthlyFee * duration;
                        }
                        
                        if (calculatedTotalFee > 0) {
                            const regFee = parseInt(feeDetails.registrationFee) || 0;
                            const payableFee = Math.max(0, calculatedTotalFee - regFee);
                            const feesPaid = paid * monthlyFee;
                            remainingFees = Math.max(0, payableFee - feesPaid);
                        }

                        let isFullyPaid = false;
                        if (duration > 0 && paid >= duration) {
                            isFullyPaid = true;
                        }

                        if (isFullyPaid) {
                            status = 'paid';
                        } else if (today > nextDueNoTime) {
                            status = 'overdue';
                        } else if (fiveDaysFromNow >= nextDueNoTime) {
                            status = 'due-soon';
                        } else {
                            status = 'upcoming';
                        }
                    }
                }

                const d = new Date();
                const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                
                // AUTO UNLOCK SYSTEM - LOCAL DATE CALCULATION
                let isLocked = false;
                if (feeDetails.isLocked === true) {
                    if (feeDetails.lastPaidMonth === currentMonthStr) {
                        isLocked = true;
                    }
                    // If it's a new month, it remains false (Auto Unlock)
                }

                processedData.push({
                    ...student,
                    _feeDuration: duration,
                    _feePaid: paid,
                    _feeRemaining: remaining,
                    _feeNextDue: nextDueNoTime,
                    _feeStatus: status,
                    _feeDiffDays: Math.abs(diffDays),
                    _feeMonthly: feeDetails.monthlyFee || 0,
                    _isLocked: isLocked
                });
            }

            allStudents = processedData;
            updateFilterCounts();
            renderList();
            
        } catch (error) {
            console.error("Error loading fee data:", error);
            if (feeStudentList) {
                feeStudentList.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--danger);">Error loading fee data.</div>`;
            }
        }
    };

    const updateFilterCounts = () => {
        const overdueCount = allStudents.filter(s => s._feeStatus === 'overdue').length;
        const dueSoonCount = allStudents.filter(s => s._feeStatus === 'due-soon').length;
        
        if (chipOverdueCount) chipOverdueCount.textContent = overdueCount;
        if (chipDueSoonCount) chipDueSoonCount.textContent = dueSoonCount;
        
        let totalPending = overdueCount + dueSoonCount;
        if (feeSummaryText) feeSummaryText.textContent = totalPending > 0 ? `${totalPending} Action${totalPending > 1 ? 's' : ''} Required` : "All clear!";
    };

    const handleMarkPaid = async (studentId, btnEl) => {
        const originalHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnEl.disabled = true;

        try {
            const student = await window.LocalCache.getItem('students', studentId);
            if (student && student.feeDetails) {
                const currentPaid = parseInt(student.feeDetails.paidMonths) || 0;
                const newPaid = currentPaid + 1;
                
                // VALIDATION: Prevent duplicate history entries for the same month
                const history = student.feeDetails.paymentHistory || [];
                const alreadyPaid = history.find(entry => entry.monthLabel === `Month ${newPaid}`);
                if (alreadyPaid) {
                    if (window.RNPopups) window.RNPopups.toast(`Month ${newPaid} already recorded`, "warning");
                    else alert(`Month ${newPaid} already recorded`);
                    btnEl.innerHTML = originalHtml;
                    btnEl.disabled = false;
                    return;
                }
                
                let lateDays = 0;
                let currentDue = new Date();
                let nextMonthDue = new Date();
                if (student.feeDetails.joiningDate) {
                    const joinDate = new Date(student.feeDetails.joiningDate);
                    
                    currentDue = new Date(joinDate);
                    currentDue.setMonth(currentDue.getMonth() + currentPaid);
                    
                    nextMonthDue = new Date(joinDate);
                    nextMonthDue.setMonth(nextMonthDue.getMonth() + newPaid);
                    
                    const extensionDays = parseInt(student.feeDetails.extensionDays) || 0;
                    if (extensionDays > 0) {
                        currentDue.setDate(currentDue.getDate() + extensionDays);
                        nextMonthDue.setDate(nextMonthDue.getDate() + extensionDays);
                    }
                    currentDue.setHours(0,0,0,0);
                    nextMonthDue.setHours(0,0,0,0);
                    
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    
                    if (today > currentDue) {
                        const diffTime = today - currentDue;
                        lateDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    }
                }
                const newHistoryEntry = {
                    date: new Date().toISOString(),
                    monthLabel: `Month ${newPaid}`,
                    amount: student.feeDetails.monthlyFee || 0,
                    status: "Paid",
                    type: "Payment",
                    lateDays: lateDays
                };

                const d = new Date();
                const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                
                const updateData = {
                    'feeDetails.paidMonths': newPaid,
                    'feeDetails.isLocked': true,
                    'feeDetails.lastPaidMonth': currentMonthStr,
                    'feeDetails.lastPaymentDate': new Date().toISOString(),
                    'feeDetails.nextDueDate': nextMonthDue.toISOString(),
                    'feeDetails.paymentHistory': firebase.firestore.FieldValue.arrayUnion(newHistoryEntry),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await firebase.firestore().collection('users').doc(studentId).update(updateData);

                student.feeDetails.paidMonths = newPaid;
                student.feeDetails.isLocked = true;
                student.feeDetails.lastPaidMonth = currentMonthStr;
                student.feeDetails.lastPaymentDate = updateData['feeDetails.lastPaymentDate'];
                student.feeDetails.nextDueDate = updateData['feeDetails.nextDueDate'];
                student.feeDetails.paymentHistory = student.feeDetails.paymentHistory || [];
                student.feeDetails.paymentHistory.push(newHistoryEntry);
                
                await window.LocalCache.setItem('students', student);
                
                if (window.RNPopups) window.RNPopups.toast("Payment marked successfully", "success");
                else alert("Payment marked successfully");

                loadFeeData();
            }
        } catch (error) {
            console.error("Error marking paid:", error);
            if (window.RNPopups) window.RNPopups.toast("Failed to mark paid: " + error.message, "error");
            else alert("Failed to mark paid");
            btnEl.innerHTML = originalHtml;
            btnEl.disabled = false;
        }
    };

    const handleUnlockFee = (studentId) => {
        targetUnlockStudentId = studentId;
        if (unlockPasswordInput) unlockPasswordInput.value = '';
        if (unlockFeeModal) unlockFeeModal.classList.add('active');
    };

    if (cancelUnlockBtn) {
        cancelUnlockBtn.addEventListener('click', () => {
            targetUnlockStudentId = null;
            if (unlockFeeModal) unlockFeeModal.classList.remove('active');
        });
    }

    if (confirmUnlockBtn) {
        confirmUnlockBtn.addEventListener('click', async () => {
            if (!targetUnlockStudentId) return;
            const pass = unlockPasswordInput.value.trim();
            if (!pass) {
                if (window.RNPopups) window.RNPopups.toast("Please enter your password", "error");
                else alert("Please enter your password");
                return;
            }

            const originalText = confirmUnlockBtn.innerHTML;
            confirmUnlockBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            confirmUnlockBtn.disabled = true;

            try {
                // Verify password via re-auth
                const user = firebase.auth().currentUser;
                if (!user) throw new Error("Not authenticated");
                const cred = firebase.auth.EmailAuthProvider.credential(user.email, pass);
                await user.reauthenticateWithCredential(cred);

                // Password correct, unlock fee
                const unlockEntry = {
                    date: new Date().toISOString(),
                    action: "Manual Unlock"
                };

                const updateData = {
                    'feeDetails.isLocked': false,
                    'feeDetails.unlockHistory': firebase.firestore.FieldValue.arrayUnion(unlockEntry),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await firebase.firestore().collection('users').doc(targetUnlockStudentId).update(updateData);

                // Update local cache
                const student = await window.LocalCache.getItem('students', targetUnlockStudentId);
                if (student) {
                    if (!student.feeDetails) student.feeDetails = {};
                    student.feeDetails.isLocked = false;
                    student.feeDetails.unlockHistory = student.feeDetails.unlockHistory || [];
                    student.feeDetails.unlockHistory.push(unlockEntry);
                    await window.LocalCache.setItem('students', student);
                }

                if (window.RNPopups) window.RNPopups.toast("Fee cycle unlocked successfully", "success");
                if (unlockFeeModal) unlockFeeModal.classList.remove('active');
                
                loadFeeData();
            } catch (error) {
                console.error("Unlock error:", error);
                if (window.RNPopups) window.RNPopups.toast("Incorrect password", "error");
                else alert("Incorrect password");
            } finally {
                confirmUnlockBtn.innerHTML = originalText;
                confirmUnlockBtn.disabled = false;
            }
        });
    }

    const renderList = () => {
        if (!feeStudentList) return;

        if (allStudents.length === 0) {
            feeStudentList.innerHTML = `<div class="empty-state">No fee records found</div>`;
            return;
        }

        let filtered = allStudents;

        if (currentFilter !== 'all') {
            filtered = filtered.filter(s => s._feeStatus === currentFilter);
        }

        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (searchTerm) {
            filtered = filtered.filter(s => (s.name || '').toLowerCase().includes(searchTerm) || (s.course || '').toLowerCase().includes(searchTerm));
        }

        if (filtered.length === 0) {
            feeStudentList.innerHTML = `<div class="empty-state">No students match filter.</div>`;
            return;
        }

        const priority = { 'overdue': 1, 'due-soon': 2, 'upcoming': 3, 'paid': 4 };
        filtered.sort((a, b) => {
            if (priority[a._feeStatus] !== priority[b._feeStatus]) {
                return priority[a._feeStatus] - priority[b._feeStatus];
            }
            if (a._feeNextDue && b._feeNextDue) {
                return a._feeNextDue - b._feeNextDue;
            }
            return 0;
        });

        const fragment = document.createDocumentFragment();

        filtered.forEach((student, idx) => {
            // Reusing identical teacher_students.js logic
            const initials = getInitials(student.name);
            const gradient = gradients[idx % gradients.length];
            
            const c1 = student.course1 || student.course || '';
            const c2 = student.course2 || '';
            const c3 = student.course3 || '';
            const courseArr = [c1, c2, c3].filter(Boolean).map(c => c.toUpperCase());
            const courseDisplay = courseArr.length > 0 ? courseArr.join(' | ') : '—';
            

            
            const photoUrl = student.profileImage || student.photoUrl || '';
            const isLegacyAvatar = photoUrl.includes('pravatar.cc');
            const showPhoto = photoUrl && !isLegacyAvatar;

            const avatarHtml = showPhoto
                ? `<img class="sc-photo" src="${photoUrl}" alt="${student.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
            const initialsHtml = `<div class="sc-initials" style="background:${gradient};display:${showPhoto ? 'none' : 'flex'}">${initials || '<i class="fa-solid fa-user"></i>'}</div>`;

            // Fee Variables
            let statusText = '';
            let statusColor = '';
            let nextDueStr = student._feeNextDue ? student._feeNextDue.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-';

            if (student._feeStatus === 'paid') {
                statusText = 'Fully Paid';
                statusColor = 'var(--success)';
                nextDueStr = 'Paid Up';
            } else if (student._feeStatus === 'balance-due') {
                statusText = 'Balance Due';
                statusColor = 'var(--warning)';
                nextDueStr = 'Pending';
            } else if (student._feeStatus === 'overdue') {
                statusText = `Overdue (${student._feeDiffDays}d)`;
                statusColor = 'var(--danger)';
            } else if (student._feeStatus === 'due-soon') {
                statusText = `Due Soon (${student._feeDiffDays}d)`;
                statusColor = 'var(--warning)';
            } else if (student._feeStatus === 'upcoming') {
                statusText = 'Upcoming';
                statusColor = 'var(--text-muted)';
            } else {
                statusText = 'Paid';
                statusColor = 'var(--success)';
            }

            if (student._isLocked) {
                statusText = 'Payment Received <i class="fa-solid fa-lock" style="margin-left:4px;"></i>';
                statusColor = 'var(--success)';
            }

            const feeDataObj = student.feeDetails || {};
            const totalFeeRaw = parseInt(feeDataObj.totalFee) || 0;
            const computedTotalFee = totalFeeRaw > 0 ? totalFeeRaw : (student._feeMonthly * student._feeDuration);
            const totalFeeDisplay = computedTotalFee > 0 ? computedTotalFee : '-';

            const card = document.createElement('div');
            card.className = 'student-card-profile'; // Reuse Exact Class!
            card.style.position = 'relative';
            card.style.overflow = 'hidden';
            
            // Premium Top Strip for status
            const topStrip = document.createElement('div');
            topStrip.style.position = 'absolute';
            topStrip.style.top = '0';
            topStrip.style.left = '0';
            topStrip.style.width = '100%';
            topStrip.style.height = '4px';
            topStrip.style.backgroundColor = statusColor;
            topStrip.style.boxShadow = `0 0 12px ${statusColor}`;
            card.appendChild(topStrip);
            
            // Build identical card HTML but replace bottom sc-stats with fee stats
            const completedCourseMonths = student._feeDuration > 0 ? (student._feeDuration - student._feeRemaining) : 0;
            const pct = student._feeDuration > 0 ? Math.min(100, Math.round((completedCourseMonths / student._feeDuration) * 100)) : 0;
            
            const cardContent = document.createElement('div');
            cardContent.innerHTML = `
                <!-- TOP SECTION -->
                <div class="sc-top">
                    <div class="sc-avatar-wrap">
                        ${avatarHtml}
                        ${initialsHtml}
                    </div>
                    <div class="sc-info">
                        <div class="sc-name">${(student.name || 'Unknown Student').toUpperCase()}</div>
                        <div class="sc-course" style="font-size: 12px; margin-top: 4px;">${courseDisplay}</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0;">
                        <span style="font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(255,255,255,0.05); color: ${statusColor}; box-shadow: 0 0 10px ${statusColor}30; border: 1px solid ${statusColor}50;">
                            ${statusText}
                        </span>
                    </div>
                </div>

                <!-- MIDDLE SECTION: 2-column grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(0,0,0,0.15); padding: 12px 14px; border-radius: 14px; margin-top: 15px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; flex-direction: column; gap: 3px;">
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Monthly / Total Fee</span>
                        <span style="font-size: 14px; font-weight: 700; color: var(--primary);">₹${student._feeMonthly} <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">/ ₹${totalFeeDisplay}</span></span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 3px; text-align: right;">
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Next Due Date</span>
                        <span style="font-size: 14px; font-weight: 700; color: var(--text-dark);">${nextDueStr}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 3px;">
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Paid Months</span>
                        <span style="font-size: 14px; font-weight: 700; color: var(--text-dark);">${student._feePaid} M</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 3px; text-align: right;">
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Remaining</span>
                        <span style="font-size: 14px; font-weight: 700; color: var(--text-dark);">${student._feeRemaining} M</span>
                    </div>
                </div>

                <!-- BOTTOM SECTION -->
                <div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 15px; margin-top: 15px;">
                    <div style="flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); font-weight: 600;">
                            <span>Course Progress</span>
                            <span>${completedCourseMonths}/${student._feeDuration} M</span>
                        </div>
                        <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden;">
                            <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, var(--primary), var(--accent-color)); border-radius: 10px; transition: width 0.5s;"></div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 8px; flex-shrink: 0;">
                        <a href="fee_edit.html?id=${student.id}" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-dark); padding: 8px 12px; font-size: 12px; border-radius: 10px; text-decoration: none; display: flex; align-items: center; gap: 6px; font-weight: 600; ${student._isLocked ? 'opacity: 0.5; pointer-events: none;' : ''}">
                            <i class="fa-solid fa-pen-to-square"></i> Edit
                        </a>
                        <a href="fee_history.html?id=${student.id}" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-dark); padding: 8px 12px; font-size: 12px; border-radius: 10px; text-decoration: none; display: flex; align-items: center; gap: 6px; font-weight: 600;">
                            <i class="fa-solid fa-clock-rotate-left"></i> History
                        </a>
                        ${student._isLocked ? `
                        <button class="btn-unlock-fee" data-id="${student.id}" style="background: rgba(255, 171, 0, 0.15); border: 1px solid rgba(255, 171, 0, 0.3); color: var(--warning); padding: 8px 12px; font-size: 12px; border-radius: 10px; display: flex; align-items: center; gap: 6px; font-weight: 600; cursor: pointer;">
                            <i class="fa-solid fa-unlock"></i> Unlock
                        </button>
                        ` : (student._feePaid < student._feeDuration ? `
                        <button class="btn-mark-paid" data-id="${student.id}" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: var(--success); padding: 8px 12px; font-size: 12px; border-radius: 10px; display: flex; align-items: center; gap: 6px; font-weight: 600; cursor: pointer;">
                            <i class="fa-solid fa-check-double"></i> Pay
                        </button>
                        ` : '')}
                    </div>
                </div>
            `;
            card.appendChild(cardContent);

            const markPaidBtn = card.querySelector('.btn-mark-paid');
            if (markPaidBtn) {
                markPaidBtn.addEventListener('click', async (e) => {
                    await handleMarkPaid(student.id, e.currentTarget);
                });
            }

            const unlockFeeBtn = card.querySelector('.btn-unlock-fee');
            if (unlockFeeBtn) {
                unlockFeeBtn.addEventListener('click', (e) => {
                    handleUnlockFee(student.id);
                });
            }

            fragment.appendChild(card);
        });

        feeStudentList.innerHTML = '';
        feeStudentList.appendChild(fragment);
    };

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-filter');
            renderList();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', renderList);
    }

    loadFeeData();
});
