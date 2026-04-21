/**
 * script.js – Validador de Archivos Bancos
 * Tesorería Comfacauca
 *
 * Valida que cada archivo .txt contenga:
 * 1. La referencia al comprobante (TIPO + número)
 * 2. La cuenta bancaria correcta según las reglas contables
 */

'use strict';

/* ================================================================
   REGLAS CONTABLES
   Cada tipo de comprobante → cuentas válidas (sin guión, tal como
   aparecen dentro del archivo .txt) + descripción
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
let reporteTexto = '';

/* ── Referencias al DOM ── */
const dropZone         = document.getElementById('dropZone');
const fileInput        = document.getElementById('fileInput');
const filesGrid        = document.getElementById('filesGrid');
const fileCount        = document.getElementById('fileCount');
const btnValidar       = document.getElementById('btnValidar');
const btnReporte       = document.getElementById('btnReporte');
const progressContainer= document.getElementById('progressContainer');
const progressBar      = document.getElementById('progressBar');
const progressText     = document.getElementById('progressText');
const summary          = document.getElementById('summary');
const resultPanel      = document.getElementById('resultPanel');
const resultTitle      = document.getElementById('resultTitle');

/* ================================================================
   DRAG & DROP
================================================================ */
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-active');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-active');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-active');
  agregarArchivos(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
  agregarArchivos(fileInput.files);
});

/* ================================================================
   GESTIÓN DE ARCHIVOS
================================================================ */

/**
 * Añade archivos a la lista sin duplicar.
 * Solo acepta .txt
 */
function agregarArchivos(nuevos) {
  const lista = Array.from(nuevos).filter(f =>
    f.name.toLowerCase().endsWith('.txt') &&
    !archivos.some(a => a.name === f.name && a.size === f.size)
  );
  archivos = [...archivos, ...lista];
  renderGrid();
  fileInput.value = '';
}

/** Renderiza las tarjetas de archivos cargados */
function renderGrid() {
  filesGrid.innerHTML = '';
  btnValidar.disabled = archivos.length === 0;
  fileCount.textContent = archivos.length > 0
    ? `${archivos.length} archivo(s) cargado(s)`
    : 'No hay archivos seleccionados';

  archivos.forEach((file, i) => {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.id = `card-${i}`;
    card.innerHTML = `
      <span class="file-card-name" title="${escHtml(file.name)}">📄 ${escHtml(file.name)}</span>
      <button class="file-card-remove" onclick="quitarArchivo(${i})" title="Quitar archivo">×</button>
    `;
    filesGrid.appendChild(card);
  });
}

/** Quita un archivo individual de la lista */
function quitarArchivo(i) {
  archivos.splice(i, 1);
  renderGrid();
  resetResultados();
}

/* ================================================================
   VALIDACIÓN PRINCIPAL
================================================================ */
async function validar() {
  if (archivos.length === 0) return;

  // Preguntar si se desea validar la fecha de pago
  const verFecha = confirm('¿Quieres validar la fecha de pago?');

  const hoy = new Date();
  const anioH = hoy.getFullYear();
  const mesH  = String(hoy.getMonth() + 1).padStart(2, '0');
  const diaH  = String(hoy.getDate()).padStart(2, '0');
  const fechaHoyFormateada = `${diaH}/${mesH}/${anioH}`;
  const fechaHoyComparar   = `${anioH}${mesH}${diaH}`;

  btnValidar.disabled = true;
  btnReporte.style.display = 'none';
  resetResultados();

  progressContainer.style.display = 'block';
  progressBar.max   = archivos.length;
  progressBar.value = 0;

  summary.style.display     = 'flex';
  resultTitle.style.display = 'block';
  resultPanel.style.display = 'block';
  resultPanel.innerHTML     = '';

  if (verFecha) {
    const refRow = document.createElement('div');
    refRow.className = 'result-row fecha-ref';
    refRow.textContent = `📅 Referencia hoy: ${fechaHoyFormateada}`;
    resultPanel.appendChild(refRow);
  }

  let okCount = 0, errCount = 0;

  reporteTexto  = `REPORTE DE VALIDACIÓN – Tesorería Comfacauca\n`;
  reporteTexto += `Fecha: ${new Date().toLocaleString('es-CO')}\n`;
  reporteTexto += `${'─'.repeat(55)}\n\n`;

  for (let i = 0; i < archivos.length; i++) {
    const file = archivos[i];
    progressText.textContent = `${i + 1} / ${archivos.length}`;
    progressBar.value = i + 1;

    const resultado = await validarArchivo(file, verFecha, fechaHoyComparar, fechaHoyFormateada);
    const card = document.getElementById(`card-${i}`);

    if (resultado.ok) {
      okCount++;
      if (card) card.classList.add('ok');
      agregarResultado('ok', '✅', file.name, resultado.mensaje, resultado.detalle);
      reporteTexto += `✅ ${file.name}\n   ${resultado.mensaje}\n\n`;
    } else {
      errCount++;
      if (card) card.classList.add('error');
      agregarResultado('error', '❌', file.name, resultado.mensaje, resultado.detalle);
      reporteTexto += `❌ ${file.name}\n   ${resultado.mensaje}\n\n`;
    }

    document.getElementById('countOk').textContent  = okCount;
    document.getElementById('countErr').textContent = errCount;

    await cederUI();
  }

  reporteTexto += `${'─'.repeat(55)}\n`;
  reporteTexto += `RESUMEN: ${okCount} correctos · ${errCount} con error\n`;

  btnValidar.disabled        = false;
  btnReporte.style.display   = 'inline-flex';
  progressContainer.style.display = 'none';
}

/* ================================================================
   LÓGICA DE VALIDACIÓN POR ARCHIVO
================================================================ */

