/**
 * ============================================================
 * TESTS TDD – Tesorería Comfacauca
 * Cobertura: mapTipoCuenta, mapBanco, mapTipoDocumento,
 *            findBancoFlexible, detectExcelType,
 *            parseFileLine, validateFileContent, buildPlanoLine
 * Ejecutar: node tests/test_core.js
 * ============================================================
 */

'use strict';

// ─── Mini test runner ─────────────────────────────────────────
let passed = 0, failed = 0;

function test(description, fn) {
    try {
        fn();
        console.log(`  ✅ ${description}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ ${description}`);
        console.error(`     ${err.message}`);
        failed++;
    }
}

function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected)
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        },
        toEqual: (expected) => {
            const a = JSON.stringify(actual), b = JSON.stringify(expected);
            if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
        },
        toBeNull: () => {
            if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
        },
        toContain: (str) => {
            if (!actual.includes(str))
                throw new Error(`Expected "${actual}" to contain "${str}"`);
        },
        toBeTruthy: () => { if (!actual) throw new Error(`Expected truthy, got ${actual}`); },
        toBeFalsy:  () => { if (actual)  throw new Error(`Expected falsy, got ${actual}`); },
        toHaveLength: (n) => {
            if (actual.length !== n)
                throw new Error(`Expected length ${n}, got ${actual.length}`);
        },
    };
}

// ─── Módulos bajo prueba (reimplementados aquí para Node) ─────

// ----- mapTipoCuenta -----
function mapTipoCuenta(tipo) {
    if (tipo === '7') return 'AHORROS';
    if (tipo === '1') return 'CORRIENTE';
    return 'ERROR';
}

// ----- mapTipoDocumento -----
function mapTipoDocumento(tipo) {
    const map = {
        '1': 'CÉDULA CIUDADANÍA',
        '2': 'CÉDULA EXTRANJERÍA',
        '3': 'NIT',
        '4': 'TARJETA IDENTIDAD',
        '5': 'PASAPORTE'
    };
    return map[tipo] || 'TIPO DESCONOCIDO';
}

// ----- bancoMap -----
const bancoMap = {
    '000001507': 'NEQUI',
    '005600078': 'BANCOLOMBIA',
    '005600133': 'BBVA COLOMBIA',
    '005895142': 'BANCO DAVIVIENDA SA',
    '006013677': 'BANCO AV VILLAS',
    '005600010': 'BANCO DE BOGOTA',
};

function mapBanco(codigo) {
    return bancoMap[codigo] || 'DESCONOCIDO';
}

// ----- bancoSiesaData (subset) -----
const bancoSiesaData = {
    'BANCOLOMBIA':          { banco: '07', dato3: '000001007' },
    'BANCO DE BOGOTA':      { banco: '01', dato3: '000001001' },
    'NEQUI':                { banco: '37', dato3: '000001507' },
    'BANCO DAVIVIENDA SA':  { banco: '51', dato3: '000001051' },
    'BBVA COLOMBIA':        { banco: '13', dato3: '000001013' },
    'BANCO AV VILLAS':      { banco: '52', dato3: '000001052' },
};

// ----- findBancoFlexible (CORREGIDA respecto al original) -----
function findBancoFlexible(bancoIngresado) {
    if (!bancoIngresado || typeof bancoIngresado !== 'string') {
        return { banco: 'ERROR', dato3: '000000000' };
    }
    const bancoLower = bancoIngresado.toLowerCase().trim();

    // 1. Coincidencia exacta
    if (bancoSiesaData[bancoIngresado]) return bancoSiesaData[bancoIngresado];

    // 2. Coincidencia parcial (insensible a mayúsculas)
    for (const nombre of Object.keys(bancoSiesaData)) {
        const nombreLower = nombre.toLowerCase();
        if (nombreLower.includes(bancoLower) || bancoLower.includes(nombreLower)) {
            return bancoSiesaData[nombre];
        }
    }

    // 3. Palabras clave (≥2 palabras de más de 2 letras)
    const palabras = bancoLower.split(/\s+/).filter(p => p.length > 2);
    for (const nombre of Object.keys(bancoSiesaData)) {
        const nombreLower = nombre.toLowerCase();
        const hits = palabras.filter(p => nombreLower.includes(p)).length;
        if (hits >= 2) return bancoSiesaData[nombre];
    }

    return { banco: 'ERROR', dato3: '000000000' };
}

