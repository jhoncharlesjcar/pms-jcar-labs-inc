import { useRef, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Share2 } from 'lucide-react';
import { shareTicket } from '@/modules/printer/services/sharePrinter';
import { generatePlainTextTicket } from '@/modules/printer/services/thermalPrinter';
import { toast } from 'sonner';
import ComprobanteStatus from '@/components/comprobantes/ComprobanteStatus';

const TicketPDF = memo(function TicketPDF({ venta, config }) {
    const ticketRef = useRef();

    const rucEmisor = config.ruc || '20000000000';
    const tipoComp = venta.tipo_comprobante === 'factura' ? '01' : '03'; // Factura o Boleta
    const parts = (venta.numero_ticket || 'T000001').split('-');
    const serie = parts[0]?.startsWith('T') ? 'B001' : (parts[0] || 'B001'); // B001/F001 format
    const numero = parts[1] || parts[0]?.replace('T', '') || '00000001';
    const totalVal = Number(venta.total || 0);
    const igvVal = totalVal * 0.18 / 1.18;
    const fechaStr = venta.fecha_pago ? new Date(venta.fecha_pago).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const docAdq = venta.huesped_dni || '00000000';
    const tipoDocAdq = docAdq.length === 11 ? '6' : '1'; // 6 = RUC, 1 = DNI
    const isSunatEmitted = venta.estado_comprobante === 'sunat_emitido';
    const isSunatPending = venta.estado_comprobante === 'sunat_pendiente';
    const documentTitle = isSunatEmitted
        ? (venta.tipo_comprobante === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA')
        : 'TICKET INTERNO';
    
    const qrString = `${rucEmisor}|${tipoComp}|${serie}|${numero}|${Number(igvVal).toFixed(2)}|${Number(totalVal).toFixed(2)}|${fechaStr}|${tipoDocAdq}|${docAdq}|`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(qrString)}`;

    const imprimir = () => {
        const contenido = ticketRef.current.innerHTML;
        const ventana = window.open('', '_blank', 'width=400,height=700');
        if (!ventana) {
            toast.error('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes e intenta nuevamente.');
            return;
        }
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

    const handleCompartir = async () => {
        const contenido = ticketRef.current.innerHTML;
        
        // Data estructurada para generar texto plano perfecto
        const rawData = {
            hotelName: config.nombre || 'PMS JCAR LABS',
            ruc: config.ruc,
            address: config.direccion,
            title: `${documentTitle} #${venta.numero_ticket}`,
            guestName: venta.huesped_nombre,
            documentId: venta.huesped_dni,
            roomNumber: `${venta.habitacion_numero} (${venta.habitacion_tipo})`,
            items: [
                {
                    quantity: venta.noches,
                    description: 'Noche(s) de estadía',
                    total: venta.subtotal
                }
            ],
            subTotal: undefined, // It's just subtotal
            descuento: venta.descuento > 0 ? venta.descuento : undefined,
            total: venta.total,
            paymentMethod: venta.metodo_pago
        };

        const plainText = generatePlainTextTicket(rawData, 32);
        await shareTicket(contenido, 58, plainText);
    };

    return (
        <div>
            {/* Vista previa oculta para imprimir */}
            <div ref={ticketRef} style={{ display: 'none' }}>
                <div className="ticket">
                    <div className="center">
                        <div className="big">{config.nombre || 'PMS JCAR LABS'}</div>
                        {config.ruc && <div className="small">RUC: {config.ruc}</div>}
                        {config.direccion && <div className="small">{config.direccion}</div>}
                        {config.telefono && <div className="small">Tel: {config.telefono}</div>}
                    </div>
                    <div className="line"></div>
                    <div className="center">
                        <div className="bold">{documentTitle} #{venta.numero_ticket}</div>
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
                    <div className="row"><span>S/ {Number(venta.precio_noche || 0).toFixed(2)} × {venta.noches} noche(s)</span><span>S/ {Number(venta.subtotal || 0).toFixed(2)}</span></div>
                    {Number(venta.descuento) > 0 && <div className="row"><span>Descuento:</span><span>-S/ {Number(venta.descuento).toFixed(2)}</span></div>}
                    <div className="line"></div>
                    <div className="total-row"><span>TOTAL:</span><span>S/ {totalVal.toFixed(2)}</span></div>
                    <div className="row"><span>Método de pago:</span><span className="tag">{venta.metodo_pago?.toUpperCase()}</span></div>
                    
                    <div className="line"></div>
                    
                    {isSunatEmitted ? (
                        <div className="center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '10px 0' }}>
                            <img src={qrUrl} alt="QR SUNAT" style={{ width: '90px', height: '90px', margin: '0 auto' }} />
                            <div className="small" style={{ fontSize: '8px', marginTop: '4px' }}>Representación impresa del comprobante electrónico</div>
                            <div className="small" style={{ fontSize: '8px' }}>Consulte en e-consulta.sunat.gob.pe</div>
                        </div>
                    ) : (
                        <div className="center small bold">
                            {isSunatPending ? 'PENDIENTE DE EMISIÓN SUNAT' : 'CONSTANCIA INTERNA DE PAGO'}<br />
                            NO ES COMPROBANTE TRIBUTARIO
                        </div>
                    )}
                    
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

            <ComprobanteStatus status={venta.estado_comprobante} className="mx-auto mb-3 max-w-xs" />

            {/* Previsualización bonita */}
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-5 font-mono text-xs text-gray-800 text-center space-y-1 max-w-xs mx-auto">
                <p className="font-bold text-base">{config.nombre || 'PMS JCAR LABS'}</p>
                {config.ruc && <p className="text-gray-500">RUC: {config.ruc}</p>}
                <p className="text-gray-500">{config.direccion || ''}</p>
                <div className="border-t border-dashed my-2" />
                <p className="font-bold">{documentTitle} #{venta.numero_ticket}</p>
                <p className="text-gray-500">{new Date().toLocaleString('es-PE')}</p>
                <div className="border-t border-dashed my-2" />
                <div className="flex justify-between"><span>Huésped:</span><span>{venta.huesped_nombre}</span></div>
                <div className="flex justify-between"><span>Hab. #{venta.habitacion_numero}</span><span>{venta.noches} noche(s)</span></div>
                <div className="border-t border-dashed my-2" />
                <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>S/ {totalVal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Pago:</span><span className="capitalize">{venta.metodo_pago}</span></div>
                <div className="border-t border-dashed my-2" />
                
                {isSunatEmitted ? (
                    <div className="flex flex-col items-center justify-center py-2">
                        <img src={qrUrl} alt="QR SUNAT" className="mx-auto h-20 w-20" />
                        <p className="mt-1 text-[8px] text-gray-400">Representación impresa del comprobante electrónico</p>
                    </div>
                ) : (
                    <p className="rounded bg-amber-50 px-2 py-1.5 text-[9px] font-bold text-amber-800">
                        {isSunatPending ? 'Pendiente de emisión SUNAT' : 'Constancia interna de pago'} · No es comprobante tributario
                    </p>
                )}
                
                <div className="border-t border-dashed my-2" />
                <p className="text-gray-400 text-[10px]">{config.mensaje_ticket || '¡Gracias por su preferencia!'}</p>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <Button onClick={imprimir} className="h-11 w-full gap-2" variant="outline">
                    <Printer className="w-4 h-4" /> Imprimir
                </Button>
                <Button onClick={handleCompartir} className="h-11 w-full gap-2 bg-slate-900 text-white hover:bg-slate-800">
                    <Share2 className="w-4 h-4" /> Compartir
                </Button>
            </div>
        </div>
    );
});
TicketPDF.displayName = 'TicketPDF';
export default TicketPDF;
