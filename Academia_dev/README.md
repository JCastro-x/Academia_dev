# Academia Dev 🎓

Dashboard académico gratuito para universitarios. Organiza tu semestre con calificaciones, tareas, Pomodoro, flashcards con IA, asistente académico y más.

![Academia Dev](https://img.shields.io/badge/version-2.0-purple)
![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-active-green)

## ✨ Características

### 📊 Gestión Académica
- **Calificaciones por zona**: Ingresá notas por parcial, laboratorio y final. Promedio ponderado por créditos con proyección de aprobación.
- **Gestión de tareas**: Organizá tareas con subtareas, prioridades y fechas de entrega.
- **Horario**: Visualizá tu horario semanal de materias.
- **Calendario**: Eventos académicos y fechas importantes.

### 🛠️ Herramientas de Estudio
- **Pomodoro anti-throttle**: Timer en Web Worker con timestamps absolutos. Preciso incluso si cambiás de pestaña.
- **Flashcards con IA**: Generá flashcards automáticamente desde texto, archivos o notas usando Google Gemini API.
  - Soporta QA, opción múltiple, verdadero/falso y mixto
  - Vista previa antes de guardar
  - Configuración de cantidad (1-20 flashcards)
- **Notas con OCR**: Adjuntá imágenes y PDFs. Tesseract.js extrae texto automáticamente.

### 🤖 Asistente de IA
- **Chat contextual**: Asistente académico flotante que analiza tus notas y flashcards.
- **Creación de tareas por voz**: Escribí en lenguaje natural "Agrega una tarea de matemáticas para el viernes" y la IA la crea.
- **Respuestas amigables**: Sin formato markdown, respuestas conversacionales.
- **Contexto dinámico**: Adjuntá notas o flashcards actuales para análisis contextual.

### ☁️ Sincronización
- **Multi-dispositivo en tiempo real**: Sync automático vía Supabase entre todos tus dispositivos.
- **Row Level Security**: Tus datos privados, solo vos podés verlos.
- **Conflict guard**: Sistema que previene conflictos al editar desde múltiples dispositivos.

### 📱 PWA
- **Instalable**: Android, iOS y escritorio como app nativa.
- **Offline**: Service Worker con cache inteligente.
- **Network First / Cache First**: Estrategias de cache optimizadas.

## 🚀 Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Supabase (PostgreSQL + Auth)
- **IA**: Google Gemini 2.5 Flash API
- **OCR**: Tesseract.js, PDF.js
- **Hosting**: Vercel
- **PWA**: Service Worker, IndexedDB
- **Web APIs**: Web Workers, Picture-in-Picture, Web Audio API, BroadcastChannel

## 📦 Instalación

### Para Usuarios

1. Visita [academia-dev-jcx-team.vercel.app](https://academia-dev-jcx-team.vercel.app/)
2. Entrá con Google OAuth
3. ¡Listo! Tus datos se sincronizan automáticamente.

### Para Desarrolladores

```bash
# Clonar el repositorio
git clone https://github.com/JCastro-x/Academia_dev.git
cd Academia_dev

# Configurar Supabase
# Crea un archivo .env con:
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_anon_key

# Ejecutar migraciones
# Ver SUPABASE_MIGRATION_REQUIREMENTS.md

# Servir localmente
npx serve .
```

## 🔐 Configuración de IA

Academia Dev usa **Google Gemini 2.5 Flash API** para funciones de IA:

- **API Key**: Preconfigurada en la aplicación (plan gratuito)
- **Límites**: 15 req/min (suficiente para uso estudiantil)
- **Modelo**: gemini-2.5-flash (disponible globalmente)
- **Privacidad**: El contenido se procesa en servidores de Google. Consulta la [Política de Privacidad](privacidad.html) para más detalles.

## 📄 Estructura del Proyecto

```
Academia_dev/
├── assets/           # Iconos y recursos
├── css/              # Estilos
├── js/               # Lógica JavaScript
│   ├── flashcards-ai.js   # Generación de flashcards con IA
│   ├── ai-assistant.js    # Asistente académico
│   └── ...
├── partials/         # Componentes HTML
├── app.html          # Aplicación principal
├── index.html        # Landing page
├── auth-page.html    # Login
├── privacidad.html   # Política de privacidad
├── terminos.html     # Términos y condiciones
└── README.md         # Este archivo
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Creá una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrí un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo LICENSE para más detalles.

## ⚠️ Exención de Responsabilidad

Academia Dev se proporciona "tal cual". Josue Castro y Void Studio no serán responsables por ningún daño, pérdida de datos, interrupción del servicio, o perjuicio de cualquier tipo que resulte del uso o la imposibilidad de uso de Academia Dev. El uso de la Plataforma es bajo tu propio riesgo y responsabilidad.

## 📞 Contacto

- **Email**: academia.dev@example.com
- **GitHub**: [JCastro-x/Academia_dev](https://github.com/JCastro-x/Academia_dev)
- **Desarrollado por**: Josue Castro · Void Studio · Guatemala · 2026

---

**Hecho con ☕ en Guatemala**
