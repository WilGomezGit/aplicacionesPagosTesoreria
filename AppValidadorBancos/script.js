/**
 * script.js – Validador de Archivos Bancos
 * Tesorería Comfacauca
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

let archivos = [];
let valoresMap = new Map();
let statusMap = new Map(); // nombreArchivo -> 'ok' | 'error'

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
   EXTRACCIÓN DE VALOR
================================================================ */
function extraerValor(texto) {
  const primeraLinea = texto.split('\n')[0];

  const codigos5 = [
    '55212', '69866', '11402', '88627', '18061', '34044', '13052',
    '04623', '03379', '06343', '64629', '53461', '01514', '02409'
  ];

  for (const codigo of codigos5) {
    const regex = new RegExp(`(\\d{12})\\d{6}${codigo}S`);
    const match = primeraLinea.match(regex);
    if (match) {
      const valorNum = parseInt(match[1], 10) / 100;
      if (valorNum > 0) {
        return {
          valor: valorNum,
          cuenta: match[0].slice(match[0].length - 12, match[0].length - 1),
          valorFormateado: formatearCOP(valorNum)
        };
      }
    }
  }

  const codigos4 = ['4623', '3379'];
  for (const codigo of codigos4) {
    const regex = new RegExp(`(\\d{12})\\d{7}${codigo}S`);
    const match = primeraLinea.match(regex);
    if (match) {
      const valorNum = parseInt(match[1], 10) / 100;
      if (valorNum > 0) {
        return {
          valor: valorNum,
          cuenta: match[0].slice(match[0].length - 12, match[0].length - 1),
          valorFormateado: formatearCOP(valorNum)
        };
      }
    }
  }

  return null;
}

function formatearCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2
  }).format(valor);
}

/* ================================================================
   GESTIÓN DE ARCHIVOS
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

async function agregarArchivos(nuevos) {
  const lista = Array.from(nuevos).filter(f =>
    f.name.toLowerCase().endsWith('.txt') &&
    !archivos.some(a => a.name === f.name && a.size === f.size)
  );

  if (lista.length === 0) return;

  archivos = [...archivos, ...lista];

  for (const file of lista) {
    try {
      const texto = await file.text();
      valoresMap.set(file.name, extraerValor(texto));
    } catch (e) {
      valoresMap.set(file.name, null);
    }
    statusMap.delete(file.name);
  }

  renderGrid();
}

function renderGrid() {
  filesGrid.innerHTML = '';
  btnValidar.disabled = archivos.length === 0;
  fileCount.textContent = archivos.length > 0
    ? `${archivos.length} archivo(s) cargado(s)`
    : 'No hay archivos seleccionados';

  archivos.forEach((file) => {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.id = `card-${CSS.escape(file.name)}`;

    const estado = statusMap.get(file.name);
    if (estado === 'ok') {
      card.classList.add('card-ok');
    } else if (estado === 'error') {
      card.classList.add('card-error');
    }

    const icono = estado === 'ok' ? '✅' : estado === 'error' ? '❌' : '';

    card.innerHTML = `
      <span class="file-card-name">📄 ${escHtml(file.name)}</span>
      ${icono ? `<span class="file-card-status">${icono}</span>` : ''}
    `;
    filesGrid.appendChild(card);
  });
}

/* ================================================================
   VALIDACIÓN PRINCIPAL
================================================================ */
async function validar() {
  if (archivos.length === 0) return;

  const verFecha = confirm('¿Quieres validar la fecha de pago?');
  const hoy = new Date();
  const fechaHoyComparar = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;

  btnValidar.disabled = true;
  statusMap.clear();
  resetResultados();

  progressContainer.style.display = 'block';
  progressBar.max = archivos.length;

  summary.style.display     = 'flex';
  resultTitle.style.display = 'block';
  resultPanel.style.display = 'grid';

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
    const estado = resultado.ok ? 'ok' : 'error';

    statusMap.set(file.name, estado);

    if (resultado.ok) {
      okCount++;
      agregarResultado('ok', '✅', file.name, resultado.mensaje, resultado.detalle, resultado.valor);
    } else {
      errCount++;
      agregarResultado('error', '❌', file.name, resultado.mensaje, resultado.detalle, resultado.valor);
    }

    // Actualizar tarjeta inmediatamente
    const card = document.getElementById(`card-${CSS.escape(file.name)}`);
    if (card) {
      card.className = `file-card card-${estado}`;
      if (!card.querySelector('.file-card-status')) {
        const icon = document.createElement('span');
        icon.className = 'file-card-status';
        card.appendChild(icon);
      }
      card.querySelector('.file-card-status').textContent = resultado.ok ? '✅' : '❌';
    }

    document.getElementById('countOk').textContent  = okCount;
    document.getElementById('countErr').textContent = errCount;
    await new Promise(r => setTimeout(r, 0));
  }

  btnValidar.disabled = false;
  progressContainer.style.display = 'none';
}

