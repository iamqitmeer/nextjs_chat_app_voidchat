import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
  apiKey: "AIzaSyAbUB_86YA6N7N0EJW4Y59wf-klZ87qtCw",
  authDomain: "mobile-app-e6dcf.firebaseapp.com",
  projectId: "mobile-app-e6dcf",
  storageBucket: "mobile-app-e6dcf.firebasestorage.app",
  messagingSenderId: "778035759967",
  appId: "1:778035759967:web:6a8494a1a898dfc1ea04ea",
  measurementId: "G-T1N3BFSDN9"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

export { auth, db, storage, provider };