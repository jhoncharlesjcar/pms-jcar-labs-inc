import { describe, expect, it } from 'vitest';
import { generatePlainTextComprobante } from '@/components/comprobantes/plainTextComprobante.js';

describe('generatePlainTextComprobante', () => {
  it('marks an internal ticket as non-fiscal', () => {
    const text = generatePlainTextComprobante(
      { estado_comprobante: 'ticket_interno', numero_ticket: '9', total: 10, metodo_pago: 'efectivo', items: [] },
      { nombre: 'Hotel Demo', aplica_igv: false },
      'boleta',
      '',
      '',
      '',
      'Ana',
      '',
    );
    expect(text).toContain('TICKET INTERNO');
    expect(text).toContain('NO ES COMPROBANTE TRIBUTARIO');
    expect(text).not.toContain('FACTURA ELECTRÓNICA');
  });
});
