/* Plantillas por defecto y caso hipotético (datos ficticios con fines académicos). */
(function () {
  'use strict';
  const req = (texto) => ({ id: DB.uid(), texto, valor: '' });

  function departamentosBase() {
    const d = (departamento, requisitos) => ({ id: DB.uid(), departamento, responsable: '', cargoResponsable: '', fecha: '', observaciones: '', estado: 'Pendiente', requisitos: requisitos.map(req) });
    return [
      d('Jefatura inmediata', [
        'Informe final de labores recibido por el jefe inmediato',
        'Acta de entrega-recepción del cargo y documentos a su cargo (físico y/o digital)',
        'Archivos físicos entregados y foliados',
        'Transferencia de información y tareas pendientes al reemplazo',
      ]),
      d('Tecnologías de la Información', [
        'Devolución de equipo de cómputo y periféricos asignados',
        'Respaldo de la información laboral entregado',
        'Bloqueo de usuario de red, correo institucional y sistemas',
      ]),
      d('Bodega y Activos Fijos', [
        'Devolución de bienes y activos fijos asignados',
        'Devolución de credencial, uniformes y llaves',
        'Sin herramientas ni suministros pendientes de devolución',
      ]),
      d('Contabilidad y Finanzas', [
        'Sin préstamos ni anticipos pendientes (o registrados para descuento)',
        'Caja chica o fondos a rendir liquidados',
        'Sin viáticos ni gastos pendientes de justificar',
      ]),
      d('Talento Humano', [
        'Documento de terminación de la relación laboral recibido',
        'Registro de vacaciones verificado',
        'Aviso de salida en el IESS registrado',
        'Expediente personal completo y actualizado',
      ]),
    ];
  }

  function expedienteVacio(codigo) {
    return {
      id: DB.uid(), codigo, creado: new Date().toISOString(), cerrado: false, liquidacionGenerada: false,
      empleador: { razonSocial: '', ruc: '', direccion: '', ciudad: '', provincia: '', telefono: '', correo: '', representante: '', cargoRepresentante: 'Gerente General', actividad: '', region: 'sierra' },
      trabajador: { nombres: '', apellidos: '', cedula: '', direccion: '', telefono: '', correo: '', cargo: '', departamento: '', jefeInmediato: '', fechaIngreso: '', fechaSalida: '', sueldo: '', tipoContrato: 'Indefinido', jornada: 'Completa (40 horas semanales)', afiliadoIess: true },
      terminacion: { causa: 'desahucio_trabajador', fechaNotificacion: '', detalle: '' },
      pazSalvo: departamentosBase(), pazSalvoFecha: '',
      vacaciones: { gozados: [] },
      liquidacion: { diasSueldoPendiente: 0, d13Mensualizado: false, d14Mensualizado: false, bonificacionProporcional: true, discapacidad: false, otrosIngresos: [], deducciones: [], observaciones: '', fechaLiquidacion: '', elaboradoPor: '', elaboradoCargo: 'Contador(a) General', revisadoPor: '', revisadoCargo: 'Jefe(a) de Talento Humano', aprobadoPor: '', aprobadoCargo: 'Gerente General' },
      bitacora: [],
    };
  }

  function casoHipotetico(codigo) {
    const e = expedienteVacio(codigo);
    Object.assign(e.empleador, {
      razonSocial: 'Comercializadora Andina del Centro S.A.', ruc: '1891745632001',
      direccion: 'Av. Los Guaytambos 05-120 y La Delicia', ciudad: 'Ambato', provincia: 'Tungurahua',
      telefono: '(03) 284-5312', correo: 'talentohumano@andinadelcentro-demo.ec',
      representante: 'Ing. Patricia Elena Villacís Ruiz', cargoRepresentante: 'Gerente General',
      actividad: 'Distribución mayorista de productos de consumo masivo', region: 'sierra',
    });
    Object.assign(e.trabajador, {
      nombres: 'Diego Fernando', apellidos: 'Sánchez Mora', cedula: '1803456787',
      direccion: 'Calle Quito 12-45 y Bolívar, Ambato', telefono: '0987654321', correo: 'diego.sanchez@correo-demo.ec',
      cargo: 'Analista de Sistemas', departamento: 'Tecnologías de la Información', jefeInmediato: 'Ing. Marco Antonio Lescano Paredes',
      fechaIngreso: '2022-02-01', fechaSalida: '2026-10-31', sueldo: 1050, tipoContrato: 'Indefinido', jornada: 'Completa (40 horas semanales)', afiliadoIess: true,
    });
    Object.assign(e.terminacion, {
      causa: 'desahucio_trabajador', fechaNotificacion: '2026-10-01',
      detalle: 'El trabajador presentó su desahucio por motivos personales (nueva oferta laboral) a través del Sistema Único de Trabajo del Ministerio del Trabajo el 1 de octubre de 2026, con más de 15 días de anticipación (Art. 184). El empleador fue notificado el 2 de octubre de 2026. Último día laborado: 31 de octubre de 2026.',
    });
    const resp = [
      ['Ing. Marco Antonio Lescano Paredes', 'Jefe de Tecnologías de la Información'],
      ['Tnlgo. Kevin Andrés Pazmiño Ríos', 'Técnico de Soporte y Seguridad Informática'],
      ['Sr. Luis Alberto Chicaiza Toapanta', 'Guardalmacén'],
      ['CPA Lucía Fernanda Naranjo Torres', 'Contadora General'],
      ['Psic. Andrea Carolina Mejía Salazar', 'Jefa de Talento Humano'],
    ];
    e.pazSalvo.forEach((d, i) => { d.responsable = resp[i][0]; d.cargoResponsable = resp[i][1]; });
    e.pazSalvoFecha = '2026-11-05';
    e.vacaciones.gozados = [15, 10, 8, 12, 0];
    Object.assign(e.liquidacion, {
      diasSueldoPendiente: 30,
      deducciones: [{ concepto: 'Anticipo de remuneración (15/10/2026)', valor: 200 }],
      observaciones: 'La remuneración de octubre de 2026 no fue pagada en rol y se incluye en la presente liquidación.\nEl anticipo de $200,00 entregado el 15 de octubre de 2026 se descuenta según autorización firmada por el trabajador.\nLos fondos de reserva se pagaron mensualmente en el rol de pagos, por lo que no se incluyen.',
      fechaLiquidacion: '2026-11-06',
      elaboradoPor: 'CPA Lucía Fernanda Naranjo Torres', elaboradoCargo: 'Contadora General',
      revisadoPor: 'Psic. Andrea Carolina Mejía Salazar', revisadoCargo: 'Jefa de Talento Humano',
      aprobadoPor: 'Ing. Patricia Elena Villacís Ruiz', aprobadoCargo: 'Gerente General',
    });
    return e;
  }

  /* Completa el paz y salvo del caso: todos los requisitos en SÍ y cada unidad aprobada. */
  const VERIFICACION = [
    ['2026-10-30', 'Informe recibido el 28/10/2026; archivos foliados 0001-0184.'],
    ['2026-10-31', 'Cuentas deshabilitadas el 31/10/2026 (ticket TI-2026-0981).'],
    ['2026-10-31', 'Bienes recibidos en buen estado.'],
    ['2026-11-04', 'Anticipo de USD 200,00 registrado para descuento en la liquidación.'],
    ['2026-11-05', 'Saldo de vacaciones: 26,25 días. Aviso de salida IESS registrado el 03/11/2026.'],
  ];
  const HORA_APROBACION = ['16:20', '17:20', '17:45', '11:10', '10:40'];

  function completarPazSalvo(e) {
    e.pazSalvo.forEach((d, i) => {
      d.requisitos.forEach((r) => { r.valor = 'SI'; });
      [d.fecha, d.observaciones] = VERIFICACION[i];
      d.estado = 'Aprobado';
    });
  }

  /* Bitácora con la cronología del caso (la más reciente primero). */
  function bitacoraCaso(e, evidencias) {
    const th = 'Psic. Andrea Carolina Mejía Salazar', cont = 'CPA Lucía Fernanda Naranjo Torres';
    const b = [
      ['2026-10-02T09:00:00', th, 'Expediente creado'],
      ['2026-10-02T09:15:00', th, 'Datos del empleador y del trabajador registrados; causa: desahucio presentado por el trabajador'],
    ];
    evidencias.forEach((v) => {
      const dep = v.depIndex == null ? '' : ' · ' + e.pazSalvo[v.depIndex].departamento;
      b.push([v.fecha, v.usuario, `Evidencia adjuntada en ${v.categoria}${dep}: ${v.nombre}`]);
    });
    e.pazSalvo.forEach((d, i) => b.push([`${d.fecha}T${HORA_APROBACION[i]}:00`, d.responsable, `Paz y salvo · ${d.departamento}: aprobado por ${d.responsable}`]));
    b.push(['2026-11-05T10:40:00', th, 'Registro de vacaciones gozadas actualizado']);
    b.push(['2026-11-05T11:00:00', th, 'Certificado de paz y salvo generado']);
    b.push(['2026-11-06T09:30:00', cont, 'Liquidación de haberes generada · neto $ 3,999.40']);
    return b.sort((x, y) => y[0].localeCompare(x[0])).map(([fecha, usuario, accion]) => ({ fecha: new Date(fecha).toISOString(), usuario, accion }));
  }

  window.Demo = { departamentosBase, expedienteVacio, casoHipotetico, completarPazSalvo, bitacoraCaso };
})();
