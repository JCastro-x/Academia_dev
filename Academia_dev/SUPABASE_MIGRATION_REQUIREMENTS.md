# Requisitos para Migración a Supabase Storage

## Tarea 1: Migración de Archivos a Supabase Storage

### Bucket Requerido
- **Nombre**: `social-files`
- **Tipo**: Público (para acceso vía URL pública)
- **Política**: Habilitar upload y lectura pública

### Cambios en Tabla `social_files`

#### Columnas Nuevas (Agregar)
```sql
ALTER TABLE social_files ADD COLUMN storage_path TEXT;
ALTER TABLE social_files ADD COLUMN public_url TEXT;
```

#### Columna Obsoleta (Opcional - Eliminar después de migrar datos existentes)
```sql
-- Solo ejecutar después de que todos los archivos existentes hayan sido migrados
ALTER TABLE social_files DROP COLUMN data;
```

### Notas
- Los archivos nuevos se guardarán en Storage con ruta: `groups/{groupId}/{timestamp}_{filename}`
- La tabla solo guardará metadatos: `storage_path` y `public_url`
- La función `getFiles()` ya no solicita la columna `data` para reducir egress
- La función `deleteFile()` elimina del Storage y de la tabla

---

## Tarea 2: Optimización de Sincronización

### Cambios en Código (Ya Implementados)
- `academia-sync.js`: La función `load()` ahora acepta parámetro opcional `localUpdatedAt`
- `academia-sync.js`: Preflight check usando `getRemoteUpdatedAt()` antes de descargar JSONB completo
- `init.js`: Ya tiene lógica de preflight implementada (líneas 374-392) - NO requiere cambios

### Comportamiento
1. Cada 90s, el intervalo en `init.js` verifica si hay cambios locales recientes
2. Si no hay cambios locales, hace preflight con `getRemoteUpdatedAt()`
3. Solo si el remoto es más reciente que el local, descarga el payload completo
4. Esto reduce descargas de JSONB pesado cuando no hay cambios

### Variables Locales
- `window._localModifiedAt`: Timestamp de última modificación local (ms desde epoch)
- Se actualiza automáticamente cuando hay cambios en el estado local

---

## Resumen de Archivos Modificados

### `js/db.js`
- `uploadFile()`: Migrado a usar Supabase Storage
- `getFiles()`: Excluye columna `data` del SELECT
- `deleteFile()`: Elimina del Storage antes de borrar registro

### `js/academia-sync.js`
- `load()`: Acepta parámetro opcional `localUpdatedAt` para preflight
- `getRemoteUpdatedAt()`: Ya existía, se usa para preflight

### `js/init.js`
- NO requiere cambios (ya tiene lógica de preflight implementada)
