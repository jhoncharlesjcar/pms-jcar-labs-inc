import React, { useState, useRef, memo } from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotelData } from '@/hooks/use-hotel-data';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { formatearHabitacionParaBD } from '@/services/habitaciones.service';

export const ConfigImportadorExcel = memo(function ConfigImportadorExcel({ hotelId }) {
    const qc = useQueryClient();
    const { db: hotelDb } = useHotelData();
    const [fileData, setFileData] = useState([]);
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setLoading(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (!data || data.length === 0) {
                    toast.error('El archivo Excel está vacío o no tiene formato válido.');
                    setFileData([]);
                    setLoading(false);
                    return;
                }

                // Normalizar columnas
                const parseados = data.map((row, index) => {
                    const numero = String(row['Numero'] || row['Número'] || row['numero'] || row['habitacion'] || index + 101).trim();
                    const tipo = String(row['Tipo'] || row['tipo'] || 'simple').toLowerCase().trim();
                    const piso = String(row['Piso'] || row['piso'] || '1').trim();
                    const precio = Number(row['Precio'] || row['precio'] || row['precio_noche'] || 80);
                    const capacidad = Number(row['Capacidad'] || row['capacidad'] || 2);

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
                toast.error('Error al procesar el archivo Excel.');
                setFileData([]);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const descargarPlantilla = () => {
        const templateData = [
            { Número: '101', Piso: '1', Tipo: 'simple', Precio: 80, Capacidad: 1 },
            { Número: '102', Piso: '1', Tipo: 'doble', Precio: 120, Capacidad: 2 },
            { Número: '201', Piso: '2', Tipo: 'matrimonial', Precio: 150, Capacidad: 2 },
            { Número: '202', Piso: '2', Tipo: 'suite', Precio: 250, Capacidad: 4 },
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Habitaciones');
        XLSX.writeFile(wb, 'plantilla_habitaciones_pms.xlsx');
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
                        <h2 className="font-extrabold text-foreground text-lg tracking-tight">Importación Masiva (Excel)</h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Carga tus habitaciones masivamente desde una hoja de cálculo</p>
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
                    accept=".xlsx, .xls, .csv"
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
                    {fileName ? fileName : 'Seleccionar Archivo Excel'}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                    Formatos soportados: .xlsx, .xls, .csv
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
                                        <td colSpan="4" className="p-2 text-center text-muted-foreground font-black uppercase tracking-widest text-[9px] bg-background/30">
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
