const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = require('firebase/firestore');

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

async function run() {
    try {
        console.log("=== STEP 1: Setting up Teacher ===");
        const randId = Math.floor(Math.random()*100000);
        const teacherEmail = `dummyteacher${randId}@test.com`;
        const tCred = await createUserWithEmailAndPassword(auth, teacherEmail, '452780');
        const teacherUid = tCred.user.uid;
        
        await setDoc(doc(db, 'users', teacherUid), {
            name: "Dummy Teacher", email: teacherEmail, role: 'teacher', active: true
        });
        
        console.log("Teacher UID:", teacherUid);
        
        console.log("\n=== STEP 2: Creating Assistant ===");
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
            assignedClasses: ['Batch A', 'Batch B'],
            createdAt: serverTimestamp()
        });
        await signOut(secondaryAuth);
        
        console.log("Assistant Created with UID:", assistantUid);
        
        let beforeSnap = await getDoc(doc(db, 'users', assistantUid));
        console.log("\n-> Assistant Doc IMMEDIATELY AFTER CREATION:", beforeSnap.data());
        
        console.log("\n=== PAUSING FOR MANUAL TEST ===");
        console.log(`Please login manually on your device/browser with:`);
        console.log(`Assistant Email: ${assistEmail}`);
        console.log(`Assistant Password: ${assistPass}`);
        console.log(`\nTeacher Email: ${teacherEmail}`);
        console.log(`Teacher Password: 452780`);
        console.log(`\nRun another script to fetch the document once you're done.`);
        
        process.exit(0);
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

run();
