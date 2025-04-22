"use client";
import { useState, useEffect } from "react";
import { Card, CardBody, Input, Button } from "@nextui-org/react";
import Link from "next/link";
import axios from "axios";
import { supabase } from "@/lib/supabase";
import { ProtectedRoute } from "../components/ProtectedRoute";

interface FoodItem {
  food_name: string;
  protein: number;
  carbohydrates: number;
  fat: number;
}

interface Entry {
  id?: number;
  time: string;
  date: string;
  food: string;
  macros: {
    protein: string | number;
    fat: string | number;
    carbs: string | number;
  };
}

function FoodJournalContent() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [foodInput, setFoodInput] = useState("");
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [entryDate, setEntryDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [entryTime, setEntryTime] = useState(
    new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }).replace(":", ":")
  );

  useEffect(() => {
    const fetchEntries = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        console.error("User not authenticated:", userError);
        return;
      }
      const userId = userData.user.id;
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", userId);
      if (error) {
        console.error("Error fetching entries:", error);
        return;
      }
      setEntries(data || []);
    };
    fetchEntries();
  }, []);

  const handleSearch = async () => {
    if (!foodInput) return;
    console.log("handleSearch called with foodInput:", foodInput);
    try {
      const url = `http://localhost:3001/search-foods?query=${encodeURIComponent(foodInput)}`;
      console.log("Making API call to:", url);
      const response = await axios.get(url);
      console.log("API response:", response.data);
      const results = Array.isArray(response.data.foods.food)
        ? response.data.foods.food
        : response.data.foods.food
        ? [response.data.foods.food]
        : [];
      console.log("Parsed search results:", results);
      setSearchResults(results);
      console.log("searchResults state updated:", results);
    } catch (error) {
      console.error("Error searching for food:", error);
      setSearchResults([]);
    }
  };

  const handleSelectFood = async (food: FoodItem) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.error("User not authenticated:", userError);
      return;
    }
    const userId = userData.user.id;
    const newEntry: Entry = {
      time: entryTime,
      date: entryDate,
      food: food.food_name,
      macros: {
        protein: food.protein,
        fat: food.fat,
        carbs: food.carbohydrates,
      },
      user_id: userId,
    };

    const { data, error } = await supabase.from("entries").insert([newEntry]).select();
    if (error) {
      console.error("Error saving entry to Supabase:", error);
      return;
    }

    setEntries((prev) => [...prev, ...data]);
    setFoodInput("");
    setSearchResults([]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6 text-gray-900">Food Journal</h1>
      <nav className="mb-6 flex space-x-4">
        <Link href="/" className="text-blue-500 hover:underline">
          Back to Dashboard
        </Link>
        <Link href="/login" className="text-blue-500 hover:underline">
          Login
        </Link>
        <Link href="/logout" className="text-blue-500 hover:underline">
          Logout
        </Link>
      </nav>
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col space-y-4">
            <Input
              label="Date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="max-w-xs"
              aria-label="Date Input"
              classNames={{
                input: "text-gray-900",
                label: "text-gray-900",
              }}
            />
            <Input
              label="Time"
              type="time"
              value={entryTime}
              onChange={(e) => setEntryTime(e.target.value)}
              className="max-w-xs"
              aria-label="Time Input"
              classNames={{
                input: "text-gray-900",
                label: "text-gray-900",
              }}
            />
            <div className="flex space-x-2 max-w-xs">
              <Input
                label="Search for a food"
                placeholder="Enter food name"
                value={foodInput}
                onChange={(e) => {
                  setFoodInput(e.target.value);
                  if (!e.target.value) setSearchResults([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                className="flex-1"
                aria-label="Food Search Input"
                classNames={{
                  input: "text-gray-900",
                  label: "text-gray-900",
                  description: "text-gray-900",
                  errorMessage: "text-gray-900",
                }}
              />
              <Button color="primary" onPress={handleSearch} aria-label="Search Food Button" className="text-gray-900">
                Search
              </Button>
            </div>
            {searchResults.length > 0 ? (
              <div className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded p-2">
                {searchResults.map((food, index) => (
                  <div
                    key={food.food_name + index}
                    className="p-2 hover:bg-gray-200 cursor-pointer text-gray-900"
                    onClick={() => handleSelectFood(food)}
                  >
                    {food.food_name} (P: {food.protein}g, C: {food.carbohydrates}g, F: {food.fat}g)
                  </div>
                ))}
              </div>
            ) : foodInput ? (
              <div className="mt-2 text-gray-900">No search results found.</div>
            ) : null}
          </div>
        </CardBody>
      </Card>
      <div className="space-y-4">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardBody className="text-gray-900">
              {entry.date} {entry.time} - {entry.food} (P: {entry.macros.protein}g, C: {entry.macros.carbs}g, F: {entry.macros.fat}g)
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function FoodJournal() {
  return (
    <ProtectedRoute>
      <FoodJournalContent />
    </ProtectedRoute>
  );
}