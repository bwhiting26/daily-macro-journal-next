"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardBody, Input, Progress, Button } from "@nextui-org/react";
import Link from "next/link";
import axios from "axios";
import { supabase } from "@/lib/supabase";

interface Entry {
  time: string;
  date: string;
  food: string;
  macros: {
    protein: string | number;
    fat: string | number;
    carbs: string | number;
  };
}

interface Notification {
  id: number;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

export default function Dashboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [calorieGoal, setCalorieGoal] = useState<number>(2000);
  const [proteinPercent, setProteinPercent] = useState<number>(35);
  const [fatPercent, setFatPercent] = useState<number>(30);
  const [carbPercent, setCarbPercent] = useState<number>(35);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [report, setReport] = useState("");
  const [dailyQuote, setDailyQuote] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [learningPeriodComplete, setLearningPeriodComplete] = useState(false);
  const [firstEntryDate, setFirstEntryDate] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [lastSnackReminder, setLastSnackReminder] = useState<number | null>(null);
  const [today, setToday] = useState("");

  const hasCompletedLearningRef = useRef(learningPeriodComplete);
  const hasGeneratedQuoteRef = useRef(false);
  const hasGeneratedReportRef = useRef(false);

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-CA"));

    const fetchEntries = async () => {
      const { data, error: entriesError } = await supabase.from("entries").select("*");
      if (entriesError) {
        console.error("Error fetching entries:", entriesError);
        return;
      }
      setEntries(data || []);
    };

    const fetchNotifications = async () => {
      const { data, error: notificationsError } = await supabase
        .from("notifications")
        .select("*")
        .order("timestamp", { ascending: false });
      if (notificationsError) {
        console.error("Error fetching notifications:", notificationsError);
        return;
      }
      setNotifications(data || []);
    };

