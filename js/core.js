/**
 * core.js  –  Tesorería Comfacauca
 * Módulo compartido: mapeos, búsqueda flexible, generación de plano.
 * Importar con <script src="../js/core.js"></script>
 */

'use strict';

/* ================================================================
   MAPEOS
   ================================================================ */

const TIPO_CUENTA_MAP = { '7': 'AHORROS', '1': 'CORRIENTE' };
const TIPO_DOC_MAP = {
    '1': 'CÉDULA CIUDADANÍA', '2': 'CÉDULA EXTRANJERÍA',
    '3': 'NIT', '4': 'TARJETA IDENTIDAD', '5': 'PASAPORTE'
};

/**
 * Mapea código de tipo de cuenta a su nombre legible.
 * @param {string|null} tipo
 * @returns {string}
 */
function mapTipoCuenta(tipo) {
    return TIPO_CUENTA_MAP[tipo] ?? 'ERROR';
}

/**
 * Mapea código de tipo de documento a su nombre legible.
 * @param {string} tipo
 * @returns {string}
 */
function mapTipoDocumento(tipo) {
    return TIPO_DOC_MAP[tipo] ?? 'TIPO DESCONOCIDO';
}

/* ── Banco Map (código → nombre) ─────────────────────────────── */
const BANCO_MAP = {
    '000001014': 'ITAU',
    '000001031': 'BANCOLDEX S.A.',
    '000001040': 'BANCO AGRARIO',
    '000001047': 'BANCO MUNDO MUJER',
    '000001053': 'BANCO W S.A.',
    '000001058': 'BANCO PROCREDIT COLOMBIA',
    '000001059': 'BANCAMIA S.A.',
    '000001060': 'BANCO PICHINCHA',
    '000001061': 'BANCOOMEVA',
    '000001062': 'BANCO FALABELLA S.A.',
    '000001063': 'BANCO FINANDINA S.A.',
    '000001064': 'BANCO MULTIBANK S.A.',
    '000001065': 'BANCO SANTANDER DE NEGOCIOS COLOMBIA S.A',
    '000001066': 'BANCO COOPERATIVO COOPCENTRAL',
    '000001067': 'BANCO COMPARTIR S.A',
    '000001070': 'LULO BANK',
    '000001121': 'FINANCIERA JURISCOOP S.A.',
    '000001283': 'COOPERATIVA FINANCIERA DE ANTIOQUIA',
    '000001289': 'COOTRAFA COOPERATIVA FINANCIERA',
    '000001292': 'CONFIAR COOPERATIVA FINANCIERA',
    '000001370': 'COLTEFINANCIERA S.A',
    '000001506': 'PIBANK',
    '000001507': 'NEQUI',
    '000001808': 'BOLD CF',
    '000001809': 'NU BANK',
    '000001811': 'RAPPIPAY',
    '000001819': 'BANCO CONTACTAR SA',
    '005600010': 'BANCO DE BOGOTA',
    '005600023': 'BANCO POPULAR',
    '005600065': 'ITAU antes Corpbanca',
    '005600078': 'BANCOLOMBIA',
    '005600094': 'CITIBANK',
    '005600104': 'HSBC',
    '005600120': 'BANCO SUDAMERIS',
    '005600133': 'BBVA COLOMBIA',
    '005600191': 'BANCO COLPATRIA',
    '005600230': 'BANCO DE OCCIDENTE',
    '005600829': 'BANCO CAJA SOCIAL BCSC SA',
    '005895142': 'BANCO DAVIVIENDA SA',
    '006013677': 'BANCO AV VILLAS',
};

function mapBanco(codigo) {
    return BANCO_MAP[codigo] ?? 'DESCONOCIDO';
}

