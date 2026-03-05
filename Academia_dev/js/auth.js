/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * AUTH.JS — Google OAuth con Supabase
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Inicializa Supabase y maneja autenticación con Google
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const SUPABASE_URL = 'https://mwzezekdxrutpzqbduvh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_O1RMAV7hbpvDwJj0ESgaCg_dd8lZur5';

let supabase = null;

// ════════════════════════════════════════════════════════════════
// INICIALIZAR SUPABASE
// ════════════════════════════════════════════════════════════════

function initSupabase() {
  if (!window.supabase) {
    console.error('❌ Supabase library no cargada');
    return;
  }

  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase initialized');
}

// Inicializar cuando esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupabase);
} else {
  initSupabase();
}

// ════════════════════════════════════════════════════════════════
// GOOGLE SIGNIN
// ════════════════════════════════════════════════════════════════

async function signInGoogle() {
  try {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/index.html'
      }
    });

    if (error) {
      console.error('❌ Google signin error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ Google signin initiated');
    return { success: true };
  } catch (err) {
    console.error('❌ Error:', err);
    return { success: false, error: err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════════

async function logoutUser() {
  try {
    if (!supabase) {
      return { success: false, error: 'Supabase no inicializado' };
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('❌ Logout error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ Logout successful');
    localStorage.clear();
    return { success: true };
  } catch (err) {
    console.error('❌ Error:', err);
    return { success: false, error: err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// CHECK AUTH STATUS
// ════════════════════════════════════════════════════════════════

async function checkAuth() {
  try {
    if (!supabase) {
      console.error('Supabase no inicializado');
      return null;
    }

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('❌ Error checking auth:', error);
      return null;
    }

    if (session && session.user) {
      console.log('✅ Usuario autenticado:', session.user.email);
      return {
        user: session.user,
        email: session.user.email,
        id: session.user.id,
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0]
      };
    }

    console.log('⚠️ No hay sesión activa');
    return null;
  } catch (err) {
    console.error('❌ Error:', err);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// LISTEN TO AUTH CHANGES
// ════════════════════════════════════════════════════════════════

function onAuthChange(callback) {
  if (!supabase) {
    console.error('Supabase no inicializado');
    return;
  }

  supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔔 Auth event:', event);
    callback(event, session);
  });
}

// ════════════════════════════════════════════════════════════════
// EXPORTAR GLOBALMENTE
// ════════════════════════════════════════════════════════════════

window.Auth = {
  signInGoogle,
  logoutUser,
  checkAuth,
  onAuthChange,
  getSupabase: () => supabase
};

console.log('📦 Auth module loaded');
