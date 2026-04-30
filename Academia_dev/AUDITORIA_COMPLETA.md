# 🎓 AUDITORÍA COMPLETA - Academia Dev

> Dashboard académico personal PWA para universitarios
> Autor: JCastro014 (Josue Castro)
> Licencia: GNU AGPL v3
> Versión: 2.1

---

## 📋 RESUMEN EJECUTIVO

**Academia Dev** es una aplicación web progresiva (PWA) vanilla (sin frameworks) para gestión académica universitaria. Permite organizar semestres, materias, calificaciones, tareas, notas con OCR, Pomodoro, flashcards con IA, y sincronización multi-dispositivo.

**Características principales:**
- SPA vanilla con lazy loading de partials HTML
- Auth con Google OAuth vía Supabase
- Sincronización multi-dispositivo (Supabase o Turso opcional)
- Modo offline con localStorage
- PWA instalable (Android, iOS, Desktop)
- IndexedDB para imágenes/archivos pesados
- Web Workers para timer anti-throttle
- IA con Google Gemini para flashcards y asistente

---

## 🏗️ ARQUITECTURA TÉCNICA

### Stack Tecnológico
- **Frontend:** HTML5 + CSS3 + JavaScript Vanilla (ES6+)
- **Backend:** Supabase (Auth + PostgreSQL) o Turso (SQLite edge)
- **CDN Libraries:** Supabase JS, PDF.js, Tesseract.js, DOMPurify
- **IA:** Google Gemini 2.5 Flash
- **Deploy:** Vercel
- **PWA:** Service Worker con cache strategy

### Patrón de Arquitectura
```
SPA (Single Page Application)
├── Shell: app.html (layout fijo)
├── Lazy Loading: partials/ HTML fragments
├── State Management: window.State (global)
├── Storage: localStorage + IndexedDB
└── Sync: academia-sync.js (adapter para Supabase/Turso)
```

### Flujo de Inicialización
```
1. app.html carga → loader.js
2. loader.js carga partials críticos (overview, modals, overlays)
3. init.js verifica auth (Google OAuth con Supabase)
4. Si auth OK → academia-sync.js carga datos desde Supabase/Turso
5. Datos se cargan en window.State
6. UI se renderiza con bootstrap.js
```

---

## 📂 ESTRUCTURA DE ARCHIVOS

