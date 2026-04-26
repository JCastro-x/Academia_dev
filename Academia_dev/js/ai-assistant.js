/* ═══════════════════════════════════════════════════════════
   AI ASSISTANT MODULE  v1.0
   ─ Chat con Gemini API
   ─ Análisis contextual de notas, flashcards, archivos
   ═══════════════════════════════════════════════════════════ */

let _aiChatHistory = [];
let _aiContext = null; // { type: 'note'|'flashcard'|'file', data: ... }
const _aiApiKey = 'AIzaSyCer2vyc0n6MjWUd1cH9Ay4GCJ0DVkr0Ng';

/* ── MODAL CONTROLS ─────────────────────────────────────────── */
function toggleAIChat() {
  const modal = document.getElementById('ai-chat-modal');
  if (modal.style.display === 'none') {
    modal.style.display = 'flex';
    document.getElementById('ai-chat-input').focus();
  } else {
    modal.style.display = 'none';
  }
}

/* ── CONTEXT ATTACHMENT ─────────────────────────────────────── */
function attachCurrentNote() {
  const sem = typeof State !== 'undefined' ? State._activeSem : null;
  if (!sem || !Array.isArray(sem.notesArray)) {
    addSystemMessage('💡 No hay notas disponibles. Ve a la sección de Notas y crea una primera.');
    return;
  }
  
  // Try to get current note ID from notes.js
  const currentNoteId = typeof _currentNoteId !== 'undefined' ? _currentNoteId : null;
  if (!currentNoteId) {
    addSystemMessage('💡 Dirígete a la nota que quieres que analice, luego vuelve aquí y pulsa "Nota actual".');
    return;
  }
  
  const note = sem.notesArray.find(n => n.id === currentNoteId);
  if (!note) {
    addSystemMessage('💡 No se encontró la nota seleccionada. Por favor selecciona una nota en la sección de Notas.');
    return;
  }
  
  // Extract text from note
  let text = '';
  if (note.content) {
    const div = document.createElement('div');
    div.innerHTML = note.content;
    text = div.textContent || div.innerText || '';
  }
  
  _aiContext = {
    type: 'note',
    id: note.id,
    title: note.title || 'Sin título',
    content: text
  };
  
  addSystemMessage(`📝 Contexto adjuntado: Nota "${note.title}"`);
}

function attachCurrentFlashcard() {
  const sem = typeof State !== 'undefined' ? State._activeSem : null;
  if (!sem || !Array.isArray(sem.flashcards)) {
    addSystemMessage('💡 No hay flashcards disponibles. Ve a la sección de Flashcards y crea una primera.');
    return;
  }
  
  // Try to get current flashcard context from flashcards.js
  // This would need to be set by flashcards.js when viewing a card
  const currentCardId = typeof _currentCardId !== 'undefined' ? _currentCardId : null;
  if (!currentCardId) {
    addSystemMessage('💡 Dirígete a la flashcard que quieres que analice, luego vuelve aquí y pulsa "Flashcard actual".');
    return;
  }
  
  const card = sem.flashcards.find(c => c.id === currentCardId);
  if (!card) {
    addSystemMessage('💡 No se encontró la flashcard seleccionada. Por favor selecciona una flashcard en la sección de Flashcards.');
    return;
  }
  
  _aiContext = {
    type: 'flashcard',
    id: card.id,
    question: card.question,
    answer: card.answer
  };
  
  addSystemMessage(`🎴 Contexto adjuntado: Flashcard sobre "${card.question.substring(0, 30)}..."`);
}

function clearAIContext() {
  _aiContext = null;
  addSystemMessage('🗑️ Contexto eliminado');
}

function showMyActivities() {
  const sem = typeof State !== 'undefined' ? State._activeSem : null;
  if (!sem) {
    addSystemMessage('💡 No hay semestre activo disponible.');
    return;
  }

  const tasks = sem.tasks ? sem.tasks.filter(t => !t.done) : [];
  const events = sem.events || [];

  let message = '📋 TUS ACTIVIDADES:\n\n';

  if (tasks.length > 0) {
    message += `✅ TAREAS (${tasks.length}):\n`;
    tasks.forEach(t => {
      const mat = sem.materias.find(m => m.id === t.matId);
      const matName = mat ? mat.name : 'Sin materia';
      const priorityEmoji = t.priority === 'alta' ? '🔴' : t.priority === 'media' ? '🟡' : '🟢';
      message += `${priorityEmoji} ${t.title} (${matName}) - ${t.due || 'Sin fecha'}\n`;
    });
    message += '\n';
  } else {
    message += '✅ Sin tareas pendientes\n\n';
  }

  if (events.length > 0) {
    message += `📅 EVENTOS (${events.length}):\n`;
    events.forEach(e => {
      const mat = sem.materias.find(m => m.id === e.matId);
      const matName = mat ? mat.name : 'Sin materia';
      message += `📌 ${e.title} (${matName}) - ${e.date} ${e.hora || ''}\n`;
    });
  } else {
    message += '📅 Sin eventos próximos';
  }

  addSystemMessage(message);
}

