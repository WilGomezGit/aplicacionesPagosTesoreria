/**
 * app.js  –  CuentasBancarias
 * Depende de: core.js, xlsx.full.min.js
 */

'use strict';

/* ── Estado ─────────────────────────────────────────────────── */
let parsedData   = [];
let hasErrors    = false;
let isExcelMode  = false;
let excelType    = null; // 'simple' | 'siesa'

/* ── DOM ─────────────────────────────────────────────────────── */
const fileInput       = document.getElementById('fileInput');
const fileNameDiv     = document.getElementById('fileName');
const btnProcesar     = document.getElementById('btnProcesar');
const btnCancelar     = document.getElementById('btnCancelar');
const btnExcel        = document.getElementById('btnExcel');
const btnSiesa        = document.getElementById('btnSiesa');
const btnPlano        = document.getElementById('btnPlano');
const dataHead        = document.getElementById('dataHead');
const dataBody        = document.getElementById('dataBody');
const downloadButtons = document.getElementById('downloadButtons');
const errorMessage    = document.getElementById('errorMessage');
const dropZone        = document.getElementById('dropZone');

/* ── Init ────────────────────────────────────────────────────── */
fileInput.addEventListener('change', onFileSelected);
btnProcesar.addEventListener('click', processFile);
btnCancelar.addEventListener('click', clearData);
btnExcel.addEventListener('click', downloadExcel);
btnSiesa.addEventListener('click', downloadSiesa);
btnPlano.addEventListener('click', downloadPlano);
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover',  onDragOver);
dropZone.addEventListener('dragleave', onDragLeave);
dropZone.addEventListener('drop',      onDrop);

/* ── File Selection ──────────────────────────────────────────── */
function onFileSelected() {
    if (this.files.length > 0) {
        fileNameDiv.textContent = this.files[0].name;
        btnProcesar.disabled = false;
        btnCancelar.disabled = false;
    } else {
        resetFileUI();
    }
}

function resetFileUI() {
    fileNameDiv.textContent = 'No hay archivos seleccionados';
    btnProcesar.disabled = true;
}

/* ── Drag & Drop ─────────────────────────────────────────────── */
function onDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('drag-active');
}

function onDragLeave() {
    dropZone.classList.remove('drag-active');
}

function onDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-active');
    if (e.dataTransfer.files.length > 0) {
        // DataTransfer.files is read-only; trick to assign to input
        try {
            fileInput.files = e.dataTransfer.files;
        } catch (_) {
            /* Safari fallback – just process directly */
        }
        fileNameDiv.textContent  = e.dataTransfer.files[0].name;
        btnProcesar.disabled = false;
        btnCancelar.disabled = false;
    }
}

/* ── Process File ────────────────────────────────────────────── */
function processFile() {
    const file = fileInput.files[0];
    if (!file) { alert('Por favor, selecciona un archivo.'); return; }

    const name = file.name.toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.ods');
    const reader  = new FileReader();

    if (isExcel) {
        reader.onload = (e) => {
            const data     = new Uint8Array(e.target.result);
            const wb       = XLSX.read(data, { type: 'array' });
            const ws       = wb.Sheets[wb.SheetNames[0]];
            const range    = XLSX.utils.decode_range(ws['!ref']);
            const headers  = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
                headers.push(cell ? cell.v : `Columna ${C}`);
            }
            const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
            parseExcelData(json, headers);
        };
        reader.readAsArrayBuffer(file);
    } else {
        reader.onload = (e) => parseTxtContent(e.target.result);
        reader.readAsText(file, 'UTF-8');
    }
}

/* ── Parse TXT ───────────────────────────────────────────────── */
function parseTxtContent(content) {
    isExcelMode = false;
    excelType   = null;
    parsedData  = parseFileContent(content); // from core.js
    renderTxtTable();
    finalizeRender();
}

/* ── Parse Excel ─────────────────────────────────────────────── */
function detectExcelType(headers) {
    const siesaRequired = [
        'Código del proveedor',
        'Banco del proveedor',
        'Número de cuenta corriente o de ahorros',
        'Tipo de cuenta 1=cta cte 2=cta ahorro',
    ];
    return siesaRequired.every(h => headers.includes(h)) ? 'siesa' : 'simple';
}