/* ── Banco Siesa Data (nombre → { banco, dato3 }) ─────────────── */
const BANCO_SIESA_DATA = {
    'BANCOLOMBIA':                          { banco: '07',   dato3: '000001007' },
    'BANCO DE BOGOTA':                      { banco: '01',   dato3: '000001001' },
    'BANCO POPULAR':                        { banco: '02',   dato3: '000001002' },
    'SANTANDER':                            { banco: '06',   dato3: '000001065' },
    'CITIBANK':                             { banco: '09',   dato3: '000001009' },
    'BANCO SUDAMERIS':                      { banco: '12',   dato3: '000001012' },
    'BBVA COLOMBIA':                        { banco: '13',   dato3: '000001013' },
    'BANCO COLPATRIA':                      { banco: '19',   dato3: '000001019' },
    'BANCO DE OCCIDENTE':                   { banco: '23',   dato3: '000001023' },
    'BANCOLDEX S.A.':                       { banco: '31',   dato3: '000001031' },
    'BANCO CAJA SOCIAL BCSC SA':            { banco: '32',   dato3: '000001032' },
    'BANCO AGRARIO':                        { banco: '40',   dato3: '000001040' },
    'BANCO DAVIVIENDA SA':                  { banco: '51',   dato3: '000001051' },
    'BANCO AV VILLAS':                      { banco: '52',   dato3: '000001052' },
    'BANCO PROCREDIT COLOMBIA':             { banco: '58',   dato3: '000001058' },
    'BANCAMIA S.A.':                        { banco: '59',   dato3: '000001059' },
    'BANCO MUNDO MUJER':                    { banco: '60',   dato3: '000001047' },
    'BANCOOMEVA':                           { banco: '61',   dato3: '000001061' },
    'BANCO FALABELLA S.A.':                 { banco: '62',   dato3: '000001062' },
    'BANCO PICHINCHA':                      { banco: '64',   dato3: '000001060' },
    'BANCO W S.A.':                         { banco: '65',   dato3: '000001053' },
    'BANCO COOPERATIVO COOPCENTRAL':        { banco: '66',   dato3: '000001066' },
    'BANCO COMPARTIR S.A':                  { banco: '67',   dato3: '000001067' },
    'BANCO FINANDINA S.A.':                 { banco: '71',   dato3: '000001063' },
    'NEQUI':                                { banco: '37',   dato3: '000001507' },
    'DAVIPLATA':                            { banco: '69',   dato3: '000001551' },
    'LULO BANK':                            { banco: '1070', dato3: '000001070' },
    'RAPPIPAY':                             { banco: '1811', dato3: '000001811' },
    'BOLD CF':                              { banco: '1808', dato3: '000001808' },
    'NU BANK':                              { banco: '1809', dato3: '000001809' },
    'PIBANK':                               { banco: '1560', dato3: '000001560' },
    'BANCO CONTACTAR SA':                   { banco: '1819', dato3: '000001819' },
    'BANCO MULTIBANK S.A.':                 { banco: '64',   dato3: '000001064' },
    'BANCO SANTANDER DE NEGOCIOS COLOMBIA S.A': { banco: '06', dato3: '000001065' },
    'FINANCIERA JURISCOOP S.A.':            { banco: '121',  dato3: '000001121' },
    'COOPERATIVA FINANCIERA DE ANTIOQUIA':  { banco: '283',  dato3: '000001283' },
    'COOTRAFA COOPERATIVA FINANCIERA':      { banco: '289',  dato3: '000001289' },
    'CONFIAR COOPERATIVA FINANCIERA':       { banco: '292',  dato3: '000001292' },
    'COLTEFINANCIERA S.A':                  { banco: '370',  dato3: '000001370' },
    'HSBC':                                 { banco: '10',   dato3: '005600104' },
    'ITAU':                                 { banco: '63',   dato3: '000001014' },
    'ITAU antes Corpbanca':                 { banco: '63',   dato3: '000000006' },
};

/**
 * Búsqueda flexible de banco por nombre.
 * Orden: exacta → parcial → palabras clave (≥2 coincidencias).
 * @param {string|null} bancoIngresado
 * @returns {{ banco: string, dato3: string }}
 */
function findBancoFlexible(bancoIngresado) {
    const NOT_FOUND = { banco: 'ERROR', dato3: '000000000' };
    if (!bancoIngresado || typeof bancoIngresado !== 'string') return NOT_FOUND;

    const input = bancoIngresado.trim();
    if (!input) return NOT_FOUND;

    const inputLower = input.toLowerCase();

    // 1. Exacta
    if (BANCO_SIESA_DATA[input]) return BANCO_SIESA_DATA[input];

    // 2. Parcial insensible a mayúsculas
    for (const [nombre, data] of Object.entries(BANCO_SIESA_DATA)) {
        const nl = nombre.toLowerCase();
        if (nl.includes(inputLower) || inputLower.includes(nl)) return data;
    }

    // 3. Palabras clave (≥2 palabras significativas)
    const palabras = inputLower.split(/\s+/).filter(p => p.length > 2);
    for (const [nombre, data] of Object.entries(BANCO_SIESA_DATA)) {
        const nl = nombre.toLowerCase();
        const hits = palabras.filter(p => nl.includes(p)).length;
        if (hits >= 2) return data;
    }

    return NOT_FOUND;
}

/* ================================================================
   GENERACIÓN DE ARCHIVO PLANO
   ================================================================ */

const PLANO_HEADER = '000000100000001001';

/**
 * Genera la línea footer del archivo plano.
 * @param {number} totalRecords
 * @returns {string}
 */
function buildPlanoFooter(totalRecords) {
    const consec = (totalRecords + 2).toString().padStart(7, '0');
    return `${consec}99990001001`;
}

