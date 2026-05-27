import { supabase, isSupabaseConfigured } from './supabase.js';

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Set CONNECT_SUPABASE_URL and CONNECT_SUPABASE_ANON_KEY.');
  }
}

export async function signup(name, email, password) {
  assertConfigured();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  return data;
}

export async function login(email, password) {
  assertConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function loginWithGoogle() {
  assertConfigured();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
  if (error) throw error;
  return data;
}

export async function getSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export async function getAccessToken() {
  const session = await getSession();
  return session?.access_token || null;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = '/login.html';
    return null;
  }
  return session;
}

export async function redirectIfAuthenticated() {
  const session = await getSession();
  if (session) {
    window.location.href = '/dashboard.html';
    return true;
  }
  return false;
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = '/login.html';
}
