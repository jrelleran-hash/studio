
"use client";

import { createContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
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
      // Get the latest user object from auth
      const refreshedUser = auth.currentUser;
      // Create a new plain object to ensure React detects the change for re-rendering.
      if (refreshedUser) {
        const userObject: User = {
            uid: refreshedUser.uid,
            email: refreshedUser.email,
            displayName: refreshedUser.displayName,
            photoURL: refreshedUser.photoURL,
            emailVerified: refreshedUser.emailVerified,
            isAnonymous: refreshedUser.isAnonymous,
            phoneNumber: refreshedUser.phoneNumber,
            providerData: refreshedUser.providerData,
            metadata: refreshedUser.metadata,
            providerId: refreshedUser.providerId,
            tenantId: refreshedUser.tenantId,
            delete: refreshedUser.delete,
            getIdToken: refreshedUser.getIdToken,
            getIdTokenResult: refreshedUser.getIdTokenResult,
            reload: refreshedUser.reload,
            toJSON: refreshedUser.toJSON,
        };
        setUser(userObject);
      }
    }
  }, []);

  const value = useMemo(() => ({
     user, loading, logout, reloadUser
  }), [user, loading, logout, reloadUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
