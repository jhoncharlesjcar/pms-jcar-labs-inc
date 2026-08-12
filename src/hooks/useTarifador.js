import { useEffect } from 'react';
import { differenceInDays, format, addDays } from 'date-fns';

/**
 * Hook para manejar la lógica de auto-cálculo de tarifas dinámicas, noches e IGV.
 * Extraído para limpiar componentes visuales complejos como Recepcion.jsx.
 */
export function useTarifador({ form, setForm, tarifas, habitaciones }) {
    useEffect(() => {
        if (!form.fecha_entrada || !form.fecha_salida) return;

        const entrada = new Date(form.fecha_entrada + 'T12:00:00');
        const salida = new Date(form.fecha_salida + 'T12:00:00');
        const diff = differenceInDays(salida, entrada);
        const n = diff > 0 ? diff : 1;

        const hab = habitaciones.find(h => h.id === form.habitacion_id);
        const precioBase = hab?.precio ?? hab?.precio_noche ?? form.precio_noche ?? 0;

        let totalAcumulado = 0;
        let explicacionAjustes = [];

        // Evaluar cada día de la estadía individualmente
        for (let i = 0; i < n; i++) {
            const diaEvaluado = addDays(entrada, i);
            const diaSemana = diaEvaluado.getDay();
            const fechaStr = format(diaEvaluado, 'yyyy-MM-dd');

            let factorAplicado = 1.0;
            let reglaNombre = '';

            const reglasAplicables = tarifas.filter(t => 
                t.habitacion_tipo === 'todos' || t.habitacion_tipo === form.habitacion_tipo
            );

            // 1. Prioridad: Temporadas Específicas
            const reglaTemporada = reglasAplicables.find(t => 
                t.tipo === 'temporada' && 
                t.fecha_inicio <= fechaStr && 
                t.fecha_fin >= fechaStr
            );

            if (reglaTemporada) {
                factorAplicado = Number(reglaTemporada.factor_ajuste);
                reglaNombre = reglaTemporada.nombre;
            } else {
                // 2. Prioridad: Días de la Semana
                const reglaDia = reglasAplicables.find(t => 
                    t.tipo === 'dia_semana' && 
                    t.dias_semana.includes(diaSemana)
                );
                if (reglaDia) {
                    factorAplicado = Number(reglaDia.factor_ajuste);
                    reglaNombre = reglaDia.nombre;
                }
            }

            totalAcumulado += (precioBase * factorAplicado);

            if (factorAplicado !== 1.0 && !explicacionAjustes.includes(reglaNombre)) {
                const signo = factorAplicado >= 1.0 ? '+' : '';
                const porcentaje = Math.round((factorAplicado - 1.0) * 100);
                explicacionAjustes.push(`${reglaNombre} (${signo}${porcentaje}%)`);
            }
        }

        setForm(prev => {
            const tarifa_sin_igv = prev.incluye_igv ? totalAcumulado / 1.18 : totalAcumulado;
            const igv_monto = prev.incluye_igv ? totalAcumulado - (totalAcumulado / 1.18) : 0;
            const obs = explicacionAjustes.join(' · ');
            
            // Prevenir loops infinitos: solo actualiza si hay cambios reales
            if (
                prev.noches === n && 
                prev.total === totalAcumulado && 
                prev.observaciones_tarifas === obs && 
                prev.tarifa_sin_igv === tarifa_sin_igv && 
                prev.igv_monto === igv_monto
            ) {
                return prev;
            }
            
            return {
                ...prev,
                noches: n,
                total: totalAcumulado,
                observaciones_tarifas: obs,
                tarifa_sin_igv,
                igv_monto
            };
        });

    }, [
        form.fecha_entrada, 
        form.fecha_salida, 
        form.precio_noche, 
        form.incluye_igv, 
        form.habitacion_id, 
        form.habitacion_tipo, 
        tarifas, 
        habitaciones,
        setForm
    ]);
}
