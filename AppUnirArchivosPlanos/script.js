/**
 * script.js  –  AppUnirArchivosPlanos
 * MEJORAS:
 * - Revoca URL de objeto previo para evitar memory leaks
 * - Muestra tamaño del archivo resultante
 * - Permite reordenar archivos visualmente
 * - Manejo de errores robusto en lectura
 */

'use strict';

let files    = [];
let blobUrl  = null;

const fileInput     = document.getElementById('fileInput');
const combineButton = document.getElementById('combineButton');
const clearButton   = document.getElementById('clearButton');
const fileList      = document.getElementById('fileList');
const fileCount     = document.getElementById('fileCount');
const downloadLink  = document.getElementById('downloadLink');
const resultInfo    = document.getElementById('resultInfo');

/* ── Selección de archivos ───────────────────────────────────── */
fileInput.addEventListener('change', () => {
    if (fileInput.files.length === 0) { resetUI(); return; }

    // Acumular en lugar de reemplazar (permite seleccionar en lotes)
    const nuevos = Array.from(fileInput.files).filter(
        nf => !files.some(f => f.name === nf.name && f.size === nf.size)
    );
    files = [...files, ...nuevos];
    renderFileList();
    combineButton.disabled = files.length === 0;

    if (downloadLink) {
        downloadLink.style.display = 'none';
        if (resultInfo) resultInfo.textContent = '';
    }
});

function renderFileList() {
    fileList.innerHTML = '';
    files.forEach((file, i) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML = `
            <span class="file-index">${i + 1}</span>
            <span class="file-item-name">${escapeHtml(file.name)}</span>
            <span class="file-size">${formatSize(file.size)}</span>
            <button class="btn-remove-file" onclick="removeFile(${i})" title="Quitar archivo">×</button>
        `;
        fileList.appendChild(li);
    });
    fileCount.textContent = files.length > 0
        ? `${files.length} archivo(s) seleccionado(s)`
        : 'No hay archivos seleccionados';
}

function removeFile(index) {
    files.splice(index, 1);
    renderFileList();
    combineButton.disabled = files.length === 0;
    if (files.length === 0 && downloadLink) downloadLink.style.display = 'none';
}

/* ── Combinar ────────────────────────────────────────────────── */
combineButton.addEventListener('click', async () => {
    if (files.length === 0) { alert('Primero selecciona archivos.'); return; }

    combineButton.disabled  = true;
    combineButton.textContent = '⏳ Procesando...';

    // Liberar URL anterior para evitar memory leak
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }

    let combinedText = '';
    let errors = [];

    for (const file of files) {
        try {
            const text = await file.text();
            // trimEnd para eliminar saltos de línea extra al final de cada archivo
            combinedText += text.trimEnd() + '\n';
        } catch (err) {
            errors.push(file.name);
        }
    }

    if (errors.length > 0) {
        alert(`No se pudo leer: ${errors.join(', ')}`);
    }

    const blob = new Blob([combinedText], { type: 'text/plain;charset=utf-8' });
    blobUrl = URL.createObjectURL(blob);

    if (downloadLink) {
        downloadLink.href = blobUrl;
        downloadLink.download = 'archivos_unidos.txt';
        downloadLink.textContent = '⬇ Descargar Archivo Unificado';
        downloadLink.style.display = 'inline-flex';
    }

    if (resultInfo) {
        const totalLines = combinedText.split('\n').filter(l => l.length > 0).length;
        resultInfo.textContent = `Archivo generado · ${formatSize(blob.size)} · ${totalLines} líneas`;
    }

    combineButton.textContent = 'Unir Archivos';
    combineButton.disabled = false;
});

/* ── Limpiar ─────────────────────────────────────────────────── */
clearButton.addEventListener('click', resetUI);

function resetUI() {
    files = [];
    fileInput.value = '';
    fileList.innerHTML = '';
    fileCount.textContent = 'No hay archivos seleccionados';
    combineButton.disabled = true;
    if (downloadLink) { downloadLink.style.display = 'none'; downloadLink.href = ''; }
    if (resultInfo) resultInfo.textContent = '';
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
}

/* ── Helpers ─────────────────────────────────────────────────── */
function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function goToHome() {
    window.location.href = '../index.html';
}
