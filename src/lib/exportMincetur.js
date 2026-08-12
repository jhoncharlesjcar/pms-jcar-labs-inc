import logger from '@/lib/logger';

export async function generarFichaMincetur(reserva, hotelInfo = { nombre: 'HOSPEDAJE', ruc: '' }) {
    if (!reserva) return;

    return new Promise((resolve, reject) => {
        // Instanciamos el Web Worker
        const worker = new Worker(new URL('../workers/pdfWorker.js', import.meta.url), { type: 'module' });
        const taskId = Date.now().toString();

        worker.onmessage = (e) => {
            if (e.data.taskId === taskId) {
                if (e.data.success) {
                    // Descargar el archivo devuelto por el worker
                    const url = URL.createObjectURL(e.data.blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = e.data.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    resolve(true);
                } else {
                    logger.error("Error en PDF Worker:", e.data.error);
                    reject(new Error(e.data.error));
                }
                worker.terminate();
            }
        };

        worker.onerror = (err) => {
            logger.error("Error crítico en PDF Worker:", err);
            reject(err);
            worker.terminate();
        };

        // Enviamos los datos al proceso en segundo plano
        worker.postMessage({
            action: 'exportMincetur',
            taskId,
            payload: { reserva, hotelInfo }
        });
    });
}
