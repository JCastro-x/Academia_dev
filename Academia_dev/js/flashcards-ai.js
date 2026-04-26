/* ═══════════════════════════════════════════════════════════
   FLASHCARDS AI MODULE  v1.0
   ─ Generación de flashcards con Gemini API
   ─ Lazy loading: solo se carga cuando se abre el modal
   ═══════════════════════════════════════════════════════════ */

let _aiGeneratedCards = [];
let _aiSelectedFiles = [];

/* ── MODAL CONTROLS ─────────────────────────────────────────── */
function openAIGenerateModal() {
  // Lazy load AI module script if not already loaded
  if (!window._aiModuleLoaded) {
    const script = document.createElement('script');
    script.src = 'js/flashcards-ai.js';
    script.onload = () => {
      window._aiModuleLoaded = true;
      _openAIModalAfterLoad();
    };
    document.head.appendChild(script);
  } else {
    _openAIModalAfterLoad();
  }
}

window._openAIModalAfterLoad = function() {
  // Open modal first to ensure it's in DOM
  document.getElementById('modal-ai-generate').classList.add('open');
  
  // Small delay to ensure DOM is ready
  setTimeout(() => {
    // Load saved API key or use default
    const savedKey = localStorage.getItem('gemini_api_key');
    const defaultKey = 'AIzaSyCer2vyc0n6MjWUd1cH9Ay4GCJ0DVkr0Ng'; // Default key for development
    const keyInput = document.getElementById('ai-api-key');
    
    if (keyInput) {
      if (savedKey) {
        keyInput.value = savedKey;
      } else {
        keyInput.value = defaultKey;
      }
    }
    
    // Populate selects
    _populateAISelects();
    
    // Reset state
    _aiGeneratedCards = [];
    _aiSelectedFiles = [];
    const fileList = document.getElementById('ai-file-list');
    if (fileList) fileList.innerHTML = '';
    
    const textInput = document.getElementById('ai-text-input');
    if (textInput) textInput.value = '';
    
    const pasteArea = document.getElementById('ai-paste-area');
    if (pasteArea) pasteArea.style.display = 'none';
    
    const previewArea = document.getElementById('ai-preview-area');
    if (previewArea) previewArea.style.display = 'none';
    
    const genBtn = document.getElementById('ai-generate-btn');
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.textContent = '✨ Generar Flashcards';
    }
  }, 50);
};

function closeAIGenerateModal() {
  document.getElementById('modal-ai-generate').classList.remove('open');
  _aiGeneratedCards = [];
  _aiSelectedFiles = [];
}

/* ── POPULATE SELECTS ────────────────────────────────────────── */
function _populateAISelects() {
  // Materias
  const matSel = document.getElementById('ai-mat-sel');
  if (matSel) {
    const prev = matSel.value;
    matSel.innerHTML = '<option value="">— Selecciona —</option>';
    const materias = (typeof State !== 'undefined' && Array.isArray(State.materias)) ? State.materias : [];
    materias.forEach(m => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = `${m.icon || '📚'} ${m.name}`;
      matSel.appendChild(o);
    });
    if (prev) matSel.value = prev;
  }
  
  // Carpetas (vacío al inicio, se actualiza al seleccionar materia)
  updateAIFolderSelect();
  
  // Notas
  const noteSel = document.getElementById('ai-note-sel');
  if (noteSel) {
    noteSel.innerHTML = '<option value="">— Selecciona una nota —</option>';
    const sem = typeof State !== 'undefined' ? State._activeSem : null;
    if (sem && Array.isArray(sem.notesArray)) {
      sem.notesArray.forEach(n => {
        const o = document.createElement('option');
        o.value = n.id;
        o.textContent = n.title || 'Sin título';
        noteSel.appendChild(o);
      });
    }
  }
}

