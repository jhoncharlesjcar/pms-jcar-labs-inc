import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
    items: [],
    
    agregarItem: (producto) => set((state) => {
        const idx = state.items.findIndex(i => i.id === producto.id);
        if (idx >= 0) {
            const copia = [...state.items];
            copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 };
            return { items: copia };
        }
        return { items: [...state.items, { ...producto, cantidad: 1 }] };
    }),

    cambiarCantidad: (idx, nuevaCantidad) => set((state) => {
        if (nuevaCantidad <= 0) {
            return { items: state.items.filter((_, i) => i !== idx) };
        }
        return { 
            items: state.items.map((item, i) => 
                i === idx ? { ...item, cantidad: nuevaCantidad } : item
            ) 
        };
    }),

    eliminarItem: (idx) => set((state) => ({
        items: state.items.filter((_, i) => i !== idx)
    })),

    limpiarCarrito: () => set({ items: [] }),

    getTotalItems: () => {
        return get().items.reduce((acc, item) => acc + item.cantidad, 0);
    },

    getTotalMonto: () => {
        return get().items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
    },

    getResumenPago: () => {
        const items = get().items;
        const total = get().getTotalMonto();
        return {
            items,
            subtotalEstadia: 0,
            subtotalExtras: total,
            total: total
        };
    }
}));