function parseExcelData(jsonData, headers) {
    if (jsonData.length === 0) { alert('El archivo Excel está vacío.'); return; }
    isExcelMode = true;
    excelType   = detectExcelType(headers);

    if (excelType === 'simple') {
        parsedData = transformSimpleToSiesa(jsonData);
        if (parsedData.length === 0) {
            alert('No se pudo procesar el archivo. Verifica que tenga las columnas requeridas:\n- No. Documento · No. Cuenta · Nombre Banco · Tipo Cuenta · Tipo Documento');
            return;
        }
    } else {
        parsedData = jsonData;
    }

    renderExcelTable(headers);
    finalizeRender();
}

/* ── Transform Simple Excel to Siesa ────────────────────────── */
function transformSimpleToSiesa(jsonData) {
    const findCol = (row, names) => {
        for (const name of names)
            for (const key of Object.keys(row))
                if (key.toUpperCase().trim() === name.toUpperCase().trim())
                    return row[key];
        return '';
    };

    return jsonData.reduce((acc, row) => {
        const noDoc     = findCol(row, ['NUMERO DOCUMENTO', 'No. Documento', 'NO. DOCUMENTO', 'Número Documento']);
        const noCuenta  = findCol(row, ['NUMERO DE CUENTA', 'No. Cuenta', 'NO. CUENTA', 'Número de Cuenta']);
        const bancoNom  = findCol(row, ['NOMBRE BANCO', 'Nombre Banco', 'BANCO']);
        const tipoDoc   = findCol(row, ['TIPO DOC', 'Tipo Documento', 'TIPO DOCUMENTO', 'Tipo Doc']);
        const tipoCta   = findCol(row, ['TIPO CUENTA', 'Tipo Cuenta']);

        if (!noDoc || !noCuenta || !bancoNom) return acc;

        const bancoInfo = findBancoFlexible(bancoNom.toString().trim());
        const tipoCuenta = tipoCta.toString().toUpperCase() === 'AHORROS' ? '2'
                         : tipoCta.toString().toUpperCase() === 'CORRIENTE' ? '1' : 'ERROR';

        const dato2 = tipoDoc.toString().toUpperCase() === 'CÉDULA CIUDADANÍA' ? '1'
                    : tipoDoc.toString().toUpperCase() === 'CÉDULA EXTRANJERÍA' ? '2'
                    : tipoDoc.toString().toUpperCase() === 'NIT' ? '3' : 'ERROR';

        const dato6 = tipoCta.toString().toUpperCase() === 'AHORROS' ? '37'
                    : tipoCta.toString().toUpperCase() === 'CORRIENTE' ? '27' : 'ERROR';

        const hasRowError = bancoInfo.banco === 'ERROR' || tipoCuenta === 'ERROR' || dato2 === 'ERROR';

        acc.push({
            'Código del proveedor':    noDoc.toString().trim(),
            'Sucursal del proveedor':  '001',
            'Banco del proveedor':     bancoInfo.banco,
            'Número de cuenta corriente o de ahorros': noCuenta.toString().trim(),
            'Tipo de cuenta 1=cta cte 2=cta ahorro':   tipoCuenta,
            'formato':       '00000509',
            'forma de pago': '1',
            'Cuenta por defecto 0= cta reg. no es default, 1=cta reg. es default': '1',
            'DATO 1': noDoc.toString().trim(),
            'DATO 2': dato2,
            'DATO 3': bancoInfo.dato3,
            'DATO 4': noCuenta.toString().trim(),
            'DATO 5': '',
            'DATO 6': dato6,
            'DATO 7': '',
            'DATO 8': '00000',
            hasError: hasRowError,
        });
        return acc;
    }, []);
}

/* ── Render TXT Table ────────────────────────────────────────── */
const TXT_HEADERS = ['No.', 'No. Documento', 'Nombre Titular', 'No. Cuenta', 'Banco', 'Tipo Cuenta', 'Tipo Doc.', ''];

function renderTxtTable() {
    dataHead.innerHTML = '';
    const tr = document.createElement('tr');
    TXT_HEADERS.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        tr.appendChild(th);
    });
    dataHead.appendChild(tr);

    dataBody.innerHTML = '';
    hasErrors = false;

    parsedData.forEach((row, idx) => {
        if (row.hasError) hasErrors = true;
        const tr = document.createElement('tr');
        if (row.hasError) tr.classList.add('row-error');

        const cells = [
            { val: idx + 1 },
            { val: row.numeroDocumento },
            { val: row.nombreTitular },
            { val: row.noCuenta },
            { val: row.banco,         err: row.banco === 'DESCONOCIDO' },
            { val: row.tipoCuenta,    err: row.tipoCuenta === 'ERROR' },
            { val: row.tipoDocumento, err: row.tipoDocumento === 'TIPO DESCONOCIDO' },
        ];

        cells.forEach(({ val, err }) => {
            const td = document.createElement('td');
            td.textContent = val;
            if (err) td.classList.add('cell-error');
            tr.appendChild(td);
        });

        // Delete button
        const tdBtn = document.createElement('td');
        const btn = document.createElement('button');
        btn.className = 'btn-delete-row';
        btn.textContent = '× Eliminar';
        btn.onclick = () => { parsedData.splice(idx, 1); renderTxtTable(); finalizeRender(); };
        tdBtn.appendChild(btn);
        tr.appendChild(tdBtn);

        dataBody.appendChild(tr);
    });
}

