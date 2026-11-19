/* Motor de cálculo de liquidación laboral – Código del Trabajo del Ecuador.
   Funciones puras: no dependen del navegador, se pueden probar con Node. */
(function (root) {
  'use strict';

  const CAUSAS = {
    desahucio_trabajador: {
      nombre: 'Desahucio presentado por el trabajador (renuncia voluntaria)',
      base: 'Art. 169 num. 9, Art. 184 y Art. 185 del Código del Trabajo',
      bonificacionDesahucio: true, indemnizacionDespido: false,
    },
    despido_intempestivo: {
      nombre: 'Despido intempestivo',
      base: 'Art. 188 y Art. 185 del Código del Trabajo',
      bonificacionDesahucio: true, indemnizacionDespido: true,
    },
    despido_ineficaz: {
      nombre: 'Despido ineficaz (mujer embarazada o dirigente sindical)',
      base: 'Art. 195.1 a 195.3 del Código del Trabajo',
      bonificacionDesahucio: true, indemnizacionDespido: true, recargoIneficaz: true,
    },
    visto_bueno_trabajador: {
      nombre: 'Visto bueno solicitado por el trabajador',
      base: 'Art. 173 y Art. 191 del Código del Trabajo',
      bonificacionDesahucio: false, indemnizacionDespido: true,
    },
    visto_bueno_empleador: {
      nombre: 'Visto bueno solicitado por el empleador',
      base: 'Art. 172 del Código del Trabajo',
      bonificacionDesahucio: false, indemnizacionDespido: false,
    },
    acuerdo_partes: {
      nombre: 'Acuerdo de las partes',
      base: 'Art. 169 num. 2 del Código del Trabajo',
      bonificacionDesahucio: false, indemnizacionDespido: false,
    },
    periodo_prueba: {
      nombre: 'Terminación dentro del período de prueba',
      base: 'Art. 15 del Código del Trabajo',
      bonificacionDesahucio: false, indemnizacionDespido: false,
    },
    conclusion_obra: {
      nombre: 'Conclusión de la obra, período de labor o servicios objeto del contrato',
      base: 'Art. 169 num. 3 del Código del Trabajo',
      bonificacionDesahucio: false, indemnizacionDespido: false,
    },
    muerte_trabajador: {
      nombre: 'Muerte o incapacidad permanente y total del trabajador',
      base: 'Art. 169 num. 5 del Código del Trabajo',
      bonificacionDesahucio: false, indemnizacionDespido: false,
    },
  };

  // Redondeo a centavos; toFixed(6) elimina errores de coma flotante (p. ej. 99.22499999 -> 99.225 -> 99.23).
  const r2 = (n) => Math.round(Number(Number(n).toFixed(6)) * 100) / 100;

  function parseFecha(s) {
    if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function iso(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function esUltimoDiaMes(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getDate() === 1;
  }
  function sumarDias(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function sumarAnios(d, n) { return new Date(d.getFullYear() + n, d.getMonth(), d.getDate()); }

  /* Días entre dos fechas (ambas incluidas) con año comercial de 360 días
     y meses de 30 días, como se usa en el cálculo de beneficios sociales. */
  function dias360(desde, hasta) {
    const a = parseFecha(desde), b = parseFecha(hasta);
    if (b < a) return 0;
    const d1 = Math.min(a.getDate(), 30);
    // El último día del mes cuenta como día 30 (incluye febrero).
    const d2 = esUltimoDiaMes(b) ? 30 : Math.min(b.getDate(), 30);
    return (b.getFullYear() - a.getFullYear()) * 360 + (b.getMonth() - a.getMonth()) * 30 + (d2 - d1) + 1;
  }

  function maxFecha(a, b) { return parseFecha(a) > parseFecha(b) ? parseFecha(a) : parseFecha(b); }

  /* Períodos de vacaciones contados desde la fecha de ingreso (Art. 69):
     15 días por año y, desde el sexto año, un día adicional por año (máx. 15). */
  function periodosVacaciones(fechaIngreso, fechaSalida, gozados) {
    gozados = gozados || [];
    const ingreso = parseFecha(fechaIngreso), salida = parseFecha(fechaSalida);
    const periodos = [];
    let k = 0;
    while (true) {
      const desde = sumarAnios(ingreso, k);
      if (desde > salida) break;
      const finCompleto = sumarDias(sumarAnios(ingreso, k + 1), -1);
      const completo = finCompleto <= salida;
      const hasta = completo ? finCompleto : salida;
      const adicionales = k + 1 > 5 ? Math.min(k + 1 - 5, 15) : 0;
      const derecho = 15 + adicionales;
      const dias = completo ? 360 : dias360(desde, hasta);
      const devengados = completo ? derecho : r2(derecho * dias / 360);
      const goz = Number(gozados[k] || 0);
      periodos.push({
        n: k + 1, desde: iso(desde), hasta: iso(hasta), completo, diasLaborados: dias,
        derecho, adicionales, devengados, gozados: goz, saldo: r2(devengados - goz),
      });
      k++;
    }
    const totalPendiente = r2(periodos.reduce((s, p) => s + p.saldo, 0));
    // Art. 75: se pueden acumular hasta tres períodos no gozados.
    const conSaldo = periodos.filter((p) => p.completo && p.saldo > 0).length;
    return { periodos, totalPendiente, alertaAcumulacion: conSaldo > 3 };
  }

  function tiempoServicio(fechaIngreso, fechaSalida) {
    const dias = dias360(fechaIngreso, fechaSalida);
    const anios = Math.floor(dias / 360);
    const meses = Math.floor((dias % 360) / 30);
    const d = dias % 30;
    return { dias, anios, meses, diasResto: d, aniosDecimal: dias / 360 };
  }

  function inicioPeriodoDecimoTercero(salida) {
    // Período de cálculo: 1 de diciembre al 30 de noviembre (Art. 111).
    const y = salida.getMonth() === 11 ? salida.getFullYear() : salida.getFullYear() - 1;
    return new Date(y, 11, 1);
  }
  function inicioPeriodoDecimoCuarto(salida, region) {
    // Sierra y Amazonía: 1 de agosto al 31 de julio. Costa y Galápagos: 1 de marzo al último día de febrero (Art. 113).
    const mesInicio = region === 'costa' ? 2 : 7;
    const y = salida.getMonth() >= mesInicio ? salida.getFullYear() : salida.getFullYear() - 1;
    return new Date(y, mesInicio, 1);
  }

  /* Calcula todos los rubros de la liquidación.
     d: { sueldo, fechaIngreso, fechaSalida, causa, region, sbu, aporteIess,
          diasSueldoPendiente, d13Mensualizado, d14Mensualizado, diasVacaciones,
          bonificacionProporcional, discapacidad, otrosIngresos[], deducciones[] } */
  function calcularLiquidacion(d) {
    const sueldo = Number(d.sueldo) || 0;
    const sbu = Number(d.sbu) || 482;
    const tasaIess = d.aporteIess == null ? 0.0945 : Number(d.aporteIess);
    const ingreso = parseFecha(d.fechaIngreso), salida = parseFecha(d.fechaSalida);
    const causa = CAUSAS[d.causa] || CAUSAS.acuerdo_partes;
    const ts = tiempoServicio(ingreso, salida);
    const valorDia = sueldo / 30;
    const ingresos = [], egresos = [];

    // 1. Remuneración pendiente de pago
    const diasPend = Number(d.diasSueldoPendiente) || 0;
    if (diasPend > 0) {
      ingresos.push({ codigo: 'sueldo', concepto: 'Remuneración pendiente', detalle: `${diasPend} días x $${r2(valorDia).toFixed(2)}`, valor: r2(valorDia * diasPend), aportable: true });
    }

    // 2. Décimo tercer sueldo proporcional
    const ini13 = maxFecha(inicioPeriodoDecimoTercero(salida), ingreso);
    const dias13 = dias360(ini13, salida);
    if (!d.d13Mensualizado) {
      ingresos.push({ codigo: 'd13', concepto: 'Décimo tercer sueldo proporcional', detalle: `${iso(ini13)} a ${iso(salida)}: ${dias13} días x sueldo / 360`, valor: r2(sueldo * dias13 / 360) });
    }

    // 3. Décimo cuarto sueldo proporcional
    const ini14 = maxFecha(inicioPeriodoDecimoCuarto(salida, d.region), ingreso);
    const dias14 = dias360(ini14, salida);
    if (!d.d14Mensualizado) {
      ingresos.push({ codigo: 'd14', concepto: 'Décimo cuarto sueldo proporcional', detalle: `${iso(ini14)} a ${iso(salida)}: ${dias14} días x SBU $${sbu.toFixed(2)} / 360`, valor: r2(sbu * dias14 / 360) });
    }

    // 4. Vacaciones no gozadas
    const diasVac = Number(d.diasVacaciones) || 0;
    if (diasVac > 0) {
      ingresos.push({ codigo: 'vacaciones', concepto: 'Vacaciones no gozadas', detalle: `${diasVac} días x (sueldo x 12 / 360) $${r2(valorDia).toFixed(2)}`, valor: r2(valorDia * diasVac) });
    }

    // 5. Bonificación por desahucio (Art. 185): 25% de la última remuneración por año de servicio
    if (causa.bonificacionDesahucio) {
      const anios = d.bonificacionProporcional === false ? ts.anios : ts.aniosDecimal;
      ingresos.push({ codigo: 'desahucio', concepto: 'Bonificación por desahucio (Art. 185)', detalle: `25% x $${sueldo.toFixed(2)} x ${r2(anios)} años`, valor: r2(0.25 * sueldo * anios) });
    }

    // 6. Indemnización por despido intempestivo (Art. 188)
    if (causa.indemnizacionDespido) {
      const aniosCompletos = Math.ceil(ts.dias / 360); // la fracción de año se considera año completo
      const meses = ts.dias <= 3 * 360 ? 3 : Math.min(aniosCompletos, 25);
      ingresos.push({ codigo: 'despido', concepto: 'Indemnización por despido intempestivo (Art. 188)', detalle: ts.dias <= 3 * 360 ? 'Hasta 3 años de servicio: 3 remuneraciones' : `${meses} remuneraciones (una por año, fracción = año completo)`, valor: r2(sueldo * meses) });
      if (causa.recargoIneficaz) {
        ingresos.push({ codigo: 'ineficaz', concepto: 'Indemnización adicional por despido ineficaz (Art. 195.3)', detalle: '12 remuneraciones', valor: r2(sueldo * 12) });
      }
      if (d.discapacidad) {
        ingresos.push({ codigo: 'discapacidad', concepto: 'Indemnización por discapacidad (Art. 51 LOD)', detalle: '18 remuneraciones', valor: r2(sueldo * 18) });
      }
    }

    // 7. Otros ingresos registrados manualmente
    (d.otrosIngresos || []).forEach((o) => {
      if (Number(o.valor)) ingresos.push({ codigo: 'otro', concepto: o.concepto || 'Otro ingreso', detalle: o.aportable ? 'Sujeto a aporte IESS' : '', valor: r2(o.valor), aportable: !!o.aportable });
    });

    // Egresos: aporte personal IESS sobre rubros remunerativos pendientes
    const baseIess = ingresos.filter((i) => i.aportable).reduce((s, i) => s + i.valor, 0);
    if (baseIess > 0 && tasaIess > 0) {
      egresos.push({ codigo: 'iess', concepto: `Aporte personal IESS (${r2(tasaIess * 100)}%)`, detalle: `Base $${r2(baseIess).toFixed(2)}`, valor: r2(baseIess * tasaIess) });
    }
    (d.deducciones || []).forEach((o) => {
      if (Number(o.valor)) egresos.push({ codigo: 'otro', concepto: o.concepto || 'Otra deducción', detalle: '', valor: r2(o.valor) });
    });

    const totalIngresos = r2(ingresos.reduce((s, i) => s + i.valor, 0));
    const totalEgresos = r2(egresos.reduce((s, i) => s + i.valor, 0));
    return {
      causa, tiempo: ts, valorDia: r2(valorDia),
      periodos: { decimoTercero: { desde: iso(ini13), hasta: iso(salida), dias: dias13 }, decimoCuarto: { desde: iso(ini14), hasta: iso(salida), dias: dias14 } },
      ingresos, egresos, totalIngresos, totalEgresos, neto: r2(totalIngresos - totalEgresos),
    };
  }

  /* Validación de cédula ecuatoriana (módulo 10). */
  function validarCedula(c) {
    c = String(c || '').trim();
    if (!/^\d{10}$/.test(c)) return false;
    const prov = Number(c.slice(0, 2));
    if (prov < 1 || (prov > 24 && prov !== 30) || Number(c[2]) > 5) return false;
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let v = Number(c[i]) * (i % 2 === 0 ? 2 : 1);
      if (v > 9) v -= 9;
      suma += v;
    }
    return (10 - (suma % 10)) % 10 === Number(c[9]);
  }

  /* Número a letras para el valor neto ("CUATRO MIL ... CON 40/100 DÓLARES"). */
  function numeroALetras(n) {
    const U = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
    const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    function cientos(x) {
      if (x === 0) return '';
      if (x === 100) return 'CIEN';
      const c = Math.floor(x / 100), r = x % 100;
      let s = C[c];
      if (r) s += (s ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : ''));
      return s;
    }
    const unApocopado = (s) => s.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN');
    function entero(x) {
      if (x === 0) return 'CERO';
      const millones = Math.floor(x / 1e6), miles = Math.floor((x % 1e6) / 1000), resto = x % 1000;
      const partes = [];
      if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : unApocopado(cientos(millones)) + ' MILLONES');
      if (miles) partes.push(miles === 1 ? 'MIL' : unApocopado(cientos(miles)) + ' MIL');
      if (resto) partes.push(cientos(resto));
      return partes.join(' ');
    }
    const v = r2(Math.abs(n));
    const e = Math.floor(v), cent = Math.round((v - e) * 100);
    return `${entero(e)} CON ${String(cent).padStart(2, '0')}/100 DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA`;
  }

  const api = { CAUSAS, r2, dias360, tiempoServicio, periodosVacaciones, calcularLiquidacion, validarCedula, numeroALetras, parseFecha, iso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