### Archivos Principales
```
Academia_dev/
├── index.html              # Landing page (marketing)
├── app.html                # Shell principal de la SPA
├── auth-page.html          # Login con Google OAuth
├── pom-popup.html          # Pomodoro Picture-in-Picture
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── vercel.json             # Configuración deploy
│
├── partials/               # Fragmentos HTML (lazy loading)
│   ├── overview.html      # Dashboard principal
│   ├── modals.html         # Todos los modales
│   ├── overlays.html       # Overlays (mobile sidebar, etc)
│   ├── tareas.html         # Gestión de tareas
│   ├── notas.html          # Editor de notas
│   ├── calificaciones.html # Calificaciones por zona
│   ├── materias.html       # Gestión de materias
│   ├── horario.html        # Horario semanal
│   ├── calendario.html     # Calendario
│   ├── flashcards.html     # Flashcards con IA
│   ├── pomodoro.html       # Timer Pomodoro
│   ├── perfil.html         # Perfil académico
│   └── semestres.html      # Gestión de semestres
│
├── js/                     # Módulos JavaScript
│   ├── auth.js             # Google OAuth con Supabase
│   ├── academia-sync.js    # Sync adapter (Supabase/Turso)
│   ├── turso-sync.js       # Sync con Turso (opcional)
│   ├── state.js            # Estado global (window.State)
│   ├── loader.js           # Lazy loading de partials
│   ├── init.js             # Inicialización y bootstrap
│   ├── bootstrap.js        # Setup UI inicial
│   ├── ui.js               # Utilidades UI
│   ├── undo-system.js      # Sistema de undo
│   ├── skeleton-loading.js # Skeleton loaders
│   │
│   ├── Módulos de negocio:
│   ├── tasks.js            # Gestión de tareas
│   ├── notes.js            # Editor de notas (146KB - más grande)
│   ├── calificaciones.js    # Cálculo de notas
│   ├── materias.js         # Gestión de materias
│   ├── semestres.js        # Gestión de semestres
│   ├── calendar.js         # Calendario
│   ├── planner.js          # Planificador académico
│   ├── flashcards.js       # Flashcards con IA
│   ├── ai-assistant.js     # Asistente académico (desactivado)
│   ├── habits.js           # Hábitos
│   ├── stats.js            # Estadísticas
│   ├── search.js           # Búsqueda global
│   │
│   ├── Pomodoro modular:
│   ├── pomodoro/
│   │   ├── timer-core.js   # Lógica del timer
│   │   └── timer-ui.js     # UI del timer
│   ├── pomodoro.js         # Orquestador Pomodoro
│   ├── pom-worker.js       # Web Worker para timer
│   ├── pom-mini.js         # Pomodoro mini
│   ├── sounds.js           # Sonidos Web Audio API
│   │
│   ├── Chrono modular:
│   ├── chrono/
│   │   ├── chrono-core.js  # Core de cronómetro
│   │   ├── chrono-ui.js    # UI de cronómetro
│   │   ├── flashcards-core.js
│   │   ├── flashcards-ui.js
│   │   └── focus-core.js
│   ├── chrono.js           # Legacy shim
│   ├── flashcards.js       # Legacy shim
│   ├── reloj.js            # Reloj
│   ├── reloj-crono.js      # Cronómetro
│   ├── reloj-timer.js      # Timer
│   │
│   ├── Subjects modular:
│   ├── subjects/
│   │   ├── subjects-core.js
│   │   ├── subjects-ui.js
│   │   ├── subjects-modal.js
│   │   └── topics-core.js
│   │
│   ├── Otros:
│   ├── notifications.js    # Sistema de notificaciones
│   ├── notifications-db.js # DB de notificaciones
│   ├── onboarding.js       # Tutorial onboarding
│   ├── keyboard-shortcuts.js # Atajos de teclado
│   ├── mobile-more.js      # Menú móvil "Más"
│   └── metrics.js          # Métricas/analytics
│
├── css/                    # Estilos
│   ├── base.css            # Variables CSS y layout base
│   ├── components.css      # Componentes UI
│   ├── index.css           # Estilos landing page
│   ├── mobile.css          # Responsive móvil
│   ├── mobile-fixes.css    # Fixes móviles
│   ├── academia-animations.css # Animaciones
│   ├── academia-bundle.css # Bundle de estilos
│   ├── logout-fix.css      # Fix logout
│   ├── notes.css           # Estilos notas
│   ├── pomodoro.css        # Estilos Pomodoro
│   └── flashcards-fix.css  # Fix flashcards
│
├── assets/
│   ├── icons/              # Iconos PWA
│   └── screenshots/        # Screenshots para PWA
│
└── Documentación:
    ├── README.md           # Documentación principal
    ├── BANDWIDTH_OPTIMIZATIONS.md
    ├── SUPABASE_MIGRATION_REQUIREMENTS.md
    └── TURSO_SETUP.md
```

---

## 🔧 MÓDULOS PRINCIPALES

### 1. Sistema de Autenticación (auth.js)
- **Proveedor:** Google OAuth vía Supabase
- **Funciones:**
  - `signInGoogle()`: Login con Google
  - `logoutUser()`: Cerrar sesión
  - `checkAuth()`: Verificar sesión actual
  - `onAuthChange()`: Listener de cambios de auth
- **Storage:** Session storage para auth session
- **Timeout:** 5 segundos para auth check (offline fallback)

### 2. Estado Global (state.js)
- **Objeto:** `window.State`
- **Estructura:**
```javascript
State = {
  semestres: [],           // Array de semestres
  materias: [],            // Materias del semestre activo
  grades: {},              // Calificaciones por materia
  tasks: [],               // Tareas
  events: [],              // Eventos calendario
  topics: [],              // Temas
  notes: {},               // Notas (objeto por ID)
  notesArray: [],          // Notas (array)
  flashcards: [],          // Flashcards
  pomSessions: [],         // Sesiones Pomodoro hoy
  pomHistory: {},          // Historial Pomodoro
  pomSnapshots: {},        // Snapshots diarios
  settings: {}            // Configuración global
}
```
- **Persistencia:** localStorage con prefijo `academia_v4_`
- **IndexedDB:** Para imágenes y canvas (clave: `academia_images`)