/* ── Render Excel Table ──────────────────────────────────────── */
const SIESA_KEYS = [
    'Código del proveedor', 'Sucursal del proveedor', 'Banco del proveedor',
    'Número de cuenta corriente o de ahorros', 'Tipo de cuenta 1=cta cte 2=cta ahorro',
    'formato', 'forma de pago',
    'Cuenta por defecto 0= cta reg. no es default, 1=cta reg. es default',
    'DATO 1', 'DATO 2', 'DATO 3', 'DATO 4', 'DATO 5', 'DATO 6', 'DATO 7', 'DATO 8',
];
const SIESA_ALIASES = {
    'Código del proveedor': 'Documento',
    'Sucursal del proveedor': 'Sucursal',
    'Banco del proveedor': 'Banco',
    'Número de cuenta corriente o de ahorros': 'No. Cuenta',
    'Tipo de cuenta 1=cta cte 2=cta ahorro': 'Tipo Cuenta',
    'Cuenta por defecto 0= cta reg. no es default, 1=cta reg. es default': 'Cta. Defecto',
};

function renderExcelTable(headers) {
    dataHead.innerHTML = '';
    const isSimple = excelType === 'simple';
    const displayHeaders = isSimple
        ? [...SIESA_KEYS.map(k => SIESA_ALIASES[k] || k), 'Acciones']
        : [...headers.map(h => SIESA_ALIASES[h] || h), 'Acciones'];

    const tr = document.createElement('tr');
    displayHeaders.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        tr.appendChild(th);
    });
    dataHead.appendChild(tr);

    dataBody.innerHTML = '';
    hasErrors = false;

    parsedData.forEach((row, idx) => {
        if (row.hasError) hasErrors = true;
        const tr = document.createElement('tr');
        if (row.hasError) tr.classList.add('row-error');

        const keys = isSimple ? SIESA_KEYS : (headers.length ? headers : Object.keys(row).filter(k => k !== 'hasError'));
        keys.forEach(key => {
            const td = document.createElement('td');
            const val = row[key] !== undefined ? row[key] : '';
            td.textContent = val;
            if (val === 'ERROR' || val === '000000000') td.classList.add('cell-error');
            tr.appendChild(td);
        });

        const tdBtn = document.createElement('td');
        const btn = document.createElement('button');
        btn.className = 'btn-delete-row';
        btn.textContent = '× Eliminar';
        btn.onclick = () => { parsedData.splice(idx, 1); renderExcelTable(headers); finalizeRender(); };
        tdBtn.appendChild(btn);
        tr.appendChild(tdBtn);

        dataBody.appendChild(tr);
    });
}

/* ── Finalize ─────────────────────────────────────────────────── */
function finalizeRender() {
    showDownloadButtons();
    updateErrorMessage();
    updateDownloadButtons();
}

function showDownloadButtons() {
    downloadButtons.style.display = parsedData.length > 0 ? 'flex' : 'none';
}

function updateDownloadButtons() {
    const ok = !hasErrors && parsedData.length > 0;
    btnExcel.disabled = !ok;
    btnSiesa.disabled = !ok;
    btnPlano.disabled = !ok;
}

function updateErrorMessage() {
    const errCount = parsedData.filter(r => r.hasError).length;
    errorMessage.className = 'message-bar';

    if (errCount > 0) {
        errorMessage.className += ' error';
        errorMessage.textContent = `⚠️  ${errCount} fila(s) con errores. Elimínalas para habilitar las descargas.`;
        errorMessage.style.display = 'block';
    } else if (parsedData.length > 0) {
        errorMessage.className += ' success';
        errorMessage.textContent = `✅ ${parsedData.length} registro(s) procesados correctamente.`;
        errorMessage.style.display = 'block';
    } else {
        errorMessage.style.display = 'none';
    }
}

