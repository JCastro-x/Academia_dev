/**
 * PDF Handler - Visualización y gestión de PDFs en notas
 * Permite cargar PDFs completos, visualizarlos en el navegador con zoom
 */

let currentPdfDoc = null;
let currentPdfScale = 1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

/**
 * Inicializa el área de carga de PDF
 */
function initPdfUpload(elementId = 'pdf-upload-area') {
  const uploadArea = document.getElementById(elementId);
  if (!uploadArea) return;

  uploadArea.addEventListener('click', () => openPdfFilePicker());
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handlePdfDrop(e);
  });
}

/**
 * Abre el selector de archivos PDF
 */
function openPdfFilePicker() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf';
  input.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      loadPdfFile(e.target.files[0]);
    }
  });
  input.click();
}

/**
 * Maneja el drop de archivos
 */
function handlePdfDrop(event) {
  const files = event.dataTransfer.files;
  for (let file of files) {
    if (file.type === 'application/pdf') {
      loadPdfFile(file);
      break;
    }
  }
}

/**
 * Carga un archivo PDF
 */
function loadPdfFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const arrayBuffer = e.target.result;
    loadPdfFromArrayBuffer(arrayBuffer, file.name);
  };
  reader.readAsArrayBuffer(file);
}

/**
 * Carga el PDF desde un ArrayBuffer
 */
async function loadPdfFromArrayBuffer(arrayBuffer, fileName) {
  try {
    const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
    currentPdfDoc = pdf;
    currentPdfScale = 1;
    
    // Mostrar modal del PDF
    openPdfViewer(fileName);
    
    // Renderizar primera página
    renderPdfPage(1);
  } catch (error) {
    console.error('Error loading PDF:', error);
    alert('Error al cargar el PDF. Intenta nuevamente.');
  }
}

/**
 * Abre el visor de PDF
 */
function openPdfViewer(fileName) {
  const modal = document.getElementById('pdf-viewer-modal');
  const title = document.getElementById('pdf-title');
  
  if (modal && title) {
    title.textContent = `📄 ${fileName}`;
    modal.style.display = 'flex';
  }
}

/**
 * Cierra el visor de PDF
 */
function closePdfViewer() {
  const modal = document.getElementById('pdf-viewer-modal');
  const container = document.getElementById('pdf-container');
  
  if (modal) {
    modal.style.display = 'none';
  }
  
  if (container) {
    container.innerHTML = '';
  }
  
  currentPdfDoc = null;
}

/**
 * Renderiza una página del PDF
 */
async function renderPdfPage(pageNum) {
  if (!currentPdfDoc) return;

  try {
    const page = await currentPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: currentPdfScale });
    
    const container = document.getElementById('pdf-container');
    
    // Crear wrapper para cada página
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'pdf-page-wrapper';
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    pageWrapper.appendChild(canvas);
    container.appendChild(pageWrapper);
    
    // Si hay más páginas, renderizar la siguiente
    if (pageNum < currentPdfDoc.numPages) {
      renderPdfPage(pageNum + 1);
    }
  } catch (error) {
    console.error('Error rendering PDF page:', error);
  }
}

/**
 * Renderiza todas las páginas del PDF
 */
async function renderAllPdfPages() {
  if (!currentPdfDoc) return;

  const container = document.getElementById('pdf-container');
  container.innerHTML = '';

  for (let pageNum = 1; pageNum <= currentPdfDoc.numPages; pageNum++) {
    try {
      const page = await currentPdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentPdfScale });
      
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page-wrapper';
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      pageWrapper.appendChild(canvas);
      container.appendChild(pageWrapper);
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
    }
  }
}

/**
 * Aumenta el zoom del PDF
 */
function pdfZoomIn() {
  if (currentPdfScale < MAX_SCALE) {
    currentPdfScale += SCALE_STEP;
    updatePdfDisplay();
  }
}

/**
 * Disminuye el zoom del PDF
 */