    const fetchLearningPeriod = async () => {
      const { data, error: learningError } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "learningPeriodComplete")
        .maybeSingle();
      if (learningError) {
        console.error("Error fetching learning period:", JSON.stringify(learningError, null, 2));
        return;
      }
      if (data && data.value !== undefined) {
        setLearningPeriodComplete(data.value);
      }
    };

    const fetchFirstEntryDate = async () => {
      const { data, error: firstEntryError } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "firstEntryDate")
        .maybeSingle();
      if (firstEntryError) {
        console.error("Error fetching first entry date:", JSON.stringify(firstEntryError, null, 2));
        return;
      }
      if (data && data.value !== undefined) {
        setFirstEntryDate(data.value);
      }
    };

    const fetchQuote = async () => {
      const { data, error: quoteError } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "dailyQuote")
        .maybeSingle();
      if (quoteError) {
        console.error("Error fetching daily quote:", JSON.stringify(quoteError, null, 2));
        return;
      }
      if (data && data.value && data.value.dailyQuoteDate === new Date().toLocaleDateString("en-CA")) {
        setDailyQuote(data.value.dailyQuote);
      }
    };

    const fetchLastSnackReminder = async () => {
      const { data, error: snackError } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "lastSnackReminder")
        .maybeSingle();
      if (snackError) {
        console.error("Error fetching last snack reminder:", JSON.stringify(snackError, null, 2));
        return;
      }
      if (data && data.value !== undefined) {
        setLastSnackReminder(data.value);
      }
    };

    fetchEntries();
    fetchNotifications();
    fetchLearningPeriod();
    fetchFirstEntryDate();
    fetchQuote();
    fetchLastSnackReminder();
  }, []);

  const proteinGrams = ((proteinPercent / 100) * calorieGoal) / 4;
  const fatGrams = ((fatPercent / 100) * calorieGoal) / 9;
  const carbGrams = ((carbPercent / 100) * calorieGoal) / 4;
  const todayEntries = today ? (Array.isArray(entries) ? entries.filter((entry) => entry.date === today) : []) : [];
  const currentProtein = todayEntries.reduce((sum, entry) => sum + Number(entry.macros?.protein || 0), 0);
  const currentFat = todayEntries.reduce((sum, entry) => sum + Number(entry.macros?.fat || 0), 0);
  const currentCarbs = todayEntries.reduce((sum, entry) => sum + Number(entry.macros?.carbs || 0), 0);

  const uniqueDays = today ? [...new Set(entries.map((entry) => entry.date))] : [];
  const hasEnoughData = uniqueDays.length >= 5;
  const isFirstDay = entries.length === 0 || (firstEntryDate && today === firstEntryDate);

  useEffect(() => {
    if (entries.length > 0 && !firstEntryDate) {
      const earliestEntry = entries.reduce((earliest, entry) => {
        const entryDate = new Date(entry.date);
        return !earliest || entryDate < new Date(earliest.date) ? entry : earliest;
      }, null);
      const firstDate = earliestEntry.date;
      setFirstEntryDate(firstDate);
      supabase
        .from("settings")
        .upsert({ key: "firstEntryDate", value: firstDate })
        .then(({ error: upsertError }) => {
          if (upsertError) console.error("Error saving first entry date:", upsertError);
        });
    }
  }, [entries, firstEntryDate]);

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setNotificationPermission("denied");
      return;
    }
    if (Notification.permission === "default" || Notification.permission === "denied") {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
      });
    }
  }, []);

  useEffect(() => {
    if (!today) return;
    if (notificationPermission !== "granted") return;
    if (learningPeriodComplete || uniqueDays.length !== 0) return;

    const hasWelcomeNotification = notifications.some(
      (notification) => notification.title === "Welcome to Daily Macro Journal!"
    );
    if (hasWelcomeNotification) return;

    try {
      new Notification("Welcome to Daily Macro Journal!", {
        body: "We’re getting to know your eating habits—when you eat, what you enjoy, and how you balance your macros. Log your meals for 5 days, and we’ll start providing personalized insights to help you reach your goals! 🌟",
      });
      const nowTimestamp = new Date().getTime();
      const newNotification = {
        id: nowTimestamp,
        title: "Welcome to Daily Macro Journal!",
        body: "We’re getting to know your eating habits—when you eat, what you enjoy, and how you balance your macros. Log your meals for 5 days, and we’ll start providing personalized insights to help you reach your goals! 🌟",
        timestamp: nowTimestamp,
        read: false,
      };
      supabase
        .from("notifications")
        .insert([newNotification])
        .then(({ error: insertError }) => {
          if (insertError) {
            console.error("Error saving welcome notification:", insertError);
          } else {
            setNotifications((prev) => [...prev, newNotification]);
          }
        });
    } catch (error) {
      console.error("Initial Notification Error:", error);
    }
  }, [notificationPermission, learningPeriodComplete, uniqueDays.length, notifications, today]);

  useEffect(() => {
    if (!today) return;
    if (notificationPermission !== "granted") return;
    if (learningPeriodComplete || !hasEnoughData || hasCompletedLearningRef.current) return;

    const hasCompletionNotification = notifications.some(
      (notification) => notification.title === "Learning Period Complete!"
    );
    if (hasCompletionNotification) return;

    try {
      new Notification("Learning Period Complete!", {
        body: "We’ve learned your eating patterns! From now on, expect tailored insights to keep you on track—let’s make every meal count! 🎉",
      });
      const nowTimestamp = new Date().getTime();
      const newNotification = {
        id: nowTimestamp,
        title: "Learning Period Complete!",
        body: "We’ve learned your eating patterns! From now on, expect tailored insights to keep you on track—let’s make every meal count! 🎉",
        timestamp: nowTimestamp,
        read: false,
      };
      supabase
        .from("notifications")
        .insert([newNotification])
        .then(({ error: insertError }) => {
          if (insertError) {
            console.error("Error saving completion notification:", insertError);
          } else {
            setNotifications((prev) => [...prev, newNotification]);
            setLearningPeriodComplete(true);
            supabase
              .from("settings")
              .upsert({ key: "learningPeriodComplete", value: true })
              .then(({ error: upsertError }) => {
                if (upsertError) console.error("Error saving learning period:", upsertError);
              });
          }
        });
      hasCompletedLearningRef.current = true;
    } catch (error) {
      console.error("Completion Notification Error:", error);
    }
  }, [notificationPermission, hasEnoughData, learningPeriodComplete, notifications, today]);

  useEffect(() => {
    if (!today) return;
    const hasDailyMotivation = notifications.some(
      (notification) =>
        notification.title === "Daily Motivation" &&
        new Date(notification.timestamp).toLocaleDateString("en-CA") === today
    );
    if (hasDailyMotivation) {
      setQuoteLoading(false);
      return;
    }

    const generateQuote = async () => {
      const prompt = `Generate a short, motivational quote (1-2 sentences) for a health and fitness app user to encourage them in their macro tracking journey. Keep it positive, concise, and inspiring, and do not include quotation marks around the quote.`;
      try {
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/claude-snack`,
          { prompt },
          { headers: { "Content-Type": "application/json" } }
        );
        const quote = response.data.text;
        setDailyQuote(quote);
        await supabase
          .from("settings")
          .upsert({ key: "dailyQuote", value: { dailyQuote: quote, dailyQuoteDate: today } });

        const nowTimestamp = new Date().getTime();
        const newNotification = {
          id: nowTimestamp,
          title: "Daily Motivation",
          body: quote,
          timestamp: nowTimestamp,
          read: false,
        };
        const { error: insertError } = await supabase.from("notifications").insert([newNotification]);
        if (insertError) {
          console.error("Error saving daily motivation notification:", insertError);
        } else {
          setNotifications((prev) => [...prev, newNotification]);
        }
        hasGeneratedQuoteRef.current = true;
      } catch (error) {
        console.error("Error generating motivational quote:", error);
        const fallbackQuote = "Keep pushing forward—you’ve got this!";
        setDailyQuote(fallbackQuote);
        await supabase
          .from("settings")
          .upsert({ key: "dailyQuote", value: { dailyQuote: fallbackQuote, dailyQuoteDate: today } });

        const nowTimestamp = new Date().getTime();
        const newNotification = {
          id: nowTimestamp,
          title: "Daily Motivation",
          body: fallbackQuote,
          timestamp: nowTimestamp,
          read: false,
        };
        const { error: insertError } = await supabase.from("notifications").insert([newNotification]);
        if (insertError) {
          console.error("Error saving fallback notification:", insertError);
        } else {
          setNotifications((prev) => [...prev, newNotification]);
        }
        hasGeneratedQuoteRef.current = true;
      } finally {
        setQuoteLoading(false);
      }
    };

    setQuoteLoading(true);
    generateQuote();
  }, [today, notifications]);

  useEffect(() => {
    if (!today) return;
    if (notificationPermission !== "granted") return;
    if (!hasEnoughData) return;
  
    const checkSnackTime = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentEntries = entries.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= thirtyDaysAgo;
      });
  
      // Analyze eating patterns
      const foodFrequency = recentEntries.reduce((acc, entry) => {
        acc[entry.food] = (acc[entry.food] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
  
      const mostFrequentFoods = Object.entries(foodFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([food]) => food);
  
      const leastFrequentFoods = Object.entries(foodFrequency)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .map(([food]) => food);
  
      const mealTimes = recentEntries
        .map((entry) => {
          const [time, period] = entry.time.split(" ");
          let [hours, minutes] = time.split(":").map(Number);
          if (period === "PM" && hours !== 12) hours += 12;
          if (period === "AM" && hours === 12) hours = 0;
          return hours * 60 + minutes;
        })
        .sort((a, b) => a - b);
  
      const avgMealTime =
        mealTimes.length > 0
          ? mealTimes.reduce((sum, time) => sum + time, 0) / mealTimes.length
          : 0;
      const avgMealHour = Math.floor(avgMealTime / 60);
      const avgMealMinute = Math.round(avgMealTime % 60);
      const typicalMealTime = `${avgMealHour}:${avgMealMinute.toString().padStart(2, "0")}${
        avgMealHour >= 12 ? "PM" : "AM"
      }`;
  
      const gaps = [];
      for (let i = 1; i < mealTimes.length; i++) {
        gaps.push(mealTimes[i] - mealTimes[i - 1]);
      }
      const avgGap = gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 180;
  
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const todayTimes = todayEntries
        .map((entry) => {
          const [time, period] = entry.time.split(" ");
          let [hours, minutes] = time.split(":").map(Number);
          if (period === "PM" && hours !== 12) hours += 12;
          if (period === "AM" && hours === 12) hours = 0;
          return hours * 60 + minutes;
        })
        .sort((a, b) => a - b);
      const lastMealTime = todayTimes.length > 0 ? todayTimes[todayTimes.length - 1] : -Infinity;
  
      const lastMealTimestamp = todayEntries.length > 0 ? new Date(`${todayEntries[todayEntries.length - 1].date} ${todayEntries[todayEntries.length - 1].time}`).getTime() : 0;
      if (lastSnackReminder && lastSnackReminder > lastMealTimestamp) {
        return;
      }
  
      const recentSnackNotification = notifications.some(
        (notification) =>
          notification.title === "Snack Time! 🍎" &&
          now.getTime() - notification.timestamp < 30 * 60 * 1000 // 30-minute window
      );
      if (recentSnackNotification) return;
  
      if (currentMinutes - lastMealTime > avgGap) {
        const prompt = `Suggest a quick snack to help meet macro goals. Keep it positive and concise (1-2 sentences). Current intake: Protein ${currentProtein}g/${proteinGrams}g, Fat ${currentFat}g/${fatGrams}g, Carbs ${currentCarbs}g/${carbGrams}g. Based on the user's eating habits over the last 30 days, they frequently eat ${mostFrequentFoods.join(", ")}, tend to avoid ${leastFrequentFoods.join(", ")}, and typically eat around ${typicalMealTime}. Recent entries: ${JSON.stringify(recentEntries)}. Suggest a snack that aligns with their eating habits and helps meet their macro goals.`;
        try {
          const response = await axios.post(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/claude-snack`,
            { prompt },
            { headers: { "Content-Type": "application/json" } }
          );
          const snackSuggestion = response.data.text;
          try {
            new Notification("Snack Time! 🍎", {
              body: `It’s ${now.toLocaleTimeString()}—time for a snack? ${snackSuggestion}`,
            });
            const nowTimestamp = now.getTime();
            const newNotification = {
              id: nowTimestamp,
              title: "Snack Time! 🍎",
              body: `It’s ${now.toLocaleTimeString()}—time for a snack? ${snackSuggestion}`,
              timestamp: nowTimestamp,
              read: false,
            };
            const { error: insertError } = await supabase.from("notifications").insert([newNotification]);
            if (insertError) {
              console.error("Error saving snack notification:", insertError);
            } else {
              setNotifications((prev) => [...prev, newNotification]);
              setLastSnackReminder(nowTimestamp);
              await supabase
                .from("settings")
                .upsert({ key: "lastSnackReminder", value: nowTimestamp });
            }
          } catch (error) {
            console.error("Notification Error:", error);
          }
        } catch (error) {
          console.error("Snack Suggestion Error:", error);
        }
      }
    };
  
    const intervalId = setInterval(checkSnackTime, 30 * 60 * 1000); // 30-minute interval
    checkSnackTime(); // Run immediately on mount
    return () => clearInterval(intervalId); // Clear interval on unmount
  }, [notificationPermission, entries, calorieGoal, proteinPercent, fatPercent, carbPercent, hasEnoughData, notifications, today]);

  useEffect(() => {
    if (entries.length === 0) {
      setReport("Log your first meal to start tracking your macros!");
      return;
    }
    if (!today) return;
    const generateReport = async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString("en-CA");
      const yesterdayEntries = entries.filter((entry) => entry.date === yesterdayStr);
      const yesterdayProtein = yesterdayEntries.reduce((sum, entry) => sum + Number(entry.macros?.protein || 0), 0);
      const yesterdayFat = yesterdayEntries.reduce((sum, entry) => sum + Number(entry.macros?.fat || 0), 0);
      const yesterdayCarbs = yesterdayEntries.reduce((sum, entry) => sum + Number(entry.macros?.carbs || 0), 0);

      const prompt = `📊 Generate a positive daily macro report for yesterday. Keep it encouraging, with no shaming. Include:
      - A summary of the user's goals and actual intake.
      - Intuitive, specific suggestions to help the user meet their goals, based on yesterday's entries. Suggestions can include:
        * Adding a food (e.g., "Add 6 oz of chicken for 30g protein").
        * Swapping a food (e.g., "Swap your apple for Greek yogurt to add 18g protein").
        * Reducing a food (e.g., "Try having a bit less potato to balance your carbs").
        * Adjusting quantities (e.g., "Reduce your rice from 300g to 250g and increase your ground beef from 8 oz to 10 oz").
        * Or no suggestion if the user is on track (just celebrate their success).
      Be creative and precise, focusing on the most impactful change. If no entries exist, provide a fresh-start message with a generic suggestion.

      Goals:
      - Calories: ${calorieGoal} kcal
      - Protein: ${proteinPercent}% (${proteinGrams}g)
      - Fat: ${fatPercent}% (${fatGrams}g)
      - Carbs: ${carbPercent}% (${carbGrams}g)

      Yesterday's Intake:
      - Protein: ${yesterdayProtein}g
      - Fat: ${yesterdayFat}g
      - Carbs: ${yesterdayCarbs}g

      Yesterday's Entries: ${yesterdayEntries.length > 0 ? JSON.stringify(yesterdayEntries) : "No entries logged."}`;

      try {
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/claude-report`,
          { prompt },
          { headers: { "Content-Type": "application/json" } }
        );
        setReport(response.data.text);
        await supabase
          .from("settings")
          .upsert({ key: "dailyReport", value: { dailyReport: response.data.text, dailyReportDate: today } });
        hasGeneratedReportRef.current = true;
      } catch (error) {
        console.error("Error generating report:", error);
        setReport("Oops, couldn’t generate your report—try again later!");
        hasGeneratedReportRef.current = true;
      }
    };
    generateReport();
  }, [calorieGoal, proteinPercent, fatPercent, carbPercent, entries, today]);

  if (!today) return null;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6 text-gray-900">Daily Macro Journal</h1>
      <nav className="mb-6 flex space-x-4">
        <Link href="/journal" className="text-blue-500 hover:underline">
          Go to Food Journal
        </Link>
        <Link href="/notifications" className="text-blue-500 hover:underline">
          Notifications ({notifications.filter(n => !n.read).length})
        </Link>
      </nav>
      <div className="mb-6 bg-blue-50 p-4 rounded shadow text-center">
        <h2 className="text-xl font-semibold mb-2">Daily Motivation</h2>
        {quoteLoading ? (
          <p className="italic text-gray-700">Loading your daily motivation...</p>
        ) : (
          <p className="italic text-gray-700">{dailyQuote}</p>
        )}
      </div>
      {!learningPeriodComplete && (
        <div className="mb-6 bg-yellow-100 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Learning Your Habits</h2>
          <p>We’re getting to know your eating habits! Log your meals for 5 days to unlock personalized insights. Days logged: {uniqueDays.length}/5</p>
        </div>
      )}
      <Card className="mb-6">
        <CardBody>
          <h2 className="text-xl font-semibold mb-2">Daily Report</h2>
          <p>{report}</p>
        </CardBody>
      </Card>
      <div className="mb-4">
        <Input
          label="Calorie Goal"
          type="number"
          value={calorieGoal.toString()}
          onChange={(e) => setCalorieGoal(Number(e.target.value))}
          className="max-w-xs"
          aria-label="Calorie Goal Input"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Input
          label="Protein (%)"
          type="number"
          value={proteinPercent.toString()}
          onChange={(e) => setProteinPercent(Number(e.target.value))}
          aria-label="Protein Percentage Input"
        />
        <Input
          label="Fat (%)"
          type="number"
          value={fatPercent.toString()}
          onChange={(e) => setFatPercent(Number(e.target.value))}
          aria-label="Fat Percentage Input"
        />
        <Input
          label="Carbs (%)"
          type="number"
          value={carbPercent.toString()}
          onChange={(e) => setCarbPercent(Number(e.target.value))}
          aria-label="Carbs Percentage Input"
        />
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-lg font-medium">
            Protein: {currentProtein.toFixed(1)}/{proteinGrams.toFixed(0)}g (
            {((currentProtein / proteinGrams) * 100).toFixed(0)}%)
          </p>
          <Progress
            value={Math.min((currentProtein / proteinGrams) * 100, 100)}
            color="primary"
            aria-label="Protein Progress"
          />
        </div>
        <div>
          <p className="text-lg font-medium">
            Fat: {currentFat.toFixed(1)}/{fatGrams.toFixed(0)}g (
            {((currentFat / fatGrams) * 100).toFixed(0)}%)
          </p>
          <Progress
            value={Math.min((currentFat / fatGrams) * 100, 100)}
            color="success"
            aria-label="Fat Progress"
          />
        </div>
        <div>
          <p className="text-lg font-medium">
            Carbs: {currentCarbs.toFixed(1)}/{carbGrams.toFixed(0)}g (
            {((currentCarbs / carbGrams) * 100).toFixed(0)}%)
          </p>
          <Progress
            value={Math.min((currentCarbs / carbGrams) * 100, 100)}
            color="warning"
            aria-label="Carbs Progress"
          />
        </div>
      </div>
    </div>
  );
}