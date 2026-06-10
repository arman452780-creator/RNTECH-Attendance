// firebase-sync.js - Centralized Background Sync System
// Fetches data from Firebase, updates LocalCache, and triggers UI renders

class FirebaseSyncSystem {
    constructor() {
        this.listeners = {};
        this.db = window.firebase ? firebase.firestore() : null;
    }

    // A lightweight event emitter
    on(event, callback) {
        if (!this._events) this._events = {};
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(callback);
    }

    emit(event, data) {
        if (!this._events || !this._events[event]) return;
        this._events[event].forEach(cb => cb(data));
    }

    /**
     * Initializes core app syncing based on Role
     */
    async startSync(role, userId) {
        if (!this.db) {
            console.error('[FirebaseSync] Firebase not initialized');
            return;
        }
        console.log(`[FirebaseSync] Starting background sync for ${role}`);

        // 1. Sync User Profile
        this._syncProfile(userId);

        // 2. Sync Classes (All active classes, handled differently per role in the UI layer, 
        // but synced fully to local cache)
        this._syncClasses();

        // 3. Sync Attendance (Query depends on role)
        this._syncAttendance(role, userId);
        
        // 4. Sync Students (Teacher only)
        if (role === 'teacher') {
            this._syncStudents();
        }
    }

    _syncStudents() {
        if (this.listeners['students']) this.listeners['students']();
        
        this.listeners['students'] = this.db.collection('users')
            .where('role', '==', 'student')
            .onSnapshot(async (snap) => {
                const students = [];
                snap.forEach(doc => students.push({ id: doc.id, ...doc.data() }));
                
                await window.LocalCache.setBulk('students', students);
                this.emit('STUDENTS_UPDATED', students);
            });
    }

    _syncProfile(userId) {
        if (this.listeners['profile']) this.listeners['profile']();
        
        this.listeners['profile'] = this.db.collection('users').doc(userId)
            .onSnapshot(async (doc) => {
                if (doc.exists) {
                    const data = { id: doc.id, ...doc.data() };
                    
                    // LOGIN PROTECTION FOR ASSISTANTS
                    if (data.role === 'assistant' && (data.active === false || data.deleted === true)) {
                        document.body.innerHTML = `
                            <div style="height: 100vh; width: 100vw; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; color: white; font-family: 'Inter', sans-serif; text-align: center; padding: 20px; box-sizing: border-box;">
                                <div style="font-size: 50px; color: #ef4444; margin-bottom: 20px;"><i class="fa-solid fa-ban"></i></div>
                                <h1 style="font-size: 24px; margin: 0 0 10px 0;">Account Disabled</h1>
                                <p style="font-size: 14px; color: #94a3b8; max-width: 300px; margin-bottom: 30px; line-height: 1.5;">Your access to the portal has been suspended. Please contact the administrator.</p>
                                <button onclick="firebase.auth().signOut().then(() => window.location.href='index.html')" style="background: rgba(239,68,68,0.1); border: 1px solid #ef4444; color: #ef4444; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
                            </div>
                        `;
                        return; // Stop further processing
                    }
                    
                    // Profile goes to LocalStorage for fast synchronous access on boot
                    window.LocalCache.setSync('currentUser', data);
                    this.emit('PROFILE_UPDATED', data);
                }
            });
    }

    _syncClasses() {
        if (this.listeners['classes']) this.listeners['classes']();
        
        this.listeners['classes'] = this.db.collection('classes')
            .onSnapshot(async (snap) => {
                const classes = [];
                snap.forEach(doc => classes.push({ id: doc.id, ...doc.data() }));
                
                await window.LocalCache.setBulk('classes', classes);
                this.emit('CLASSES_UPDATED', classes);
            });
    }

    _syncAttendance(role, userId) {
        if (this.listeners['attendance']) this.listeners['attendance']();
        
        let query = this.db.collection('attendanceRecords');
        
        if (role === 'student') {
            query = query.where('studentID', '==', userId);
        } else if (role === 'teacher') {
            // For teacher, sync all historical attendance records to allow completely accurate stats and reports
        }

        this.listeners['attendance'] = query.onSnapshot(async (snap) => {
            const records = [];
            snap.forEach(doc => {
                const data = doc.data();
                // Normalize timestamp for local sorting
                let ts = data.timestamp;
                if (ts && ts.toDate) ts = ts.toDate().getTime();
                else if (ts instanceof Date) ts = ts.getTime();
                else if (typeof ts === 'string') ts = new Date(ts).getTime();
                
                records.push({ id: doc.id, ...data, _ts: ts || 0 });
            });
            
            await window.LocalCache.setBulk('attendanceRecords', records);
            this.emit('ATTENDANCE_UPDATED', records);
        });
    }

    stopAll() {
        Object.keys(this.listeners).forEach(key => {
            if (this.listeners[key]) this.listeners[key]();
        });
        this.listeners = {};
    }
}

window.FirebaseSync = new FirebaseSyncSystem();
