document.addEventListener('DOMContentLoaded', () => {
    const feeHistoryTimeline = document.getElementById('feeHistoryTimeline');

    const renderHistory = () => {
        if (!window.LocalCache) return;

        const user = window.LocalCache.getSync('currentUser');
        if (!user || !user.feeDetails) {
            renderEmptyState();
            return;
        }

        const historyRaw = user.feeDetails.paymentHistory || [];

        // STRICT DUPLICATE PREVENTION
        // Use a composite key of month + timestamp to strictly ensure uniqueness
        const uniqueHistoryMap = new Map();
        
        historyRaw.forEach(entry => {
            if (!entry) return;
            const pId = entry.paymentId || '';
            const mLabel = entry.monthLabel || '';
            const tStamp = entry.date || '';
            
            // Generate composite validation key
            const uniqueKey = pId ? pId : `${mLabel}_${tStamp}`;
            
            // If we somehow get a duplicate with exact same timestamp and month, this overwrites/ignores it
            uniqueHistoryMap.set(uniqueKey, entry);
        });

        // Convert back to array
        let history = Array.from(uniqueHistoryMap.values());

        if (history.length === 0) {
            renderEmptyState();
            return;
        }

        // Sort descending by date (newest first)
        history.sort((a, b) => new Date(b.date) - new Date(a.date));

        const fragment = document.createDocumentFragment();

        history.forEach(entry => {
            const dateObj = new Date(entry.date);
            const dateStr = dateObj.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            // Determine status classes and text
            let statusClass = 'status-paid';
            let statusIcon = '<i class="fa-solid fa-check-double"></i>';
            let remarksHtml = '';
            
            const lateDays = parseInt(entry.lateDays) || 0;
            if (lateDays > 0) {
                statusClass = 'status-late';
                statusIcon = '<i class="fa-solid fa-clock"></i>';
                remarksHtml = `
                    <div class="hi-remarks">
                        <i class="fa-solid fa-circle-exclamation"></i>
                        <span>Paid ${lateDays} day${lateDays > 1 ? 's' : ''} late</span>
                    </div>
                `;
            }

            const card = document.createElement('div');
            card.className = `history-item ${statusClass}`;
            card.innerHTML = `
                <div class="hi-icon-wrap">
                    ${statusIcon}
                </div>
                <div class="hi-details">
                    <span class="hi-month">${entry.monthLabel || 'Payment'}</span>
                    <span class="hi-date">${dateStr}</span>
                    ${remarksHtml}
                </div>
                <div class="hi-meta">
                    <span class="hi-amount">₹${entry.amount || 0}</span>
                    <span class="hi-status-badge">${lateDays > 0 ? 'Paid Late' : 'Paid'}</span>
                </div>
            `;
            
            fragment.appendChild(card);
        });

        if (feeHistoryTimeline) {
            feeHistoryTimeline.innerHTML = '';
            feeHistoryTimeline.appendChild(fragment);
        }
    };

    const renderEmptyState = () => {
        if (!feeHistoryTimeline) return;
        feeHistoryTimeline.innerHTML = `
            <div class="empty-history">
                <i class="fa-solid fa-clock-rotate-left"></i>
                <h3>No payment history available</h3>
                <p>Your fee payment records will appear here.</p>
            </div>
        `;
    };

    // One-time render flow based on local cache
    renderHistory();
});
