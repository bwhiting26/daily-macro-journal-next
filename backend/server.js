const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
}));

app.options("*", cors());

app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const FATSECRET_API_KEY = process.env.FATSECRET_API_KEY;

app.post("/claude-snack", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ role: "user", content: req.body.prompt }],
      },
      {
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
      }
    );
    res.json({ text: response.data.content[0].text });
  } catch (error) {
    console.error("Claude API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate snack suggestion" });
  }
});

app.post("/claude-report", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ role: "user", content: req.body.prompt }],
      },
      {
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
      }
    );
    res.json({ text: response.data.content[0].text });
  } catch (error) {
    console.error("Claude API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

app.get("/search-foods", async (req, res) => {
  try {
    const response = await axios.get(
      `https://platform.fatsecret.com/rest/foods/search/v1?method=foods.search&search_expression=${req.query.query}&format=json`,
      {
        headers: {
          Authorization: `Bearer ${FATSECRET_API_KEY}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("FatSecret API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to search foods" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});