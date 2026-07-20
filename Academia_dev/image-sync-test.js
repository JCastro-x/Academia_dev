// FASE 3a: Test manual de calculateHash + uploadImage
// Ejecutar en consola del navegador mientras la app está abierta
(async function testImageSync() {
  // VALIDACIÓN: Evitar ejecutar en file://
  if (window.location.protocol === 'file:') {
    console.error('❌ ERROR: Ejecuta esto en http://localhost, no file://');
    return;
  }

  console.log('[IMAGE SYNC TEST] Iniciando prueba de sync de imágenes...');
  console.log('[IMAGE SYNC TEST] Origen:', window.location.origin);

  // ============================================
  // 1. calculateHash(dataUrl) - Calcular SHA-256
  // ============================================
  async function calculateHash(dataUrl) {
    try {
      // Extraer datos base64 (quitar header "data:image/jpeg;base64,")
      const base64Data = dataUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('Formato dataUrl inválido');
      }

      // Convertir base64 a Uint8Array
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Calcular SHA-256
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      return hashHex;
    } catch (error) {
      console.error('[calculateHash] Error:', error);
      throw error;
    }
  }

  // ============================================
  // 2. uploadImage(imageKey, dataUrl, hash) - Subir a Supabase
  // ============================================
  async function uploadImage(imageKey, dataUrl, hash) {
    const client = window.Auth?.getClient();
    if (!client) {
      throw new Error('Cliente Supabase no disponible (window.Auth.getClient())');
    }

    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    const userId = user.id;
    const fileName = `${hash}.jpg`;
    const filePath = `${userId}/${fileName}`;

    console.log(`[uploadImage] Subiendo ${imageKey} como ${filePath}...`);

    try {
      // PASO 1: Convertir dataUrl a Blob para subir
      const base64Data = dataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/jpeg' });

      // PASO 2: Subir a Supabase Storage
      const { data: uploadData, error: uploadError } = await client.storage
        .from('academia_images')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true // Sobrescribir si existe (mismo hash = mismo contenido)
        });

      if (uploadError) {
        console.error('[uploadImage] Error subiendo a Storage:', uploadError);
        throw uploadError;
      }

      console.log(`[uploadImage] ✅ Subida exitosa a Storage: ${filePath}`);

      // PASO 3: Insertar/actualizar en image_manifests
      const manifestData = {
        user_id: userId,
        image_key: imageKey,
        hash: hash,
        file_path: filePath,
        file_size: dataUrl.length,
        updated_at: new Date().toISOString()
      };

      const { data: manifestResult, error: manifestError } = await client
        .from('image_manifests')
        .upsert(manifestData, {
          onConflict: 'user_id,image_key'
        });

      if (manifestError) {
        console.error('[uploadImage] ❌ Error escribiendo manifest:', manifestError);
        console.error('[uploadImage] ⚠️ ARCHIVO HUÉRFANO EN STORAGE:', filePath);
        console.error('[uploadImage] ⚠️ Debes limpiarlo manualmente después');
        throw manifestError;
      }

      console.log(`[uploadImage] ✅ Manifest escrito exitosamente`);
      console.log(`[uploadImage] ✅ Upload completo para ${imageKey}`);

      return { filePath, manifestData };

    } catch (error) {
      console.error('[uploadImage] Error crítico:', error);
      throw error;
    }
  }

  // ============================================
  // 3. Cargar una imagen de prueba desde IndexedDB
  // ============================================
  async function loadTestImage() {
    const DB_NAME = 'academia_images';
    
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    const storeNames = Array.from(db.objectStoreNames);
    console.log('[TEST] Object stores:', storeNames);

    if (!storeNames.includes('images')) {
      db.close();
      throw new Error('Store "images" no encontrado');
    }

    // Obtener todas las imágenes para contar
    const images = await new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readonly');
      const store = transaction.objectStore('images');
      const request = store.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    if (images.length === 0) {
      db.close();
      throw new Error('No hay imágenes en IndexedDB');
    }

    console.log(`[TEST] Encontradas ${images.length} imágenes en IndexedDB`);

    // Obtener las keys de todas las imágenes
    const keys = await new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readonly');
      const store = transaction.objectStore('images');
      const request = store.getAllKeys();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    // Obtener la primera imagen (key + dataUrl)
    const testKey = keys[0];
    const testDataUrl = await new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readonly');
      const store = transaction.objectStore('images');
      const request = store.get(testKey);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    // Cerrar la DB SOLO después de todas las transacciones
    db.close();

    return { key: testKey, dataUrl: testDataUrl };
  }

  // ============================================
  // 4. Ejecutar prueba completa
  // ============================================
  try {
    console.log('[TEST] Cargando imagen de prueba desde IndexedDB...');
    const { key, dataUrl } = await loadTestImage();
    console.log(`[TEST] Imagen cargada: ${key} (${(dataUrl.length / 1024).toFixed(1)}KB)`);

    console.log('[TEST] Calculando hash SHA-256...');
    const hash = await calculateHash(dataUrl);
    console.log(`[TEST] Hash calculado: ${hash}`);

    console.log('[TEST] Iniciando upload a Supabase Storage...');
    const result = await uploadImage(key, dataUrl, hash);
    console.log('[TEST] ✅ PRUEBA COMPLETADA EXITOSAMENTE');
    console.log('[TEST] Resultado:', result);

  } catch (error) {
    console.error('[TEST] ❌ ERROR EN PRUEBA:', error);
  }
})();
