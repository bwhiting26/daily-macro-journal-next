import { useState } from 'react';

export function useUserSettings() {
  const [calorieGoal, setCalorieGoal] = useState<number>(2000);
  const [proteinPercent, setProteinPercent] = useState<number>(35);
  const [fatPercent, setFatPercent] = useState<number>(30);
  const [carbPercent, setCarbPercent] = useState<number>(35);

  return {
    calorieGoal, setCalorieGoal,
    proteinPercent, setProteinPercent,
    fatPercent, setFatPercent,
    carbPercent, setCarbPercent,
  };
}