/**
 * Genera una línea del archivo plano de inscripción bancaria.
 * Longitud total: 840 caracteres.
 *
 * @param {{ numeroDocumento: string, noCuenta: string }} item
 * @param {number} index  – índice base-0 en el array
 * @param {{ banco: string, dato3: string }} bancoInfo
 * @param {string} tipoCuenta  – '1' o '2'
 * @param {string} dato2       – tipo documento SIESA
 * @param {string} dato6       – '27' corriente / '37' ahorros
 * @returns {string}
 */
function buildPlanoLine(item, index, bancoInfo, tipoCuenta, dato2, dato6) {
    let linea = (index + 2).toString().padStart(7, '0');
    linea += '0';
    linea += '63400020011';

    linea += item.numeroDocumento;
    linea = linea.padEnd(34, ' ');

    linea += '001';   // sucursal
    linea += '1';
    linea += bancoInfo.banco;
    linea += ' '.repeat(8);

    linea += item.noCuenta;
    linea = linea.padEnd(78, ' ');

    linea += tipoCuenta;
    linea += '00000509';
    linea += '1';     // forma pago
    linea += '1';     // cuenta por defecto
    linea += '1';

    linea += item.numeroDocumento;
    linea = linea.padEnd(140, ' ');

    linea += dato2;
    linea = linea.padEnd(190, ' ');

    linea += bancoInfo.dato3;
    linea = linea.padEnd(240, ' ');

    linea += item.noCuenta;
    linea = linea.padEnd(340, ' ');
    linea += dato6;
    linea = linea.padEnd(440, ' ');
    linea += '00000';
    linea = linea.padEnd(840, ' ');

    return linea;
}

/**
 * Construye el contenido completo del archivo plano a partir de registros.
 * @param {Array<object>} registros  – parsedData en modo TXT
 * @returns {string}
 */
function buildPlanoContent(registros) {
    const lineas = [PLANO_HEADER];

    registros.forEach((item, index) => {
        const bancoInfo = BANCO_SIESA_DATA[item.banco] ?? findBancoFlexible(item.banco);

        const tipoCuenta = item.tipoCuenta === 'AHORROS' ? '2'
                         : item.tipoCuenta === 'CORRIENTE' ? '1' : 'ERROR';

        const dato2 = item.tipoDocumento === 'CÉDULA CIUDADANÍA'  ? '1'
                    : item.tipoDocumento === 'CÉDULA EXTRANJERÍA'  ? '2'
                    : item.tipoDocumento === 'NIT'                 ? '3'
                    : 'ERROR';

        const dato6 = item.tipoCuenta === 'AHORROS' ? '37'
                    : item.tipoCuenta === 'CORRIENTE' ? '27' : 'ERROR';

        lineas.push(buildPlanoLine(item, index, bancoInfo, tipoCuenta, dato2, dato6));
    });

    lineas.push(buildPlanoFooter(registros.length));
    return lineas.join('\n');
}

/* ================================================================
   PARSEO DE ARCHIVO TXT
   ================================================================ */

/**
 * Parsea una línea del archivo plano CSV.
 * @param {string} line
 * @param {number} lineIndex  – índice base-0
 * @returns {object|null}
 */
function parseFileLine(line, lineIndex = 0) {
    const columns = line.split(',');
    if (columns.length < 6) return null;

    const noCuenta         = columns[0].trim();
    const tipoCuentaCodigo = columns[1].trim();
    const nombreTitular    = columns[2].trim();
    const bancoCodigo      = columns[3].trim();
    const numeroDocumento  = columns[4].trim();
    const tipoDocCodigo    = columns[5].trim();

    const tipoCuenta    = mapTipoCuenta(tipoCuentaCodigo);
    const banco         = mapBanco(bancoCodigo);
    const tipoDocumento = mapTipoDocumento(tipoDocCodigo);

    const hasError = tipoCuenta === 'ERROR'
                  || banco === 'DESCONOCIDO'
                  || tipoDocumento === 'TIPO DESCONOCIDO';

    return {
        index: lineIndex + 1,
        noCuenta, tipoCuentaCodigo, tipoCuenta,
        nombreTitular, bancoCodigo, banco,
        numeroDocumento, tipoDocCodigo, tipoDocumento,
        hasError,
    };
}

/**
 * Parsea el contenido completo de un archivo plano.
 * @param {string} content
 * @returns {object[]}
 */
function parseFileContent(content) {
    return content
        .split('\n')
        .map((line, i) => parseFileLine(line, i))
        .filter(Boolean);
}

/* ================================================================
   DESCARGA DE ARCHIVOS (compatible file://)
   ================================================================ */

function triggerTextDownload(textContent, filename) {
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(textContent);
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function triggerExcelDownload(wbArrayBuffer, filename) {
    const bytes  = new Uint8Array(wbArrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    const a = document.createElement('a');
    a.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/* ================================================================
   NAVEGACIÓN
   ================================================================ */
function goToHome() {
    window.location.href = '../index.html';
}
