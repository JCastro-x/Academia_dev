# 🎓 Academia Dev

> Dashboard académico personal — organiza tu semestre universitario desde cualquier dispositivo.

![Version](https://img.shields.io/badge/version-2.1-7c6aff?style=flat-square)
![License](https://img.shields.io/badge/licencia-AGPL%20v3-4ade80?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-instalable-4ade80?style=flat-square)
![Auth](https://img.shields.io/badge/auth-Google%20OAuth-ea4335?style=flat-square)
![DB](https://img.shields.io/badge/base%20de%20datos-Supabase-3ecf8e?style=flat-square)
![Status](https://img.shields.io/badge/estado-activo-brightgreen?style=flat-square)

**[→ Abrir la app](https://academia-dev-jcx-team.vercel.app/)**

---

## ✨ Funcionalidades

### 📋 Gestión Académica
- **Semestres** — crea y archiva semestres, cambia entre ellos desde la barra lateral
- **Materias** — nombre, código, ícono, color, sección, catedrático, créditos y horario
- **Calificaciones por zona** — parciales, laboratorios, final; puntos acumulables con proyección automática
- **Promedio ponderado** — calculado en tiempo real por créditos, con historial entre semestres
- **Horario semanal** — vista de grilla por día/hora con exportación

### ✅ Tareas
- Prioridad (alta / media / baja), fecha límite, hora de entrega
- Subtareas con barra de progreso
- Tareas recurrentes (diaria, semanal, mensual)
- Filtros por materia, prioridad y estado
- Undo al eliminar (toast)

### 📝 Notas
- Editor de texto enriquecido por materia
- Adjuntar imágenes y PDFs (almacenados en IndexedDB, no en Supabase)
- **Visor de PDF integrado** con PDF.js
- **OCR** con Tesseract.js para imágenes y PDFs escaneados
- Búsqueda dentro de notas

### ⏱️ Pomodoro
- Timer en **Web Worker** — no se throttlea en background ni al cambiar de pestaña
- Modo flotante **Picture-in-Picture** (Chrome) — ventana siempre visible con controles en tiempo real
- Sonidos generados con **Web Audio API** — sin archivos externos
- Historial de sesiones del día, estadísticas por materia
- Racha de estudio y meta diaria

### 🃏 Flashcards + IA
- Tarjetas por materia con pregunta / respuesta / tags
- **Generación automática con Google Gemini** — desde texto, notas o archivos
- Tipos: QA, opción múltiple, verdadero/falso, mixto
- Vista previa antes de guardar
- Modo estudio con flip card animado y **spaced repetition**

### 🤖 Asistente Académico
- Chat flotante contextual (analiza tus notas y flashcards actuales)
- Creación de tareas por lenguaje natural: *"Agrega una tarea de matemáticas para el viernes"*
- Respuestas conversacionales sin formato markdown
- Modelo: Google Gemini 2.5 Flash

### 📅 Calendario
- Vista mensual con eventos y tareas integrados
- Color por materia, countdown a eventos próximos

### 📊 Estadísticas
- Gráfico de puntos por materia (Chart.js)
- Progreso de tareas completadas (donut)
- Promedio ponderado, materias en riesgo, créditos aprobados

### 👤 Perfil Académico
- Cursos aprobados con nota, créditos y semestre cursado
- Promedio acumulado y progreso de carrera
- Personalización: tipografía, color de acento, tema claro/oscuro, sonidos

---

## 🚀 Correr en local

Requiere un servidor HTTP — no funciona con `file://` (los partials se cargan con `fetch`).

```bash
# Opción 1: Node
npx serve .

# Opción 2: Python
python -m http.server 3000

# Opción 3: VS Code
# Clic derecho en index.html → "Open with Live Server"
```

---

## 🏗️ Arquitectura

Academia Dev es una **SPA vanilla** (sin framework ni bundler) con lazy loading de partials HTML.

```
app.html  →  loader.js  →  partials críticos (overview, modals, overlays)
                        →  partials on-demand (tareas, notas, pomodoro, etc.)
          →  init.js    →  auth check → carga Supabase o localStorage
          →  state.js   →  window.State (semestres, materias, tareas, settings)
          →  academia-sync.js → window.DB / window.AcademiaDB
```

### Flujo de datos
1. Al cargar, `init.js` verifica sesión Google con Supabase
2. Si hay sesión, descarga datos desde `user_data` (JSONB) con preflight check
3. Los datos se almacenan en `window.State` y en `localStorage` como caché
4. Cada cambio llama a `saveState()` → debounce 10s → sync a Supabase
5. Imágenes y canvas se guardan en **IndexedDB** (nunca se sincronizan)

---

## 📦 Dependencias externas (CDN, sin build step)

| Librería | Versión | Uso |
|---|---|---|
| Supabase JS | v2 | Auth + base de datos |
| PDF.js | 3.11.174 | Visor de PDFs en notas |
| Tesseract.js | 5.0.4 | OCR en notas |
| Google Gemini | 2.5 Flash | Flashcards IA + asistente |
| Google Fonts | — | Syne, Inter, JetBrains Mono, Playfair Display, Space Mono |

Sin bundler. Sin framework. Sin dependencias de npm en runtime. **HTML + CSS + JS vanilla.**

---

## 📱 PWA

- Instalable en Android, iOS y escritorio (Chrome/Edge)
- Funciona offline con datos en caché (Service Worker `academia-v11`)
- Shortcuts en el launcher: Nueva Tarea, Pomodoro, Notas, Calificaciones
- Soporte para Picture-in-Picture (Pomodoro flotante)

---

## ⌨️ Atajos de Teclado

| Atajo | Acción |
|---|---|
| `Ctrl/Cmd + K` | Buscar |
| `Ctrl/Cmd + N` | Nueva tarea |
| `Ctrl/Cmd + S` | Guardar |
| `Alt + G` | Overview |
| `Alt + T` | Tareas |
| `Alt + N` | Notas |
| `Alt + F` | Flashcards |
| `Alt + P` | Pomodoro |
| `Alt + Space` | Pausar/Reanudar Pomodoro |

---

## 📂 Estructura del Proyecto

```
Academia_dev/
├── index.html              # Landing page
├── app.html                # Shell principal (SPA)
├── auth-page.html          # Login
├── pom-popup.html          # Pomodoro Picture-in-Picture
├── manifest.json           # PWA
├── sw.js                   # Service Worker
│
├── partials/               # Fragmentos HTML (lazy loading)
│   ├── overview.html
│   ├── modals.html
│   ├── overlays.html
│   └── [tareas, notas, pomodoro, flashcards, ...]
│
├── js/
│   ├── auth.js             # Google OAuth
│   ├── academia-sync.js    # Sync con Supabase (window.DB)
│   ├── init.js             # Inicialización
│   ├── state.js            # Estado global
│   ├── loader.js           # Lazy loading de partials
│   ├── bootstrap.js        # Banners, sidebar mobile, logout
│   └── [calificaciones, tareas, notas, pomodoro, flashcards, ai-assistant, ...]
│
└── css/
    ├── base.css            # Variables y layout
    ├── components.css      # Componentes UI
    ├── mobile.css          # Responsive
    └── [animations, flashcards-fix, mobile-fixes, ...]
```

---

## 🔐 Modos de Acceso

| Modo | Descripción |
|---|---|
| **Google OAuth** | Sincronización multi-dispositivo en tiempo real |
| **Modo invitado** | Datos solo en localStorage, sin cuenta requerida |
| **Modo offline** | Usa datos cacheados, sincroniza al recuperar conexión |

---

## 🤝 Contribuir

1. Fork el repositorio
2. Crea tu rama: `git checkout -b feature/mi-feature`
3. Commit: `git commit -m 'feat: descripción del cambio'`
4. Push: `git push origin feature/mi-feature`
5. Abre un Pull Request

---

## 📄 Licencia

**© 2026 JCastro014 — Todos los derechos reservados.**

Este proyecto está bajo la [GNU AGPL v3](LICENSE). Cualquier uso, modificación o distribución debe incluir atribución visible:

> *"Based on Academia Dev by JCastro014"*  
> https://github.com/JCastro-x/Academia_dev

Para uso comercial o propietario: josueliucastrososa@gmail.com

---

## ⚠️ Exención de Responsabilidad

Academia Dev se proporciona "tal cual". Josue Castro y Void Studio no serán responsables por daños, pérdida de datos, interrupción del servicio o perjuicio de cualquier tipo que resulte del uso de la plataforma. El uso es bajo tu propio riesgo.

---

**Hecho con ☕ en Guatemala · Josue Castro · Void Studio · 2026**
