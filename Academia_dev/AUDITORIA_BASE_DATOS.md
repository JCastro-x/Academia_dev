# Auditoría Completa del Sistema de Base de Datos - Academia

**Fecha:** 30 de abril de 2026  
**Versión:** Auditoría completa de arquitectura, sincronización y almacenamiento

---

## 📊 Resumen Ejecutivo

Academia utiliza una arquitectura híbrida de 3 capas para almacenamiento de datos:

1. **Supabase** - Autenticación (Google OAuth) y fallback de datos
2. **Turso** - Base de datos principal para datos estructurados (semestres, settings)
3. **IndexedDB** - Almacenamiento local de archivos pesados (imágenes, canvas, PDFs)
4. **localStorage** - Caché rápido y estado local

**Estado actual:** El sistema está configurado para usar Turso cuando esté disponible, con fallback automático a Supabase.

---

## 🏗️ Arquitectura de Base de Datos

### 1. Supabase (Autenticación + Fallback)

**URL:** `https://mwzezekdxrutpzqbduvh.supabase.co`  
**Uso principal:** Google OAuth Authentication  
**Tabla:** `user_data` (fallback cuando Turso no está configurado)

**Estructura de tabla Supabase:**
```sql
user_data (
  user_id TEXT PRIMARY KEY,
  semestres JSONB,
  settings JSONB,
  updated_at TIMESTAMP
)
```

**Configuración en auth.js:**
- Session persistente: `persistSession: true`
- Auto-refresh token: `autoRefreshToken: true`
- Storage key: `academia_auth_session`

---

### 2. Turso (Base de Datos Principal)

**Uso principal:** Datos pesados (semestres, settings)  
**Protocolo:** HTTP API sobre SQLite edge database  
**Configuración:** Almacenada en localStorage

**Tablas Turso:**
```sql
-- Tabla principal de datos por semestre
user_data (
  user_id TEXT,
  semester_id TEXT,
  data TEXT,              -- JSON del semestre
  updated_at TEXT,
  PRIMARY KEY (user_id, semester_id)
)

-- Tabla de settings globales
user_settings (
  user_id TEXT PRIMARY KEY,
  settings TEXT,          -- JSON de settings
  updated_at TEXT
)
```

**Multi-tenancy:** Cada usuario tiene sus datos separados por `user_id`

**Configuración en localStorage:**
- `turso_url`: URL de la base de datos Turso
- `turso_auth_token`: Token de autenticación

---

### 3. IndexedDB (Archivos Locales)

**Nombre:** `academia_images`  
**Versión:** 2  
**Object stores:**
- `images`: Almacenamiento principal de imágenes comprimidas
- `deleted_images`: Soft delete con timestamps para undo (5 segundos)

**Compresión de imágenes:**
- Max width: 1920px
- Quality: 0.5
- Formato: JPEG (o PNG si hay transparencia)

**Cleanup automático:**
- Imágenes expiradas en `deleted_images`: cada 10 minutos
- Imágenes no usadas: manual vía `window.cleanupUnusedImages()`

---

### 4. localStorage (Caché Local)

**Keys principales:**
- `academia_v4_semestres`: Array de semestres
- `academia_v3_settings`: Settings globales
- `academia_v3_pom_today`: Sesiones Pomodoro de hoy
- `academia_v3_pom_history`: Historial Pomodoro
- `academia_v3_pom_snapshots`: Snapshots diarios (no sincronizados)
- `academia_v3_pom_running`: Estado del timer Pomodoro
- `academia_guest_mode`: Flag de modo invitado
- `_academia_last_user`: Último usuario autenticado
- `turso_url`: Configuración Turso
- `turso_auth_token`: Token Turso

---

## 🔄 Flujo de Sincronización

### Inicialización (init.js)

**Al cargar la app:**

1. **Verificar modo invitado:**
   - Si `academia_guest_mode === '1'` → Saltar auth, usar datos locales

