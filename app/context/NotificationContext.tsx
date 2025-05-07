"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { User } from "@supabase/supabase-js";
import { usePathname } from "next/navigation";

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
  user: User | null;
  isUserLoading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Utility function for exponential backoff
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [isNotificationsLoaded, setIsNotificationsLoaded] = useState(false);
  const [today, setToday] = useState(new Date().toLocaleDateString("en-CA"));
  const isFetchingNotifications = useRef(false); // Prevent concurrent fetches
  const isHandlingNotifications = useRef(false); // Prevent concurrent notification handling
  const isRefreshingToken = useRef(false); // Prevent concurrent token refreshes
  const pathname = usePathname(); // Get current route

  // Update today when the date changes
  useEffect(() => {
    const interval = setInterval(() => {
      const newToday = new Date().toLocaleDateString("en-CA");
      if (newToday !== today) {
        setToday(newToday);
      }
    }, 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, [today]);

  // Fetch user ID and notification permission on mount
  useEffect(() => {
    // Skip user fetch on login and logout pages
    if (pathname === "/login" || pathname === "/logout") {
      setIsUserLoading(false);
      return;
    }

    const fetchUserWithRetry = async (retryCount = 0): Promise<void> => {
      setIsUserLoading(true);
      try {
        const { data: userData, error } = await supabase.auth.getUser();
        if (error) {
          if ((error.status === 429 || error.message?.includes("rate limit")) && retryCount < 5) {
            // Retry with exponential backoff on 429 errors
            await delay(1000 * Math.pow(2, retryCount));
            return fetchUserWithRetry(retryCount + 1);
          }
          throw error;
        }
        if (!userData.user) {
          setUser(null);
          return;
        }
        setUser(userData.user);
      } catch (err) {
        console.error("Error fetching user:", err);
        setUser(null);
      } finally {
        setIsUserLoading(false);
      }
    };

    fetchUserWithRetry();

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
      });
    }

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        // Clear session and state on sign-out
        await supabase.auth.signOut();
        setUser(null);
        setNotifications([]);
        setIsNotificationsLoaded(false);
        setIsUserLoading(false);
      } else if (event === "TOKEN_REFRESHED") {
        if (isRefreshingToken.current) return;
        isRefreshingToken.current = true;
        try {
          const { data: userData, error } = await supabase.auth.getUser();
          if (error) throw error;
          setUser(userData.user ?? null);
          setNotifications([]);
          setIsNotificationsLoaded(false);
        } catch (err) {
          console.error("Error refreshing token:", err);
          setUser(null);
        } finally {
          isRefreshingToken.current = false;
          setIsUserLoading(false);
        }
      } else if (session?.user) {
        setUser(session.user);
        setIsUserLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname]); // Depend on pathname to re-run when route changes

  // Fetch existing notifications when user is available
  useEffect(() => {
    if (!user || isFetchingNotifications.current) return;

    const fetchNotifications = async (retryCount = 0): Promise<void> => {
      isFetchingNotifications.current = true;
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("timestamp", { ascending: false });
        if (error) {
          if (error.code === "401" && retryCount < 5) {
            // Retry with exponential backoff on 401 errors
            await delay(1000 * Math.pow(2, retryCount));
            return fetchNotifications(retryCount + 1);
          }
          throw error;
        }
        setNotifications(data || []);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      } finally {
        isFetchingNotifications.current = false;
      }
    };

    fetchNotifications();
  }, [user]); // Only depend on user, not notifications

  // Handle notifications
  useEffect(() => {
    if (!user || notificationPermission !== "granted" || isHandlingNotifications.current) return;

    const handleNotifications = async (retryCount = 0): Promise<void> => {
      isHandlingNotifications.current = true;
      try {
        // Fetch entries to determine if user is new
        const { data: entriesData, error: entriesError } = await supabase
          .from("entries")
          .select("*")
          .eq("user_id", user.id);
        if (entriesError) {
          if (entriesError.code === "401" && retryCount < 5) {
            await delay(1000 * Math.pow(2, retryCount));
            return handleNotifications(retryCount + 1);
          }
          throw entriesError;
        }
        const entries = entriesData || [];
        const uniqueDays = [...new Set(entries.map((entry) => entry.date))];

        // Fetch hasSentWelcome
        const { data: welcomeData, error: welcomeError } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "hasSentWelcome")
          .eq("user_id", user.id)
          .maybeSingle();
        if (welcomeError) {
          if (welcomeError.code === "401" && retryCount < 5) {
            await delay(1000 * Math.pow(2, retryCount));
            return handleNotifications(retryCount + 1);
          }
          throw welcomeError;
        }
        const hasSentWelcome = welcomeData && welcomeData.value;

        // Fetch hasSentDailyMotivation
        const { data: dailyMotivationData, error: dailyMotivationError } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "hasSentDailyMotivation")
          .eq("user_id", user.id)
          .maybeSingle();
        if (dailyMotivationError) {
          if (dailyMotivationError.code === "401" && retryCount < 5) {
            await delay(1000 * Math.pow(2, retryCount));
            return handleNotifications(retryCount + 1);
          }
          throw dailyMotivationError;
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
              user_id: user.id,
            };
            new Notification(notification.title, { body: notification.body });
            await supabase.from("notifications").insert([notification]);
            await supabase
              .from("settings")
              .upsert({ key: "hasSentWelcome", value: true, user_id: user.id });
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
              user_id: user.id,
            };
            new Notification(notification.title, { body: notification.body });
            await supabase.from("notifications").insert([notification]);
            await supabase.from("settings").upsert({
              key: "hasSentDailyMotivation",
              value: { sent: true, date: today, dailyQuote: quote },
              user_id: user.id,
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
              user_id: user.id,
            };
            new Notification(notification.title, { body: notification.body });
            await supabase.from("notifications").insert([notification]);
            await supabase.from("settings").upsert({
              key: "hasSentDailyMotivation",
              value: { sent: true, date: today, dailyQuote: fallback },
              user_id: user.id,
            });
            setNotifications((prev) => [...prev, notification]);
          }
        }

        setIsNotificationsLoaded(true);
      } catch (err) {
        console.error("Error in handleNotifications:", err);
      } finally {
        isHandlingNotifications.current = false;
      }
    };

    handleNotifications();
  }, [user, notificationPermission, today]); // Removed notifications as a dependency

  return (
    <NotificationContext.Provider value={{ notifications, setNotifications, isNotificationsLoaded, user, isUserLoading }}>
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