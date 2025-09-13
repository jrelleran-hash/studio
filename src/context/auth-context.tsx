
"use client";

import { createContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { onAuthStateChanged, User as FirebaseUser, signOut, getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { getUserProfile } from "@/services/data-service";
import type { UserProfile } from "@/types";

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Function to set a cookie
const setCookie = (name: string, value: string, days: number) => {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

// Function to erase a cookie
const eraseCookie = (name: string) => {
    document.cookie = name+'=; Max-Age=-99999999;';
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const [profile, token] = await Promise.all([
          getUserProfile(user.uid),
          getIdToken(user, true) // Force refresh of the token
        ]);
        setUserProfile(profile);
        // Set the session cookie for middleware
        setCookie('__session', token, 1);
      } else {
        setUserProfile(null);
        // Clear the session cookie on logout
        eraseCookie('__session');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);


  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    // Erase cookie on explicit logout
    eraseCookie('__session');
    router.push("/login");
  }, [router]);

  const value = useMemo(() => ({
     user, userProfile, loading, logout
  }), [user, userProfile, loading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
