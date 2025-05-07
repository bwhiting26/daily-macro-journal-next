"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "../context/NotificationContext";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isUserLoading } = useNotifications();
  const router = useRouter();

  useEffect(() => {
    if (isUserLoading) return; // Wait for user fetch to complete

    if (!user) {
      router.push("/login");
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null; // Redirect will handle navigation to /login
  }

  return <>{children}</>;
};