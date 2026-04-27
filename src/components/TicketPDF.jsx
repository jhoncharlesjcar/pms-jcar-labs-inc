import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function TicketPDF({ venta, config }) {
    const ticketRef = useRef();

    const imprimir = () => {
        const contenido = ticketRef.current.innerHTML;
        const ventana = window.open('', '_blank', 'width=400,height=700');
        ventana.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Ticket ${venta.numero_ticket}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; background: #fff; color: #000; padding: 16px; }
          .ticket { max-width: 300px; margin: 0 auto; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .total-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 14px; font-weight: bold; }
          .big { font-size: 16px; font-weight: bold; }
          .small { font-size: 10px; color: #555; }
          .tag { display: inline-block; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        ${contenido}
      </body>
      </html>
    `);
        ventana.document.close();
    };

    return (
        <div>
            {/* Vista previa oculta para imprimir */}
            <div ref={ticketRef} style={{ display: 'none' }}>
                <div className="ticket">
                    <div className="center">
                        <div className="big">{config.nombre || 'HOSPEDAJE'}</div>
                        {config.ruc && <div className="small">RUC: {config.ruc}</div>}
                        {config.direccion && <div className="small">{config.direccion}</div>}
                        {config.telefono && <div className="small">Tel: {config.telefono}</div>}
                    </div>
                    <div className="line"></div>
                    <div className="center">
                        <div className="bold">TICKET INTERNO #{venta.numero_ticket}</div>
                        <div className="small">{new Date().toLocaleString('es-PE')}</div>
                    </div>
                    <div className="line"></div>
                    <div className="row"><span>Huésped:</span><span>{venta.huesped_nombre}</span></div>
                    {venta.huesped_dni && <div className="row"><span>DNI:</span><span>{venta.huesped_dni}</span></div>}
                    <div className="row"><span>Habitación:</span><span>#{venta.habitacion_numero} ({venta.habitacion_tipo})</span></div>
                    <div className="row"><span>Entrada:</span><span>{venta.fecha_entrada}</span></div>
                    <div className="row"><span>Salida:</span><span>{venta.fecha_salida}</span></div>
                    <div className="row"><span>Noches:</span><span>{venta.noches}</span></div>
                    <div className="line"></div>
                    <div className="row"><span>S/ {venta.precio_noche?.toFixed(2)} × {venta.noches} noche(s)</span><span>S/ {venta.subtotal?.toFixed(2)}</span></div>
                    {venta.descuento > 0 && <div className="row"><span>Descuento:</span><span>-S/ {venta.descuento?.toFixed(2)}</span></div>}
                    <div className="line"></div>
                    <div className="total-row"><span>TOTAL:</span><span>S/ {venta.total?.toFixed(2)}</span></div>
                    <div className="row"><span>Método de pago:</span><span className="tag">{venta.metodo_pago?.toUpperCase()}</span></div>
                    <div className="line"></div>
                    <div className="center small">
                        {config.mensaje_ticket || '¡Gracias por su preferencia!'}
                    </div>
                    {config.hora_checkin && (
                        <div className="center small" style={{ marginTop: '4px' }}>
                            Check-in: {config.hora_checkin} | Check-out: {config.hora_checkout}
                        </div>
                    )}
                </div>
            </div>

            {/* Previsualización bonita */}
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-5 font-mono text-xs text-gray-800 text-center space-y-1 max-w-xs mx-auto">
                <p className="font-bold text-base">{config.nombre || 'HOSPEDAJE'}</p>
                {config.ruc && <p className="text-gray-500">RUC: {config.ruc}</p>}
                <p className="text-gray-500">{config.direccion || ''}</p>
                <div className="border-t border-dashed my-2" />
                <p className="font-bold">TICKET #{venta.numero_ticket}</p>
                <p className="text-gray-500">{new Date().toLocaleString('es-PE')}</p>
                <div className="border-t border-dashed my-2" />
                <div className="flex justify-between"><span>Huésped:</span><span>{venta.huesped_nombre}</span></div>
                <div className="flex justify-between"><span>Hab. #{venta.habitacion_numero}</span><span>{venta.noches} noche(s)</span></div>
                <div className="border-t border-dashed my-2" />
                <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>S/ {venta.total?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Pago:</span><span className="capitalize">{venta.metodo_pago}</span></div>
                <div className="border-t border-dashed my-2" />
                <p className="text-gray-400 text-[10px]">{config.mensaje_ticket || '¡Gracias por su preferencia!'}</p>
            </div>

            <Button onClick={imprimir} className="w-full gap-2 mt-3" variant="outline">
                <Printer className="w-4 h-4" /> Imprimir Ticket
            </Button>
        </div>
    );
}