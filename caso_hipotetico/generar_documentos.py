"""Genera los documentos ficticios de respaldo del caso hipotético (uso académico)."""
import random
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Flowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

SALIDA = Path(__file__).parent / "documentos"
SALIDA.mkdir(exist_ok=True)

EMPRESA = "COMERCIALIZADORA ANDINA DEL CENTRO S.A."
RUC = "1891745632001"
DIR = "Av. Los Guaytambos 05-120 y La Delicia, Ambato - Tungurahua"
TRAB = "Diego Fernando Sánchez Mora"
CED = "1803456787"
AZUL = colors.HexColor("#173459")

st = getSampleStyleSheet()
P = ParagraphStyle("p", parent=st["Normal"], fontSize=10, leading=14.5, alignment=TA_JUSTIFY)
C = ParagraphStyle("c", parent=P, alignment=TA_CENTER)
T = ParagraphStyle("t", parent=st["Title"], fontSize=14, textColor=AZUL, spaceAfter=6)
PEQ = ParagraphStyle("peq", parent=P, fontSize=8, textColor=colors.grey, alignment=TA_CENTER)


def marca(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(AZUL)
    canvas.drawString(20 * mm, 285 * mm, EMPRESA)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.grey)
    canvas.drawString(20 * mm, 281 * mm, f"RUC {RUC} · {DIR}")
    canvas.line(20 * mm, 279 * mm, 190 * mm, 279 * mm)
    canvas.drawCentredString(105 * mm, 10 * mm, "DOCUMENTO FICTICIO ELABORADO CON FINES ACADÉMICOS · UTA · Guía APE 4")
    canvas.setFillColor(colors.Color(0.7, 0.1, 0.1, alpha=0.08))
    canvas.setFont("Helvetica-Bold", 60)
    canvas.translate(105 * mm, 140 * mm)
    canvas.rotate(35)
    canvas.drawCentredString(0, 0, "FICTICIO")
    canvas.restoreState()


