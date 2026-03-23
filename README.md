# 🎓 Academia — Dashboard Académico

Dashboard académico para estudiantes universitarios. Organiza tus materias, tareas, calificaciones, notas, horario y más, todo en un solo lugar.

## ✨ Funcionalidades

- 📅 **Agenda Semanal** — vista de 7 días con filtro por día y puntos de color por materia
- 📊 **Resumen** — vista general del progreso académico con tareas ordenadas por urgencia
- 📚 **Materias** — gestión de cursos con colores, iconos y calculadora de supervivencia
- ✅ **Tareas** — seguimiento de entregas con prioridades, subtareas, hora de planificación y hora de entrega
- 📅 **Calendario** — eventos y fechas importantes
- 🎯 **Calificaciones** — zonas configurables, nota proyectada, mínimo necesario
- 📝 **Notas** — editor rico con canvas de dibujo, carpetas, adjuntos PDF e imágenes, OCR
- ⏱️ **Pomodoro** — temporizador con historial, metas y sonidos ambientales
- 🧠 **Flashcards** — tarjetas de estudio
- 🔔 **Recordatorios push** — notificaciones Web Push con hora exacta
- ☁️ **Sincronización** — datos en la nube, acceso desde cualquier dispositivo
- 🌗 **Tema oscuro/claro** + colores de acento personalizables
- 📱 **Responsive** — móvil, tablet y escritorio

## 🛠️ Tecnologías

- HTML · CSS · JavaScript (vanilla, modular)
- [Supabase](https://supabase.com) — autenticación y base de datos en la nube
- [Google OAuth](https://developers.google.com/identity) — inicio de sesión con Google
- [PDF.js](https://mozilla.github.io/pdf.js/) — visualización y extracción de texto de PDFs
- [Tesseract.js](https://tesseract.projectnaptha.com/) — OCR de imágenes escaneadas
- [Vercel](https://vercel.com) — hosting y despliegue

## 🚀 Uso

1. Clona el repositorio
2. Abre `index.html` en tu navegador
3. O visita la versión en vivo: **[academia-dev.vercel.app]()**

No requiere instalación ni servidor.

## 📁 Estructura

```
ACADEMIA_DEV/
├── index.html              ← Estructura HTML principal
├── auth-page.html          ← Login con Google
├── privacidad.html         ← Política de privacidad
├── terminos.html           ← Términos y condiciones
├── sw.js                   ← Service Worker (PWA offline)
├── manifest.json           ← Manifiesto PWA
│
├── css/
│   ├── base.css            ← Variables, reset, sidebar, nav, topbar
│   ├── components.css      ← Notes, kanban, hub cards, timeline, tags
│   └── mobile.css          ← Todos los @media queries + agenda responsive
│
├── js/
│   ├── auth.js             ← Google OAuth con Supabase
│   ├── db.js               ← Capa de datos (Supabase)
│   ├── academia-sync.js    ← Sincronización PC ↔ móvil
│   │
│   ├── state.js            ← State global, dbGet/Set, saveState, migración
│   ├── calificaciones.js   ← getMat, calcTotal, renderGrades
│   ├── semestres.js        ← switchSemester, createSemester
│   ├── ui.js               ← goPage, fillMatSels, tema, fuentes
│   ├── materias.js         ← renderMaterias, modales de clase
│   ├── stats.js            ← renderStats, gráficas
│   ├── search.js           ← Búsqueda global
│   ├── sounds.js           ← Sonidos UI, ruido blanco y sonidos ambientales
│   ├── pomodoro.js         ← Timer Pomodoro, historial, metas
│   ├── tasks.js            ← renderTasks, saveTask, subtareas
│   ├── calendar.js         ← renderCalendar, eventos
│   ├── notes.js            ← Notas, canvas, OCR, agenda semanal
│   ├── chrono.js           ← Cronómetro, modo enfoque, racha
│   ├── init.js             ← init(), continueInit(), auth flow
│   ├── notifications.js    ← Web Push, banners de recordatorio
│   ├── onboarding.js       ← Tutorial primera vez
│   └── bootstrap.js        ← DOMContentLoaded, sidebar móvil, logout
│
└── assets/
    └── icons/              ← Iconos PWA (32, 180, 192, 512, maskable)
```

## 🤖 Desarrollo con IA

Este proyecto fue desarrollado íntegramente con asistencia de **Claude (Anthropic)** como herramienta de programación. Todas las decisiones de diseño, funcionalidad y arquitectura fueron definidas por el autor.

El uso de IA como herramienta de desarrollo es una práctica legítima y cada vez más común en la industria del software.

## 👤 Autor

**Josué Castro** — [@JCastro-x](https://github.com/JCastro-x)

## 📄 Licencia

[MIT License](LICENSE) — libre de usar, modificar y distribuir con atribución al autor original.

## 🗺️ Roadmap

- [x] Login con Google (Supabase)
- [x] Base de datos en la nube (datos por usuario)
- [x] Sincronización automática entre dispositivos
- [x] Agenda semanal dinámica (7 días)
- [x] Recordatorios Web Push con hora exacta
- [x] Código modular (JS y CSS separados por responsabilidad)
- [x] PWA — instalable en Android/iOS
- [ ] APK nativo con Capacitor
- [ ] Dominio propio
