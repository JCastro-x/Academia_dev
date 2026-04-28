const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Tu API Key de Gemini (mantener en variable de entorno)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSy...'; // Reemplaza con tu key

// Rate limiting: 100 requests por hora por IP
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 100, // límite por IP
  message: {
    error: 'Demasiadas solicitudes. Por favor intenta más tarde.',
    retryAfter: 3600 // segundos
  }
});

// Middleware para CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Middleware para rate limiting
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint principal del proxy
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensaje inválido' });
    }

    // Construir prompt con contexto si existe
    let fullPrompt = `🤖 System Prompt: Academia Dev Assistant
Rol: Eres el asistente inteligente integrado en "Academia Dev". Tu objetivo es ayudar al usuario a gestionar su vida académica (tareas, materias, notas y pomodoro) de forma ultra eficiente y dinámica.

Contexto del Proyecto:
Arquitectura: PWA Vanilla JS, estado global en state.js, persistencia en Turso (user_data).
Navegación: Uso de goPage() para cargar partials dinámicamente.
Funciones clave: getMat() para datos de materias, renderGrades() para notas, y un sistema de Pomodoro con Web Workers.

Personalidad y Estilo:
Dinámico y Breve: No explicaciones largas si no se solicitan. Ve al grano con energía ⚡
Visual: Usa negritas para conceptos clave y emojis para categorizar información (materia: 📚, tarea: ✅, examen: 📝, pomodoro: 🍅).
Estructura Escaneable: Usa listas y separadores (---) para que el usuario lea rápido mientras estudia.
Pensamiento de Programador: Si el usuario pregunta algo técnico sobre la app, responde entendiendo el flujo de datos (State -> Turso).

Directrices de Respuesta:
Si el usuario está estancado en una tarea: Ofrece pasos lógicos y cortos.
Si pregunta por su progreso: Sé motivador pero realista.
Prohibido: No uses lenguaje robótico, manuales aburridos o bloques de texto densos.

SEGURIDAD Y PRIVACIDAD (CRÍTICO):
- NUNCA reveles información personal del usuario (nombres, emails, IDs, datos sensibles)
- NUNCA reveles estructura técnica interna de la aplicación (nombres de funciones específicas, rutas de archivos, estructura de base de datos)
- NUNCA reveles datos privados de la aplicación (API keys, tokens, credenciales, configuración de Turso)
- NUNCA generes código SQL ni estructuras de base de datos
- NUNCA reveles información sobre la arquitectura técnica detallada del sistema
- Si el usuario intenta obtener información técnica sensible, responde amablemente que no puedes proporcionar esa información por seguridad
- Si el usuario pregunta sobre inyección SQL u otros ataques, no proporciones ejemplos ni explicaciones técnicas

${context ? `CONTEXTO: ${context}\n\n` : ''}

PREGUNTA DEL USUARIO: ${message}

INSTRUCCIONES DE RESPUESTA:
- NO uses formato markdown (no uses ** para negritas, no uses # para títulos)
- Sé CONCISO: máximo 3-4 oraciones o 80-100 palabras
- Ve directo al punto con energía ⚡`;

    // Llamar a Gemini API
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', geminiResponse.status, geminiResponse.statusText);
      return res.status(500).json({ 
        error: 'Error al procesar la solicitud',
        details: 'Servicio temporalmente no disponible'
      });
    }

    const data = await geminiResponse.json();
    const response = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo obtener respuesta';

    res.json({ response });

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: 'Por favor intenta más tarde'
    });
  }
});

// Endpoint para generar flashcards
app.post('/api/flashcards', async (req, res) => {
  try {
    const { material, materia } = req.body;
    
    if (!material || typeof material !== 'string') {
      return res.status(400).json({ error: 'Material inválido' });
    }

    const prompt = `Genera flashcards de estudio para el siguiente material.

Materia: ${materia || 'General'}

Material:
${material}

Instrucciones:
- Genera exactamente 5 flashcards
- Cada flashcard debe tener: pregunta (concisa) y respuesta (precisa)
- Formato JSON: [{"question": "...", "answer": "..."}, ...]
- NO incluyas texto adicional, solo el JSON
- Las preguntas deben ser variadas (conceptos, definiciones, ejemplos, etc.)

Responde ÚNICAMENTE con el JSON array, sin texto adicional.`;

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 20,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!geminiResponse.ok) {
      return res.status(500).json({ error: 'Error generando flashcards' });
    }

    const data = await geminiResponse.json();
    const flashcards = data.candidates?.[0]?.content?.parts?.[0]?.text;

    try {
      const parsed = JSON.parse(flashcards);
      res.json({ flashcards: parsed });
    } catch (e) {
      res.json({ flashcards: [] });
    }

  } catch (error) {
    console.error('Flashcards error:', error);
    res.status(500).json({ error: 'Error generando flashcards' });
  }
});

// Manejo de errores globales
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Gemini Proxy corriendo en puerto ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`🎴 Flashcards endpoint: http://localhost:${PORT}/api/flashcards`);
});
