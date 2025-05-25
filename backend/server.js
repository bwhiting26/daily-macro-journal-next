const path = require('path');
const fs = require('fs');

// Load environment variables from backend/.env (FatSecret and Anthropic)
const backendEnvPath = path.resolve(__dirname, './.env');
if (!fs.existsSync(backendEnvPath)) {
  throw new Error(`Environment file not found at ${backendEnvPath}. Please create backend/.env with FATSECRET_CLIENT_ID, FATSECRET_CLIENT_SECRET, FATSECRET_API_KEY, and ANTHROPIC_API_KEY.`);
}
// Load environment variables from backend/.env (e.g., FatSecret, Anthropic API keys).
// These variables take precedence over those in .env.local due to the loading order
// and the override:false setting on the .env.local load.
require('dotenv').config({ path: backendEnvPath });

// Load environment variables from ../.env.local (Supabase), merging with existing ones
const rootEnvPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(rootEnvPath)) {
  throw new Error(`Environment file not found at ${rootEnvPath}. Please create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.`);
}
// Load environment variables from ../.env.local (e.g., Supabase keys accessible by Next.js).
// The 'override: false' ensures that if a variable with the same name was already
// loaded from backend/.env, it will not be overwritten by the value in .env.local.
require('dotenv').config({ path: rootEnvPath, override: false });

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { createClient } = require("@supabase/supabase-js");
const app = express();
const port = 3001;

// IMPORTANT FOR PRODUCTION:
// 1. Ensure 'allowedOrigins' is updated with your specific production frontend URL(s), using HTTPS.
//    The current placeholder 'https://your-render-app.onrender.com' MUST be replaced.
//    Example for production: const allowedOrigins = ['https://www.youractualapp.com']; (plus localhost for dev)
// 2. For development, 'http://localhost:3000' is typically fine.
// 3. If your frontend and backend are on the same domain (even different subdomains) in production,
//    ensure the CORS policy correctly reflects this.
// Enable CORS for specific origins
const allowedOrigins = [
  'http://localhost:3000', // Development frontend
  'https://your-render-app.onrender.com' // Production frontend (replace with your Render URL)
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
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
  access_token: null,
  expires_in: 0,
  token_timestamp: 0, // Or Date.now() if you prefer, but will be updated on fetch
};

let isRefreshing = false;
let tokenPromise = null;

const refreshFatSecretToken = async () => {
  if (isRefreshing && tokenPromise) {
    console.log('A FatSecret token refresh is already in progress, returning existing promise.');
    return tokenPromise; // Return the promise of the ongoing refresh
  }

  isRefreshing = true;
  tokenPromise = (async () => {
    try {
      console.log('Attempting to refresh FatSecret token...');
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
      fatSecretToken = { // Update the global token variable directly
        access_token,
        expires_in,
        token_timestamp: Date.now(),
      };
      console.log('FatSecret token refreshed successfully.');
      return fatSecretToken.access_token; // Resolve the promise with the new token
    } catch (error) {
      console.error('Error refreshing FatSecret token:', error.response ? error.response.data : error.message);
      // Invalidate token on error to force re-fetch attempt by next request
      fatSecretToken.access_token = null; 
      fatSecretToken.expires_in = 0;
      throw error; // Rethrow to be caught by callers like ensureValidToken or initial fetch
    } finally {
      isRefreshing = false;
      // tokenPromise = null; // Optional: clear tokenPromise once settled if not needed for re-entry
    }
  })();
  return tokenPromise;
};

// Middleware to ensure a valid FatSecret token
const ensureValidToken = async (req, res, next) => {
  const currentTime = Date.now();
  // Check if token exists and if its age is within expiry (minus buffer)
  const tokenAge = fatSecretToken.access_token ? (currentTime - fatSecretToken.token_timestamp) / 1000 : Infinity;

  if (!fatSecretToken.access_token || tokenAge >= (fatSecretToken.expires_in - 60)) { // If no token or token expired/expiring
    console.log('FatSecret token is invalid or expiring, attempting refresh...');
    try {
      await refreshFatSecretToken(); // This now handles locking
    } catch (error) {
      // refreshFatSecretToken already logs the detailed error
      return res.status(500).json({ error: 'Failed to refresh FatSecret API token. Please try again later.' });
    }
  }

  // After attempting refresh, check again if token is available
  if (!fatSecretToken.access_token) {
    console.error('FatSecret token unavailable even after refresh attempt.');
    return res.status(500).json({ error: 'FatSecret API token is currently unavailable. Please try again later.' });
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
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

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
    console.error('Error calling Claude API for snack:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      } : null,
      request: error.request ? {
        method: error.request.method,
        url: error.request.url,
        headers: error.request.headers,
      } : null,
    });
    res.status(500).json({ 
      error: 'Failed to generate snack suggestion.',
      // Optional: message: 'The request to the AI service failed. Please try again later.'
    });
  }
});

app.post('/claude-report', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

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
    console.error('Error calling Claude API for report:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      } : null,
      request: error.request ? {
        method: error.request.method,
        url: error.request.url,
        headers: error.request.headers,
      } : null,
    });
    res.status(500).json({ 
      error: 'Failed to generate report.',
      // Optional: message: 'The request to the AI service failed. Please try again later.'
    });
  }
});

// Start the server
(async () => {
  try {
    console.log("Attempting initial FatSecret token acquisition...");
    await refreshFatSecretToken();
    if (!fatSecretToken.access_token) {
      // This condition might be redundant if refreshFatSecretToken throws on failure and is caught
      console.error("Initial FatSecret token acquisition failed: access_token is null.");
      // Decide if server should start or exit. For now, log and continue.
    } else {
      console.log("Initial FatSecret token acquired successfully.");
    }
  } catch (error) {
    console.error('Critical: Failed to obtain initial FatSecret token during server startup. FatSecret features will be unavailable.', error.message);
    // Consider process.exit(1) if FatSecret is essential for app to run
  }

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
})();