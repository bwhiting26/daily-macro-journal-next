"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardBody, Input, Progress, Button } from "@nextui-org/react";
import Link from "next/link";
import axios from "axios";

// Define the Entry interface
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

// Define the Notification interface
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
  const today = new Date().toLocaleDateString("en-CA");
  const hasCompletedLearningRef = useRef(learningPeriodComplete);
  const hasGeneratedQuoteRef = useRef(false);
  const hasGeneratedReportRef = useRef(false);

  const proteinGrams = ((proteinPercent / 100) * calorieGoal) / 4;
  const fatGrams = ((fatPercent / 100) * calorieGoal) / 9;
  const carbGrams = ((carbPercent / 100) * calorieGoal) / 4;
  const todayEntries = Array.isArray(entries) ? entries.filter((entry) => entry.date === today) : [];
  const currentProtein = todayEntries.reduce((sum, entry) => sum + Number(entry.macros?.protein || 0), 0);
  const currentFat = todayEntries.reduce((sum, entry) => sum + Number(entry.macros?.fat || 0), 0);
  const currentCarbs = todayEntries.reduce((sum, entry) => sum + Number(entry.macros?.carbs || 0), 0);

  const uniqueDays = [...new Set(entries.map((entry) => entry.date))];
  const hasEnoughData = uniqueDays.length >= 5;
  const isFirstDay = entries.length === 0 || (firstEntryDate && today === firstEntryDate);

  useEffect(() => {
    const savedEntries = localStorage.getItem("macroEntries");
    if (savedEntries) {
      setEntries(JSON.parse(savedEntries));
    }
    const savedNotifications = localStorage.getItem("notifications");
    if (savedNotifications) {
      setNotifications(JSON.parse(savedNotifications));
    }
    const savedLearningPeriod = localStorage.getItem("learningPeriodComplete");
    if (savedLearningPeriod) {
      setLearningPeriodComplete(JSON.parse(savedLearningPeriod));
    }
    const savedFirstEntryDate = localStorage.getItem("firstEntryDate");
    if (savedFirstEntryDate) {
      setFirstEntryDate(savedFirstEntryDate);
    }
    const savedQuote = localStorage.getItem("dailyQuote");
    const savedQuoteDate = localStorage.getItem("dailyQuoteDate");
    if (savedQuote && savedQuoteDate === today) {
      setDailyQuote(savedQuote);
    }
    const savedLastSnackReminder = localStorage.getItem("lastSnackReminder");
    if (savedLastSnackReminder) {
      setLastSnackReminder(parseInt(savedLastSnackReminder, 10));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("macroEntries", JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem("notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    if (entries.length > 0 && !firstEntryDate) {
      const earliestEntry = entries.reduce((earliest, entry) => {
        const entryDate = new Date(entry.date);
        return !earliest || entryDate < new Date(earliest.date) ? entry : earliest;
      }, null);
      const firstDate = earliestEntry.date;
      setFirstEntryDate(firstDate);
      localStorage.setItem("firstEntryDate", firstDate);
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
    if (notificationPermission !== "granted") return;
    if (learningPeriodComplete || uniqueDays.length !== 0) return;

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
      setNotifications((prev) => [...prev, newNotification]);
    } catch (error) {
      console.error("Initial Notification Error:", error);
    }
  }, [notificationPermission, learningPeriodComplete, uniqueDays.length]);

  useEffect(() => {
    if (notificationPermission !== "granted") return;
    if (learningPeriodComplete || !hasEnoughData || hasCompletedLearningRef.current) return;

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
      setNotifications((prev) => [...prev, newNotification]);
      setLearningPeriodComplete(true);
      localStorage.setItem("learningPeriodComplete", JSON.stringify(true));
      hasCompletedLearningRef.current = true;
    } catch (error) {
      console.error("Completion Notification Error:", error);
    }
  }, [notificationPermission, hasEnoughData, learningPeriodComplete]);

  useEffect(() => {
    const savedDate = localStorage.getItem("dailyQuoteDate");
    if (savedDate === today && hasGeneratedQuoteRef.current) {
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
        localStorage.setItem("dailyQuote", quote);
        localStorage.setItem("dailyQuoteDate", today);
        hasGeneratedQuoteRef.current = true;

        const nowTimestamp = new Date().getTime();
        const newNotification = {
          id: nowTimestamp,
          title: "Daily Motivation",
          body: quote,
          timestamp: nowTimestamp,
          read: false,
        };
        setNotifications((prev) => [...prev, newNotification]);
      } catch (error) {
        console.error("Error generating motivational quote:", error);
        const fallbackQuote = "Keep pushing forward—you’ve got this!";
        setDailyQuote(fallbackQuote);
        localStorage.setItem("dailyQuote", fallbackQuote);
        localStorage.setItem("dailyQuoteDate", today);
        hasGeneratedQuoteRef.current = true;

        const nowTimestamp = new Date().getTime();
        const newNotification = {
          id: nowTimestamp,
          title: "Daily Motivation",
          body: fallbackQuote,
          timestamp: nowTimestamp,
          read: false,
        };
        setNotifications((prev) => [...prev, newNotification]);
      } finally {
        setQuoteLoading(false);
      }
    };

    setQuoteLoading(true);
    generateQuote();
  }, [today]);

  useEffect(() => {
    if (notificationPermission !== "granted") return;
    if (!hasEnoughData) return;

    const checkSnackTime = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentEntries = entries.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= thirtyDaysAgo;
      });

      const allTimes = recentEntries
        .map((entry) => {
          const [time, period] = entry.time.split(" ");
          let [hours, minutes] = time.split(":").map(Number);
          if (period === "PM" && hours !== 12) hours += 12;
          if (period === "AM" && hours === 12) hours = 0;
          return hours * 60 + minutes;
        })
        .sort((a, b) => a - b);

      const gaps = [];
      for (let i = 1; i < allTimes.length; i++) {
        gaps.push(allTimes[i] - allTimes[i - 1]);
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

      if (currentMinutes - lastMealTime > avgGap) {
        const prompt = `Suggest a quick snack to help meet macro goals. Keep it positive and concise. Current intake: Protein ${currentProtein}g/${proteinGrams}g, Fat ${currentFat}g/${fatGrams}g, Carbs ${currentCarbs}g/${carbGrams}g. Analyze the user's eating habits over the last 30 days to identify patterns and preferences (e.g., frequently eaten foods, avoided foods, typical meal times). Here are the recent entries: ${JSON.stringify(recentEntries)}. Suggest a snack that aligns with their eating habits and helps meet their macro goals.`;
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
            setNotifications((prev) => [...prev, newNotification]);
            setLastSnackReminder(nowTimestamp);
            localStorage.setItem("lastSnackReminder", nowTimestamp.toString());
          } catch (error) {
            console.error("Notification Error:", error);
          }
        } catch (error) {
          console.error("Snack Suggestion Error:", error);
        }
      }
    };

    const interval = setInterval(checkSnackTime, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [notificationPermission, entries, calorieGoal, proteinPercent, fatPercent, carbPercent, hasEnoughData]);

  useEffect(() => {
    if (entries.length === 0) {
      setReport("Log your first meal to start tracking your macros!");
      return;
    }
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
        localStorage.setItem("dailyReport", response.data.text);
        localStorage.setItem("dailyReportDate", today);
        hasGeneratedReportRef.current = true;
      } catch (error) {
        console.error("Error generating report:", error);
        setReport("Oops, couldn’t generate your report—try again later!");
        hasGeneratedReportRef.current = true;
      }
    };
    generateReport();
  }, [calorieGoal, proteinPercent, fatPercent, carbPercent, entries]);

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