/* ── Downloads ───────────────────────────────────────────────── */
function downloadExcel() {
    if (hasErrors || parsedData.length === 0) return;
    if (isExcelMode) { alert('El archivo subido ya es un Excel.'); return; }

    const sheetData = [
        ['No.', 'No. DOCUMENTO', 'NOMBRE TITULAR', 'No. CUENTA', 'BANCO', 'TIPO CUENTA', 'TIPO DOCUMENTO'],
        ...parsedData.map((item, i) => [
            i + 1, item.numeroDocumento, item.nombreTitular,
            item.noCuenta, item.banco, item.tipoCuenta, item.tipoDocumento
        ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos Cuentas Bancarias');
    triggerExcelDownload(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), 'DatosCuentasBancarias.xlsx');
}

function downloadSiesa() {
    if (hasErrors || parsedData.length === 0) return;
    if (isExcelMode && excelType === 'siesa') { alert('El archivo ya tiene formato Siesa.'); return; }

    const headers = [...SIESA_KEYS];
    const rows = isExcelMode && excelType === 'simple'
        ? parsedData.map(r => SIESA_KEYS.map(k => r[k] ?? ''))
        : parsedData.map(item => {
            const bi = BANCO_SIESA_DATA[item.banco] ?? findBancoFlexible(item.banco);
            const tc = item.tipoCuenta === 'AHORROS' ? '2' : item.tipoCuenta === 'CORRIENTE' ? '1' : 'ERROR';
            const d2 = item.tipoDocumento === 'CÉDULA CIUDADANÍA' ? '1'
                     : item.tipoDocumento === 'CÉDULA EXTRANJERÍA' ? '2'
                     : item.tipoDocumento === 'NIT' ? '3' : 'ERROR';
            const d6 = item.tipoCuenta === 'AHORROS' ? '37' : item.tipoCuenta === 'CORRIENTE' ? '27' : 'ERROR';
            return [item.numeroDocumento, '001', bi.banco, item.noCuenta, tc,
                    '00000509', '1', '1', item.numeroDocumento, d2, bi.dato3,
                    item.noCuenta, '', d6, '', '00000'];
        });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pago electrónico');
    triggerExcelDownload(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), 'FormatoSiesa.xlsx');
}

function downloadPlano() {
    if (hasErrors || parsedData.length === 0) return;

    const content = isExcelMode
        ? buildPlanoFromExcel(parsedData)
        : buildPlanoContent(parsedData);   // from core.js

    triggerTextDownload(content, '153101H7M48erpfinanciero@comfacauca.com.txt');
}

function buildPlanoFromExcel(data) {
    const lineas = [PLANO_HEADER];
    data.forEach((row, i) => {
        let linea = (i + 2).toString().padStart(7, '0');
        linea += '0';
        linea += '63400020011';

        linea += (row['Código del proveedor'] || '');
        linea = linea.padEnd(34, ' ');

        linea += (row['Sucursal del proveedor'] || '');
        linea += '1';
        linea += (row['Banco del proveedor'] || '');
        linea += ' '.repeat(8);

        linea += (row['Número de cuenta corriente o de ahorros'] || '');
        linea = linea.padEnd(78, ' ');

        linea += (row['Tipo de cuenta 1=cta cte 2=cta ahorro'] || '');
        linea += (row['formato'] || '');
        linea += (row['forma de pago'] || '');
        linea += (row['Cuenta por defecto 0= cta reg. no es default, 1=cta reg. es default'] || '');
        linea += '1';

        linea += (row['DATO 1'] || '');
        linea = linea.padEnd(140, ' ');
        linea += (row['DATO 2'] || '');
        linea = linea.padEnd(190, ' ');
        linea += (row['DATO 3'] || '');
        linea = linea.padEnd(240, ' ');
        linea += (row['DATO 4'] || '');
        linea = linea.padEnd(340, ' ');
        linea += (row['DATO 6'] || '');
        linea = linea.padEnd(440, ' ');
        linea += (row['DATO 8'] || '');
        linea = linea.padEnd(840, ' ');

        lineas.push(linea);
    });
    lineas.push(buildPlanoFooter(data.length));
    return lineas.join('\n');
}

/* ── Clear ───────────────────────────────────────────────────── */
function clearData() {
    fileInput.value   = '';
    parsedData        = [];
    hasErrors         = false;
    excelType         = null;
    isExcelMode       = false;

    resetFileUI();
    dataBody.innerHTML = '';
    dataHead.innerHTML = '';
    downloadButtons.style.display = 'none';
    errorMessage.style.display    = 'none';
    btnCancelar.disabled = true;
    btnExcel.disabled    = true;
    btnSiesa.disabled    = true;
    btnPlano.disabled    = true;
}
