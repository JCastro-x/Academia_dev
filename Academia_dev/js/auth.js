/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * AUTH.JS — Google OAuth con Supabase (Academia)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

(function() {
  const SUPABASE_URL      = 'https://mwzezekdxrutpzqbduvh.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_O1RMAV7hbpvDwJj0ESgaCg_dd8lZur5';
  const ACADEMIA_STORAGE_PREFIXES = ['academia_', '_academia_'];

  let supabaseClient = null;
let prueba12;
  function initSupabase() {
    if (!window.supabase) {
      console.error('❌ Supabase library no cargada');
      return null;
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        detectSessionInUrl: true,
        storageKey: 'academia_auth_session'
      }
    });
    console.log('✅ Supabase initialized');
    return supabaseClient;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
  } else {
    initSupabase();
  }

  function clearAcademiaStorage() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (ACADEMIA_STORAGE_PREFIXES.some(prefix => k.startsWith(prefix))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }

  // ── Google SignIn ────────────────────────────────────────────
  async function signInGoogle() {
    try {
      if (!supabaseClient) return { success: false, error: 'Supabase no inicializado' };

      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo:          window.location.origin + '/app.html',
          skipBrowserRedirect: false,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });

      if (error) {
        console.error('❌ Google signin error:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('❌ Error:', err);
      return { success: false, error: err.message };
    }
  }

  // ── Logout ───────────────────────────────────────────────────
  async function logoutUser() {
    try {
      if (!supabaseClient) return { success: false, error: 'Supabase no inicializado' };
      const { error } = await supabaseClient.auth.signOut();
      if (error) return { success: false, error: error.message };
      clearAcademiaStorage();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── Check auth ───────────────────────────────────────────────
  async function checkAuth() {
    try {
      if (!supabaseClient) initSupabase();
      if (!supabaseClient) return null;
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error || !session?.user) return null;
      return {
        user:  session.user,
        email: session.user.email,
        id:    session.user.id,
        name:  session.user.user_metadata?.full_name || session.user.email?.split('@')[0]
      };
    } catch (err) {
      return null;
    }
  }

  // ── Auth state listener ──────────────────────────────────────
  function onAuthChange(callback) {
    if (!supabaseClient) return;
    supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log('🔔 Auth event:', event);
      callback(event, session);
    });
  }

  // ── Export ───────────────────────────────────────────────────
  window.Auth = {
    signInGoogle,
    logoutUser,
    checkAuth,
    clearAcademiaStorage,
    onAuthChange,
    getClient: () => supabaseClient
  };

  console.log('📦 Auth module loaded');
})();