// ----- detectExcelType -----
function detectExcelType(headers) {
    const siesaHeaders = [
        'Código del proveedor',
        'Banco del proveedor',
        'Número de cuenta corriente o de ahorros',
        'Tipo de cuenta 1=cta cte 2=cta ahorro'
    ];
    return siesaHeaders.every(h => headers.includes(h)) ? 'siesa' : 'simple';
}

// ----- parseFileLine (NUEVA función extraída y corregida) -----
function parseFileLine(line) {
    const columns = line.split(',');
    if (columns.length < 6) return null;

    const noCuenta          = columns[0].trim();
    const tipoCuentaCodigo  = columns[1].trim();
    const nombreTitular     = columns[2].trim();
    const bancoCodigo       = columns[3].trim();
    const numeroDocumento   = columns[4].trim();
    const tipoDocCodigo     = columns[5].trim();

    const tipoCuenta    = mapTipoCuenta(tipoCuentaCodigo);
    const banco         = mapBanco(bancoCodigo);
    const tipoDocumento = mapTipoDocumento(tipoDocCodigo);

    const hasError = tipoCuenta === 'ERROR' || banco === 'DESCONOCIDO' || tipoDocumento === 'TIPO DESCONOCIDO';

    return { noCuenta, tipoCuentaCodigo, tipoCuenta, nombreTitular,
             bancoCodigo, banco, numeroDocumento, tipoDocumento, hasError };
}

// ----- validateFileContent (CORREGIDA: acepta acentos) -----
function validateFileContent(content) {
    const allowedRegex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\/\\:\-]+$/;
    const lines = content.split(/\r\n|\n/);
    const errors = [];

    lines.forEach((line, i) => {
        if (line.length === 0) return;
        if (!allowedRegex.test(line)) {
            const invalid = [...line].filter(ch => !allowedRegex.test(ch));
            errors.push({ lineNumber: i + 1, line, invalidChars: invalid });
        }
    });

    return { hasErrors: errors.length > 0, errors };
}

// ----- buildPlanoHeader -----
function buildPlanoHeader() {
    return '000000100000001001';
}

// ----- buildPlanoFooter -----
function buildPlanoFooter(totalRecords) {
    const consec = (totalRecords + 2).toString().padStart(7, '0');
    return `${consec}99990001001`;
}

