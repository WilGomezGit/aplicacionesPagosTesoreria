#!/usr/bin/env python3
"""
Tests TDD para validador_archivos.py
Ejecutar: python -m pytest tests/test_validador.py -v
          o: python tests/test_validador.py
"""

import sys
import os
import io
import tempfile
import unittest

# Añadir el directorio padre al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'python'))
from validador_archivos import (
    RegistroBancario, parsear_archivo, analizar,
    detectar_duplicados, exportar_csv, ALLOWED_REGEX
)


class TestRegistroBancario(unittest.TestCase):

    def _make_cols(self, no_cuenta='1234567890', tipo_cuenta='7',
                   nombre='JUAN PEREZ', banco_cod='005600078',
                   num_doc='987654321', tipo_doc='1'):
        return [no_cuenta, tipo_cuenta, nombre, banco_cod, num_doc, tipo_doc]

    def test_tipo_cuenta_ahorros(self):
        r = RegistroBancario(1, self._make_cols(tipo_cuenta='7'))
        self.assertEqual(r.tipo_cuenta, 'AHORROS')
        self.assertFalse(r.tiene_error)

    def test_tipo_cuenta_corriente(self):
        r = RegistroBancario(1, self._make_cols(tipo_cuenta='1'))
        self.assertEqual(r.tipo_cuenta, 'CORRIENTE')

    def test_tipo_cuenta_invalido(self):
        r = RegistroBancario(1, self._make_cols(tipo_cuenta='9'))
        self.assertEqual(r.tipo_cuenta, 'ERROR')
        self.assertTrue(r.tiene_error)
        self.assertTrue(any('tipo de cuenta' in e.lower() for e in r.errores))

    def test_banco_conocido(self):
        r = RegistroBancario(1, self._make_cols(banco_cod='005600078'))
        self.assertEqual(r.banco, 'BANCOLOMBIA')
        self.assertFalse(r.tiene_error)

    def test_banco_desconocido(self):
        r = RegistroBancario(1, self._make_cols(banco_cod='999999999'))
        self.assertEqual(r.banco, 'DESCONOCIDO')
        self.assertTrue(r.tiene_error)

    def test_tipo_doc_cedula(self):
        r = RegistroBancario(1, self._make_cols(tipo_doc='1'))
        self.assertEqual(r.tipo_documento, 'CÉDULA CIUDADANÍA')

    def test_tipo_doc_nit(self):
        r = RegistroBancario(1, self._make_cols(tipo_doc='3'))
        self.assertEqual(r.tipo_documento, 'NIT')

    def test_tipo_doc_invalido(self):
        r = RegistroBancario(1, self._make_cols(tipo_doc='X'))
        self.assertEqual(r.tipo_documento, 'TIPO DESCONOCIDO')
        self.assertTrue(r.tiene_error)

    def test_no_cuenta_vacio_es_error(self):
        r = RegistroBancario(1, self._make_cols(no_cuenta=''))
        self.assertTrue(r.tiene_error)
        self.assertTrue(any('cuenta' in e.lower() for e in r.errores))

    def test_nombre_vacio_es_error(self):
        r = RegistroBancario(1, self._make_cols(nombre=''))
        self.assertTrue(r.tiene_error)

    def test_numero_documento_vacio_es_error(self):
        r = RegistroBancario(1, self._make_cols(num_doc=''))
        self.assertTrue(r.tiene_error)

    def test_registro_completamente_valido(self):
        r = RegistroBancario(1, self._make_cols())
        self.assertFalse(r.tiene_error)
        self.assertEqual(len(r.errores), 0)

    def test_multiples_errores_todos_reportados(self):
        r = RegistroBancario(1, self._make_cols(
            tipo_cuenta='9', banco_cod='000000000', tipo_doc='Z'
        ))
        self.assertGreaterEqual(len(r.errores), 3)


