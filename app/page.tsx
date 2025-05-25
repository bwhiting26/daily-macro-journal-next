"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardBody, Input, Progress, Button, Spinner } from "@nextui-org/react";
import Link from "next/link";
import axios from "axios";
import { supabase } from "@/lib/supabase";
import { ProtectedRoute } from "app/components/ProtectedRoute";
import { useNotifications } from "./context/NotificationContext";
import { v4 as uuidv4 } from "uuid";
import { Entry, AppNotification } from "./types"; // Import types
import { useUserSettings } from "./hooks/useUserSettings";
import { useJournalData } from "./hooks/useJournalData";
import { useDailyQuote } from "./hooks/useDailyQuote";


function DashboardContent() {
  const { notifications, setNotifications, isNotificationsLoaded, user, isUserLoading, addNotification } = useNotifications();
  const userId = user?.id ?? null;
  
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-CA"));
  }, []);

  // Use custom hooks
  const {
    calorieGoal, setCalorieGoal,
    proteinPercent, setProteinPercent,
    fatPercent, setFatPercent,
    carbPercent, setCarbPercent,
  } = useUserSettings();

  const {
    entries,
    // setEntries, // Exposing setEntries if direct modification is needed, but not used in this refactor yet
    learningPeriodComplete,
    // isLoading: isJournalDataLoading, // Can be used for a loading spinner for journal section
    proteinGrams,
    fatGrams,
    carbGrams,
    todayEntries,
    currentProtein,
    currentFat,
    currentCarbs,
    uniqueDays,
    hasEnoughData,
    // isFirstDay, // Not directly used in JSX, but available
    thirtyDayEntryStats, // Added this
  } = useJournalData(userId, addNotification, { calorieGoal, proteinPercent, fatPercent, carbPercent }, today);

  const { dailyQuote, quoteLoading, quoteError } = useDailyQuote(userId, addNotification, isNotificationsLoaded);

  const [report, setReport] = useState("");
  const [reportLoading, setReportLoading] = useState(true); // This remains for now
  const [reportError, setReportError] = useState<string | null>(null); // This remains for now
  const [lastSnackReminder, setLastSnackReminder] = useState<number | null>(null);
  
  // Refs - remove if confirmed unused after full refactor
  // const hasCompletedLearningRef = useRef(learningPeriodComplete); // learningPeriodComplete now comes from useJournalData
  const hasGeneratedReportRef = useRef(false); // Keep if report generation logic uses it

  // Effect for fetching lastSnackReminder (this was part of the original fetchInitialData)
  useEffect(() => {
    if (!userId) return;
    const fetchLastSnackReminder = async () => {
      const { data: snackData, error: snackError } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "lastSnackReminder")
        .eq("user_id", userId)
        .maybeSingle();
      if (snackError) {
        console.error("Error fetching last snack reminder:", JSON.stringify(snackError, null, 2));
        if (addNotification) {
          addNotification({ title: 'Error Loading Data', body: 'Could not load your snack reminder settings. Please refresh or try again later.', type: 'error' });
        }
      } else if (snackData && snackData.value !== undefined) {
        setLastSnackReminder(snackData.value);
      }
    };
    fetchLastSnackReminder();
  }, [userId, addNotification]);


  useEffect(() => {
    // Ensure all required data is available before setting up or running checkSnackTime
    if (!today || !hasEnoughData || !userId || !entries || !thirtyDayEntryStats) {
        return;
    }

    const checkSnackTime = async () => {
      // Destructure stats from the hook
      const { mostFrequentFoods, leastFrequentFoods, avgGapInMinutes, typicalMealTime } = thirtyDayEntryStats;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const todayTimes = todayEntries // todayEntries comes from useJournalData
        .map((entry: Entry) => {
          const [time, period] = entry.time.split(" ");
          let [hours, minutes] = time.split(":").map(Number);
          if (period === "PM" && hours !== 12) hours += 12;
          if (period === "AM" && hours === 12) hours = 0;
          return hours * 60 + minutes;
        })
        .sort((a: number, b: number) => a - b);
      const lastMealTime = todayTimes.length > 0 ? todayTimes[todayTimes.length - 1] : -Infinity;

      const lastMealTimestamp = todayEntries.length > 0 ? new Date(`${todayEntries[todayEntries.length - 1].date} ${todayEntries[todayEntries.length - 1].time}`).getTime() : 0;
      if (lastSnackReminder && lastSnackReminder > lastMealTimestamp) {
        return;
      }

      const recentSnackNotification = notifications.some(
        (notification) =>
          notification.title === "Snack Time! 🍎" &&
          now.getTime() - notification.timestamp < 30 * 60 * 1000
      );
      if (recentSnackNotification) return;

      const createAppAndBrowserSnackNotification = async (suggestionText: string) => {
        const nowTimestamp = new Date().getTime();
        const newAppNotificationPayload: AppNotification = {
          id: uuidv4(),
          title: "Snack Time! 🍎",
          body: `It’s ${new Date().toLocaleTimeString()}—time for a snack? ${suggestionText}`,
          timestamp: nowTimestamp,
          read: false,
          user_id: userId!,
        };

        const { error: insertError } = await supabase.from("notifications").insert([newAppNotificationPayload]);

        if (insertError) {
          console.error("Error saving snack notification:", insertError);
          if (addNotification) {
            addNotification({ title: "Database Error", body: "Could not save snack notification to your log.", type: "error" });
          }
        } else {
          setNotifications((prev: AppNotification[]) => [...prev, newAppNotificationPayload]);
          setLastSnackReminder(nowTimestamp);
          await supabase
            .from("settings")
            .upsert({ key: "lastSnackReminder", value: nowTimestamp, user_id: userId });

          if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification("Snack Time! 🍎", {
                body: `It’s ${new Date().toLocaleTimeString()}—time for a snack? ${suggestionText}`,
              });
            } else if (Notification.permission !== "denied") {
              Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                  new Notification("Snack Time! 🍎", {
                    body: `It’s ${new Date().toLocaleTimeString()}—time for a snack? ${suggestionText}`,
                  });
                } else {
                   if (addNotification) {
                      addNotification({ title: "Snack Reminder", body: "Enable browser notifications to get snack alerts directly. Snack saved to your in-app notifications.", type: "info" });
                   }
                }
              });
            } else {
              if (addNotification) {
                  addNotification({ title: "Snack Reminder", body: "Browser notifications are disabled. Your snack suggestion is in the app's notification list.", type: "info" });
              }
            }
          }
        }
      };

      if (currentMinutes - lastMealTime > avgGapInMinutes) { // Use avgGapInMinutes from stats
        const prompt = `Suggest a quick snack to help meet macro goals. Keep it positive and concise (1-2 sentences). Current intake: Protein ${currentProtein}g/${proteinGrams}g, Fat ${currentFat}g/${fatGrams}g, Carbs ${currentCarbs}g/${carbGrams}g. Based on the user's eating habits over the last 30 days, they frequently eat ${mostFrequentFoods.join(", ")}, tend to avoid ${leastFrequentFoods.join(", ")}, and typically eat around ${typicalMealTime}. Suggest a snack that aligns with their eating habits and helps meet their macro goals.`; // Removed recentEntries from prompt
        try {
          const response = await axios.post(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/claude-snack`,
            { prompt },
            { headers: { "Content-Type": "application/json" } }
          );
          const snackSuggestion = response.data.text;
          await createAppAndBrowserSnackNotification(snackSuggestion);
        } catch (error) {
          console.error("Snack Suggestion Error:", error);
          if (addNotification) {
            addNotification({ title: "Snack AI Error", body: "Could not generate a snack suggestion at this time.", type: "error"});
          }
        }
      }
    };

    const intervalId = setInterval(checkSnackTime, 30 * 60 * 1000);
    checkSnackTime(); // Initial check
    return () => clearInterval(intervalId);
  }, [
      entries, calorieGoal, proteinPercent, fatPercent, carbPercent, hasEnoughData, 
      notifications, today, userId, setNotifications, addNotification, 
      proteinGrams, fatGrams, carbGrams, currentProtein, currentFat, currentCarbs, 
      todayEntries, thirtyDayEntryStats, lastSnackReminder // Added thirtyDayEntryStats & lastSnackReminder
  ]);


  if (!today || isUserLoading ) return <div className="min-h-screen bg-gray-100 p-6 flex justify-center items-center"><Spinner label="Loading dashboard..." /></div>;
  // Add isJournalDataLoading to the condition above if you want a spinner for journal data section specifically

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
        <Link href="/login" className="text-blue-500 hover:underline">
          Login
        </Link>
        <Link href="/logout" className="text-blue-500 hover:underline">
          Logout
        </Link>
      </nav>
      <div className="mb-6 bg-blue-50 p-4 rounded shadow text-center">
        <h2 className="text-xl font-semibold mb-2">Daily Motivation</h2>
        {quoteLoading ? (
          <Spinner size="sm" color="primary" />
        ) : quoteError ? (
          <p className="text-red-500">{quoteError}</p>
        ) : dailyQuote ? (
          <p className="italic text-gray-700">{dailyQuote}</p>
        ) : (
          <p className="text-gray-700">No daily motivation available today.</p>
        )}
      </div>
      {!learningPeriodComplete && (
        <div className="mb-6 bg-yellow-100 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Learning Your Habits</h2>
          <p>We’re getting to know your eating habits! Log your meals for 5 days to unlock personalized insights. Days logged: {uniqueDays ? uniqueDays.length : 0}/5</p>
        </div>
      )}
      <Card className="mb-6">
        <CardBody>
          <h2 className="text-xl font-semibold mb-2">Daily Report</h2>
          {reportLoading ? (
            <Spinner size="sm" color="primary" />
          ) : reportError ? (
            <p className="text-red-500">{reportError}</p>
          ) : (
            <p>{report}</p>
          )}
        </CardBody>
      </Card>
      <div className="mb-4">
        <Input
          label="Calorie Goal"
          type="number"
          value={calorieGoal.toString()}
          onChange={(e) => {
            const value = Number(e.target.value);
            setCalorieGoal(value);
          }}
          isInvalid={calorieGoal < 0}
          errorMessage={calorieGoal < 0 ? "Calorie goal cannot be negative." : ""}
          className="max-w-xs"
          aria-label="Calorie Goal Input"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Input
          label="Protein (%)"
          type="number"
          value={proteinPercent.toString()}
          onChange={(e) => {
            const value = Number(e.target.value);
            setProteinPercent(value);
          }}
          isInvalid={proteinPercent < 0 || proteinPercent > 100}
          errorMessage={(proteinPercent < 0 || proteinPercent > 100) ? "Protein percentage must be between 0 and 100." : ""}
          aria-label="Protein Percentage Input"
        />
        <Input
          label="Fat (%)"
          type="number"
          value={fatPercent.toString()}
          onChange={(e) => {
            const value = Number(e.target.value);
            setFatPercent(value);
          }}
          isInvalid={fatPercent < 0 || fatPercent > 100}
          errorMessage={(fatPercent < 0 || fatPercent > 100) ? "Fat percentage must be between 0 and 100." : ""}
          aria-label="Fat Percentage Input"
        />
        <Input
          label="Carbs (%)"
          type="number"
          value={carbPercent.toString()}
          onChange={(e) => {
            const value = Number(e.target.value);
            setCarbPercent(value);
          }}
          isInvalid={carbPercent < 0 || carbPercent > 100}
          errorMessage={(carbPercent < 0 || carbPercent > 100) ? "Carbs percentage must be between 0 and 100." : ""}
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

export default function Home() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}