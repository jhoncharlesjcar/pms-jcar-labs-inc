import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO, format } from 'date-fns';
import { toast } from 'sonner';
import { downloadCsv } from '@/lib/csv';
import type { Reserva } from '@/types';

/**
 * Exporta el reporte de DIRCETUR
 */
export const exportarDircetur = async (
    reservas: Reserva[], 
    formato: 'excel' | 'pdf' = 'excel', 
    periodoExport: 'dia' | 'mes' | 'año' = 'mes', 
    fechaExport: string = format(new Date(), 'yyyy-MM-dd'), 
    onComplete?: () => void
) => {
    let start: Date, end: Date;
    const selectedDate = parseISO(fechaExport);
    if (periodoExport === 'dia') {
        start = startOfDay(selectedDate);
        end = endOfDay(selectedDate);
    } else if (periodoExport === 'mes') {
        start = startOfMonth(selectedDate);
        end = endOfMonth(selectedDate);
    } else if (periodoExport === 'año') {
        start = startOfYear(selectedDate);
        end = endOfYear(selectedDate);
    }

    const filtradas = reservas.filter(r => {
        if (!r.fecha_entrada) return false;
        const f = parseISO(r.fecha_entrada);
        return isWithinInterval(f, { start, end });
    }).sort((a, b) => new Date(a.fecha_entrada).getTime() - new Date(b.fecha_entrada).getTime());

    if (filtradas.length === 0) {
        toast.error('No hay huéspedes registrados en este periodo');
        if (onComplete) onComplete();
        return;
    }

    if (formato === 'excel') {
        const data = filtradas.map(r => ({
            'Nombres y Apellidos': r.huesped_nombre || '',
            'Tipo Documento': r.tipo_documento || 'DNI',
            'Número Documento': r.huesped_dni || '',
            'Nacionalidad': r.nacionalidad || r.huesped_procedencia || '',
            'Fecha Nacimiento': r.huesped_fecha_nacimiento || '',
            'Profesión/Ocupación': r.huesped_profesion || '',
            'Estado Civil': r.huesped_estado_civil ? r.huesped_estado_civil.toUpperCase() : '',
            'Procedencia': r.huesped_procedencia || '',
            'Destino': r.huesped_destino || '',
            'Motivo de Viaje': r.motivo_viaje ? r.motivo_viaje.toUpperCase() : '',
            'Fecha de Ingreso': r.fecha_entrada || '',
            'Fecha de Salida': r.fecha_salida || '',
            'Habitación': r.habitacion_numero || ''
        }));

        const headers = Object.keys(data[0]);
        downloadCsv(`Reporte_DIRCETUR_${periodoExport}_${fechaExport}.csv`, headers, data.map(row => headers.map(header => row[header])));
    } else if (formato === 'pdf') {
        const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable'),
        ]);
        const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
        doc.setFontSize(14);
        doc.text('Reporte DIRCETUR (Libro de Registro de Huéspedes)', 14, 20);
        doc.setFontSize(10);
        doc.text(`Periodo: ${periodoExport.toUpperCase()} - Fecha Ref: ${fechaExport}`, 14, 28);
        
        const tableData = filtradas.map(r => [
            r.huesped_nombre || '',
            `${r.tipo_documento || 'DNI'}: ${r.huesped_dni || ''}`,
            r.nacionalidad || r.huesped_procedencia || '',
            r.huesped_fecha_nacimiento || '',
            r.huesped_estado_civil ? r.huesped_estado_civil.toUpperCase() : '',
            r.huesped_procedencia || '',
            r.motivo_viaje ? r.motivo_viaje.toUpperCase() : '',
            r.fecha_entrada ? format(new Date(r.fecha_entrada + 'T12:00:00'), 'dd/MM/yy') : '',
            r.fecha_salida ? format(new Date(r.fecha_salida + 'T12:00:00'), 'dd/MM/yy') : '',
            r.habitacion_numero || ''
        ]);

        autoTable(doc, {
            startY: 35,
            head: [['Nombres', 'Documento', 'Nacionalidad', 'F. Nac.', 'E. Civil', 'Procedencia', 'Motivo', 'Ingreso', 'Salida', 'Hab.']],
            body: tableData,
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(`Reporte_DIRCETUR_${periodoExport}_${fechaExport}.pdf`);
    }

    toast.success(`Reporte DIRCETUR generado en ${formato.toUpperCase()}`);
    if (onComplete) onComplete();
};
