/**
 * script.js  –  AppValidadorFirmador
 * BUGS CORREGIDOS:
 * - localStorage puede fallar en modo file:// → usar variable en memoria
 * - firmaBytes se lanzaba por cada PDF pero debería leerse una sola vez
 * - No se liberaban Object URLs → memory leak
 * - btnClear quedaba disabled si el usuario cancelaba
 */

'use strict';

// ── Configuración PDF.js ──────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const { PDFDocument, rgb } = PDFLib;

// ── Reglas contables ──────────────────────────────────────────
const VALIDATION_RULES = [
    { type: 'CE',  aux: ['23802504','25050101','25050201'], bank: '5521-2' },
    { type: 'EK',  aux: ['23802538','25051101','25051201'], bank: '6986-6' },
    { type: 'CJ',  aux: ['28640515'],                       bank: '1140-2' },
    { type: 'EE',  aux: ['28681615','28681605','28681609'], bank: '8862-7' },
    { type: 'EE',  aux: ['28681610'],                       bank: '1806-1' },
    { type: 'EG',  aux: ['28681620'],                       bank: '3404-4' },
    { type: 'CV',  aux: ['28610511'],                       bank: '1305-2' },
    { type: 'EO',  aux: ['23802518'],                       bank: '0462-3' },
    { type: 'CEX', aux: ['23802509'],                       bank: '0337-9' },
    { type: 'ICE', aux: ['23802505','25050101','25050201'], bank: '0634-3' },
    { type: 'RCE', aux: ['23802527','25050901','25051001'], bank: '6462-9' },
    { type: 'CL',  aux: ['28959506'],                       bank: '0240-9' },
    { type: 'CD',  aux: ['28959507'],                       bank: '0151-4' },
    { type: 'CEC', aux: ['23802511'],                       bank: '5521-2' },
    { type: 'CER', aux: ['23802510'],                       bank: '5521-2' },
    { type: 'CSU', aux: ['23802512','23802534'],            bank: '5346-1' },
];

// ── Estado ────────────────────────────────────────────────────
let pendingFiles = [];
let stats = { correct: 0, error: 0, ignored: 0 };
let fileCounter = 1;   // FIX: usar variable en memoria en lugar de localStorage
let lastBlobUrl = null;

// ── DOM ───────────────────────────────────────────────────────
const dropZone        = document.getElementById('drop-zone');
const fileInput       = document.getElementById('file-input');
const btnValidate     = document.getElementById('btn-validate');
const btnClear        = document.getElementById('btn-clear');
const btnClearFirma   = document.getElementById('btn-clear-firma');
const resultsList     = document.getElementById('results-list');
const firmaInput      = document.getElementById('firma-input');
const textoExtraInput = document.getElementById('textoExtra-input');
const estadoLabel     = document.getElementById('status');
const progressContainer = document.getElementById('progress-container');
const progressBar     = document.getElementById('progress-bar');
const progressText    = document.getElementById('progress-text');

// ── Intentar recuperar contador de sessionStorage (más seguro) ──
try {
    const saved = sessionStorage.getItem('pdfSignCounter');
    if (saved) fileCounter = parseInt(saved, 10) || 1;
} catch (_) { /* ignorar en file:// */ }

// ── Eventos ───────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
btnClear.addEventListener('click', resetPDFs);
btnClearFirma.addEventListener('click', () => { firmaInput.value = ''; });
btnValidate.addEventListener('click', startProcessing);

// ── Manejo de archivos ────────────────────────────────────────
function handleFiles(files) {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf');
    if (pdfs.length === 0) { alert('Por favor, selecciona solo archivos PDF.'); return; }

    // Evitar duplicados por nombre+tamaño
    const nuevos = pdfs.filter(
        nf => !pendingFiles.some(f => f.name === nf.name && f.size === nf.size)
    );
    pendingFiles = [...pendingFiles, ...nuevos];
    btnValidate.disabled = pendingFiles.length === 0;
    updateDropZoneText();
}

function updateDropZoneText() {
    const p = dropZone.querySelector('p');
    if (p) p.textContent = pendingFiles.length > 0
        ? `${pendingFiles.length} PDF(s) listos para procesar`
        : 'Arrastra tus comprobantes PDF aquí';
}

