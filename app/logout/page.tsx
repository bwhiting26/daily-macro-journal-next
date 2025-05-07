"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Logout() {
  const router = useRouter();

  useEffect(() => {
    const logout = async () => {
      try {
        // Attempt to sign out with a timeout
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Sign out timed out")), 5000))
        ]);
      } catch (error) {
        console.error("Error signing out:", error);
      } finally {
        // Clear session regardless of success
        localStorage.removeItem("supabase.auth.token");
        router.push("/login");
      }
    };

    logout();
  }, [router]);

  return <div>Logging out...</div>;
}