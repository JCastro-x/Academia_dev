// Social module data access (groups, messages, shared notes/files).

window.SS = window.SS || {};

const DB = {
  // ── Grupos ──────────────────────────────────────────────────

  async getMyGroups(userId) {
    const { data, error } = await SS.client
      .from('social_members')
      .select('role, social_groups(id, name, description, invite_code, created_by, created_at)')
      .eq('user_id', userId);
    if (error) throw error;
    return data.map(m => ({ ...m.social_groups, myRole: m.role }));
  },

  async createGroup(name, description, userId) {
    const { data: group, error } = await SS.client
      .from('social_groups')
      .insert({ name, description, created_by: userId })
      .select()
      .single();
    if (error) throw error;

    await SS.client.from('social_members').insert({
      group_id: group.id,
      user_id:  userId,
      role:     'admin'
    });

    return group;
  },

  async getGroupMembers(groupId) {
    const { data, error } = await SS.client
      .from('social_members')
      .select('role, joined_at, social_profiles!social_members_user_id_fkey(id, username, avatar_url)')
      .eq('group_id', groupId);
    if (error) throw error;
    return data.map(m => ({ ...m.social_profiles, role: m.role, joined_at: m.joined_at }));
  },

  async deleteGroup(groupId) {
    const { error } = await SS.client.from('social_groups').delete().eq('id', groupId);
    if (error) throw error;
  },

  async leaveGroup(groupId, userId) {
    const { error } = await SS.client
      .from('social_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id',  userId);
    if (error) throw error;
  },

  // ── Mensajes ─────────────────────────────────────────────────

  async getMessages(groupId, limit = 60) {
    const { data, error } = await SS.client
      .from('social_messages')
      .select('*, social_profiles!social_messages_user_id_fkey(username, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async sendMessage(groupId, userId, content) {
    const { data, error } = await SS.client
      .from('social_messages')
      .insert({ group_id: groupId, user_id: userId, content })
      .select('*, social_profiles!social_messages_user_id_fkey(username, avatar_url)')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteMessage(messageId) {
    const { error } = await SS.client.from('social_messages').delete().eq('id', messageId);
    if (error) throw error;
  },

  // ── Notas compartidas ────────────────────────────────────────

  async getNotes(groupId) {
    const { data, error } = await SS.client
      .from('social_notes')
      .select('*, social_profiles!social_notes_created_by_fkey(username)')
      .eq('group_id', groupId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createNote(groupId, userId, title = 'Nueva nota') {
    const { data, error } = await SS.client
      .from('social_notes')
      .insert({ group_id: groupId, created_by: userId, updated_by: userId, title })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateNote(noteId, updates, userId) {
    const { data, error } = await SS.client
      .from('social_notes')
      .update({ ...updates, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteNote(noteId) {
    const { error } = await SS.client.from('social_notes').delete().eq('id', noteId);
    if (error) throw error;
  },

  // ── Historial de notas ───────────────────────────────────────

  async saveNoteHistory(noteId, groupId, userId, snapshot, description) {
    const { error } = await SS.client.from('social_note_history').insert({
      note_id:     noteId,
      group_id:    groupId,
      user_id:     userId,
      snapshot,
      description: description || 'Editó la nota'
    });
    if (error) console.warn('Error guardando historial:', error);
  },

  async getNoteHistory(noteId) {
    const { data, error } = await SS.client
      .from('social_note_history')
      .select('*, social_profiles!social_note_history_user_id_fkey(username, avatar_url)')
      .eq('note_id', noteId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  },

  async getAllGroupHistory(groupId) {
    const { data, error } = await SS.client
      .from('social_note_history')
      .select('*, social_profiles!social_note_history_user_id_fkey(username, avatar_url), social_notes(title)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(80);
    if (error) throw error;
    return data;
  },

  // ── Tareas ───────────────────────────────────────────────────

  async getTasks(groupId) {
    const { data, error } = await SS.client
      .from('social_tasks')
      .select('*, assigned:social_profiles!social_tasks_assigned_to_fkey(username, avatar_url), creator:social_profiles!social_tasks_created_by_fkey(username)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createTask(groupId, userId, task) {
    const { data, error } = await SS.client
      .from('social_tasks')
      .insert({ group_id: groupId, created_by: userId, ...task })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTask(taskId, updates) {
    const { data, error } = await SS.client
      .from('social_tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTask(taskId) {
    const { error } = await SS.client.from('social_tasks').delete().eq('id', taskId);
    if (error) throw error;
  },

  // ── Archivos ─────────────────────────────────────────────────

  async getFiles(groupId) {
    // Excluimos la columna 'data' para evitar descargar base64 pesado
    // Solo solicitamos metadatos y la URL pública del Storage
    const { data, error } = await SS.client
      .from('social_files')
      .select('id, group_id, uploaded_by, name, file_type, storage_path, public_url, size, created_at, social_profiles!social_files_uploaded_by_fkey(username, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async uploadFile(groupId, userId, file) {
    // REQUISITO: Bucket 'social-files' debe existir en Supabase Storage
    // REQUISITO: Tabla social_files debe tener columnas: storage_path (text), public_url (text)
    // La columna 'data' ya no se usa (puede eliminarse en SQL)
    
    const ext = file.name.split('.').pop().toLowerCase();
    const fileType = ['pdf'].includes(ext) ? 'pdf'
                   : ['jpg','jpeg','png','gif','webp'].includes(ext) ? 'image'
                   : 'file';
    
    // Generar nombre único para evitar colisiones
    const timestamp = Date.now();
    const fileName = `${groupId}_${timestamp}_${file.name}`;
    const storagePath = `groups/${groupId}/${fileName}`;
    
    try {
      // Subir archivo a Supabase Storage
      const { data: uploadData, error: uploadError } = await SS.client
        .storage
        .from('social-files')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // Obtener URL pública del archivo
      const { data: urlData } = SS.client
        .storage
        .from('social-files')
        .getPublicUrl(storagePath);
      
      const publicUrl = urlData.publicUrl;
      
      // Guardar metadatos en la tabla (sin el base64)
      const { data, error } = await SS.client
        .from('social_files')
        .insert({
          group_id:    groupId,
          uploaded_by: userId,
          name:        file.name,
          file_type:   fileType,
          storage_path: storagePath,
          public_url:  publicUrl,
          size:        file.size
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error subiendo archivo a Storage:', error);
      throw error;
    }
  },

  async deleteFile(fileId) {
    // Primero obtener el storage_path para eliminar del Storage
    const { data: fileData, error: fetchError } = await SS.client
      .from('social_files')
      .select('storage_path')
      .eq('id', fileId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Eliminar archivo del Storage si existe storage_path
    if (fileData && fileData.storage_path) {
      const { error: storageError } = await SS.client
        .storage
        .from('social-files')
        .remove([fileData.storage_path]);
      
      if (storageError) {
        console.warn('⚠️ Error eliminando del Storage:', storageError);
        // Continuamos con la eliminación del registro aunque falle el Storage
      }
    }
    
    // Eliminar registro de la tabla
    const { error } = await SS.client.from('social_files').delete().eq('id', fileId);
    if (error) throw error;
  },

  // ── Realtime subscriptions ───────────────────────────────────

  subscribeMessages(groupId, onInsert, onDelete) {
    return SS.client
      .channel(`messages:${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_messages', filter: `group_id=eq.${groupId}` }, onInsert)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'social_messages', filter: `group_id=eq.${groupId}` }, onDelete)
      .subscribe();
  },

  subscribeNotes(groupId, callback) {
    return SS.client
      .channel(`notes:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_notes', filter: `group_id=eq.${groupId}` }, callback)
      .subscribe();
  },

  subscribeTasks(groupId, callback) {
    return SS.client
      .channel(`tasks:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_tasks', filter: `group_id=eq.${groupId}` }, callback)
      .subscribe();
  },

  unsubscribe(channel) {
    if (channel) SS.client.removeChannel(channel);
  }
};

// Canonical social DB namespace.
window.SS.SocialDB = DB;
// Backward-compatible alias.
window.SS.DB = DB;