// ── Reset PDFs ────────────────────────────────────────────────
function resetPDFs() {
    pendingFiles = [];
    stats = { correct: 0, error: 0, ignored: 0 };
    updateStatsUI();
    resultsList.innerHTML = '';
    btnValidate.disabled = true;
    btnClear.disabled = false;   // FIX: nunca dejar bloqueado
    fileInput.value = '';
    progressContainer.style.display = 'none';
    estadoLabel.innerHTML = '';
    updateDropZoneText();

    if (lastBlobUrl) { URL.revokeObjectURL(lastBlobUrl); lastBlobUrl = null; }
}

// ── Extraer texto de PDF ──────────────────────────────────────
async function extractTextFromPDF(file) {
    const buffer   = await file.arrayBuffer();
    const typedArr = new Uint8Array(buffer);
    const pdf      = await pdfjsLib.getDocument({ data: typedArr }).promise;

    let fullText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const tc   = await page.getTextContent();
        fullText  += tc.items.map(i => i.str).join(' ') + ' ';
    }
    await pdf.destroy();
    return fullText;
}

// ── Validar un PDF ────────────────────────────────────────────
async function validateSinglePDF(file, fullText) {
    const nameMatch = file.name.match(/([A-Z]+)-0*(\d+)/i);
    if (!nameMatch) {
        return { status: 'error', formattedName: 'SIN-CÓDIGO', isValid: false,
                 message: `${file.name} → ❌ Nombre incorrecto (ej. CE-001.pdf)` };
    }

    const compType   = nameMatch[1].toUpperCase();
    const compNumber = nameMatch[2];
    const label      = `${compType}-${compNumber}`;

    if (/cheque/i.test(fullText)) {
        return { status: 'ignored', formattedName: label, isValid: false,
                 message: `➖ ${label} ignorado (Es Cheque)` };
    }

    const allAux    = VALIDATION_RULES.flatMap(r => r.aux);
    const found     = (fullText.match(/\b\d{8}\b/g) || []).find(n => allAux.includes(n));
    const bankMatch = fullText.match(/\b(\d{4}-\d)\b/);
    const foundBank = bankMatch ? bankMatch[1] : null;

    if (!found)     return { status: 'error', formattedName: label, isValid: false,
                             message: `❌ ${label} — auxiliar no detectado` };
    if (!foundBank) return { status: 'error', formattedName: label, isValid: false,
                             message: `❌ ${label} — cuenta bancaria no detectada` };

    return validateBusinessRules(compType, found, foundBank, label);
}

function validateBusinessRules(compType, aux, bank, label) {
    const rules = VALIDATION_RULES.filter(r => r.type === compType);
    if (rules.length === 0)
        return { status: 'error', formattedName: label, isValid: false,
                 message: `❌ ${label} — tipo de comprobante no reconocido` };

    const ruleWithAux = rules.find(r => r.aux.includes(aux));
    if (!ruleWithAux)
        return { status: 'error', formattedName: label, isValid: false,
                 message: `❌ ${label} — auxiliar incorrecto (${aux})` };

    if (ruleWithAux.bank !== bank)
        return { status: 'error', formattedName: label, isValid: false,
                 message: `❌ ${label} — cuenta bancaria no coincide (esperada: ${ruleWithAux.bank}, encontrada: ${bank})` };

    return { status: 'correct', formattedName: label, isValid: true,
             message: `✅ ${label} correcto (${aux} · ${bank})` };
}

