
"use client";

import { createContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { onAuthStateChanged, User, signOut, Auth } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !user && !["/login", "/signup"].includes(pathname)) {
      router.push("/login");
    }
    if (!loading && user && ["/login", "/signup"].includes(pathname)) {
      router.push("/");
    }
  }, [user, loading, pathname, router]);


  const logout = useCallback(async () => {
    await signOut(auth);
    router.push("/login");
  }, [router]);

  const reloadUser = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await currentUser.reload();
      const refreshedUser = auth.currentUser;
      if (refreshedUser) {
        // Create a new plain object from the refreshed user to ensure React detects the change.
        const userObject = {
          uid: refreshedUser.uid,
          email: refreshedUser.email,
          displayName: refreshedUser.displayName,
          photoURL: refreshedUser.photoURL,
          emailVerified: refreshedUser.emailVerified,
          isAnonymous: refreshedUser.isAnonymous,
          phoneNumber: refreshedUser.phoneNumber,
          providerData: refreshedUser.providerData,
          // Add any other user properties you need
        } as User;
        setUser(userObject);
      } else {
        setUser(null);
      }
    }
  }, []);

  const value = useMemo(() => ({
     user, loading, logout, reloadUser
  }), [user, loading, logout, reloadUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
