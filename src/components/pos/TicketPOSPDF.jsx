import { useRef, useState, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Share2 } from 'lucide-react';
import { shareTicket } from '@/modules/printer/services/sharePrinter';
import QRCode from 'qrcode';
import logger from '@/lib/logger';

/**
 * Genera el ticket de venta en formato de texto plano (32 columnas)
 */
const generatePlainTextTicketDeVenta = (venta, config, formattedNum, lineWidth = 32) => {
    const pad = (text, length, padChar = ' ', align = 'left') => {
        const str = String(text || '').substring(0, length);
        if (align === 'center') {
            const leftPad = Math.floor((length - str.length) / 2);
            const rightPad = length - str.length - leftPad;
            return padChar.repeat(leftPad) + str + padChar.repeat(rightPad);
        }
        if (align === 'right') return str.padStart(length, padChar);
        return str.padEnd(length, padChar);
    };

    const line = () => '-'.repeat(lineWidth) + '\n';
    const br = () => '\n';

    let ticket = '';

    // Header
    ticket += pad(config.nombre || 'PMS JCAR LABS', lineWidth, ' ', 'center') + br();
    if (config.ruc) ticket += pad(`RUC: ${config.ruc}`, lineWidth, ' ', 'center') + br();
    if (config.direccion) ticket += pad(config.direccion, lineWidth, ' ', 'center') + br();
    if (config.ciudad) ticket += pad(config.ciudad, lineWidth, ' ', 'center') + br();
    if (config.telefono) ticket += pad(`Tel: ${config.telefono}`, lineWidth, ' ', 'center') + br();
    ticket += line();

    // Title
    ticket += pad('TICKET DE VENTA', lineWidth, ' ', 'center') + br();
    ticket += pad(formattedNum, lineWidth, ' ', 'center') + br();
    ticket += line();

    // Metadata
    ticket += `Fecha: ${new Date(venta.fecha_venta || venta.created_date || new Date()).toLocaleDateString('es-PE')}\n`;
    ticket += `Pago: ${(venta.metodo_pago || 'efectivo').toUpperCase()}\n`;
    ticket += `Cliente: ${venta.huesped_nombre || 'Consumidor Final'}\n`;
    if (venta.huesped_dni) ticket += `DNI/Doc: ${venta.huesped_dni}\n`;
    ticket += line();

    // Items Header
    ticket += pad('Cant U.M. Descrip.', lineWidth - 8) + ' ' + pad('Importe', 7, ' ', 'right') + '\n';
    ticket += line();

    // Items
    if (venta.subtotal_estadia > 0 || venta.subtotal_estadía > 0) {
        const sub = Number(venta.subtotal_estadia || venta.subtotal_estadía).toFixed(2);
        const prefix = `1.00 NIU Hab.${venta.habitacion_numero || ''}`;
        ticket += pad(prefix, lineWidth - sub.length - 1) + ' ' + sub + '\n';
    }
    const items = Array.isArray(venta.items) ? venta.items : [];
    items.forEach(item => {
        const qty = Number(item.cantidad || 1).toFixed(2);
        const um = 'UND';
        const desc = String(item.nombre || item.descripcion || 'Prod');
        const subtotal = (Number(item.precio || item.precio_venta || 0) * Number(item.cantidad || 1)).toFixed(2);
        
        const prefix = `${qty} ${um} ${desc}`;
        ticket += pad(prefix, lineWidth - subtotal.length - 1) + ' ' + subtotal + '\n';
    });
    ticket += line();

    // Totals
    const totalVal = Number(venta.total || 0).toFixed(2);
    if (config.aplica_igv !== false) {
        const baseVal = (Number(venta.total || 0) / 1.18).toFixed(2);
        const igvVal = (Number(venta.total || 0) - Number(baseVal)).toFixed(2);
        ticket += pad('OP. GRAVADAS:', lineWidth - baseVal.length - 1) + ' ' + baseVal + '\n';
        ticket += pad('IGV 18%:', lineWidth - igvVal.length - 1) + ' ' + igvVal + '\n';
    } else {
        ticket += pad('OP. EXONERADA:', lineWidth - totalVal.length - 1) + ' ' + totalVal + '\n';
        ticket += pad('(Exonerado Ley Amazonia N.27037)', lineWidth, ' ', 'center') + br();
    }
    ticket += pad('TOTAL: S/', lineWidth - totalVal.length - 1) + ' ' + totalVal + '\n';
    ticket += line();

    // Footer
    ticket += pad('Representacion Impresa', lineWidth, ' ', 'center') + br();
    ticket += pad('de Ticket de Venta', lineWidth, ' ', 'center') + br();
    if (config.mensaje_ticket) {
        ticket += br() + pad(config.mensaje_ticket, lineWidth, ' ', 'center') + br();
    }
    ticket += br().repeat(4);

    return ticket;
};

