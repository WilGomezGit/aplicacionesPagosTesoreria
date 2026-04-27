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
let valoresMap = new Map(); // nombreArchivo -> { valor, cuenta, valorFormateado }

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
   EXTRACCIÓN DE VALOR DEL ARCHIVO PLANO
================================================================ */
function extraerValor(texto) {
  // Buscar patrón: fecha YYYYMMDD + A + espacios + fecha YYYYMMDD + bloque numérico + S
  // El bloque numérico contiene: [otros datos][VALOR CON DECIMALES][CUENTA 11 DÍGITOS]
  const match = texto.match(/\d{8}A\s*\d{8}(\d+)S/);
  if (!match) return null;
  
  const bloque = match[1];
  if (bloque.length < 13) return null; // Mínimo: cuenta(11) + decimales(2)
  
  // Últimos 11 dígitos = cuenta bancaria completa
  const cuenta = bloque.slice(-11);
  // Todo lo anterior = incluye valor con 2 decimales implícitos
  const valorStr = bloque.slice(0, -11);
  const valorNum = parseInt(valorStr, 10) / 100; // Dividir entre 100 para obtener decimales
  
  if (isNaN(valorNum) || valorNum === 0) return null;
  
  return {
    valor: valorNum,
    cuenta: cuenta,
    valorFormateado: formatearCOP(valorNum)
  };
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
  
  // Extraer valor de cada archivo
  for (const file of lista) {
    try {
      const texto = await file.text();
      valoresMap.set(file.name, extraerValor(texto));
    } catch (e) {
      valoresMap.set(file.name, null);
    }
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
    card.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:5px 10px;font-size:0.78rem;gap:8px;';
    
    const valorInfo = valoresMap.get(file.name);
    const valorStr = valorInfo ? valorInfo.valorFormateado : '---';
    
    card.innerHTML = `
      <span class="file-card-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">📄 ${escHtml(file.name)}</span>
      <span class="file-card-value" style="font-weight:600;color:#1d4ed8;margin-left:auto;white-space:nowrap;">${valorStr}</span>
    `;
    filesGrid.appendChild(card);
  });
}

function quitarArchivo(i) {
  const name = archivos[i].name;
  archivos.splice(i, 1);
  valoresMap.delete(name);
  renderGrid();
  resetResultados();
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
    
    if (resultado.ok) {
      okCount++;
      agregarResultado('ok', '✅', file.name, resultado.mensaje, resultado.detalle);
    } else {
      errCount++;
      agregarResultado('error', '❌', file.name, resultado.mensaje, resultado.detalle);
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
  try { texto = await file.text(); } catch (e) { return { ok: false, mensaje: 'Error lectura', detalle: '' }; }

  // 1. Identificar 220 o 225
  let tipoServicio = "DESCONOCIDO";
  if (texto.includes("225")) tipoServicio = "NÓMINA";
  else if (texto.includes("220")) tipoServicio = "PROVEEDOR";

  // 2. DCTO CRUCE
  const matchCruce = texto.match(/\/([^\s]+)/);
  const dctoCruce = matchCruce ? matchCruce[1] : "No encontrado";

  // 3. TIPO y NUMERO del nombre
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

  // 5. Obtener valor formateado del Map
  const valorInfo = valoresMap.get(file.name);
  const valorStr = valorInfo ? valorInfo.valorFormateado : '';

  // Construir detalle
  let detalleFinal = `DCTO CRUCE: ${dctoCruce} | Cuenta: ${cuenta}`;
  if (valorStr) detalleFinal += ` | ${valorStr}`;
  
  if (verFecha) {
    const regexFecha = new RegExp(`(\\d{8})${tipo}`);
    const fMatch = texto.match(regexFecha);
    if (fMatch) {
      const f = fMatch[1];
      detalleFinal += ` | Pago: ${f.substring(6,8)}/${f.substring(4,6)}/${f.substring(0,4)}`;
    }
  }

  return { ok: true, mensaje: `${tipo}-${numero} (${tipoServicio})`, detalle: detalleFinal };
}

function agregarResultado(tipo, icono, nombre, mensaje, detalle) {
  const row = document.createElement('div');
  row.className = `result-row ${tipo}`;
  
  // Extraer partes con regex
  const cruceMatch = detalle.match(/DCTO CRUCE:\s*([^|]+)/);
  const cuentaMatch = detalle.match(/Cuenta:\s*([^|]+)/);
  const valorMatch = detalle.match(/(\$\d[\d.,]+)/);
  const fechaMatch = detalle.match(/Pago:\s*([\d/]+)/);
  
  const cruce = cruceMatch ? cruceMatch[1].trim() : '---';
  const cuenta = cuentaMatch ? cuentaMatch[1].trim() : '';
  const valor = valorMatch ? valorMatch[1] : '';
  const fecha = fechaMatch ? fechaMatch[1] : '';

  row.innerHTML = `
    <div class="result-header">
      <span class="result-text">${mensaje}</span>
      <span class="result-icon">${icono}</span>
    </div>
    <div class="result-body">
      <div class="info-tag"><strong>DCTO CRUCE:</strong> ${cruce}</div>
      <div class="info-sub">📄 ${nombre}</div>
      <div class="info-sub">🏦 ${cuenta}${valor ? ' | 💰 ' + valor : ''}${fecha ? ' | 📅 ' + fecha : ''}</div>
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
  renderGrid();
  resetResultados();
  progressContainer.style.display = 'none';
}

function goToHome() { window.location.href = '../index.html'; }
