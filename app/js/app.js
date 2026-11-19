/* Interfaz: enrutamiento, vistas del expediente y acciones. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const vista = $('#vista');
  const S = { exp: null, evid: [], cfg: {} };
  const hoy = () => Calc.iso(new Date());
  const money = PDF.money;
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtFecha = (s) => (s ? PDF.fechaLarga(s) : '—');
  const fmtTam = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const CATEGORIAS = ['Datos del trabajador', 'Terminación', 'Paz y salvo', 'Vacaciones', 'Liquidación', 'Documentos generados'];
  const CFG_DEF = { sbu: 482, aporteIess: 9.45, responsableTH: '', cargoTH: 'Jefe(a) de Talento Humano', operador: '' };

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('ver');
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('ver'), 2600);
  }
  function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
  function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }

  function log(accion) {
    S.exp.bitacora.unshift({ fecha: new Date().toISOString(), usuario: S.cfg.operador || 'Sin identificar', accion });
  }
  async function guardar(accion) {
    if (accion) log(accion);
    await DB.guardarExpediente(S.exp);
  }

  function estadoExp(e) {
    if (e.cerrado) return 'Cerrado';
    if (e.liquidacionGenerada) return 'Liquidado';
    if (e.pazSalvo.length && e.pazSalvo.every((d) => d.estado === 'Aprobado')) return 'Paz y salvo aprobado';
    return 'En trámite';
  }
  function badgeEstado(est) {
    const c = { 'En trámite': 'b-pend', 'Paz y salvo aprobado': 'b-info', Liquidado: 'b-ok', Cerrado: 'b-ok', Pendiente: 'b-pend', Aprobado: 'b-ok', Observado: 'b-obs' }[est] || 'b-info';
    return `<span class="badge ${c}">${esc(est)}</span>`;
  }
  const avancePyS = (e) => ({ ok: e.pazSalvo.filter((d) => d.estado === 'Aprobado').length, total: e.pazSalvo.length });

  function datosCalculo(e) {
    const vac = Calc.periodosVacaciones(e.trabajador.fechaIngreso, e.trabajador.fechaSalida, e.vacaciones.gozados);
    const l = e.liquidacion;
    const res = Calc.calcularLiquidacion({
      sueldo: e.trabajador.sueldo, fechaIngreso: e.trabajador.fechaIngreso, fechaSalida: e.trabajador.fechaSalida,
      causa: e.terminacion.causa, region: e.empleador.region, sbu: S.cfg.sbu, aporteIess: S.cfg.aporteIess / 100,
      diasSueldoPendiente: l.diasSueldoPendiente, d13Mensualizado: l.d13Mensualizado, d14Mensualizado: l.d14Mensualizado,
      bonificacionProporcional: l.bonificacionProporcional, discapacidad: l.discapacidad,
      diasVacaciones: vac.totalPendiente, otrosIngresos: l.otrosIngresos, deducciones: l.deducciones,
    });
    return { vac, res };
  }
  const fechasValidas = (t) => t.fechaIngreso && t.fechaSalida && t.fechaSalida >= t.fechaIngreso;

  /* ---------------- Router ---------------- */
  async function router() {
    S.cfg = Object.assign({}, CFG_DEF, await DB.leerConfig('parametros', {}));
    $('#operador').value = S.cfg.operador || '';
    const partes = location.hash.replace(/^#\/?/, '').split('/');
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('activo', a.dataset.nav === (partes[0] || 'inicio')));
    if (partes[0] === 'exp' && partes[1]) return vistaExpediente(partes[1], partes[2] || 'datos');
    if (partes[0] === 'nuevo') return crearExpediente(false);
    if (partes[0] === 'config') return vistaConfig();
    if (partes[0] === 'ayuda') return vistaAyuda();
    return vistaInicio();
  }
  window.addEventListener('hashchange', router);

  async function siguienteCodigo() {
    const n = (await DB.leerConfig('secuencia', 0)) + 1;
    await DB.guardarConfig('secuencia', n);
    return `EXP-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
  }
  async function crearExpediente(demo) {
    const codigo = await siguienteCodigo();
    S.exp = demo ? Demo.casoHipotetico(codigo) : Demo.expedienteVacio(codigo);
    if (demo === 'completo') return completarCasoHipotetico();
    await guardar(demo ? 'Expediente creado con los datos del caso hipotético' : 'Expediente creado');
    location.hash = `#/exp/${S.exp.id}/datos`;
  }

  /* Caso hipotético completo: paz y salvo aprobado, evidencias adjuntas, PDF generados y bitácora. */
  async function completarCasoHipotetico() {
    const e = S.exp;
    if (!S.cfg.responsableTH) {
      Object.assign(S.cfg, { responsableTH: 'Psic. Andrea Carolina Mejía Salazar', cargoTH: 'Jefa de Talento Humano' });
      await DB.guardarConfig('parametros', S.cfg);
    }
    Demo.completarPazSalvo(e);
    const evidencias = window.DEMO_EVIDENCIAS || [];
    for (const v of evidencias) {
      const bytes = Uint8Array.from(atob(v.b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: v.tipo });
      await DB.guardarEvidencia({ id: DB.uid(), expedienteId: e.id, categoria: v.categoria, refId: v.depIndex == null ? null : e.pazSalvo[v.depIndex].id, nombre: v.nombre, tipo: v.tipo, tamano: blob.size, blob, fecha: new Date(v.fecha).toISOString(), subidoPor: v.usuario });
    }
    S.evid = [];
    const cert = PDF.certificadoPazSalvo(e, S.cfg);
    await guardarGenerado(`${e.codigo}_Certificado_Paz_y_Salvo.pdf`, cert.blob);
    const { vac, res } = datosCalculo(e);
    await guardarGenerado(`${e.codigo}_Liquidacion_de_Haberes.pdf`, PDF.liquidacion(e, S.cfg, res, vac));
    e.liquidacionGenerada = true;
    e.bitacora = Demo.bitacoraCaso(e, evidencias);
    await guardar();
    toast(`Caso hipotético cargado: ${evidencias.length} evidencias y 2 documentos PDF`);
    location.hash = `#/exp/${e.id}/datos`;
  }

  /* ---------------- Inicio: listado y consulta ---------------- */
  async function vistaInicio() {
    const exps = (await DB.listarExpedientes()).sort((a, b) => b.creado.localeCompare(a.creado));
    const evs = await DB.todasEvidencias();
    const cuenta = (est) => exps.filter((e) => estadoExp(e) === est).length;
    const filas = exps.map((e) => {
      const a = avancePyS(e), t = e.trabajador;
      const nEv = evs.filter((v) => v.expedienteId === e.id).length;
      const texto = [e.codigo, t.nombres, t.apellidos, t.cedula, e.empleador.razonSocial, t.cargo, estadoExp(e)].join(' ').toLowerCase();
      return `<tr data-buscar="${esc(texto)}">
        <td><a href="#/exp/${e.id}/datos"><b>${esc(e.codigo)}</b></a></td>
        <td>${esc(t.apellidos)} ${esc(t.nombres)}<div class="ayuda">C.C. ${esc(t.cedula)}</div></td>
        <td>${esc(e.empleador.razonSocial)}</td>
        <td>${esc((Calc.CAUSAS[e.terminacion.causa] || {}).nombre || '')}</td>
        <td>${t.fechaSalida ? esc(t.fechaSalida) : '—'}</td>
        <td><div class="prog"><i style="width:${a.total ? (a.ok / a.total) * 100 : 0}%"></i></div><div class="ayuda">${a.ok}/${a.total} unidades</div></td>
        <td class="num">${nEv}</td>
        <td>${badgeEstado(estadoExp(e))}</td>
        <td><a class="btn sm sec" href="#/exp/${e.id}/datos">Abrir</a></td></tr>`;
    }).join('');
    vista.innerHTML = `
      <div class="entre"><div><h1>Expedientes de salida laboral</h1><p class="sub">Consulte, filtre y abra los expedientes de paz y salvo y liquidación.</p></div>
      <div class="acciones"><button class="btn sec" data-accion="crear-demo" title="Solo datos: el paz y salvo y las evidencias quedan pendientes para hacerlos en vivo">Caso hipotético (solo datos)</button><button class="btn sec" data-accion="crear-demo-completo" title="Todas las pestañas completas: paz y salvo aprobado, evidencias, PDF y bitácora">Cargar caso hipotético completo</button><a class="btn" href="#/nuevo">+ Nuevo expediente</a></div></div>
      <div class="stats">
        <div class="stat"><b>${exps.length}</b><span>Expedientes</span></div>
        <div class="stat"><b>${cuenta('En trámite')}</b><span>En trámite</span></div>
        <div class="stat"><b>${cuenta('Paz y salvo aprobado')}</b><span>Paz y salvo aprobado</span></div>
        <div class="stat"><b>${cuenta('Liquidado') + cuenta('Cerrado')}</b><span>Liquidados / cerrados</span></div>
      </div>
      <div class="card">
        <input id="buscar" placeholder="Buscar por código, nombre, cédula, empresa, cargo o estado…" style="margin-bottom:12px">
        ${exps.length ? `<table class="t"><thead><tr><th>Código</th><th>Trabajador</th><th>Empleador</th><th>Causa</th><th>Salida</th><th>Paz y salvo</th><th class="num">Evidencias</th><th>Estado</th><th></th></tr></thead><tbody>${filas}</tbody></table>`
        : '<div class="vacio">No hay expedientes registrados. Cree uno nuevo o cargue el caso hipotético.</div>'}
      </div>`;
    const b = $('#buscar');
    if (b) b.addEventListener('input', () => {
      const q = b.value.toLowerCase().trim();
      vista.querySelectorAll('tr[data-buscar]').forEach((tr) => { tr.style.display = tr.dataset.buscar.includes(q) ? '' : 'none'; });
    });
  }

  /* ---------------- Expediente ---------------- */
  const TABS = [['datos', '1. Empleador y trabajador'], ['terminacion', '2. Terminación'], ['pazysalvo', '3. Paz y salvo'], ['vacaciones', '4. Vacaciones'], ['liquidacion', '5. Liquidación'], ['evidencias', '6. Expediente digital'], ['bitacora', '7. Bitácora']];

  async function vistaExpediente(id, tab) {
    if (!S.exp || S.exp.id !== id) S.exp = await DB.obtenerExpediente(id);
    if (!S.exp) { vista.innerHTML = '<div class="vacio">Expediente no encontrado.</div>'; return; }
    S.evid = (await DB.listarEvidencias(id)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    S.tab = tab;
    const e = S.exp, t = e.trabajador, a = avancePyS(e);
    const datosOk = t.nombres && t.cedula && e.empleador.razonSocial && fechasValidas(t) && Number(t.sueldo) > 0;
    const paso = (ok, medio, txt) => `<div class="paso ${ok ? 'ok' : medio ? 'medio' : ''}">${txt}</div>`;
    const tieneDoc = (n) => S.evid.some((v) => v.categoria === 'Documentos generados' && v.nombre.includes(n));
    vista.innerHTML = `
      <div class="cab-exp">
        <div class="entre">
          <div><a href="#/" class="ayuda">← Expedientes</a><h1>${esc(e.codigo)} · ${esc(t.apellidos || 'Sin nombre')} ${esc(t.nombres)}</h1>
          <div class="ayuda">${esc(e.empleador.razonSocial || 'Empleador sin registrar')} · ${esc(t.cargo || '')} · Creado ${fmtFecha(e.creado.slice(0, 10))}</div></div>
          <div class="acciones">${badgeEstado(estadoExp(e))}
            <button class="btn sm sec" data-accion="exportar-zip">Descargar expediente (ZIP)</button>
            ${e.cerrado ? '<button class="btn sm sec" data-accion="reabrir-exp">Reabrir</button>' : '<button class="btn sm sec" data-accion="cerrar-exp">Cerrar expediente</button>'}
          </div>
        </div>
        <div class="pasos">
          ${paso(datosOk, false, 'Datos registrados')}
          ${paso(!!e.terminacion.causa && datosOk, false, 'Causa identificada')}
          ${paso(a.ok === a.total && a.total > 0, a.ok > 0, `Paz y salvo ${a.ok}/${a.total}`)}
          ${paso(tieneDoc('Paz_y_Salvo'), false, 'Certificado PDF')}
          ${paso(tieneDoc('Liquidacion'), false, 'Liquidación PDF')}
          ${paso(S.evid.filter((v) => v.categoria !== 'Documentos generados').length > 0, false, `Evidencias (${S.evid.length})`)}
        </div>
      </div>
      <div class="tabs">${TABS.map(([k, n]) => `<a href="#/exp/${e.id}/${k}" class="${k === tab ? 'activo' : ''}">${n}</a>`).join('')}</div>
      <div id="tab"></div>`;
    ({ datos: tabDatos, terminacion: tabTerminacion, pazysalvo: tabPazSalvo, vacaciones: tabVacaciones, liquidacion: tabLiquidacion, evidencias: tabEvidencias, bitacora: tabBitacora }[tab] || tabDatos)($('#tab'));
  }
  const recargar = () => vistaExpediente(S.exp.id, S.tab);

  function campo(path, etiqueta, opts) {
    opts = opts || {};
    const v = getPath(S.exp, path);
    const attrs = `data-b="${path}" data-t="${opts.tipo === 'number' ? 'num' : 'txt'}" ${opts.req ? 'required' : ''}`;
    let input;
    if (opts.select) input = `<select ${attrs}>${opts.select.map(([k, n]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    else if (opts.area) input = `<textarea ${attrs}>${esc(v)}</textarea>`;
    else input = `<input type="${opts.tipo || 'text'}" ${opts.step ? `step="${opts.step}"` : ''} ${opts.id ? `id="${opts.id}"` : ''} value="${esc(v)}" ${attrs} ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''}>`;
    return `<div ${opts.span ? 'style="grid-column:1/-1"' : ''}><label>${etiqueta}${opts.req ? ' *' : ''}</label>${input}${opts.ayuda ? `<div class="ayuda" ${opts.ayudaId ? `id="${opts.ayudaId}"` : ''}>${opts.ayuda}</div>` : ''}</div>`;
  }

  function uploader(categoria, refId, titulo) {
    const lista = S.evid.filter((v) => v.categoria === categoria && (refId == null || v.refId === refId));
    return `<div class="evid"><label>${esc(titulo || 'Evidencias adjuntas')} (${lista.length})</label>
      <div class="evid-lista">${lista.map(chipArchivo).join('') || '<span class="ayuda">Sin archivos adjuntos.</span>'}</div>
      <div class="drop" data-cat="${esc(categoria)}" data-ref="${esc(refId || '')}">Arrastre aquí archivos PDF o imágenes, o haga clic para seleccionarlos
        <input type="file" accept="application/pdf,image/*" multiple hidden></div></div>`;
  }
  function chipArchivo(v) {
    const img = v.tipo.startsWith('image/');
    return `<div class="archivo"><span class="tipo ${img ? 'img' : ''}">${img ? 'IMG' : 'PDF'}</span>
      <span class="nombre" title="${esc(v.nombre)}">${esc(v.nombre)}</span><span class="ayuda">${fmtTam(v.tamano)}</span>
      <a data-accion="ver-ev" data-id="${v.id}">Ver</a><a data-accion="bajar-ev" data-id="${v.id}">Descargar</a>
      <button class="icono-x" title="Eliminar" data-accion="borrar-ev" data-id="${v.id}">×</button></div>`;
  }

  function tabDatos(el) {
    const ced = S.exp.trabajador.cedula;
    el.innerHTML = `<div class="grid2">
      <div class="card"><h2>Datos del empleador</h2><div class="grid">
        ${campo('empleador.razonSocial', 'Razón social', { req: true, span: true })}
        ${campo('empleador.ruc', 'RUC', { req: true })}
        ${campo('empleador.actividad', 'Actividad económica')}
        ${campo('empleador.direccion', 'Dirección', { span: true })}
        ${campo('empleador.ciudad', 'Ciudad')}${campo('empleador.provincia', 'Provincia')}
        ${campo('empleador.telefono', 'Teléfono')}${campo('empleador.correo', 'Correo electrónico')}
        ${campo('empleador.representante', 'Representante legal', { req: true })}${campo('empleador.cargoRepresentante', 'Cargo del representante')}
        ${campo('empleador.region', 'Régimen del décimo cuarto', { select: [['sierra', 'Sierra y Amazonía (ago – jul)'], ['costa', 'Costa y Galápagos (mar – feb)']], span: true })}
      </div></div>
      <div class="card"><h2>Datos del trabajador</h2><div class="grid">
        ${campo('trabajador.nombres', 'Nombres', { req: true })}${campo('trabajador.apellidos', 'Apellidos', { req: true })}
        ${campo('trabajador.cedula', 'Cédula de ciudadanía', { req: true, id: 'cedula', ayudaId: 'ced-ayuda', ayuda: ced ? (Calc.validarCedula(ced) ? '✔ Cédula válida' : '✖ Cédula no válida (dígito verificador)') : 'Se valida con el algoritmo módulo 10' })}
        ${campo('trabajador.telefono', 'Teléfono')}
        ${campo('trabajador.direccion', 'Dirección domiciliaria', { span: true })}
        ${campo('trabajador.correo', 'Correo electrónico')}${campo('trabajador.cargo', 'Cargo', { req: true })}
        ${campo('trabajador.departamento', 'Departamento')}${campo('trabajador.jefeInmediato', 'Jefe inmediato')}
        ${campo('trabajador.fechaIngreso', 'Fecha de ingreso', { tipo: 'date', req: true })}${campo('trabajador.fechaSalida', 'Fecha de salida (último día laborado)', { tipo: 'date', req: true })}
        ${campo('trabajador.sueldo', 'Última remuneración mensual (USD)', { tipo: 'number', step: '0.01', req: true })}
        ${campo('trabajador.tipoContrato', 'Tipo de contrato', { select: [['Indefinido', 'Indefinido'], ['Por obra o servicio', 'Por obra o servicio'], ['Eventual', 'Eventual'], ['Ocasional', 'Ocasional'], ['De temporada', 'De temporada'], ['Emprendimiento', 'Emprendimiento']] })}
        ${campo('trabajador.jornada', 'Jornada')}
      </div>
      ${fechasValidas(S.exp.trabajador) ? (() => { const ts = Calc.tiempoServicio(S.exp.trabajador.fechaIngreso, S.exp.trabajador.fechaSalida); return `<div class="aviso info" style="margin-top:12px">Tiempo de servicio: <b>${ts.anios} años, ${ts.meses} meses, ${ts.diasResto} días</b> (${ts.dias} días, año comercial de 360).</div>`; })() : ''}
      ${uploader('Datos del trabajador', null, 'Documentos personales y contractuales (contrato, cédula, roles)')}
      </div></div>`;
  }

  function tabTerminacion(el) {
    const c = Calc.CAUSAS[S.exp.terminacion.causa];
    const rubros = ['Remuneración pendiente', 'Décimo tercero proporcional', 'Décimo cuarto proporcional', 'Vacaciones no gozadas'];
    if (c.bonificacionDesahucio) rubros.push('Bonificación por desahucio: 25% de la última remuneración por año de servicio (Art. 185)');
    if (c.indemnizacionDespido) rubros.push('Indemnización por despido intempestivo (Art. 188)');
    if (c.recargoIneficaz) rubros.push('Indemnización adicional de un año de remuneración (Art. 195.3)');
    el.innerHTML = `<div class="grid2"><div class="card"><h2>Causa de terminación de la relación laboral</h2><div class="grid">
        ${campo('terminacion.causa', 'Causa (Art. 169 del Código del Trabajo)', { select: Object.entries(Calc.CAUSAS).map(([k, v]) => [k, v.nombre]), span: true })}
        ${campo('terminacion.fechaNotificacion', 'Fecha de notificación / presentación', { tipo: 'date' })}
        <div><label>Fecha de salida</label><input value="${esc(S.exp.trabajador.fechaSalida)}" disabled></div>
        ${campo('terminacion.detalle', 'Descripción de los hechos', { area: true, span: true })}
      </div>${uploader('Terminación', null, 'Documento de soporte (desahucio, renuncia, visto bueno, acta)')}</div>
      <div class="card"><h2>Efectos legales de la causa seleccionada</h2>
        <p><b>${esc(c.nombre)}</b><br><span class="ayuda">${esc(c.base)}</span></p>
        <label>Rubros que se incluyen en la liquidación</label><ul class="legal">${rubros.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        ${S.exp.terminacion.causa === 'desahucio_trabajador' ? '<div class="aviso info">El desahucio debe notificarse con al menos 15 días de anticipación (Art. 184). Durante ese plazo se elabora el acta de finiquito.</div>' : ''}
        ${c.indemnizacionDespido ? '<div class="aviso warn">Hasta 3 años de servicio: 3 remuneraciones. Más de 3 años: una remuneración por año, máximo 25. La fracción de año se considera año completo.</div>' : ''}
        ${S.exp.terminacion.causa === 'visto_bueno_empleador' ? '<div class="aviso warn">El visto bueno a favor del empleador no genera indemnización; solo se pagan los haberes pendientes.</div>' : ''}
      </div></div>`;
  }

  function tabPazSalvo(el) {
    const e = S.exp, a = avancePyS(e);
    el.innerHTML = `
      <div class="card entre"><div><h2 style="margin:0">Verificación de requisitos por unidad</h2>
        <div class="ayuda">Cada responsable marca SÍ / NO / N/A, adjunta la evidencia y aprueba su unidad. El certificado se emite cuando todas las unidades están aprobadas (${a.ok}/${a.total}).</div></div>
        <div class="acciones"><div style="width:170px">${campo('pazSalvoFecha', 'Fecha de emisión', { tipo: 'date' })}</div>
        <button class="btn ${a.ok === a.total ? 'verde' : ''}" data-accion="gen-pys">Generar certificado PDF</button></div></div>
      ${e.pazSalvo.map((d, i) => `
        <div class="depto" data-dep="${d.id}">
          <div class="depto-cab"><h3>${i + 1}. ${esc(d.departamento)}</h3>
            <div class="acciones">${badgeEstado(d.estado)}
              ${d.estado === 'Aprobado' ? `<button class="btn sm sec" data-accion="dep-estado" data-estado="Pendiente">Reabrir</button>`
                : `<button class="btn sm verde" data-accion="dep-estado" data-estado="Aprobado">Aprobar unidad</button><button class="btn sm rojo" data-accion="dep-estado" data-estado="Observado">Observar</button>`}
              <button class="icono-x" title="Quitar unidad" data-accion="dep-borrar">×</button></div></div>
          <div class="depto-cuerpo">
            ${d.requisitos.map((r) => `<div class="req"><span>${esc(r.texto)}</span>
              <div class="opciones">${[['SI', 'SÍ'], ['NO', 'NO'], ['NA', 'N/A']].map(([v, n]) => `<label class="${r.valor === v ? 'sel-' + v : ''}"><input type="radio" name="r-${r.id}" value="${v}" data-req="${r.id}" ${r.valor === v ? 'checked' : ''} ${d.estado === 'Aprobado' ? 'disabled' : ''}>${n}</label>`).join('')}</div>
              <button class="icono-x" title="Quitar requisito" data-accion="req-borrar" data-req="${r.id}" ${d.estado === 'Aprobado' ? 'disabled' : ''}>×</button></div>`).join('')}
            <div class="acciones" style="margin:8px 0 12px"><input placeholder="Agregar otro requisito para esta unidad…" class="nuevo-req" style="flex:1"><button class="btn sm sec" data-accion="req-agregar">Agregar</button></div>
            <div class="grid">
              <div><label>Responsable</label><input data-dc="responsable" value="${esc(d.responsable)}"></div>
              <div><label>Cargo del responsable</label><input data-dc="cargoResponsable" value="${esc(d.cargoResponsable)}"></div>
              <div><label>Fecha de verificación</label><input type="date" data-dc="fecha" value="${esc(d.fecha)}"></div>
              <div style="grid-column:1/-1"><label>Observaciones</label><textarea data-dc="observaciones">${esc(d.observaciones)}</textarea></div>
            </div>
            ${uploader('Paz y salvo', d.id, 'Evidencias de la unidad')}
          </div></div>`).join('')}
      <div class="card acciones"><input id="nuevo-dep" placeholder="Nombre de otra unidad o departamento…" style="flex:1"><button class="btn sec" data-accion="dep-agregar">Agregar unidad</button></div>`;
  }

  function tabVacaciones(el) {
    const t = S.exp.trabajador;
    if (!fechasValidas(t)) { el.innerHTML = '<div class="card vacio">Registre primero las fechas de ingreso y salida del trabajador.</div>'; return; }
    const { vac, res } = datosCalculo(S.exp);
    el.innerHTML = `<div class="card"><h2>Control de vacaciones</h2>
      <p class="ayuda">Períodos calculados desde la fecha de ingreso. Registre los días gozados en cada período. Derecho: 15 días por año; desde el sexto año, un día adicional por año (máx. 15). El último período se calcula proporcionalmente.</p>
      ${vac.alertaAcumulacion ? '<div class="aviso warn">Hay más de tres períodos con saldo. El Art. 75 permite acumular hasta tres años; revise con Talento Humano.</div>' : ''}
      <table class="t"><thead><tr><th>Período</th><th>Desde</th><th>Hasta</th><th class="num">Días laborados</th><th class="num">Derecho</th><th class="num">Devengados</th><th class="num" style="width:120px">Gozados</th><th class="num">Saldo</th></tr></thead>
      <tbody>${vac.periodos.map((p, i) => `<tr><td>${p.n}${p.completo ? '' : ' <span class="badge b-info">proporcional</span>'}</td><td>${p.desde}</td><td>${p.hasta}</td><td class="num">${p.diasLaborados}</td><td class="num">${p.derecho}</td><td class="num">${p.devengados}</td>
        <td class="num"><input type="number" min="0" step="0.5" value="${p.gozados}" data-goz="${i}" style="text-align:right"></td><td class="num"><b>${p.saldo}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="7">Vacaciones pendientes a liquidar</td><td class="num">${vac.totalPendiente} días</td></tr></tfoot></table>
      <div class="aviso info" style="margin-top:12px">Valor a liquidar: ${vac.totalPendiente} días × ${money(res.valorDia)} (sueldo × 12 / 360) = <b>${money(Calc.r2(vac.totalPendiente * res.valorDia))}</b></div>
      ${uploader('Vacaciones', null, 'Soportes de vacaciones (solicitudes, registro de vacaciones)')}</div>`;
  }

  function filasLista(tipo, lista, aportable) {
    return lista.map((o, i) => `<div class="lista-mini ${aportable ? 'tres' : ''}"><input data-lista="${tipo}" data-i="${i}" data-k="concepto" value="${esc(o.concepto)}" placeholder="Concepto">
      <input type="number" step="0.01" data-lista="${tipo}" data-i="${i}" data-k="valor" value="${esc(o.valor)}" placeholder="Valor" style="text-align:right">
      ${aportable ? `<label class="check"><input type="checkbox" data-lista="${tipo}" data-i="${i}" data-k="aportable" ${o.aportable ? 'checked' : ''}>IESS</label>` : ''}
      <button class="icono-x" data-accion="lista-borrar" data-lista="${tipo}" data-i="${i}">×</button></div>`).join('');
  }

  function tabLiquidacion(el) {
    const e = S.exp, t = e.trabajador;
    if (!fechasValidas(t) || !(Number(t.sueldo) > 0)) { el.innerHTML = '<div class="card vacio">Registre las fechas y la remuneración del trabajador para calcular la liquidación.</div>'; return; }
    const { vac, res } = datosCalculo(e);
    const pysOk = e.pazSalvo.every((d) => d.estado === 'Aprobado');
    const comparacion = Object.entries(Calc.CAUSAS).map(([k, c]) => {
      const r = Calc.calcularLiquidacion(Object.assign({}, { sueldo: t.sueldo, fechaIngreso: t.fechaIngreso, fechaSalida: t.fechaSalida, region: e.empleador.region, sbu: S.cfg.sbu, aporteIess: S.cfg.aporteIess / 100, diasVacaciones: vac.totalPendiente }, e.liquidacion, { causa: k }));
      return `<tr ${k === e.terminacion.causa ? 'style="background:#e4eefa;font-weight:700"' : ''}><td>${esc(c.nombre)}</td><td class="num">${money(r.totalIngresos)}</td><td class="num">${money(r.neto)}</td></tr>`;
    }).join('');
    el.innerHTML = `<div class="grid2">
      <div>
        <div class="card"><h2>Parámetros de la liquidación</h2><div class="grid">
          ${campo('liquidacion.diasSueldoPendiente', 'Días de remuneración pendientes', { tipo: 'number' })}
          ${campo('liquidacion.fechaLiquidacion', 'Fecha de la liquidación', { tipo: 'date' })}
          <label class="check"><input type="checkbox" data-b="liquidacion.d13Mensualizado" data-t="bool" ${e.liquidacion.d13Mensualizado ? 'checked' : ''}>Décimo tercero mensualizado</label>
          <label class="check"><input type="checkbox" data-b="liquidacion.d14Mensualizado" data-t="bool" ${e.liquidacion.d14Mensualizado ? 'checked' : ''}>Décimo cuarto mensualizado</label>
          <label class="check"><input type="checkbox" data-b="liquidacion.bonificacionProporcional" data-t="bool" ${e.liquidacion.bonificacionProporcional ? 'checked' : ''}>Desahucio con fracción de año</label>
          <label class="check"><input type="checkbox" data-b="liquidacion.discapacidad" data-t="bool" ${e.liquidacion.discapacidad ? 'checked' : ''}>Trabajador con discapacidad</label>
        </div></div>
        <div class="card"><div class="entre"><h2>Otros ingresos</h2><button class="btn sm sec" data-accion="lista-agregar" data-lista="otrosIngresos">+ Agregar</button></div>
          ${filasLista('otrosIngresos', e.liquidacion.otrosIngresos, true) || '<p class="ayuda">Horas extra, comisiones, bonos pendientes, etc.</p>'}
          <div class="entre" style="margin-top:14px"><h2>Deducciones</h2><button class="btn sm sec" data-accion="lista-agregar" data-lista="deducciones">+ Agregar</button></div>
          ${filasLista('deducciones', e.liquidacion.deducciones, false) || '<p class="ayuda">Anticipos, préstamos de la empresa, multas autorizadas, etc. El aporte IESS se calcula solo.</p>'}
        </div>
        <div class="card"><h2>Firmas y observaciones</h2><div class="grid">
          ${campo('liquidacion.elaboradoPor', 'Elaborado por')}${campo('liquidacion.elaboradoCargo', 'Cargo')}
          ${campo('liquidacion.revisadoPor', 'Revisado por')}${campo('liquidacion.revisadoCargo', 'Cargo')}
          ${campo('liquidacion.aprobadoPor', 'Aprobado por')}${campo('liquidacion.aprobadoCargo', 'Cargo')}
          ${campo('liquidacion.observaciones', 'Observaciones (una por línea)', { area: true, span: true })}
        </div>${uploader('Liquidación', null, 'Soportes de la liquidación (roles, anticipos, comprobante de pago)')}</div>
      </div>
      <div>
        <div class="card"><div class="entre"><h2>Detalle de la liquidación</h2><span class="badge b-info">${res.tiempo.anios} a, ${res.tiempo.meses} m, ${res.tiempo.diasResto} d</span></div>
          <table class="t"><thead><tr><th>Haberes</th><th>Cálculo</th><th class="num">Valor</th></tr></thead><tbody>
            ${res.ingresos.map((i) => `<tr><td><b>${esc(i.concepto)}</b></td><td class="ayuda">${esc(i.detalle)}</td><td class="num">${money(i.valor)}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="2">Total ingresos</td><td class="num">${money(res.totalIngresos)}</td></tr></tfoot></table>
          <table class="t" style="margin-top:12px"><thead><tr><th>Deducciones</th><th>Detalle</th><th class="num">Valor</th></tr></thead><tbody>
            ${res.egresos.map((i) => `<tr><td><b>${esc(i.concepto)}</b></td><td class="ayuda">${esc(i.detalle)}</td><td class="num">${money(i.valor)}</td></tr>`).join('') || '<tr><td colspan="3" class="ayuda">Sin deducciones</td></tr>'}</tbody>
            <tfoot><tr><td colspan="2">Total egresos</td><td class="num">${money(res.totalEgresos)}</td></tr></tfoot></table>
          <div class="total-neto" style="margin-top:14px"><div>Valor neto a recibir<small>${esc(Calc.numeroALetras(res.neto))}</small></div><div>${money(res.neto)}</div></div>
          ${pysOk ? '' : '<div class="aviso warn" style="margin-top:12px">El paz y salvo aún no está aprobado por todas las unidades. La liquidación solo puede emitirse con el paz y salvo aprobado.</div>'}
          <div class="acciones" style="margin-top:12px"><button class="btn ${pysOk ? 'verde' : ''}" data-accion="gen-liq">Generar liquidación PDF</button></div>
        </div>
        <div class="card"><h2>Comparación por causa de terminación</h2><p class="ayuda">Mismo trabajador y mismos parámetros, variando solo la causa.</p>
          <table class="t"><thead><tr><th>Causa</th><th class="num">Ingresos</th><th class="num">Neto</th></tr></thead><tbody>${comparacion}</tbody></table></div>
      </div></div>`;
  }

  function tabEvidencias(el) {
    const e = S.exp;
    const nombreDep = (id) => (e.pazSalvo.find((d) => d.id === id) || {}).departamento || 'Unidad eliminada';
    const grupos = CATEGORIAS.map((cat) => {
      const lista = S.evid.filter((v) => v.categoria === cat);
      return `<tr><td colspan="4" style="background:#f6f8fb"><b>${esc(cat)}</b> <span class="ayuda">(${lista.length})</span></td></tr>` +
        lista.map((v) => `<tr><td>${chipArchivo(v)}</td><td>${v.categoria === 'Paz y salvo' ? esc(nombreDep(v.refId)) : ''}</td><td>${esc(v.subidoPor)}</td><td style="white-space:nowrap">${new Date(v.fecha).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}</td></tr>`).join('');
    }).join('');
    const carpeta = `${e.codigo}_${(e.trabajador.apellidos || '').replace(/\s+/g, '_')}/\n├── 00_resumen_expediente.txt\n├── 01_datos_trabajador/\n├── 02_terminacion/\n├── 03_paz_y_salvo/\n${e.pazSalvo.map((d, i) => `│   ├── ${String(i + 1).padStart(2, '0')}_${d.departamento.replace(/\s+/g, '_')}/`).join('\n')}\n├── 04_vacaciones/\n├── 05_liquidacion/\n├── 06_documentos_generados/\n└── bitacora.txt`;
    el.innerHTML = `<div class="grid-ev"><div class="card"><div class="entre"><h2>Expediente digital y evidencias</h2><button class="btn sm" data-accion="exportar-zip">Descargar expediente (ZIP)</button></div>
        <table class="t t-ev"><thead><tr><th>Archivo</th><th>Unidad</th><th>Subido por</th><th>Fecha</th></tr></thead><tbody>${grupos}</tbody></table></div>
      <div><div class="card"><h2>Adjuntar evidencia</h2>
        <label>Categoría</label><select id="cat-ev">${CATEGORIAS.filter((c) => c !== 'Paz y salvo').map((c) => `<option>${c}</option>`).join('')}${e.pazSalvo.map((d) => `<option value="pys:${d.id}">Paz y salvo · ${esc(d.departamento)}</option>`).join('')}</select>
        <div style="margin-top:10px" class="drop" data-cat="__select__">Arrastre aquí o haga clic para seleccionar PDF o imágenes<input type="file" accept="application/pdf,image/*" multiple hidden></div></div>
      <div class="card"><h2>Organización del expediente</h2><p class="ayuda">Así se organiza el expediente al descargarlo en ZIP. En el sistema, cada archivo se guarda con su categoría, unidad, usuario y fecha.</p><div class="arbol">${esc(carpeta)}</div></div></div></div>`;
  }

  function tabBitacora(el) {
    el.innerHTML = `<div class="card"><h2>Bitácora de acciones</h2><div class="bitacora">${S.exp.bitacora.map((b) => `<div><time>${new Date(b.fecha).toLocaleString('es-EC')}</time><b>${esc(b.usuario)}</b> · ${esc(b.accion)}</div>`).join('') || '<p class="ayuda">Sin registros.</p>'}</div></div>`;
  }

  /* ---------------- Evidencias ---------------- */
  async function subirArchivos(files, categoria, refId) {
    let n = 0;
    for (const f of files) {
      if (!(f.type === 'application/pdf' || f.type.startsWith('image/'))) { toast(`"${f.name}" no es PDF ni imagen`); continue; }
      if (f.size > 20 * 1048576) { toast(`"${f.name}" supera 20 MB`); continue; }
      await DB.guardarEvidencia({ id: DB.uid(), expedienteId: S.exp.id, categoria, refId: refId || null, nombre: f.name, tipo: f.type, tamano: f.size, blob: f, fecha: new Date().toISOString(), subidoPor: S.cfg.operador || 'Sin identificar' });
      const dep = refId ? S.exp.pazSalvo.find((d) => d.id === refId) : null;
      log(`Evidencia adjuntada en ${categoria}${dep ? ' · ' + dep.departamento : ''}: ${f.name}`);
      n++;
    }
    await guardar();
    if (n) toast(`${n} archivo(s) adjuntado(s)`);
    recargar();
  }
  let urlModal = null;
  function verBlob(nombre, blob) {
    if (urlModal) URL.revokeObjectURL(urlModal);
    urlModal = URL.createObjectURL(blob);
    $('#modal-titulo').textContent = nombre;
    $('#modal-cuerpo').innerHTML = blob.type.startsWith('image/') ? `<img src="${urlModal}" alt="">` : `<iframe src="${urlModal}"></iframe>`;
    const a = $('#modal-descargar'); a.href = urlModal; a.download = nombre;
    $('#modal').classList.remove('oculto');
  }
  function descargarBlob(nombre, blob) {
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 3000);
  }
  async function guardarGenerado(nombre, blob) {
    for (const v of S.evid.filter((x) => x.categoria === 'Documentos generados' && x.nombre === nombre)) await DB.eliminarEvidencia(v.id);
    await DB.guardarEvidencia({ id: DB.uid(), expedienteId: S.exp.id, categoria: 'Documentos generados', refId: null, nombre, tipo: 'application/pdf', tamano: blob.size, blob, fecha: new Date().toISOString(), subidoPor: S.cfg.operador || 'Sistema' });
  }

  /* ---------------- ZIP del expediente ---------------- */
  async function exportarZip() {
    const e = S.exp, t = e.trabajador;
    const zip = new JSZip();
    const raiz = zip.folder(`${e.codigo}_${(t.apellidos || 'trabajador').replace(/\s+/g, '_')}`);
    const carpetaCat = { 'Datos del trabajador': '01_datos_trabajador', Terminación: '02_terminacion', 'Paz y salvo': '03_paz_y_salvo', Vacaciones: '04_vacaciones', Liquidación: '05_liquidacion', 'Documentos generados': '06_documentos_generados' };
    Object.values(carpetaCat).forEach((c) => raiz.folder(c));
    e.pazSalvo.forEach((d, i) => raiz.folder(`03_paz_y_salvo/${String(i + 1).padStart(2, '0')}_${d.departamento.replace(/\s+/g, '_')}`));
    for (const v of S.evid) {
      let ruta = carpetaCat[v.categoria] || '07_otros';
      if (v.categoria === 'Paz y salvo') {
        const i = e.pazSalvo.findIndex((d) => d.id === v.refId);
        ruta += i >= 0 ? `/${String(i + 1).padStart(2, '0')}_${e.pazSalvo[i].departamento.replace(/\s+/g, '_')}` : '/sin_unidad';
      }
      raiz.file(`${ruta}/${v.nombre}`, v.blob);
    }
    const { vac, res } = fechasValidas(t) && Number(t.sueldo) > 0 ? datosCalculo(e) : { vac: null, res: null };
    const resumen = [
      `EXPEDIENTE ${e.codigo} · Estado: ${estadoExp(e)}`, '',
      `Empleador: ${e.empleador.razonSocial} (RUC ${e.empleador.ruc})`,
      `Trabajador: ${t.apellidos} ${t.nombres} (C.C. ${t.cedula}) · ${t.cargo}`,
      `Ingreso: ${t.fechaIngreso} · Salida: ${t.fechaSalida} · Remuneración: ${money(t.sueldo)}`,
      `Causa: ${(Calc.CAUSAS[e.terminacion.causa] || {}).nombre}`, '', 'PAZ Y SALVO:',
      ...e.pazSalvo.map((d) => `  - ${d.departamento}: ${d.estado} · ${d.responsable} · ${d.fecha}`),
      '', 'LIQUIDACIÓN:',
      ...(res ? [...res.ingresos.map((i) => `  + ${i.concepto}: ${money(i.valor)}`), ...res.egresos.map((i) => `  - ${i.concepto}: ${money(i.valor)}`), `  NETO: ${money(res.neto)}`, `  Vacaciones pendientes: ${vac.totalPendiente} días`] : ['  Sin datos suficientes']),
    ].join('\r\n');
    raiz.file('00_resumen_expediente.txt', resumen);
    raiz.file('00_datos_expediente.json', JSON.stringify(e, null, 2));
    raiz.file('bitacora.txt', e.bitacora.map((b) => `${b.fecha}\t${b.usuario}\t${b.accion}`).join('\r\n'));
    const blob = await zip.generateAsync({ type: 'blob' });
    descargarBlob(`${e.codigo}_expediente.zip`, blob);
    await guardar('Expediente digital exportado en ZIP');
  }

  /* ---------------- Eventos ---------------- */
  vista.addEventListener('change', async (ev) => {
    const el = ev.target;
    if (el.dataset.b) {
      let v = el.dataset.t === 'bool' ? el.checked : el.value;
      if (el.dataset.t === 'num') v = el.value === '' ? '' : Number(el.value);
      setPath(S.exp, el.dataset.b, v);
      await guardar();
      if (['liquidacion', 'terminacion'].includes(S.tab)) recargar();
      if (S.tab === 'datos' && /fecha|cedula|sueldo/.test(el.dataset.b)) recargar();
      return;
    }
    if (el.dataset.req) {
      const dep = S.exp.pazSalvo.find((d) => d.id === el.closest('[data-dep]').dataset.dep);
      dep.requisitos.find((r) => r.id === el.dataset.req).valor = el.value;
      await guardar(); recargar(); return;
    }
    if (el.dataset.dc) {
      const dep = S.exp.pazSalvo.find((d) => d.id === el.closest('[data-dep]').dataset.dep);
      dep[el.dataset.dc] = el.value; await guardar(); return;
    }
    if (el.dataset.goz != null) {
      S.exp.vacaciones.gozados[Number(el.dataset.goz)] = Number(el.value) || 0;
      await guardar('Registro de vacaciones gozadas actualizado'); recargar(); return;
    }
    if (el.dataset.lista) {
      const o = S.exp.liquidacion[el.dataset.lista][Number(el.dataset.i)];
      o[el.dataset.k] = el.dataset.k === 'valor' ? Number(el.value) : el.dataset.k === 'aportable' ? el.checked : el.value;
      await guardar(); recargar(); return;
    }
    if (el.type === 'file' && el.files.length) {
      const drop = el.closest('.drop');
      let cat = drop.dataset.cat, ref = drop.dataset.ref || null;
      if (cat === '__select__') { const s = $('#cat-ev').value; if (s.startsWith('pys:')) { cat = 'Paz y salvo'; ref = s.slice(4); } else cat = s; }
      await subirArchivos([...el.files], cat, ref);
    }
  });
  vista.addEventListener('input', (ev) => {
    if (ev.target.id === 'cedula') {
      const v = ev.target.value, ok = Calc.validarCedula(v);
      ev.target.classList.toggle('invalido', v.length >= 10 && !ok);
      const a = $('#ced-ayuda'); if (a) a.textContent = ok ? '✔ Cédula válida' : '✖ Cédula no válida (dígito verificador)';
    }
  });
  vista.addEventListener('dragover', (ev) => { const d = ev.target.closest('.drop'); if (d) { ev.preventDefault(); d.classList.add('sobre'); } });
  vista.addEventListener('dragleave', (ev) => { const d = ev.target.closest('.drop'); if (d) d.classList.remove('sobre'); });
  vista.addEventListener('drop', async (ev) => {
    const d = ev.target.closest('.drop'); if (!d) return;
    ev.preventDefault(); d.classList.remove('sobre');
    let cat = d.dataset.cat, ref = d.dataset.ref || null;
    if (cat === '__select__') { const s = $('#cat-ev').value; if (s.startsWith('pys:')) { cat = 'Paz y salvo'; ref = s.slice(4); } else cat = s; }
    await subirArchivos([...ev.dataTransfer.files], cat, ref);
  });

  document.addEventListener('click', async (ev) => {
    const drop = ev.target.closest('.drop');
    if (drop && ev.target.tagName !== 'INPUT') { $('input[type=file]', drop).click(); return; }
    const b = ev.target.closest('[data-accion]'); if (!b) return;
    const acc = b.dataset.accion;
    const depEl = b.closest('[data-dep]');
    const dep = depEl && S.exp ? S.exp.pazSalvo.find((d) => d.id === depEl.dataset.dep) : null;
    switch (acc) {
      case 'cerrar-modal': $('#modal').classList.add('oculto'); $('#modal-cuerpo').innerHTML = ''; break;
      case 'crear-demo': await crearExpediente('datos'); break;
      case 'crear-demo-completo': await crearExpediente('completo'); break;
      case 'ver-ev': { const v = await DB.obtenerEvidencia(b.dataset.id); verBlob(v.nombre, v.blob); break; }
      case 'bajar-ev': { const v = await DB.obtenerEvidencia(b.dataset.id); descargarBlob(v.nombre, v.blob); break; }
      case 'borrar-ev': {
        if (b.dataset.confirmar !== '1') { b.dataset.confirmar = '1'; b.textContent = '¿Eliminar?'; b.style.color = 'var(--rojo)'; return; }
        const v = await DB.obtenerEvidencia(b.dataset.id); await DB.eliminarEvidencia(v.id);
        await guardar(`Evidencia eliminada: ${v.nombre}`); toast('Archivo eliminado'); recargar(); break;
      }
      case 'dep-estado': {
        const nuevo = b.dataset.estado;
        if (nuevo === 'Aprobado') {
          if (dep.requisitos.some((r) => !r.valor)) return toast('Marque SÍ, NO o N/A en todos los requisitos');
          if (dep.requisitos.some((r) => r.valor === 'NO')) return toast('Hay requisitos en NO: use "Observar" hasta que se subsanen');
          if (!dep.responsable) return toast('Registre el responsable de la unidad');
          if (!dep.fecha) dep.fecha = hoy();
        }
        if (nuevo === 'Observado' && !dep.observaciones) return toast('Escriba la observación antes de observar la unidad');
        dep.estado = nuevo;
        await guardar(`Paz y salvo · ${dep.departamento}: ${nuevo === 'Pendiente' ? 'reabierto' : nuevo.toLowerCase()} por ${dep.responsable || 'responsable'}`);
        toast(`${dep.departamento}: ${nuevo}`); recargar(); break;
      }
      case 'dep-borrar':
        if (b.dataset.confirmar !== '1') { b.dataset.confirmar = '1'; b.textContent = '¿Quitar?'; return; }
        S.exp.pazSalvo = S.exp.pazSalvo.filter((d) => d !== dep); await guardar(`Unidad quitada del paz y salvo: ${dep.departamento}`); recargar(); break;
      case 'dep-agregar': {
        const n = $('#nuevo-dep').value.trim(); if (!n) return;
        S.exp.pazSalvo.push({ id: DB.uid(), departamento: n, responsable: '', cargoResponsable: '', fecha: '', observaciones: '', estado: 'Pendiente', requisitos: [] });
        await guardar(`Unidad agregada al paz y salvo: ${n}`); recargar(); break;
      }
      case 'req-agregar': {
        const inp = $('.nuevo-req', depEl); if (!inp.value.trim()) return;
        dep.requisitos.push({ id: DB.uid(), texto: inp.value.trim(), valor: '' }); await guardar(); recargar(); break;
      }
      case 'req-borrar': dep.requisitos = dep.requisitos.filter((r) => r.id !== b.dataset.req); await guardar(); recargar(); break;
      case 'lista-agregar': S.exp.liquidacion[b.dataset.lista].push({ concepto: '', valor: 0, aportable: false }); await guardar(); recargar(); break;
      case 'lista-borrar': S.exp.liquidacion[b.dataset.lista].splice(Number(b.dataset.i), 1); await guardar(); recargar(); break;
      case 'gen-pys': {
        const r = PDF.certificadoPazSalvo(S.exp, S.cfg);
        const nombre = `${S.exp.codigo}_Certificado_Paz_y_Salvo${r.aprobado ? '' : '_BORRADOR'}.pdf`;
        await guardarGenerado(nombre, r.blob);
        await guardar(`Certificado de paz y salvo generado${r.aprobado ? '' : ' (borrador)'}`);
        await recargar(); verBlob(nombre, r.blob); break;
      }
      case 'gen-liq': {
        if (!S.exp.pazSalvo.every((d) => d.estado === 'Aprobado')) return toast('Primero apruebe el paz y salvo en todas las unidades');
        if (!S.exp.liquidacion.fechaLiquidacion) S.exp.liquidacion.fechaLiquidacion = hoy();
        const { vac, res } = datosCalculo(S.exp);
        const blob = PDF.liquidacion(S.exp, S.cfg, res, vac);
        const nombre = `${S.exp.codigo}_Liquidacion_de_Haberes.pdf`;
        await guardarGenerado(nombre, blob);
        S.exp.liquidacionGenerada = true;
        await guardar(`Liquidación de haberes generada · neto ${money(res.neto)}`);
        await recargar(); verBlob(nombre, blob); break;
      }
      case 'exportar-zip': await exportarZip(); toast('Expediente descargado'); break;
      case 'cerrar-exp': S.exp.cerrado = true; await guardar('Expediente cerrado'); recargar(); break;
      case 'reabrir-exp': S.exp.cerrado = false; await guardar('Expediente reabierto'); recargar(); break;
      case 'guardar-cfg': await guardarConfig(); break;
      case 'exportar-respaldo': await exportarRespaldo(); break;
      case 'borrar-todo':
        if (b.dataset.confirmar !== '1') { b.dataset.confirmar = '1'; b.textContent = 'Confirmar: borrar todos los datos'; return; }
        await DB.borrarTodo(); S.exp = null; toast('Datos eliminados'); location.hash = '#/'; break;
      case 'eliminar-exp': {
        if (b.dataset.confirmar !== '1') { b.dataset.confirmar = '1'; b.textContent = 'Confirmar eliminación'; return; }
        await DB.eliminarExpediente(b.dataset.id); toast('Expediente eliminado'); vistaConfig(); break;
      }
    }
  });
  $('#modal').addEventListener('click', (ev) => { if (ev.target.id === 'modal') { $('#modal').classList.add('oculto'); $('#modal-cuerpo').innerHTML = ''; } });
  $('#operador').addEventListener('change', async (ev) => { S.cfg.operador = ev.target.value; await DB.guardarConfig('parametros', S.cfg); toast('Operador actualizado'); });

  /* ---------------- Configuración y respaldo ---------------- */
  async function vistaConfig() {
    const exps = await DB.listarExpedientes();
    vista.innerHTML = `<h1>Parámetros y respaldo</h1><p class="sub">Valores usados en los cálculos y gestión de los datos guardados en este equipo.</p>
      <div class="grid2"><div class="card"><h2>Parámetros legales</h2><div class="grid">
        <div><label>Salario Básico Unificado (USD)</label><input id="c-sbu" type="number" step="0.01" value="${S.cfg.sbu}"><div class="ayuda">2026: USD 482 (Acuerdo MDT-2025-195)</div></div>
        <div><label>Aporte personal IESS (%)</label><input id="c-iess" type="number" step="0.01" value="${S.cfg.aporteIess}"></div>
        <div><label>Responsable de Talento Humano</label><input id="c-th" value="${esc(S.cfg.responsableTH)}"></div>
        <div><label>Cargo</label><input id="c-thc" value="${esc(S.cfg.cargoTH)}"></div>
      </div><div class="acciones" style="margin-top:12px"><button class="btn" data-accion="guardar-cfg">Guardar parámetros</button></div></div>
      <div class="card"><h2>Respaldo de datos</h2><p class="ayuda">Los expedientes y archivos se guardan en el navegador de este equipo (IndexedDB). Descargue un respaldo para llevarlos a otro equipo.</p>
        <div class="acciones"><button class="btn sec" data-accion="exportar-respaldo">Descargar respaldo (.json)</button>
        <label class="btn sec" style="margin:0;color:var(--azul)">Restaurar respaldo<input type="file" id="importar" accept=".json,application/json" hidden></label>
        <button class="btn rojo" data-accion="borrar-todo">Borrar todos los datos</button></div></div></div>
      <div class="card"><h2>Expedientes guardados</h2><table class="t"><tbody>${exps.map((e) => `<tr><td>${esc(e.codigo)}</td><td>${esc(e.trabajador.apellidos)} ${esc(e.trabajador.nombres)}</td><td>${badgeEstado(estadoExp(e))}</td><td><button class="btn sm rojo" data-accion="eliminar-exp" data-id="${e.id}">Eliminar</button></td></tr>`).join('') || '<tr><td class="ayuda">Sin expedientes</td></tr>'}</tbody></table></div>`;
    $('#importar').addEventListener('change', importarRespaldo);
  }
  async function guardarConfig() {
    Object.assign(S.cfg, { sbu: Number($('#c-sbu').value) || 482, aporteIess: Number($('#c-iess').value) || 0, responsableTH: $('#c-th').value, cargoTH: $('#c-thc').value });
    await DB.guardarConfig('parametros', S.cfg); toast('Parámetros guardados');
  }
  const blobABase64 = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
  async function exportarRespaldo() {
    const exps = await DB.listarExpedientes(), evs = await DB.todasEvidencias();
    const data = { version: 1, fecha: new Date().toISOString(), parametros: S.cfg, secuencia: await DB.leerConfig('secuencia', 0), expedientes: exps, evidencias: [] };
    for (const v of evs) data.evidencias.push(Object.assign({}, v, { blob: await blobABase64(v.blob) }));
    descargarBlob(`respaldo_pazysalvo_${hoy()}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
  }
  async function importarRespaldo(ev) {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      for (const e of data.expedientes) await DB.guardarExpediente(e);
      for (const v of data.evidencias) {
        v.blob = await (await fetch(v.blob)).blob();
        await DB.guardarEvidencia(v);
      }
      if (data.parametros) await DB.guardarConfig('parametros', data.parametros);
      if (data.secuencia) await DB.guardarConfig('secuencia', Math.max(data.secuencia, await DB.leerConfig('secuencia', 0)));
      toast(`Respaldo restaurado: ${data.expedientes.length} expedientes`); location.hash = '#/';
    } catch (err) { toast('El archivo no es un respaldo válido'); }
  }

  /* ---------------- Procedimiento y normativa ---------------- */
  function vistaAyuda() {
    const filas = [
      ['1', 'Recepción del documento de terminación (desahucio, renuncia, visto bueno, despido)', 'Talento Humano', 'Causa legal, fechas, plazo de 15 días en desahucio', 'Tiempo de servicio'],
      ['2', 'Apertura del expediente y registro de datos', 'Talento Humano', 'Cédula, RUC, contrato, remuneración', '—'],
      ['3', 'Informe final de labores y acta de entrega-recepción', 'Jefe inmediato', 'Entrega de cargo, archivos foliados, transferencia de información', '—'],
      ['4', 'Devolución de equipos y bloqueo de accesos', 'Tecnologías de la Información', 'Equipo, respaldo de información, cuentas', '—'],
      ['5', 'Devolución de bienes asignados', 'Bodega / Activos fijos', 'Activos, credencial, uniformes, llaves', '—'],
      ['6', 'Verificación de obligaciones económicas', 'Contabilidad y Finanzas', 'Anticipos, préstamos, caja chica, viáticos', 'Deducciones'],
      ['7', 'Control de vacaciones', 'Talento Humano', 'Días devengados vs. gozados por período', 'Vacaciones no gozadas'],
      ['8', 'Emisión del certificado de paz y salvo', 'Talento Humano / Gerencia', 'Todas las unidades aprobadas', '—'],
      ['9', 'Cálculo y emisión de la liquidación (acta de finiquito)', 'Contabilidad / Talento Humano / Gerencia', 'Paz y salvo aprobado', 'Haberes, deducciones, neto'],
      ['10', 'Pago, firmas y archivo del expediente; registro del acta en el SUT del Ministerio del Trabajo', 'Contabilidad / Talento Humano', 'Firmas, comprobante de pago', '—'],
    ];
    vista.innerHTML = `<h1>Procedimiento y normativa</h1><p class="sub">Flujo administrativo automatizado y fundamentos legales usados en los cálculos (Código del Trabajo del Ecuador).</p>
      <div class="card"><h2>Procedimiento de salida laboral</h2><table class="t"><thead><tr><th>#</th><th>Actividad / documento</th><th>Responsable</th><th>Verificación</th><th>Cálculo</th></tr></thead><tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="grid2"><div class="card legal"><h2>Fórmulas</h2><ul>
        <li><b>Valor diario:</b> remuneración mensual / 30 (año comercial de 360 días).</li>
        <li><b>Décimo tercero (Art. 111):</b> sueldo × días del período (1 dic – 30 nov) / 360.</li>
        <li><b>Décimo cuarto (Art. 113):</b> SBU × días del período / 360. Sierra y Amazonía: 1 ago – 31 jul. Costa y Galápagos: 1 mar – 28/29 feb.</li>
        <li><b>Vacaciones (Arts. 69, 71, 75):</b> 15 días por año + 1 adicional desde el sexto año (máx. 15). Saldo no gozado × valor diario. Acumulación máxima de tres años.</li>
        <li><b>Bonificación por desahucio (Art. 185):</b> 25% de la última remuneración × años de servicio.</li>
        <li><b>Despido intempestivo (Art. 188):</b> hasta 3 años: 3 remuneraciones; más de 3 años: una por año, máximo 25; la fracción se cuenta como año completo.</li>
        <li><b>Despido ineficaz (Art. 195.3):</b> lo del Art. 188 más un año de remuneración.</li>
        <li><b>Aporte personal IESS:</b> ${S.cfg.aporteIess}% sobre la remuneración pendiente y otros ingresos aportables.</li></ul></div>
      <div class="card legal"><h2>Causas de terminación (Art. 169)</h2><ul>${Object.values(Calc.CAUSAS).map((c) => `<li><b>${esc(c.nombre)}</b> — ${esc(c.base)}${c.bonificacionDesahucio ? ' · bonificación 25%' : ''}${c.indemnizacionDespido ? ' · indemnización Art. 188' : ''}</li>`).join('')}</ul>
      <div class="aviso info">El desahucio es el aviso del trabajador de dar por terminado el contrato (15 días de anticipación). El despido intempestivo es la terminación unilateral por parte del empleador sin causa legal.</div></div></div>`;
  }

  router();
})();
