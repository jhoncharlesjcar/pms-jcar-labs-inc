import { describe, it, expect } from 'vitest';
import {
  validarDocumento,
  calcularNoches,
  calcularTarifaDinamica,
  verificarDisponibilidad,
  validarReserva,
} from '@/services/recepcion.service';

describe('recepcion.service.ts', () => {
  describe('validarDocumento', () => {
    it('valida DNI correctamente', () => {
      expect(validarDocumento({ tipo: 'DNI', documento: '12345678' }).valido).toBe(true);
      expect(validarDocumento({ tipo: 'DNI', documento: '1234567' }).valido).toBe(false);
      expect(validarDocumento({ tipo: 'DNI', documento: 'ABCDEFGH' }).valido).toBe(false);
    });
    it('valida RUC correctamente', () => {
      expect(validarDocumento({ tipo: 'RUC', documento: '12345678901' }).valido).toBe(true);
      expect(validarDocumento({ tipo: 'RUC', documento: '1234567890' }).valido).toBe(false);
    });
    it('valida Pasaporte y CE', () => {
      expect(validarDocumento({ tipo: 'pasaporte', documento: 'A1234567' }).valido).toBe(true);
      expect(validarDocumento({ tipo: 'CE', documento: 'CE1234567' }).valido).toBe(true);
      expect(validarDocumento({ tipo: 'pasaporte', documento: '12' }).valido).toBe(false);
    });
  });

  describe('calcularNoches', () => {
    it('calcula 1 noche para mismo dia o dia siguiente', () => {
      const mismoDia = calcularNoches({ fechaEntrada: '2023-01-01', fechaSalida: '2023-01-01' });
      expect(mismoDia.noches).toBe(1);
      expect(mismoDia.valido).toBe(false);
      const diaSiguiente = calcularNoches({ fechaEntrada: '2023-01-01', fechaSalida: '2023-01-02' });
      expect(diaSiguiente.noches).toBe(1);
      expect(diaSiguiente.valido).toBe(true);
    });
    it('calcula multiples noches', () => {
      const res = calcularNoches({ fechaEntrada: '2023-01-01', fechaSalida: '2023-01-05' });
      expect(res.noches).toBe(4);
      expect(res.valido).toBe(true);
    });
    it('retorna 1 para fechas invertidas', () => {
      const res = calcularNoches({ fechaEntrada: '2023-01-05', fechaSalida: '2023-01-01' });
      expect(res.noches).toBe(1);
      expect(res.valido).toBe(false);
    });
  });

  describe('calcularTarifaDinamica', () => {
    it('calcula tarifa sin reglas base * noches', () => {
      const res = calcularTarifaDinamica({
        fechaEntrada: '2023-01-01',
        fechaSalida: '2023-01-03', // 2 noches
        precioBase: 100,
        incluyeIgv: false
      });
      expect(res.noches).toBe(2);
      expect(res.total).toBe(200);
      expect(res.igvMonto).toBe(0);
    });
    
    it('calcula tarifa con temporada (prioridad)', () => {
      const reglas = [{
        id: '1', nombre: 'Temp Alta', tipo: 'temporada' as const,
        fecha_inicio: '2023-01-01', fecha_fin: '2023-01-10',
        habitacion_tipo: 'todos', factor_ajuste: 1.25
      }];
      const res = calcularTarifaDinamica({
        fechaEntrada: '2023-01-01', fechaSalida: '2023-01-02',
        precioBase: 100, tarifas: reglas, incluyeIgv: false
      });
      expect(res.total).toBe(125); // 1 noche * 100 * 1.25
    });

    it('calcula tarifa con IGV', () => {
      const res = calcularTarifaDinamica({
        fechaEntrada: '2023-01-01', fechaSalida: '2023-01-02',
        precioBase: 100, incluyeIgv: true
      });
      expect(res.tarifaSinIgv).toBeCloseTo(84.75, 2);
      expect(res.igvMonto).toBeCloseTo(15.25, 2);
      expect(res.total).toBe(100);
    });
  });

  describe('verificarDisponibilidad', () => {
    it('retorna true si no hay reservas', () => {
      expect(verificarDisponibilidad({
        habitacionId: '1', fechaEntrada: '2023-01-01', fechaSalida: '2023-01-03', reservasExistentes: []
      })).toBe(true);
    });

    it('retorna false si hay traslape', () => {
      const reservas = [{ habitacion_id: '1', fecha_entrada: '2023-01-01', fecha_salida: '2023-01-03', estado: 'confirmada' }];
      expect(verificarDisponibilidad({
        habitacionId: '1', fechaEntrada: '2023-01-02', fechaSalida: '2023-01-04', reservasExistentes: reservas
      })).toBe(false);
    });

    it('retorna true si hay reservas en habitacion diferente', () => {
      const reservas = [{ habitacion_id: '2', fecha_entrada: '2023-01-01', fecha_salida: '2023-01-03', estado: 'confirmada' }];
      expect(verificarDisponibilidad({
        habitacionId: '1', fechaEntrada: '2023-01-01', fechaSalida: '2023-01-03', reservasExistentes: reservas
      })).toBe(true);
    });
    
    it('ignora reservas canceladas', () => {
      const reservas = [{ habitacion_id: '1', fecha_entrada: '2023-01-01', fecha_salida: '2023-01-03', estado: 'cancelada' }];
      expect(verificarDisponibilidad({
        habitacionId: '1', fechaEntrada: '2023-01-02', fechaSalida: '2023-01-04', reservasExistentes: reservas
      })).toBe(true);
    });
  });

  describe('validarReserva', () => {
    it('falla sin habitacion', () => {
      const res = validarReserva({
        habitacionId: '', huespedNombre: 'Juan', tipoDocumento: 'DNI', huespedDni: '12345678',
        fechaEntrada: '2023-01-01', fechaSalida: '2023-01-02', numAdultos: 1,
        precioNoche: 100, total: 100
      });
      expect(res.valido).toBe(false);
    });
    
    it('falla con nombre corto', () => {
      const res = validarReserva({
        habitacionId: '1', huespedNombre: 'Ju', tipoDocumento: 'DNI', huespedDni: '12345678',
        fechaEntrada: '2023-01-01', fechaSalida: '2023-01-02', numAdultos: 1,
        precioNoche: 100, total: 100
      });
      expect(res.valido).toBe(false);
    });
    
    it('falla con menores sin observacion (Ley 30802)', () => {
      const res = validarReserva({
        habitacionId: '1', huespedNombre: 'Juan', tipoDocumento: 'DNI', huespedDni: '12345678',
        fechaEntrada: '2023-01-01', fechaSalida: '2023-01-02', numAdultos: 1, tieneMenores: true,
      });
      expect(res.valido).toBe(false);
    });
  });

  describe('transiciones y reservas online', () => {
    it('valida transiciones de estado de reserva', async () => {
      const { calcularTransicionReserva, esTransicionHabitacionValida, generarNumeroReservaOnline, construirPayloadReservaOnline } = await import('@/services/recepcion.service');
      
      expect(calcularTransicionReserva('pendiente', 'check-in')).toEqual({ nuevoEstado: 'activa', valido: true });
      expect(calcularTransicionReserva('activa', 'check-out')).toEqual({ nuevoEstado: 'finalizada', valido: true });
      expect(calcularTransicionReserva('finalizada', 'check-in').valido).toBe(false);

      expect(esTransicionHabitacionValida('disponible', 'ocupada')).toBe(true);
      expect(esTransicionHabitacionValida('ocupada', 'disponible')).toBe(true);
      expect(esTransicionHabitacionValida('mantenimiento', 'ocupada')).toBe(false);

      expect(generarNumeroReservaOnline()).toMatch(/^W\d{6}$/);

      const payload = construirPayloadReservaOnline({
        hotelId: 'h1',
        habitacionId: 'hab1',
        habitacionNumero: '101',
        habitacionTipo: 'Simple',
        huespedNombre: 'Carlos Test',
        huespedDni: '12345678',
        fechaEntrada: '2026-10-01',
        fechaSalida: '2026-10-03',
        total: 150,
      });
      expect(payload.hotel_id).toBe('h1');
      expect(payload.estado).toBe('pendiente');
      expect(payload.numero_reserva).toMatch(/^W\d{6}$/);
      expect(payload.total).toBe(150);
    });
  });
});