function attachFullContext() {
  const sem = typeof State !== 'undefined' ? State._activeSem : null;
  if (!sem) {
    addSystemMessage('💡 No hay semestre activo disponible.');
    return;
  }

  // Compilar información completa del semestre
  const contextData = {
    type: 'full',
    semester: {
      name: sem.nombre,
      objective: sem.promedioObjetivo,
      prevAvg: sem.prevAvg,
      prevCred: sem.prevCred
    },
    subjects: sem.materias.map(m => ({
      id: m.id,
      name: m.name,
      code: m.code,
      icon: m.icon,
      color: m.color,
      credits: m.credits,
      teacher: m.catedratico,
      section: m.seccion,
      schedule: m.dias ? `${m.dias} ${m.horario || ''}` : null
    })),
    tasks: sem.tasks.filter(t => !t.done).map(t => ({
      title: t.title,
      subject: sem.materias.find(m => m.id === t.matId)?.name || 'Sin materia',
      due: t.due,
      priority: t.priority,
      type: t.type
    })),
    events: sem.events.map(e => ({
      title: e.title,
      subject: sem.materias.find(m => m.id === e.matId)?.name || 'Sin materia',
      date: e.date,
      time: e.hora,
      type: e.type
    })),
    notes: sem.notesArray ? sem.notesArray.map(n => ({
      title: n.title,
      subject: sem.materias.find(m => m.id === n.matId)?.name || 'Sin materia',
      preview: (n.content || '').replace(/<[^>]+>/g, '').slice(0, 200)
    })) : [],
    grades: {}
  };

  // Agregar calificaciones por materia
  if (sem.grades) {
    sem.materias.forEach(m => {
      if (sem.grades[m.id]) {
        contextData.grades[m.name] = sem.grades[m.id];
      }
    });
  }

  _aiContext = contextData;
  addSystemMessage(`📊 Contexto completo adjuntado: ${contextData.semester.name} con ${contextData.subjects.length} materias, ${contextData.tasks.length} tareas pendientes y ${contextData.events.length} eventos.`);
}

