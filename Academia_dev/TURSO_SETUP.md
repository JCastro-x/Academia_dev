# Configuración de Turso para Academia

## 📋 Resumen

Esta guía explica cómo configurar Turso como base de datos alternativa para reducir el consumo de ancho de banda (egress) de Supabase.

**Arquitectura final:**
- **Supabase**: Solo para autenticación (Google Login) - casi sin consumo de egress
- **Turso**: Para datos pesados (semestres, settings) - SQLite edge database, más ligero
- **IndexedDB**: Para archivos (imágenes, canvas, PDFs) - local en el navegador

## 🚀 Pasos de Configuración

### 1. Crear cuenta en Turso

1. Ve a [turso.tech](https://turso.tech) y crea una cuenta gratis
2. El plan gratis incluye:
   - 500 MB de almacenamiento
   - 1B filas leídas/mes
   - 10M filas escritas/mes
   - 3 bases de datos

### 2. Crear base de datos

1. En el dashboard de Turso, crea una nueva base de datos
2. Nombre sugerido: `academia`
3. Región: elige la más cercana a tus usuarios (ej: `ams` para Europa, `iad` para US East)
4. Copia la **Database URL** (se ve como `https://xxx.turso.io`)

### 3. Generar token de autenticación

1. En Settings > Authentication tokens
2. Crea un nuevo token
3. Elige permisos: "All databases" o específico para tu DB
4. Copia el token (se ve como `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### 4. Migrar datos desde Supabase

1. Abre `migrate-to-turso.html` en tu navegador
2. Ingresa la URL y token de Turso
3. Haz clic en "Probar Conexión" para verificar
4. Haz clic en "Iniciar Migración"
5. La herramienta:
   - Lee datos de Supabase
   - Crea tabla `user_data` en Turso
   - Migra todos los usuarios separados por `user_id`
   - Configura tu app para usar Turso automáticamente

### 5. Verificar migración

Después de migrar:
1. Recarga tu app (`app.html`)
2. Abre la consola del navegador
3. Deberías ver: `✅ window.DB usando Turso para usuario: xxx`
4. Tus datos deberían cargarse normalmente

## 🔧 Estructura de Datos en Turso

### Tabla `user_data`

```sql
CREATE TABLE user_data (
  user_id TEXT PRIMARY KEY,
  semestres TEXT,      -- JSON array de semestres
  settings TEXT,       -- JSON object de settings
  updated_at TEXT      -- ISO timestamp
);
```

**Separación por usuario:**
- Cada `user_id` (de Supabase auth) tiene su propia fila
- Los datos de diferentes usuarios nunca se mezclan
- Multi-tenancy nativo con PRIMARY KEY

## 📊 Comparación de Ancho de Banda

### Antes (Solo Supabase)
- **Auth**: Google Login (Supabase)
- **Datos**: semestres + settings (Supabase JSONB)
- **Archivos**: IndexedDB local (referencias en Supabase)
- **Egress**: Alto por JSONB grandes

### Después (Supabase + Turso)
- **Auth**: Google Login (Supabase) - ~1KB/login
- **Datos**: semestres + settings (Turso SQLite) - ~50% menos egress
- **Archivos**: IndexedDB local (referencias en Turso)
- **Egress**: Reducido significativamente

**Estimación de ahorro:**
- Turso es más eficiente que Supabase para consultas JSON
- SQLite edge database reduce latencia
- Ahorro estimado: 40-60% en egress de datos

## 🔄 Funcionamiento del Switch Automático

El código en `academia-sync.js` detecta automáticamente si usar Turso:

```javascript
// Verifica si Turso está configurado
function _isTursoConfigured() {
  return !!(localStorage.getItem('turso_url') && 
             localStorage.getItem('turso_auth_token'));
}

// Si está configurado, usa Turso; si no, usa Supabase
if (_useTurso && window.TursoDB) {
  return await window.TursoDB.load(localUpdatedAt, options);
}
// Fallback a Supabase
```

### Configuración en localStorage

```javascript
localStorage.setItem('turso_url', 'https://xxx.turso.io');
localStorage.setItem('turso_auth_token', 'eyJhbGciOi...');
```

### Desactivar Turso (volver a Supabase)

Si necesitas volver a Supabase:

```javascript
localStorage.removeItem('turso_url');
localStorage.removeItem('turso_auth_token');
// Recarga la app
```

## 🛡️ Seguridad

### Tokens de Turso

- **Nunca** commits tokens en el repositorio
- Usa variables de entorno en producción
- Los tokens en localStorage son para desarrollo
- En producción, usa tokens con permisos limitados

### Permisos recomendados

Para producción:
- Token de lectura: solo `SELECT`
- Token de escritura: `SELECT, INSERT, UPDATE`
- Nunca usar token con `DELETE` en cliente

## 🐛 Troubleshooting

### Error: "Turso no configurado"

**Causa:** Falta turso_url o turso_auth_token en localStorage

**Solución:**
```javascript
localStorage.setItem('turso_url', 'https://xxx.turso.io');
localStorage.setItem('turso_auth_token', 'tu-token');
```

### Error: "Turso configurado pero turso-sync.js no cargado"

**Causa:** El script turso-sync.js no se cargó antes de academia-sync.js

**Solución:** Verifica que en `app.html`:
```html
<script src="js/turso-sync.js"></script>
<script src="js/academia-sync.js"></script>
```

### Datos no se sincronizan

**Causa:** Turso URL incorrecta o token inválido

**Solución:**
1. Abre `migrate-to-turso.html`
2. Haz clic en "Probar Conexión"
3. Verifica que la URL y token sean correctos

### Error: "user_data table does not exist"

**Causa:** La tabla no se creó en Turso

**Solución:**
1. Ejecuta el script de migración nuevamente
2. O crea la tabla manualmente en el dashboard de Turso

## 📈 Monitoreo

### Verificar uso de Turso

En el dashboard de Turso:
- **Storage**: Cuánto espacio usan tus datos
- **Reads**: Filas leídas por mes
- **Writes**: Filas escritas por mes
- **Latency**: Tiempo de respuesta por región

### Límites del plan gratis

- 500 MB almacenamiento
- 1B filas leídas/mes
- 10M filas escritas/mes
- 3 bases de datos

Si excedes los límites, Turso te notificará.

## 🔄 Rollback a Supabase

Si necesitas volver completamente a Supabase:

1. **Desactivar Turso:**
   ```javascript
   localStorage.removeItem('turso_url');
   localStorage.removeItem('turso_auth_token');
   ```

2. **Recargar la app** - usará Supabase automáticamente

3. **Opcional - Eliminar datos de Turso:**
   - En el dashboard de Turso, elimina la base de datos
   - O ejecuta: `DELETE FROM user_data WHERE user_id = 'tu-user-id'`

## 📚 Referencias

- [Documentación de Turso](https://docs.turso.tech)
- [SQLite en Turso](https://docs.turso.tech/sdk/ts/sqlite-api)
- [Supabase Auth](https://supabase.com/docs/guides/auth)

## ✅ Checklist de Migración

- [ ] Cuenta creada en Turso
- [ ] Base de datos creada
- [ ] Token de autenticación generado
- [ ] Script de migración ejecutado
- [ ] Datos verificados en Turso
- [ ] App recargada y funcionando
- [ ] Consola muestra "usando Turso"
- [ ] Datos se sincronizan correctamente
- [ ] Auth con Google sigue funcionando
