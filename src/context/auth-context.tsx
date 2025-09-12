
"use client";

import { createContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { onAuthStateChanged, User as FirebaseUser, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";
import { getUserProfile } from "@/services/data-service";
import type { UserProfile } from "@/types";

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const isAuthPage = ["/login", "/signup"].includes(pathname);
    const isAdminOnSignup = userProfile?.role === "Admin" && pathname === "/signup";

    if (!user && !isAuthPage) {
      router.push("/login");
    }
    
    if (user && isAuthPage && !isAdminOnSignup) {
      router.push("/");
    }

  }, [user, userProfile, loading, pathname, router]);


  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(() => ({
     user, userProfile, loading, logout
  }), [user, userProfile, loading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
