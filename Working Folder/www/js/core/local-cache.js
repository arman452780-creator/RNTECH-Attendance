// local-cache.js - Professional Local Cache System for RN-TECH
// Handles offline-first data persistence using IndexedDB and LocalStorage

const DB_NAME = 'RNTechDB';
const DB_VERSION = 2;

class LocalCacheSystem {
    constructor() {
        this.db = null;
        this.initPromise = this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Stores for Teacher Portal
                if (!db.objectStoreNames.contains('classes')) {
                    db.createObjectStore('classes', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('students')) {
                    db.createObjectStore('students', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('attendanceRecords')) {
                    const attStore = db.createObjectStore('attendanceRecords', { keyPath: 'id' });
                    attStore.createIndex('date', 'date', { unique: false });
                    attStore.createIndex('classId', 'classId', { unique: false });
                    attStore.createIndex('studentID', 'studentID', { unique: false });
                }
                
                // Global Stores
                if (!db.objectStoreNames.contains('analytics')) {
                    db.createObjectStore('analytics', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('reports')) {
                    db.createObjectStore('reports', { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                console.error('[LocalCache] IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // --- IndexedDB Methods (For Large Data) ---

    async setItem(storeName, item) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async setBulk(storeName, items) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Clear existing data before bulk insert to prevent stale data
            const clearRequest = store.clear();
            
            clearRequest.onsuccess = () => {
                items.forEach(item => store.put(item));
            };
            
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = (e) => reject(e.target.error);
        });
    }

    async getItem(storeName, id) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAll(storeName) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteItem(storeName, id) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteByIndex(storeName, indexName, value) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.openCursor(value);
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = (e) => reject(e.target.error);
        });
    }

    // --- LocalStorage Methods (For synchronous config/profile needs) ---

    setSync(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('[LocalCache] LocalStorage set error:', e);
        }
    }

    getSync(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            return null;
        }
    }

    removeSync(key) {
        localStorage.removeItem(key);
    }
}

window.LocalCache = new LocalCacheSystem();
window.FeeEngine = {
    calculateFeeStatus: function(student) {
        const feeDetails = student.feeDetails || {};
        const duration = parseInt(feeDetails.courseDuration) || 0;
        const paid = parseInt(feeDetails.paidMonths) || 0;
        
        // 1. Calculate Remaining Fees
        const totalFee = parseInt(feeDetails.totalFee) || 0;
        const monthlyFee = parseInt(feeDetails.monthlyFee) || 0;
        const regFee = parseInt(feeDetails.registrationFee) || 0;
        
        let calculatedTotalFee = 0;
        if (totalFee > 0) {
            calculatedTotalFee = totalFee;
        } else if (monthlyFee > 0 && duration > 0) {
            calculatedTotalFee = monthlyFee * duration;
        }
        
        let remainingFees = 0;
        let hasFeeStructure = false;
        if (calculatedTotalFee > 0) {
            hasFeeStructure = true;
            const payableFee = Math.max(0, calculatedTotalFee - regFee);
            const feesPaid = paid * monthlyFee;
            remainingFees = Math.max(0, payableFee - feesPaid);
        }

        // 2. Calculate Elapsed & Remaining Months
        let elapsedMonths = 0;
        if (feeDetails.joiningDate && duration > 0) {
            const joinDate = new Date(feeDetails.joiningDate);
            if (!isNaN(joinDate.getTime())) {
                const today = new Date();
                elapsedMonths = (today.getFullYear() - joinDate.getFullYear()) * 12 + today.getMonth() - joinDate.getMonth();
                if (today.getDate() < joinDate.getDate()) {
                    elapsedMonths--;
                }
                elapsedMonths = Math.max(0, elapsedMonths);
            }
        }
        const completedMonths = Math.min(elapsedMonths, duration);
        const remainingMonths = Math.max(0, duration - completedMonths);

        // 3. Calculate Next Due Date & Diff Days
        let nextDueNoTime = null;
        let diffDays = 0;
        const today = new Date();
        today.setHours(0,0,0,0);
        
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
            }
        }
        
        const fiveDaysFromNow = new Date(today);
        fiveDaysFromNow.setDate(today.getDate() + 5);

        // 4. Calculate Final Status (The Bug Fix)
        let status = 'upcoming';
        let isFullyPaid = false;

        // "If paidMonths >= courseDuration OR remainingFee <= 0 OR remainingMonths <= 0"
        if (duration > 0 && paid >= duration) isFullyPaid = true;
        if (hasFeeStructure && remainingFees <= 0) isFullyPaid = true;
        if (duration > 0 && remainingMonths <= 0) isFullyPaid = true;

        if (isFullyPaid) {
            status = 'paid';
        } else if (nextDueNoTime && today > nextDueNoTime) {
            status = 'overdue';
        } else if (nextDueNoTime && fiveDaysFromNow >= nextDueNoTime) {
            status = 'due-soon';
        } else {
            status = 'upcoming'; // Treated as 'Active'
        }

        return {
            duration,
            paid,
            remainingMonths,
            completedMonths,
            remainingFees,
            nextDueNoTime,
            diffDays: Math.abs(diffDays),
            status
        };
    }
};

