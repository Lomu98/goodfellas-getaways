import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDbIrEzJLGa7wrbfE540mI7vXJdREXNKG8",
  authDomain: "goodfellas-gateways.firebaseapp.com",
  projectId: "goodfellas-gateways",
  storageBucket: "goodfellas-gateways.firebasestorage.app",
  messagingSenderId: "830616895726",
  appId: "1:830616895726:web:0cecd7bd5b8044db26b3ff",
  measurementId: "G-6T3X5N6DV8"
};

let app, db, auth, storage;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
} catch (error) {
  console.error("Firebase Error:", error);
}

export { app, db, auth, storage };
export const appId = 'goodfellas-getaways';
export const SUPER_ADMIN_UIDS = ['yvwwTmgMVcP8btCK0Ve2Yzygozh2'];