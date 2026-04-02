// Browser-safe runtime config — PUBLIC values only.
// Supabase URL and anon key are designed to be public (client-side, RLS-enforced).
// Real secrets (service_role_key, Cohere key, DB password) live ONLY in backend/.env.
window.CONNECT_SUPABASE_URL = window.CONNECT_SUPABASE_URL || 'https://jkqkalodktcomicypjeb.supabase.co';
window.CONNECT_SUPABASE_ANON_KEY = window.CONNECT_SUPABASE_ANON_KEY || 'sb_publishable_6qbzCQNjnXF3Q0je0EpaUA_kWjxYrZC';

// TODO: Change this to your deployed backend URL before going live
// e.g. 'https://connect-api.onrender.com' or your Railway/Fly URL
window.CONNECT_API_BASE = window.CONNECT_API_BASE || 'http://127.0.0.1:8000';
