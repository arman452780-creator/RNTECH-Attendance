const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, collection, doc, getDoc, setDoc, query, where, getDocs, serverTimestamp } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyBZ2YxzfGaaMBROHI2IZhf4wPeay4iRL0g",
    authDomain: "attendance-app-22f96.firebaseapp.com",
    projectId: "attendance-app-22f96",
    storageBucket: "attendance-app-22f96.firebasestorage.app",
    messagingSenderId: "449082162049",
    appId: "1:449082162049:web:a13d1c0629c6b05c660680",
    measurementId: "G-GN091EX69N"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function syncUserDocument(uid, email, name, role, course) {
    const userRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userRef);
    let existingData = docSnap.exists() ? docSnap.data() : null;

    const updatedData = {
        userID: uid,
        name: name || (existingData ? (existingData.name || existingData.displayName) : null) || email.split('@')[0],
        email: email,
        role: role || (existingData ? existingData.role : null) || 'student',
        course: course || (existingData ? existingData.course : null) || 'DCA'
    };

    if (existingData && existingData.photoUrl) {
        updatedData.photoUrl = existingData.photoUrl;
    }

    // THE FIX WAS { merge: true }
    await setDoc(userRef, updatedData, { merge: true });
    return updatedData;
}

async function run() {
    try {
        console.log("=== STEP 1: Teacher Logs In (Creating Dummy Teacher) ===");
        const randId = Math.floor(Math.random()*10000);
        const tCred = await createUserWithEmailAndPassword(auth, `dummyteacher${randId}@test.com`, '452780');
        const teacherUid = tCred.user.uid;
        console.log("Teacher UID:", teacherUid);
        
        // Teacher Login sync logic
        await syncUserDocument(teacherUid, tCred.user.email, "Dummy Teacher", "teacher", null);
        
        console.log("\n=== STEP 2: Teacher Creates Assistant ===");
        const assistEmail = `assist${randId}@test.com`;
        const assistPass = 'password123';
        
        const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);
        const aCred = await createUserWithEmailAndPassword(secondaryAuth, assistEmail, assistPass);
        const assistantUid = aCred.user.uid;
        
        await setDoc(doc(db, 'users', assistantUid), {
            name: "Test Assistant " + randId,
            email: assistEmail,
            role: 'assistant',
            active: true,
            createdBy: teacherUid,
            assignedClasses: ['Batch A'],
            createdAt: serverTimestamp()
        });
        await signOut(secondaryAuth);
        
        console.log("Assistant Created with UID:", assistantUid);
        
        // Capture BEFORE
        let beforeSnap = await getDoc(doc(db, 'users', assistantUid));
        console.log("-> Assistant Doc BEFORE Login:", beforeSnap.data());
        
        console.log("\n=== STEP 3: Assistant Logs In ===");
        await signOut(auth); // teacher logs out
        const aCredLogin = await signInWithEmailAndPassword(auth, assistEmail, assistPass);
        
        // Assistant Login sync logic
        await syncUserDocument(assistantUid, assistEmail, null, null, null);
        
        console.log("Assistant logged in and synced.");
        
        // Capture AFTER Assistant Login
        let afterSnap = await getDoc(doc(db, 'users', assistantUid));
        console.log("-> Assistant Doc AFTER Login:", afterSnap.data());
        
        console.log("\n=== STEP 4: Teacher Logs In Afterward ===");
        await signOut(auth); // assistant logs out
        await signInWithEmailAndPassword(auth, `dummyteacher${randId}@test.com`, '452780');
        
        // Teacher Login sync logic (again)
        await syncUserDocument(teacherUid, `dummyteacher${randId}@test.com`, null, null, null);
        
        // Capture AFTER Teacher Login
        let finalSnap = await getDoc(doc(db, 'users', assistantUid));
        console.log("-> Assistant Doc AFTER Teacher Login:", finalSnap.data());
        
        console.log("\n=== STEP 5: Teacher Queries Staff Management ===");
        const q = query(collection(db, 'users'), where('role', '==', 'assistant'), where('createdBy', '==', teacherUid));
        const snap = await getDocs(q);
        console.log(`Found ${snap.size} assistants.`);
        let found = false;
        snap.forEach(d => {
            if (d.id === assistantUid) found = true;
        });
        console.log(`Is our new assistant in the query results? ${found ? 'YES' : 'NO'}`);
        
        process.exit(0);
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

run();
