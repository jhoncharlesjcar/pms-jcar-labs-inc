import { Menu, X } from 'lucide-react';
import SelectorHotel from '@/components/SelectorHotel';

export default function MobileHeader({ sidebarOpen, setSidebarOpen }) {
    return (
        <header className="safe-top sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-card/85 px-4 py-3 shadow-xs backdrop-blur-xl lg:hidden">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 overflow-hidden rounded-xl shadow-xs flex-shrink-0 flex items-center justify-center bg-white border border-border/40 p-0.5">
                    <img src="/logo.jpg" alt="PMS JCAR LABS" className="w-full h-full object-contain origin-center" />
                </div>
                <div className="min-w-0">
                    <span className="font-display font-extrabold text-base text-foreground tracking-tight block leading-none truncate">PMS JCAR LABS</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <SelectorHotel mobile />
                <button 
                aria-label="Abrir menú de navegación"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(!sidebarOpen)} 
                className="w-10 h-10 rounded-lg text-muted-foreground hover:bg-muted flex items-center justify-center active:scale-95 transition-all select-none cursor-pointer"
                style={{ WebkitTapHighlightColor: 'transparent' }}
            >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            </div>
        </header>
    );
}