function updateAIFolderSelect() {
  const matId = document.getElementById('ai-mat-sel')?.value || '';
  const folderSel = document.getElementById('ai-folder-sel');
  if (!folderSel) return;
  
  folderSel.innerHTML = '<option value="">Sin carpeta</option>';
  
  if (!matId) return;
  
  const sem = typeof State !== 'undefined' ? State._activeSem : null;
  if (!sem || !Array.isArray(sem.fcFolders)) return;
  
  sem.fcFolders.filter(f => f.matId === matId).forEach(f => {
    const o = document.createElement('option');
    o.value = f.id;
    o.textContent = `${f.icon || '📁'} ${f.name}`;
    folderSel.appendChild(o);
  });
}

/* ── FILE HANDLING ──────────────────────────────────────────── */
function handleAIFileSelect(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  
  _aiSelectedFiles = [..._aiSelectedFiles, ...files];
  
  const listEl = document.getElementById('ai-file-list');
  listEl.innerHTML = _aiSelectedFiles.map(f => 
    `<div style="padding:4px 8px;background:var(--surface2);border-radius:4px;margin-bottom:4px;">
      📎 ${f.name} (${(f.size/1024).toFixed(1)} KB)
    </div>`
  ).join('');
  
  input.value = '';
}

function toggleAIPasteArea() {
  const area = document.getElementById('ai-paste-area');
  area.style.display = area.style.display === 'none' ? 'block' : 'none';
}

/* ── LOAD NOTE TEXT ──────────────────────────────────────────── */
function loadNoteText() {
  const noteId = document.getElementById('ai-note-sel')?.value;
  if (!noteId) return;
  
  const sem = typeof State !== 'undefined' ? State._activeSem : null;
  if (!sem || !Array.isArray(sem.notesArray)) return;
  
  const note = sem.notesArray.find(n => n.id === noteId);
  if (!note) return;
  
  // Extract text from note
  let text = '';
  if (note.content) {
    // Remove HTML tags
    const div = document.createElement('div');
    div.innerHTML = note.content;
    text = div.textContent || div.innerText || '';
  }
  if (note.canvasData) {
    text += '[Imagen adjunta en la nota]';
  }
  
  document.getElementById('ai-text-input').value = text;
  document.getElementById('ai-paste-area').style.display = 'block';
}

/* ── GENERATE FLASHCARDS ─────────────────────────────────────── */
async function generateAIFlashcards() {
  const apiKey = document.getElementById('ai-api-key')?.value?.trim();
  if (!apiKey) {
    alert('Por favor ingresa tu API Key de Gemini');
    document.getElementById('ai-api-key').focus();
    return;
  }
  
  // Save API key
  localStorage.setItem('gemini_api_key', apiKey);
  
  const matId = document.getElementById('ai-mat-sel')?.value;
  if (!matId) {
    alert('Selecciona una materia destino');
    return;
  }
  
  const folderId = document.getElementById('ai-folder-sel')?.value || null;
  const count = parseInt(document.getElementById('ai-count')?.value) || 5;
  const type = document.getElementById('ai-type')?.value || 'qa';
  const customPrompt = document.getElementById('ai-custom-prompt')?.value || '';
  const textInput = document.getElementById('ai-text-input')?.value || '';
  
  // Get material text
  let materialText = textInput;
  
  // If files are selected, process them
  if (_aiSelectedFiles.length > 0) {
    materialText = await _processFilesForAI(_aiSelectedFiles);
  }
  
  if (!materialText.trim()) {
    alert('Por favor proporciona material de estudio (texto, archivo o nota)');
    return;
  }
  
  // Disable button and show loading
  const btn = document.getElementById('ai-generate-btn');
  btn.disabled = true;
  btn.innerHTML = '⏳ Generando... <span class="ai-spinner"></span>';
  
  try {
    console.log('Calling Gemini API with text length:', materialText.length);
    const cards = await _callGeminiAPI(apiKey, materialText, count, type, customPrompt);
    console.log('Generated cards:', cards);
    _aiGeneratedCards = cards;
    _renderAIPreview();
  } catch (error) {
    console.error('Error generating flashcards:', error);
    alert('Error al generar flashcards: ' + error.message + '\n\nPor favor verifica tu conexión a internet e intenta de nuevo.');
    btn.disabled = false;
    btn.textContent = '✨ Generar Flashcards';
  }
}

