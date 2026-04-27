// Módulo social eliminado - Study Space ya no está activo
// Este archivo se mantiene para compatibilidad pero no tiene funcionalidad social

window.SS = window.SS || {};

const DB = {
  // Funciones placeholder para evitar errores si algo intenta llamarlas
  async getMyGroups() { return []; },
  async createGroup() { return null; },
  async getGroupMembers() { return []; },
  async deleteGroup() { },
  async leaveGroup() { },
  async getMessages() { return []; },
  async sendMessage() { return null; },
  async deleteMessage() { },
  async getNotes() { return []; },
  async createNote() { return null; },
  async updateNote() { return null; },
  async deleteNote() { },
  async saveNoteHistory() { },
  async getNoteHistory() { return []; },
  async getAllGroupHistory() { return []; },
  async getTasks() { return []; },
  async createTask() { return null; },
  async updateTask() { return null; },
  async deleteTask() { },
  async getFiles() { return []; },
  async uploadFile() { return null; },
  async deleteFile() { },
  subscribeMessages() { return null; },
  subscribeNotes() { return null; },
  subscribeTasks() { return null; },
  unsubscribe() { }
};

// Canonical social DB namespace.
window.SS.SocialDB = DB;
// Backward-compatible alias.
window.SS.DB = DB;
