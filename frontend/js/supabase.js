import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = window.CONNECT_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = window.CONNECT_SUPABASE_ANON_KEY || 'your-anon-key';

export const isSupabaseConfigured =
  SUPABASE_URL !== 'https://your-project.supabase.co' && SUPABASE_ANON_KEY !== 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