def tabla(filas, anchos=None, cab=True):
    t = Table(filas, colWidths=anchos)
    estilo = [
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#b9c3d0")),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    if cab:
        estilo += [("BACKGROUND", (0, 0), (-1, 0), AZUL), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold")]
    t.setStyle(TableStyle(estilo))
    return t


TINTA = colors.HexColor("#1c2f80")
SELLO = colors.Color(0.35, 0.2, 0.65, alpha=0.75)
SELLOS = {
    "Gerente General": "GERENCIA GENERAL",
    "Jefa de Talento Humano": "TALENTO HUMANO",
    "Contadora General": "CONTABILIDAD",
    "Jefe de Tecnologías de la Información": "TECNOLOGÍAS DE LA INFORMACIÓN",
    "Técnico de Soporte y Seguridad Informática": "TECNOLOGÍAS DE LA INFORMACIÓN",
    "Guardalmacén": "BODEGA Y ACTIVOS FIJOS",
}


class Firma(Flowable):
    """Rúbrica simulada (trazos aleatorios estables por nombre) con sello opcional de la unidad."""

    def __init__(self, nombre, ancho, sello=None):
        super().__init__()
        self.nombre, self.ancho, self.sello = nombre, ancho, sello
        self.height = 17 * mm

    def wrap(self, aw, ah):
        return self.ancho, self.height

    def draw(self):
        c = self.canv
        rnd = random.Random(self.nombre)
        cx = self.ancho / 2
        if self.sello:
            c.saveState()
            c.translate(cx + 15 * mm, 9 * mm)
            c.rotate(rnd.uniform(-18, 18))
            c.setStrokeColor(SELLO)
            c.setFillColor(SELLO)
            c.setLineWidth(1.4)
            c.circle(0, 0, 12.5 * mm)
            c.setLineWidth(0.6)
            c.circle(0, 0, 10.8 * mm)
            c.setFont("Helvetica-Bold", 4.2)
            c.drawCentredString(0, 3.2 * mm, "COMERCIALIZADORA")
            c.drawCentredString(0, 1.2 * mm, "ANDINA DEL CENTRO")
            palabras = self.sello.split()
            c.setFont("Helvetica-Bold", 3.8)
            mitad = (len(palabras) + 1) // 2
            c.drawCentredString(0, -1.8 * mm, " ".join(palabras[:mitad]))
            c.drawCentredString(0, -3.6 * mm, " ".join(palabras[mitad:]))
            c.restoreState()
        c.saveState()
        c.setStrokeColor(TINTA)
        c.setLineWidth(0.9)
        x = cx - 16 * mm
        y = 5 * mm
        p = c.beginPath()
        p.moveTo(x, y)
        for _ in range(5):
            dx = rnd.uniform(4, 8) * mm
            p.curveTo(x + dx * 0.3, y + rnd.uniform(4, 11) * mm, x + dx * 0.7, y - rnd.uniform(2, 6) * mm, x + dx, y + rnd.uniform(-1.5, 2.5) * mm)
            x += dx
            y = 5 * mm + rnd.uniform(-1.5, 2.5) * mm
        p.curveTo(x + 4 * mm, y + 6 * mm, cx - 22 * mm, 2 * mm, cx + 12 * mm, 1.5 * mm)
        c.drawPath(p, stroke=1, fill=0)
        c.restoreState()


def firmas(*personas, sin_firma=()):
    ancho = 170 * mm / len(personas)
    fila = []
    for n, cargo in personas:
        celda = [] if n in sin_firma else [Firma(n, ancho - 4 * mm, SELLOS.get(cargo))]
        if n in sin_firma:
            celda.append(Spacer(1, 17 * mm))
        celda.append(Paragraph(f"______________________<br/><b>{n}</b><br/>{cargo}", C))
        fila.append(celda)
    t = Table([fila], colWidths=[ancho] * len(personas))
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return KeepTogether(t)


def pdf(nombre, titulo, cuerpo):
    doc = SimpleDocTemplate(str(SALIDA / nombre), pagesize=A4, topMargin=26 * mm, bottomMargin=18 * mm, leftMargin=20 * mm, rightMargin=20 * mm, title=titulo)
    doc.build([Paragraph(titulo, T), Spacer(1, 4)] + cuerpo, onFirstPage=marca, onLaterPages=marca)
    print("ok", nombre)


def par(*textos):
    out = []
    for t in textos:
        out += [Paragraph(t, P), Spacer(1, 6)]
    return out


GERENTE = ("Ing. Patricia Elena Villacís Ruiz", "Gerente General")
TH = ("Psic. Andrea Carolina Mejía Salazar", "Jefa de Talento Humano")
CONT = ("CPA Lucía Fernanda Naranjo Torres", "Contadora General")
JEFE = ("Ing. Marco Antonio Lescano Paredes", "Jefe de Tecnologías de la Información")
TI = ("Tnlgo. Kevin Andrés Pazmiño Ríos", "Técnico de Soporte y Seguridad Informática")
BOD = ("Sr. Luis Alberto Chicaiza Toapanta", "Guardalmacén")
YO = (TRAB, f"C.C. {CED}")

# 01 Contrato
pdf("01_Contrato_individual_de_trabajo.pdf", "CONTRATO INDIVIDUAL DE TRABAJO A TIEMPO INDEFINIDO", par(
    f"En la ciudad de Ambato, a los 31 días del mes de enero de 2022, comparecen, por una parte, <b>{EMPRESA}</b>, con RUC {RUC}, "
    f"representada legalmente por la {GERENTE[0]}, en calidad de EMPLEADOR; y, por otra parte, el señor <b>{TRAB.upper()}</b>, con cédula "
    f"de ciudadanía N.º {CED}, en calidad de TRABAJADOR, quienes libre y voluntariamente celebran el presente contrato al tenor de las siguientes cláusulas:",
    "<b>PRIMERA. – OBJETO:</b> El trabajador se compromete a prestar sus servicios lícitos y personales en el cargo de <b>ANALISTA DE SISTEMAS</b>, "
    "en el Departamento de Tecnologías de la Información, bajo la dependencia del Jefe de Tecnologías de la Información.",
    "<b>SEGUNDA. – JORNADA:</b> Ordinaria de 40 horas semanales, de lunes a viernes, de 08:00 a 17:00, con una hora de almuerzo (Art. 47 del Código del Trabajo).",
    "<b>TERCERA. – REMUNERACIÓN:</b> El empleador pagará una remuneración mensual de USD 980,00, más los beneficios sociales de ley. "
    "Los décimos tercero y cuarto se pagarán de forma acumulada en las fechas de ley, salvo solicitud expresa de mensualización. "
    "Los fondos de reserva se pagarán mensualmente a partir del segundo año de servicio.",
    "<b>CUARTA. – DURACIÓN:</b> El presente contrato es de tiempo indefinido e inicia el <b>1 de febrero de 2022</b>, con un período de prueba de noventa días (Art. 15).",
    "<b>QUINTA. – LUGAR DE TRABAJO:</b> Matriz de la empresa, ciudad de Ambato, provincia de Tungurahua.",
    "<b>SEXTA. – LEGISLACIÓN APLICABLE:</b> En lo no previsto, las partes se sujetan al Código del Trabajo y demás normativa vigente.",
) + [Spacer(1, 20), firmas(("Ing. Patricia Elena Villacís Ruiz", "EMPLEADOR"), (TRAB, "TRABAJADOR · C.C. " + CED))])

# 02 Desahucio
pdf("02_Desahucio_presentado_por_el_trabajador.pdf", "SOLICITUD DE DESAHUCIO · MINISTERIO DEL TRABAJO", [
    tabla([["Trámite SUT N.º", "MDT-DPTU-2026-DES-004512"], ["Fecha de presentación", "1 de octubre de 2026"], ["Dirección Regional", "Dirección Regional del Trabajo y Servicio Público de Ambato"]], [55 * mm, 115 * mm], cab=False),
    Spacer(1, 10)] + par(
    "Señor(a) Inspector(a) del Trabajo de Tungurahua:",
    f"Yo, <b>{TRAB.upper()}</b>, con cédula de ciudadanía N.º {CED}, de conformidad con lo dispuesto en el Art. 184 del Código del Trabajo, "
    f"comunico mi decisión de dar por terminada la relación laboral que mantengo con <b>{EMPRESA}</b>, RUC {RUC}, donde desempeño el cargo de "
    "Analista de Sistemas desde el 1 de febrero de 2022.",
    "Solicito se notifique al empleador con el presente desahucio, considerando que mi último día de trabajo será el <b>31 de octubre de 2026</b>, "
    "plazo que supera los quince días de anticipación previstos en la ley. Asimismo, solicito el pago de la bonificación prevista en el Art. 185 "
    "y de los haberes que me correspondan.",
    "Motivo: aceptación de una nueva oferta laboral (motivos personales).",
    "<b>Razón de notificación:</b> Notificado al empleador en su domicilio el 2 de octubre de 2026 a las 10:15, recibe: Psic. Andrea Carolina Mejía Salazar, Jefa de Talento Humano.",
) + [Spacer(1, 20), firmas(YO, ("Ab. Rodrigo Esteban Freire Castro", "Inspector del Trabajo (ficticio)"))])

# 03 Informe final de labores
pdf("03_Informe_final_de_labores.pdf", "INFORME FINAL DE LABORES", par(
    "Ambato, 28 de octubre de 2026",
    f"Para: {JEFE[0]}, {JEFE[1]}<br/>De: {TRAB}, Analista de Sistemas<br/>Asunto: Informe final de labores – período febrero 2022 a octubre 2026",
    "<b>1. Funciones desempeñadas:</b> administración del sistema de facturación electrónica, soporte a usuarios, mantenimiento de la base de datos de inventarios y desarrollo de reportes gerenciales.",
    "<b>2. Proyectos concluidos:</b> migración del ERP a la versión 2025; implementación de la facturación electrónica con el SRI; tablero de ventas por zona.",
    "<b>3. Tareas en curso y estado:</b> integración de la tienda en línea (avance 70 %, documentación entregada); actualización del manual de usuario del ERP (avance 90 %).",
    "<b>4. Información entregada:</b> credenciales de servicios transferidas al jefe del área, repositorio de código, respaldos y documentación técnica en la carpeta compartida TI/Traspaso_DSanchez.",
)
    + [Spacer(1, 12), Paragraph("<b>Recibido conforme por el jefe inmediato el 28 de octubre de 2026.</b>", P), Spacer(1, 16), firmas(YO, JEFE)])

# 04 Acta de entrega-recepción
pdf("04_Acta_entrega_recepcion_del_cargo.pdf", "ACTA DE ENTREGA – RECEPCIÓN DEL CARGO", par(
    f"En Ambato, a los 30 días del mes de octubre de 2026, se reúnen {TRAB} (entrega) y {JEFE[0]} (recibe), para la entrega-recepción del cargo de Analista de Sistemas:",
) + [tabla([
    ["N.º", "Documento / información", "Medio", "Folios", "Estado"],
    ["1", "Expedientes de soporte técnico 2022-2026", "Físico", "148", "Foliado"],
    ["2", "Manual técnico del ERP y diagramas", "Digital", "—", "Entregado"],
    ["3", "Contratos de licencias de software", "Físico", "36", "Foliado"],
    ["4", "Inventario de credenciales de servicios", "Digital cifrado", "—", "Entregado"],
    ["5", "Repositorio de código fuente y respaldos", "Digital", "—", "Entregado"],
], [12 * mm, 78 * mm, 30 * mm, 18 * mm, 32 * mm]), Spacer(1, 10)]
    + par("Las partes declaran que la información fue revisada y se encuentra completa. Archivos físicos foliados del 0001 al 0184.")
    + [Spacer(1, 16), firmas(("" + TRAB, "ENTREGA"), (JEFE[0], "RECIBE"))])

# 05 Acta de devolución de equipos TI
pdf("05_Acta_devolucion_equipos_TI.pdf", "ACTA DE DEVOLUCIÓN DE EQUIPOS INFORMÁTICOS", par(
    f"Fecha: 30 de octubre de 2026 · Trabajador: {TRAB} · C.C. {CED}") + [tabla([
    ["Código", "Equipo", "Marca / modelo", "Serie", "Estado"],
    ["TI-LAP-031", "Computador portátil", "Lenovo ThinkPad E14", "PF3K9X21", "Bueno"],
    ["TI-MON-044", "Monitor 24\"", "Samsung S24", "0X7HAB112", "Bueno"],
    ["TI-PER-102", "Teclado y mouse", "Logitech MK270", "2236LZ0", "Bueno"],
    ["TI-TOK-009", "Token de firma electrónica", "SafeNet 5110", "02A7C55", "Bueno"],
], [25 * mm, 40 * mm, 40 * mm, 30 * mm, 35 * mm]), Spacer(1, 10)] + par(
    "Se verificó el respaldo de la información laboral en el servidor de archivos (\\\\srv-files\\TI\\Traspaso_DSanchez, 18,4 GB). "
    "El 31 de octubre de 2026 a las 17:05 se deshabilitaron el usuario de dominio <i>dsanchez</i>, el correo institucional y los accesos al ERP y a la VPN.",
) + [Spacer(1, 16), firmas(YO, TI)])

# 06 Acta bodega
pdf("06_Acta_devolucion_bienes_bodega.pdf", "ACTA DE DEVOLUCIÓN DE BIENES Y ACTIVOS FIJOS", [tabla([
    ["Código", "Bien", "Cantidad", "Estado"],
    ["AF-MOB-220", "Escritorio modular con cajonera", "1", "Bueno"],
    ["AF-MOB-221", "Silla ergonómica", "1", "Bueno"],
    ["BOD-UNI-77", "Uniformes (camisas institucionales)", "3", "Usado"],
    ["BOD-CRE-15", "Credencial de identificación", "1", "Bueno"],
    ["BOD-LLA-08", "Juego de llaves de oficina y rack", "1", "Bueno"],
], [30 * mm, 80 * mm, 25 * mm, 35 * mm]), Spacer(1, 10)] + par(
    "Fecha de devolución: 31 de octubre de 2026. Se constata que el trabajador no mantiene herramientas ni suministros pendientes de devolución.",
) + [Spacer(1, 16), firmas(YO, BOD)])

# 07 Certificado contabilidad
pdf("07_Certificado_obligaciones_contabilidad.pdf", "CERTIFICADO DE OBLIGACIONES ECONÓMICAS", par(
    f"La Contadora General de {EMPRESA} CERTIFICA que, revisados los registros contables al 4 de noviembre de 2026, el señor {TRAB}, C.C. {CED}:",
    "1. Mantiene un <b>anticipo de remuneración de USD 200,00</b> entregado el 15 de octubre de 2026 (comprobante de egreso N.º 2026-1543), que será descontado en la liquidación según autorización firmada por el trabajador.",
    "2. No mantiene préstamos de la empresa, caja chica, fondos rotativos ni viáticos pendientes de justificar.",
    "3. La remuneración de octubre de 2026 no fue incluida en el rol mensual y deberá pagarse en la liquidación.",
    "Se emite el presente certificado para el trámite de paz y salvo.",
) + [Spacer(1, 16), firmas(CONT)])

# 08 Autorización de descuento del anticipo
pdf("08_Solicitud_anticipo_y_autorizacion_descuento.pdf", "SOLICITUD DE ANTICIPO Y AUTORIZACIÓN DE DESCUENTO", par(
    "Ambato, 14 de octubre de 2026",
    f"Yo, {TRAB}, C.C. {CED}, solicito un anticipo de mi remuneración por el valor de <b>USD 200,00</b> y autorizo expresamente que dicho valor "
    "sea descontado del rol de pagos de octubre de 2026 o, en caso de terminación de la relación laboral, de mi liquidación de haberes.",
    "Aprobado por Gerencia el 15 de octubre de 2026. Pagado por transferencia bancaria, comprobante de egreso N.º 2026-1543.",
) + [Spacer(1, 16), firmas(YO, GERENTE)])

# 09 Registro de vacaciones
pdf("09_Registro_de_vacaciones_gozadas.pdf", "REGISTRO DE VACACIONES GOZADAS", par(f"Trabajador: {TRAB} · C.C. {CED} · Fecha de ingreso: 1 de febrero de 2022") + [tabla([
    ["Período", "Desde", "Hasta", "Derecho", "Gozados", "Solicitudes aprobadas"],
    ["1", "01/02/2022", "31/01/2023", "15", "15", "SOL-VAC-2023-011 (15 días)"],
    ["2", "01/02/2023", "31/01/2024", "15", "10", "SOL-VAC-2024-018 (10 días)"],
    ["3", "01/02/2024", "31/01/2025", "15", "8", "SOL-VAC-2025-006 (5), SOL-VAC-2025-031 (3)"],
    ["4", "01/02/2025", "31/01/2026", "15", "12", "SOL-VAC-2026-004 (12 días)"],
    ["5", "01/02/2026", "31/10/2026", "11,25 (prop.)", "0", "—"],
], [16 * mm, 24 * mm, 24 * mm, 24 * mm, 18 * mm, 64 * mm]), Spacer(1, 10)] + par(
    "Saldo de vacaciones no gozadas al 31 de octubre de 2026: <b>26,25 días</b> (5 + 7 + 3 + 11,25 proporcionales).",
) + [Spacer(1, 16), firmas(TH)])

# 10 Aviso de salida IESS
pdf("10_Aviso_de_salida_IESS.pdf", "AVISO DE SALIDA DEL AFILIADO · IESS (SIMULADO)", [tabla([
    ["Campo", "Detalle"],
    ["RUC empleador", RUC], ["Razón social", EMPRESA], ["Cédula afiliado", CED], ["Nombres", TRAB.upper()],
    ["Fecha de ingreso", "01/02/2022"], ["Fecha de salida", "31/10/2026"], ["Motivo", "Desahucio presentado por el trabajador"],
    ["N.º de transacción", "AVS-2026-11-0004587"], ["Fecha de registro", "03/11/2026 09:42"],
], [55 * mm, 115 * mm])] + [Spacer(1, 10), Paragraph("Comprobante simulado con fines académicos. El registro real se realiza en el portal del IESS dentro de los 3 días siguientes a la salida.", PEQ)])

# 11 Rol de pagos
pdf("11_Rol_de_pagos_septiembre_2026.pdf", "ROL DE PAGOS · SEPTIEMBRE 2026", [tabla([
    ["Ingresos", "Valor", "Egresos", "Valor"],
    ["Sueldo (30 días)", "1.050,00", "Aporte personal IESS 9,45 %", "99,23"],
    ["Fondos de reserva (8,33 %)", "87,47", "", ""],
    ["Total ingresos", "1.137,47", "Total egresos", "99,23"],
    ["", "", "NETO RECIBIDO", "1.038,24"],
], [55 * mm, 30 * mm, 55 * mm, 30 * mm])] + [Spacer(1, 10)] + par(
    f"Trabajador: {TRAB} · Cargo: Analista de Sistemas · Remuneración vigente desde enero de 2026: USD 1.050,00. "
    "Se evidencia que los fondos de reserva se pagan mensualmente y que los décimos se pagan de forma acumulada.",
) + [Spacer(1, 16), firmas(CONT, YO)])

# Imágenes de evidencia
def imagen(nombre, titulo, lineas, color):
    img = Image.new("RGB", (1200, 800), "white")
    d = ImageDraw.Draw(img)
    try:
        fb = ImageFont.truetype("arialbd.ttf", 40)
        fn = ImageFont.truetype("arial.ttf", 28)
    except OSError:
        fb = fn = ImageFont.load_default()
    d.rectangle([0, 0, 1200, 110], fill=color)
    d.text((40, 32), titulo, fill="white", font=fb)
    y = 160
    for ln in lineas:
        d.text((60, y), ln, fill="#1d2733", font=fn)
        y += 52
    d.text((60, 740), "IMAGEN FICTICIA · USO ACADÉMICO", fill="#a91e1e", font=fn)
    img.save(SALIDA / nombre)
    print("ok", nombre)


imagen("12_Captura_bloqueo_de_cuentas.png", "Consola de administración de usuarios", [
    "Usuario: dsanchez (Diego Fernando Sánchez Mora)",
    "Correo institucional ........ DESHABILITADO",
    "Usuario de dominio .......... DESHABILITADO",
    "Acceso ERP / VPN ............ REVOCADO",
    "Fecha: 31/10/2026 17:05   Responsable: kpazmino",
    "Ticket: TI-2026-0981",
], "#24507f")
imagen("13_Foto_devolucion_credencial_y_llaves.png", "Registro de devolución en bodega", [
    "Credencial N.º BOD-CRE-15 ........ devuelta",
    "Llaves oficina y rack (BOD-LLA-08) devueltas",
    "Uniformes (3 camisas) ............ devueltos",
    "Recibe: Sr. Luis Alberto Chicaiza Toapanta",
    "Fecha: 31/10/2026",
], "#167846")

# 14 Solicitudes de vacaciones (una por página)
solicitudes = [
    ("SOL-VAC-2023-011", "2023-07-03", "2023-07-17", 15, "1 (2022-2023)"),
    ("SOL-VAC-2024-018", "2024-08-05", "2024-08-14", 10, "2 (2023-2024)"),
    ("SOL-VAC-2025-006", "2025-04-21", "2025-04-25", 5, "3 (2024-2025)"),
    ("SOL-VAC-2025-031", "2025-12-29", "2025-12-31", 3, "3 (2024-2025)"),
    ("SOL-VAC-2026-004", "2026-03-02", "2026-03-13", 12, "4 (2025-2026)"),
]
cuerpo = []
for i, (num, desde, hasta, dias, periodo) in enumerate(solicitudes):
    if i:
        cuerpo += [PageBreak(), Paragraph("SOLICITUD DE VACACIONES", T), Spacer(1, 4)]
    cuerpo += [tabla([
        ["Campo", "Detalle"], ["N.º de solicitud", num], ["Trabajador", f"{TRAB} · C.C. {CED}"], ["Cargo", "Analista de Sistemas"],
        ["Período de vacaciones", periodo], ["Desde", desde], ["Hasta", hasta], ["Días solicitados", str(dias)],
    ], [55 * mm, 115 * mm]), Spacer(1, 10)] + par(
        "Solicito se me concedan los días de vacaciones detallados, correspondientes al período indicado (Art. 69 del Código del Trabajo).",
        "Autorizado por el jefe inmediato y registrado por Talento Humano.",
    ) + [Spacer(1, 10), firmas(YO, JEFE, TH)]
pdf("14_Solicitudes_de_vacaciones_aprobadas.pdf", "SOLICITUD DE VACACIONES", cuerpo)

# 15 Ficha de verificación del expediente personal (Talento Humano)
pdf("15_Ficha_verificacion_expediente_personal.pdf", "FICHA DE VERIFICACIÓN DEL EXPEDIENTE PERSONAL", par(
    f"Trabajador: {TRAB} · C.C. {CED} · Fecha de verificación: 5 de noviembre de 2026") + [tabla([
    ["Documento del expediente", "Estado", "Observación"],
    ["Contrato individual de trabajo registrado en el SUT", "Completo", "Registro SUT 2022-02-03"],
    ["Hoja de vida y copias de títulos", "Completo", "—"],
    ["Aviso de entrada al IESS", "Completo", "01/02/2022"],
    ["Acciones de personal / incrementos salariales", "Completo", "Incremento a USD 1.050,00 (01/2026)"],
    ["Registro de vacaciones y solicitudes", "Completo", "26,25 días pendientes"],
    ["Documento de terminación (desahucio)", "Completo", "MDT-DPTU-2026-DES-004512"],
    ["Aviso de salida al IESS", "Completo", "AVS-2026-11-0004587"],
    ["Certificados de las unidades para el paz y salvo", "Completo", "5 de 5 unidades"],
], [80 * mm, 25 * mm, 65 * mm]), Spacer(1, 16), firmas(TH)])

# 16 Comprobante de egreso del pago de la liquidación (documento interno)
pdf("16_Comprobante_egreso_pago_liquidacion.pdf", "COMPROBANTE DE EGRESO N.º 2026-1621", [tabla([
    ["Campo", "Detalle"],
    ["Fecha", "10 de noviembre de 2026"], ["Beneficiario", f"{TRAB} · C.C. {CED}"],
    ["Concepto", "Pago de liquidación de haberes · Expediente EXP-2026-0001"],
    ["Forma de pago", "Transferencia bancaria a cuenta de ahorros del trabajador"],
    ["Valor", "USD 3.999,40"], ["Son", "Tres mil novecientos noventa y nueve con 40/100 dólares"],
], [45 * mm, 125 * mm]), Spacer(1, 8), tabla([
    ["Cuenta contable", "Debe", "Haber"],
    ["2.1.03 Sueldos por pagar", "1.050,00", ""],
    ["2.1.04 Beneficios sociales por pagar (décimos, vacaciones)", "2.001,75", ""],
    ["5.1.09 Bonificación por desahucio", "1.246,88", ""],
    ["2.1.05 Aporte personal IESS por pagar", "", "99,23"],
    ["1.1.05 Anticipos a empleados", "", "200,00"],
    ["1.1.01 Bancos", "", "3.999,40"],
    ["TOTALES", "4.298,63", "4.298,63"],
], [100 * mm, 35 * mm, 35 * mm]), Spacer(1, 16), firmas(CONT, GERENTE, (TRAB, "RECIBÍ CONFORME · C.C. " + CED))])

# 17 Versión "escaneada" (JPG) del acta de entrega-recepción
import pymupdf  # noqa: E402

pagina = pymupdf.open(str(SALIDA / "04_Acta_entrega_recepcion_del_cargo.pdf"))[0].get_pixmap(dpi=110)
img = Image.frombytes("RGB", (pagina.width, pagina.height), pagina.samples)
img = img.rotate(-1.2, expand=True, fillcolor=(236, 233, 224))
fondo = Image.new("RGB", (img.width + 60, img.height + 60), (236, 233, 224))
fondo.paste(img, (30, 30))
ruido = Image.effect_noise(fondo.size, 18).convert("RGB")
fondo = Image.blend(fondo, ruido, 0.06)
fondo.save(SALIDA / "17_Acta_entrega_recepcion_escaneada.jpg", quality=72)
print("ok 17_Acta_entrega_recepcion_escaneada.jpg")

# Carpeta organizada según el orden de carga en la demostración
DEMO = Path(__file__).parent / "evidencias_demo"
PASOS = [
    ("Pestaña 1 (Datos del trabajador)", ["01_Contrato_individual_de_trabajo.pdf", "11_Rol_de_pagos_septiembre_2026.pdf"]),
    ("Pestaña 2 (Terminación)", ["02_Desahucio_presentado_por_el_trabajador.pdf"]),
    ("Pestaña 3 (Paz y salvo - 1 Jefatura inmediata)", ["03_Informe_final_de_labores.pdf", "04_Acta_entrega_recepcion_del_cargo.pdf", "17_Acta_entrega_recepcion_escaneada.jpg"]),
    ("Pestaña 3 (Paz y salvo - 2 Tecnologías de la Información)", ["05_Acta_devolucion_equipos_TI.pdf", "12_Captura_bloqueo_de_cuentas.png"]),
    ("Pestaña 3 (Paz y salvo - 3 Bodega y Activos Fijos)", ["06_Acta_devolucion_bienes_bodega.pdf", "13_Foto_devolucion_credencial_y_llaves.png"]),
    ("Pestaña 3 (Paz y salvo - 4 Contabilidad y Finanzas)", ["07_Certificado_obligaciones_contabilidad.pdf", "08_Solicitud_anticipo_y_autorizacion_descuento.pdf"]),
    ("Pestaña 3 (Paz y salvo - 5 Talento Humano)", ["09_Registro_de_vacaciones_gozadas.pdf", "10_Aviso_de_salida_IESS.pdf", "15_Ficha_verificacion_expediente_personal.pdf"]),
    ("Pestaña 4 (Vacaciones)", ["14_Solicitudes_de_vacaciones_aprobadas.pdf"]),
    ("Pestaña 5 (Liquidación)", ["08_Solicitud_anticipo_y_autorizacion_descuento.pdf", "16_Comprobante_egreso_pago_liquidacion.pdf"]),
]
# Cada copia lleva en su nombre la pestaña (y unidad) donde se adjunta en la app.
if DEMO.exists():
    shutil.rmtree(DEMO)
for carpeta, archivos in PASOS:
    destino = DEMO / carpeta
    destino.mkdir(parents=True)
    for a in archivos:
        shutil.copy2(SALIDA / a, destino / f"{carpeta} - {a[3:]}")
print("ok carpeta", DEMO)

# Evidencias empaquetadas para el botón "Cargar caso hipotético completo" de la app.
# (La app se abre desde file://, donde no puede leer archivos locales por sí sola.)
import base64  # noqa: E402
import json  # noqa: E402

TH_N, JEFE_N, TI_N, BOD_N, CONT_N = TH[0], JEFE[0], TI[0], BOD[0], CONT[0]
META = {  # carpeta -> (categoría, índice de unidad del paz y salvo, fecha de carga, usuario)
    "Pestaña 1 (Datos del trabajador)": ("Datos del trabajador", None, "2026-10-02T09:20:00", TH_N),
    "Pestaña 2 (Terminación)": ("Terminación", None, "2026-10-02T09:25:00", TH_N),
    "Pestaña 3 (Paz y salvo - 1 Jefatura inmediata)": ("Paz y salvo", 0, "2026-10-30T16:10:00", JEFE_N),
    "Pestaña 3 (Paz y salvo - 2 Tecnologías de la Información)": ("Paz y salvo", 1, "2026-10-31T17:15:00", TI_N),
    "Pestaña 3 (Paz y salvo - 3 Bodega y Activos Fijos)": ("Paz y salvo", 2, "2026-10-31T17:40:00", BOD_N),
    "Pestaña 3 (Paz y salvo - 4 Contabilidad y Finanzas)": ("Paz y salvo", 3, "2026-11-04T11:00:00", CONT_N),
    "Pestaña 3 (Paz y salvo - 5 Talento Humano)": ("Paz y salvo", 4, "2026-11-05T10:30:00", TH_N),
    "Pestaña 4 (Vacaciones)": ("Vacaciones", None, "2026-11-05T10:45:00", TH_N),
    "Pestaña 5 (Liquidación)": ("Liquidación", None, "2026-11-10T15:00:00", CONT_N),
}
TIPOS = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg"}
paquete = []
for carpeta, archivos in PASOS:
    cat, dep, fecha, usuario = META[carpeta]
    for a in archivos:
        nombre = f"{carpeta} - {a[3:]}"
        paquete.append({"categoria": cat, "depIndex": dep, "fecha": fecha, "usuario": usuario, "nombre": nombre,
                        "tipo": TIPOS[Path(a).suffix], "b64": base64.b64encode((SALIDA / a).read_bytes()).decode()})
JS = Path(__file__).parent.parent / "app" / "js" / "demo_evidencias.js"
JS.write_text("/* Generado por caso_hipotetico/generar_documentos.py: evidencias ficticias del caso hipotético. */\n"
              "window.DEMO_EVIDENCIAS = " + json.dumps(paquete, ensure_ascii=False) + ";\n", encoding="utf8")
print("ok", JS, round(JS.stat().st_size / 1024), "KB")
