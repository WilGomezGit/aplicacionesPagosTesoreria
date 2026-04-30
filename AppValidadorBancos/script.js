/**
 * script.js – Validador de Archivos Bancos
 * Tesorería Comfacauca
 */
'use strict';

/* ================================================================
   REGLAS CONTABLES
================================================================ */
const REGLAS = {
     CE:  { cuentas: ['55212'],           desc: 'Comprobante de Egreso' },
     CEC: { cuentas: ['55212'],           desc: 'Comprobante Egreso Caja' },
     CER: { cuentas: ['55212'],           desc: 'Comprobante Egreso Reembolso' },
     EK:  { cuentas: ['69866'],           desc: 'Egreso Kiosko' },
     CJ:  { cuentas: ['11402'],           desc: 'Comprobante de Jornada' },
     EE:  { cuentas: ['88627', '18061'],  desc: 'Egreso Especial' },
     EG:  { cuentas: ['34044'],           desc: 'Egreso General' },
     CV:  { cuentas: ['13052'],           desc: 'Comprobante de Viáticos' },
     EO:  { cuentas: ['4623'],            desc: 'Egreso Ordinario' },
     CEX: { cuentas: ['3379'],            desc: 'Comprobante Egreso Extra' },
     ICE: { cuentas: ['6343'],            desc: 'Ingreso Comprobante Egreso' },
     RCE: { cuentas: ['64629'],           desc: 'Reversión Comprobante Egreso' },
     CSU: { cuentas: ['53461'],           desc: 'Comprobante Subsidio' },
     CD:  { cuentas: ['01514'],           desc: 'Comprobante de Descuento' },
     CL:  { cuentas: ['02409'],           desc: 'Comprobante de Legalización' }
};

let archivos   = [];
let valoresMap = new Map();
let statusMap  = new Map();

/* ================================================================
   DOM
================================================================ */
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
   FIX: la letra final ya NO es siempre 'S'; puede ser 'D' u otra.
        Se reemplaza el literal 'S' por '[A-Z]' al final del patrón.
================================================================ */
function extraerValor(texto) {
     const primeraLinea = texto.split('\n')[0];

  const buscar = (codigos, extraDigits) => {
         for (const codigo of codigos) {
                  // FIX: cambiar 'S' fijo por '[A-Z]' para aceptar cualquier letra indicadora
           const regex = new RegExp(`(\\d{12})\\d{${extraDigits}}${codigo}[A-Z]`);
                  const match = primeraLinea.match(regex);
                  if (match) {
                             const valorNum = parseInt(match[1], 10) / 100;
                             if (valorNum > 0) {
                                          return { valor: valorNum, valorFormateado: formatearCOP(valorNum) };
                             }
                  }
         }
         return null;
  };

  return (
         buscar(
                  ['55212','69866','11402','88627','18061','34044','13052','04623','03379','06343','64629','53461','01514','02409'],
                  6
                ) ||
         buscar(['4623','3379'], 7)
       );
}

function formatearCOP(valor) {
     return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(valor);
}

/* ================================================================
   ARCHIVOS
================================================================ */
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-active'); });
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
     if (!lista.length) return;
     archivos = [...archivos, ...lista];
     await Promise.all(lista.map(async file => {
            try {
                     const texto = await file.text();
                     valoresMap.set(file.name, extraerValor(texto));
            } catch {
                     valoresMap.set(file.name, null);
            }
            statusMap.delete(file.name);
     }));
     renderGrid();
}

function renderGrid() {
     filesGrid.innerHTML = '';
     btnValidar.disabled = archivos.length === 0;
     fileCount.textContent = archivos.length
       ? `${archivos.length} archivo(s) cargado(s)`
            : 'No hay archivos seleccionados';

  archivos.forEach(file => {
         const card = document.createElement('div');
         card.className = 'file-card';
         card.id = `card-${CSS.escape(file.name)}`;
         const estado = statusMap.get(file.name);
         if (estado) card.classList.add(`card-${estado}`);
         card.innerHTML = `
               <span class="file-card-name">📄 ${escHtml(file.name.replace(/\.txt$/i, ''))}</span>
                     ${estado ? `<span class="file-card-status">${estado === 'ok' ? '✅' : '❌'}</span>` : ''}
                         `;
         filesGrid.appendChild(card);
  });
}

/* ================================================================
   VALIDACIÓN
================================================================ */
async function validar() {
     if (!archivos.length) return;
     const verFecha = confirm('¿Quieres validar la fecha de pago?');
     btnValidar.disabled = true;
     statusMap.clear();
     resetResultados();
     progressContainer.style.display = 'block';
     progressBar.max = archivos.length;
     summary.style.display = 'flex';
     resultTitle.style.display = 'block';
     resultPanel.style.display = '';
     resultPanel.classList.add('results-panel');
     resultPanel.classList.add('grid-dos-columnas');

  let ok = 0, err = 0;

  // 🔤 Orden alfabético
  const ordenados = [...archivos].sort((a, b) =>
         a.name.localeCompare(b.name, 'es', { numeric: true })
                                         );

  // 📊 División en columnas
  const mitad = Math.ceil(ordenados.length / 2);
     const ordenFinal = [];
     for (let i = 0; i < mitad; i++) {
            if (ordenados[i])        ordenFinal.push(ordenados[i]);
            if (ordenados[i + mitad]) ordenFinal.push(ordenados[i + mitad]);
     }

  // 🚀 Validación en orden visual
  for (let i = 0; i < ordenFinal.length; i++) {
         const file = ordenFinal[i];
         progressText.textContent = `${i + 1} / ${ordenFinal.length}`;
         progressBar.value = i + 1;
         const res    = await validarArchivo(file, verFecha);
         const estado = res.ok ? 'ok' : 'error';
         statusMap.set(file.name, estado);
         if (res.ok) ok++; else err++;
         agregarResultado(estado, res, file);
         actualizarCard(file.name, estado);
         document.getElementById('countOk').textContent  = ok;
         document.getElementById('countErr').textContent = err;
         await new Promise(r => setTimeout(r, 0));
  }

  btnValidar.disabled = false;
     progressContainer.style.display = 'none';
}

