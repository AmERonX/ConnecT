// Browser-safe runtime config — PUBLIC values only.
// Supabase URL and anon key are designed to be public (client-side, RLS-enforced).
// Real secrets (service_role_key, Cohere key, DB password) live ONLY in backend/.env.
window.CONNECT_SUPABASE_URL = window.CONNECT_SUPABASE_URL || 'https://jkqkalodktcomicypjeb.supabase.co';
window.CONNECT_SUPABASE_ANON_KEY = window.CONNECT_SUPABASE_ANON_KEY || 'sb_publishable_6qbzCQNjnXF3Q0je0EpaUA_kWjxYrZC';

// Auto-detect backend: use Vercel-hosted backend in production, localhost in dev.
const _isLocalDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
window.CONNECT_API_BASE = window.CONNECT_API_BASE || (
  _isLocalDev ? 'http://localhost:8000' : 'https://connec-t-backend.vercel.app'
);

