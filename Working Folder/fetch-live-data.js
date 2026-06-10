const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

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
        const randId = Math.floor(Math.random()*10000);
        const cred = await createUserWithEmailAndPassword(auth, `inspector${randId}@test.com`, 'password123');
        console.log("Logged in for inspection...");

        // 1. Find Teacher UID
        const usersRef = collection(db, 'users');
        const tQuery = query(usersRef, where('email', '==', 'irfan834063@gmail.com'));
        const tSnap = await getDocs(tQuery);
        
        if (tSnap.empty) {
            console.log("Teacher irfan834063@gmail.com not found!");
            process.exit(1);
        }
        
        const teacherDoc = tSnap.docs[0];
        const teacherUid = teacherDoc.id;
        console.log("Found Teacher UID:", teacherUid);
        console.log("Teacher Data:", teacherDoc.data());

        console.log("\n=== Assistants created by this Teacher ===");
        const aQuery = query(usersRef, where('role', '==', 'assistant'), where('createdBy', '==', teacherUid));
        const aSnap = await getDocs(aQuery);
        
        aSnap.forEach(doc => {
            console.log("--- Assistant:", doc.id);
            console.log(doc.data());
        });

        console.log("\n=== ANY OTHER Assistants ===");
        const allAQuery = query(usersRef, where('role', '==', 'assistant'));
        const allASnap = await getDocs(allAQuery);
        allASnap.forEach(doc => {
            if (doc.data().createdBy !== teacherUid) {
                console.log("--- Other Assistant:", doc.id);
                console.log(doc.data());
            }
        });
        
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