function addSystemMessage(text) {
  const messagesDiv = document.getElementById('ai-chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'ai-message ai-message-ai';
  msgDiv.style.background = 'rgba(124,106,255,.1)';
  msgDiv.style.border = '1px solid rgba(124,106,255,.3)';
  msgDiv.innerHTML = `<div class="ai-message-content">${text}</div>`;
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/* ── SEND MESSAGE ──────────────────────────────────────────── */
async function sendAIMessage() {
  const input = document.getElementById('ai-chat-input');
  const message = input.value.trim();
  
  if (!message) return;
  
  // Add user message
  addChatMessage(message, 'user');
  input.value = '';
  
  // Add typing indicator
  addTypingIndicator();
  
  try {
    const response = await _callGeminiChat(message);
    removeTypingIndicator();
    addChatMessage(response, 'ai');
  } catch (error) {
    removeTypingIndicator();
    // Check if it's a quota exceeded error
    if (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('rate-limit')) {
      addChatMessage('🚫 El asistente no está disponible en este momento. Por favor intenta de nuevo en unos minutos.', 'ai');
    } else {
      addChatMessage('Error: ' + error.message, 'ai');
    }
  }
}

function addChatMessage(text, sender) {
  const messagesDiv = document.getElementById('ai-chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = `ai-message ai-message-${sender}`;
  msgDiv.innerHTML = `<div class="ai-message-content">${text}</div>`;
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  
  // Add to history
  _aiChatHistory.push({ role: sender === 'user' ? 'user' : 'model', parts: [{ text }] });
}

function addTypingIndicator() {
  const messagesDiv = document.getElementById('ai-chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.id = 'ai-typing-indicator';
  msgDiv.className = 'ai-message ai-message-ai';
  msgDiv.innerHTML = `<div class="ai-message-content"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('ai-typing-indicator');
  if (indicator) indicator.remove();
}

/* ── GEMINI CHAT API ─────────────────────────────────────────── */
async function _callGeminiChat(userMessage) {
  // Check if user wants to create a task
  const taskCreationKeywords = ['agrega', 'añade', 'crea', 'nueva tarea', 'tarea nueva', 'agregar', 'añadir', 'crear'];
  const wantsTask = taskCreationKeywords.some(kw => userMessage.toLowerCase().includes(kw));

  if (wantsTask) {
    return await _handleTaskCreation(userMessage);
  }

  // Auto-attach full context for task/priority/activity questions
  const contextKeywords = ['tarea', 'prioridad', 'urgente', 'actividad', 'qué tengo', 'pendiente', 'vence', 'fecha', 'entrega', 'examen', 'estudio'];
  const needsContext = contextKeywords.some(kw => userMessage.toLowerCase().includes(kw));

  let contextPrompt = '';

  if (_aiContext) {
    if (_aiContext.type === 'note') {
      contextPrompt = `CONTEXTO: El usuario está viendo una nota titulada "${_aiContext.title}" con el siguiente contenido:\n\n${_aiContext.content}\n\n`;
    } else if (_aiContext.type === 'flashcard') {
      contextPrompt = `CONTEXTO: El usuario está viendo una flashcard:\nPregunta: ${_aiContext.question}\nRespuesta: ${_aiContext.answer}\n\n`;
    } else if (_aiContext.type === 'full') {
      // Contexto completo del semestre
      const c = _aiContext;
      contextPrompt = `CONTEXTO COMPLETO DEL SEMESTRE:
SEMESTRE: ${c.semester.name}
- Objetivo de promedio: ${c.semester.objective}
- Promedio anterior: ${c.semester.prevAvg}
- Créditos anteriores: ${c.semester.prevCred}

MATERIAS (${c.subjects.length}):
${c.subjects.map(s => `- ${s.icon} ${s.name} (${s.code || 'Sin código'})
  Créditos: ${s.credits || 'N/A'}
  Profesor: ${s.teacher || 'N/A'}
  Sección: ${s.section || 'N/A'}
  Horario: ${s.schedule || 'Sin horario'}`).join('\n')}

TAREAS PENDIENTES (${c.tasks.length}):
${c.tasks.length > 0 ? c.tasks.map(t => `- ${t.title} (${t.subject})
  Fecha: ${t.due || 'Sin fecha'}
  Prioridad: ${t.priority}
  Tipo: ${t.type}`).join('\n') : 'Sin tareas pendientes'}

EVENTOS (${c.events.length}):
${c.events.length > 0 ? c.events.map(e => `- ${e.title} (${e.subject})
  Fecha: ${e.date}
  Hora: ${e.time || 'Sin hora'}
  Tipo: ${e.type}`).join('\n') : 'Sin eventos'}

NOTAS (${c.notes.length}):
${c.notes.length > 0 ? c.notes.map(n => `- ${n.title} (${n.subject})
  Vista previa: ${n.preview || 'Sin contenido'}`).join('\n') : 'Sin notas'}

CALIFICACIONES:
${Object.keys(c.grades).length > 0 ? Object.entries(c.grades).map(([subject, grades]) => `- ${subject}: ${JSON.stringify(grades)}`).join('\n') : 'Sin calificaciones registradas'}

`;
    }
  } else if (needsContext) {
    // Auto-attach full context when user asks about tasks/priorities
    const sem = typeof State !== 'undefined' ? State._activeSem : null;
    if (sem) {
      const tasks = sem.tasks ? sem.tasks.filter(t => !t.done) : [];
      const events = sem.events || [];

      contextPrompt = `CONTEXTO DEL SEMESTRE:
SEMESTRE: ${sem.nombre}

TAREAS PENDIENTES (${tasks.length}):
${tasks.length > 0 ? tasks.map(t => {
  const mat = sem.materias.find(m => m.id === t.matId);
  const matName = mat ? mat.name : 'Sin materia';
  return `- ${t.title} (${matName})
  Fecha: ${t.due || 'Sin fecha'}
  Prioridad: ${t.priority}
  Tipo: ${t.type}`;
}).join('\n') : 'Sin tareas pendientes'}

EVENTOS (${events.length}):
${events.length > 0 ? events.map(e => {
  const mat = sem.materias.find(m => m.id === e.matId);
  const matName = mat ? mat.name : 'Sin materia';
  return `- ${e.title} (${matName})
  Fecha: ${e.date}
  Hora: ${e.hora || 'Sin hora'}
  Tipo: ${e.type}`;
}).join('\n') : 'Sin eventos'}

`;
    }
  }
  
  const fullPrompt = `🤖 System Prompt: Academia Dev Assistant
Rol: Eres el asistente inteligente integrado en "Academia Dev". Tu objetivo es ayudar al usuario a gestionar su vida académica (tareas, materias, notas y pomodoro) de forma ultra eficiente y dinámica.

Contexto del Proyecto:
Arquitectura: PWA Vanilla JS, estado global en state.js, persistencia en Supabase (user_data).
Navegación: Uso de goPage() para cargar partials dinámicamente.
Funciones clave: getMat() para datos de materias, renderGrades() para notas, y un sistema de Pomodoro con Web Workers.

Personalidad y Estilo:
Dinámico y Breve: No des explicaciones largas si no se solicitan. Ve al grano con energía. ⚡
Visual: Usa negritas para conceptos clave y emojis para categorizar información (materia: 📚, tarea: ✅, examen: 📝, pomodoro: 🍅).
Estructura Scannable: Usa listas y separadores (---) para que el usuario lea rápido mientras estudia.
Pensamiento de Programador: Si el usuario pregunta algo técnico sobre la app, responde entendiendo el flujo de datos (State -> Supabase).

Directrices de Respuesta:
Si el usuario está estancado en una tarea: Ofrece pasos lógicos y cortos.
Si pregunta por su progreso: Sé motivador pero realista.
Prohibido: No uses lenguaje robótico, manuales aburridos o bloques de texto densos.

${contextPrompt}

PREGUNTA DEL USUARIO: ${userMessage}

INSTRUCCIONES DE RESPUESTA:
- NO uses formato markdown (no uses ** para negritas, no uses # para títulos)
- Sé CONCISO: máximo 3-4 oraciones o 80-100 palabras
- Ve directo al punto con energía ⚡`;
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${_aiApiKey}`, {
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
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error en la API de Gemini');
  }
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo obtener respuesta';
}

/* ── TASK CREATION FROM CHAT ───────────────────────────────────── */
async function _handleTaskCreation(userMessage) {
  const sem = typeof State !== 'undefined' ? State._activeSem : null;
  if (!sem || !Array.isArray(sem.materias)) {
    return '💡 No hay materias disponibles. Primero crea una materia en la sección de Materias.';
  }
  
  // Get available subjects
  const subjects = sem.materias.map(m => ({ id: m.id, name: m.name }));
  
  const prompt = `El usuario quiere crear una tarea. Extrae la siguiente información del mensaje: "${userMessage}"
  
  Materias disponibles: ${subjects.map(s => s.name).join(', ')}
  
  Responde ÚNICAMENTE con un JSON válido con este formato:
  {
    "title": "título de la tarea",
    "matId": "ID de la materia (o null si no se menciona)",
    "due": "fecha en formato YYYY-MM-DD (o null si no se menciona)",
    "priority": "alta|media|baja (o null si no se menciona)",
    "type": "estudio|examen|tarea|proyecto (o null si no se menciona)"
  }
  
  Si no puedes extraer algún campo, usa null. No incluyas texto antes o después del JSON.`;
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${_aiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    });
    
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse JSON
    let jsonText = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonText = codeBlockMatch[1];
    
    const taskData = JSON.parse(jsonText);
    
    // Create the task
    if (typeof State !== 'undefined' && Array.isArray(State.tasks)) {
      const newTask = {
        id: Date.now().toString(),
        title: taskData.title || 'Nueva tarea',
        matId: taskData.matId || (subjects[0]?.id || null),
        priority: taskData.priority || 'media',
        due: taskData.due || '',
        type: taskData.type || 'tarea',
        notes: '',
        timeEst: 0,
        tags: ['IA-creado'],
        kanbanCol: 'todo',
        done: false,
        createdAt: Date.now(),
        subtasks: [],
        attachments: [],
        comments: [],
        repeat: 'none',
        repeatUntil: '',
        repeatCount: 0,
        repeatDone: 0,
        estDays: 0,
        estHoursPerDay: 0
      };
      
      State.tasks.unshift(newTask);
      
      if (typeof saveState === 'function') saveState(['tasks']);
      if (typeof renderTasks === 'function') renderTasks();
      if (typeof updateBadge === 'function') updateBadge();
      
      return `✅ Tarea creada: "${newTask.title}"${newTask.due ? ` para el ${newTask.due}` : ''}`;
    }
    
    return 'Error al crear la tarea';
  } catch (error) {
    console.error('Error creating task:', error);
    return '💡 No pude entender bien la tarea. Intenta ser más específico, por ejemplo: "Agrega una tarea de matemáticas para el viernes con prioridad alta"';
  }
}
