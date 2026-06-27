import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://iggsdctjjkdknmcnibwi.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZ3NkY3Rqamtka25tY25pYndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NjU0MDAsImV4cCI6MjA5MDU0MTQwMH0.oU1u7t6f6ygGzUmSEIgtaBCoHogywauu9R6NmmNLQN0";

export const isCloudSyncConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const supabase = isCloudSyncConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const getCurrentCloudUser = async () => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
};

export const signUpWithPassword = async (email, password) => {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
};

export const signInWithPassword = async (email, password) => {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOutCloud = async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const loadCloudSnapshot = async (userId) => {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("arth_snapshots")
    .select("snapshot, updated_at")
    .eq("user_id", userId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ?? null;
};

export const saveCloudSnapshot = async (userId, snapshot) => {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("arth_snapshots")
    .upsert(
      { user_id: userId, snapshot, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("updated_at")
    .single();
  if (error) throw error;
  return data ?? null;
};
