/**
 * script.js – Validador de Archivos Bancos
 * Tesorería Comfacauca
 *
 * Valida:
 * 1. Referencia (TIPO + número)
 * 2. Cuenta bancaria según REGLAS
 * 3. Tipo de Servicio (220-PROVEEDOR / 225-NÓMINA)
 * 4. Extracción de DCTO CRUCE (después de /)
 */

'use strict';

/* ================================================================
   REGLAS CONTABLES
================================================================ */
const REGLAS = {
  CE:  { cuentas: ['55212'],          desc: 'Comprobante de Egreso' },
  CEC: { cuentas: ['55212'],          desc: 'Comprobante Egreso Caja' },
  CER: { cuentas: ['55212'],          desc: 'Comprobante Egreso Reembolso' },
  EK:  { cuentas: ['69866'],          desc: 'Egreso Kiosko' },
  CJ:  { cuentas: ['11402'],          desc: 'Comprobante de Jornada' },
  EE:  { cuentas: ['88627', '18061'], desc: 'Egreso Especial' },
  EG:  { cuentas: ['34044'],          desc: 'Egreso General' },
  CV:  { cuentas: ['13052'],          desc: 'Comprobante de Viáticos' },
  EO:  { cuentas: ['4623'],           desc: 'Egreso Ordinario' },
  CEX: { cuentas: ['3379'],           desc: 'Comprobante Egreso Extra' },
  ICE: { cuentas: ['6343'],           desc: 'Ingreso Comprobante Egreso' },
  RCE: { cuentas: ['64629'],          desc: 'Reversión Comprobante Egreso' },
  CSU: { cuentas: ['53461'],          desc: 'Comprobante Subsidio' },
  CD:  { cuentas: ['01514'],          desc: 'Comprobante de Descuento' },
  CL:  { cuentas: ['02409'],          desc: 'Comprobante de Legalización' },
};

/* ── Estado de la aplicación ── */
let archivos = [];

/* ── Referencias al DOM ── */
const dropZone         = document.getElementById('dropZone');
const fileInput        = document.getElementById('fileInput');
const filesGrid        = document.getElementById('filesGrid');
const fileCount        = document.getElementById('fileCount');
const btnValidar       = document.getElementById('btnValidar');
const progressContainer= document.getElementById('progressContainer');
const progressBar      = document.getElementById('progressBar');
const progressText     = document.getElementById('progressText');
const summary          = document.getElementById('summary');
const resultPanel      = document.getElementById('resultPanel');
const resultTitle      = document.getElementById('resultTitle');

/* ================================================================
   GESTIÓN DE CARGA (DRAG & DROP)
================================================================ */
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-active');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-active');
  agregarArchivos(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => agregarArchivos(fileInput.files));

function agregarArchivos(nuevos) {
  const lista = Array.from(nuevos).filter(f =>
    f.name.toLowerCase().endsWith('.txt') &&
    !archivos.some(a => a.name === f.name && a.size === f.size)
  );
  archivos = [...archivos, ...lista];
  renderGrid();
  fileInput.value = '';
}

function renderGrid() {
  filesGrid.innerHTML = '';
  btnValidar.disabled = archivos.length === 0;
  fileCount.textContent = archivos.length > 0
    ? `${archivos.length} archivo(s) cargado(s)`
    : 'No hay archivos seleccionados';

  archivos.forEach((file, i) => {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.innerHTML = `
      <span class="file-card-name">📄 ${escHtml(file.name)}</span>
      <button class="file-card-remove" onclick="quitarArchivo(${i})">×</button>
    `;
    filesGrid.appendChild(card);
  });
}

function quitarArchivo(i) {
  archivos.splice(i, 1);
  renderGrid();
  resetResultados();
}

/* ================================================================
   VALIDACIÓN Y LÓGICA DE COLUMNAS
================================================================ */
async function validar() {
  if (archivos.length === 0) return;

  const verFecha = confirm('¿Quieres validar la fecha de pago?');
  const hoy = new Date();
  const fechaHoyComparar = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;

  btnValidar.disabled = true;
  resetResultados();

  progressContainer.style.display = 'block';
  progressBar.max = archivos.length;
  
  summary.style.display     = 'flex';
  resultTitle.style.display = 'block';
  resultPanel.style.display = 'grid';

  // LÓGICA DE COLUMNAS: Si hay más de 4, aplicar clase CSS de 2 columnas
  if (archivos.length > 4) {
    resultPanel.classList.add('grid-dos-columnas');
  } else {
    resultPanel.classList.remove('grid-dos-columnas');
  }

  let okCount = 0, errCount = 0;

  for (let i = 0; i < archivos.length; i++) {
    const file = archivos[i];
    progressText.textContent = `${i + 1} / ${archivos.length}`;
    progressBar.value = i + 1;

    const resultado = await validarArchivo(file, verFecha, fechaHoyComparar);
    
    if (resultado.ok) {
      okCount++;
      agregarResultado('ok', '✅', file.name, resultado.mensaje, resultado.detalle);
    } else {
      errCount++;
      agregarResultado('error', '❌', file.name, resultado.mensaje, resultado.detalle);
    }

    document.getElementById('countOk').textContent  = okCount;
    document.getElementById('countErr').textContent = errCount;
    await new Promise(resolve => setTimeout(resolve, 0)); // Ceder UI
  }

  btnValidar.disabled = false;
  progressContainer.style.display = 'none';
}

