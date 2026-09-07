import { describe, it, expect } from 'vitest';
import {
  consolidarVentas,
  filtrarPorBusqueda,
  filtrarPorTipo,
  calcularTotalesDia,
  generarNumeroTicketHotel,
  generarNumeroTicketPOS,
  descontarStock,
  obtenerAlertaStock,
  getTotalMonto
} from '@/services/ventas.service';
import type { VentaHotel, VentaPOS } from '@/services/ventas.service';

describe('ventas.service.ts', () => {
  const vHotel: VentaHotel = { 
    id: '1', numero_ticket: '000001', total: 100, fecha_pago: '2023-01-01T10:00:00Z', 
    huesped_nombre: 'Juan' 
  };
  const vPos: VentaPOS = { 
    id: '2', numero_ticket: 'P00001', total: 50, fecha_venta: '2023-01-01T12:00:00Z',
    huesped_nombre: 'Maria'
  };

  describe('consolidarVentas', () => {
    it('une y ordena ventas', () => {
      const ventas = consolidarVentas([vHotel], [vPos]);
      expect(ventas.length).toBe(2);
      expect(ventas[0]._tipo).toBe('pos'); // 12:00 > 10:00
      expect(ventas[1]._tipo).toBe('hotel');
    });
  });

  describe('filtros', () => {
    const consolidado = consolidarVentas([vHotel], [vPos]);
    
    it('filtra por busqueda', () => {
      expect(filtrarPorBusqueda(consolidado, 'juan').length).toBe(1);
      expect(filtrarPorBusqueda(consolidado, 'P00001').length).toBe(1);
    });
    
    it('filtra por tipo', () => {
      expect(filtrarPorTipo(consolidado, 'hotel').length).toBe(1);
      expect(filtrarPorTipo(consolidado, 'pos').length).toBe(1);
      expect(filtrarPorTipo(consolidado, 'todos').length).toBe(2);
    });
  });

  describe('calcularTotalesDia', () => {
    it('calcula totales correctamente', () => {
      const consolidado = consolidarVentas([vHotel], [vPos]);
      const totales = calcularTotalesDia(consolidado, '2023-01-01');
      expect(totales.total).toBe(150);
      expect(totales.hotel).toBe(100);
      expect(totales.pos).toBe(50);
    });
  });

  describe('stock y tickets', () => {
    it('genera numeros de ticket', () => {
      expect(generarNumeroTicketHotel('000005')).toBe('000006');
      expect(generarNumeroTicketPOS()).toMatch(/^POS\d{6}$/);
    });

    it('descuenta stock con limites', () => {
      const ok = descontarStock({ id: '1', nombre: 'A', stock: 10 }, 3);
      expect(ok.valido).toBe(true);
      expect(ok.nuevoStock).toBe(7);

      const insuficiente = descontarStock({ id: '1', nombre: 'A', stock: 2 }, 5);
      expect(insuficiente.valido).toBe(false);
      expect(insuficiente.nuevoStock).toBe(2); // stock sin cambios
    });

    it('alerta de stock', () => {
      expect(obtenerAlertaStock(0)).toBe('agotado');
      expect(obtenerAlertaStock(3)).toBe('bajo');
      expect(obtenerAlertaStock(10)).toBe('normal');
    });
  });

  describe('getTotalMonto y carrito', () => {
    it('suma items del carrito', () => {
      expect(getTotalMonto([
        { id: '1', nombre: 'A', precio: 10, cantidad: 2, stock: 10 },
        { id: '2', nombre: 'B', precio: 5, cantidad: 1, stock: 10 }
      ])).toBe(25);
    });

    it('agrega productos al carrito e incrementa si ya existen', async () => {
      const { agregarAlCarrito, cambiarCantidadCarrito, eliminarDelCarrito, validarStockSuficiente, filtrarPorMetodo } = await import('@/services/ventas.service');
      const item = { id: 'p1', nombre: 'Agua', precio: 3, cantidad: 1, stock: 10 };
      const carrito1 = agregarAlCarrito([], item);
      expect(carrito1).toHaveLength(1);
      expect(carrito1[0].cantidad).toBe(1);

      const carrito2 = agregarAlCarrito(carrito1, item);
      expect(carrito2).toHaveLength(1);
      expect(carrito2[0].cantidad).toBe(2);

      const carritoMod = cambiarCantidadCarrito(carrito2, 0, 5);
      expect(carritoMod[0].cantidad).toBe(5);

      const carritoElim = cambiarCantidadCarrito(carritoMod, 0, 0);
      expect(carritoElim).toHaveLength(0);

      const carritoDirectElim = eliminarDelCarrito([{ id: 'p1', nombre: 'Agua', precio: 3, cantidad: 1, stock: 10 }], 0);
      expect(carritoDirectElim).toHaveLength(0);

      expect(validarStockSuficiente({ id: 'p1', nombre: 'Agua', stock: 5 }, 3)).toBe(true);
      expect(validarStockSuficiente({ id: 'p1', nombre: 'Agua', stock: 5 }, 10)).toBe(false);

      const ventasTest = [{ id: '1', metodo_pago: 'efectivo' }, { id: '2', metodo_pago: 'yape' }] as any;
      expect(filtrarPorMetodo(ventasTest, 'todos')).toHaveLength(2);
      expect(filtrarPorMetodo(ventasTest, 'efectivo')).toHaveLength(1);
    });
  });
});
