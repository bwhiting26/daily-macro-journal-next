import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Entry, AppNotification, ThirtyDayStats } from '@/app/types'; // Added ThirtyDayStats

interface UseJournalDataSettings {
  calorieGoal: number;
  proteinPercent: number;
  fatPercent: number;
  carbPercent: number;
}

export function useJournalData(
  userId: string | null,
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'user_id'>) => void,
  settings: UseJournalDataSettings,
  today: string // Pass today's date string
) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [firstEntryDate, setFirstEntryDate] = useState<string | null>(null);
  const [learningPeriodComplete, setLearningPeriodComplete] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const fetchJournalData = async () => {
      setIsLoading(true);
      // Fetch entries
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', userId);

      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        if (addNotification) {
          addNotification({ title: 'Error Loading Data', body: 'Could not load your journal entries. Please refresh or try again later.', type: 'error' });
        }
        setEntries([]); // Set to empty array on error
      } else {
        setEntries(entriesData || []);
      }

      // Fetch learning period
      const { data: learningData, error: learningError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'learningPeriodComplete')
        .eq('user_id', userId)
        .maybeSingle();

      if (learningError) {
        console.error('Error fetching learning period:', JSON.stringify(learningError, null, 2));
        if (addNotification) {
          addNotification({ title: 'Error Loading Data', body: 'Could not load your learning progress. Please refresh or try again later.', type: 'error' });
        }
      } else if (learningData && learningData.value !== undefined) {
        setLearningPeriodComplete(learningData.value);
      } else {
        setLearningPeriodComplete(false); // Default if not found
      }
      
      // Logic for firstEntryDate is now in a separate useEffect
      setIsLoading(false); 
    };

    fetchJournalData();
  }, [userId, addNotification]);

  // Effect for determining and saving firstEntryDate
  useEffect(() => {
    const determineAndSetFirstEntryDate = async () => {
      if (userId && !firstEntryDate) { // Only run if userId is present and firstEntryDate is not yet set
        setIsLoading(true); // Set loading true while fetching/determining firstEntryDate
        // 1. Try to get from settings
        const { data: settingEntryDate, error: settingError } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "firstEntryDate")
          .eq("user_id", userId)
          .maybeSingle();

        if (settingEntryDate && settingEntryDate.value) {
          setFirstEntryDate(settingEntryDate.value as string);
        } else if (!settingError) {
          // 2. If not in settings, query from entries table
          const { data: earliestEntry, error: queryError } = await supabase
            .from('entries')
            .select('date')
            .eq('user_id', userId)
            .order('date', { ascending: true })
            .limit(1)
            .single();

          if (queryError) {
            console.error('Error fetching earliest entry date:', queryError);
            if (addNotification) {
              addNotification({ title: 'Error', body: 'Could not determine your first entry date from journal.', type: 'error' });
            }
          } else if (earliestEntry && earliestEntry.date) {
            setFirstEntryDate(earliestEntry.date);
            // Save this to settings table for next time
            const { error: upsertError } = await supabase
              .from("settings")
              .upsert({ key: "firstEntryDate", value: earliestEntry.date, user_id: userId });
            if (upsertError && addNotification) {
              addNotification({ title: 'Storage Error', body: 'Could not save first entry date to settings.', type: 'error' });
            }
          }
        } else if (settingError && addNotification) {
          addNotification({ title: 'Error', body: 'Could not fetch first entry date setting.', type: 'error' });
          console.error('Error fetching firstEntryDate from settings:', settingError);
        }
        setIsLoading(false); // Set loading false after attempt
      } else if (!userId) {
        // If there's no userId, clear firstEntryDate and learningPeriodComplete
        setFirstEntryDate(null);
        setLearningPeriodComplete(false);
        setIsLoading(false);
      }
    };

    determineAndSetFirstEntryDate();
  }, [userId, firstEntryDate, addNotification]); // Ensure firstEntryDate is in dependency to avoid re-running if already set


  const { calorieGoal, proteinPercent, fatPercent, carbPercent } = settings;

  const proteinGrams = ((proteinPercent / 100) * calorieGoal) / 4;
  const fatGrams = ((fatPercent / 100) * calorieGoal) / 9;
  const carbGrams = ((carbPercent / 100) * calorieGoal) / 4;

  const todayEntries = today ? (Array.isArray(entries) ? entries.filter((entry) => entry.date === today) : []) : [];
  
  const currentProtein = todayEntries.reduce((sum: number, entry: Entry) => sum + Number(entry.macros?.protein || 0), 0);
  const currentFat = todayEntries.reduce((sum: number, entry: Entry) => sum + Number(entry.macros?.fat || 0), 0);
  const currentCarbs = todayEntries.reduce((sum: number, entry: Entry) => sum + Number(entry.macros?.carbs || 0), 0);
  
  const uniqueDays = today ? [...new Set(entries.map((entry) => entry.date))] : [];
  const hasEnoughData = uniqueDays.length >= 5;
  const isFirstDay = entries.length === 0 || (firstEntryDate && today === firstEntryDate);

  const [thirtyDayEntryStats, setThirtyDayEntryStats] = useState<ThirtyDayStats | null>(null);

  useEffect(() => {
    if (hasEnoughData && entries && entries.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentEntries = entries.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= thirtyDaysAgo;
      });

      if (recentEntries.length === 0) {
        setThirtyDayEntryStats({
            mostFrequentFoods: [],
            leastFrequentFoods: [],
            avgGapInMinutes: 180, // Default
            typicalMealTime: "12:00 PM", // Default
        });
        return;
      }
      
      const foodFrequency: Record<string, number> = recentEntries.reduce((acc: Record<string, number>, entry: Entry) => {
        acc[entry.food] = (acc[entry.food] || 0) + 1;
        return acc;
      }, {});

      const mostFrequentFoods = Object.entries(foodFrequency)
        .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
        .slice(0, 3)
        .map(([food]) => food);

      const leastFrequentFoods = Object.entries(foodFrequency)
        .sort((a: [string, number], b: [string, number]) => a[1] - b[1])
        .slice(0, 3)
        .map(([food]) => food);
      
      const mealTimesInMinutes = recentEntries
        .map((entry: Entry) => {
          const [time, period] = entry.time.split(" ");
          let [hours, minutes] = time.split(":").map(Number);
          if (period === "PM" && hours !== 12) hours += 12;
          if (period === "AM" && hours === 12) hours = 0; // Midnight case
          return hours * 60 + minutes;
        })
        .sort((a: number, b: number) => a - b);

      let avgMealTimeMinutes = 0;
      let typicalMealTime = "12:00 PM"; // Default
      if (mealTimesInMinutes.length > 0) {
        avgMealTimeMinutes = mealTimesInMinutes.reduce((sum: number, time: number) => sum + time, 0) / mealTimesInMinutes.length;
        const avgMealHour = Math.floor(avgMealTimeMinutes / 60) % 24; // Ensure it's within 0-23
        const avgMealMinute = Math.round(avgMealTimeMinutes % 60);
        const period = avgMealHour >= 12 ? "PM" : "AM";
        const displayHour = avgMealHour % 12 === 0 ? 12 : avgMealHour % 12; // Convert 0 or 12 to 12 for display
        typicalMealTime = `${displayHour}:${avgMealMinute.toString().padStart(2, "0")} ${period}`;
      }
      
      const gaps: number[] = [];
      if (mealTimesInMinutes.length > 1) {
        for (let i = 1; i < mealTimesInMinutes.length; i++) {
          gaps.push(mealTimesInMinutes[i] - mealTimesInMinutes[i - 1]);
        }
      }
      const avgGapInMinutes = gaps.length > 0 ? gaps.reduce((sum: number, gap: number) => sum + gap, 0) / gaps.length : 180;

      setThirtyDayEntryStats({
        mostFrequentFoods,
        leastFrequentFoods,
        avgGapInMinutes,
        typicalMealTime,
      });
    } else {
      setThirtyDayEntryStats(null); // Not enough data or no entries
    }
  }, [entries, hasEnoughData]);

  return {
    entries,
    setEntries, 
    firstEntryDate,
    learningPeriodComplete,
    isLoading,
    proteinGrams,
    fatGrams,
    carbGrams,
    todayEntries,
    currentProtein,
    currentFat,
    currentCarbs,
    uniqueDays,
    hasEnoughData,
    isFirstDay,
    thirtyDayEntryStats, // Expose the new stats
  };
}
