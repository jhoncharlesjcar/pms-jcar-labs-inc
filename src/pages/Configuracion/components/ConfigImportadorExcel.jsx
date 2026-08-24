import React, { useState, useRef, memo } from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotelData } from '@/hooks/useHotelData';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatearHabitacionParaBD } from '@/services/habitaciones.service';

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_ROWS = 1000;

function parseCsv(text) {
    const rows = [];
    let row = [], value = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted && char === '"' && text[i + 1] === '"') { value += '"'; i++; }
        else if (char === '"') quoted = !quoted;
        else if (char === ',' && !quoted) { row.push(value.trim()); value = ''; }
        else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && text[i + 1] === '\n') i++;
            row.push(value.trim());
            if (row.some(Boolean)) rows.push(row);
            row = []; value = '';
        } else value += char;
    }
    row.push(value.trim());
    if (row.some(Boolean)) rows.push(row);
    if (quoted) throw new Error('CSV con comillas sin cerrar');
    const headers = rows.shift()?.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) || [];
    if (rows.length > MAX_ROWS) throw new Error(`El CSV supera el máximo de ${MAX_ROWS} filas`);
    return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

export const ConfigImportadorExcel = memo(function ConfigImportadorExcel(/** @type {any} */ { hotelId }) {
    const qc = useQueryClient();
    const { db: hotelDb } = useHotelData();
    const [fileData, setFileData] = useState([]);
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.csv')) {
            toast.error('Por seguridad, solo se admiten archivos CSV.');
            e.target.value = '';
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            toast.error('El CSV no puede superar 1 MB.');
            e.target.value = '';
            return;
        }

        setFileName(file.name);
        setLoading(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = parseCsv(String(evt.target?.result || ''));

                if (!data || data.length === 0) {
                    toast.error('El archivo CSV está vacío o no tiene formato válido.');
                    setFileData([]);
                    setLoading(false);
                    return;
                }

                // Normalizar columnas
                const parseados = data.map((row, index) => {
                    const numero = String(row.numero || row.habitacion || index + 101).trim();
                    const tipo = String(row.tipo || 'simple').toLowerCase().trim();
                    const piso = String(row.piso || '1').trim();
                    const precio = Number(row.precio || row.precio_noche || 80);
                    const capacidad = Number(row.capacidad || 2);
                    if (!numero || !Number.isFinite(precio) || precio < 0 || !Number.isFinite(capacidad) || capacidad < 1) {
                        throw new Error(`Fila ${index + 2} inválida`);
                    }

                    return {
                        numero,
                        tipo,
                        piso,
                        precio_noche: precio,
                        precio,
                        capacidad,
                        estado: 'disponible'
                    };
                });

                setFileData(parseados);
                toast.success(`${parseados.length} habitaciones leídas del archivo.`);
            } catch (err) {
                console.error(err);
                toast.error(err instanceof Error ? err.message : 'Error al procesar el CSV.');
                setFileData([]);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const descargarPlantilla = () => {
        const csv = 'numero,piso,tipo,precio,capacidad\r\n101,1,simple,80,1\r\n102,1,doble,120,2\r\n201,2,matrimonial,150,2\r\n';
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plantilla_habitaciones_pms.csv';
        link.click();
        URL.revokeObjectURL(url);
        toast.success('Plantilla descargada.');
    };

    const ejecutarImportacion = async () => {
        if (!fileData || fileData.length === 0) return;
        setLoading(true);

        try {
            let creados = 0;
            for (const hab of fileData) {
                const dataToSave = formatearHabitacionParaBD({
                    hotel_id: hotelId,
                    numero: hab.numero,
                    piso: hab.piso,
                    tipo: hab.tipo,
                    estado: 'disponible',
                    precio_noche: hab.precio_noche,
                    precio: hab.precio_noche,
                    capacidad: hab.capacidad,
                    descripcion: JSON.stringify({ wifi: true, agua: true }),
                });
                await hotelDb.Habitacion.create(dataToSave);
                creados++;
            }

            qc.invalidateQueries({ queryKey: ['habitaciones', hotelId] });
            toast.success(`¡Éxito! ${creados} habitaciones creadas correctamente.`);
            setFileData([]);
            setFileName('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
            console.error(err);
            toast.error('Error durante la importación masiva de habitaciones.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-5 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20 shadow-xs">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="font-extrabold text-foreground text-lg tracking-tight">Importación Masiva (CSV)</h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Carga habitaciones desde un CSV validado</p>
                    </div>
                </div>

                <Button
                    onClick={descargarPlantilla}
                    variant="outline"
                    className="gap-2 shadow-xs text-[9px] font-extrabold uppercase tracking-widest rounded-md h-9 px-4 border-border/40 active:scale-95 transition-all"
                >
                    <Download className="w-3.5 h-3.5 text-emerald-500" /> Descargar Plantilla
                </Button>
            </div>

            <div className="border-2 border-dashed border-border/60 rounded-xl p-5 text-center bg-background/30 hover:bg-background/50 transition-all cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                />
                
                <div className="w-12 h-12 bg-card/60 rounded-xl flex items-center justify-center mx-auto mb-3 border border-border/40 shadow-sm group-hover:scale-110 transition-transform">
                    {loading ? (
                        <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                    ) : (
                        <Upload className="w-6 h-6 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                    )}
                </div>
                
                <p className="text-sm font-extrabold text-foreground tracking-tight">
                    {fileName ? fileName : 'Seleccionar archivo CSV'}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                    Formato soportado: .csv (máximo 1 MB / 1000 filas)
                </p>
            </div>

            {fileData.length > 0 && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-extrabold text-xs tracking-tight">Archivo leído: {fileData.length} habitaciones detectadas.</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto rounded-md border border-border/40 bg-card/60 shadow-inner">
                        <table className="w-full text-left text-[10px]">
                            <thead className="sticky top-0 bg-background/95 backdrop-blur-md border-b border-border/40 shadow-sm">
                                <tr>
                                    <th className="p-2 font-black uppercase tracking-widest text-muted-foreground">Nro</th>
                                    <th className="p-2 font-black uppercase tracking-widest text-muted-foreground">Tipo</th>
                                    <th className="p-2 font-black uppercase tracking-widest text-muted-foreground">Piso</th>
                                    <th className="p-2 font-black uppercase tracking-widest text-muted-foreground">Precio</th>
                                </tr>
                            </thead>
                            <tbody className="font-bold">
                                {fileData.slice(0, 10).map((hab, idx) => (
                                    <tr key={idx} className="border-b border-border/20 last:border-0 hover:bg-foreground/5 transition-colors">
                                        <td className="p-2">{hab.numero}</td>
                                        <td className="p-2 capitalize">{hab.tipo}</td>
                                        <td className="p-2">{hab.piso}</td>
                                        <td className="p-2">S/ {hab.precio_noche}</td>
                                    </tr>
                                ))}
                                {fileData.length > 10 && (
                                    <tr>
                                        <td colSpan={4} className="p-2 text-center text-muted-foreground font-black uppercase tracking-widest text-[9px] bg-background/30">
                                            ... y {fileData.length - 10} habitaciones más
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Button 
                        onClick={ejecutarImportacion} 
                        disabled={loading}
                        className="w-full h-9 rounded-md font-extrabold text-[10px] tracking-widest uppercase bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95 transition-all"
                    >
                        {loading ? 'Importando...' : `Confirmar Importación (${fileData.length})`}
                    </Button>
                </div>
            )}

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-[10px] font-bold text-amber-600 dark:text-amber-400 shadow-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                    <strong className="font-black uppercase tracking-widest block mb-1">Aviso:</strong> El sistema sobrescribirá las habitaciones si el número (ej: "101") ya existe en la base de datos de este hotel, o creará nuevas en caso contrario. 
                    Recomendamos usar la plantilla para evitar errores de formato.
                </p>
            </div>
        </div>
    );
});
ConfigImportadorExcel.displayName = 'ConfigImportadorExcel';