/** @type {React.FC<{venta: any, config: any}>} */
const TicketPOSPDF = memo(function TicketPOSPDF({ venta, config }) {
    /** @type {any} */
    const ticketRef = useRef(null);
    const [qrUrl, setQrUrl] = useState('');

    const ticketNum = String(venta.numero_ticket || '').includes('POS') 
        ? String(venta.numero_ticket).replace('POS', '') 
        : String(venta.numero_ticket);
    const formattedNum = `T001-${ticketNum.replace(/\D/g, '').slice(-8).padStart(8, '0')}`;

    useEffect(() => {
        const generateQr = async () => {
            try {
                const rucEmisor = config.ruc || '20000000000';
                const totalVal = Number(venta.total || 0);
                const aplicaIgv = config.aplica_igv !== false;
                const subtotalVal = aplicaIgv ? totalVal / 1.18 : totalVal;
                const igvVal = aplicaIgv ? totalVal - subtotalVal : 0;
                const fechaStr = (venta.fecha_venta || venta.created_date) 
                    ? new Date(venta.fecha_venta || venta.created_date).toISOString().split('T')[0] 
                    : new Date().toISOString().split('T')[0];
                const docAdq = venta.huesped_dni || '00000000';
                const tipoDocAdq = docAdq.length === 11 ? '6' : '1';

                const qrString = `${rucEmisor}|T001|${formattedNum}|${igvVal.toFixed(2)}|${totalVal.toFixed(2)}|${fechaStr}|${tipoDocAdq}|${docAdq}|`;
                const url = await QRCode.toDataURL(qrString, { margin: 1, width: 100 });
                setQrUrl(url);
            } catch (err) {
                logger.error('Error generating QR for ticket:', err);
            }
        };
        generateQr();
    }, [venta, config, formattedNum]);

    const imprimir = () => {
        if (!ticketRef.current) return;
        const contenido = ticketRef.current.innerHTML;
        const ventana = window.open('', '_blank', 'width=400,height=700');
        ventana.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8" />
      <title>Ticket ${formattedNum}</title>
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

    const handleCompartir = async () => {
        if (!ticketRef.current) return;
        const contenido = ticketRef.current.innerHTML;
        const plainText = generatePlainTextTicketDeVenta(venta, config, formattedNum, 32);
        await shareTicket(contenido, 58, plainText);
    };

    const items = Array.isArray(venta.items) ? venta.items : [];

    return (
        <div>
            {/* Hidden HTML version for printing */}
            <div ref={ticketRef} style={{ display: 'none' }}>
                <div className="ticket">
                    <div className="center">
                        <div className="big">{config.nombre || 'PMS JCAR LABS'}</div>
                        {config.ruc && <div className="small">RUC: {config.ruc}</div>}
                        {config.direccion && <div className="small">{config.direccion}</div>}
                        {config.ciudad && <div className="small">{config.ciudad}</div>}
                        {config.telefono && <div className="small">Tel: {config.telefono}</div>}
                    </div>
                    <div className="line" />
                    <div className="center">
                        <div className="bold">TICKET DE VENTA</div>
                        <div className="bold">{formattedNum}</div>
                        <div className="small">
                            Fecha: {new Date(venta.fecha_venta || venta.created_date || new Date()).toLocaleString('es-PE')}
                        </div>
                    </div>
                    <div className="line" />
                    <div className="row">
                        <span>Pago:</span>
                        <span>{(venta.metodo_pago || 'efectivo').toUpperCase()}</span>
                    </div>
                    <div className="row">
                        <span>Cliente:</span>
                        <span>{venta.huesped_nombre || 'Consumidor Final'}</span>
                    </div>
                    {venta.huesped_dni && (
                        <div className="row">
                            <span>DNI/Doc:</span>
                            <span>{venta.huesped_dni}</span>
                        </div>
                    )}
                    <div className="line" />
                    
                    {/* Items */}
                    {(venta.subtotal_estadia > 0 || venta.subtotal_estadía > 0) && (
                        <div className="row">
                            <span>1.00 NIU Hospedaje Hab. {venta.habitacion_numero || ''}</span>
                            <span>S/ {Number(venta.subtotal_estadia || venta.subtotal_estadía).toFixed(2)}</span>
                        </div>
                    )}
                    {items.map((item, i) => (
                        <div key={i} className="row">
                            <span>{Number(item.cantidad || 1).toFixed(2)} UND {item.nombre}</span>
                            <span>S/ {(Number(item.precio) * Number(item.cantidad)).toFixed(2)}</span>
                        </div>
                    ))}
                    {venta.descuento > 0 && (
                        <div className="row">
                            <span>Descuento:</span>
                            <span>-S/ {Number(venta.descuento).toFixed(2)}</span>
                        </div>
                    )}
                    <div className="line" />
                    {config.aplica_igv !== false ? (
                        <>
                            <div className="row">
                                <span>OP. GRAVADAS:</span>
                                <span>S/ {(Number(venta.total || 0) / 1.18).toFixed(2)}</span>
                            </div>
                            <div className="row">
                                <span>IGV 18%:</span>
                                <span>S/ {(Number(venta.total || 0) - (Number(venta.total || 0) / 1.18)).toFixed(2)}</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="row">
                                <span>OP. EXONERADA:</span>
                                <span>S/ {Number(venta.total || 0).toFixed(2)}</span>
                            </div>
                            <div className="center small">(Exonerado Ley Amazonía N.27037)</div>
                        </>
                    )}
                    <div className="total-row">
                        <span>TOTAL:</span>
                        <span>S/ {Number(venta.total || 0).toFixed(2)}</span>
                    </div>
                    <div className="line" />
                    {qrUrl && (
                        <div className="center" style={{ margin: '10px 0' }}>
                            <img src={qrUrl} width="100" height="100" style={{ border: '1px solid #ccc', padding: '4px' }} />
                        </div>
                    )}
                    <div className="center small bold">Representacion Impresa</div>
                    <div className="center small bold">de Ticket de Venta</div>
                    {config.mensaje_ticket && (
                        <>
                            <div className="line" />
                            <div className="center small">{config.mensaje_ticket}</div>
                        </>
                    )}
                </div>
            </div>

            {/* Preview Card */}
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-4 font-mono text-[11px] text-gray-800 text-center space-y-1 max-w-xs mx-auto select-none shadow-sm">
                <p className="font-bold text-xs">{config.nombre || 'PMS JCAR LABS'}</p>
                {config.ruc && <p className="text-gray-500 text-[10px]">RUC: {config.ruc}</p>}
                {config.direccion && <p className="text-gray-400 text-[9px]">{config.direccion}</p>}
                {config.ciudad && <p className="text-gray-400 text-[9px]">{config.ciudad}</p>}
                {config.telefono && <p className="text-gray-400 text-[9px]">Tel: {config.telefono}</p>}
                <div className="border-t border-dashed my-2" />
                <p className="font-bold">TICKET DE VENTA</p>
                <p className="text-gray-600">{formattedNum}</p>
                <div className="border-t border-dashed my-2" />
                <div className="text-left space-y-0.5 text-[10px]">
                    <p>Fecha: {new Date(venta.fecha_venta || venta.created_date || new Date()).toLocaleDateString('es-PE')}</p>
                    <p>Pago: {(venta.metodo_pago || 'efectivo').toUpperCase()}</p>
                    <p>Cliente: {venta.huesped_nombre || 'Consumidor Final'}</p>
                    {venta.huesped_dni && <p>DNI/DOC: {venta.huesped_dni}</p>}
                </div>
                <div className="border-t border-dashed my-2" />
                
                {/* Items */}
                <div className="space-y-1">
                    {(venta.subtotal_estadia > 0 || venta.subtotal_estadía > 0) && (
                        <div className="flex justify-between text-[10px]">
                            <span>1.00 NIU Hospedaje Hab. {venta.habitacion_numero || ''}</span>
                            <span>S/ {Number(venta.subtotal_estadia || venta.subtotal_estadía).toFixed(2)}</span>
                        </div>
                    )}
                    {items.map((item, i) => (
                        <div key={i} className="flex justify-between text-[10px]">
                            <span>{Number(item.cantidad || 1).toFixed(2)} UND {item.nombre}</span>
                            <span>S/ {(Number(item.precio) * Number(item.cantidad)).toFixed(2)}</span>
                        </div>
                    ))}
                    {venta.descuento > 0 && (
                        <div className="flex justify-between text-green-600">
                            <span>Descuento</span>
                            <span>-S/ {Number(venta.descuento).toFixed(2)}</span>
                        </div>
                    )}
                </div>
                <div className="border-t border-dashed my-2" />
                
                {/* Totals */}
                <div className="space-y-0.5 text-right text-[10px]">
                    {config.aplica_igv !== false ? (
                        <>
                            <div className="flex justify-between"><span>OP. GRAVADAS</span><span>S/ {(Number(venta.total || 0) / 1.18).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>IGV (18%)</span><span>S/ {(Number(venta.total || 0) - (Number(venta.total || 0) / 1.18)).toFixed(2)}</span></div>
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between"><span>OP. EXONERADA</span><span>S/ {Number(venta.total || 0).toFixed(2)}</span></div>
                            <div className="center text-[9px] text-gray-500 text-center font-normal mt-0.5">(Exonerado Ley Amazonia N.27037)</div>
                        </>
                    )}
                    <div className="flex justify-between font-bold text-[11px] mt-1 text-black"><span>TOTAL</span><span>S/ {Number(venta.total || 0).toFixed(2)}</span></div>
                </div>
                
                {qrUrl && (
                    <div className="flex justify-center my-3">
                        <img src={qrUrl} alt="QR Code" className="w-24 h-24 border border-gray-200 p-1" />
                    </div>
                )}

                <div className="border-t border-dashed my-2" />
                <p className="text-[9px] font-bold">Representación Impresa</p>
                <p className="text-[9px]">de Ticket de Venta</p>
                {config.mensaje_ticket && (
                    <p className="text-[9px] text-gray-400 mt-1">{config.mensaje_ticket}</p>
                )}
            </div>

            <div className="flex gap-2 mt-4 w-full">
                <Button onClick={imprimir} className="flex-1 gap-1 text-xs h-9 px-2" variant="outline">
                    <Printer className="w-3.5 h-3.5" /> PC / Web
                </Button>
                <Button onClick={handleCompartir} className="flex-1 gap-1 text-xs h-9 px-2 bg-slate-900 hover:bg-slate-800 text-white">
                    <Share2 className="w-3.5 h-3.5" /> Android PWA
                </Button>
            </div>
        </div>
    );
});
TicketPOSPDF.displayName = 'TicketPOSPDF';
export default TicketPOSPDF;