### 3. Sincronización (academia-sync.js)
- **Adapter:** `window.AcademiaDB` (alias: `window.DB`)
- **Soporte:** Supabase (default) o Turso (opcional)
- **Funciones:**
  - `init(userId)`: Inicializar sync
  - `load(localUpdatedAt, options)`: Cargar datos
  - `save(semestres, settings, changedFields)`: Guardar (debounced 10s)
  - `saveNow(...)`: Guardar inmediato
  - `getRemoteUpdatedAt()`: Preflight check
- **Optimizaciones:**
  - Delta sync (solo campos cambiados)
  - Truncado de notas >10KB
  - Historial Pomodoro limitado a 3 días
  - Snapshots no se sincronizan
  - Preflight check para evitar descargas innecesarias

### 4. Lazy Loading (loader.js)
- **Partials críticos** (cargan al inicio):
  - overview.html
  - modals.html
  - overlays.html
- **Partials lazy** (on-demand):
  - tareas, notas, calificaciones, materias, horario, calendario, flashcards, pomodoro, etc.
- **Función:** `window.loadPartial(name)`
- **Requiere:** Servidor HTTP (no funciona con file://)

### 5. Inicialización (init.js)
- **Flujo:**
  1. Verificar modo invitado
  2. Check auth con Supabase
  3. Si auth OK → cargar datos desde DB
  4. Si auth fail → fallback a datos locales si existen
  5. Si no hay datos → redirect a auth-page.html
- **Sync automático:**
  - Al cargar la página
  - Cada 6 horas (reducido de 1 hora para bandwidth)
  - Preflight check antes de descargar
- **Guard contra conflictos:** `window._localModifiedAt`

### 6. Gestión de Tareas (tasks.js)
- **Campos:** id, título, materia, prioridad, fecha, subtareas, recurrente
- **Funciones:** renderTasks(), addTask(), deleteTask(), toggleTask()
- **Subtareas:** Array con progreso
- **Recurrencia:** diaria, semanal, mensual
- **Undo:** Toast con opción de deshacer

### 7. Notas con OCR (notes.js)
- **Editor:** contentEditable con toolbar
- **Adjuntos:** Imágenes y PDFs
- **OCR:** Tesseract.js para extraer texto de imágenes
- **PDF:** PDF.js para visor integrado
- **Storage:** IndexedDB para archivos pesados (referencias IDB en State)
- **XSS Protection:** DOMPurify para sanitizar HTML

### 8. Pomodoro (pomodoro.js + modules)
- **Timer:** Web Worker (anti-throttle, funciona en background)
- **Picture-in-Picture:** Ventana flotante en Chrome
- **Sonidos:** Web Audio API (sin archivos externos)
- **Sesiones:** Historial diario, estadísticas por materia
- **Racha:** Streak counter y meta diaria
- **Módulos:**
  - `pomodoro/timer-core.js`: Lógica del timer
  - `pomodoro/timer-ui.js`: UI del timer
  - `pom-worker.js`: Web Worker

### 9. Flashcards con IA (flashcards.js)
- **Tipos:** QA, opción múltiple, verdadero/falso, mixto
- **IA:** Google Gemini 2.5 Flash para generación
- **Fuente:** Texto, notas, archivos
- **Estudio:** Flip card animado, spaced repetition
- **Tags:** Por materia y personalizados

### 10. Calificaciones (calificaciones.js)
- **Por zona:** Parciales, laboratorios, final
- **Cálculo:** Promedio ponderado por créditos
- **Proyección:** Qué necesitas para aprobar
- **Historial:** Promedios entre semestres

---

## 🗄️ MODELO DE DATOS

### Estructura de Semestre
```javascript
{
  id: "sem_1234567890",
  nombre: "1er Año · 2do Sem",
  activo: true,
  cerrado: false,
  promedioObjetivo: 70,
  prevAvg: 0,
  prevCred: 0,
  materias: [],      // Array de materias
  grades: {},        // Calificaciones por materia
  tasks: [],         // Tareas
  events: [],        // Eventos calendario
  topics: [],        // Temas
  notes: {},         // Notas (objeto)
  notesArray: [],    // Notas (array)
  flashcards: []     // Flashcards
}
```

### Estructura de Materia
```javascript
{
  id: "mat_123",
  nombre: "Cálculo Diferencial",
  codigo: "MAT-201",
  icono: "📐",
  color: "#7c6aff",
  seccion: "A",
  catedratico: "Dr. Pérez",
  creditos: 4,
  horario: {
    lun: [{inicio: "08:00", fin: "10:00", aula: "201"}],
    mar: [{inicio: "08:00", fin: "10:00", aula: "201"}],
    // ...
  }
}
```

### Estructura de Nota
```javascript
{
  id: "note_123",
  matId: "mat_123",
  titulo: "Apuntes clase 1",
  content: "<p>Contenido HTML...</p>",
  canvasData: "IDB:canvas_123",  // Referencia a IndexedDB
  images: {
    img1: "IDB:img_123"          // Referencias a IndexedDB
  },
  pdfAttachments: [
    {name: "documento.pdf", data: "IDB:pdf_123"}
  ],
  createdAt: 1234567890,
  updatedAt: 1234567890
}
```

### Estructura de Tarea
```javascript
{
  id: "task_123",
  matId: "mat_123",
  titulo: "Tarea 1",
  prioridad: "alta",  // alta, media, baja
  fecha: "2026-05-01",
  hora: "23:59",
  completada: false,
  subtareas: [
    {id: "st1", texto: "Subtarea 1", completada: false}
  ],
  recurrente: {
    tipo: "semanal",  // diaria, semanal, mensual
    frecuencia: 1
  }
}
```

---

## 🔐 SEGURIDAD

### XSS Protection
- **DOMPurify:** Sanitiza todo HTML en notas
- **Content Security Policy:** No implementado (podría agregarse)
- **Input sanitization:** En notas y campos de texto

### Auth
- **Supabase Auth:** Google OAuth con tokens JWT
- **Row Level Security (RLS):** En Supabase para separar datos por user_id
- **Session storage:** Para auth session (no localStorage)

### Data Protection
- **IndexedDB:** Imágenes y canvas no se sincronizan
- **Delta sync:** Solo campos cambiados
- **Optimization:** Truncado de datos pesados antes de sync

---

## 📱 PWA

### Características
- **Instalable:** Android, iOS, Desktop (Chrome/Edge)
- **Offline:** Service Worker con cache strategy
- **Shortcuts:** Nueva Tarea, Pomodoro, Notas, Calificaciones
- **Display:** Standalone con window-controls-overlay
- **Theme color:** #7c6aff

### Service Worker (sw.js)
- **Cache name:** academia-v11
- **Strategy:** Network First para HTML, Cache First para assets
- **Scope:** /
- **Update:** Auto-update en recarga

### Manifest (manifest.json)
- **Start URL:** /app.html
- **Display:** standalone con override
- **Orientation:** any
- **Categories:** education, productivity
- **Screenshots:** 1280x720 (wide), 390x844 (narrow)

---

## 🌐 DEPENDENCIAS EXTERNAS

### CDN Libraries
```html
<!-- Supabase -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- OCR & PDF -->
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>

<!-- XSS Protection -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js"></script>

<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Playfair+Display:wght@400;600;700;800&display=stylesheet">
```

### APIs
- **Supabase:** Auth + PostgreSQL
  - URL: https://mwzezekdxrutpzqbduvh.supabase.co
  - Anon key: sb_publishable_O1RMAV7hbpvDwJj0ESgaCg_dd8lZur5
- **Google Gemini 2.5 Flash:** IA para flashcards y asistente
- **Turso (opcional):** SQLite edge database

---

## 🎨 ESTILOS Y CSS

### Variables CSS (base.css)
```css
:root {
  --accent: #7c6aff;
  --accent2: #a78bfa;
  --surface: #0a0a0f;
  --surface2: #12121a;
  --surface3: #1a1a25;
  --border: #1e1e2e;
  --text: #e8e8f0;
  --text2: #a0a0b0;
  --text3: #606070;
}
```

### Fuentes
- **Syne:** Títulos (principal)
- **Inter:** UI general
- **Space Mono:** Código y monoespaciado
- **JetBrains Mono:** Código alternativo
- **Playfair Display:** Acentos decorativos

### Temas
- **Dark:** Default
- **Light:** Toggle en topbar
- **Custom:** Color de acento configurable

---

## ⚡ OPTIMIZACIONES

### Bandwidth
- **Lazy loading:** Partials on-demand
- **Delta sync:** Solo campos cambiados
- **Preflight check:** Evitar descargas innecesarias
- **Truncado:** Notas >10KB truncadas
- **Historial limitado:** Pomodoro history 3 días
- **Snapshots excluidos:** No se sincronizan
- **Sync throttled:** Cada 6 horas (no en focus/visibility)

### Performance
- **Web Workers:** Timer Pomodoro anti-throttle
- **rAF batching:** Múltiples render() en un frame
- **DOM Cache:** _el() para cachear elementos
- **IndexedDB:** Archivos pesados fuera de localStorage
- **Image compression:** JPEG 0.5 quality, max 1920px

### Storage
- **localStorage:** Estado principal (semestres, settings)
- **IndexedDB:** Imágenes, canvas, PDFs
- **Session storage:** Auth session
- **Cleanup:** Función para limpiar imágenes no usadas

---

## 🚀 MODO DE OPERACIÓN

### Modos de Acceso
1. **Google OAuth (Normal):**
   - Login con Google
   - Sync multi-dispositivo
   - Datos en Supabase

2. **Modo Invitado:**
   - Sin cuenta
   - Datos solo en localStorage
   - Flag: `academia_guest_mode = 1`

3. **Modo Offline:**
   - Usa datos cacheados
   - Sync al recuperar conexión
   - Fallback automático

### Flujo de Sync
```
Usuario hace cambio → saveState() → debounce 3s → _flushSave()
├─ localStorage actualizado
└─ academia-sync.js.save() → debounce 10s → Supabase/Turso

Sync remoto (cada 6h):
├─ Preflight: getRemoteUpdatedAt()
├─ Si remoto más reciente → load()
├─ Merge con datos locales
└─ Re-render UI
```

### Conflict Resolution
- **Guard:** `window._localModifiedAt` timestamp
- **Regla:** Si modificación local < 30s, no hacer pull remoto
- **Merge:** Pomodoro data merge por updatedAt

---

## 🎯 FUNCIONALIDADES DETALLADAS

### Gestión Académica
- **Semestres:** Crear, archivar, cambiar entre ellos
- **Materias:** Nombre, código, ícono, color, sección, catedrático, créditos, horario
- **Calificaciones:** Por zona (parciales, laboratorios, final), proyección automática
- **Promedio:** Ponderado por créditos, historial entre semestres
- **Horario:** Vista grilla por día/hora, exportación

### Tareas
- **Prioridad:** Alta, media, baja
- **Fecha/hora:** Límite de entrega
- **Subtareas:** Con barra de progreso
- **Recurrencia:** Diaria, semanal, mensual
- **Filtros:** Por materia, prioridad, estado
- **Undo:** Toast al eliminar

### Notas
- **Editor:** Texto enriquecido por materia
- **Adjuntos:** Imágenes y PDFs
- **OCR:** Tesseract.js para imágenes escaneadas
- **PDF Viewer:** Integrado con PDF.js
- **Búsqueda:** Dentro de notas
- **Storage:** IndexedDB para archivos

### Pomodoro
- **Timer:** Web Worker (anti-throttle)
- **Picture-in-Picture:** Ventana flotante
- **Sonidos:** Web Audio API
- **Historial:** Sesiones del día
- **Estadísticas:** Por materia
- **Racha:** Streak counter
- **Meta:** Diaria configurable

### Flashcards
- **Tipos:** QA, opción múltiple, verdadero/falso, mixto
- **IA:** Generación con Google Gemini
- **Fuente:** Texto, notas, archivos
- **Estudio:** Flip card, spaced repetition
- **Tags:** Por materia

### Calendario
- **Vista:** Mensual
- **Eventos:** Integrados con tareas
- **Color:** Por materia
- **Countdown:** A eventos próximos

### Estadísticas
- **Gráficos:** Chart.js (puntos por materia)
- **Progreso:** Donut chart de tareas
- **Métricas:** Promedio, materias en riesgo, créditos

### Perfil
- **Cursos aprobados:** Nota, créditos, semestre
- **Promedio:** Acumulado
- **Progreso:** Carrera
- **Personalización:** Tipografía, color, tema, sonidos

---

## 📊 MÉTRICAS Y ANALYTICS

### Tracking (index.html, app.html)
- **Supabase:** Tabla `page_views`
- **Datos:** page (landing/app/auth), device (mobile/desktop), referrer
- **No tracking:** localhost, 127.0.0.1

### Métricas internas (metrics.js)
- **Uso de features:** No implementado aún
- **Performance:** No implementado aún

---

## 🐛 PROBLEMAS CONOCIDOS

### Limitaciones
- **AI Assistant:** Desactivado (comentado en app.html)
- **Turso:** Opcional, requiere configuración manual
- **Service Worker:** Cache strategy podría mejorarse
- **CSP:** No implementado
- **Tests:** No hay tests automatizados

### Bugs reportados
- **Logout fix:** CSS patch para logout
- **Flashcards fix:** CSS patch para flashcards
- **Mobile fixes:** CSS patches para móvil

---

## 🔧 CONFIGURACIÓN

### Supabase
- **URL:** https://mwzezekdxrutpzqbduvh.supabase.co
- **Anon key:** sb_publishable_O1RMAV7hbpvDwJj0ESgaCg_dd8lZur5
- **Tabla:** `user_data` (JSONB columns: semestres, settings, updated_at)
- **RLS:** Por user_id

### Turso (opcional)
- **Configuración:** localStorage keys `turso_url`, `turso_auth_token`
- **Setup:** Ver TURSO_SETUP.md

### Vercel
- **Config:** vercel.json
- **Deploy:** Automático desde GitHub

---

## 📝 NOTAS PARA DESARROLLADORES

### Correr en local
```bash
# Requiere servidor HTTP (no file://)
npx serve .
# o
python -m http.server 3000
# o VS Code Live Server
```

### Agregar nueva funcionalidad
1. Crear partial en `partials/`
2. Agregar a `LAZY_PARTIALS` en `loader.js`
3. Crear módulo JS en `js/`
4. Agregar script en `app.html`
5. Agregar nav item en sidebar

### Patrones usados
- **Module pattern:** IIFE para encapsulación
- **Global namespace:** `window.State`, `window.Auth`, `window.AcademiaDB`
- **Event-driven:** Custom events para partials-loaded, partial-loaded
- **Debouncing:** Para save y sync
- **Lazy loading:** Partials on-demand

### Compatibility
- **Legacy shims:** `window.DB` alias de `window.AcademiaDB`
- **Migration:** Migración de datos legacy en `state.js`
- **Browser support:** Modern browsers (ES6+)

---

## 📄 LICENCIA

**GNU AGPL v3** - Uso, modificación y distribución requieren atribución visible:

> *"Based on Academia Dev by JCastro014"*  
> https://github.com/JCastro-x/Academia_dev

**Uso comercial:** Contactar josueliucastrososa@gmail.com

---

## 🎓 CONCLUSIÓN

Academia Dev es una PWA vanilla bien estructurada con:
- ✅ Arquitectura modular y escalable
- ✅ Sincronización multi-dispositivo robusta
- ✅ Optimizaciones de bandwidth y performance
- ✅ Funcionalidades académicas completas
- ✅ PWA instalable con offline support
- ✅ IA integrada para flashcards
- ⚠️ AI Assistant desactivado
- ⚠️ Sin tests automatizados
- ⚠️ CSP no implementado

**Ideal para:** Estudiantes universitarios que necesitan organizar su semestre con sync multi-dispositivo.

**Tecnologías clave:** Vanilla JS, Supabase, IndexedDB, Web Workers, PWA, Google Gemini.

---

**Generado:** 30 de abril de 2026
**Para:** Contexto para otra IA
**Autor del análisis:** Cascade AI Assistant