// ── Proceso principal ─────────────────────────────────────────
async function startProcessing() {
    if (pendingFiles.length === 0) return;

    const firmaFile = firmaInput.files[0];
    if (!firmaFile) { alert('Por favor, sube la imagen de firma antes de procesar.'); return; }

    // FIX: leer firma una sola vez fuera del loop
    const firmaBytes = await firmaFile.arrayBuffer();
    const textoExtra = textoExtraInput.value.trim();

    btnValidate.disabled = true;
    btnClear.disabled    = true;
    resultsList.innerHTML = '';
    stats = { correct: 0, error: 0, ignored: 0 };
    updateStatsUI();

    progressContainer.style.display = 'block';
    progressBar.max   = pendingFiles.length;
    progressBar.value = 0;

    estadoLabel.innerHTML = '⏳ Validando comprobantes...';

    const validationResults = [];

    // ── Fase 1: Validar ───────────────────────────────────────
    for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        try {
            const text   = await extractTextFromPDF(file);
            const result = await validateSinglePDF(file, text);

            if      (result.status === 'correct') stats.correct++;
            else if (result.status === 'error')   stats.error++;
            else                                   stats.ignored++;

            renderResult(result);
            validationResults.push({ file, result });
        } catch (err) {
            const errRes = { status: 'error', formattedName: 'ERROR', isValid: false,
                             message: `❌ No se pudo procesar: ${file.name}` };
            stats.error++;
            renderResult(errRes);
            validationResults.push({ file, result: errRes });
        }

        progressBar.value = i + 1;
        progressText.textContent = `${i + 1} / ${pendingFiles.length}`;
        updateStatsUI();
        await yieldToUI();
    }

    // ── ¿Continuar si hay errores? ────────────────────────────
    if (stats.error > 0) {
        const ok = confirm(
            `⚠️ Se encontraron ${stats.error} errores de validación.\n\n¿Deseas firmar y generar el PDF de todos modos?`
        );
        if (!ok) {
            estadoLabel.innerHTML = '❌ Proceso cancelado por el usuario.';
            btnClear.disabled    = false;
            btnValidate.disabled = false;
            return;
        }
    }

    // ── Fase 2: Firmar y unir ─────────────────────────────────
    estadoLabel.innerHTML = '⏳ Aplicando firmas y generando PDF final...';

    try {
        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < validationResults.length; i++) {
            const { file, result } = validationResults[i];
            estadoLabel.innerHTML = `Firmando ${i + 1} / ${validationResults.length}...`;

            const bytes  = await file.arrayBuffer();
            const pdf    = await PDFDocument.load(bytes);
            const pagina = pdf.getPages()[0];
            const { width } = pagina.getSize();
            const comprobante = result.formattedName;

            // Texto comprobante (centrado)
            pagina.drawText(comprobante, {
                x: width / 2 - 40, y: 80, size: 14, color: rgb(0, 0, 0)
            });

            // Texto extra / fecha vencimiento
            if (textoExtra) {
                pagina.drawText(textoExtra, {
                    x: 380, y: 638, size: 8, color: rgb(0, 0, 0)
                });
            }

            // Imagen de firma
            let firmaImg;
            if (firmaFile.type.includes('png')) {
                firmaImg = await pdf.embedPng(firmaBytes);
            } else {
                firmaImg = await pdf.embedJpg(firmaBytes);
            }

            pagina.drawImage(firmaImg, { x: 40, y: 330, width: 110, height: 130 });

            // Copiar páginas al PDF unificado
            const paginas = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            paginas.forEach(p => mergedPdf.addPage(p));

            await yieldToUI();
        }

        estadoLabel.innerHTML = 'Generando archivo final...';
        const pdfFinal = await mergedPdf.save();

        // Liberar URL anterior
        if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);

        const blob = new Blob([pdfFinal], { type: 'application/pdf' });
        lastBlobUrl = URL.createObjectURL(blob);

        const downloadName = `comprobantesFirmados${fileCounter}.pdf`;
        const link = document.createElement('a');
        link.href     = lastBlobUrl;
        link.download = downloadName;
        link.click();

        // Incrementar contador
        fileCounter++;
        try { sessionStorage.setItem('pdfSignCounter', fileCounter.toString()); } catch (_) {}

        estadoLabel.innerHTML = `✅ ${downloadName} generado correctamente.`;
        pendingFiles = [];
        updateDropZoneText();

    } catch (err) {
        console.error(err);
        estadoLabel.innerHTML = '❌ Error durante la generación del PDF con firma.';
    }

    btnClear.disabled    = false;
    btnValidate.disabled = pendingFiles.length === 0;
}

// ── UI Helpers ────────────────────────────────────────────────
function renderResult(result) {
    const li = document.createElement('li');
    li.textContent = result.message;
    li.className   = `result-${result.status}`;
    resultsList.appendChild(li);
    resultsList.scrollTop = resultsList.scrollHeight;
}

function updateStatsUI() {
    const el = (id) => document.getElementById(id);
    if (el('count-correct')) el('count-correct').textContent = stats.correct;
    if (el('count-error'))   el('count-error').textContent   = stats.error;
    if (el('count-ignored')) el('count-ignored').textContent = stats.ignored;
}

/** Cede control al navegador para actualizar la UI */
function yieldToUI() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function goToHome() {
    window.location.href = '../index.html';
}