/**
 * Valida un archivo individual.
 * Retorna { ok: boolean, mensaje: string, detalle: string }
 *
 * Pasos:
 *  1. Leer el contenido del archivo
 *  2. Detectar TIPO y NÚMERO desde el nombre del archivo
 *  3. Verificar que el tipo exista en las reglas
 *  4. Verificar referencia al comprobante dentro del texto
 *     (tipos de 2 letras → "CE 001"  |  tipos de 3+ letras → "CEX001")
 *  5. Verificar que el texto contenga la cuenta bancaria correcta (sin guión)
 *  6. (Opcional) Verificar la fecha de pago
 */
async function validarArchivo(file, verFecha, fechaHoyComparar, fechaHoyFormateada) {
  // 1. Leer contenido
  let texto;
  try {
    texto = await file.text();
  } catch (e) {
    return { ok: false, mensaje: 'No se pudo leer el archivo', detalle: e.message };
  }

  if (!texto.trim()) {
    return { ok: false, mensaje: 'El archivo está vacío', detalle: '' };
  }

  // 2. Extraer tipo y número del nombre del archivo
  //    Acepta: CE-001.txt | CE001.txt | _CE-001.txt | CE 001.txt
  const nombre = file.name.replace(/\.txt$/i, '');
  const match  = nombre.match(/([A-Z]{2,4})[_\-\s]?(\d+)/i);

  if (!match) {
    return {
      ok: false,
      mensaje: 'Nombre de archivo no reconocido',
      detalle: 'Formato esperado: TIPO-NUMERO.txt (ej: CE-001.txt, EK-023.txt)'
    };
  }

  const tipo   = match[1].toUpperCase();
  const numero = match[2];

  // 3. Verificar que el tipo existe en las reglas
  const regla = REGLAS[tipo];
  if (!regla) {
    return {
      ok: false,
      mensaje: `Tipo de comprobante "${tipo}" no reconocido`,
      detalle: `Tipos válidos: ${Object.keys(REGLAS).join(', ')}`
    };
  }

  // 4. Verificar referencia al comprobante en el contenido
  //    - Tipos de 2 letras (CE, EK, CJ…) → busca "CE 001" (con espacio)
  //    - Tipos de 3+ letras (CEX, ICE…)  → busca "CEX001" (sin separador)
  const formatoBusqueda = tipo.length === 2
    ? `${tipo} ${numero}`
    : `${tipo}${numero}`;

  if (!texto.includes(formatoBusqueda)) {
    return {
      ok: false,
      mensaje: `El archivo no contiene la referencia "${formatoBusqueda}"`,
      detalle: `Se buscó: "${formatoBusqueda}" dentro del contenido`
    };
  }

  // 5. Verificar cuenta bancaria (los números aparecen SIN guión en el contenido)
  const cuentaEncontrada = regla.cuentas.find(c => texto.includes(c));
  if (!cuentaEncontrada) {
    return {
      ok: false,
      mensaje: `Cuenta bancaria incorrecta para ${tipo} (${regla.desc})`,
      detalle: `Cuentas esperadas: ${regla.cuentas.join(' o ')}`
    };
  }

  // 6. Validar fecha de pago (opcional)
  let extraDetalle = `Cuenta encontrada: ${cuentaEncontrada}`;

  if (verFecha) {
    const regexFecha = new RegExp(`(\\d{8})${tipo}`);
    const fechaMatch = texto.match(regexFecha);

    if (fechaMatch) {
      const f    = fechaMatch[1];
      const dia  = f.substring(6, 8);
      const mes  = f.substring(4, 6);
      const anio = f.substring(0, 4);
      const fechaFormateada = `${dia}/${mes}/${anio}`;

      if (f === fechaHoyComparar) {
        extraDetalle += ` · 📅 Fecha de Pago: ${fechaFormateada} (Hoy)`;
      } else {
        extraDetalle += ` · 📅 Fecha de Pago: ${fechaFormateada} (Diferente a hoy)`;
      }
    }
  }

  return {
    ok: true,
    mensaje: `${tipo}-${numero} correcto · ${regla.desc}`,
    detalle: extraDetalle
  };
}

/* ================================================================
   UI HELPERS
================================================================ */

/** Agrega una fila al panel de resultados */
function agregarResultado(tipo, icono, nombre, mensaje, detalle) {
  const row = document.createElement('div');
  row.className = `result-row ${tipo}`;
  row.innerHTML = `
    <span class="result-icon">${icono}</span>
    <span class="result-text">
      <strong>${escHtml(nombre)}</strong> — ${escHtml(mensaje)}
      ${detalle ? `<span class="result-detail">${escHtml(detalle)}</span>` : ''}
    </span>
  `;
  resultPanel.appendChild(row);
  resultPanel.scrollTop = resultPanel.scrollHeight;
}

/** Descarga el reporte en .txt */
function descargarReporte() {
  const blob = new Blob([reporteTexto], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `reporte_validacion_${new Date().toISOString().slice(0, 10)}.txt`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Limpia todo el estado de la app */
function limpiar() {
  archivos = [];
  fileInput.value = '';
  renderGrid();
  resetResultados();
  btnReporte.style.display        = 'none';
  progressContainer.style.display = 'none';
}

/** Resetea solo la sección de resultados */
function resetResultados() {
  resultPanel.innerHTML         = '';
  resultPanel.style.display     = 'none';
  resultTitle.style.display     = 'none';
  summary.style.display         = 'none';
  document.getElementById('countOk').textContent  = '0';
  document.getElementById('countErr').textContent = '0';
}

/** Escapa caracteres HTML para evitar XSS */
function escHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

/** Cede el control al navegador para actualizar la UI entre iteraciones */
function cederUI() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/** Navegar al inicio */
function goToHome() {
  window.location.href = '../index.html';
}
