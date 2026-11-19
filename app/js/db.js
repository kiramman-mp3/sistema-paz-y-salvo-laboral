/* Persistencia local con IndexedDB: expedientes, evidencias (archivos) y parámetros. */
(function () {
  'use strict';
  const NOMBRE = 'pazysalvo_db', VERSION = 1;
  let dbPromise = null;

  function abrir() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOMBRE, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('expedientes')) db.createObjectStore('expedientes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('evidencias')) {
          const s = db.createObjectStore('evidencias', { keyPath: 'id' });
          s.createIndex('expedienteId', 'expedienteId');
        }
        if (!db.objectStoreNames.contains('config')) db.createObjectStore('config', { keyPath: 'clave' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(store, modo, fn) {
    const db = await abrir();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, modo);
      const s = t.objectStore(store);
      let resultado;
      const r = fn(s);
      if (r) r.onsuccess = () => { resultado = r.result; };
      t.oncomplete = () => resolve(resultado);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  const DB = {
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    listarExpedientes: () => tx('expedientes', 'readonly', (s) => s.getAll()),
    obtenerExpediente: (id) => tx('expedientes', 'readonly', (s) => s.get(id)),
    guardarExpediente: (e) => { e.actualizado = new Date().toISOString(); return tx('expedientes', 'readwrite', (s) => s.put(e)); },
    async eliminarExpediente(id) {
      const evs = await DB.listarEvidencias(id);
      for (const ev of evs) await DB.eliminarEvidencia(ev.id);
      return tx('expedientes', 'readwrite', (s) => s.delete(id));
    },
    listarEvidencias: (expedienteId) => tx('evidencias', 'readonly', (s) => s.index('expedienteId').getAll(expedienteId)),
    obtenerEvidencia: (id) => tx('evidencias', 'readonly', (s) => s.get(id)),
    guardarEvidencia: (ev) => tx('evidencias', 'readwrite', (s) => s.put(ev)),
    eliminarEvidencia: (id) => tx('evidencias', 'readwrite', (s) => s.delete(id)),
    todasEvidencias: () => tx('evidencias', 'readonly', (s) => s.getAll()),
    async leerConfig(clave, porDefecto) {
      const r = await tx('config', 'readonly', (s) => s.get(clave));
      return r ? r.valor : porDefecto;
    },
    guardarConfig: (clave, valor) => tx('config', 'readwrite', (s) => s.put({ clave, valor })),
    async borrarTodo() {
      for (const st of ['expedientes', 'evidencias', 'config']) await tx(st, 'readwrite', (s) => s.clear());
    },
  };
  window.DB = DB;
})();
