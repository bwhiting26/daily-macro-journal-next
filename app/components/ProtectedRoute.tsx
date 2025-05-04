"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Added to show loading state
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check for a local session first (works offline if session exists)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }

        // If no local session, try to fetch user (requires internet)
        const { data: userData, error } = await supabase.auth.getUser();
        if (error || !userData.user) {
          setIsAuthenticated(false);
          router.push("/login");
        } else {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        // If offline and no session, redirect to login
        if (!navigator.onLine) {
          setIsAuthenticated(false);
          router.push("/login");
        }
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}