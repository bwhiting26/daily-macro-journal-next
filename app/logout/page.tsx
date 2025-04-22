"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Logout() {
  const router = useRouter();

  useEffect(() => {
    const signOut = async () => {
      await supabase.auth.signOut();
      router.push("/login");
    };
    signOut();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
      <p className="text-gray-900">Logging out...</p>
    </div>
  );
}