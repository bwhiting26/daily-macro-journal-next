"use client";
import { useState, useEffect } from "react";
import { Card, CardBody, Input, Progress, Button } from "@nextui-org/react";
import Link from "next/link";
import axios from "axios";

export default function Dashboard() {
  const [entries, setEntries] = useState([]);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [proteinPercent, setProteinPercent] = useState(35);
  const [fatPercent, setFatPercent] = useState(30);
  const [carbPercent, setCarbPercent] = useState(35);
  const [report, setReport] = useState("");
  const today = new Date().toLocaleDateString("en-CA");

  const proteinGrams = ((proteinPercent / 100) * calorieGoal) / 4;
  const fatGrams = ((fatPercent / 100) * calorieGoal) / 9;
  const carbGrams = ((carbPercent / 100) * calorieGoal) / 4;
  const todayEntries = entries.filter((entry) => entry.date === today);
  const currentProtein = todayEntries.reduce((sum, entry) => sum + (entry.macros?.protein || 0), 0);
  const currentFat = todayEntries.reduce((sum, entry) => sum + (entry.macros?.fat || 0), 0);
  const currentCarbs = todayEntries.reduce((sum, entry) => sum + (entry.macros?.carbs || 0), 0);

  useEffect(() => {
    const saved = localStorage.getItem("macroEntries");
    if (saved) {
      setEntries(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("macroEntries", JSON.stringify(entries));
  }, [entries]);

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
      const yesterdayProtein = yesterdayEntries.reduce((sum, entry) => sum + (entry.macros?.protein || 0), 0);
      const yesterdayFat = yesterdayEntries.reduce((sum, entry) => sum + (entry.macros?.fat || 0), 0);
      const yesterdayCarbs = yesterdayEntries.reduce((sum, entry) => sum + (entry.macros?.carbs || 0), 0);

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
      } catch (error) {
        setReport("Oops, couldn’t generate your report—try again later!");
      }
    };
    generateReport();
  }, [calorieGoal, proteinPercent, fatPercent, carbPercent, entries]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6">Daily Macro Journal</h1>
      <nav className="mb-6 flex space-x-4">
        <Link href="/journal" className="text-blue-500 hover:underline">
          Go to Food Journal
        </Link>
        <Link href="/notifications" className="text-blue-500 hover:underline">
          Notifications
        </Link>
      </nav>
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
          value={calorieGoal}
          onChange={(e) => setCalorieGoal(Number(e.target.value))}
          className="max-w-xs"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Input
          label="Protein (%)"
          type="number"
          value={proteinPercent}
          onChange={(e) => setProteinPercent(Number(e.target.value))}
        />
        <Input
          label="Fat (%)"
          type="number"
          value={fatPercent}
          onChange={(e) => setFatPercent(Number(e.target.value))}
        />
        <Input
          label="Carbs (%)"
          type="number"
          value={carbPercent}
          onChange={(e) => setCarbPercent(Number(e.target.value))}
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
          />
        </div>
      </div>
    </div>
  );
}