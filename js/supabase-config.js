// ============================================================
//  Troque pelos dados do SEU projeto Supabase
//  (Settings > API > Project URL e anon/publishable key)
// ============================================================

const SUPABASE_URL = 'https://ljztotcqbtphawyizbaq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqenRvdGNxYnRwaGF3eWl6YmFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MTEzMTIsImV4cCI6MjEwNDM4NzMxMn0.M9dzFET9FBfIinB8hXOkSpmxJKdjLV_oRlLscdmLZLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