class TestParsearArchivo(unittest.TestCase):

    def _write_temp(self, contenido: str) -> str:
        tmp = tempfile.NamedTemporaryFile(
            mode='w', suffix='.txt', delete=False, encoding='utf-8'
        )
        tmp.write(contenido)
        tmp.close()
        return tmp.name

    def tearDown(self):
        # Limpiar archivos temporales
        pass

    def test_archivo_no_existe_lanza_error(self):
        with self.assertRaises(FileNotFoundError):
            parsear_archivo('/tmp/archivo_que_no_existe_xyzabc.txt')

    def test_archivo_vacio_lanza_error(self):
        tmp = tempfile.NamedTemporaryFile(delete=False)
        tmp.close()
        with self.assertRaises(ValueError):
            parsear_archivo(tmp.name)
        os.unlink(tmp.name)

    def test_parsea_linea_valida(self):
        ruta = self._write_temp('1234567890,7,JUAN PEREZ,005600078,98765432,1\n')
        registros, invalidas = parsear_archivo(ruta)
        os.unlink(ruta)
        self.assertEqual(len(registros), 1)
        self.assertEqual(registros[0].banco, 'BANCOLOMBIA')
        self.assertEqual(len(invalidas), 0)

    def test_ignora_lineas_con_menos_de_6_columnas(self):
        ruta = self._write_temp('123,7,JUAN\n1234,7,PEDRO,005600078,98765,1\n')
        registros, _ = parsear_archivo(ruta)
        os.unlink(ruta)
        self.assertEqual(len(registros), 1)

    def test_detecta_chars_invalidos(self):
        ruta = self._write_temp('LINEA CON @CARACTERES# RAROS\n')
        _, invalidas = parsear_archivo(ruta)
        os.unlink(ruta)
        self.assertGreater(len(invalidas), 0)
        self.assertIn('@', invalidas[0][2])

    def test_acepta_acentos_y_n(self):
        ruta = self._write_temp('LÍNEA VÁLIDA CON ÑOÑO\n')
        _, invalidas = parsear_archivo(ruta)
        os.unlink(ruta)
        self.assertEqual(len(invalidas), 0)

    def test_parsea_multiples_registros(self):
        lineas = '\n'.join([
            '1234567890,7,JUAN,005600078,111,1',
            '9876543210,1,MARIA,005895142,222,3',
            '5555555555,7,PEDRO,006013677,333,1',
        ])
        ruta = self._write_temp(lineas + '\n')
        registros, _ = parsear_archivo(ruta)
        os.unlink(ruta)
        self.assertEqual(len(registros), 3)


class TestAnalizar(unittest.TestCase):

    def _make_registro(self, tipo_cuenta='7', banco_cod='005600078',
                       tipo_doc='1', num_doc='111'):
        cols = ['111', tipo_cuenta, 'NOMBRE', banco_cod, num_doc, tipo_doc]
        return RegistroBancario(1, cols)

    def test_stats_basicas(self):
        registros = [
            self._make_registro(),
            self._make_registro(banco_cod='999999999'),  # error
        ]
        stats = analizar(registros)
        self.assertEqual(stats['total'], 2)
        self.assertEqual(stats['correctos'], 1)
        self.assertEqual(stats['con_error'], 1)

    def test_porcentaje_ok(self):
        registros = [self._make_registro() for _ in range(3)]
        stats = analizar(registros)
        self.assertEqual(stats['porcentaje_ok'], 100.0)

    def test_archivo_vacio(self):
        stats = analizar([])
        self.assertEqual(stats['total'], 0)
        self.assertEqual(stats['porcentaje_ok'], 0)

    def test_detecta_duplicados(self):
        r1 = self._make_registro(num_doc='MISMO_DOC')
        r2 = self._make_registro(num_doc='MISMO_DOC')
        r3 = self._make_registro(num_doc='OTRO_DOC')
        stats = analizar([r1, r2, r3])
        self.assertIn('MISMO_DOC', stats['duplicados'])
        self.assertNotIn('OTRO_DOC', stats['duplicados'])

    def test_contador_bancos(self):
        registros = [
            self._make_registro(banco_cod='005600078'),
            self._make_registro(banco_cod='005600078'),
            self._make_registro(banco_cod='005895142'),
        ]
        stats = analizar(registros)
        self.assertEqual(stats['bancos']['BANCOLOMBIA'], 2)
        self.assertEqual(stats['bancos']['BANCO DAVIVIENDA SA'], 1)


