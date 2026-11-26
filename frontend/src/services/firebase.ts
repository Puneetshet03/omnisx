import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA5D15FRK2zR5h1BKNULun1FtWgUMFLSoI",
  authDomain: "omnis-x-19d78.firebaseapp.com",
  projectId: "omnis-x-19d78",
  storageBucket: "omnis-x-19d78.firebasestorage.app",
  messagingSenderId: "37352272880",
  appId: "1:37352272880:web:6247a2a7fa1daef87b2335",
  measurementId: "G-GPXPX48176",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

export let firebaseAnalytics: Analytics | null = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        firebaseAnalytics = getAnalytics(firebaseApp);
      }
    })
    .catch(() => {
      firebaseAnalytics = null;
    });
}

export async function signInWithGoogleFirebase() {
  const result = await signInWithPopup(firebaseAuth, googleProvider);
  return result.user;
}

export async function registerWithEmailFirebase(
  email: string,
  password: string,
  displayName?: string
) {
  const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  if (displayName?.trim()) {
    await updateProfile(result.user, { displayName: displayName.trim() });
  }
  return result.user;
}

export async function signInWithEmailFirebase(email: string, password: string) {
  const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return result.user;
}

export async function signOutFirebase() {
  try {
    await firebaseSignOut(firebaseAuth);
  } catch {
    // ignore if no active Firebase session
  }
}
