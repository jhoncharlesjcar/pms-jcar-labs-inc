import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { RefreshCw, X, Maximize, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import logger from '@/lib/logger';

/**
 * @type {React.FC<{ open?: boolean, onOpenChange?: (open: boolean) => void, onScanSuccess?: (data: any) => void }>}
 */
const ScannerDNIModal = memo(function ScannerDNIModal({ open, onOpenChange, onScanSuccess }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [scanning, setScanning] = useState(false);
    const [streamReady, setStreamReady] = useState(false);
    const [progress, setProgress] = useState(0);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setStreamReady(false);
    }, []);

    const startCamera = useCallback(async () => {
        stopCamera();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    setStreamReady(true);
                };
            }
        } catch (err) {
            logger.error("Error accessing camera:", err);
            toast.error("No se pudo acceder a la cámara. Verifique los permisos.");
        }
    }, [stopCamera]);

    useEffect(() => {
        if (open) {
            startCamera();
        } else {
            stopCamera();
            setScanning(false);
            setProgress(0);
        }
        return () => stopCamera();
    }, [open, startCamera, stopCamera]);

    const handleScan = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        setScanning(true);
        setProgress(10);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convertir la imagen capturada a URL base64
        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        setProgress(30);

        try {
            // Reconocimiento óptico de caracteres (Lazy load Tesseract)
            const { default: Tesseract } = await import('tesseract.js');
            const result = await Tesseract.recognize(
                imageData,
                'spa', // Idioma español
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            setProgress(30 + Math.floor(m.progress * 60));
                        }
                    }
                }
            );

            setProgress(100);
            const text = result.data.text;
            logger.debug("TEXTO OCR RAW:\n", text);

            // Intentar extraer información básica del texto
            const extractedData = {
                dni: '',
                nombre: '',
                apellidos: '',
            };

            // DNI suele ser 8 dígitos aislados o dentro de código MRZ
            let dniFound = '';
            const dniMatch = text.match(/\b\d{8}\b/);
            if (dniMatch) {
                dniFound = dniMatch[0];
            } else {
                const mrzMatch = text.match(/(?:IDPER|IDESP|DNI)?\s*(\d{8})/i);
                if (mrzMatch && mrzMatch[1]) {
                    dniFound = mrzMatch[1];
                }
            }
            extractedData.dni = dniFound;

            // Heurística de extracción de nombres para DNI Peruano (Clásico y Electrónico)
            const lines = text.split('\n')
                .map(l => l.trim().toUpperCase())
                .filter(l => l.length > 2);

            const idxPaterno = lines.findIndex(l => l.includes('PATERNO') || l.includes('1ER APELLIDO'));
            const idxMaterno = lines.findIndex(l => l.includes('MATERNO') || l.includes('2DO APELLIDO'));
            const idxNombres = lines.findIndex(l => l.includes('NOMBRES') || l.includes('PRENOMBRES'));

            let apePat = '';
            let apeMat = '';

            if (idxPaterno !== -1 && lines[idxPaterno + 1]) apePat = lines[idxPaterno + 1].replace(/[^A-ZÑ\s]/g, '').trim();
            if (idxMaterno !== -1 && lines[idxMaterno + 1]) apeMat = lines[idxMaterno + 1].replace(/[^A-ZÑ\s]/g, '').trim();
            if (idxNombres !== -1 && lines[idxNombres + 1]) extractedData.nombre = lines[idxNombres + 1].replace(/[^A-ZÑ\s]/g, '').trim();

            extractedData.apellidos = `${apePat} ${apeMat}`.trim();
            const nombreCompleto = `${extractedData.nombre} ${extractedData.apellidos}`.trim();

            if (extractedData.dni) {
                toast.success(`DNI ${extractedData.dni} detectado.`);
                const payload = {
                    ...extractedData,
                    numero: extractedData.dni,
                    nombreCompleto: nombreCompleto || extractedData.nombre || extractedData.apellidos || '',
                    raw_text: text
                };
                onScanSuccess(payload);
                onOpenChange(false);
            } else {
                toast.warning("No se pudo detectar un DNI claro. Intente de nuevo con mejor iluminación.");
            }

        } catch (err) {
            logger.error("Error OCR:", err);
            toast.error("Hubo un error procesando la imagen.");
        } finally {
            setScanning(false);
            setTimeout(() => setProgress(0), 1000);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black/95 border-border/50 text-foreground rounded-[2rem]">
                <div className="relative w-full aspect-[3/4] sm:aspect-square flex flex-col bg-black">
                    {/* Header flotante */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
                        <div className="flex items-center gap-2">
                            <ScanLine className="w-5 h-5 text-primary" />
                            <span className="font-bold text-sm tracking-widest uppercase">Escanear DNI</span>
                        </div>
                        <button onClick={() => onOpenChange(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/5 hover:bg-foreground/10 backdrop-blur-md">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Visor de Cámara */}
                    <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                        {!streamReady && !scanning && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-foreground/50">
                                <RefreshCw className="w-8 h-8 animate-spin" />
                                <span className="text-xs font-bold tracking-widest uppercase">Iniciando Cámara...</span>
                            </div>
                        )}
                        <video 
                            ref={videoRef} 
                            playsInline 
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Guías de Escaneo */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="w-full h-full border-[40px] border-black/40" />
                            <div className="absolute inset-0 m-[40px] border-2 border-primary/50 rounded-xl" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground/30 flex items-center gap-2 rotate-90">
                                <Maximize className="w-6 h-6" />
                                <span className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">Alinee el DNI aquí</span>
                            </div>
                        </div>

                        {/* Overlay de Escaneo */}
                        {scanning && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                <div className="w-16 h-16 relative flex items-center justify-center mb-4">
                                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                                        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-foreground/10" />
                                        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-primary transition duration-200" strokeDasharray="175" strokeDashoffset={175 - (175 * progress) / 100} />
                                    </svg>
                                    <ScanLine className="w-6 h-6 text-primary animate-pulse" />
                                </div>
                                <span className="text-sm font-bold text-foreground tracking-widest uppercase animate-pulse">Analizando Documento...</span>
                            </div>
                        )}
                    </div>

                    {/* Controles Base */}
                    <div className="p-6 bg-black z-10">
                        <Button 
                            className="w-full h-14 rounded-2xl bg-white hover:bg-gray-200 text-black font-bold uppercase tracking-widest text-sm shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                            onClick={handleScan}
                            disabled={!streamReady || scanning}
                        >
                            {scanning ? 'Procesando...' : 'Capturar DNI'}
                        </Button>
                        <p className="text-center text-xs text-foreground/40 mt-4 uppercase tracking-widest font-semibold">
                            Asegúrese de tener buena iluminación
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
});
ScannerDNIModal.displayName = 'ScannerDNIModal';
export default ScannerDNIModal;
