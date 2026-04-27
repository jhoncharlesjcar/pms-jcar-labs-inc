import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function TicketPOSPDF({ venta, config }) {
    const ticketRef = useRef();

    const imprimir = () => {
        const contenido = ticketRef.current.innerHTML;
        const ventana = window.open('', '_blank', 'width=400,height=700');
        ventana.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8" />
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
        @media print { body { padding: 0; } }
      </style></head>
      <body onload="window.print(); window.close();">${contenido}</body></html>
    `);
        ventana.document.close();
    };

    const items = Array.isArray(venta.items) ? venta.items : [];

    return (
        <div>
            <div ref={ticketRef} style={{ display: 'none' }}>
                <div className="ticket">
                    <div className="center">
                        <div className="big">{config.nombre || 'HOSPEDAJE'}</div>
                        {config.ruc && <div className="small">RUC: {config.ruc}</div>}
                        {config.direccion && <div className="small">{config.direccion}</div>}
                    </div>
                    <div className="line" />
                    <div className="center">
                        <div className="bold">TICKET POS #{venta.numero_ticket}</div>
                        <div className="small">{new Date().toLocaleString('es-PE')}</div>
                    </div>
                    <div className="line" />
                    {venta.huesped_nombre && <div className="row"><span>Cliente:</span><span>{venta.huesped_nombre}</span></div>}
                    {venta.habitacion_numero && <div className="row"><span>Habitación:</span><span>#{venta.habitacion_numero}</span></div>}
                    <div className="line" />
                    {venta.subtotal_estadía > 0 && <div className="row"><span>🏨 Estadía</span><span>S/ {Number(venta.subtotal_estadía).toFixed(2)}</span></div>}
                    {items.map((item, i) => (
                        <div key={i} className="row">
                            <span>{item.nombre} ×{item.cantidad}</span>
                            <span>S/ {(item.precio * item.cantidad).toFixed(2)}</span>
                        </div>
                    ))}
                    {venta.descuento > 0 && <div className="row"><span>Descuento:</span><span>-S/ {Number(venta.descuento).toFixed(2)}</span></div>}
                    <div className="line" />
                    <div className="total-row"><span>TOTAL:</span><span>S/ {Number(venta.total).toFixed(2)}</span></div>
                    <div className="row"><span>Pago:</span><span>{venta.metodo_pago?.toUpperCase()}</span></div>
                    <div className="line" />
                    <div className="center small">{config.mensaje_ticket || '¡Gracias por su preferencia!'}</div>
                </div>
            </div>

            {/* Preview */}
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-4 font-mono text-xs text-gray-800 text-center space-y-1 max-w-xs mx-auto">
                <p className="font-bold text-sm">{config.nombre || 'HOSPEDAJE'}</p>
                {config.ruc && <p className="text-gray-500">RUC: {config.ruc}</p>}
                <div className="border-t border-dashed my-2" />
                <p className="font-bold">TICKET POS #{venta.numero_ticket}</p>
                <div className="border-t border-dashed my-2" />
                {venta.subtotal_estadía > 0 && (
                    <div className="flex justify-between"><span>🏨 Estadía</span><span>S/ {Number(venta.subtotal_estadía).toFixed(2)}</span></div>
                )}
                {items.map((item, i) => (
                    <div key={i} className="flex justify-between">
                        <span>{item.emoji || '📦'} {item.nombre} ×{item.cantidad}</span>
                        <span>S/ {(item.precio * item.cantidad).toFixed(2)}</span>
                    </div>
                ))}
                {venta.descuento > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-S/ {Number(venta.descuento).toFixed(2)}</span></div>}
                <div className="border-t border-dashed my-2" />
                <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>S/ {Number(venta.total).toFixed(2)}</span></div>
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