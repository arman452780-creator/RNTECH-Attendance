document.addEventListener('DOMContentLoaded', async () => {
    // Basic elements
    const formatCurrency = (val) => `₹${val.toLocaleString('en-IN')}`;
    const showToast = (message, type = 'success') => {
        if (window.Toast) window.Toast.show(message, type);
        else alert(message);
    };

    let allStudents = [];
    
    // UI Elements
    const statTotalFee = document.getElementById('statTotalFee');
    const statTotalCollected = document.getElementById('statTotalCollected');
    const statRemainingCollection = document.getElementById('statRemainingCollection');
    const statTotalOverdue = document.getElementById('statTotalOverdue');
    const statCollectionRate = document.getElementById('statCollectionRate');

    const countOverdue = document.getElementById('countOverdue');
    const amountOverdue = document.getElementById('amountOverdue');
    const countDueSoon = document.getElementById('countDueSoon');
    const amountDueSoon = document.getElementById('amountDueSoon');
    const countPaid = document.getElementById('countPaid');
    const amountPaid = document.getElementById('amountPaid');

    const courseWiseList = document.getElementById('courseWiseList');
    const topPendingList = document.getElementById('topPendingList');
    const exportSummaryBtn = document.getElementById('exportSummaryBtn');

    const upiAnalyticsSection = document.getElementById('upiAnalyticsSection');
    const upiPendingCountEl = document.getElementById('upiPendingCount');
    const upiApprovedCountEl = document.getElementById('upiApprovedCount');
    const upiRejectedCountEl = document.getElementById('upiRejectedCount');
    const upiTotalAmountEl = document.getElementById('upiTotalAmount');

    // Chart
    let monthlyChartInstance = null;

    const loadAnalyticsData = async () => {
        try {
            if (!window.LocalCache) throw new Error("LocalCache missing");
            const students = await window.LocalCache.getAll('students') || [];
            
            const today = new Date();
            today.setHours(0,0,0,0);
            const fiveDaysFromNow = new Date(today);
            fiveDaysFromNow.setDate(today.getDate() + 5);

            // Grand Totals
            let gTotalFee = 0;
            let gTotalCollected = 0;
            let gRemainingCollection = 0;
            let gTotalOverdue = 0;

            // Status Breakdown
            let sCountOverdue = 0, sAmtOverdue = 0;
            let sCountDueSoon = 0, sAmtDueSoon = 0;
            let sCountPaid = 0, sAmtPaid = 0;

            // UPI Metrics
            let upiPending = 0, upiApproved = 0, upiRejected = 0, upiAmount = 0;

            // Course-wise map
            const courseMap = {};

            // Monthly History map
            const monthlyHistoryMap = {};

            // Pending array for sorting
            const pendingStudents = [];

            for (const student of students) {
                const feeDetails = student.feeDetails || {};
                
                // --- FEE CALCULATION LOGIC EXACTLY AS IN FEE CENTER ---
                const duration = parseInt(feeDetails.courseDuration) || 0;
                const paid = parseInt(feeDetails.paidMonths) || 0;
                
                let nextDueNoTime = null;
                let status = 'upcoming';
                let isFullyPaid = false;
                let diffDays = 0;
                
                let remainingFees = 0;
                let calculatedTotalFee = 0;
                let studentCollected = 0;
                
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
                        
                        if (totalFee > 0) {
                            calculatedTotalFee = totalFee;
                        } else if (monthlyFee > 0 && duration > 0) {
                            calculatedTotalFee = monthlyFee * duration;
                        }
                        
                        if (calculatedTotalFee > 0) {
                            const regFee = parseInt(feeDetails.registrationFee) || 0;
                            const payableFee = Math.max(0, calculatedTotalFee - regFee);
                            
                            // CALCULATE studentCollected using paymentHistory ONLY (Audit Trail)
                            let historyCollected = 0;
                            if (feeDetails.paymentHistory && Array.isArray(feeDetails.paymentHistory)) {
                                feeDetails.paymentHistory.forEach(ph => {
                                    const amt = parseInt(ph.amount) || 0;

                                    // UPI Checks
                                    const isUpi = (ph.method === "UPI" || ph.type === "UPI" || ph.paymentMode === "UPI" || ph.status === "Pending Verification");
                                    if (isUpi) {
                                        if (ph.status === "Pending" || ph.status === "Pending Verification") {
                                            upiPending++;
                                            upiAmount += amt;
                                        } else if (ph.status === "Rejected") {
                                            upiRejected++;
                                            upiAmount += amt;
                                        } else if (ph.status === "Paid" || ph.status === "Approved") {
                                            upiApproved++;
                                            upiAmount += amt;
                                        }
                                    }

                                    // Valid Collection
                                    if (ph.status === "Paid" || ph.status === "Approved") {
                                        historyCollected += amt;
                                        
                                        // Process for Monthly Chart
                                        if (ph.date) {
                                            const phDate = new Date(ph.date);
                                            const monthKey = `${phDate.getFullYear()}-${String(phDate.getMonth() + 1).padStart(2, '0')}`;
                                            monthlyHistoryMap[monthKey] = (monthlyHistoryMap[monthKey] || 0) + amt;
                                        }
                                    }
                                });
                            }
                            studentCollected = historyCollected;
                            
                            remainingFees = Math.max(0, payableFee - studentCollected);

                            // (Aggregations moved down to evaluate after status is known)
                        }

                        // Status Calculation (Matching Fee Center Exactly)
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

                // --- STATUS BREAKDOWN ---
                
                // --- COURSE-WISE MONTHLY LOGIC ---
                const c1 = student.course1 || student.course || 'Unknown';
                const courseName = c1.toUpperCase();
                if (!courseMap[courseName]) {
                    courseMap[courseName] = { totalStudents: 0, fullyPaidStudents: 0, activeStudents: 0, expectedThisMonth: 0, collectedThisMonth: 0, pendingThisMonth: 0 };
                }
                courseMap[courseName].totalStudents++;
                
                const mFee = parseInt(feeDetails.monthlyFee) || 0;
                
                let monthlyPendingAmount = 0;
                if (!isFullyPaid && mFee > 0) {
                    if (status === 'overdue' || status === 'balance-due') {
                        monthlyPendingAmount = remainingFees;
                        if (nextDueNoTime) {
                            const tDay = new Date();
                            tDay.setHours(0,0,0,0);
                            let overdueMonths = (tDay.getFullYear() - nextDueNoTime.getFullYear()) * 12 + tDay.getMonth() - nextDueNoTime.getMonth();
                            if (tDay.getDate() >= nextDueNoTime.getDate()) {
                                overdueMonths++;
                            }
                            overdueMonths = Math.max(1, overdueMonths);
                            monthlyPendingAmount = Math.min(remainingFees, overdueMonths * mFee);
                        }
                    }
                }

                if (isFullyPaid) {
                    courseMap[courseName].fullyPaidStudents++;
                } else {
                    courseMap[courseName].activeStudents++;
                    if (mFee > 0) {
                        gTotalFee += mFee;
                        courseMap[courseName].expectedThisMonth += mFee;
                        
                        if (status === 'paid' || status === 'upcoming') {
                            gTotalCollected += mFee;
                            courseMap[courseName].collectedThisMonth += mFee;
                            
                            sCountPaid++;
                            sAmtPaid += mFee;
                        } else if (status === 'due-soon') {
                            sCountDueSoon++;
                            sAmtDueSoon += mFee;
                        } else if (status === 'overdue' || status === 'balance-due') {
                            sCountOverdue++;
                            sAmtOverdue += monthlyPendingAmount;
                            gTotalOverdue += monthlyPendingAmount;
                            
                            pendingStudents.push({
                                name: student.name || 'Unknown',
                                course: student.course1 || student.course || 'N/A',
                                amount: monthlyPendingAmount,
                                days: Math.abs(diffDays),
                                dueDate: nextDueNoTime
                            });
                        }
                        
                        courseMap[courseName].pendingThisMonth = courseMap[courseName].expectedThisMonth - courseMap[courseName].collectedThisMonth;
                    }
                }

                gRemainingCollection = Math.max(0, gTotalFee - gTotalCollected);

                student._exportStatus = status;
                student._exportTotal = calculatedTotalFee;
                student._exportCollected = studentCollected;
                student._exportRemaining = remainingFees;
            }

            allStudents = students;

            // --- RENDER SECTION 1: OVERVIEW CARDS ---
            statTotalFee.textContent = formatCurrency(gTotalFee);
            statTotalCollected.textContent = formatCurrency(gTotalCollected);
            statRemainingCollection.textContent = formatCurrency(gRemainingCollection);
            statTotalOverdue.textContent = formatCurrency(gTotalOverdue);

            const collectionRate = gTotalFee > 0 ? ((gTotalCollected / gTotalFee) * 100).toFixed(1) : 0;
            statCollectionRate.textContent = `${collectionRate}%`;

            // --- RENDER SECTION 2: STATUS BREAKDOWN ---
            countOverdue.textContent = `${sCountOverdue} Students`;
            amountOverdue.textContent = formatCurrency(sAmtOverdue);

            countDueSoon.textContent = `${sCountDueSoon} Students`;
            amountDueSoon.textContent = formatCurrency(sAmtDueSoon);

            countPaid.textContent = `${sCountPaid} Students`;
            amountPaid.textContent = formatCurrency(sAmtPaid);

            // --- RENDER SECTION 3: COURSE-WISE COLLECTION ---
            courseWiseList.innerHTML = '';
            for (const [cName, cData] of Object.entries(courseMap)) {
                const cCard = document.createElement('div');
                cCard.className = 'course-card';
                cCard.innerHTML = `
                    <div class="course-card-header" style="align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 15px;">
                        <span class="course-card-title">${cName}</span>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
                            <span style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); font-size: 10px; padding: 4px 8px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
                                <i class="fa-solid fa-users"></i> ${cData.totalStudents} Total
                            </span>
                            <span style="background: rgba(0, 230, 118, 0.1); color: #00e676; font-size: 10px; padding: 4px 8px; border-radius: 20px; border: 1px solid rgba(0, 230, 118, 0.2);">
                                <i class="fa-solid fa-check-circle"></i> ${cData.fullyPaidStudents} Paid
                            </span>
                            <span style="background: rgba(99, 102, 241, 0.1); color: var(--accent-color); font-size: 10px; font-weight: 600; padding: 4px 8px; border-radius: 20px; border: 1px solid rgba(99, 102, 241, 0.2);">
                                <i class="fa-solid fa-bolt"></i> ${cData.activeStudents} Active
                            </span>
                        </div>
                    </div>
                    <div class="course-stats-grid">
                        <div class="c-stat-col full">
                            <span class="c-stat-label">Total Active Collection</span>
                            <span class="c-stat-val" style="color: var(--text-dark);">${formatCurrency(cData.expectedThisMonth)}</span>
                        </div>
                        <div class="c-stat-col">
                            <span class="c-stat-label">Collected</span>
                            <span class="c-stat-val" style="color: var(--success);">${formatCurrency(cData.collectedThisMonth)}</span>
                        </div>
                        <div class="c-stat-col" style="text-align: right;">
                            <span class="c-stat-label">Pending</span>
                            <span class="c-stat-val" style="color: var(--warning);">${formatCurrency(cData.pendingThisMonth)}</span>
                        </div>
                    </div>
                `;
                courseWiseList.appendChild(cCard);
            }
            if (Object.keys(courseMap).length === 0) {
                courseWiseList.innerHTML = `<div style="padding:15px;text-align:center;color:var(--text-muted);">No course data found.</div>`;
            }

            // --- RENDER SECTION 4: MONTHLY CHART ---
            renderMonthlyChart(monthlyHistoryMap);

            // --- RENDER SECTION 5: TOP PENDING COLLECTIONS ---
            pendingStudents.sort((a, b) => {
                if (b.amount !== a.amount) return b.amount - a.amount;
                return b.days - a.days;
            });
            
            topPendingList.innerHTML = '';
            const top5 = pendingStudents.slice(0, 10);
            top5.forEach(ps => {
                const pCard = document.createElement('div');
                pCard.className = 'pending-card';
                pCard.innerHTML = `
                    <div class="pending-info">
                        <span class="pending-name">${ps.name.toUpperCase()}</span>
                        <span class="pending-meta">${ps.course.toUpperCase()}</span>
                    </div>
                    <div class="pending-amount-box">
                        <span class="pending-amt">${formatCurrency(ps.amount)}</span>
                        <span class="pending-days">${ps.days} Days Overdue</span>
                    </div>
                `;
                topPendingList.appendChild(pCard);
            });
            if (top5.length === 0) {
                topPendingList.innerHTML = `<div style="padding:15px;text-align:center;color:var(--success);">No pending collections!</div>`;
            }

            // --- RENDER SECTION 6: UPI ANALYTICS ---
            if (upiPending > 0 || upiApproved > 0 || upiRejected > 0) {
                upiAnalyticsSection.style.display = 'block';
                upiPendingCountEl.textContent = upiPending;
                upiApprovedCountEl.textContent = upiApproved;
                upiRejectedCountEl.textContent = upiRejected;
                upiTotalAmountEl.textContent = formatCurrency(upiAmount);
            } else {
                upiAnalyticsSection.style.display = 'none';
            }

        } catch (error) {
            console.error("Error loading analytics data:", error);
            showToast("Failed to load analytics data", "error");
        }
    };

    const renderMonthlyChart = (historyMap) => {
        const ctx = document.getElementById('monthlyCollectionChart');
        if (!ctx) return;

        // Generate last 6 months keys
        const labels = [];
        const dataPoints = [];
        
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-GB', { month: 'short' });
            
            labels.push(label);
            dataPoints.push(historyMap[key] || 0);
        }

        if (monthlyChartInstance) {
            monthlyChartInstance.destroy();
        }

        monthlyChartInstance = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Collection (₹)',
                    data: dataPoints,
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderColor: '#10b981',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.5)' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255,255,255,0.7)' }
                    }
                }
            }
        });
    };

    // Export Feature
    exportSummaryBtn.addEventListener('click', () => {
        if (!allStudents || allStudents.length === 0) {
            showToast("No data to export", "error");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Student Name,Course,Fee Amount,Collected,Remaining,Status\n";

        allStudents.forEach(s => {
            const name = `"${(s.name || '').replace(/"/g, '""')}"`;
            const course = `"${(s.course1 || s.course || '').replace(/"/g, '""')}"`;
            const total = s._exportTotal || 0;
            const col = s._exportCollected || 0;
            const rem = s._exportRemaining || 0;
            const stat = s._exportStatus || 'unknown';

            csvContent += `${name},${course},${total},${col},${rem},${stat}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Fee_Summary_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    loadAnalyticsData();
});
