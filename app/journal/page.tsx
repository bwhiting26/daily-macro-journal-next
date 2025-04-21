"use client";
import { useState, useEffect } from "react";
import { Card, CardBody, Input, Button } from "@nextui-org/react";
import Link from "next/link";
import axios from "axios";

export default function FoodJournal() {
  const [entries, setEntries] = useState([]);
  const [foodInput, setFoodInput] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [entryTime, setEntryTime] = useState(
    new Date().toTimeString().split(" ")[0].slice(0, 5)
  );

  useEffect(() => {
    const saved = localStorage.getItem("macroEntries");
    if (saved) {
      setEntries(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("macroEntries", JSON.stringify(entries));
  }, [entries]);

  const handleSearch = async () => {
    console.log("handleSearch called with foodInput:", foodInput);
    if (!foodInput.trim()) return;
    console.log("Making API call to:", `${process.env.NEXT_PUBLIC_BACKEND_URL}/search-foods?query=${foodInput}`);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/search-foods`,
        { params: { query: foodInput } }
      );
      console.log("API response:", response.data);
      const results = response.data.foods?.food || [];
      console.log("Parsed search results:", results);
      setSearchResults(results);
    } catch (error) {
      console.error("FoodJournal: Error searching foods:", error.message);
      console.error("Error details:", error.response?.data || error);
      setSearchResults([]); // Ensure state is reset on error
    }
  };

  const handleSelectFood = (food) => {
    const formattedTime = new Date(`${entryDate}T${entryTime}:00`).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    setEntries([
      ...entries,
      {
        time: formattedTime,
        date: entryDate,
        food: food.food_name,
        macros: {
          protein: food.food_description.match(/Protein: (\d+\.?\d*)/)?.[1] || 0,
          carbs: food.food_description.match(/Carbs: (\d+\.?\d*)/)?.[1] || 0,
          fat: food.food_description.match(/Fat: (\d+\.?\d*)/)?.[1] || 0,
        },
      },
    ]);
    setSearchResults([]);
    setFoodInput("");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6 text-gray-900">Food Journal</h1>
      <nav className="mb-6">
        <Link href="/" className="text-blue-500 hover:underline">
          Back to Dashboard
        </Link>
      </nav>
      <div className="mb-4 flex flex-col space-y-2">
        <div className="flex space-x-2">
          <Input
            label="Search Food"
            placeholder="Search for a food (e.g., apple)"
            value={foodInput}
            onChange={(e) => setFoodInput(e.target.value)}
            classNames={{ label: "text-gray-900" }}
          />
          <Button color="primary" onPress={handleSearch}>
            Search
          </Button>
        </div>
        <div className="flex space-x-2">
          <Input
            type="date"
            label="Date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            classNames={{ label: "text-gray-900" }}
          />
          <Input
            type="time"
            label="Time"
            value={entryTime}
            onChange={(e) => setEntryTime(e.target.value)}
            classNames={{ label: "text-gray-900" }}
            />
        </div> 
      </div>
      {searchResults.length > 0 && (
        <Card className="mb-4">
          <CardBody>
            <h2 className="text-lg font-medium mb-2 text-gray-900">Search Results:</h2>
            {searchResults.map((food) => (
              <div
                key={food.food_id}
                className="p-3 cursor-pointer hover:bg-gray-100 text-gray-900"
                onClick={() => handleSelectFood(food)}
              >
                {food.food_name} - {food.food_description}
              </div>
            ))}
          </CardBody>
        </Card>
      )}
      {entries.map((entry, index) => (
        <Card key={index} className="mb-2">
          <CardBody className="text-gray-900">
            {entry.date} {entry.time} - {entry.food} (P: {entry.macros.protein}g, C: {entry.macros.carbs}g, F: {entry.macros.fat}g)
          </CardBody>
        </Card>
      ))}
    </div>
  );
}