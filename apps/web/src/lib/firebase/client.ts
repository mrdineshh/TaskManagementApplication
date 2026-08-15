import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** False until real VITE_FIREBASE_* values are baked in at build time (docs/10-OPEN-DECISIONS.md §M4). */
export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | undefined;

function getFirebaseApp(): FirebaseApp {
  if (!firebaseEnabled) {
    throw new Error('Firebase is not configured (missing VITE_FIREBASE_* env vars)');
  }
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig as Record<string, string>);
  }
  return app;
}

/** Opens the Google sign-in popup and returns the Firebase ID token for exchange at POST /auth/google. */
export async function signInWithGoogle(): Promise<string> {
  const auth = getAuth(getFirebaseApp());
  const provider = new GoogleAuthProvider();
  const allowedDomain = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN;
  if (allowedDomain) provider.setCustomParameters({ hd: allowedDomain });
  const result = await signInWithPopup(auth, provider);
  return result.user.getIdToken();
}
