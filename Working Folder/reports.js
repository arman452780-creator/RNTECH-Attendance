document.addEventListener('DOMContentLoaded', () => {


    const historyList = document.getElementById('historyList');
    const emptyState = document.getElementById('emptyState');
    const dateFilter = document.getElementById('dateFilter');
    const nameSearch = document.getElementById('nameSearch');

    let activeHistorySummaryFilter = null; // State for summary pill filtering (present, late, absent)

    // Targeted fetch for records from Firestore
    let allRecords = [];
    let studentMap = {}; // Map of studentID -> student data for dynamic course resolution

    const fetchReports = async () => {
        console.log("[LocalCache] fetchReports triggered");
        const targetDate = dateFilter.value || new Date().toISOString().split('T')[0];
        
        try {
            // --- STEP 8: REALTIME SYNC SAFETY (Fetching students for current course info) ---
            console.log("[LocalCache] Fetching students for course resolution...");
            const allStudents = await window.LocalCache.getAll('students');
            studentMap = {};
            allStudents.forEach(data => {
                
                // --- STEP 3: SAFE COURSE NORMALIZATION ---
                let normalizedCourses = [];
                if (Array.isArray(data.courses)) {
                    normalizedCourses = data.courses;
                } else if (data.course) {
                    normalizedCourses = [data.course];
                }

                studentMap[data.id || data.userID] = {
                    ...data,
                    courses: normalizedCourses,
                    // --- STEP 5: PRIORITY DISPLAY RULE ---
                    resolvedCourse: normalizedCourses.length > 0 ? normalizedCourses[0] : (data.course || 'Unassigned')
                };
            });

            console.log(`[LocalCache] Fetching records for date: ${targetDate}`);
            const allLocalRecords = await window.LocalCache.getAll('attendanceRecords');
            const targetRecords = allLocalRecords.filter(r => r.date === targetDate);

            console.log(`[LocalCache] Fetched ${targetRecords.length} records`);
            allRecords = [];
            targetRecords.forEach(data => {
                allRecords.push({
                    ...data,
                    id: data.id,
                    studentName: data.studentName || 'Unknown Student',
                    studentID: data.studentID || data.userID || data.id,
                    className: data.className || 'Unassigned',
                    attendanceStatus: data.attendanceStatus || 'unmarked',
                    date: data.date || targetDate
                });
            });

            renderHistory();
        } catch (error) {
            console.error("[Firestore] Error fetching records:", error);
            emptyState.innerHTML = `
                <div style="color: #ef4444; padding: 20px;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 32px; margin-bottom: 12px;"></i>
                    <h3 style="font-size: 16px;">Connection Error</h3>
                    <p style="font-size: 12px; opacity: 0.8;">${error.message}</p>
                </div>
            `;
            emptyState.style.display = 'flex';
        }
    };

    // Connect to Local-First Lifecycle
    document.addEventListener('APP_READY', async (e) => {
        const { role, isCached } = e.detail;
        if (role !== 'teacher') return;
        
        // Fetch and render immediately
        await fetchReports();

        // If this is the cached render, don't double-bind listeners
        if (isCached) return;

        // Bind background sync listeners to auto-update
        window.FirebaseSync.on('STUDENTS_UPDATED', fetchReports);
        window.FirebaseSync.on('ATTENDANCE_UPDATED', fetchReports);
    });

    function renderHistory() {
        // Clear current list items
        const currentItems = historyList.querySelectorAll('.history-card, .date-group-header');
        currentItems.forEach(item => item.remove());

        if (allRecords.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }

        // Helper to get precise timestamp value for comparison (Handles Firestore & JS Dates)
        const getTimestampVal = (r) => {
            if (!r || !r.timestamp) return 0;
            try {
                if (r.timestamp.toDate) return r.timestamp.toDate().getTime();
                if (r.timestamp.seconds) return r.timestamp.seconds * 1000;
                const d = new Date(r.timestamp);
                return isNaN(d.getTime()) ? 0 : d.getTime();
            } catch (e) { return 0; }
        };

        // 1. GLOBAL SORT: Arrange ALL records by newest timestamp first before any processing
        const globallySorted = [...allRecords].sort((a, b) => getTimestampVal(b) - getTimestampVal(a));

        // 2. DEDUPLICATION: Preserve latest record per student per day
        const latestRecordsMap = {};
        globallySorted.forEach(record => {
            const datePart = record.date;
            const studentId = record.studentID || record.userID || 'no-id';
            const uniqueKey = `${studentId}_${datePart}`;
            
            // Since globallySorted is newest first, the first encounter for a key is the latest record
            if (!latestRecordsMap[uniqueKey]) {
                latestRecordsMap[uniqueKey] = record;
            }
        });

        let processedRecords = Object.values(latestRecordsMap);

        // 3. APPLY FILTERS
        const dateVal = dateFilter.value;

        const filteredRecords = processedRecords.filter(record => {
            // Date filter
            if (dateVal && record.date !== dateVal) return false;

            // Name search filter
            const searchVal = (nameSearch.value || '').toLowerCase().trim();
            if (searchVal && !(record.studentName || '').toLowerCase().includes(searchVal)) return false;
            
            return true;
        });

        // 3.5 CALCULATE SUMMARY COUNTS (Based on filtered records BEFORE the summary status filter is applied)
        updateSummaryCounts(filteredRecords);

        // 3.6 APPLY SUMMARY STATUS FILTER
        const finalFiltered = filteredRecords.filter(record => {
            if (activeHistorySummaryFilter && record.attendanceStatus !== activeHistorySummaryFilter) return false;
            return true;
        });

        if (finalFiltered.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';

        // 4. GROUPING: Categorize filtered records by Date
        const dateGroups = {};
        finalFiltered.forEach(record => {
            const d = record.date || 'No Date';
            if (!dateGroups[d]) dateGroups[d] = [];
            dateGroups[d].push(record);
        });

        // 5. SORT GROUPS: Sort the date headers descending (Newest date at top)
        const sortedDateKeys = Object.keys(dateGroups).sort((a, b) => new Date(b) - new Date(a));

        // 6. RENDER: Iterate through sorted groups and their records
        sortedDateKeys.forEach(dateKey => {
            // INNER SORT: Ensure records inside this specific date are sorted by latest time first
            const sortedInGroup = dateGroups[dateKey].sort((a, b) => getTimestampVal(b) - getTimestampVal(a));

            // Create Date Group Header
            const header = document.createElement('div');
            header.className = 'date-group-header';
            const displayDate = new Date(dateKey).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
            });
            header.textContent = displayDate;
            historyList.appendChild(header);

            // Create Attendance Cards for each record in the group
            sortedInGroup.forEach(record => {
                // Format time for display using the precise timestamp
                let timeString = '';
                if (record.timestamp) {
                    const date = record.timestamp.toDate ? record.timestamp.toDate() : 
                                 (record.timestamp.seconds ? new Date(record.timestamp.seconds * 1000) : new Date(record.timestamp));
                    
                    timeString = ` • <i class="fa-regular fa-clock" style="margin-left: 4px;"></i> <span>${date.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        hour12: true 
                    })}</span>`;
                }

                // --- STEP 5: PRIORITY DISPLAY RULE ---
                const sData = studentMap[record.studentID] || {};
                const resolvedCourse = sData.resolvedCourse || record.className || record.course || 'Unassigned';

                // --- STEP 9: DEBUGGING ---
                console.log("Attendance Record Rendering:", record);
                console.log("Student Data Found:", sData);
                console.log("Resolved Course for UI:", resolvedCourse);

                const card = document.createElement('div');
                card.className = 'history-card';
                card.innerHTML = `
                    <div class="history-card-header">
                        <div class="student-info">
                            <h3 class="name">${(record.studentName || 'Unknown').toUpperCase()}</h3>
                            <p class="class-name">${resolvedCourse.toUpperCase()}</p>
                        </div>
                        <span class="status-badge ${record.attendanceStatus || 'unmarked'}">${(record.attendanceStatus || 'unmarked').toUpperCase()}</span>
                    </div>
                    <div class="history-card-footer">
                        <i class="fa-regular fa-calendar"></i>
                        <span>${record.date || 'No Date'}${timeString}</span>
                    </div>
                `;
                historyList.appendChild(card);
            });
        });
    }

    // Event Listeners for filters
    dateFilter.addEventListener('change', fetchReports);
    nameSearch.addEventListener('input', renderHistory);


    // New Function: Update Summary Counts for History
    function updateSummaryCounts(records) {
        let present = 0;
        let late = 0;
        let absent = 0;

        let targetDate = dateFilter.value;
        if (!targetDate && records.length > 0) {
            targetDate = records[0].date;
        }

        records.forEach(r => {
            if (r.date === targetDate) {
                if (r.attendanceStatus === 'present') present++;
                else if (r.attendanceStatus === 'late') late++;
                else if (r.attendanceStatus === 'absent') absent++;
            }
        });

        const countPresent = document.getElementById('countPresent');
        const countLate = document.getElementById('countLate');
        const countAbsent = document.getElementById('countAbsent');

        if (countPresent) countPresent.textContent = present;
        if (countLate) countLate.textContent = late;
        if (countAbsent) countAbsent.textContent = absent;

        setupSummaryClickHandlers();
    }

    let summaryHandlersAttached = false;
    function setupSummaryClickHandlers() {
        if (summaryHandlersAttached) return;
        
        const pills = document.querySelectorAll('.stat-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                const type = pill.id === 'pillPresent' ? 'present' : 
                             pill.id === 'pillLate' ? 'late' : 'absent';
                
                if (activeHistorySummaryFilter === type) {
                    activeHistorySummaryFilter = null;
                    pill.classList.remove('active');
                } else {
                    activeHistorySummaryFilter = type;
                    pills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                }
                renderHistory();
            });
        });
        summaryHandlersAttached = true;
    }
});