/* ── PROCESS FILES FOR AI ────────────────────────────────────── */
async function _processFilesForAI(files) {
  let text = '';
  
  for (const file of files) {
    if (file.type === 'application/pdf') {
      text += await _extractPDFText(file);
    } else if (file.type === 'text/plain') {
      text += await _readTextFile(file);
    } else if (file.type.startsWith('image/')) {
      text += `[Imagen: ${file.name}] `;
    }
    text += '\n\n';
  }
  
  return text;
}

async function _readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function _extractPDFText(file) {
  // For now, return placeholder - PDF.js integration would go here
  return `[PDF: ${file.name} - Extracción de texto pendiente de implementar]`;
}

/* ── GEMINI API CALL ─────────────────────────────────────────── */
async function _callGeminiAPI(apiKey, text, count, type, customPrompt) {
  const prompt = _buildPrompt(text, count, type, customPrompt);
  
  // Use gemini-2.5-flash which is available and supports generateContent
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error en la API de Gemini');
  }
  
  const data = await response.json();
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Parse JSON from response
  return _parseGeminiResponse(generatedText, type);
}

/* ── BUILD PROMPT ─────────────────────────────────────────────── */
function _buildPrompt(text, count, type, customPrompt) {
  let typeInstruction = '';
  
  switch(type) {
    case 'qa':
      typeInstruction = 'preguntas de "pregunta y respuesta"';
      break;
    case 'mc':
      typeInstruction = 'preguntas de opción múltiple con 4 opciones (A, B, C, D) indicando cuál es la correcta';
      break;
    case 'tf':
      typeInstruction = 'preguntas de verdadero/falso';
      break;
    case 'mixed':
      typeInstruction = 'una mezcla de preguntas: algunas de pregunta/respuesta, algunas de opción múltiple, y algunas de verdadero/falso';
      break;
  }
  
  let prompt = `Eres un experto en crear material de estudio para estudiantes universitarios. 
Tu tarea es generar ${count} ${typeInstruction} basadas en el siguiente texto.

TEXTO DEL MATERIAL:
${text}

${customPrompt ? `INSTRUCCIONES ADICIONALES: ${customPrompt}` : ''}

IMPORTANTE: Responde ÚNICAMENTE con un JSON válido con este formato exacto:
{
  "flashcards": [
    {
      "question": "texto de la pregunta",
      "answer": "texto de la respuesta",
      "type": "${type}",
      "options": ["A", "B", "C", "D"],  // solo para opción múltiple
      "correct": "A"  // solo para opción múltiple
    }
  ]
}

No incluyas ningún texto antes o después del JSON. El JSON debe ser válido y parseable.`;

  return prompt;
}

/* ── PARSE GEMINI RESPONSE ───────────────────────────────────── */
function _parseGeminiResponse(text, type) {
  // Try to extract JSON from markdown code blocks
  let jsonText = text;
  
  // Remove markdown code blocks if present
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1];
  }
  
  // Try to parse
  try {
    const data = JSON.parse(jsonText);
    if (Array.isArray(data.flashcards)) {
      return data.flashcards;
    }
    if (Array.isArray(data)) {
      return data;
    }
    throw new Error('Formato de respuesta inválido');
  } catch (e) {
    // Fallback: try to find JSON-like structure
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[0]);
        if (Array.isArray(data.flashcards)) {
          return data.flashcards;
        }
      } catch (e2) {
        // Ignore
      }
    }
    throw new Error('No se pudo parsear la respuesta de la IA. Por favor intenta de nuevo.');
  }
}

