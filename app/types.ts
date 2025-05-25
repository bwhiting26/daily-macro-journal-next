export interface Entry {
  time: string;
  date: string;
  food: string;
  macros: {
    protein: string | number;
    fat: string | number;
    carbs: string | number;
  };
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  user_id: string;
  type?: 'error' | 'info' | 'success'; // Optional type property
}

export interface ThirtyDayStats {
  mostFrequentFoods: string[];
  leastFrequentFoods: string[];
  avgGapInMinutes: number;
  typicalMealTime: string; // e.g., "HH:MM AM/PM"
}
