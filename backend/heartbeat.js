require('dotenv').config({ path: '../.env.local' });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addHeartbeat() {
  try {
    const { data, error } = await supabase
      .from('heartbeat')
      .insert([{ timestamp: new Date().toISOString() }])
      .select();
    if (error) throw error;
    console.log('Heartbeat added successfully:', data);
  } catch (error) {
    console.error('Failed to add heartbeat:', error.message);
  }
}

addHeartbeat();