// ----- buildPlanoLine (NUEVA función, extraída y documentada) -----
function buildPlanoLine(item, index, bancoInfo, tipoCuenta, dato2, dato6) {
    let linea = (index + 2).toString().padStart(7, '0');
    linea += '0';
    linea += '63400020011';

    linea += item.numeroDocumento;
    linea = linea.padEnd(34, ' ');

    linea += '001';
    linea += '1';
    linea += bancoInfo.banco;
    linea += ' '.repeat(8);

    linea += item.noCuenta;
    linea = linea.padEnd(78, ' ');

    linea += tipoCuenta;
    linea += '00000509';
    linea += '1';
    linea += '1';
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

// ─── SUITE: mapTipoCuenta ────────────────────────────────────
console.log('\n📋 mapTipoCuenta');
test('código 7 → AHORROS',    () => expect(mapTipoCuenta('7')).toBe('AHORROS'));
test('código 1 → CORRIENTE',  () => expect(mapTipoCuenta('1')).toBe('CORRIENTE'));
test('código vacío → ERROR',  () => expect(mapTipoCuenta('')).toBe('ERROR'));
test('código 0 → ERROR',      () => expect(mapTipoCuenta('0')).toBe('ERROR'));
test('código null → ERROR',   () => expect(mapTipoCuenta(null)).toBe('ERROR'));
test('código 99 → ERROR',     () => expect(mapTipoCuenta('99')).toBe('ERROR'));

// ─── SUITE: mapTipoDocumento ─────────────────────────────────
console.log('\n🪪 mapTipoDocumento');
test('1 → CÉDULA CIUDADANÍA',  () => expect(mapTipoDocumento('1')).toBe('CÉDULA CIUDADANÍA'));
test('2 → CÉDULA EXTRANJERÍA', () => expect(mapTipoDocumento('2')).toBe('CÉDULA EXTRANJERÍA'));
test('3 → NIT',                () => expect(mapTipoDocumento('3')).toBe('NIT'));
test('4 → TARJETA IDENTIDAD',  () => expect(mapTipoDocumento('4')).toBe('TARJETA IDENTIDAD'));
test('5 → PASAPORTE',          () => expect(mapTipoDocumento('5')).toBe('PASAPORTE'));
test('X → TIPO DESCONOCIDO',   () => expect(mapTipoDocumento('X')).toBe('TIPO DESCONOCIDO'));
test('vacío → TIPO DESCONOCIDO', () => expect(mapTipoDocumento('')).toBe('TIPO DESCONOCIDO'));

// ─── SUITE: mapBanco ─────────────────────────────────────────
console.log('\n🏦 mapBanco');
test('000001507 → NEQUI',           () => expect(mapBanco('000001507')).toBe('NEQUI'));
test('005600078 → BANCOLOMBIA',      () => expect(mapBanco('005600078')).toBe('BANCOLOMBIA'));
test('código inválido → DESCONOCIDO', () => expect(mapBanco('999999999')).toBe('DESCONOCIDO'));
test('vacío → DESCONOCIDO',         () => expect(mapBanco('')).toBe('DESCONOCIDO'));

// ─── SUITE: findBancoFlexible ────────────────────────────────
console.log('\n🔍 findBancoFlexible');
test('coincidencia exacta BANCOLOMBIA',        () => {
    const r = findBancoFlexible('BANCOLOMBIA');
    expect(r.banco).toBe('07');
});
test('variante parcial "bancolombia"',         () => {
    const r = findBancoFlexible('bancolombia');
    expect(r.banco).toBe('07');
});
test('banco inexistente → ERROR',              () => {
    const r = findBancoFlexible('BANCO IMAGINARIO XYZ');
    expect(r.banco).toBe('ERROR');
});
test('input null → ERROR',                    () => {
    const r = findBancoFlexible(null);
    expect(r.banco).toBe('ERROR');
});
test('input vacío → ERROR',                   () => {
    const r = findBancoFlexible('');
    expect(r.banco).toBe('ERROR');
});
test('palabras clave "banco bogota" coincide', () => {
    const r = findBancoFlexible('banco de bogota');
    expect(r.banco).toBe('01');
});

// ─── SUITE: detectExcelType ──────────────────────────────────
console.log('\n📊 detectExcelType');
test('headers siesa → siesa', () => {
    const headers = [
        'Código del proveedor',
        'Banco del proveedor',
        'Número de cuenta corriente o de ahorros',
        'Tipo de cuenta 1=cta cte 2=cta ahorro',
        'DATO 1'
    ];
    expect(detectExcelType(headers)).toBe('siesa');
});
test('headers simples → simple', () => {
    const headers = ['NUMERO DOCUMENTO', 'NUMERO DE CUENTA', 'NOMBRE BANCO'];
    expect(detectExcelType(headers)).toBe('simple');
});
test('headers vacíos → simple', () => {
    expect(detectExcelType([])).toBe('simple');
});

// ─── SUITE: parseFileLine ────────────────────────────────────
console.log('\n📄 parseFileLine');
test('línea válida AHORROS con BANCOLOMBIA', () => {
    const line = '1234567890,7,JUAN PEREZ,005600078,1234567890,1';
    const r = parseFileLine(line);
    expect(r.tipoCuenta).toBe('AHORROS');
    expect(r.banco).toBe('BANCOLOMBIA');
    expect(r.tipoDocumento).toBe('CÉDULA CIUDADANÍA');
    expect(r.hasError).toBe(false);
});
test('línea con banco desconocido → hasError', () => {
    const line = '1234567890,7,JUAN,999999999,1234567890,1';
    const r = parseFileLine(line);
    expect(r.hasError).toBe(true);
});
test('línea con tipo cuenta inválido → hasError', () => {
    const line = '1234567890,9,JUAN,005600078,1234567890,1';
    const r = parseFileLine(line);
    expect(r.hasError).toBe(true);
});
test('línea con < 6 columnas → null', () => {
    expect(parseFileLine('123,7,JUAN')).toBeNull();
});
test('línea vacía → null', () => {
    expect(parseFileLine('')).toBeNull();
});
test('espacios en blanco son trimados', () => {
    const line = ' 123 , 7 , JUAN , 005600078 , 99 , 1 ';
    const r = parseFileLine(line);
    expect(r.noCuenta).toBe('123');
    expect(r.tipoCuenta).toBe('AHORROS');
});

// ─── SUITE: validateFileContent ──────────────────────────────
console.log('\n✅ validateFileContent');
test('archivo limpio → sin errores', () => {
    const r = validateFileContent('HOLA MUNDO 12345\nSEGUNDA LINEA');
    expect(r.hasErrors).toBe(false);
    expect(r.errors).toHaveLength(0);
});
test('línea con @ → error detectado', () => {
    const r = validateFileContent('HOLA@MUNDO');
    expect(r.hasErrors).toBe(true);
    expect(r.errors[0].invalidChars).toContain('@');
});
test('línea vacía es aceptada', () => {
    const r = validateFileContent('LINEA1\n\nLINEA3');
    expect(r.hasErrors).toBe(false);
});
test('línea con CRLF es aceptada', () => {
    const r = validateFileContent('LINEA1\r\nLINEA2');
    expect(r.hasErrors).toBe(false);
});
test('acentos y ñ son permitidos', () => {
    const r = validateFileContent('áéíóúÁÉÍÓÚñÑ');
    expect(r.hasErrors).toBe(false);
});
test('múltiples chars inválidos son todos reportados', () => {
    const r = validateFileContent('HOLA@#$MUNDO');
    expect(r.errors[0].invalidChars.length).toBe(3);
});

// ─── SUITE: buildPlanoLine ───────────────────────────────────
console.log('\n🏗️  buildPlanoLine');
test('línea tiene exactamente 840 caracteres', () => {
    const item = { numeroDocumento: '12345678', noCuenta: '9876543210' };
    const bancoInfo = { banco: '07', dato3: '000001007' };
    const linea = buildPlanoLine(item, 0, bancoInfo, '2', '1', '37');
    expect(linea.length).toBe(840);
});
test('inicia con consecutivo 0000002 para índice 0', () => {
    const item = { numeroDocumento: '12345678', noCuenta: '9876543210' };
    const bancoInfo = { banco: '07', dato3: '000001007' };
    const linea = buildPlanoLine(item, 0, bancoInfo, '2', '1', '37');
    expect(linea.substring(0, 7)).toBe('0000002');
});
test('contiene el número de cuenta en posición correcta', () => {
    const item = { numeroDocumento: '12345678', noCuenta: 'CUENTATEST' };
    const bancoInfo = { banco: '07', dato3: '000001007' };
    const linea = buildPlanoLine(item, 0, bancoInfo, '2', '1', '37');
    expect(linea).toContain('CUENTATEST');
});

// ─── SUITE: buildPlanoHeader / Footer ────────────────────────
console.log('\n📝 buildPlanoHeader / buildPlanoFooter');
test('header es exactamente "000000100000001001"', () => {
    expect(buildPlanoHeader()).toBe('000000100000001001');
});
test('footer para 3 registros empieza con 0000005', () => {
    expect(buildPlanoFooter(3).substring(0, 7)).toBe('0000005');
});
test('footer contiene 99990001001', () => {
    expect(buildPlanoFooter(5)).toContain('99990001001');
});

// ─── RESUMEN ─────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | ✅ Pasados: ${passed} | ❌ Fallidos: ${failed}`);
if (failed > 0) process.exit(1);
