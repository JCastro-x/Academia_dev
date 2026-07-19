# BUG: Mecanismo de Fallback Roto en academia-sync.js

**Fecha de descubrimiento:** 19 de julio de 2026  
**Severidad:** Alta  
**Estado:** Documentado, no arreglado (Turso desactivado como workaround)

## Descripción

El mecanismo de fallback de Turso a Supabase en `academia-sync.js` está roto. El código asume que los fallos de Turso siempre lanzan excepciones, pero `turso-sync.js` puede fallar retornando un objeto `{ error: "..." }` sin lanzar ninguna excepción, lo que hace que el fallback nunca se active.

## Ubicación del Problema

**Archivo:** `js/academia-sync.js`  
**Líneas:** 71-80

```javascript
// Delegar a Turso si está configurado
if (_useTurso && window.TursoDB) {
  try {
    return await window.TursoDB.load(localUpdatedAt, options);
  } catch (tursoError) {
    console.error('❌ [SYNC] Error en Turso, fallback a Supabase:', tursoError);
    if (typeof _appNotify === 'function') {
      _appNotify('Error en Turso, usando Supabase...', 'warning');
    }
    _useTurso = false; // Desactivar Turso temporalmente
  }
}
```

**Archivo:** `js/turso-sync.js`  
**Líneas:** 52-55, 58-60

```javascript
if (data.error) {
  console.warn('⚠️ Turso error:', data.error);
  return { error: data.error };  // ← RETORNA objeto, NO lanza excepción
}

} catch (err) {
  console.warn('⚠️ Turso request error:', err.message);
  return { error: err.message };  // ← RETORNA objeto, NO lanza excepción
}
```

## Problema

Cuando Turso falla (ej. error 400 Bad Request, error de formato JSON), `turso-sync.js` retorna `{ error: "mensaje" }` pero NO lanza una excepción. Por lo tanto:

1. El bloque `try/catch` en `academia-sync.js` nunca captura el error
2. El fallback a Supabase nunca se activa
3. La función retorna el objeto de error en lugar de intentar Supabase
4. El sync falla silenciosamente

## Impacto

- **Sync multi-dispositivo roto:** Cuando Turso falla, los datos no se sincronizan
- **Experiencia de usuario:** Los cambios en un dispositivo no aparecen en otros
- **Difícil de diagnosticar:** El error se loguea pero el usuario no ve notificación

## Caso Real Detectado

**Error observado:** `⚠️ Turso error: JSON parse error: unknown field 'type', expected 'blob'`

Este error ocurría en TODAS las operaciones de Turso (cargar settings, cargar semestres, guardar). Como el fallback no funcionaba, el sync estaba completamente roto.

## Solución Temporal Aplicada

**Workaround:** Desactivar Turso por completo eliminando credenciales del localStorage:
- `localStorage.removeItem('turso_url')`
- `localStorage.removeItem('turso_auth_token')`

Con Turso desactivado, `_useTurso = false` desde el inicio y el código usa Supabase directamente sin pasar por el bloque try/catch roto.

## Solución Permanente (para futuro)

Si se reactiva Turso o se agrega otro adapter con el mismo patrón, arreglar el mecanismo de fallback:

**Opción 1:** Hacer que `turso-sync.js` lance excepciones en lugar de retornar objetos de error

```javascript
if (data.error) {
  throw new Error(data.error);  // ← Lanzar excepción en lugar de retornar
}
```

**Opción 2:** Modificar `academia-sync.js` para detectar errores retornados

```javascript
if (_useTurso && window.TursoDB) {
  const result = await window.TursoDB.load(localUpdatedAt, options);
  
  // Detectar error retornado (no solo excepción)
  if (result && result.error) {
    console.error('❌ [SYNC] Error en Turso, fallback a Supabase:', result.error);
    _useTurso = false;
    // Continuar con fallback a Supabase...
  } else {
    return result;
  }
}
```

**Opción 3:** Combinar ambas para máxima robustez

## Notas

- Este bug afecta cualquier adapter que siga el mismo patrón de retornar `{ error: ... }` en lugar de lanzar excepciones
- El preflight check en `getRemoteUpdatedAt()` tiene el mismo problema (líneas 169-171)
- Las funciones `save()` y `_doSave()` también tienen el mismo patrón roto (líneas 196-208)

## Referencias

- Auditoría completa: `AUDITORIA_COMPLETA.md`
- Auditoría de base de datos: `AUDITORIA_BASE_DATOS.md`
- Script de diagnóstico: `diagnostic-script.html`
- Script de desactivación: `disable-turso.html`
