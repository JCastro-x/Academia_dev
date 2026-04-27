# Requisitos para Migración a Supabase

## Nota Importante
El módulo social (Study Space) ha sido eliminado. Este archivo ahora solo documenta la sincronización de datos de Academia.

## Optimización de Sincronización

### Cambios en Código (Ya Implementados)
- `academia-sync.js`: La función `load()` ahora acepta parámetro opcional `localUpdatedAt`
- `academia-sync.js`: Preflight check usando `getRemoteUpdatedAt()` antes de descargar JSONB completo
- `init.js`: Ya tiene lógica de preflight implementada - NO requiere cambios
- `state.js`: Debounce de saveState aumentado a 3000ms para reducir egress

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

### `js/academia-sync.js`
- `load()`: Acepta parámetro opcional `localUpdatedAt` para preflight
- `getRemoteUpdatedAt()`: Ya existía, se usa para preflight

### `js/state.js`
- `saveState()`: Debounce aumentado de 400ms a 3000ms para reducir egress

### `js/init.js`
- NO requiere cambios (ya tiene lógica de preflight implementada)

### `js/db.js`
- Módulo social eliminado - Study Space ya no está activo
