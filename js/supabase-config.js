// ============================================================
//  Troque pelos dados do SEU projeto Supabase
//  (Settings > API > Project URL e anon/publishable key)
// ============================================================

// O ambiente local usa uma base separada; o site publicado mantém o projeto remoto.
const SUPABASE_LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const SUPABASE_URL = SUPABASE_LOCAL
  ? 'http://127.0.0.1:54321'
  : 'https://ljztotcqbtphawyizbaq.supabase.co';
const SUPABASE_KEY = SUPABASE_LOCAL
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqenRvdGNxYnRwaGF3eWl6YmFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MTEzMTIsImV4cCI6MjEwNDM4NzMxMn0.M9dzFET9FBfIinB8hXOkSpmxJKdjLV_oRlLscdmLZLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { detectSessionInUrl: !(typeof REDIRECIONANDO_RECUPERACAO !== 'undefined' && REDIRECIONANDO_RECUPERACAO) }
});
