import React from 'react';
import { Menu, Hotel, Bell } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';

interface TopBarProps {
  titulo?: string;
  onOpenSidebar?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ titulo = 'PMS JCAR LABS' }) => {
  const { user } = useAuthStore();
  const { toggleSidebar } = useUIStore();

  return (
    <header className="lg:hidden flex items-center justify-between px-5 py-4 bg-background/80 backdrop-blur-2xl border-b border-border/50 sticky top-0 z-40 safe-top transition duration-200">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => toggleSidebar(true)} 
          className="w-10 h-10 rounded-xl bg-card border border-border/80 shadow-sm flex items-center justify-center active:scale-[0.97] transition select-none cursor-pointer"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="font-display font-black text-foreground tracking-tight text-sm uppercase">{titulo}</h1>
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">Gestión Activa</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button className="w-10 h-10 rounded-xl bg-card border border-border/80 shadow-sm flex items-center justify-center relative active:scale-[0.97] transition">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full ring-2 ring-background animate-pulse" />
        </button>
        <div className="w-10 h-10 bg-gradient-to-tr from-primary to-emerald-400 rounded-xl flex items-center justify-center shadow-md">
          <span className="text-xs font-black text-foreground">
            {(user?.full_name || 'S')[0].toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  );
};
