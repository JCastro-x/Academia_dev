# Requisitos para Migración a Supabase

## Nota Importante
El módulo social (Study Space) ha sido eliminado. Este archivo documenta la sincronización de datos de Academia y las optimizaciones para reducir egress.

## Optimización de Sincronización

### Cambios en Código (Implementados)
- `academia-sync.js`: `load()` acepta parámetro opcional `localUpdatedAt` para preflight
- `academia-sync.js`: Preflight check usando `getRemoteUpdatedAt()` antes de descargar JSONB completo
- `academia-sync.js`: `load()` acepta `options.exclude` para omitir datos pesados (pomData, snapshots)
- `academia-sync.js`: Optimización automática de pomodoro (historial limitado a 7 días, snapshots excluidos)
- `init.js`: Lógica de preflight implementada (sync cada hora, no cada 90s)
- `state.js`: Debounce de saveState aumentado a 3000ms para reducir egress
- `loader.js`: Lazy loading de partials HTML (solo 3 críticos al inicio, resto on-demand)
- `ui.js`: `goPage()` modificado para cargar partials on-demand
- `db.js`: ELIMINADO - Módulo social completamente removido

### Comportamiento de Sync
1. **Preflight**: Antes de descargar, verifica si el remoto es más reciente que el local
2. **Sync periódico**: Cada hora (no cada 90s) si no hay cambios locales recientes
3. **Solo si necesario**: Descarga payload completo solo cuando el remoto cambió
4. **Optimización pomodoro**: Historial truncado a 7 días, snapshots no sincronizados

### Lazy Loading de Partials
- **Críticos** (cargan al inicio): overview, modals, overlays
- **On-demand** (cargan al navegar): semestres, perfil, materias, tareas, general, calendario, calificaciones, temas, estadisticas, horario, notas, pomodoro, flashcards
- **Reducción**: ~120KB menos de carga inicial

### Variables Locales
- `window._localModifiedAt`: Timestamp de última modificación local (ms desde epoch)
- Se actualiza automáticamente cuando hay cambios en el estado local

---

## Resumen de Archivos Modificados

### `js/academia-sync.js`
- `load(localUpdatedAt?, options?)`: Preflight + selective data loading
- `getRemoteUpdatedAt()`: Preflight barato para evitar descargas innecesarias
- `_optimizeData()`: Trunca historial pomodoro a 7 días, excluye snapshots

### `js/state.js`
- `saveState()`: Debounce aumentado de 400ms a 3000ms

### `js/init.js`
- Sync periódico: 1 hora (antes 5 minutos)
- Preflight implementado

### `js/loader.js`
- Lazy loading: solo 3 partials críticos al inicio
- `window.loadPartial()`: Función pública para cargar on-demand

### `js/ui.js`
- `goPage()`: Modificado a async, carga partials on-demand

### `js/db.js`
- ELIMINADO - Módulo social removido
