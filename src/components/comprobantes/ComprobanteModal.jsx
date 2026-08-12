import { useState, useEffect, useRef, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import logger from '@/lib/logger';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useComprobantesPDF } from '@/hooks/useComprobantesPDF';
import { shareTicket } from '@/modules/printer/services/sharePrinter';
import { Printer, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { useIdentity } from '@/hooks/useIdentity';

/**
 * Genera el ticket SUNAT en formato de texto plano (32 columnas)
 */
const generatePlainTextComprobante = (ventaPos, hotel, tipoComprobante, rucCliente, razonSocial, dniCliente, nombreCliente, hash, lineWidth = 32) => {
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
    ticket += pad(hotel.nombre || 'HOSPEDAJE', lineWidth, ' ', 'center') + br();
    if (hotel.ruc) ticket += pad(`RUC: ${hotel.ruc}`, lineWidth, ' ', 'center') + br();
    if (hotel.direccion) ticket += pad(hotel.direccion, lineWidth, ' ', 'center') + br();
    if (hotel.ciudad) ticket += pad(hotel.ciudad, lineWidth, ' ', 'center') + br();
    if (hotel.telefono) ticket += pad(`Tel: ${hotel.telefono}`, lineWidth, ' ', 'center') + br();
    ticket += line();

    // Title / Invoice details
    const tipoLabel = tipoComprobante === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
    const serieNum = `${tipoComprobante === 'factura' ? 'F001' : 'B001'}-${String(ventaPos.numero_ticket || '1').replace(/\D/g, '').padStart(8, '0')}`;
    ticket += pad(tipoLabel, lineWidth, ' ', 'center') + br();
    ticket += pad(serieNum, lineWidth, ' ', 'center') + br();
    ticket += line();

    // Metadata
    ticket += `Fecha: ${new Date(ventaPos.fecha_venta || new Date()).toLocaleDateString('es-PE')}\n`;
    ticket += `Pago: ${(ventaPos.metodo_pago || 'efectivo').toUpperCase()}\n`;

    // Client Info
    if (tipoComprobante === 'factura') {
        ticket += `RUC: ${rucCliente || '—'}\n`;
        ticket += `Razon: ${razonSocial || '—'}\n`;
    } else {
        ticket += `Cliente: ${nombreCliente || 'Consumidor Final'}\n`;
        if (dniCliente) ticket += `DNI/Doc: ${dniCliente}\n`;
    }
    ticket += line();

    // Items Header
    ticket += pad('Cant U.M. Descrip.', lineWidth - 8) + ' ' + pad('Importe', 7, ' ', 'right') + '\n';
    ticket += line();

    // Items
    if (ventaPos.subtotal_estadia > 0) {
        const qty = '1.00';
        const um = 'NIU';
        const desc = `Hab.${ventaPos.habitacion_numero || ''}`;
        const subtotal = Number(ventaPos.subtotal_estadia).toFixed(2);
        
        const prefix = `${qty} ${um} ${desc}`;
        const totalStr = `${subtotal}`;
        const remainingSpace = lineWidth - totalStr.length - 1;
        ticket += pad(prefix, remainingSpace) + ' ' + totalStr + '\n';
    }
    const items = Array.isArray(ventaPos.items) ? ventaPos.items : [];
    items.forEach(item => {
        const qty = Number(item.cantidad || 1).toFixed(2);
        const um = 'UND';
        const desc = String(item.nombre || item.descripcion || 'Prod');
        const subtotal = (Number(item.precio || item.precio_venta || 0) * Number(item.cantidad || 1)).toFixed(2);
        
        const prefix = `${qty} ${um} ${desc}`;
        const totalStr = `${subtotal}`;
        const remainingSpace = lineWidth - totalStr.length - 1;
        ticket += pad(prefix, remainingSpace) + ' ' + totalStr + '\n';
    });
    ticket += line();

    // Totals
    const totalVal = Number(ventaPos.total || 0).toFixed(2);
    if (hotel.aplica_igv !== false) {
        const baseVal = (Number(ventaPos.total || 0) / 1.18).toFixed(2);
        const igvVal = (Number(ventaPos.total || 0) - Number(baseVal)).toFixed(2);
        ticket += pad('OP. GRAVADAS:', lineWidth - baseVal.length - 1) + ' ' + baseVal + '\n';
        ticket += pad('IGV 18%:', lineWidth - igvVal.length - 1) + ' ' + igvVal + '\n';
    } else {
        ticket += pad('OP. EXONERADA:', lineWidth - totalVal.length - 1) + ' ' + totalVal + '\n';
        ticket += pad('(Exonerado Ley Amazonia N.27037)', lineWidth, ' ', 'center') + br();
    }
    ticket += pad('TOTAL: S/', lineWidth - totalVal.length - 1) + ' ' + totalVal + '\n';
    ticket += line();

    // Cryptographic Hash
    if (hash) {
        ticket += `Hash: ${hash}\n`;
        ticket += line();
    }

    // SUNAT Footer
    ticket += pad('Representacion Impresa', lineWidth, ' ', 'center') + br();
    ticket += pad(`de la ${tipoComprobante === 'factura' ? 'Factura' : 'Boleta'} Electronica`, lineWidth, ' ', 'center') + br();
    ticket += pad('Verifica en:', lineWidth, ' ', 'center') + br();
    ticket += pad('e-consulta.sunat.gob.pe', lineWidth, ' ', 'center') + br();
    if (hotel.mensaje_ticket) {
        ticket += br() + pad(hotel.mensaje_ticket, lineWidth, ' ', 'center') + br();
    }
    ticket += br().repeat(4);

    return ticket;
};

/**
 * Modal to select billing document type (Boleta or Factura),
 * fill/validate buyer details, download A4 PDF, and print 58mm thermal ticket.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {any} props.ventaPos
 * @param {any} props.hotel
 * @param {function} props.onEmitido
 */
const ComprobanteModal = memo(function ComprobanteModal(/** @type {any} */ { isOpen, onClose, ventaPos, hotel, onEmitido }) {
  const { generarPDF } = useComprobantesPDF();
  const ticketRef = useRef(null);
  
  const [tipoComprobante, setTipoComprobante] = useState('boleta');
  const [rucCliente, setRucCliente] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [dniCliente, setDniCliente] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [hash, setHash] = useState('');
  
  const [cargando, setCargando] = useState(false);
  const { fetchIdentity, loadingIdentity } = useIdentity();

  // Autocompletado de RUC
  useEffect(() => {
    if (tipoComprobante === 'factura' && rucCliente.length === 11) {
      fetchIdentity('RUC', rucCliente).then(res => {
        if (res?.data?.razonSocial) {
          setRazonSocial(res.data.razonSocial);
          toast.success(`Datos fiscales obtenidos (${res.source})`);
        }
      });
    }
  }, [rucCliente, tipoComprobante]);

  // Autocompletado de DNI
  useEffect(() => {
    if (tipoComprobante === 'boleta' && dniCliente.length === 8) {
      fetchIdentity('DNI', dniCliente).then(res => {
        if (res?.data?.nombreCompleto) {
          setNombreCliente(res.data.nombreCompleto);
          toast.success(`Identidad verificada (${res.source})`);
        }
      });
    }
  }, [dniCliente, tipoComprobante]);

  useEffect(() => {
    if (ventaPos) {
      setTipoComprobante(ventaPos.tipo_comprobante === 'factura' ? 'factura' : 'boleta');
      setDniCliente(ventaPos.huesped_dni || '');
      setNombreCliente(ventaPos.huesped_nombre || '');
      setRucCliente(ventaPos.ruc_cliente || '');
      setRazonSocial(ventaPos.razon_social || '');
    }
  }, [ventaPos]);

  // Query actual Resumen Hash from database if emitted
  useEffect(() => {
    const fetchHash = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const serie = tipoComprobante === 'factura' ? 'F001' : 'B001';
        const parts = (ventaPos?.numero_ticket || '1').split('-');
        const numeroTicket = parts[1] || parts[0]?.replace(/\D/g, '') || '1';
        const numero = String(numeroTicket).padStart(8, '0');

        const { data: compData } = await supabase
          .from('comprobantes')
          .select('id')
          .eq('hotel_id', ventaPos.hotel_id)
          .eq('tipo', tipoComprobante === 'factura' ? 'Factura' : 'Boleta')
          .eq('serie', serie)
          .eq('numero', numero)
          .maybeSingle();

        if (compData?.id) {
          const { data: xmlData } = await supabase
            .from('comprobante_xml')
            .select('hash')
            .eq('comprobante_id', compData.id)
            .maybeSingle();

          if (xmlData?.hash) {
            setHash(xmlData.hash.substring(0, 28).toUpperCase() + '...');
          }
        }
      } catch (err) {
        logger.error('Error fetching hash:', err);
      }
    };

    if (ventaPos && ventaPos.estado_comprobante === 'sunat_emitido') {
      fetchHash();
    } else {
      setHash('');
    }
  }, [ventaPos, tipoComprobante]);

  // Generate QR Code dynamically
  useEffect(() => {
    const generateQr = async () => {
      try {
        const rucEmisor = hotel.ruc || '20000000000';
        const tipoComp = tipoComprobante === 'factura' ? '01' : '03';
        const parts = (ventaPos?.numero_ticket || '1').split('-');
        const serie = tipoComprobante === 'factura' ? 'F001' : 'B001';
        const numeroTicket = parts[1] || parts[0]?.replace(/\D/g, '') || '1';
        const numero = String(numeroTicket).padStart(8, '0');
        
        const aplicaIgv = hotel.aplica_igv !== false;
        const totalVal = Number(ventaPos?.total || 0);
        const subtotalVal = aplicaIgv ? totalVal / 1.18 : totalVal;
        const igvVal = aplicaIgv ? totalVal - subtotalVal : 0;
        const fechaStr = ventaPos?.fecha_venta ? new Date(ventaPos.fecha_venta).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        
        const docAdq = tipoComprobante === 'factura' ? (rucCliente || '00000000000') : (dniCliente || '00000000');
        const tipoDocAdq = docAdq.length === 11 ? '6' : '1';

        const qrString = `${rucEmisor}|${tipoComp}|${serie}|${numero}|${igvVal.toFixed(2)}|${totalVal.toFixed(2)}|${fechaStr}|${tipoDocAdq}|${docAdq}|`;
        const url = await QRCode.toDataURL(qrString, { margin: 1, width: 100 });
        setQrUrl(url);
      } catch (err) {
        logger.error('Error generating QR for preview:', err);
      }
    };
    if (ventaPos) {
      generateQr();
    }
  }, [ventaPos, tipoComprobante, rucCliente, dniCliente, hotel]);

  const validarCampos = () => {
    if (tipoComprobante === 'factura') {
      if (!rucCliente || rucCliente.trim().length !== 11) {
        toast.error('El RUC debe tener exactamente 11 dígitos.');
        return false;
      }
      if (!razonSocial || razonSocial.trim().length === 0) {
        toast.error('Debe ingresar la Razón Social.');
        return false;
      }
    } else {
      if (!dniCliente || dniCliente.trim().length < 8) {
        toast.error('El DNI/Documento debe tener al menos 8 dígitos.');
        return false;
      }
      if (!nombreCliente || nombreCliente.trim().length === 0) {
        toast.error('Debe ingresar el nombre del cliente.');
        return false;
      }
    }
    return true;
  };

  const handleDescargarPDF = async () => {
    if (!validarCampos()) return;

    setCargando(true);
    try {
      const ventaConDatos = {
        ...ventaPos,
        tipo_comprobante: tipoComprobante,
        huesped_nombre: tipoComprobante === 'factura' ? razonSocial : nombreCliente,
        huesped_dni: tipoComprobante === 'factura' ? rucCliente : dniCliente,
        ruc_cliente: tipoComprobante === 'factura' ? rucCliente : '',
        razon_social: tipoComprobante === 'factura' ? razonSocial : '',
      };
      const filename = await generarPDF(ventaConDatos, hotel, tipoComprobante);
      if (onEmitido) onEmitido(filename, tipoComprobante);
      onClose();
    } catch (err) {
      logger.error(err);
    } finally {
      setCargando(false);
    }
  };

  const imprimirHtml = () => {
    if (!validarCampos()) return;
        const printContent = ticketRef.current?.innerHTML;
    const ventana = window.open('', '_blank', 'width=400,height=700');
    ventana.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8" />
      <title>Comprobante ${tipoComprobante === 'factura' ? 'F001' : 'B001'}-${String(ventaPos.numero_ticket || '1').replace(/\D/g, '').padStart(8, '0')}</title>
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
      <body onload="window.print(); window.close();">${printContent}</body></html>
    `);
    ventana.document.close();
  };

  const handleCompartirPWA = async () => {
    if (!validarCampos()) return;

    const contenido = ticketRef.current.innerHTML;
    const plainText = generatePlainTextComprobante(
        ventaPos,
        hotel,
        tipoComprobante,
        rucCliente,
        razonSocial,
        dniCliente,
        nombreCliente,
        hash,
        32
    );
    await shareTicket(contenido, 58, plainText);
    if (onEmitido) onEmitido('thermal-pwa', tipoComprobante);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border/50 rounded-[2rem] p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display font-black text-xl text-purple-600">
            🧾 Emitir Comprobante SUNAT
          </DialogTitle>
        </DialogHeader>

        {/* Hidden Html container for print and share fallback */}
        <div ref={ticketRef} style={{ display: 'none' }}>
          <div className="ticket">
            <div className="center">
              <div className="big">{hotel.nombre || 'PMS JCAR LABS'}</div>
              {hotel.ruc && <div className="small">RUC: {hotel.ruc}</div>}
              {hotel.direccion && <div className="small">{hotel.direccion}</div>}
              {hotel.ciudad && <div className="small">{hotel.ciudad}</div>}
              {hotel.telefono && <div className="small">Tel: {hotel.telefono}</div>}
            </div>
            <div className="line" />
            <div className="center">
              <div className="bold">
                {tipoComprobante === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA'}
              </div>
              <div className="bold">
                {tipoComprobante === 'factura' ? 'F001' : 'B001'}-
                {String(ventaPos.numero_ticket || '1').replace(/\D/g, '').padStart(8, '0')}
              </div>
              <div className="small">
                Fecha: {new Date(ventaPos.fecha_venta || new Date()).toLocaleString('es-PE')}
              </div>
            </div>
            <div className="line" />
            <div className="row">
              <span>Pago:</span>
              <span>{(ventaPos.metodo_pago || 'efectivo').toUpperCase()}</span>
            </div>
            {tipoComprobante === 'factura' ? (
              <>
                <div className="row">
                  <span>RUC:</span>
                  <span>{rucCliente}</span>
                </div>
                <div className="row">
                  <span>Razón Social:</span>
                  <span>{razonSocial}</span>
                </div>
              </>
            ) : (
              <>
                <div className="row">
                  <span>Cliente:</span>
                  <span>{nombreCliente}</span>
                </div>
                {dniCliente && (
                  <div className="row">
                    <span>DNI/Doc:</span>
                    <span>{dniCliente}</span>
                  </div>
                )}
              </>
            )}
            <div className="line" />
            
            {/* Items */}
            {ventaPos.subtotal_estadia > 0 && (
              <div className="row">
                <span>1.00 NIU Hospedaje Hab. {ventaPos.habitacion_numero || ''}</span>
                <span>S/ {Number(ventaPos.subtotal_estadia).toFixed(2)}</span>
              </div>
            )}
            {Array.isArray(ventaPos.items) && ventaPos.items.map((item, i) => (
              <div key={i} className="row">
                <span>{Number(item.cantidad || 1).toFixed(2)} UND {item.nombre || item.descripcion}</span>
                <span>S/ {(Number(item.precio || item.precio_venta || 0) * Number(item.cantidad || 1)).toFixed(2)}</span>
              </div>
            ))}
            <div className="line" />
            {hotel.aplica_igv !== false ? (
              <>
                <div className="row">
                  <span>OP. GRAVADAS:</span>
                  <span>S/ {(Number(ventaPos.total || 0) / 1.18).toFixed(2)}</span>
                </div>
                <div className="row">
                  <span>IGV 18%:</span>
                  <span>S/ {(Number(ventaPos.total || 0) - (Number(ventaPos.total || 0) / 1.18)).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="row">
                  <span>OP. EXONERADA:</span>
                  <span>S/ {Number(ventaPos.total || 0).toFixed(2)}</span>
                </div>
                <div className="center small">(Exonerado Ley Amazonia N.27037)</div>
              </>
            )}
            <div className="total-row">
              <span>TOTAL:</span>
              <span>S/ {Number(ventaPos.total || 0).toFixed(2)}</span>
            </div>
            
            {hash && (
              <>
                <div className="line" />
                <div className="row text-[10px]">
                  <span>Hash:</span>
                  <span className="bold">{hash}</span>
                </div>
              </>
            )}

            <div className="line" />
            {qrUrl && (
              <div className="center" style={{ margin: '10px 0' }}>
                <img src={qrUrl} width="100" height="100" style={{ border: '1px solid #ccc', padding: '4px' }} />
              </div>
            )}
            <div className="center small bold">Representacion Impresa</div>
            <div className="center small bold">de la {tipoComprobante === 'factura' ? 'Factura' : 'Boleta'} Electronica</div>
            <div className="center small">Verifica en: e-consulta.sunat.gob.pe</div>
            {hotel.mensaje_ticket && (
              <>
                <div className="line" />
                <div className="center small">{hotel.mensaje_ticket}</div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Tipo de Comprobante</Label>
            <Select value={tipoComprobante} onValueChange={setTipoComprobante}>
              <SelectTrigger className="mt-1 bg-background/50 h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="boleta">Boleta de Venta</SelectItem>
                <SelectItem value="factura">Factura</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoComprobante === 'boleta' && (
            <div className="space-y-3">
              <div>
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                  DNI / Documento del Cliente
                  {loadingIdentity && <span className="ml-2 animate-pulse text-purple-500">Buscando...</span>}
                </Label>
                <Input
                  className="mt-1 bg-background/50 h-11 rounded-xl"
                  value={dniCliente}
                  onChange={(e) => setDniCliente(e.target.value)}
                  placeholder="Ej. 12345678"
                  maxLength={8}
                />
              </div>
              <div>
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nombre Completo</Label>
                <Input
                  className="mt-1 bg-background/50 h-11 rounded-xl"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                />
              </div>
            </div>
          )}

          {tipoComprobante === 'factura' && (
            <div className="space-y-3">
              <div>
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                  RUC del Cliente
                  {loadingIdentity && <span className="ml-2 animate-pulse text-purple-500">Consultando SUNAT...</span>}
                </Label>
                <Input
                  className="mt-1 bg-background/50 h-11 rounded-xl"
                  value={rucCliente}
                  onChange={(e) => setRucCliente(e.target.value)}
                  placeholder="Ej. 20601234567"
                  maxLength={11}
                />
              </div>
              <div>
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Razón Social</Label>
                <Input
                  className="mt-1 bg-background/50 h-11 rounded-xl"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  placeholder="Ej. Mi Empresa S.A.C."
                />
              </div>
            </div>
          )}

          {/* Ticket preview card */}
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-4 font-mono text-[11px] text-gray-800 text-center space-y-1 max-w-xs mx-auto select-none shadow-sm mt-2">
            <p className="font-bold text-xs">{hotel.nombre || 'PMS JCAR LABS'}</p>
            {hotel.ruc && <p className="text-gray-500 text-[10px]">RUC: {hotel.ruc}</p>}
            {hotel.direccion && <p className="text-gray-400 text-[9px]">{hotel.direccion}</p>}
            {hotel.ciudad && <p className="text-gray-400 text-[9px]">{hotel.ciudad}</p>}
            {hotel.telefono && <p className="text-gray-400 text-[9px]">Tel: {hotel.telefono}</p>}
            <div className="border-t border-dashed my-2" />
            <p className="font-bold">{tipoComprobante === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA'}</p>
            <p className="text-gray-600">
              {tipoComprobante === 'factura' ? 'F001' : 'B001'}-
              {String(ventaPos.numero_ticket || '1').replace(/\D/g, '').padStart(8, '0')}
            </p>
            <div className="border-t border-dashed my-2" />
            <div className="text-left space-y-0.5 text-[10px]">
              <p>Fecha: {new Date(ventaPos.fecha_venta || new Date()).toLocaleDateString('es-PE')}</p>
              <p>Pago: {(ventaPos.metodo_pago || 'efectivo').toUpperCase()}</p>
              {tipoComprobante === 'factura' ? (
                <>
                  <p>RUC: {rucCliente || '—'}</p>
                  <p>Razón Social: {razonSocial || '—'}</p>
                </>
              ) : (
                <>
                  <p>Cliente: {nombreCliente || 'Consumidor Final'}</p>
                  {dniCliente && <p>DNI/DOC: {dniCliente}</p>}
                </>
              )}
            </div>
            <div className="border-t border-dashed my-2" />
            
            {/* Items */}
            <div className="space-y-1">
              {ventaPos.subtotal_estadia > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span>1.00 NIU Hospedaje Hab. {ventaPos.habitacion_numero || ''}</span>
                  <span>S/ {Number(ventaPos.subtotal_estadia).toFixed(2)}</span>
                </div>
              )}
              {Array.isArray(ventaPos.items) && ventaPos.items.map((item, i) => (
                <div key={i} className="flex justify-between text-[10px]">
                  <span>{Number(item.cantidad || 1).toFixed(2)} UND {item.nombre || item.descripcion}</span>
                  <span>S/ {(Number(item.precio || item.precio_venta || 0) * Number(item.cantidad || 1)).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed my-2" />
            
            {/* Totals */}
            <div className="space-y-0.5 text-right text-[10px]">
              {hotel.aplica_igv !== false ? (
                <>
                  <div className="flex justify-between"><span>OP. GRAVADAS</span><span>S/ {(Number(ventaPos.total || 0) / 1.18).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>IGV (18%)</span><span>S/ {(Number(ventaPos.total || 0) - (Number(ventaPos.total || 0) / 1.18)).toFixed(2)}</span></div>
                </>
              ) : (
                <>
                  <div className="flex justify-between"><span>OP. EXONERADA</span><span>S/ {Number(ventaPos.total || 0).toFixed(2)}</span></div>
                  <div className="center text-[9px] text-gray-500 text-center font-normal mt-0.5">(Exonerado Ley Amazonia N.27037)</div>
                </>
              )}
              <div className="flex justify-between font-bold text-[11px] mt-1 text-black"><span>TOTAL</span><span>S/ {Number(ventaPos.total || 0).toFixed(2)}</span></div>
            </div>
            
            {hash && (
              <>
                <div className="border-t border-dashed my-2" />
                <div className="flex justify-between text-[10px] text-gray-600 font-bold">
                  <span>Hash:</span>
                  <span className="truncate max-w-[150px]">{hash}</span>
                </div>
              </>
            )}

            {qrUrl && (
              <div className="flex justify-center my-3">
                <img src={qrUrl} alt="QR Code SUNAT" className="w-24 h-24 border border-gray-200 p-1" />
              </div>
            )}

            <div className="border-t border-dashed my-2" />
            <p className="text-[9px] font-bold">Representación Impresa</p>
            <p className="text-[9px]">de la {tipoComprobante === 'factura' ? 'Factura' : 'Boleta de Venta'} Electrónica</p>
            <p className="text-[9px] text-gray-500">Verifica en: e-consulta.sunat.gob.pe</p>
            {hotel.mensaje_ticket && (
              <p className="text-[9px] text-gray-400 mt-1">{hotel.mensaje_ticket}</p>
            )}
          </div>
        </div>

        {/* Buttons matching TicketPOSPDF */}
        <div className="flex gap-2 mt-4">
          <Button onClick={imprimirHtml} className="w-full gap-2" variant="outline">
            <Printer className="w-4 h-4" /> PC / Web
          </Button>
          <Button onClick={handleCompartirPWA} className="w-full gap-2 bg-slate-900 hover:bg-slate-800 text-white">
            <Share2 className="w-4 h-4" /> Android PWA
          </Button>
        </div>

        {/* PDF and Close Actions */}
        <div className="space-y-2 mt-4">
          <Button
            onClick={handleDescargarPDF}
            disabled={cargando}
            className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-11 font-bold"
          >
            {cargando ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generando PDF...
              </>
            ) : (
              <>📄 Descargar PDF A4</>
            )}
          </Button>

          <Button variant="ghost" className="w-full" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
ComprobanteModal.displayName = 'ComprobanteModal';
export default ComprobanteModal;
