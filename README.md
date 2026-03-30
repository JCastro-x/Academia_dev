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
- Tareas recurrentes (diaria, semanal, mensual)
- Filtros por materia, prioridad y estado
- Recordatorios con notificaciones del sistema

### 📝 Notas
- Editor de texto enriquecido por materia
- Adjuntar imágenes y PDFs
- Visor de PDF integrado con OCR para imágenes y PDFs escaneados
- Búsqueda dentro de notas

### ⏱️ Pomodoro
- Timer en Web Worker — no se throttlea en background ni al cambiar de pestaña
- Modo flotante **Picture-in-Picture** (Chrome) — ventana siempre visible sobre otras apps con controles en tiempo real
- Sonidos generados con Web Audio API — sin archivos externos
- Historial de sesiones del día con estadísticas por materia
- Racha de estudio y meta diaria de sesiones

### 🃏 Flashcards
- Tarjetas por materia con pregunta / respuesta
- Modo estudio con flip card animado
- Progreso por sesión (conocido / no conocido / repetir)

### 📅 Calendario
- Vista mensual con eventos y tareas integrados
- Color por materia, countdown a eventos próximos

### 📊 Estadísticas
- Gráfico de puntos por materia
- Progreso de tareas completadas
- Promedio ponderado, materias en riesgo, créditos aprobados

### 👤 Perfil académico
- Cursos aprobados con nota y créditos
- Promedio acumulado y progreso de carrera
- Personalización: tipografía, color de acento, tema, sonidos

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

- Instalable en Android, iOS y escritorio (Chrome/Edge)
- Funciona offline con los datos en caché
- Shortcuts en el launcher: Nueva Tarea, Pomodoro, Notas, Calificaciones

---

## 📄 Licencia

**© 2025 JCastro014 — Todos los derechos reservados.**

Este proyecto está bajo la [GNU AGPL v3](LICENSE). Cualquier uso, modificación o distribución debe incluir la atribución visible:

> *"Based on Academia Dev by JCastro014"*  
> https://github.com/JCastro-x/Academia_dev

> https://academia-dev-kappa.vercel.app/
Para uso comercial o propietario contactar: josueliucastrososa@gmail.com
