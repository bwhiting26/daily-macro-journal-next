const path = require('path');
const fs = require('fs');

// Load environment variables from backend/.env (FatSecret and Anthropic)
const backendEnvPath = path.resolve(__dirname, './.env');
if (!fs.existsSync(backendEnvPath)) {
  throw new Error(`Environment file not found at ${backendEnvPath}. Please create backend/.env with FATSECRET_CLIENT_ID, FATSECRET_CLIENT_SECRET, FATSECRET_API_KEY, and ANTHROPIC_API_KEY.`);
}
require('dotenv').config({ path: backendEnvPath });

// Load environment variables from ../.env.local (Supabase), merging with existing ones
const rootEnvPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(rootEnvPath)) {
  throw new Error(`Environment file not found at ${rootEnvPath}. Please create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.`);
}
require('dotenv').config({ path: rootEnvPath, override: false });

const express = require('express');
const axios = require('axios');
const cors = require('cors'); // Import cors
const { createClient } = require("@supabase/supabase-js");
const app = express();
const port = 3001;

// Enable CORS for specific origins
const allowedOrigins = [
  'http://localhost:3000', // Development frontend
  'https://your-render-app.onrender.com' // Production frontend (replace with your Render URL)
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'], // Allow these HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow these headers
  credentials: true // Allow credentials if needed (e.g., cookies)
}));

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment variables. Please check your .env.local file.');
}
if (!process.env.FATSECRET_CLIENT_ID || !process.env.FATSECRET_CLIENT_SECRET || !process.env.FATSECRET_API_KEY) {
  throw new Error('Missing FATSECRET_CLIENT_ID, FATSECRET_CLIENT_SECRET, or FATSECRET_API_KEY in environment variables. Please check your backend/.env file.');
}
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY in environment variables. Please check your backend/.env file.');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Middleware to parse JSON bodies
app.use(express.json());

// FatSecret API credentials and token management
const FATSECRET_CLIENT_ID = process.env.FATSECRET_CLIENT_ID;
const FATSECRET_CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET;
let fatSecretToken = {
  access_token: process.env.FATSECRET_API_KEY,
  expires_in: 86400, // Assume 24 hours (86400 seconds), adjust based on FatSecret's response
  token_timestamp: Date.now(), // When the token was last refreshed
};

// Function to refresh the FatSecret token using Client Credentials Grant
const refreshFatSecretToken = async () => {
  try {
    const authHeader = Buffer.from(`${FATSECRET_CLIENT_ID}:${FATSECRET_CLIENT_SECRET}`).toString('base64');
    const response = await axios.post(
      'https://oauth.fatsecret.com/connect/token',
      'grant_type=client_credentials&scope=basic',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`,
        },
      }
    );

    const { access_token, expires_in } = response.data;
    fatSecretToken = {
      access_token,
      expires_in,
      token_timestamp: Date.now(),
    };
    console.log('FatSecret token refreshed successfully:', {
      access_token: '[REDACTED]', // Avoid logging sensitive data
      expires_in,
      token_timestamp: fatSecretToken.token_timestamp,
    });
  } catch (error) {
    console.error('Error refreshing FatSecret token:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Middleware to ensure a valid FatSecret token
const ensureValidToken = async (req, res, next) => {
  const currentTime = Date.now();
  const tokenAge = (currentTime - fatSecretToken.token_timestamp) / 1000; // Age in seconds
  if (tokenAge >= fatSecretToken.expires_in - 60) { // Refresh 60 seconds before expiration
    try {
      await refreshFatSecretToken();
    } catch (error) {
      return res.status(500).json({ error: 'Failed to refresh FatSecret token' });
    }
  }
  next();
};

// FatSecret API Search Endpoint
app.get('/search-foods', ensureValidToken, async (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    const response = await axios.get('https://platform.fatsecret.com/rest/foods/search/v1', {
      params: {
        search_expression: query,
        max_results: 10,
        format: 'json',
      },
      headers: {
        Authorization: `Bearer ${fatSecretToken.access_token}`,
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching foods from FatSecret:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to fetch foods from FatSecret' });
  }
});

// Claude API Endpoints
app.post('/claude-snack', async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
      }
    );
    res.json({ text: response.data.content[0].text });
  } catch (error) {
    console.error('Error calling Claude API for snack:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate snack suggestion' });
  }
});

app.post('/claude-report', async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
      }
    );
    res.json({ text: response.data.content[0].text });
  } catch (error) {
    console.error('Error calling Claude API for report:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});