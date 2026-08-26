import { useState } from 'react';

export function usePuntoVentaLogic() {
    const [items, setItems] = useState([]);
    const [pagoOpen, setPagoOpen] = useState(false);
    const [vistaMovil, setVistaMovil] = useState('catalogo'); // 'catalogo' | 'carrito'

    const agregarItem = (producto) => {
        setItems(prev => {
            const idx = prev.findIndex(i => i.id === producto.id);
            if (idx >= 0) {
                const itemActual = prev[idx];
                // No agregar más de lo que hay en stock
                if (itemActual.cantidad >= (producto.stock || 999)) return prev;
                const copia = [...prev];
                copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 };
                return copia;
            }
            return [...prev, { ...producto, cantidad: 1 }];
        });
    };

    const cambiarCantidad = (idx, nuevaCantidad) => {
        if (nuevaCantidad <= 0) {
            setItems(prev => prev.filter((_, i) => i !== idx));
        } else {
            setItems(prev => prev.map((item, i) => i === idx ? { ...item, cantidad: nuevaCantidad } : item));
        }
    };

    const eliminarItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
    const limpiarCarrito = () => { setItems([]); };

    const totalItems = items.reduce((s, i) => s + i.cantidad, 0);
    const totalGeneral = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

    const resumenPago = {
        items,
        subtotalEstadia: 0,
        subtotalExtras: totalGeneral,
        total: totalGeneral,
    };

    return {
        items, setItems,
        pagoOpen, setPagoOpen,
        vistaMovil, setVistaMovil,
        agregarItem,
        cambiarCantidad,
        eliminarItem,
        limpiarCarrito,
        totalItems,
        totalGeneral,
        resumenPago
    };
}
