// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FB_API_KEY,
  authDomain:        import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MSG_SENDER_ID,
  appId:             import.meta.env.VITE_FB_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Firestore no acepta ":" en IDs — los reemplazamos por "__"
const toKey = (k) => k.replaceAll(":", "__");

export async function lsGet(k, fallback) {
  try {
    const snap = await getDoc(doc(db, "lm4data", toKey(k)));
    return snap.exists() ? snap.data().value : fallback;
  } catch (e) {
    console.error("lsGet error", k, e);
    return fallback;
  }
}

export async function lsSet(k, v) {
  try {
    await setDoc(doc(db, "lm4data", toKey(k)), { value: v });
  } catch (e) {
    console.error("lsSet error", k, e);
  }
}