async function validarArchivo(file, verFecha, fechaHoyComparar) {
  let texto;
  try { texto = await file.text(); } catch (e) { return { ok: false, mensaje: 'Error lectura', detalle: '', valor: '' }; }

  let tipoServicio = "DESCONOCIDO";
  if (texto.includes("225")) tipoServicio = "NÓMINA";
  else if (texto.includes("220")) tipoServicio = "PROVEEDOR";

  const matchCruce = texto.match(/\/([^\s]+)/);
  const dctoCruce = matchCruce ? matchCruce[1] : "No encontrado";

  const nombre = file.name.replace(/\.txt$/i, '');
  const match = nombre.match(/([A-Z]{2,4})[_\-\s]?(\d+)/i);
  if (!match) return { ok: false, mensaje: 'Nombre inválido', detalle: `Servicio: ${tipoServicio} | DCTO CRUCE: ${dctoCruce}`, valor: '' };

  const tipo = match[1].toUpperCase();
  const numero = match[2];
  const regla = REGLAS[tipo];
  if (!regla) return { ok: false, mensaje: `Tipo ${tipo} no soportado`, detalle: `Servicio: ${tipoServicio} | DCTO CRUCE: ${dctoCruce}`, valor: '' };

  const formato = tipo.length === 2 ? `${tipo} ${numero}` : `${tipo}${numero}`;
  if (!texto.includes(formato)) return { ok: false, mensaje: `Falta ref: ${formato}`, detalle: `Servicio: ${tipoServicio} | DCTO CRUCE: ${dctoCruce}`, valor: '' };

  const cuenta = regla.cuentas.find(c => texto.includes(c));
  if (!cuenta) return { ok: false, mensaje: `Cuenta error para ${tipo}`, detalle: `Servicio: ${tipoServicio} | DCTO CRUCE: ${dctoCruce}`, valor: '' };

  const valorInfo = valoresMap.get(file.name);
  const valorStr = valorInfo ? valorInfo.valorFormateado : '';

  let detalleFinal = `DCTO CRUCE: ${dctoCruce} | Cuenta: ${cuenta}`;

  if (verFecha) {
    const regexFecha = new RegExp(`(\\d{8})${tipo}`);
    const fMatch = texto.match(regexFecha);
    if (fMatch) {
      const f = fMatch[1];
      detalleFinal += ` | Pago: ${f.substring(6,8)}/${f.substring(4,6)}/${f.substring(0,4)}`;
    }
  }

  return { ok: true, mensaje: `${tipo}-${numero} (${tipoServicio})`, detalle: detalleFinal, valor: valorStr };
}

function agregarResultado(tipo, icono, nombre, mensaje, detalle, valor) {
  const row = document.createElement('div');
  row.className = `result-row ${tipo}`;

  const cruceMatch = detalle.match(/DCTO CRUCE:\s*([^|]+)/);
  const cuentaMatch = detalle.match(/Cuenta:\s*([^|]+)/);
  const fechaMatch = detalle.match(/Pago:\s*([\d/]+)/);

  const cruce  = cruceMatch  ? cruceMatch[1].trim()  : '---';
  const cuenta = cuentaMatch ? cuentaMatch[1].trim()  : '';
  const fecha  = fechaMatch  ? fechaMatch[1].trim()   : '';

  row.innerHTML = `
    <div class="result-header">
      <span class="result-text">${mensaje}</span>
      <span class="result-icon">${icono}</span>
    </div>
    <div class="result-body">
      <div class="info-tag"><strong>DCTO CRUCE:</strong> ${cruce}</div>
      <div class="info-sub">📄 ${nombre}</div>
      ${valor ? `<div class="info-sub info-valor">💰 ${valor}</div>` : ''}
      <div class="info-sub">🏦 ${cuenta}${fecha ? ' &nbsp;|&nbsp; 📅 ' + fecha : ''}</div>
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
  valoresMap.clear();
  statusMap.clear();
  renderGrid();
  resetResultados();
  progressContainer.style.display = 'none';
}

function goToHome() { window.location.href = '../index.html'; }
