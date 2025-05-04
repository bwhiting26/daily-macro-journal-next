"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

interface Notification {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  user_id: string;
}

interface NotificationContextType {
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  isNotificationsLoaded: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [isNotificationsLoaded, setIsNotificationsLoaded] = useState(false); // Add loading state
  const hasRunNotificationLogic = useRef(false);

  // Fetch user ID and notification permission on mount
  useEffect(() => {
    const fetchUser = async () => {
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) {
        console.error("User not authenticated:", error);
        return;
      }
      setUserId(userData.user.id);
    };

    fetchUser();

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
      });
    }
  }, []);

  // Fetch existing notifications when user ID is available
  useEffect(() => {
    if (!userId) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false });
      if (error) {
        console.error("Error fetching notifications:", error);
        return;
      }
      setNotifications(data || []);
    };

    fetchNotifications();
  }, [userId]);

  // Handle notifications once user ID is available
  useEffect(() => {
    if (
      !userId ||
      notificationPermission !== "granted" ||
      hasRunNotificationLogic.current
    ) return;

    const handleNotifications = async () => {
      hasRunNotificationLogic.current = true;

      // Fetch entries to determine if user is new
      const { data: entriesData, error: entriesError } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", userId);
      if (entriesError) {
        console.error("Error fetching entries:", entriesError);
        return;
      }
      const entries = entriesData || [];
      const uniqueDays = [...new Set(entries.map((entry) => entry.date))];

      // Fetch hasSentWelcome
      const { data: welcomeData, error: welcomeError } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "hasSentWelcome")
        .eq("user_id", userId)
        .maybeSingle();
      if (welcomeError) {
        console.error("Error fetching hasSentWelcome:", welcomeError);
        return;
      }
      const hasSentWelcome = welcomeData && welcomeData.value;

      // Fetch hasSentDailyMotivation
      const today = new Date().toLocaleDateString("en-CA");
      const { data: dailyMotivationData, error: dailyMotivationError } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "hasSentDailyMotivation")
        .eq("user_id", userId)
        .maybeSingle();
      if (dailyMotivationError) {
        console.error("Error fetching hasSentDailyMotivation:", dailyMotivationError);
        return;
      }
      const hasSentDailyMotivation = dailyMotivationData && dailyMotivationData.value && dailyMotivationData.value.date === today;

      // Welcome notification (once per user)
      if (!hasSentWelcome && uniqueDays.length === 0) {
        const hasWelcome = notifications.some(
          (notification) => notification.title === "Welcome to Daily Macro Journal!"
        );
        if (!hasWelcome) {
          const notification = {
            id: uuidv4(),
            title: "Welcome to Daily Macro Journal!",
            body: "We’re getting to know your eating habits—log your meals for 5 days to unlock personalized insights!",
            timestamp: Date.now(),
            read: false,
            user_id: userId,
          };
          new Notification(notification.title, { body: notification.body });
          await supabase.from("notifications").insert([notification]);
          await supabase
            .from("settings")
            .upsert({ key: "hasSentWelcome", value: true, user_id: userId });
          setNotifications((prev) => [...prev, notification]);
        }
      }

      // Daily motivation (once per day)
      if (!hasSentDailyMotivation) {
        try {
          const response = await axios.post(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/claude-snack`,
            { prompt: "Generate a short, motivational quote (1-2 sentences) for a health and fitness app user to encourage them in their macro tracking journey. Keep it positive, concise, and inspiring, and do not include quotation marks around the quote." },
            { headers: { "Content-Type": "application/json" } }
          );
          const quote = response.data.text;
          const notification = {
            id: uuidv4(),
            title: "Daily Motivation",
            body: quote,
            timestamp: Date.now(),
            read: false,
            user_id: userId,
          };
          new Notification(notification.title, { body: notification.body });
          await supabase.from("notifications").insert([notification]);
          await supabase.from("settings").upsert({
            key: "hasSentDailyMotivation",
            value: { sent: true, date: today, dailyQuote: quote },
            user_id: userId,
          });
          setNotifications((prev) => [...prev, notification]);
        } catch (error) {
          console.error("Failed to generate quote:", error);
          const fallback = "Keep pushing forward—you’ve got this!";
          const notification = {
            id: uuidv4(),
            title: "Daily Motivation",
            body: fallback,
            timestamp: Date.now(),
            read: false,
            user_id: userId,
          };
          new Notification(notification.title, { body: notification.body });
          await supabase.from("notifications").insert([notification]);
          await supabase.from("settings").upsert({
            key: "hasSentDailyMotivation",
            value: { sent: true, date: today, dailyQuote: fallback },
            user_id: userId,
          });
          setNotifications((prev) => [...prev, notification]);
        }
      }

      // Mark notifications as loaded
      setIsNotificationsLoaded(true);
    };

    handleNotifications();
  }, [userId, notificationPermission, notifications]);

  return (
    <NotificationContext.Provider value={{ notifications, setNotifications, isNotificationsLoaded }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};