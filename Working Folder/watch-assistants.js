const { initializeApp } = require('firebase/app');
const { getFirestore, collection, onSnapshot, query, where } = require('firebase/firestore');

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
const db = getFirestore(app);

console.log("Watching for changes to assistants...");

const q = query(collection(db, 'users'));

onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        if (data.role === 'assistant' || change.type === 'removed') {
            console.log(`\n=== DOCUMENT ${change.type.toUpperCase()} ===`);
            console.log(`ID: ${change.doc.id}`);
            console.log("Data:", data);
        }
    });
});