async function validarArchivo(file, verFecha, fechaHoyComparar) {
  let texto;
  try { texto = await file.text(); } catch (e) { return { ok: false, mensaje: 'Error lectura' }; }

  // 1. Tipo de Servicio
  let tipoServicio = "DESCONOCIDO";
  if (texto.includes("225")) tipoServicio = "NÓMINA";
  else if (texto.includes("220")) tipoServicio = "PROVEEDOR";

  // 2. DCTO CRUCE (texto tras /)
  const matchCruce = texto.match(/\/([^\s]+)/);
  const dctoCruce = matchCruce ? matchCruce[1] : "No encontrado";

  // 3. Nombre y Reglas
  const nombre = file.name.replace(/\.txt$/i, '');
  const match = nombre.match(/([A-Z]{2,4})[_\-\s]?(\d+)/i);
  if (!match) return { ok: false, mensaje: 'Nombre inválido', detalle: `Servicio: ${tipoServicio} | DCTO CRUCE: ${dctoCruce}` };

  const tipo = match[1].toUpperCase();
  const numero = match[2];
  const regla = REGLAS[tipo];
  if (!regla) return { ok: false, mensaje: `Tipo ${tipo} no soportado`, detalle: `Servicio: ${tipoServicio} | DCTO CRUCE: ${dctoCruce}` };

  // 4. Referencia y Cuenta
  const formato = tipo.length === 2 ? `${tipo} ${numero}` : `${tipo}${numero}`;
  if (!texto.includes(formato)) return { ok: false, mensaje: `Falta ref: ${formato}`, detalle: `Servicio: ${tipoServicio} | DCTO CRUCE: ${dctoCruce}` };

  const cuenta = regla.cuentas.find(c => texto.includes(c));
  if (!cuenta) return { ok: false, mensaje: `Cuenta error para ${tipo}`, detalle: `Servicio: ${tipoServicio} | DCTO CRUCE: ${dctoCruce}` };

  let detalleFinal = `DCTO CRUCE: ${dctoCruce} | Cuenta: ${cuenta}`;
  
  if (verFecha) {
    const regexFecha = new RegExp(`(\\d{8})${tipo}`);
    const fMatch = texto.match(regexFecha);
    if (fMatch) {
      const f = fMatch[1];
      const fForm = `${f.substring(6,8)}/${f.substring(4,6)}/${f.substring(0,4)}`;
      detalleFinal += ` | Pago: ${fForm}${f === fechaHoyComparar ? ' (Hoy)' : ' (Dif.)'}`;
    }
  }

  return { ok: true, mensaje: `${tipo}-${numero} (${tipoServicio})`, detalle: detalleFinal };
}

function agregarResultado(tipo, icono, nombre, mensaje, detalle) {
  const row = document.createElement('div');
  row.className = `result-row ${tipo}`;
  
  // Dividimos el detalle por los "|" para mostrarlo ordenado
  const partes = detalle.split('|');
  const cruce = partes[0] ? partes[0].replace('DCTO CRUCE:', '').trim() : '---';
  const cuenta = partes[1] ? partes[1].trim() : '';
  const fecha = partes[2] ? partes[2].trim() : '';

  row.innerHTML = `
    <div class="result-header">
      <span class="result-text">${mensaje}</span>
      <span class="result-icon">${icono}</span>
    </div>
    <div class="result-body">
      <div class="info-tag"><strong>DCTO CRUCE:</strong> ${cruce}</div>
      <div class="info-sub">📄 Archivo: ${nombre}</div>
      <div class="info-sub">🏦 ${cuenta}</div>
      ${fecha ? `<div class="info-sub">📅 ${fecha}</div>` : ''}
    </div>
  `;
  resultPanel.appendChild(row);
}

function resetResultados() {
  resultPanel.innerHTML = '';
  resultPanel.style.display = 'none';
  resultTitle.style.display = 'none';
  summary.style.display = 'none';
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function limpiar() {
  archivos = [];
  renderGrid();
  resetResultados();
  progressContainer.style.display = 'none';
}

function goToHome() { window.location.href = '../index.html'; }