2. **Verificar autenticación Supabase:**
   - `Auth.checkAuth()` con timeout de 5 segundos
   - Si falla y hay datos locales + offline → Acceso local permitido
   - Si falla sin datos → Redirigir a auth-page.html

3. **Inicializar base de datos:**
   ```javascript
   const db = getAcademiaDB(); // window.AcademiaDB || window.DB
   db.init(auth.id);
   ```

4. **Cargar datos remotos:**
   ```javascript
   const dbData = await db.load();
   ```

5. **Decisión de sync (timestamp comparison):**
   - `remoteUpdatedAt > localModifiedAt` → Usar datos remotos
   - `remoteUpdatedAt <= localModifiedAt` → Mantener datos locales

6. **Usuario nuevo con datos de invitado:**
   - Migrar datos locales a DB remota
   - Limpiar flag de invitado

---

### Guardado de Datos (state.js)

**Función `saveState(keys)`:**
- Debounce: **3000ms**
- Marca modificación local: `window._localModifiedAt = Date.now()`
- Guarda en localStorage inmediatamente
- Programa sync remoto con delta sync

**Delta sync (rastreo de campos cambiados):**
```javascript
if (k === 'all') → ['semestres', 'settings']
if (k === 'semestres') → ['semestres']
if (k === 'settings') → ['settings']
if (k === 'materias' | 'grades' | 'topics') → ['semestres']
if (k === 'tasks') → ['semestres']
if (k === 'events') → ['settings']
```

**Función `saveStateNow(keys)`:**
- Sin debounce
- Guardado inmediato en localStorage y DB remota
- Usado para operaciones críticas

---

### Sincronización Remota (academia-sync.js)

**Debounce remoto: 10000ms**

**Función `save(semestres, settings, changedFields, semesterId)`:**
- Debounce de 10 segundos
- Optimiza datos antes de enviar:
  - Trunca contenido de notas > 10KB
  - Elimina canvasData (solo referencias IDB)
  - Reduce historial Pomodoro a últimos 3 días
  - NUNCA sincroniza snapshots (son muy pesados)

**Función `saveNow(...)`:**
- Ejecución inmediata
- Cancela debounce pendiente

**Optimizaciones de ancho de banda:**
- Delta sync: solo campos cambiados
- Preflight check: compara timestamps antes de descargar
- Truncación de contenido largo
- Exclusión de datos pesados (snapshots, history completo)

---

### Sincronización Automática (init.js)

**Triggers de sync:**

1. **Al cargar la página:**
   - Delay de 1000ms
   - `_syncFromSupabase(true)` con force=true

2. **Sync periódico:**
   - Intervalo: **6 horas** (21600000ms)
   - Solo si no hubo modificación local en últimos 30 segundos
   - Preflight check cada 10 segundos para evitar llamadas innecesarias

3. **Visibility change:**
   - Al ocultar pestaña: flush save pendiente
   - Al mostrar pestaña: **DESHABILITADO** (para reducir egress)

4. **Window focus:**
   - **DESHABILITADO** (para reducir egress)

5. **Page hide:**
   - Flush save pendiente

**Preflight check (getRemoteUpdatedAt):**
- Consulta solo `updated_at` (campo único)
- Throttle: máximo cada 10 segundos
- Si remoto <= local: aborta descarga completa

---

## 📦 Optimizaciones de Datos

### Optimización de Semestres

**En carga (load):**
- Trunca contenido de notas > 10KB con `[TRUNCADO]`
- Mantiene solo referencias IDB para canvasData
- Calcula tamaño de payload para logging

**En guardado (_optimizeData):**
- Elimina canvasData completo (solo referencias IDB)
- Comprime contenido de notas

### Optimización de Settings (Pomodoro)

**Historial:**
- Solo últimos 3 días (reducido de 7 días)
- Fecha actual siempre incluida

**Snapshots:**
- **NUNCA sincronizados** (son muy pesados)
- Se generan y guardan localmente