/* ── RENDER PREVIEW ──────────────────────────────────────────── */
function _renderAIPreview() {
  const previewArea = document.getElementById('ai-preview-area');
  const previewList = document.getElementById('ai-preview-list');
  
  console.log('Rendering preview, cards:', _aiGeneratedCards.length);
  console.log('previewArea exists:', !!previewArea);
  console.log('previewList exists:', !!previewList);
  
  if (!_aiGeneratedCards.length) {
    if (previewArea) previewArea.style.display = 'none';
    return;
  }
  
  if (!previewArea || !previewList) {
    console.error('Preview elements not found in DOM');
    alert('Error: No se encontraron los elementos de vista previa. Por favor cierra y vuelve a abrir el modal.');
    return;
  }
  
  previewArea.style.display = 'block';
  
  // Scroll to preview area
  previewArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  
  previewList.innerHTML = _aiGeneratedCards.map((card, idx) => {
    let extraInfo = '';
    if (card.type === 'mc' && card.options) {
      extraInfo = `<div style="margin-top:8px;font-size:11px;color:var(--text3);">
        ${card.options.map((opt, i) => `<div>${String.fromCharCode(65+i)}. ${opt} ${opt === card.correct ? '✓' : ''}</div>`).join('')}
      </div>`;
    } else if (card.type === 'tf') {
      extraInfo = `<div style="margin-top:8px;font-size:11px;color:var(--text3);">Respuesta: ${card.answer}</div>`;
    }
    
    return `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">#${idx + 1} · ${(card.type || 'QA').toUpperCase()}</div>
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${card.question}</div>
        <div style="font-size:12px;color:var(--text2);">${card.answer}</div>
        ${extraInfo}
      </div>
    `;
  }).join('');
  
  console.log('Preview rendered, HTML length:', previewList.innerHTML.length);
  
  // Re-enable button
  const btn = document.getElementById('ai-generate-btn');
  if (btn) {
    btn.disabled = false;
    btn.textContent = '✨ Regenerar';
  }
}

/* ── SAVE GENERATED FLASHCARDS ───────────────────────────────── */
function saveAIFlashcards() {
  if (!_aiGeneratedCards.length) {
    alert('No hay flashcards para guardar');
    return;
  }
  
  const matId = document.getElementById('ai-mat-sel')?.value;
  const folderId = document.getElementById('ai-folder-sel')?.value || null;
  
  console.log('Saving flashcards:', { matId, folderId, cardsCount: _aiGeneratedCards.length });
  
  if (!matId) {
    alert('Selecciona una materia destino');
    return;
  }
  
  const sem = typeof State !== 'undefined' ? State._activeSem : null;
  if (!sem) {
    alert('No hay semestre activo');
    return;
  }
  
  if (!Array.isArray(sem.flashcards)) sem.flashcards = [];
  
  console.log('Before save, total flashcards:', sem.flashcards.length);
  
  // Add each generated card
  _aiGeneratedCards.forEach(card => {
    const newCard = {
      id: 'fc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      matId: matId,
      folderId: folderId,
      question: card.question,
      answer: card.answer,
      type: card.type || 'qa',
      options: card.options || null,
      correct: card.correct || null,
      tags: ['IA-generado'],
      status: 'nueva',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    sem.flashcards.push(newCard);
  });
  
  console.log('After save, total flashcards:', sem.flashcards.length);
  
  // Save state
  if (typeof saveStateNow === 'function') {
    saveStateNow(['semestres']);
  } else if (typeof saveState === 'function') {
    saveState(['semestres']);
  }
  
  // Refresh UI
  if (typeof updateFcHeaderStats === 'function') updateFcHeaderStats();
  if (typeof _fcRefresh === 'function') _fcRefresh();
  
  // Show success message before closing
  const savedCount = _aiGeneratedCards.length;
  alert(`✅ Se guardaron ${savedCount} flashcards generadas por IA`);
  
  // Close modal
  closeAIGenerateModal();
}
