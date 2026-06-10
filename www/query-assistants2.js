const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously, createUserWithEmailAndPassword } = require('firebase/auth');
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

async function test() {
    try {
        const randomEmail = "test" + Date.now() + "@example.com";
        const userCredential = await createUserWithEmailAndPassword(auth, randomEmail, 'password123');
        console.log("Logged in temporarily as:", userCredential.user.uid);
        
        const usersRef = collection(db, 'users');
        const q2 = query(usersRef, where('role', '==', 'assistant'));
        const snap2 = await getDocs(q2);
        console.log(`Found ${snap2.size} TOTAL assistants`);
        snap2.forEach(doc => {
            console.log("Doc ID:", doc.id, "Data:", doc.data());
        });
        
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

test();
