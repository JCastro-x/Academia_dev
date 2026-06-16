// Ejecutar este script en la consola del navegador (F12 → Console)
// para verificar el estado actual de los datos y buscar posibles recuperaciones

(function() {
  console.log('🔍 Verificando estado de datos...');
  
  // 1. Verificar localStorage actual
  const semestresKey = 'academia_v4_semestres';
  const settingsKey = 'academia_v3_settings';
  
  const localSemestres = localStorage.getItem(semestresKey);
  const localSettings = localStorage.getItem(settingsKey);
  
  console.log('📦 localStorage actual:');
  console.log('- academia_v4_semestres:', localSemestres ? JSON.parse(localSemestres) : null);
  console.log('- academia_v3_settings:', localSettings ? JSON.parse(localSettings) : null);
  
  // 2. Verificar si hay datos en el estado actual de la aplicación
  if (typeof State !== 'undefined') {
    console.log('📊 Estado actual de State:');
    console.log('- State.semestres:', State.semestres);
    console.log('- State.settings:', State.settings);
  }
  
  // 3. Verificar si hay backups en localStorage con nombres antiguos
  const allKeys = Object.keys(localStorage);
  const backupKeys = allKeys.filter(k => k.includes('academia') && !k.includes('v4_semestres') && !k.includes('v3_settings'));
  console.log('🗂️ Posibles backups encontrados:', backupKeys);
  backupKeys.forEach(key => {
    console.log(`- ${key}:`, localStorage.getItem(key));
  });
  
  // 4. Verificar datos en Supabase (si está disponible)
  if (typeof window.AcademiaDB !== 'undefined' || typeof window.DB !== 'undefined') {
    const db = window.AcademiaDB || window.DB;
    console.log('🌐 Verificando datos remotos...');
    db.load().then(remoteData => {
      console.log('📥 Datos remotos:', remoteData);
    }).catch(err => {
      console.error('❌ Error cargando datos remotos:', err);
    });
  }
  
  // 5. Verificar IndexedDB para imágenes
  console.log('🖼️ Verificando IndexedDB para imágenes...');
  const request = indexedDB.open('academia_images', 2);
  request.onsuccess = (e) => {
    const db = e.target.result;
    if (db.objectStoreNames.contains('images')) {
      const tx = db.transaction('images', 'readonly');
      const store = tx.objectStore('images');
      const getAll = store.getAllKeys();
      getAll.onsuccess = () => {
        console.log('🖼️ Imágenes en IndexedDB:', getAll.result);
      };
    }
    if (db.objectStoreNames.contains('deleted_images')) {
      const tx = db.transaction('deleted_images', 'readonly');
      const store = tx.objectStore('deleted_images');
      const getAll = store.getAllKeys();
      getAll.onsuccess = () => {
        console.log('🗑️ Imágenes eliminadas (recuperables):', getAll.result);
      };
    }
  };
  
  console.log('✅ Verificación completada. Revisa la consola para más detalles.');
})();
