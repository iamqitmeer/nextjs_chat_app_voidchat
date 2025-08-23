'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, provider, db } from '@/lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { LoaderCircle, MessageCircle } from 'lucide-react';

export default function LoginPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const signIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        lastSeen: serverTimestamp(),
      }, { merge: true });
      router.push('/');
    } catch (error) {
      console.error("Authentication failed:", error);
    }
  };

  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-900">
        <LoaderCircle className="h-12 w-12 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-900 text-white">
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-zinc-800/50 border border-zinc-700">
            <MessageCircle className="h-16 w-16 text-indigo-400" />
            <h1 className="text-3xl font-bold">Welcome to Chatter</h1>
            <p className="text-zinc-400">Sign in to connect with others.</p>
            <button
            onClick={signIn}
            className="mt-4 flex items-center justify-center gap-3 rounded-full bg-white px-6 py-3 font-semibold text-zinc-900 transition-transform duration-200 hover:scale-105"
            >
            <svg className="h-5 w-5" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.82l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
            Sign in with Google
            </button>
        </div>
    </div>
  );
}