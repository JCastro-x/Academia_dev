// Backup IndexedDB - Ejecutar en consola del navegador mientras la app está abierta
(async function backupIndexedDB() {
  const DB_NAME = 'academia_images';
  
  // VALIDACIÓN: Evitar ejecutar en file:// (origen incorrecto)
  if (window.location.protocol === 'file:') {
    console.error('❌ [BACKUP] ERROR CRÍTICO: Estás ejecutando esto en file://');
    console.error('❌ [BACKUP] IndexedDB está aislado por origen, así que file:// tiene una DB vacía separada');
    console.error('❌ [BACKUP] INSTRUCCIONES CORRECTAS:');
    console.error('   1. Abre la app desde http://localhost:PUERTO/app.html (Live Server)');
    console.error('   2. NO abras backup-indexed.html con doble-click');
    console.error('   3. Abre la consola (F12) en ESA pestaña con la app cargada');
    console.error('   4. Pega este snippet en esa consola y presiona Enter');
    console.error('❌ [BACKUP] Abortando backup por protocolo incorrecto');
    return;
  }
  
  console.log('[BACKUP] Iniciando backup de IndexedDB...');
  console.log('[BACKUP] Origen:', window.location.origin);
  
  try {
    const db = await new Promise((resolve, reject) => {
      console.log(`[BACKUP] Abriendo DB: ${DB_NAME}`);
      const request = indexedDB.open(DB_NAME);
      
      request.onerror = () => {
        console.error('[BACKUP] Error abriendo DB:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        console.log('[BACKUP] DB abierta exitosamente');
        console.log('[BACKUP] DB version:', request.result.version);
        console.log('[BACKUP] Object stores:', Array.from(request.result.objectStoreNames));
        resolve(request.result);
      };
    });
    
    const storeNames = Array.from(db.objectStoreNames);
    console.log('[BACKUP] Object stores encontrados:', storeNames);
    
    const backup = {
      timestamp: new Date().toISOString(),
      dbName: DB_NAME,
      version: db.version,
      stores: {}
    };
    
    let totalRecords = 0;
    
    for (const storeName of storeNames) {
      console.log(`[BACKUP] Leyendo ${storeName}...`);
      
      const data = await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        transaction.onerror = () => {
          console.error(`[BACKUP] Error en transacción para ${storeName}:`, transaction.error);
          reject(transaction.error);
        };
        
        request.onerror = () => {
          console.error(`[BACKUP] Error leyendo ${storeName}:`, request.error);
          reject(request.error);
        };
        
        request.onsuccess = () => {
          console.log(`[BACKUP] Leídos ${request.result.length} registros de ${storeName}`);
          resolve(request.result);
        };
      });
      
      backup.stores[storeName] = data;
      totalRecords += data.length;
    }
    
    db.close();
    
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `academia-indexeddb-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const sizeMB = (json.length / 1024 / 1024).toFixed(2);
    console.log(`[BACKUP] ✅ Backup completado exitosamente`);
    console.log(`[BACKUP] Total registros: ${totalRecords}`);
    console.log(`[BACKUP] Tamaño: ${sizeMB} MB`);
    console.log(`[BACKUP] Archivo descargado: academia-indexeddb-backup-${new Date().toISOString().split('T')[0]}.json`);
    
  } catch (error) {
    console.error('[BACKUP] ❌ Error:', error);
  }
})();
