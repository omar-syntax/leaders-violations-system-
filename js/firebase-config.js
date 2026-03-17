// ============================================================
//  🔥 FIREBASE CONFIG — We School of Applied Technology
//  !! IMPORTANT: Replace the values below with your own !!
//  Get them from: Firebase Console → Project Settings → Web App
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9aMDoQnZVkkRuAPZmmMBun8A9BFbJ77A",
  authDomain: "leaders-violation-system.firebaseapp.com",
  projectId: "leaders-violation-system",
  storageBucket: "leaders-violation-system.firebasestorage.app",
  messagingSenderId: "789847744942",
  appId: "1:789847744942:web:6fa58432df105616af683f"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };
