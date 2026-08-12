import { create } from 'zustand';

interface CartItem {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

interface UIState {
  sidebarOpen: boolean;
  isDark: boolean;
  cart: CartItem[];
  
  // Actions
  toggleSidebar: (open?: boolean) => void;
  toggleTheme: (dark?: boolean) => void;
  
  // Cart Actions
  addToCart: (item: Omit<CartItem, 'cantidad'>) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, cantidad: number) => void;
  clearCart: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  isDark: typeof window !== 'undefined' ? document.documentElement.classList.contains('dark') : false,
  cart: [],

  toggleSidebar: (open) => set((state) => ({ 
    sidebarOpen: open !== undefined ? open : !state.sidebarOpen 
  })),

  toggleTheme: (dark) => set((state) => {
    const nextDark = dark !== undefined ? dark : !state.isDark;
    if (typeof window !== 'undefined') {
      if (nextDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }
    return { isDark: nextDark };
  }),

  addToCart: (item) => set((state) => {
    const existingIndex = state.cart.findIndex(i => i.id === item.id);
    if (existingIndex > -1) {
      const updatedCart = [...state.cart];
      updatedCart[existingIndex].cantidad += 1;
      return { cart: updatedCart };
    }
    return { cart: [...state.cart, { ...item, cantidad: 1 }] };
  }),

  removeFromCart: (itemId) => set((state) => ({
    cart: state.cart.filter(i => i.id !== itemId)
  })),

  updateQuantity: (itemId, cantidad) => set((state) => {
    if (cantidad <= 0) {
      return { cart: state.cart.filter(i => i.id !== itemId) };
    }
    const updatedCart = state.cart.map(item => 
      item.id === itemId ? { ...item, cantidad } : item
    );
    return { cart: updatedCart };
  }),

  clearCart: () => set({ cart: [] })
}));
