"use client";
import { useState, useEffect } from "react";
import { Card, CardBody, Button } from "@nextui-org/react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Notification {
  id: number;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("timestamp", { ascending: false });
      if (error) {
        console.error("Error fetching notifications:", error);
        return;
      }
      setNotifications(data || []);
    };

    fetchNotifications();
  }, []);

  const handleDismiss = async (id: number) => {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      console.error("Error deleting notification:", error);
      return;
    }
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  };

  const handleMarkAsRead = async (id: number) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
    if (error) {
      console.error("Error marking notification as read:", error);
      return;
    }
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6 text-gray-900">Notifications</h1>
      <nav className="mb-6">
        <Link href="/" className="text-blue-500 hover:underline">
          Back to Dashboard
        </Link>
      </nav>
      {notifications.length === 0 ? (
        <p className="text-center text-gray-900">No notifications yet.</p>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card key={notification.id} className="mb-2">
              <CardBody className="text-gray-900">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className={`text-lg font-semibold ${notification.read ? "text-gray-500" : ""}`}>
                      {notification.title}
                    </h2>
                    <p className="text-gray-600">{new Date(notification.timestamp).toLocaleString()}</p>
                    <p className="mt-2">{notification.body}</p>
                  </div>
                  <div className="flex space-x-2">
                    {!notification.read && (
                      <Button
                        color="primary"
                        onPress={() => handleMarkAsRead(notification.id)}
                        aria-label={`Mark notification as read: ${notification.title}`}
                      >
                        Mark as Read
                      </Button>
                    )}
                    <Button
                      color="danger"
                      onPress={() => handleDismiss(notification.id)}
                      aria-label={`Dismiss notification: ${notification.title}`}
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
  );
}