# 🎓 Academia Dashboard v4.0

Dashboard académico moderno y funcional para organizar tu semestre universitario.

## 📁 Estructura del Proyecto

```
Academia_dev/
├── index.html              # Archivo principal (punto de entrada)
├── css/
│   ├── styles.css         # Estilos principales
│   └── pdf-viewer.css     # Estilos del visualizador de PDF
├── js/
│   ├── app.js             # Lógica principal de la aplicación
│   ├── pdf-handler.js     # Manejo de PDFs
│   └── all-scripts.js     # Scripts adicionales de la aplicación original
└── README.md              # Este archivo
```

## 🚀 Instalación

### Opción 1: Carpeta Local
1. Descarga todos los archivos
2. Crea una carpeta llamada `Academia_dev` en tu computadora
3. Extrae los archivos respetando la estructura de carpetas
4. Abre `index.html` en tu navegador

### Opción 2: Servidor Local (Recomendado)
Si tienes Python instalado:
```bash
# Python 3
python -m http.server 8000

# Luego abre: http://localhost:8000
```

Si tienes Node.js instalado:
```bash
# Instalar http-server globalmente (solo primera vez)
npm install -g http-server

# Ejecutar
http-server
```

## ✨ Características Principales

### 📚 Gestión Académica
- **📝 Notas**: Crea, edita y organiza tus notas
- **✅ Tareas**: Gestiona tus tareas y trabajos
- **📅 Calendario**: Visualiza tus eventos académicos
- **📖 Materias**: Registra y controla tus clases

### 🆕 Nuevo: Visualizador de PDF en Notas
Una de las características más importantes es la capacidad de adjuntar PDFs a tus notas:

#### Cómo usarlo:
1. Ve a la sección **Notas**
2. Haz clic en **➕ Nueva Nota**
3. Completa el título y contenido
4. En la sección "Adjuntar PDF", puedes:
   - **Hacer clic** en el área punteada
   - **Arrastrar y soltar** un archivo PDF directamente
5. El PDF se mostrará como un adjunto
6. Haz clic en el adjunto para **abrir el visualizador**

#### Características del Visualizador de PDF:
- ✅ **Vista completa**: Se carga el PDF completo (no parcial)
- 🔍 **Zoom**: 
  - Botón 🔍− para alejar
  - Botón 🔍+ para acercar
  - Muestra el porcentaje actual (50% - 300%)
- 📄 **Todas las páginas**: Desplázate para ver todas las páginas
- ⚡ **Rápido y eficiente**: Carga PDFs sin problemas
- 📱 **Responsive**: Funciona en computadora y celular

## 🎨 Tema Claro/Oscuro

Haz clic en el botón **☀️** en la barra superior para cambiar entre tema claro y oscuro. La preferencia se guarda automáticamente.

## 📊 Tecnologías Usadas

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **PDF**: PDF.js (para renderizar PDFs)
- **OCR**: Tesseract.js (reconocimiento óptico de caracteres)
- **Almacenamiento**: LocalStorage + IndexedDB
- **Fuentes**: Google Fonts (Space Mono, Syne, Inter, JetBrains Mono, Playfair Display)

## 💾 Almacenamiento de Datos

Todos tus datos se guardan localmente en tu navegador:
- **LocalStorage**: Configuración, notas, tareas
- **IndexedDB**: Imágenes y archivos grandes

Los datos **NO se envían a ningún servidor**. Todo es privado y local.

## ⚙️ Configuración

### Personalizar Colores
Abre `css/styles.css` y modifica las variables CSS en `:root`:

```css
:root {
  --accent: #7c6aff;      /* Color principal */
  --accent2: #a892ff;     /* Color secundario */
  --green: #4ade80;       /* Verde */
  --red: #f87171;         /* Rojo */
  /* ... más colores ... */
}
```

### Personalizar Fuentes
En `index.html`, modifica la importación de Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet">
```

## 🐛 Solución de Problemas

### El PDF no se carga
- Verifica que sea un archivo PDF válido
- Intenta con otro navegador
- Revisa la consola (F12) para errores

### Los datos no se guardan
- Verifica que LocalStorage está habilitado en tu navegador
- En navegación privada/incógnito, los datos no se guardan permanentemente

### El zoom no funciona bien
- Intenta actualizar la página
- Los PDFs muy grandes pueden ser lentos en zoom alto

## 🔐 Privacidad y Seguridad

- ✅ No se requiere conexión a internet (después de cargar)
- ✅ Tus datos no se envían a servidores externos
- ✅ No hay rastreo ni publicidades
- ✅ Todos los PDFs se procesan localmente en tu navegador

## 🤝 Contribuciones

Este proyecto fue creado para uso personal. Siéntete libre de modificarlo y adaptarlo a tus necesidades.

## 📝 Licencia

Uso personal. Libre para modificar y distribuir.

## 🎯 Próximas Mejoras

- [ ] Exportar notas a PDF
- [ ] Sincronización con Google Drive
- [ ] Recordatorios de tareas
- [ ] Análisis de desempeño académico
- [ ] Importar horarios desde imagen

## ❓ Preguntas Frecuentes

**P: ¿Puedo usar esto offline?**
R: Sí, después de que cargue por primera vez, funciona completamente sin internet.

**P: ¿Qué pasa si borro los datos del navegador?**
R: Se eliminarán tus notas, tareas y configuración. Haz backups regularmente descargando tus datos.

**P: ¿Puedo compartir mis notas con otros?**
R: Actualmente no, pero puedes exportarlas manualmente o compartir el navegador.

**P: ¿Soporta Excel o Word?**
R: Actualmente solo PDFs. Próximamente se agregarán más formatos.

---

**Hecho con ❤️ para estudiantes**

¿Preguntas? Consulta el código fuente o abre un issue.

Versión: 4.0.0
Última actualización: 2026
