// version: 1.0.0
// Supabase Database Connection
(function (global) {
  "use strict";

  // Using the credentials you provided
  const SUPABASE_URL = "https://osvoqwydogybljmpzgtw.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zdm9xd3lkb2d5YmxqbXB6Z3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDQyNDYsImV4cCI6MjEwNjUyMDI0Nn0.sqShOpzNlzfQd4bJeWRq5TiWQWYLZN70x58qxMpdij4";

  if (!global.supabase) {
    console.warn("Supabase SDK not loaded. Ensure script tag is present.");
    return;
  }

  const supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  global.AkadSupabase = {
    client: supabaseClient,
  };
})(window);
