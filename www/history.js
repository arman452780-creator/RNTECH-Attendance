document.addEventListener('DOMContentLoaded', () => {
    // Route Guard: Ensure only teachers can access
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'teacher') {
        alert("Access Denied: Teacher privileges required.");
        window.location.href = 'index.html';
        return;
    }

    const historyList = document.getElementById('historyList');
    const emptyState = document.getElementById('emptyState');
    const statusFilter = document.getElementById('statusFilter');
    const classFilter = document.getElementById('classFilter');
    const dateFilter = document.getElementById('dateFilter');
    const resetBtn = document.getElementById('resetFilters');

    // Real-time listener for all records from Firestore
    let allRecords = [];
    
    db.collection('attendanceRecords').onSnapshot((snapshot) => {
        allRecords = [];
        snapshot.forEach(doc => {
            allRecords.push(doc.data());
        });

        // Populate Class Filter dropdown dynamically
        const currentSelectedClass = classFilter.value;
        const classes = [...new Set(allRecords.map(r => r.className))];
        
        classFilter.innerHTML = '<option value="all">All Classes</option>';
        classes.forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            classFilter.appendChild(option);
        });
        
        // Preserve selection if possible
        if (classes.includes(currentSelectedClass) || currentSelectedClass === 'all') {
            classFilter.value = currentSelectedClass;
        }

        renderHistory();
    }, (error) => {
        console.error("Error fetching Firestore records:", error);
    });

    function renderHistory() {
        // Clear current list items
        const currentItems = historyList.querySelectorAll('.history-card, .date-group-header');
        currentItems.forEach(item => item.remove());

        if (allRecords.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }

        // 1. Process records (Unique latest per day)
        const latestRecordsMap = {};
        allRecords.forEach(record => {
            const datePart = record.date; // Now YYYY-MM-DD
            const uniqueKey = `${record.studentID}-${datePart}`;
            latestRecordsMap[uniqueKey] = record;
        });

        let filteredRecords = Object.values(latestRecordsMap);

        // 2. Apply Filters
        const statusVal = statusFilter.value;
        const classVal = classFilter.value;
        const dateVal = dateFilter.value; // Format: YYYY-MM-DD

        filteredRecords = filteredRecords.filter(record => {
            // Status filter
            if (statusVal !== 'all' && record.attendanceStatus !== statusVal) return false;
            
            // Class filter
            if (classVal !== 'all' && record.className !== classVal) return false;
            
            // Date filter
            if (dateVal && record.date !== dateVal) return false;
            
            return true;
        });

        if (filteredRecords.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            emptyState.style.display = 'none';

            // 3. Sort: Newest first
            filteredRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

            // 4. Render with grouping by date
            let currentDateGroup = '';

            filteredRecords.forEach(record => {
                const datePart = record.date;
                
                if (datePart !== currentDateGroup) {
                    currentDateGroup = datePart;
                    const header = document.createElement('div');
                    header.className = 'date-group-header';
                    // Format YYYY-MM-DD to more readable format for the header
                    const displayDate = new Date(datePart).toLocaleDateString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric'
                    });
                    header.textContent = displayDate;
                    historyList.appendChild(header);
                }

                const card = document.createElement('div');
                card.className = 'history-card';
                card.innerHTML = `
                    <div class="history-card-header">
                        <div class="student-info">
                            <h3 class="name">${record.studentName}</h3>
                            <p class="class-name">${record.className}</p>
                        </div>
                        <span class="status-badge ${record.attendanceStatus}">${record.attendanceStatus}</span>
                    </div>
                    <div class="history-card-footer">
                        <i class="fa-regular fa-calendar"></i>
                        <span>${record.date}</span>
                    </div>
                `;
                historyList.appendChild(card);
            });
        }
    }

    // Event Listeners for filters
    statusFilter.addEventListener('change', renderHistory);
    classFilter.addEventListener('change', renderHistory);
    dateFilter.addEventListener('change', renderHistory);
    resetBtn.addEventListener('click', () => {
        statusFilter.value = 'all';
        classFilter.value = 'all';
        dateFilter.value = '';
        renderHistory();
    });

    // renderHistory() is now called within the onSnapshot callback
});