function pdfZoomOut() {
  if (currentPdfScale > MIN_SCALE) {
    currentPdfScale -= SCALE_STEP;
    updatePdfDisplay();
  }
}

/**
 * Actualiza la visualización del PDF
 */
async function updatePdfDisplay() {
  const scalePercent = Math.round(currentPdfScale * 100);
  const display = document.getElementById('pdf-scale-display');
  
  if (display) {
    display.textContent = `${scalePercent}%`;
  }
  
  await renderAllPdfPages();
}

/**
 * Crea un adjunto de PDF en las notas
 */
function createPdfAttachment(file) {
  return {
    type: 'pdf',
    name: file.name,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    data: null // Se guardará el ArrayBuffer aquí
  };
}

/**
 * Agrega un PDF a las notas como adjunto
 */
async function addPdfToNote(noteId, file) {
  try {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      const attachment = createPdfAttachment(file);
      attachment.data = new Uint8Array(arrayBuffer);
      
      // Guardar en localStorage o en tu sistema de almacenamiento
      saveNoteAttachment(noteId, attachment);
      
      // Mostrar el adjunto en la UI
      displayNoteAttachment(noteId, attachment);
    };
    reader.readAsArrayBuffer(file);
  } catch (error) {
    console.error('Error adding PDF to note:', error);
  }
}

/**
 * Muestra un adjunto en la nota
 */
function displayNoteAttachment(noteId, attachment) {
  const noteElement = document.getElementById(`note-${noteId}`);
  if (!noteElement) return;

  const attachmentDiv = document.createElement('div');
  attachmentDiv.className = 'note-attachment';
  attachmentDiv.innerHTML = `
    <span class="note-attachment-icon">📎</span>
    <span class="note-attachment-name" title="${attachment.name}">${attachment.name}</span>
    <span class="note-attachment-remove" onclick="removePdfAttachment('${noteId}', '${attachment.name}')">✕</span>
  `;
  
  attachmentDiv.addEventListener('click', (e) => {
    if (!e.target.classList.contains('note-attachment-remove')) {
      viewPdfAttachment(noteId, attachment);
    }
  });
  
  const attachmentContainer = noteElement.querySelector('.note-attachments');
  if (attachmentContainer) {
    attachmentContainer.appendChild(attachmentDiv);
  }
}

/**
 * Visualiza un adjunto PDF
 */
async function viewPdfAttachment(noteId, attachment) {
  if (attachment.data) {
    openPdfViewer(attachment.name);
    await loadPdfFromArrayBuffer(attachment.data, attachment.name);
  }
}

/**
 * Elimina un adjunto PDF
 */
function removePdfAttachment(noteId, attachmentName) {
  // Implementar lógica de eliminación según tu sistema
  console.log(`Eliminar adjunto: ${attachmentName} de nota: ${noteId}`);
}

/**
 * Guarda un adjunto en el almacenamiento
 */
function saveNoteAttachment(noteId, attachment) {
  try {
    const notes = JSON.parse(localStorage.getItem('notas') || '{}');
    if (!notes[noteId]) {
      notes[noteId] = { attachments: [] };
    }
    notes[noteId].attachments = notes[noteId].attachments || [];
    notes[noteId].attachments.push({
      type: attachment.type,
      name: attachment.name,
      size: attachment.size,
      uploadedAt: attachment.uploadedAt
    });
    localStorage.setItem('notas', JSON.stringify(notes));
  } catch (error) {
    console.error('Error saving attachment:', error);
  }
}

/**
 * Obtiene los adjuntos de una nota
 */
function getNoteAttachments(noteId) {
  try {
    const notes = JSON.parse(localStorage.getItem('notas') || '{}');
    return notes[noteId]?.attachments || [];
  } catch (error) {
    console.error('Error getting attachments:', error);
    return [];
  }
}

// Inicializar cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
  initPdfUpload();
});
