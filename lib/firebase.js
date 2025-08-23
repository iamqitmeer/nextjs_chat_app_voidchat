import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
  apiKey: "AIzaSyBuh-lfuyym_s1EWYNVCpM1BTVwa3NCZfM",
  authDomain: "resume-builder-b8cc2.firebaseapp.com",
  projectId: "resume-builder-b8cc2",
  storageBucket: "resume-builder-b8cc2.appspot.com", // ⚠️ fix: .app → .appspot.com
  messagingSenderId: "345695645751",
  appId: "1:345695645751:web:893629b7faeede5fe48fb2",
  measurementId: "G-CM94Q8G4K3"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

export { auth, db, storage, provider };