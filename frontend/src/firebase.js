import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCX0cAJxgBfM_zcmgHRMgUj-jlPUylVzZ8",
  authDomain: "appbatr-1.firebaseapp.com",
  projectId: "appbatr-1",
  storageBucket: "appbatr-1.firebasestorage.app",
  messagingSenderId: "30266399261",
  appId: "1:30266399261:web:2892f338a525a5071484f4",
  measurementId: "G-QNS33PQZ8X",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;