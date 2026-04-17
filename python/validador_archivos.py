#!/usr/bin/env python3
"""
=============================================================
validador_archivos.py  –  Tesorería Comfacauca
=============================================================
Módulo Python de análisis y validación de archivos planos
de inscripción bancaria. Complementa la app web con:
  - Validación offline de archivos .txt
  - Análisis estadístico de datos
  - Detección de duplicados
  - Reporte en consola y CSV
=============================================================
Uso:
    python validador_archivos.py archivo.txt
    python validador_archivos.py --help
"""

import sys
import re
import csv
import io
from pathlib import Path
from datetime import datetime
from collections import Counter


# ─── Constantes ──────────────────────────────────────────────

TIPO_CUENTA = {'7': 'AHORROS', '1': 'CORRIENTE'}
TIPO_DOC = {
    '1': 'CÉDULA CIUDADANÍA',
    '2': 'CÉDULA EXTRANJERÍA',
    '3': 'NIT',
    '4': 'TARJETA IDENTIDAD',
    '5': 'PASAPORTE',
}
BANCO_MAP = {
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
    '000001507': 'NEQUI',
    '000001809': 'NU BANK',
    '000001811': 'RAPPIPAY',
    '000001819': 'BANCO CONTACTAR SA',
    '005600010': 'BANCO DE BOGOTA',
    '005600023': 'BANCO POPULAR',
    '005600078': 'BANCOLOMBIA',
    '005600133': 'BBVA COLOMBIA',
    '005600191': 'BANCO COLPATRIA',
    '005600230': 'BANCO DE OCCIDENTE',
    '005600829': 'BANCO CAJA SOCIAL BCSC SA',
    '005895142': 'BANCO DAVIVIENDA SA',
    '006013677': 'BANCO AV VILLAS',
}

# Regex: solo letras, números, espacios, acentos, ñ, /, \, :, -
ALLOWED_REGEX = re.compile(
    r'^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\/\\:\-,]+$'
)


# ─── Dataclass liviana ───────────────────────────────────────

class RegistroBancario:
    """Representa una línea del archivo plano."""
    __slots__ = (
        'linea_num', 'no_cuenta', 'tipo_cuenta_cod', 'tipo_cuenta',
        'nombre_titular', 'banco_cod', 'banco',
        'numero_documento', 'tipo_doc_cod', 'tipo_documento',
        'errores',
    )

    def __init__(self, linea_num, cols):
        self.linea_num       = linea_num
        self.no_cuenta       = cols[0].strip()
        self.tipo_cuenta_cod = cols[1].strip()
        self.nombre_titular  = cols[2].strip()
        self.banco_cod       = cols[3].strip()
        self.numero_documento= cols[4].strip()
        self.tipo_doc_cod    = cols[5].strip()

        self.tipo_cuenta   = TIPO_CUENTA.get(self.tipo_cuenta_cod, 'ERROR')
        self.banco         = BANCO_MAP.get(self.banco_cod, 'DESCONOCIDO')
        self.tipo_documento= TIPO_DOC.get(self.tipo_doc_cod, 'TIPO DESCONOCIDO')
        self.errores       = self._detectar_errores()

    def _detectar_errores(self) -> list:
        errs = []
        if self.tipo_cuenta == 'ERROR':
            errs.append(f'Tipo de cuenta inválido: "{self.tipo_cuenta_cod}"')
        if self.banco == 'DESCONOCIDO':
            errs.append(f'Código de banco desconocido: "{self.banco_cod}"')
        if self.tipo_documento == 'TIPO DESCONOCIDO':
            errs.append(f'Tipo de documento inválido: "{self.tipo_doc_cod}"')
        if not self.no_cuenta:
            errs.append('Número de cuenta vacío')
        if not self.numero_documento:
            errs.append('Número de documento vacío')
        if not self.nombre_titular:
            errs.append('Nombre del titular vacío')
        return errs

    @property
    def tiene_error(self) -> bool:
        return len(self.errores) > 0


# ─── Funciones de parseo ─────────────────────────────────────

def parsear_archivo(ruta: str) -> tuple[list, list]:
    """
    Lee el archivo plano y devuelve (registros, lineas_invalidas).
    lineas_invalidas: lista de (num_linea, linea) con chars no permitidos.
    """
    path = Path(ruta)
    if not path.exists():
        raise FileNotFoundError(f'Archivo no encontrado: {ruta}')
    if path.stat().st_size == 0:
        raise ValueError('El archivo está vacío')

    registros = []
    lineas_invalidas = []

    with open(ruta, encoding='utf-8', errors='replace') as f:
        for num, linea in enumerate(f, start=1):
            linea = linea.rstrip('\n').rstrip('\r')

            # Validar caracteres permitidos
            if linea and not ALLOWED_REGEX.match(linea):
                chars_invalidos = [
                    ch for ch in linea if not ALLOWED_REGEX.match(ch)
                ]
                lineas_invalidas.append((num, linea, chars_invalidos))

            # Parsear columnas
            cols = linea.split(',')
            if len(cols) >= 6:
                registros.append(RegistroBancario(num, cols))

    return registros, lineas_invalidas


# ─── Análisis estadístico ────────────────────────────────────

