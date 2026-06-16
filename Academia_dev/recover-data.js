// Script de recuperación de datos - Ejecutar en consola del navegador (F12 → Console)
// Este script intentará recuperar datos perdidos de localStorage, backups antiguos y Supabase

(async function recoverData() {
  console.log('🚀 Iniciando recuperación de datos...');
  
  // 1. Verificar todos los keys de localStorage relacionados con academia
  console.log('\n📦 Buscando datos en localStorage...');
  const allKeys = Object.keys(localStorage);
  const academiaKeys = allKeys.filter(k => k.includes('academia'));
  
  console.log(`Found ${academiaKeys.length} keys:`, academiaKeys);
  
  const backups = {};
  academiaKeys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        backups[key] = JSON.parse(value);
        console.log(`✅ ${key}:`, backups[key]);
      }
    } catch (e) {
      console.log(`❌ Error parsing ${key}:`, e);
    }
  });
  
  // 2. Verificar si hay datos en State actual
  console.log('\n📊 Verificando State actual...');
  if (typeof State !== 'undefined') {
    console.log('State.semestres:', State.semestres);
    console.log('State.settings:', State.settings);
  }
  
  // 3. Intentar cargar datos de Supabase (si está disponible)
  console.log('\n🌐 Intentando cargar datos de Supabase...');
  if (typeof window.AcademiaDB !== 'undefined' || typeof window.DB !== 'undefined') {
    const db = window.AcademiaDB || window.DB;
    try {
      const remoteData = await db.load();
      console.log('📥 Datos remotos de Supabase:', remoteData);
      
      if (remoteData && remoteData.semestres) {
        console.log('✅ Semestres encontrados en Supabase:', remoteData.semestres);
      }
    } catch (err) {
      console.error('❌ Error cargando datos de Supabase:', err);
    }
  }
  
  // 4. Verificar IndexedDB para datos adicionales
  console.log('\n🖼️ Verificando IndexedDB...');
  try {
    const request = indexedDB.open('academia_images', 2);
    request.onsuccess = (e) => {
      const db = e.target.result;
      
      // Verificar imágenes activas
      if (db.objectStoreNames.contains('images')) {
        const tx = db.transaction('images', 'readonly');
        const store = tx.objectStore('images');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          console.log('🖼️ Imágenes en IndexedDB:', getAll.result);
        };
      }
      
      // Verificar imágenes eliminadas (recuperables)
      if (db.objectStoreNames.contains('deleted_images')) {
        const tx = db.transaction('deleted_images', 'readonly');
        const store = tx.objectStore('deleted_images');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          console.log('🗑️ Imágenes eliminadas (recuperables):', getAll.result);
        };
      }
    };
  } catch (e) {
    console.error('❌ Error accediendo IndexedDB:', e);
  }
  
  // 5. Buscar versiones anteriores de datos en sessionStorage
  console.log('\n🔍 Buscando datos en sessionStorage...');
  const sessionKeys = Object.keys(sessionStorage);
  const academiaSessionKeys = sessionKeys.filter(k => k.includes('academia'));
  console.log('SessionStorage keys:', academiaSessionKeys);
  
  // 6. Crear backup de emergencia de datos actuales
  console.log('\n💾 Creando backup de emergencia...');
  const emergencyBackup = {
    timestamp: new Date().toISOString(),
    localStorage: backups,
    state: typeof State !== 'undefined' ? {
      semestres: State.semestres,
      settings: State.settings
    } : null
  };
  
  const backupString = JSON.stringify(emergencyBackup);
  console.log('Backup creado (tamaño:', backupString.length, 'bytes)');
  
  // Guardar backup en localStorage
  localStorage.setItem('academia_emergency_backup_' + Date.now(), backupString);
  console.log('✅ Backup guardado en localStorage');
  
  console.log('\n🎯 RESUMEN:');
  console.log('- Revisa los logs arriba para ver qué datos se encontraron');
  console.log('- Si hay datos en backups antiguos, podemos restaurarlos manualmente');
  console.log('- El backup de emergencia se guardó en localStorage');
  console.log('\n📋 Para restaurar datos manualmente, usa:');
  console.log('localStorage.setItem("academia_v4_semestres", JSON.stringify(tus_semestres))');
  console.log('localStorage.setItem("academia_v3_settings", JSON.stringify(tus_settings))');
  
  return emergencyBackup;
})();
