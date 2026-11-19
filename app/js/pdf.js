/* Generación de documentos PDF: certificado de paz y salvo y liquidación de haberes. */
(function () {
  'use strict';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const AZUL = [23, 52, 89], GRIS = [236, 240, 245], VERDE = [22, 120, 70], ROJO = [170, 30, 30];

  function fechaLarga(s) {
    if (!s) return '____________';
    const d = Calc.parseFecha(s);
    return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  }
  const money = (n) => '$ ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nombreCompleto = (t) => `${t.nombres || ''} ${t.apellidos || ''}`.trim();

  function nuevoDoc() {
    const { jsPDF } = window.jspdf;
    return new jsPDF({ unit: 'mm', format: 'a4' });
  }

  function encabezado(doc, exp, titulo, subtitulo) {
    const e = exp.empleador;
    doc.setDrawColor(...AZUL); doc.setLineWidth(0.6);
    doc.rect(15, 12, 180, 26);
    doc.setFillColor(...AZUL); doc.rect(15, 12, 40, 26, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    const iniciales = (e.razonSocial || 'EMPRESA').split(/\s+/).filter((w) => w.length > 2).slice(0, 3).map((w) => w[0]).join('').toUpperCase();
    doc.text(iniciales, 35, 27, { align: 'center' });
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('RUC ' + (e.ruc || ''), 35, 33, { align: 'center' });
    doc.setTextColor(...AZUL); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text((e.razonSocial || '').toUpperCase(), 125, 19, { align: 'center', maxWidth: 135 });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(80);
    doc.text(`${e.direccion || ''} · ${e.ciudad || ''} · ${e.telefono || ''}`, 125, 24, { align: 'center', maxWidth: 135 });
    doc.setDrawColor(200); doc.setLineWidth(0.2); doc.line(58, 26.5, 192, 26.5);
    doc.setTextColor(...AZUL); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(titulo, 125, 32.5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90);
    doc.text(subtitulo, 125, 36.5, { align: 'center' });
    doc.setTextColor(0);
    return 44;
  }

  function pie(doc, exp, etiqueta) {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(120); doc.setFont('helvetica', 'normal');
      doc.setDrawColor(200); doc.setLineWidth(0.2); doc.line(15, 285, 195, 285);
      doc.text(`${etiqueta} · Expediente ${exp.codigo} · Generado el ${new Date().toLocaleString('es-EC')}`, 15, 289);
      doc.text(`Página ${i} de ${n}`, 195, 289, { align: 'right' });
    }
    doc.setTextColor(0);
  }

  function marcaAgua(doc, texto) {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.12 }));
      doc.setTextColor(...ROJO); doc.setFont('helvetica', 'bold'); doc.setFontSize(40);
      doc.text(texto, 105, 170, { align: 'center', angle: 35 });
      doc.restoreGraphicsState();
    }
    doc.setTextColor(0);
  }

  function seccion(doc, y, texto) {
    doc.setFillColor(...AZUL); doc.rect(15, y, 180, 5.5, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(texto, 17, y + 3.9);
    doc.setTextColor(0);
    return y + 7;
  }

  function asegurarEspacio(doc, y, alto) {
    if (y + alto > 278) { doc.addPage(); return 20; }
    return y;
  }

  function firmas(doc, y, lista) {
    const ancho = 180 / lista.length;
    if (y + 26 > 282) { doc.addPage(); y = 20; }
    lista.forEach((f, i) => {
      const x = 15 + i * ancho, cx = x + ancho / 2;
      doc.setDrawColor(60); doc.setLineWidth(0.3);
      doc.line(x + 4, y + 14, x + ancho - 4, y + 14);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.text(f.rol, cx, y + 3, { align: 'center' });
      const nombre = doc.splitTextToSize(f.nombre || '', ancho - 6);
      doc.text(nombre, cx, y + 17.5, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.text(doc.splitTextToSize(f.cargo || '', ancho - 6), cx, y + 17.5 + nombre.length * 3.2, { align: 'center' });
    });
    return y + 27;
  }

  function tablaDatos(doc, y, pares) {
    const body = [];
    for (let i = 0; i < pares.length; i += 2) {
      const a = pares[i], b = pares[i + 1] || ['', ''];
      body.push([a[0], a[1], b[0], b[1]]);
    }
    doc.autoTable({
      startY: y, body, theme: 'grid', margin: { left: 15, right: 15 },
      styles: { fontSize: 8, cellPadding: 1.25, lineColor: [190, 198, 210], lineWidth: 0.2 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: GRIS, cellWidth: 32 }, 1: { cellWidth: 58 }, 2: { fontStyle: 'bold', fillColor: GRIS, cellWidth: 32 }, 3: { cellWidth: 58 } },
    });
    return doc.lastAutoTable.finalY + 4;
  }

  function parrafo(doc, y, texto, size) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size || 8.5);
    const lineas = doc.splitTextToSize(texto, 180);
    y = asegurarEspacio(doc, y, lineas.length * 4 + 3);
    // jsPDF ubica el texto por su línea base: se baja 3 mm para no tocar el bloque anterior.
    doc.text(lineas, 15, y + 3, { align: 'justify', maxWidth: 180, lineHeightFactor: 1.35 });
    return y + 3 + lineas.length * 4.1;
  }

  /* ---------- Certificado de paz y salvo ---------- */
  function certificadoPazSalvo(exp, cfg) {
    const doc = nuevoDoc();
    const t = exp.trabajador, e = exp.empleador;
    const aprobado = exp.pazSalvo.every((d) => d.estado === 'Aprobado');
    const fechaEmision = exp.pazSalvoFecha || Calc.iso(new Date());
    let y = encabezado(doc, exp, 'CERTIFICADO DE PAZ Y SALVO', `Para el pago de liquidación de haberes · N.º ${exp.codigo}-PYS`);
    doc.setFontSize(8.5); doc.text(`${e.ciudad || ''}, ${fechaLarga(fechaEmision)}`, 195, y, { align: 'right' });
    y = seccion(doc, y + 3, 'DATOS DEL TRABAJADOR');
    y = tablaDatos(doc, y, [
      ['Apellidos y nombres', `${t.apellidos} ${t.nombres}`], ['Cédula', t.cedula],
      ['Cargo', t.cargo], ['Departamento', t.departamento],
      ['Fecha de ingreso', fechaLarga(t.fechaIngreso)], ['Fecha de salida', fechaLarga(t.fechaSalida)],
      ['Causa de terminación', (Calc.CAUSAS[exp.terminacion.causa] || {}).nombre || ''], ['Jefe inmediato', t.jefeInmediato],
    ]);
    y = parrafo(doc, y, `Yo, ${nombreCompleto(t).toUpperCase()}, con cédula de ciudadanía N.º ${t.cedula}, quien desempeñó el cargo de ${t.cargo} en ${e.razonSocial}, declaro que he cumplido con los requisitos para la liquidación de mis haberes y he procedido a la entrega de los documentos, bienes e información que me fueron entregados para el cumplimiento de mis funciones, lo cual es certificado por los responsables de las unidades que se detallan a continuación.`);

    exp.pazSalvo.forEach((dep, idx) => {
      y = asegurarEspacio(doc, y, 40);
      y = seccion(doc, y, `${idx + 1}. ${dep.departamento.toUpperCase()}`);
      const marca = (r, v) => (r.valor === v ? 'X' : '');
      doc.autoTable({
        startY: y, theme: 'grid', margin: { left: 15, right: 15 },
        head: [['Requisito verificado', 'SÍ', 'NO', 'N/A']],
        body: dep.requisitos.map((r) => [r.texto, marca(r, 'SI'), marca(r, 'NO'), marca(r, 'NA')]),
        styles: { fontSize: 7.8, cellPadding: 1.4, lineColor: [190, 198, 210], lineWidth: 0.2 },
        headStyles: { fillColor: GRIS, textColor: 20, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'center', cellWidth: 13, fontStyle: 'bold' }, 2: { halign: 'center', cellWidth: 13, fontStyle: 'bold' }, 3: { halign: 'center', cellWidth: 13, fontStyle: 'bold' } },
      });
      y = doc.lastAutoTable.finalY;
      const color = dep.estado === 'Aprobado' ? VERDE : dep.estado === 'Observado' ? ROJO : [150, 110, 0];
      doc.autoTable({
        startY: y, theme: 'grid', margin: { left: 15, right: 15 },
        body: [[
          { content: `Responsable: ${dep.responsable || '—'}${dep.cargoResponsable ? ' (' + dep.cargoResponsable + ')' : ''}\nFecha de verificación: ${dep.fecha ? fechaLarga(dep.fecha) : '—'}\nObservaciones: ${dep.observaciones || 'Ninguna'}` },
          { content: `Estado: ${dep.estado.toUpperCase()}\n\n\n_______________________\nFirma y sello`, styles: { halign: 'center', textColor: color, fontStyle: 'bold' } },
        ]],
        styles: { fontSize: 7.5, cellPadding: 1.25, lineColor: [190, 198, 210], lineWidth: 0.2, minCellHeight: 18 },
        columnStyles: { 1: { cellWidth: 55 } },
      });
      y = doc.lastAutoTable.finalY + 4;
    });

    y = asegurarEspacio(doc, y, 70);
    y = seccion(doc, y, 'CERTIFICACIÓN');
    const texto = aprobado
      ? `Con base en las verificaciones realizadas por cada una de las unidades, el Departamento de Talento Humano de ${e.razonSocial} CERTIFICA que el/la señor(a) ${nombreCompleto(t).toUpperCase()} se encuentra a PAZ Y SALVO con la empresa, por lo que se autoriza el trámite de liquidación y pago de haberes. Se emite el presente certificado a petición de la parte interesada, para los fines legales pertinentes.`
      : 'El presente documento es un BORRADOR: existen unidades con requisitos pendientes u observados. No constituye certificado de paz y salvo ni autoriza el pago de la liquidación de haberes.';
    y = parrafo(doc, y, texto, 8.8);
    y = parrafo(doc, y, `${e.ciudad || ''}, ${fechaLarga(fechaEmision)}.`, 8.8);
    y += 4;
    firmas(doc, y, [
      { rol: 'TRABAJADOR(A)', nombre: nombreCompleto(t), cargo: 'C.C. ' + t.cedula },
      { rol: 'TALENTO HUMANO', nombre: cfg.responsableTH || '', cargo: cfg.cargoTH || 'Jefe(a) de Talento Humano' },
      { rol: 'REPRESENTANTE LEGAL', nombre: e.representante, cargo: e.cargoRepresentante },
    ]);
    if (!aprobado) marcaAgua(doc, 'BORRADOR · PAZ Y SALVO NO APROBADO');
    pie(doc, exp, 'Certificado de paz y salvo');
    return { blob: doc.output('blob'), aprobado };
  }

  /* ---------- Liquidación de haberes ---------- */
  function liquidacion(exp, cfg, res, vac) {
    const doc = nuevoDoc();
    const t = exp.trabajador, e = exp.empleador, l = exp.liquidacion;
    const ts = res.tiempo;
    let y = encabezado(doc, exp, 'LIQUIDACIÓN DE HABERES', `Acta de finiquito · N.º ${exp.codigo}-LIQ`);
    y = parrafo(doc, y, `Según lo solicitado por el Departamento de Talento Humano, se realiza el cálculo de la liquidación de haberes por terminación de la relación laboral del siguiente ex trabajador(a), de conformidad con el Código del Trabajo vigente:`);
    y = seccion(doc, y, 'DATOS DE LA RELACIÓN LABORAL');
    y = tablaDatos(doc, y, [
      ['Empleador', e.razonSocial], ['RUC', e.ruc],
      ['Trabajador(a)', `${t.apellidos} ${t.nombres}`], ['Cédula', t.cedula],
      ['Cargo', t.cargo], ['Departamento', t.departamento],
      ['Fecha de ingreso', fechaLarga(t.fechaIngreso)], ['Fecha de salida', fechaLarga(t.fechaSalida)],
      ['Tiempo de servicio', `${ts.anios} años, ${ts.meses} meses, ${ts.diasResto} días (${ts.dias} días)`], ['Última remuneración', money(t.sueldo)],
      ['Valor diario', money(res.valorDia)], ['SBU vigente', money(cfg.sbu)],
      ['Causa de terminación', res.causa.nombre], ['Base legal', res.causa.base],
    ]);

    y = asegurarEspacio(doc, y, 50);
    y = seccion(doc, y, 'INGRESOS (HABERES)');
    doc.autoTable({
      startY: y, theme: 'grid', margin: { left: 15, right: 15 },
      head: [['Concepto', 'Detalle del cálculo', 'Valor']],
      body: res.ingresos.map((i) => [i.concepto, i.detalle, money(i.valor)]),
      foot: [[{ content: 'TOTAL INGRESOS', colSpan: 2 }, money(res.totalIngresos)]],
      styles: { fontSize: 8, cellPadding: 1.25, lineColor: [190, 198, 210], lineWidth: 0.2 },
      headStyles: { fillColor: GRIS, textColor: 20 }, footStyles: { fillColor: GRIS, textColor: 20, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 62, fontStyle: 'bold' }, 2: { halign: 'right', cellWidth: 28 } },
      didParseCell: (h) => { if (h.section === 'foot' && h.column.index === 2) h.cell.styles.halign = 'right'; },
    });
    y = doc.lastAutoTable.finalY + 3;

    y = asegurarEspacio(doc, y, 30);
    y = seccion(doc, y, 'EGRESOS (DEDUCCIONES)');
    doc.autoTable({
      startY: y, theme: 'grid', margin: { left: 15, right: 15 },
      head: [['Concepto', 'Detalle', 'Valor']],
      body: res.egresos.length ? res.egresos.map((i) => [i.concepto, i.detalle, money(i.valor)]) : [['Sin deducciones', '', money(0)]],
      foot: [[{ content: 'TOTAL EGRESOS', colSpan: 2 }, money(res.totalEgresos)]],
      styles: { fontSize: 8, cellPadding: 1.25, lineColor: [190, 198, 210], lineWidth: 0.2 },
      headStyles: { fillColor: GRIS, textColor: 20 }, footStyles: { fillColor: GRIS, textColor: 20, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 62, fontStyle: 'bold' }, 2: { halign: 'right', cellWidth: 28 } },
      didParseCell: (h) => { if (h.section === 'foot' && h.column.index === 2) h.cell.styles.halign = 'right'; },
    });
    y = doc.lastAutoTable.finalY + 3;

    y = asegurarEspacio(doc, y, 24);
    doc.setFillColor(...AZUL); doc.rect(15, y, 180, 9, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.text('VALOR NETO A RECIBIR (INGRESOS - EGRESOS)', 18, y + 6);
    doc.text(money(res.neto), 192, y + 6, { align: 'right' });
    doc.setTextColor(0); y += 13;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    const son = doc.splitTextToSize('SON: ' + Calc.numeroALetras(res.neto), 180);
    doc.text(son, 15, y); y += son.length * 4 + 3;

    const obs = (l.observaciones || '').split('\n').map((s) => s.trim()).filter(Boolean);
    obs.push('Los décimos tercero y cuarto se calculan de forma proporcional al período de cálculo vigente (Arts. 111 y 113).');
    obs.push(`Vacaciones no gozadas liquidadas: ${vac.totalPendiente} días, según anexo de vacaciones (Arts. 69, 71 y 75).`);
    y = asegurarEspacio(doc, y, 10 + obs.length * 5);
    y = seccion(doc, y, 'OBSERVACIONES');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
    y += 2.5;
    obs.forEach((o) => {
      const ls = doc.splitTextToSize('• ' + o, 178);
      y = asegurarEspacio(doc, y, ls.length * 3.8);
      doc.text(ls, 17, y); y += ls.length * 3.4 + 0.5;
    });
    y += 2;
    y = parrafo(doc, y, `El/la trabajador(a) declara haber recibido a su entera satisfacción los valores detallados en la presente liquidación, sin tener nada más que reclamar al empleador por concepto de la relación laboral que mantuvieron. ${e.ciudad || ''}, ${fechaLarga(l.fechaLiquidacion)}.`, 8.2);
    firmas(doc, y, [
      { rol: 'ELABORADO', nombre: l.elaboradoPor, cargo: l.elaboradoCargo },
      { rol: 'REVISADO', nombre: l.revisadoPor, cargo: l.revisadoCargo },
      { rol: 'APROBADO', nombre: l.aprobadoPor, cargo: l.aprobadoCargo },
      { rol: 'RECIBÍ CONFORME', nombre: nombreCompleto(t), cargo: 'C.C. ' + t.cedula },
    ]);

    // Anexo de vacaciones
    doc.addPage();
    y = encabezado(doc, exp, 'ANEXO DE VACACIONES', `Control de vacaciones devengadas y gozadas · ${t.apellidos} ${t.nombres}`);
    y = tablaDatos(doc, y, [['Cédula', t.cedula], ['Cargo', t.cargo], ['Fecha de ingreso', fechaLarga(t.fechaIngreso)], ['Fecha de salida', fechaLarga(t.fechaSalida)]]);
    doc.autoTable({
      startY: y, theme: 'grid', margin: { left: 15, right: 15 },
      head: [['Período', 'Desde', 'Hasta', 'Días laborados', 'Derecho (días)', 'Devengados', 'Gozados', 'Saldo']],
      body: vac.periodos.map((p) => [p.n + (p.completo ? '' : ' (proporcional)'), p.desde, p.hasta, p.diasLaborados, p.derecho, p.devengados, p.gozados, p.saldo]),
      foot: [[{ content: 'VACACIONES PENDIENTES A LIQUIDAR (días)', colSpan: 7 }, vac.totalPendiente]],
      styles: { fontSize: 7.8, cellPadding: 1.5, halign: 'center', lineColor: [190, 198, 210], lineWidth: 0.2 },
      headStyles: { fillColor: AZUL, textColor: 255 }, footStyles: { fillColor: GRIS, textColor: 20, fontStyle: 'bold' },
    });
    y = doc.lastAutoTable.finalY + 6;
    y = parrafo(doc, y, `Nota: Art. 69 del Código del Trabajo: todo trabajador tiene derecho a gozar anualmente de quince días de descanso ininterrumpido y, desde el sexto año, de un día adicional por cada año excedente (máximo quince). Art. 71: la compensación se calcula con la veinticuatroava parte de lo percibido en el año. Art. 75: el trabajador puede acumular vacaciones no gozadas hasta por tres años. Valor liquidado: ${vac.totalPendiente} días x ${money(res.valorDia)} = ${money(Calc.r2(vac.totalPendiente * res.valorDia))}.`, 8);
    y += 6;
    firmas(doc, y, [
      { rol: 'ELABORADO', nombre: l.revisadoPor, cargo: l.revisadoCargo },
      { rol: 'APROBADO', nombre: l.aprobadoPor, cargo: l.aprobadoCargo },
    ]);
    pie(doc, exp, 'Liquidación de haberes');
    return doc.output('blob');
  }

  window.PDF = { certificadoPazSalvo, liquidacion, fechaLarga, money };
})();