function actualizarCard(nombre, estado) {
     const card = document.getElementById(`card-${CSS.escape(nombre)}`);
     if (!card) return;
     card.className = `file-card card-${estado}`;
     let icon = card.querySelector('.file-card-status');
     if (!icon) {
            icon = document.createElement('span');
            icon.className = 'file-card-status';
            card.appendChild(icon);
     }
     icon.textContent = estado === 'ok' ? '✅' : '❌';
}

/* ================================================================
   VALIDAR ARCHIVO
================================================================ */
async function validarArchivo(file, verFecha) {
     let texto;
     try {
            texto = await file.text();
     } catch {
            return { ok: false, mensaje: 'Error lectura', detalle: '', valor: '' };
     }

  // FIX: buscar 220/225 SOLO en la primera línea del archivo y en la
  //      posición del encabezado (columna ~17-19 del registro de control).
  //      Se usa una regex que ancla el patrón al inicio de la línea:
  //      16 dígitos + letra + espacios + código + espacios
  const primeraLinea = texto.split('\n')[0];
     const tipoServicio =
            /^\d{16}[A-Z]\s+225\s/.test(primeraLinea) ? 'NÓMINA'    :
            /^\d{16}[A-Z]\s+220\s/.test(primeraLinea) ? 'PROVEEDOR' :
            'DESCONOCIDO';

  const dctoCruce = texto.match(/\/([^\s]+)/)?.[1] || 'No encontrado';
     const nombre    = file.name.replace(/\.txt$/i, '');
     const match     = nombre.match(/([A-Z]{2,4})[_\-\s]?(\d+)/i);
     if (!match) return error('Nombre inválido');

  const tipo   = match[1].toUpperCase();
     const numero = match[2];
     const regla  = REGLAS[tipo];
     if (!regla) return error(`Tipo ${tipo} no soportado`);

  const formato = tipo.length === 2 ? `${tipo} ${numero}` : `${tipo}${numero}`;
     if (!texto.includes(formato)) return error(`Falta ref: ${formato}`);

  const cuenta = regla.cuentas.find(c => texto.includes(c));
     if (!cuenta) return error(`Cuenta error para ${tipo}`);

  let detalle = `DCTO CRUCE: ${dctoCruce} | Cuenta: ${cuenta}`;
     if (verFecha) {
            const f = texto.match(new RegExp(`(\\d{8})${tipo}`))?.[1];
            if (f) {
                     detalle += ` | Pago: ${f.substring(6,8)}/${f.substring(4,6)}/${f.substring(0,4)}`;
            }
     }

  return {
         ok: true,
         mensaje: `${tipo}-${numero} (${tipoServicio})`,
         detalle,
         valor: valoresMap.get(file.name)?.valorFormateado || ''
  };

  function error(msg) {
         return { ok: false, mensaje: msg, detalle: `Servicio: ${tipoServicio} | DCTO CRUCE: ${dctoCruce}`, valor: '' };
  }
}

/* ================================================================
   UI
================================================================ */
function agregarResultado(tipo, res, file) {
     const row = document.createElement('div');
     row.className = `result-row ${tipo}`;

  const cruce  = res.detalle.match(/DCTO CRUCE:\s*([^|]+)/)?.[1]?.trim() || '---';
     const cuenta = res.detalle.match(/Cuenta:\s*([^|]+)/)?.[1]?.trim()     || '';
     const fecha  = res.detalle.match(/Pago:\s*([\d/]+)/)?.[1]?.trim()      || '';

  row.innerHTML = `
      <div class="result-header">
            <span class="result-text">${res.mensaje}</span>
                  <span class="result-icon">${tipo === 'ok' ? '✅' : '❌'}</span>
                      </div>
                          <div class="result-body">
                                <div class="info-tag"><strong>DCTO CRUCE:</strong> ${cruce}</div>
                                      <div class="info-sub">📄 ${file.name.replace(/\.txt$/i, '')}</div>
                                            ${res.valor ? `<div class="info-sub info-valor">💰 ${res.valor}</div>` : ''}
                                                  <div class="info-sub">🏦 ${cuenta}${fecha ? ' | 📅 ' + fecha : ''}</div>
                                                      </div>
                                                        `;
     resultPanel.appendChild(row);
}

/* ================================================================
   UTILIDADES
================================================================ */
function resetResultados() {
     resultPanel.innerHTML    = '';
     resultPanel.style.display = 'none';
     resultTitle.style.display = 'none';
     summary.style.display     = 'none';
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

function goToHome() {
     window.location.href = '../index.html';
}
