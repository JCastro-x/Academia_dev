# Gemini Proxy Setup - Asistente Académico

Este backend proxy permite que los usuarios usen el asistente de IA sin configurar su propia API key de Gemini.

## 📋 Requisitos

- Node.js 14+ 
- Una API key de Gemini (obtener en: https://makersuite.google.com/app/apikey)

## 🚀 Instalación Local (Desarrollo)

1. **Instalar dependencias:**
```bash
npm install
```

2. **Configurar API key:**
```bash
# Windows PowerShell
$env:GEMINI_API_KEY="tu-api-key-de-gemini"

# Windows CMD
set GEMINI_API_KEY=tu-api-key-de-gemini

# Linux/Mac
export GEMINI_API_KEY=tu-api-key-de-gemini
```

3. **Iniciar el servidor:**
```bash
npm start
```

El servidor correrá en `http://localhost:3001`

## 🌐 Endpoints

### Health Check
```
GET http://localhost:3001/health
```

### Chat con Asistente
```
POST http://localhost:3001/api/chat
Content-Type: application/json

{
  "message": "¿Qué tengo para esta semana?",
  "context": "Contexto opcional del usuario"
}
```

### Generar Flashcards
```
POST http://localhost:3001/api/flashcards
Content-Type: application/json

{
  "material": "Texto del material de estudio...",
  "materia": "Nombre de la materia"
}
```

## 🚀 Despliegue en Producción

### Opción 1: Vercel (Recomendado)

1. **Crear `vercel.json`:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "gemini-proxy.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/gemini-proxy.js"
    }
  ],
  "env": {
    "GEMINI_API_KEY": "@gemini-api-key"
  }
}
```

2. **Desplegar:**
```bash
npm i -g vercel
vercel
```

3. **Configurar variable de entorno en Vercel Dashboard:**
- Ir a Settings > Environment Variables
- Agregar `GEMINI_API_KEY` con tu key

### Opción 2: Railway

1. Crear cuenta en railway.app
2. Subir el código
3. Configurar `GEMINI_API_KEY` en Variables

### Opción 3: Render

1. Crear cuenta en render.com
2. Crear nuevo Web Service
3. Conectar repositorio GitHub
4. Configurar:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variable: `GEMINI_API_KEY`

## 🔧 Configuración del Frontend

### Actualizar URL del Proxy en Producción

En `ai-assistant.js` y `flashcards-ai.js`, reemplaza:
```javascript
const PROXY_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3001/api/chat' 
  : 'https://tu-proxy-production.com/api/chat'; // <-- TU URL
```

### Opcional: Configurar CORS

Si el proxy está en dominio diferente, el proxy ya incluye CORS configurado.

## 📊 Límites de Rate

- **100 requests/hora por IP** (configurable en `gemini-proxy.js`)
- Gemini API: 15 tokens/segundo en plan gratuito

## 🔒 Seguridad

- La API key de Gemini NUNCA se expone al frontend
- Rate limiting por IP
- CORS configurado para dominios específicos (opcional)

## 📝 Notas

- Mantén tu API key de Gemini segura en variables de entorno
- Monitorea el uso en el dashboard de Google AI Studio
- El plan gratuito de Gemini es generoso para desarrollo

## 🆘 Troubleshooting

### Error 403 en producción
- Verificar que `GEMINI_API_KEY` está configurada correctamente
- Verificar que el proxy está corriendo

### CORS errors
- Verificar que el proxy incluye el origen del frontend en CORS
- En desarrollo, el proxy acepta cualquier origen (`*`)

### Rate limit exceeded
- El usuario ha hecho demasiadas requests (>100/hora)
- Esperar 1 hora o aumentar el límite en el código

## 🎉 ¡Listo!

Una vez configurado el proxy en producción, todos los usuarios podrán usar el asistente de IA sin configurar nada.
