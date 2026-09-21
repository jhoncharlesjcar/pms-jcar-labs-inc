-- Idempotent operational seed for hotel PMS JCAR LABS.
-- Demo guests only. Safe to re-run.

DO $$
DECLARE
  hid uuid := '6dbaf2c2-e294-460a-87f0-26e914a10a5d';
  hoy date := (timezone('America/Lima', now()))::date;
  r103 uuid;
  r201 uuid;
  cat_beb uuid;
  cat_sna uuid;
  cat_hig uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.hoteles WHERE id = hid) THEN
    RETURN;
  END IF;

  INSERT INTO public.habitaciones (hotel_id, numero, piso, tipo, estado, precio, precio_noche, capacidad)
  SELECT hid, v.numero, v.piso, v.tipo, v.estado, v.precio, v.precio, v.capacidad
  FROM (VALUES
    ('101','1','simple','disponible',80::numeric,2),
    ('102','1','simple','disponible',80,2),
    ('103','1','matrimonial','ocupada',110,2),
    ('104','1','doble','disponible',100,3),
    ('201','2','suite','disponible',160,4),
    ('202','2','doble','disponible',100,3),
    ('203','2','simple','disponible',80,2),
    ('204','2','matrimonial','disponible',110,2),
    ('301','3','doble','disponible',100,3),
    ('302','3','simple','mantenimiento',80,2)
  ) AS v(numero, piso, tipo, estado, precio, capacidad)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.habitaciones h WHERE h.hotel_id = hid AND h.numero = v.numero
  );

  SELECT id INTO r103 FROM public.habitaciones WHERE hotel_id = hid AND numero = '103';
  SELECT id INTO r201 FROM public.habitaciones WHERE hotel_id = hid AND numero = '201';

  IF r103 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.reservas r WHERE r.hotel_id = hid AND r.habitacion_id = r103 AND r.estado = 'activa'
  ) THEN
    INSERT INTO public.reservas (
      hotel_id, habitacion_id, habitacion_numero, habitacion_tipo,
      huesped_nombre, huesped_dni, tipo_documento, huesped_telefono,
      fecha_entrada, fecha_salida, noches, precio_noche, total,
      num_adultos, estado, origen, numero_reserva, nacionalidad, motivo_viaje
    ) VALUES (
      hid, r103, '103', 'matrimonial',
      'Demo Huésped', '10000001', 'DNI', '999000001',
      hoy, hoy + 1, 1, 110, 110,
      2, 'activa', 'recepcion', 'PMS-DEMO-103', 'Peruana', 'turismo'
    );
  END IF;

  IF r201 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.reservas r WHERE r.hotel_id = hid AND r.numero_reserva = 'PMS-DEMO-201'
  ) THEN
    INSERT INTO public.reservas (
      hotel_id, habitacion_id, habitacion_numero, habitacion_tipo,
      huesped_nombre, huesped_dni, tipo_documento,
      fecha_entrada, fecha_salida, noches, precio_noche, total,
      num_adultos, estado, origen, numero_reserva, nacionalidad, motivo_viaje
    ) VALUES (
      hid, r201, '201', 'suite',
      'Reserva Mañana', '10000002', 'DNI',
      hoy + 1, hoy + 3, 2, 160, 320,
      2, 'pendiente', 'recepcion', 'PMS-DEMO-201', 'Peruana', 'negocios'
    );
  END IF;

  INSERT INTO public.categorias_productos (hotel_id, nombre)
  SELECT hid, v.nombre
  FROM (VALUES ('Bebidas'), ('Snacks'), ('Higiene')) AS v(nombre)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorias_productos c WHERE c.hotel_id = hid AND c.nombre = v.nombre
  );

  SELECT id INTO cat_beb FROM public.categorias_productos WHERE hotel_id = hid AND nombre = 'Bebidas';
  SELECT id INTO cat_sna FROM public.categorias_productos WHERE hotel_id = hid AND nombre = 'Snacks';
  SELECT id INTO cat_hig FROM public.categorias_productos WHERE hotel_id = hid AND nombre = 'Higiene';

  INSERT INTO public.productos (hotel_id, categoria_id, nombre, precio_venta, stock, activo)
  SELECT hid, v.cat, v.nombre, v.precio, v.stock, true
  FROM (VALUES
    (cat_beb, 'Agua San Mateo 500ml', 2.50::numeric, 40),
    (cat_beb, 'Inca Kola 500ml', 3.00, 30),
    (cat_sna, 'Papas Lays Clásicas', 4.00, 24),
    (cat_sna, 'Galletas Oreo', 2.50, 20),
    (cat_hig, 'Jabón de tocador', 3.00, 15)
  ) AS v(cat, nombre, precio, stock)
  WHERE v.cat IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.productos p WHERE p.hotel_id = hid AND p.nombre = v.nombre
    );

  INSERT INTO public.servicios_extra (hotel_id, nombre, categoria, precio, disponible, stock)
  SELECT hid, v.nombre, v.categoria, v.precio, true, 20
  FROM (VALUES
    ('Desayuno buffet', 'alimentos', 25.00::numeric),
    ('Late check-out', 'hospedaje', 40.00),
    ('Traslado aeropuerto', 'transporte', 50.00)
  ) AS v(nombre, categoria, precio)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.servicios_extra s WHERE s.hotel_id = hid AND s.nombre = v.nombre
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.ventas_pos v WHERE v.hotel_id = hid AND v.numero_ticket = 'POS-DEMO-001'
  ) THEN
    INSERT INTO public.ventas_pos (
      hotel_id, numero_ticket, tipo, huesped_nombre, items,
      subtotal_extras, total, metodo_pago, estado_comprobante, tipo_comprobante, fecha_venta
    ) VALUES (
      hid, 'POS-DEMO-001', 'solo_extras', 'Cliente mostrador',
      '[{"nombre":"Agua San Mateo 500ml","cantidad":2,"precio":2.5}]'::jsonb,
      5.00, 5.00, 'efectivo', 'ticket_interno', 'ninguno',
      timezone('America/Lima', now())
    );
  END IF;

  INSERT INTO public.ai_hotel_config (hotel_id, agent_enabled, agent_name, welcome_message)
  SELECT hid, false, 'JCAR', 'Hola, soy el asistente del hotel.'
  WHERE NOT EXISTS (SELECT 1 FROM public.ai_hotel_config c WHERE c.hotel_id = hid);
END $$;
