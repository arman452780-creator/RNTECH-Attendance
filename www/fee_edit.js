document.addEventListener('DOMContentLoaded', async () => {
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

    // 1. DOM Elements
    const displayStudentName = document.getElementById('displayStudentName');
    const displayStudentCourse = document.getElementById('displayStudentCourse');
    const studentHeader = document.getElementById('studentHeader');
    
    const editJoiningDate = document.getElementById('editJoiningDate');
    const editMonthlyFee = document.getElementById('editMonthlyFee');
    const editCourseDuration = document.getElementById('editCourseDuration');
    const editTotalFee = document.getElementById('editTotalFee');
    const editRegistrationFee = document.getElementById('editRegistrationFee');
    const editPaidMonths = document.getElementById('editPaidMonths');
    const editFeeRemarks = document.getElementById('editFeeRemarks');
    
    const feePreviewBox = document.getElementById('feePreviewBox');
    const previewTotalFeeRow = document.getElementById('previewTotalFeeRow');
    const previewTotalFee = document.getElementById('previewTotalFee');
    const previewRegistrationFeeRow = document.getElementById('previewRegistrationFeeRow');
    const previewRegistrationFee = document.getElementById('previewRegistrationFee');
    const previewPayableFeeRow = document.getElementById('previewPayableFeeRow');
    const previewPayableFee = document.getElementById('previewPayableFee');
    const previewNextDue = document.getElementById('previewNextDue');
    const previewRemaining = document.getElementById('previewRemaining');
    const previewStatus = document.getElementById('previewStatus');
    const saveFeeBtn = document.getElementById('saveFeeBtn');

    // 2. Get Student ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');

    if (!studentId) {
        showToast("Student ID missing!", "error");
        setTimeout(() => { window.location.href = 'fee_management.html'; }, 1500);
        return;
    }

    let currentStudent = null;

    // 3. Load Student Data
    const loadStudentData = async () => {
        try {
            currentStudent = await window.LocalCache.getItem('students', studentId);
            if (!currentStudent) {
                showToast("Student not found in local cache.", "error");
                setTimeout(() => { window.location.href = 'fee_management.html'; }, 1500);
                return;
            }

            // Populate Display Info
            displayStudentName.textContent = currentStudent.name || 'Unknown Student';
            
            const c1 = currentStudent.course1 || currentStudent.course || '';
            const c2 = currentStudent.course2 || '';
            const courseArr = [c1, c2].filter(Boolean).map(c => c.toUpperCase());
            displayStudentCourse.textContent = courseArr.length > 0 ? courseArr.join(' | ') : 'No Course';

            const photoUrl = currentStudent.profileImage || currentStudent.photoUrl || '';
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

            // Populate Form Fields
            const fee = currentStudent.feeDetails || {};
            editJoiningDate.value = fee.joiningDate || '';
            editMonthlyFee.value = fee.monthlyFee || '';
            editCourseDuration.value = fee.courseDuration || '';
            editTotalFee.value = fee.totalFee || '';
            editRegistrationFee.value = fee.registrationFee || '';
            editPaidMonths.value = fee.paidMonths || '';
            editFeeRemarks.value = fee.remarks || '';

            updateFeePreview();
        } catch (error) {
            console.error("Error loading student:", error);
            showToast("Error loading student data.", "error");
            setTimeout(() => { window.location.href = 'fee_management.html'; }, 1500);
        }
    };

    // 4. Live Calculation Engine
    const updateFeePreview = () => {
        const joinDateVal = editJoiningDate.value;
        const duration = parseInt(editCourseDuration.value) || 0;
        const paidMonths = parseInt(editPaidMonths.value) || 0;
        const totalFee = parseInt(editTotalFee.value) || 0;
        const regFee = parseInt(editRegistrationFee.value) || 0;
        const monthlyFee = parseInt(editMonthlyFee.value) || 0;

        if (!joinDateVal || duration === 0) {
            feePreviewBox.style.display = 'none';
            return;
        }

        feePreviewBox.style.display = 'block';

        // Display Total Fee if provided, otherwise auto-calculate it
        let calculatedTotalFee = 0;
        let remainingFees = 0;
        if (totalFee > 0) {
            calculatedTotalFee = totalFee;
            previewTotalFeeRow.style.display = 'flex';
            previewTotalFee.textContent = `₹${totalFee}`;
        } else if (monthlyFee > 0 && duration > 0) {
            calculatedTotalFee = monthlyFee * duration;
            previewTotalFeeRow.style.display = 'flex';
            previewTotalFee.textContent = `₹${calculatedTotalFee} (Auto)`;
        } else {
            previewTotalFeeRow.style.display = 'none';
        }

        const previewRemainingFeesRow = document.getElementById('previewRemainingFeesRow');
        const previewRemainingFees = document.getElementById('previewRemainingFees');
        
        if (calculatedTotalFee > 0) {
            let payableFee = Math.max(0, calculatedTotalFee - regFee);
            
            if (regFee > 0) {
                previewRegistrationFeeRow.style.display = 'flex';
                previewRegistrationFee.textContent = `- ₹${regFee}`;
                previewPayableFeeRow.style.display = 'flex';
                previewPayableFee.textContent = `₹${payableFee}`;
            } else {
                previewRegistrationFeeRow.style.display = 'none';
                previewPayableFeeRow.style.display = 'none';
            }

            const feesPaid = paidMonths * monthlyFee;
            remainingFees = Math.max(0, payableFee - feesPaid);
            if (previewRemainingFeesRow) {
                previewRemainingFeesRow.style.display = 'flex';
                previewRemainingFees.textContent = `₹${remainingFees}`;
            }
        } else {
            previewRegistrationFeeRow.style.display = 'none';
            previewPayableFeeRow.style.display = 'none';
            if (previewRemainingFeesRow) previewRemainingFeesRow.style.display = 'none';
        }

        const joinDate = new Date(joinDateVal);
        const remaining = Math.max(0, duration - paidMonths);
        previewRemaining.textContent = `${remaining} months`;

        if (!isNaN(joinDate.getTime())) {
            const nextDue = new Date(joinDate);
            nextDue.setMonth(nextDue.getMonth() + paidMonths);
            
            // Add any existing extensions if available
            if (currentStudent && currentStudent.feeDetails && currentStudent.feeDetails.extensionDays) {
                nextDue.setDate(nextDue.getDate() + currentStudent.feeDetails.extensionDays);
            }

            previewNextDue.textContent = nextDue.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            
            const today = new Date();
            today.setHours(0,0,0,0);
            const nextDueNoTime = new Date(nextDue);
            nextDueNoTime.setHours(0,0,0,0);
            
            const fiveDaysFromNow = new Date(today);
            fiveDaysFromNow.setDate(today.getDate() + 5);

            let isFullyPaid = false;
            if (duration > 0 && paidMonths >= duration) {
                isFullyPaid = true;
            }

            if (isFullyPaid) {
                previewStatus.textContent = 'Fully Paid';
                previewStatus.style.color = '#00e676';
                previewNextDue.textContent = 'Paid Up';
            } else if (today > nextDueNoTime) {
                previewStatus.textContent = 'Overdue';
                previewStatus.style.color = '#ff1744';
            } else if (fiveDaysFromNow >= nextDueNoTime) {
                previewStatus.textContent = 'Due Soon';
                previewStatus.style.color = '#ffea00';
            } else {
                previewStatus.textContent = 'Paid';
                previewStatus.style.color = '#00e676';
            }
        } else {
            previewNextDue.textContent = '-';
            previewStatus.textContent = '-';
        }
    };

    // Listeners for live preview
    [editJoiningDate, editCourseDuration, editPaidMonths, editMonthlyFee, editTotalFee, editRegistrationFee].forEach(input => {
        if (input) input.addEventListener('input', updateFeePreview);
    });

    // 5. Save Function
    saveFeeBtn.addEventListener('click', async () => {
        saveFeeBtn.disabled = true;
        saveFeeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const monthlyFee = parseInt(editMonthlyFee.value) || 0;
            const duration = parseInt(editCourseDuration.value) || 0;
            const totalFee = parseInt(editTotalFee.value) || 0;
            const regFee = parseInt(editRegistrationFee.value) || 0;
            const joinDate = editJoiningDate.value;
            const paid = parseInt(editPaidMonths.value) || 0;
            const remarks = editFeeRemarks.value.trim();

            if (!joinDate) {
                throw new Error("Joining Date is required");
            }
            if (duration === 0) {
                throw new Error("Course Duration is required");
            }
            
            if (!firebase.auth().currentUser) {
                throw new Error("Local session expired. Please sign in again.");
            }
            
            let calculatedTotalFee = totalFee > 0 ? totalFee : (monthlyFee * duration);
            if (regFee > calculatedTotalFee) {
                throw new Error("Registration Fee cannot exceed the Total Course Fee.");
            }

            const updateData = {
                feeDetails: {
                    monthlyFee: monthlyFee,
                    courseDuration: duration,
                    totalFee: totalFee,
                    registrationFee: regFee,
                    joiningDate: joinDate,
                    paidMonths: paid,
                    remarks: remarks
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await firebase.firestore().collection('users').doc(studentId).set(updateData, { merge: true });

            // Update Local Cache
            if (!currentStudent.feeDetails) currentStudent.feeDetails = {};
            currentStudent.feeDetails.monthlyFee = monthlyFee;
            currentStudent.feeDetails.courseDuration = duration;
            currentStudent.feeDetails.totalFee = totalFee;
            currentStudent.feeDetails.registrationFee = regFee;
            currentStudent.feeDetails.joiningDate = joinDate;
            currentStudent.feeDetails.paidMonths = paid;
            currentStudent.feeDetails.remarks = remarks;

            await window.LocalCache.setItem('students', currentStudent);

            if (window.Toast) {
                window.Toast.show("Fee details saved successfully", "success");
            } else {
                showToast("Fee details saved successfully", "success");
            }
            
            // Redirect back to fee management
            setTimeout(() => {
                window.location.href = 'fee_management.html';
            }, 1000);

        } catch (error) {
            console.error("Error saving fee details:", error);
            if (window.Toast) {
                window.Toast.show(error.message || "Failed to save fee details", "error");
            } else {
                showToast(error.message || "Failed to save fee details", "error");
            }
            saveFeeBtn.disabled = false;
            saveFeeBtn.innerHTML = 'Save Details';
        }
    });

    // Run Initialization
    loadStudentData();
});