**Payload típico:**
```javascript
{
  today: [...],           // Sesiones de hoy
  date: "Mon Apr 30 2026",
  goal: 4,
  history: {             // Solo 3 días
    "Mon Apr 30 2026": [...],
    "Sun Apr 29 2026": [...],
    "Sat Apr 28 2026": [...]
  },
  updatedAt: 1714492800000
  // snapshots: EXCLUIDO
}
```

---

## 📍 Puntos de Carga de Datos

### 1. Inicialización (init.js)

**Ubicación:** `init()` → línea 133-194  
**Cuándo:** Al cargar app.html después de auth exitoso  
**Qué carga:**
- Semestres completos
- Settings globales
- Datos Pomodoro (today, history, NO snapshots)

**Decisión de merge:**
```javascript
const remoteUpdatedAt = dbData.updatedAt ? Date.parse(dbData.updatedAt) : 0;
const localModifiedAt = window._localModifiedAt || 0;
const shouldUseRemote = remoteUpdatedAt > localModifiedAt;
```

---

### 2. Sync Automático (init.js)

**Ubicación:** `_syncFromSupabase()` → línea 403-486  
**Cuándo:** 
- Al cargar (1000ms delay)
- Cada 6 horas
- Solo si no hay modificación local reciente (< 30s)

**Qué carga:**
- Semestres completos
- Settings con merge de Pomodoro
- Re-render de UI si hay cambios

---

### 3. Guardado Local (state.js)

**Ubicación:** `saveState()` → línea 575-597  
**Cuándo:** Cada cambio en datos (llamado desde múltiples módulos)  
**Qué guarda:**
- localStorage inmediato
- DB remota con debounce 10s

**Llamadores frecuentes:**
- notes.js: ~20 llamadas en diferentes acciones
- materias.js, tasks.js, calendar.js, etc.

---

### 4. IndexedDB (state.js)

**Cuándo:**
- Al guardar imágenes: `idbSetImage()`
- Al cargar imágenes: `idbGetImage()`
- Al eliminar: `idbDeleteImage()` (soft delete)
- Al restaurar: `idbRestoreImage()` (undo)

**Cleanup:**
- Imágenes expiradas: cada 10 minutos
- Imágenes no usadas: manual

---

## ⏱️ Frecuencias de Sincronización

| Operación | Frecuencia | Debounce | Ubicación |
|-----------|------------|----------|-----------|
| Save local (localStorage) | Inmediato | 0ms | state.js:575 |
| Save remoto (DB) | Debounce | 10000ms | academia-sync.js:274 |
| Save remoto (Turso) | Debounce | 10000ms | turso-sync.js:360 |
| Sync periódico | 6 horas | - | init.js:502 |
| Preflight check | 10s throttle | - | init.js:425 |
| Cleanup imágenes expiradas | 10 minutos | - | state.js:285 |
| Auth check | Al cargar | 5s timeout | auth.js:90 |

---

## 🔀 Switch Automático Turso ↔ Supabase

**Lógica en academia-sync.js:**

```javascript
function _isTursoConfigured() {
  return !!(localStorage.getItem('turso_url') && 
             localStorage.getItem('turso_auth_token'));
}

// En init()
_useTurso = _isTursoConfigured();

if (_useTurso) {
  await window.TursoDB.init(userId);
} else {
  // Fallback a Supabase
}
```

**En cada operación:**
```javascript
if (_useTurso && window.TursoDB) {
  return await window.TursoDB.load(...);
}
// Fallback a Supabase
```

**Activar Turso:**
```javascript
localStorage.setItem('turso_url', 'https://xxx.turso.io');
localStorage.setItem('turso_auth_token', 'eyJhbGciOi...');
// Recargar app
```

**Desactivar Turso:**
```javascript
localStorage.removeItem('turso_url');
localStorage.removeItem('turso_auth_token');
// Recargar app
```

---

## 🚨 Problemas Identificados

### 1. No existe schema SQL en el repositorio
- **Archivo esperado:** `sql/flashcards-turso-schema.sql`
- **Estado:** No encontrado
- **Impacto:** Schema se crea dinámicamente en turso-sync.js:65-81

