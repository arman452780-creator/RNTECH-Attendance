// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBZ2YxzfGaaMBROHI2IZhf4wPeay4iRL0g",
    authDomain: "attendance-app-22f96.firebaseapp.com",
    projectId: "attendance-app-22f96",
    storageBucket: "attendance-app-22f96.firebasestorage.app",
    messagingSenderId: "449082162049",
    appId: "1:449082162049:web:a13d1c0629c6b05c660680",
    measurementId: "G-GN091EX69N"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firestore globally
const db = firebase.firestore();

// Initialize Storage globally
const storage = firebase.storage();
