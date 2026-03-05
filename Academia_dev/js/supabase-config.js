/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * SUPABASE CONFIG — Academia Dev
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Inicializa Supabase con variables de entorno
 * Las variables se cargan desde .env (local) o Netlify environment vars
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// Importar Supabase (CDN - se carga antes en index.html)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

// ════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ════════════════════════════════════════════════════════════════

const SUPABASE_CONFIG = {
  url: 'https://mwzezekdxrutpzqbduvh.supabase.co',
  anonKey: 'sb_publishable_O1RMAV7hbpvDwJj0ESgaCg_dd8lZur5',
  googleClientId: '346056201528-cvmk5r5udqj6i3807vhdrjrtqsnnm30f.apps.googleusercontent.com'
};

// ════════════════════════════════════════════════════════════════
// INICIALIZAR SUPABASE
// ════════════════════════════════════════════════════════════════

let supabase = null;

function initSupabase() {
  if (!window.supabase) {
    console.error('❌ Supabase library no cargada. Agregar en index.html:');
    console.error('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    return null;
  }

  supabase = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey
  );

  console.log('✅ Supabase initialized');
  return supabase;
}

// Inicializar al cargar el script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupabase);
} else {
  initSupabase();
}

// ════════════════════════════════════════════════════════════════
// VERIFICAR AUTENTICACIÓN
// ════════════════════════════════════════════════════════════════

async function checkAuth() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Error verificando auth:', error);
      return null;
    }

    if (session) {
      console.log('✅ Usuario autenticado:', session.user.email);
      return session.user;
    } else {
      console.log('⚠️ No hay sesión activa');
      return null;
    }
  } catch (err) {
    console.error('❌ Error en checkAuth:', err);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// OBTENER USUARIO ACTUAL
// ════════════════════════════════════════════════════════════════

async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email?.split('@')[0],
      avatar: user.user_metadata?.avatar_url || null,
      provider: user.app_metadata?.provider || 'email'
    };
  } catch (err) {
    console.error('❌ Error en getCurrentUser:', err);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// ESCUCHAR CAMBIOS DE AUTENTICACIÓN (LISTENER)
// ════════════════════════════════════════════════════════════════

function onAuthStateChange(callback) {
  try {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔔 Auth state changed:', event);
        callback(event, session);
      }
    );

    return subscription; // Para poder unsubscribe después
  } catch (err) {
    console.error('❌ Error en onAuthStateChange:', err);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// EXPORTAR PARA USO GLOBAL
// ════════════════════════════════════════════════════════════════

window.SupabaseConfig = {
  supabase: () => supabase,
  checkAuth,
  getCurrentUser,
  onAuthStateChange,
  config: SUPABASE_CONFIG
};

console.log('📦 Supabase Config loaded. Use: window.SupabaseConfig');
