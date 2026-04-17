/**
 * script.js  –  AppValidarArchivoPlanoParaPago
 * BUG CORREGIDO: regex ahora permite acentos, ñ y coma (separador CSV)
 */

'use strict';

/* ── Estado ─────────────────────────────────────────────────── */
let fileContent = '';
let fileName    = '';

/* ── DOM ─────────────────────────────────────────────────────── */
const fileInput         = document.getElementById('fileInput');
const processButton     = document.getElementById('processButton');
const clearButton       = document.getElementById('clearButton');
const output            = document.getElementById('output');
const fileNameEl        = document.getElementById('fileName');
const validationMessage = document.getElementById('validationMessage');
const statsEl           = document.getElementById('stats');

/* ── Regex: caracteres permitidos ────────────────────────────── */
// CORRECCIÓN: el original no incluía acentos ni ñ, rechazando
// nombres comunes en español como "GÓMEZ", "MUÑOZ", etc.
const ALLOWED_REGEX = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\/\\:\-,]+$/;

/* ── Eventos ─────────────────────────────────────────────────── */
fileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
        showStatus('Por favor, selecciona un archivo de texto (.txt).', 'error');
        return;
    }

    fileName = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
        fileContent = ev.target.result;
        fileNameEl.textContent = `Archivo: ${fileName}`;
        processButton.disabled = false;
        output.innerHTML = '';
        validationMessage.textContent = '';
        if (statsEl) statsEl.textContent = '';
    };
    reader.readAsText(file, 'UTF-8');
});

processButton.addEventListener('click', () => {
    if (!fileContent) { alert('Por favor cargue un archivo.'); return; }
    validateFileContent(fileContent);
});

clearButton.addEventListener('click', resetUI);

/* ── Validación ──────────────────────────────────────────────── */
function validateFileContent(content) {
    const lines = content.split(/\r\n|\n/);
    let htmlOutput  = '';
    let hasErrors   = false;
    let totalLines  = 0;
    let errorLines  = 0;

    lines.forEach((line, index) => {
        if (line.length === 0) return;
        totalLines++;

        if (!ALLOWED_REGEX.test(line)) {
            hasErrors = true;
            errorLines++;

            // Detectar exactamente qué caracteres son inválidos
            const invalidChars = [...new Set([...line].filter(ch => !ALLOWED_REGEX.test(ch)))];
            const charsDesc = invalidChars.map(ch => `<code>${describeChar(ch)}</code>`).join(', ');

            htmlOutput += `
                <div class="result-item result-error">
                    <span class="line-num">Línea ${index + 1}</span>
                    <span class="line-content">${escapeHtml(line.substring(0, 120))}</span>
                    <span class="line-chars">Chars inválidos: ${charsDesc}</span>
                </div>`;
        }
    });

    // Estadísticas
    if (statsEl) {
        statsEl.innerHTML = `
            <span class="stat-ok">✅ ${totalLines - errorLines} líneas correctas</span>
            ${errorLines > 0 ? `<span class="stat-err">❌ ${errorLines} líneas con errores</span>` : ''}
        `;
    }

    if (hasErrors) {
        output.innerHTML = htmlOutput;
        showStatus(`⚠️ ${errorLines} línea(s) con caracteres inválidos. Corrígelas antes de cargar al sistema.`, 'error');
    } else {
        output.innerHTML = '<div class="result-item result-ok">✅ No se encontraron caracteres inválidos en el archivo.</div>';
        showStatus('✅ Archivo correcto — listo para cargar en BANCOLOMBIA.', 'success');
    }
}

/* ── Helpers ─────────────────────────────────────────────────── */
function showStatus(msg, type) {
    validationMessage.textContent = msg;
    validationMessage.className = `validation-message ${type}`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function describeChar(ch) {
    if (ch === ' ')  return 'espacio';
    if (ch === '\t') return 'tabulación';
    if (ch === '\r') return 'retorno de carro';
    const code = ch.charCodeAt(0);
    const esc  = escapeHtml(ch);
    return esc.trim() !== '' ? esc : `U+${code.toString(16).toUpperCase()}`;
}

function resetUI() {
    fileInput.value    = '';
    fileContent        = '';
    fileName           = '';
    output.innerHTML   = '';
    fileNameEl.textContent = 'No hay archivos seleccionados';
    validationMessage.textContent = '';
    validationMessage.className   = 'validation-message';
    if (statsEl) statsEl.innerHTML = '';
    processButton.disabled = true;
}

function goToHome() {
    window.location.href = '../index.html';
}
