"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardBody, Button } from "@nextui-org/react";
import { useNotifications } from "../context/NotificationContext";
import { supabase } from "@/lib/supabase";
import { ProtectedRoute } from "../components/ProtectedRoute";

interface Notification {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  user_id: string;
}

export default function Notifications() {
  const { notifications, setNotifications, user } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetching = useRef(false); // Prevent concurrent fetches

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || isFetching.current) {
      setLoading(false);
      if (!userId) {
        setError("User not authenticated");
      }
      return;
    }

    // If notifications are already loaded by NotificationContext, use them
    if (notifications.length > 0) {
      setLoading(false);
      return;
    }

    const fetchNotifications = async () => {
      isFetching.current = true;
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("timestamp", { ascending: false });
        if (error) throw error;
        setNotifications(data || []);
      } catch (err) {
        console.error("Error fetching notifications:", err);
        setError("Failed to load notifications. Please try again later.");
      } finally {
        setLoading(false);
        isFetching.current = false;
      }
    };

    fetchNotifications();
  }, [userId]); // Only depend on userId, not setNotifications

  const markAsRead = async (id: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification
        )
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const dismissNotification = async (id: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    } catch (err) {
      console.error("Error dismissing notification:", err);
    }
  };

  if (loading) {
    return <div className="text-center p-6">Loading notifications...</div>;
  }

  if (error) {
    return <div className="text-center p-6 text-red-500">{error}</div>;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100 p-6">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-900">Notifications</h1>
        <Link href="/" className="text-blue-500 hover:underline mb-6 block">
          Back to Dashboard
        </Link>
        {notifications.length === 0 ? (
          <p className="text-center text-gray-600">No notifications yet.</p>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <Card key={notification.id} className="shadow-md">
                <CardBody>
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-semibold">{notification.title}</h2>
                      <p className="text-gray-600">
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                      <p className="mt-2">{notification.body}</p>
                    </div>
                    <div className="flex space-x-2">
                      {!notification.read && (
                        <Button
                          size="sm"
                          color="primary"
                          onPress={() => markAsRead(notification.id)} // Changed onClick to onPress
                        >
                          Mark as Read
                        </Button>
                      )}
                      <Button
                        size="sm"
                        color="danger"
                        onPress={() => dismissNotification(notification.id)} // Changed onClick to onPress
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}