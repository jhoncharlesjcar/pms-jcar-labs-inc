import { useState, useEffect, useRef, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import logger from '@/lib/logger';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useComprobantesPDF } from '@/hooks/useComprobantesPDF';
import { shareTicket } from '@/modules/printer/services/sharePrinter';
import { Download, FileText, Printer, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { useIdentity } from '@/hooks/useIdentity';
import ComprobanteStatus from './ComprobanteStatus';
import NotaComprobanteDialog from './NotaComprobanteDialog';

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
    const isSunatEmitted = ventaPos.estado_comprobante === 'sunat_emitido';
    const isSunatPending = ventaPos.estado_comprobante === 'sunat_pendiente';
    const tipoLabel = isSunatEmitted
        ? (tipoComprobante === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA')
        : (isSunatPending ? 'BORRADOR PENDIENTE SUNAT' : 'TICKET INTERNO');
    const serieNum = isSunatEmitted
        ? `${tipoComprobante === 'factura' ? 'F001' : 'B001'}-${String(ventaPos.numero_ticket || '1').replace(/\D/g, '').padStart(8, '0')}`
        : `TICKET #${ventaPos.numero_ticket || '1'}`;
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

    // Pie tributario o constancia informativa según el estado real.
    if (isSunatEmitted) {
        ticket += pad('Representacion Impresa', lineWidth, ' ', 'center') + br();
        ticket += pad(`de la ${tipoComprobante === 'factura' ? 'Factura' : 'Boleta'} Electronica`, lineWidth, ' ', 'center') + br();
        ticket += pad('Verifica en:', lineWidth, ' ', 'center') + br();
        ticket += pad('e-consulta.sunat.gob.pe', lineWidth, ' ', 'center') + br();
    } else {
        ticket += pad(isSunatPending ? 'PENDIENTE DE EMISION SUNAT' : 'CONSTANCIA INTERNA DE PAGO', lineWidth, ' ', 'center') + br();
        ticket += pad('NO ES COMPROBANTE TRIBUTARIO', lineWidth, ' ', 'center') + br();
    }
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
  const [comprobanteData, setComprobanteData] = useState(null);
  const [notaOpen, setNotaOpen] = useState(false);
  
  const [cargando, setCargando] = useState(false);
  const { fetchIdentity, loadingIdentity } = useIdentity();
  const isSunatEmitted = ventaPos?.estado_comprobante === 'sunat_emitido';
  const isSunatPending = ventaPos?.estado_comprobante === 'sunat_pendiente';
  const documentTitle = isSunatEmitted
    ? (tipoComprobante === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA')
    : (isSunatPending ? 'BORRADOR PENDIENTE SUNAT' : 'TICKET INTERNO');
  const documentNumber = isSunatEmitted
    ? `${tipoComprobante === 'factura' ? 'F001' : 'B001'}-${String(ventaPos?.numero_ticket || '1').replace(/\D/g, '').padStart(8, '0')}`
    : `TICKET #${ventaPos?.numero_ticket || '1'}`;

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
        const { supabase } = await import('@/config/supabase');
        const serie = tipoComprobante === 'factura' ? 'F001' : 'B001';
        const parts = (ventaPos?.numero_ticket || '1').split('-');
        const numeroTicket = parts[1] || parts[0]?.replace(/\D/g, '') || '1';
        const numero = String(numeroTicket).padStart(8, '0');

        const { data: compData } = await supabase
          .from('comprobantes')
          .select('id, tipo, serie, numero, subtotal, igv, total')
          .eq('hotel_id', ventaPos.hotel_id)
          .eq('tipo', tipoComprobante === 'factura' ? 'Factura' : 'Boleta')
          .eq('serie', serie)
          .eq('numero', numero)
          .maybeSingle();

        if (compData?.id) {
          setComprobanteData(compData);
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
    if (ventaPos?.estado_comprobante === 'sunat_emitido') {
      generateQr();
    } else {
      setQrUrl('');
    }
  }, [ventaPos, tipoComprobante, rucCliente, dniCliente, hotel]);

  const validationMessage = (() => {
    if (tipoComprobante === 'factura') {
      if (!rucCliente || rucCliente.trim().length !== 11) {
        return 'Ingresa un RUC de exactamente 11 dígitos.';
      }
      if (!razonSocial || razonSocial.trim().length === 0) {
        return 'Ingresa la razón social del cliente.';
      }
    } else {
      if (!dniCliente || dniCliente.trim().length < 8) {
        return 'Ingresa un DNI o documento de al menos 8 dígitos.';
      }
      if (!nombreCliente || nombreCliente.trim().length === 0) {
        return 'Ingresa el nombre completo del cliente.';
      }
    }
    return null;
  })();

  const validarCampos = () => {
    if (validationMessage) {
      toast.error(validationMessage);
      return false;
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
      const filename = await generarPDF(ventaConDatos, hotel, /** @type {"factura"|"boleta"} */ (tipoComprobante));
      if (onEmitido) onEmitido(filename, tipoComprobante);
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
    if (!ventana) {
      toast.error('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes e intenta nuevamente.');
      return;
    }
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
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden border border-border/60 bg-card p-0 shadow-2xl max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-border/60 p-4 pr-12 text-left sm:p-5 sm:pr-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <FileText className="h-5 w-5 text-primary" /> Preparar y entregar comprobante
              </DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">Ticket #{ventaPos.numero_ticket} · S/ {Number(ventaPos.total || 0).toFixed(2)}</p>
            </div>
            <ComprobanteStatus status={ventaPos.estado_comprobante} className="sm:max-w-xs" />
          </div>
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
              <div className="bold">{documentTitle}</div>
              <div className="bold">{documentNumber}</div>
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
            {isSunatEmitted && qrUrl && (
              <div className="center" style={{ margin: '10px 0' }}>
                <img src={qrUrl} width="100" height="100" style={{ border: '1px solid #ccc', padding: '4px' }} />
              </div>
            )}
            {isSunatEmitted ? (
              <>
                <div className="center small bold">Representacion Impresa</div>
                <div className="center small bold">de la {tipoComprobante === 'factura' ? 'Factura' : 'Boleta'} Electronica</div>
                <div className="center small">Verifica en: e-consulta.sunat.gob.pe</div>
              </>
            ) : (
              <>
                <div className="center small bold">{isSunatPending ? 'PENDIENTE DE EMISION SUNAT' : 'CONSTANCIA INTERNA DE PAGO'}</div>
                <div className="center small bold">NO ES COMPROBANTE TRIBUTARIO</div>
              </>
            )}
            {hotel.mensaje_ticket && (
              <>
                <div className="line" />
                <div className="center small">{hotel.mensaje_ticket}</div>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div>
                <Label className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo de comprobante</Label>
                <div className="mt-1 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de comprobante">
                  {[
                    { value: 'boleta', label: 'Boleta', hint: 'Persona natural' },
                    { value: 'factura', label: 'Factura', hint: 'Empresa con RUC' },
                  ].map((option) => {
                    const selected = tipoComprobante === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={isSunatEmitted}
                        onClick={() => setTipoComprobante(option.value)}
                        className={`min-h-14 rounded-xl border px-3 py-2 text-left transition-colors ${selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-foreground hover:bg-muted/60'} disabled:cursor-not-allowed disabled:opacity-70`}
                      >
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className="block text-[10px] text-muted-foreground">{option.hint}</span>
                      </button>
                    );
                  })}
                </div>
                {isSunatEmitted && (
                  <p className="mt-2 text-[11px] text-muted-foreground">El tipo y los datos quedan bloqueados porque SUNAT ya aceptó el comprobante.</p>
                )}
              </div>

              {tipoComprobante === 'boleta' && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="comprobante-dni" className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      DNI / documento del cliente
                      {loadingIdentity && <span className="ml-2 animate-pulse text-primary">Buscando…</span>}
                    </Label>
                    <Input
                      id="comprobante-dni"
                      className="mt-1 h-11 rounded-xl bg-background/50"
                      value={dniCliente}
                      disabled={isSunatEmitted}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-invalid={!!validationMessage && dniCliente.trim().length < 8}
                      onChange={(e) => setDniCliente(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ej. 12345678"
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <Label htmlFor="comprobante-nombre" className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nombre completo</Label>
                    <Input
                      id="comprobante-nombre"
                      className="mt-1 h-11 rounded-xl bg-background/50"
                      value={nombreCliente}
                      disabled={isSunatEmitted}
                      aria-invalid={!!validationMessage && !nombreCliente.trim()}
                      onChange={(e) => setNombreCliente(e.target.value)}
                      placeholder="Ej. Juan Pérez"
                    />
                  </div>
                </div>
              )}

              {tipoComprobante === 'factura' && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="comprobante-ruc" className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      RUC del cliente
                      {loadingIdentity && <span className="ml-2 animate-pulse text-primary">Consultando SUNAT…</span>}
                    </Label>
                    <Input
                      id="comprobante-ruc"
                      className="mt-1 h-11 rounded-xl bg-background/50"
                      value={rucCliente}
                      disabled={isSunatEmitted}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-invalid={!!validationMessage && rucCliente.trim().length !== 11}
                      onChange={(e) => setRucCliente(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ej. 20601234567"
                      maxLength={11}
                    />
                  </div>
                  <div>
                    <Label htmlFor="comprobante-razon" className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Razón social</Label>
                    <Input
                      id="comprobante-razon"
                      className="mt-1 h-11 rounded-xl bg-background/50"
                      value={razonSocial}
                      disabled={isSunatEmitted}
                      aria-invalid={!!validationMessage && !razonSocial.trim()}
                      onChange={(e) => setRazonSocial(e.target.value)}
                      placeholder="Ej. Mi Empresa S.A.C."
                    />
                  </div>
                </div>
              )}

              {validationMessage && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-400" role="status">
                  {validationMessage}
                </p>
              )}
            </div>

          {/* Ticket preview card */}
            <div className="lg:sticky lg:top-0">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vista previa de entrega</p>
              <div className="mx-auto max-w-xs select-none space-y-1 rounded-xl border border-dashed border-gray-300 bg-white p-4 text-center font-mono text-[11px] text-gray-800 shadow-sm">
            <p className="font-bold text-xs">{hotel.nombre || 'PMS JCAR LABS'}</p>
            {hotel.ruc && <p className="text-gray-500 text-[10px]">RUC: {hotel.ruc}</p>}
            {hotel.direccion && <p className="text-gray-400 text-[9px]">{hotel.direccion}</p>}
            {hotel.ciudad && <p className="text-gray-400 text-[9px]">{hotel.ciudad}</p>}
            {hotel.telefono && <p className="text-gray-400 text-[9px]">Tel: {hotel.telefono}</p>}
            <div className="border-t border-dashed my-2" />
            <p className="font-bold">{documentTitle}</p>
            <p className="text-gray-600">{documentNumber}</p>
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

            {isSunatEmitted && qrUrl && (
              <div className="flex justify-center my-3">
                <img src={qrUrl} alt="QR Code SUNAT" className="w-24 h-24 border border-gray-200 p-1" />
              </div>
            )}

            <div className="border-t border-dashed my-2" />
            {isSunatEmitted ? (
              <>
                <p className="text-[9px] font-bold">Representación impresa</p>
                <p className="text-[9px]">de la {tipoComprobante === 'factura' ? 'Factura' : 'Boleta de Venta'} electrónica</p>
                <p className="text-[9px] text-gray-500">Verifica en: e-consulta.sunat.gob.pe</p>
              </>
            ) : (
              <div className="rounded bg-amber-50 px-2 py-1.5 text-[9px] font-bold text-amber-800">
                {isSunatPending ? 'Pendiente de emisión SUNAT' : 'Constancia interna de pago'} · No es comprobante tributario
              </div>
            )}
            {hotel.mensaje_ticket && (
              <p className="text-[9px] text-gray-400 mt-1">{hotel.mensaje_ticket}</p>
            )}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border/60 bg-background/95 p-3 backdrop-blur sm:p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_auto_1fr_auto]">
          <Button onClick={onClose} variant="ghost" className="order-4 col-span-2 h-11 sm:order-none sm:col-span-1">
            Cerrar
          </Button>
          <Button onClick={imprimirHtml} disabled={!!validationMessage} className="h-11 gap-2" variant="outline">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Button onClick={handleCompartirPWA} disabled={!!validationMessage} className="h-11 gap-2" variant="outline">
            <Share2 className="w-4 h-4" /> Compartir
          </Button>
          <Button
            onClick={handleDescargarPDF}
            disabled={cargando || !!validationMessage}
            className="col-span-2 h-11 gap-2 rounded-lg font-semibold sm:col-span-1"
          >
            {cargando ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generando…
              </>
            ) : (
              <><Download className="h-4 w-4" /> Descargar PDF</>
            )}
          </Button>
          {isSunatEmitted && comprobanteData && (
            <Button
              onClick={() => setNotaOpen(true)}
              variant="outline"
              className="col-span-2 h-11 gap-2 sm:col-span-1"
            >
              <FileText className="h-4 w-4" /> Emitir Nota
            </Button>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
      <NotaComprobanteDialog
        open={notaOpen}
        onClose={() => setNotaOpen(false)}
        comprobante={comprobanteData}
      />
    </>
  );
});
ComprobanteModal.displayName = 'ComprobanteModal';
export default ComprobanteModal;
