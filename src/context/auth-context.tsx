
"use client";

import { createContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
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

  const value = useMemo(() => ({
     user, loading, logout
  }), [user, loading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