def analizar(registros: list) -> dict:
    """Genera estadísticas del archivo procesado."""
    total     = len(registros)
    con_error = sum(1 for r in registros if r.tiene_error)
    correctos = total - con_error

    bancos      = Counter(r.banco for r in registros)
    tipos_cuenta= Counter(r.tipo_cuenta for r in registros)
    tipos_doc   = Counter(r.tipo_documento for r in registros)

    # Duplicados por número de documento
    docs = [r.numero_documento for r in registros]
    duplicados = {doc: cnt for doc, cnt in Counter(docs).items() if cnt > 1}

    return {
        'total': total,
        'correctos': correctos,
        'con_error': con_error,
        'porcentaje_ok': round(correctos / total * 100, 1) if total else 0,
        'bancos': dict(bancos.most_common()),
        'tipos_cuenta': dict(tipos_cuenta),
        'tipos_documento': dict(tipos_doc),
        'duplicados': duplicados,
    }


def detectar_duplicados(registros: list) -> list:
    """Retorna lista de registros con número de documento duplicado."""
    docs = [r.numero_documento for r in registros]
    dup_docs = {doc for doc, cnt in Counter(docs).items() if cnt > 1}
    return [r for r in registros if r.numero_documento in dup_docs]


# ─── Exportar CSV ─────────────────────────────────────────────

def exportar_csv(registros: list, ruta_salida: str | None = None) -> str:
    """Exporta registros a CSV. Retorna el contenido como string."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        'No. Línea', 'No. Cuenta', 'Tipo Cuenta', 'Nombre Titular',
        'Banco', 'No. Documento', 'Tipo Documento', 'Tiene Error', 'Errores'
    ])

    for r in registros:
        writer.writerow([
            r.linea_num, r.no_cuenta, r.tipo_cuenta, r.nombre_titular,
            r.banco, r.numero_documento, r.tipo_documento,
            'SÍ' if r.tiene_error else 'NO',
            '; '.join(r.errores) if r.errores else ''
        ])

    contenido = output.getvalue()

    if ruta_salida:
        Path(ruta_salida).write_text(contenido, encoding='utf-8-sig')
        print(f'CSV exportado: {ruta_salida}')

    return contenido


# ─── Reporte en consola ───────────────────────────────────────

def imprimir_reporte(registros, lineas_invalidas, stats):
    SEP = '─' * 60
    print(f'\n{SEP}')
    print('  REPORTE DE VALIDACIÓN – Tesorería Comfacauca')
    print(f'  {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print(SEP)

    print(f'\n📊 RESUMEN GENERAL')
    print(f'   Total registros : {stats["total"]}')
    print(f'   Correctos       : {stats["correctos"]}  ({stats["porcentaje_ok"]}%)')
    print(f'   Con errores     : {stats["con_error"]}')

    if lineas_invalidas:
        print(f'\n⚠️  LÍNEAS CON CARACTERES INVÁLIDOS ({len(lineas_invalidas)}):')
        for num, linea, chars in lineas_invalidas[:10]:
            chars_str = ', '.join(f'"{c}"' for c in set(chars))
            print(f'   Línea {num}: {chars_str}')
        if len(lineas_invalidas) > 10:
            print(f'   ... y {len(lineas_invalidas) - 10} más')

    if stats['con_error'] > 0:
        print(f'\n❌ REGISTROS CON ERRORES:')
        errores = [r for r in registros if r.tiene_error]
        for r in errores[:15]:
            print(f'   Línea {r.linea_num}: {", ".join(r.errores)}')
        if len(errores) > 15:
            print(f'   ... y {len(errores) - 15} más')

    if stats['duplicados']:
        print(f'\n🔁 DOCUMENTOS DUPLICADOS ({len(stats["duplicados"])}):')
        for doc, cnt in list(stats['duplicados'].items())[:10]:
            print(f'   {doc}: {cnt} veces')

    print(f'\n🏦 DISTRIBUCIÓN POR BANCO:')
    for banco, cnt in list(stats['bancos'].items())[:10]:
        bar = '█' * min(cnt, 30)
        print(f'   {banco:<40} {cnt:>4}  {bar}')

    print(f'\n💳 TIPO DE CUENTA:')
    for tipo, cnt in stats['tipos_cuenta'].items():
        print(f'   {tipo:<15} {cnt}')

    estado = '✅ ARCHIVO VÁLIDO' if stats['con_error'] == 0 and not lineas_invalidas else '⚠️  REVISAR ERRORES'
    print(f'\n{SEP}')
    print(f'  {estado}')
    print(f'{SEP}\n')


# ─── Entrypoint ──────────────────────────────────────────────

def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('--help', '-h'):
        print(__doc__)
        print('Ejemplo: python validador_archivos.py pagos_enero.txt')
        sys.exit(0)

    ruta = sys.argv[1]

    try:
        registros, lineas_invalidas = parsear_archivo(ruta)
    except (FileNotFoundError, ValueError) as e:
        print(f'❌ Error: {e}')
        sys.exit(1)

    if not registros:
        print('⚠️  El archivo no contiene registros válidos (mínimo 6 columnas por línea).')
        sys.exit(1)

    stats = analizar(registros)
    imprimir_reporte(registros, lineas_invalidas, stats)

    # Exportar CSV automáticamente
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    csv_out = f'reporte_{ts}.csv'
    exportar_csv(registros, csv_out)

    sys.exit(0 if stats['con_error'] == 0 else 2)


if __name__ == '__main__':
    main()
