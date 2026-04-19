/**
 * script.js – Validador de Archivos Bancos
 * Tesorería Comfacauca
 *
 * Valida que cada archivo .txt contenga:
 *   1. La referencia al comprobante (TIPO + número)
 *   2. La cuenta bancaria correcta según las reglas contables
 */

'use strict';

/* ================================================================
   REGLAS CONTABLES
   Cada tipo de comprobante → cuentas válidas + descripción
================================================================ */
const REGLAS = {
    CE:  { cuentas: ['5521-2'],          desc: 'Comprobante de Egreso' },
    CEC: { cuentas: ['5521-2'],          desc: 'Comprobante Egreso Caja' },
    CER: { cuentas: ['5521-2'],          desc: 'Comprobante Egreso Reembolso' },
    EK:  { cuentas: ['6986-6'],          desc: 'Egreso Kiosko' },
    CJ:  { cuentas: ['1140-2'],          desc: 'Comprobante de Jornada' },
    EE:  { cuentas: ['8862-7', '1806-1'],desc: 'Egreso Especial' },
    EG:  { cuentas: ['3404-4'],          desc: 'Egreso General' },
    CV:  { cuentas: ['1305-2'],          desc: 'Comprobante de Viáticos' },
    EO:  { cuentas: ['0462-3'],          desc: 'Egreso Ordinario' },
    CEX: { cuentas: ['0337-9'],          desc: 'Comprobante Egreso Extra' },
    ICE: { cuentas: ['0634-3'],          desc: 'Ingreso Comprobante Egreso' },
    RCE: { cuentas: ['6462-9'],          desc: 'Reversión Comprobante Egreso' },
    CSU: { cuentas: ['5346-1'],          desc: 'Comprobante Subsidio' },
    CD:  { cuentas: ['0151-4'],          desc: 'Comprobante de Descuento' },
    CL:  { cuentas: ['0240-9'],          desc: 'Comprobante de Legalización' },
};

/* ── Estado de la aplicación ── */
let archivos = [];
let reporteTexto = '';

/* ── Referencias al DOM ── */
const dropZone          = document.getElementById('dropZone');
const fileInput         = document.getElementById('fileInput');
const filesGrid         = document.getElementById('filesGrid');
const fileCount         = document.getElementById('fileCount');
const btnValidar        = document.getElementById('btnValidar');
const btnReporte        = document.getElementById('btnReporte');
const progressContainer = document.getElementById('progressContainer');
const progressBar       = document.getElementById('progressBar');
const progressText      = document.getElementById('progressText');
const summary           = document.getElementById('summary');
const resultPanel       = document.getElementById('resultPanel');
const resultTitle       = document.getElementById('resultTitle');

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

    btnValidar.disabled  = true;
    btnReporte.style.display = 'none';
    resetResultados();

    progressContainer.style.display = 'block';
    progressBar.max   = archivos.length;
    progressBar.value = 0;

    summary.style.display     = 'flex';
    resultTitle.style.display = 'block';
    resultPanel.style.display = 'block';
    resultPanel.innerHTML     = '';

    let okCount = 0, errCount = 0;

    reporteTexto  = `REPORTE DE VALIDACIÓN – Tesorería Comfacauca\n`;
    reporteTexto += `Fecha: ${new Date().toLocaleString('es-CO')}\n`;
    reporteTexto += `${'─'.repeat(55)}\n\n`;

    for (let i = 0; i < archivos.length; i++) {
        const file = archivos[i];
        progressText.textContent = `${i + 1} / ${archivos.length}`;
        progressBar.value = i + 1;

        const resultado = await validarArchivo(file);
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

        await cederUI(); // permite que el navegador actualice la UI
    }

    reporteTexto += `${'─'.repeat(55)}\n`;
    reporteTexto += `RESUMEN: ${okCount} correctos · ${errCount} con error\n`;

    btnValidar.disabled      = false;
    btnReporte.style.display = 'inline-flex';
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
 *   1. Leer el contenido del archivo
 *   2. Detectar TIPO y NÚMERO desde el nombre del archivo
 *   3. Verificar que el tipo exista en las reglas
 *   4. Verificar que el texto contenga la referencia al comprobante
 *   5. Verificar que el texto contenga la cuenta bancaria correcta
 */
async function validarArchivo(file) {
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
            detalle: 'Formato esperado: TIPO-NUMERO.txt  (ej: CE-001.txt, EK-023.txt)'
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
    //    Acepta: CE001 | CE-001 | CE 001
    const variantes = [`${tipo}${numero}`, `${tipo}-${numero}`, `${tipo} ${numero}`];
    if (!variantes.some(v => texto.includes(v))) {
        return {
            ok: false,
            mensaje: `El archivo no contiene la referencia "${tipo}-${numero}"`,
            detalle: `Se buscó: ${variantes.join(' / ')}`
        };
    }

    // 5. Verificar cuenta bancaria
    const cuentaEncontrada = regla.cuentas.find(c => texto.includes(c));
    if (!cuentaEncontrada) {
        return {
            ok: false,
            mensaje: `Cuenta bancaria incorrecta para ${tipo} (${regla.desc})`,
            detalle: `Cuentas esperadas: ${regla.cuentas.join(' o ')}`
        };
    }

    return {
        ok: true,
        mensaje: `${tipo}-${numero} correcto · ${regla.desc}`,
        detalle: `Cuenta encontrada: ${cuentaEncontrada}`
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
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Cede el control al navegador para actualizar la UI entre iteraciones */
function cederUI() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/** Navegar al inicio */
function goToHome() {
    window.location.href = '../index.html';
}