class TestDetectarDuplicados(unittest.TestCase):

    def test_sin_duplicados(self):
        cols = lambda doc: ['111', '7', 'N', '005600078', doc, '1']
        registros = [RegistroBancario(i, cols(str(i))) for i in range(5)]
        dups = detectar_duplicados(registros)
        self.assertEqual(len(dups), 0)

    def test_con_duplicados(self):
        cols_dup = ['111', '7', 'N', '005600078', 'DOC_DUP', '1']
        cols_ok  = ['222', '7', 'N', '005600078', 'DOC_OK', '1']
        registros = [
            RegistroBancario(1, cols_dup),
            RegistroBancario(2, cols_dup),
            RegistroBancario(3, cols_ok),
        ]
        dups = detectar_duplicados(registros)
        self.assertEqual(len(dups), 2)
        self.assertTrue(all(r.numero_documento == 'DOC_DUP' for r in dups))


class TestExportarCSV(unittest.TestCase):

    def _make_registro(self):
        return RegistroBancario(1, ['1234', '7', 'NOMBRE', '005600078', '9999', '1'])

    def test_csv_tiene_encabezado(self):
        csv_str = exportar_csv([self._make_registro()])
        primera_linea = csv_str.split('\n')[0]
        self.assertIn('No. Línea', primera_linea)
        self.assertIn('No. Cuenta', primera_linea)

    def test_csv_contiene_datos(self):
        csv_str = exportar_csv([self._make_registro()])
        self.assertIn('BANCOLOMBIA', csv_str)
        self.assertIn('AHORROS', csv_str)

    def test_csv_sin_error_muestra_no(self):
        csv_str = exportar_csv([self._make_registro()])
        self.assertIn('NO', csv_str)

    def test_csv_con_error_muestra_si(self):
        r = RegistroBancario(1, ['1234', '9', 'N', '999999', '9999', 'X'])
        csv_str = exportar_csv([r])
        self.assertIn('SÍ', csv_str)

    def test_exportar_a_archivo(self):
        tmp = tempfile.NamedTemporaryFile(suffix='.csv', delete=False)
        tmp.close()
        exportar_csv([self._make_registro()], tmp.name)
        contenido = open(tmp.name, encoding='utf-8-sig').read()
        os.unlink(tmp.name)
        self.assertIn('BANCOLOMBIA', contenido)


class TestAllowedRegex(unittest.TestCase):

    def test_letras_y_numeros(self):
        self.assertTrue(ALLOWED_REGEX.match('HOLA 12345'))

    def test_acentos(self):
        self.assertTrue(ALLOWED_REGEX.match('áéíóúÁÉÍÓÚ'))

    def test_ene(self):
        self.assertTrue(ALLOWED_REGEX.match('ñÑ'))

    def test_guion(self):
        self.assertTrue(ALLOWED_REGEX.match('NOMBRE-APELLIDO'))

    def test_slash(self):
        self.assertTrue(ALLOWED_REGEX.match('DIR/ARCH'))

    def test_arroba_invalido(self):
        self.assertIsNone(ALLOWED_REGEX.match('@'))

    def test_corchetes_invalidos(self):
        self.assertIsNone(ALLOWED_REGEX.match('[hola]'))

    def test_punto_invalido(self):
        self.assertIsNone(ALLOWED_REGEX.match('hola.mundo'))


if __name__ == '__main__':
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    clases = [
        TestRegistroBancario,
        TestParsearArchivo,
        TestAnalizar,
        TestDetectarDuplicados,
        TestExportarCSV,
        TestAllowedRegex,
    ]

    for cls in clases:
        suite.addTests(loader.loadTestsFromTestCase(cls))

    runner = unittest.TextTestRunner(verbosity=2)
    resultado = runner.run(suite)
    sys.exit(0 if resultado.wasSuccessful() else 1)