### 2. No existe flashcards-sync.js
- **Archivo esperado:** `js/flashcards-sync.js`
- **Estado:** No encontrado
- **Impacto:** Flashcards se guardan en State.flashcards (dentro de semestres)

### 3. Hardcoded credentials en auth.js
- **Línea 8-9:** SUPABASE_URL y SUPABASE_ANON_KEY visibles
- **Riesgo:** Exposición en cliente
- **Recomendación:** Usar variables de entorno en producción

### 4. Sync al focus/visibility deshabilitado
- **Línea 492-499 init.js:** Comentados para reducir egress
- **Impacto:** Los cambios en otros dispositivos no se reflejan inmediatamente
- **Trade-off:** Ahorro de ancho de banda vs frescura de datos

---

## 📊 Flujo de Datos Completo

```
┌─────────────────────────────────────────────────────────────┐
│                     USUARIO INTERACTÚA                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    STATE (state.js)                            │
│  - State.semestres, State.settings                             │
│  - saveState(['all']) → debounce 3000ms                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  LOCALSTORAGE (inmediato)                      │
│  - academia_v4_semestres                                       │
│  - academia_v3_settings                                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              ACADEMIA-SYNC.JS (debounce 10000ms)               │
│  - Detecta Turso vs Supabase                                   │
│  - Optimiza datos (trunca, excluye snapshots)                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼                           ▼
┌───────────────────────┐     ┌───────────────────────┐
│      TURSO DB         │     │     SUPABASE DB       │
│  (si configurado)     │     │   (fallback)          │
│  - user_data          │     │  - user_data          │
│  - user_settings      │     │  - JSONB columns      │
└───────────────────────┘     └───────────────────────┘
            │                           │
            └─────────────┬─────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              INDEXEDDB (archivos pesados)                    │
│  - academia_images (imágenes comprimidas)                    │
│  - deleted_images (soft delete para undo)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Seguridad

### Supabase
- **Auth:** Google OAuth con Supabase
- **Session:** Persistente en localStorage
- **Storage key:** `academia_auth_session`
- **Auto-refresh:** Habilitado

### Turso
- **Token:** Almacenado en localStorage (desarrollo)
- **Recomendación producción:** Variables de entorno
- **Permisos:** Lectura/escritura completos
- **Multi-tenancy:** Separación por user_id

### IndexedDB
- **Alcance:** Local al navegador
- **Compresión:** JPEG 0.5 quality, max 1920px
- **Soft delete:** 5 segundos de ventana de undo

---

## 📈 Métricas de Ancho de Banda

### Estimaciones (basado en código)

**Payload típico de semestres:**
- Sin optimización: ~50-200KB
- Con optimización: ~20-80KB (60% reducción)
- Truncación de notas > 10KB

**Payload típico de settings:**
- Sin optimización: ~10-50KB (con snapshots)
- Con optimización: ~2-5KB (sin snapshots, 3 días history)
- Reducción: ~90%

**Ahorro total estimado:** 40-60% en egress

---

## ✅ Checklist de Auditoría

- [x] Arquitectura de base de datos documentada
- [x] Flujo de sincronización mapeado
- [x] Frecuencias de sync identificadas
- [x] Puntos de carga localizados
- [x] Optimizaciones de datos documentadas
- [x] Switch Turso/Supabase explicado
- [x] Seguridad evaluada
- [x] Problemas identificados
- [x] Métricas de ancho de banda estimadas

---

## 🎯 Recomendaciones

1. **Mover credenciales a variables de entorno**
   - Supabase URL y key en auth.js
   - Turso token en producción

2. **Crear archivo de schema SQL**
   - Documentar estructura de tablas
   - Facilitar migraciones

3. **Considerar re-habilitar sync al focus**
   - Con preflight check agresivo
   - Para mejor experiencia multi-dispositivo

4. **Implementar sistema de logging**
   - Track de egress por operación
   - Alertas de consumo alto

5. **Agregar tests de integración**
   - Sync bidireccional
   - Conflict resolution
   - Fallback Turso → Supabase

---

**Fin de auditoría**
