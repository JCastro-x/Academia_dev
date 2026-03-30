# 🎓 Academia Dev

> Dashboard académico personal — organiza tu semestre universitario desde cualquier dispositivo.

![Theme](https://img.shields.io/badge/tema-oscuro%20%2F%20claro-7c6aff?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-instalable-4ade80?style=flat-square)
![Auth](https://img.shields.io/badge/auth-Google%20OAuth-ea4335?style=flat-square)
![DB](https://img.shields.io/badge/base%20de%20datos-Supabase-3ecf8e?style=flat-square)

---

## ✨ Funcionalidades

### 📋 Gestión académica
- **Semestres** — crea y archiva semestres, cambia entre ellos desde la barra lateral
- **Materias** — nombre, código, ícono, color, sección, catedrático, créditos y horario de clases
- **Calificaciones por zona** — parciales, laboratorios, final; puntos acumulables con proyección automática
- **Promedio ponderado** — calculado en tiempo real por créditos, con historial acumulado entre semestres
- **Horario semanal** — vista de grilla por día/hora con exportación

### ✅ Tareas
- Prioridad (alta / media / baja), fecha límite, hora de entrega
- Subtareas con barra de progreso
- Fecha de planificación + hora para el día de trabajo
- Tareas recurrentes (diaria, semanal, mensual)
- Filtros por materia, prioridad y estado
- Recordatorios con notificaciones del sistema (si se otorgan permisos)

### 📝 Notas
- Editor de texto enriquecido por materia
- Adjuntar imágenes y PDFs
- Visor de PDF integrado (PDF.js)
- OCR sobre imágenes y PDFs escaneados (Tesseract.js)
- Búsqueda dentro de notas

### ⏱️ Pomodoro
- Timer en **Web Worker** — no se throttlea en background ni al cambiar de pestaña
- Timestamps absolutos: inmune al throttling del interval del browser
- Modo flotante **Picture-in-Picture** (Chrome) — ventana siempre visible sobre otras apps
- Sincronización en tiempo real con popup externo via **BroadcastChannel**
- Sonidos generados con **Web Audio API** — sin archivos externos
- Historial de sesiones del día con estadísticas por materia
- Keepalive al Service Worker para móvil

### 🃏 Flashcards
- Tarjetas por materia con pregunta / respuesta
- Modo estudio con flip card animado
- Progreso por sesión (conocido / no conocido / repetir)
- Filtro por materia y tags

### 📅 Calendario
- Vista mensual con eventos y tareas integrados
- Color por materia, badge de countdown a eventos
- Lista de eventos y tareas del mes en la misma vista
- Modal para crear eventos con hora, tipo y descripción

### 📖 Temas del curso
- Temas por materia con nivel de comprensión (0–100%)
- Sistema de repasos pendientes con espaciado
- Timeline de carga de los próximos 14 días
- Reagendado automático

### 📊 Estadísticas
- Gráfico de barras de puntos por materia (Canvas 2D nativo)
- Gráfico de dona: progreso de tareas completadas
- Promedio ponderado, materias en riesgo, créditos aprobados

### 👤 Perfil académico
- Datos personales: nombre, carrera, facultad, registro
- Cursos aprobados manualmente con nota y créditos
- Promedio acumulado, créditos aprobados y progreso de carrera
- Personalización: tipografía, color de acento, tema, variante de sonidos

---

## 🛠️ Arquitectura

```
academia/
├── index.html              # Shell principal (SPA)
├── auth-page.html          # Login con Google OAuth
├── pom-popup.html          # Popup Pomodoro (BroadcastChannel)
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (Network First + Cache First)
│
├── css/
│   ├── base.css            # Variables, reset, layout
│   ├── components.css      # Cards, botones, modales, badges
│   ├── mobile.css          # Responsive, nav inferior
│   └── flashcards-fix.css  # Estilos específicos de flashcards
│
├── js/
│   ├── auth.js             # Google OAuth con Supabase
│   ├── db.js               # Capa de datos StudySpace (social)
│   ├── academia-sync.js    # window.DB — sync con Supabase (user_data)
│   ├── state.js            # Estado global, localStorage, IndexedDB
│   ├── init.js             # Bootstrap + verificación de auth
│   ├── bootstrap.js        # Sidebar, logout, nav mobile
│   ├── loader.js           # Carga de partials HTML en paralelo
│   │
│   ├── ui.js               # goPage(), fillMatSels(), renderOverview()
│   ├── materias.js         # CRUD de materias y horario
│   ├── calificaciones.js   # Zonas, cálculo de promedio, GPA
│   ├── semestres.js        # CRUD semestres, export PDF/JSON, import
│   ├── tasks.js            # CRUD tareas, subtareas, recurrencia
│   ├── calendar.js         # Calendario mensual y eventos
│   ├── notes.js            # Notas ricas, OCR, visor PDF
│   ├── flashcards.js       # Tarjetas de estudio y modo repaso
│   ├── pomodoro.js         # Timer, PiP, Web Audio, BroadcastChannel
│   ├── pom-mini.js         # Auto-PiP al navegar fuera del pomodoro
│   ├── pom-worker.js       # Web Worker del timer (timestamps absolutos)
│   ├── chrono.js           # Cronómetro de estudio
│   ├── planner.js          # Timeline de carga + reagendado
│   ├── stats.js            # Gráficos con Canvas 2D nativo
│   ├── search.js           # Búsqueda global (tareas, eventos, materias)
│   ├── sounds.js           # Sonidos de UI
│   ├── notifications.js    # Banners y notificaciones del sistema
│   ├── onboarding.js       # Tutorial de primera vez
│   └── mobile-more.js      # Bottom sheet "Más" para móvil
│
└── partials/               # Páginas HTML inyectadas por loader.js
    ├── overview.html
    ├── materias.html
    ├── tareas.html
    ├── calendario.html
    ├── calificaciones.html
    ├── temas.html
    ├── estadisticas.html
    ├── horario.html
    ├── notas.html
    ├── pomodoro.html
    ├── flashcards.html
    ├── semestres.html
    ├── perfil.html
    ├── general.html
    ├── modals.html
    └── overlays.html
```

---

## 🗄️ Base de datos (Supabase)

Tabla principal en PostgreSQL con Row Level Security:

```sql
CREATE TABLE IF NOT EXISTS user_data (
  user_id    TEXT PRIMARY KEY,
  semestres  JSONB DEFAULT '[]',
  settings   JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo el dueño puede leer/escribir"
  ON user_data FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
```

Toda la información del semestre (materias, calificaciones, tareas, eventos, notas, flashcards) se almacena en el campo `semestres` como JSONB. Los `settings` guardan preferencias de UI: tema, fuente, color de acento, sonidos.

---

## ⚙️ Sincronización multi-dispositivo

El flujo de sync sigue esta lógica:

1. Al cargar la app, se verifica auth y se descarga desde Supabase (fuente de verdad)
2. Cada cambio local hace un `saveState()` con debounce de 400ms → escribe en localStorage y luego en Supabase con debounce de 1500ms
3. Al volver al tab (`visibilitychange`) o al enfocar la ventana (`focus`), se hace un sync silencioso desde Supabase
4. Un guard de `_localModifiedAt` evita que el sync sobreescriba cambios locales de los últimos 30 segundos
5. Polling cada 90 segundos como fallback para sync entre dispositivos

---

## 🚀 Correr en local

Requiere un servidor HTTP — no funciona con `file://` por las peticiones de los partials.

```bash
# Opción 1: Node
npx serve .

# Opción 2: Python
python -m http.server 3000

# Opción 3: VS Code Live Server
# Clic derecho en index.html → "Open with Live Server"
```

---

## 🔑 Variables de entorno

Las credenciales de Supabase están hardcodeadas en `auth.js` (anon key pública, segura para cliente):

```js
const SUPABASE_URL      = 'https://<tu-proyecto>.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_...';
```

La seguridad real viene de las políticas RLS en Supabase — el anon key no puede leer datos de otros usuarios.

---

## 📦 Dependencias externas (CDN, sin build step)

| Librería | Versión | Uso |
|---|---|---|
| Supabase JS | v2 | Auth + base de datos |
| PDF.js | 3.11.174 | Visor de PDFs en notas |
| Tesseract.js | 5.0.4 | OCR en notas |
| Google Fonts | — | Syne, Inter, JetBrains Mono, Playfair Display, Space Mono |

Sin bundler, sin framework, sin dependencias de npm en runtime. HTML + CSS + JS vanilla.

---

## 📱 PWA

- Instalable en Android, iOS (Safari) y escritorio (Chrome/Edge)
- Service Worker con estrategia **Network First** para JS/HTML/CSS y **Cache First** para assets
- Funciona offline con los datos en caché
- Shortcuts en el launcher: Nueva Tarea, Pomodoro, Notas, Calificaciones
- `display_override: window-controls-overlay` para escritorio

---

## 📄 Licencia

Uso personal. No redistribuir sin permiso del autor.
