import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CreditCard,
  Settings,
  User,
  Search,
  LayoutGrid,
  BedDouble,
  LogOut,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useHotelData } from '@/hooks/use-hotel-data';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessPath } from '@/constants/permissions';

export function GlobalCommand() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { auth, user } = useAuth();
  const { db: hotelDb, hotelId } = useHotelData();

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Fetch rooms for contextual search if hotelId exists
  const { data: habitaciones = [] } = useQuery({
      queryKey: ['habitaciones', hotelId],
      queryFn: () => hotelDb.Habitacion.list(),
      enabled: !!hotelId && canAccessPath(user?.role, '/habitaciones'),
  });

  const runCommand = (command) => {
    setOpen(false);
    command();
  };

  // Find rooms that match search
  const matchedRooms = useMemo(() => {
      if (!canAccessPath(user?.role, '/habitaciones') || !search || search.length < 1) return [];
      const s = search.toLowerCase();
      return habitaciones.filter(h => h.numero.toLowerCase().includes(s) || h.tipo.toLowerCase().includes(s)).slice(0, 5);
  }, [search, habitaciones, user?.role]);

  return (
    <>
      <div 
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
        className="group flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/55 px-3 py-2.5 shadow-inner transition-colors hover:border-primary/20 hover:bg-card"
      >
        <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm text-muted-foreground">Buscar...</span>
        </div>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
            placeholder="Escribe un comando, número de habitación o busca algo..." 
            value={search}
            onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>No se encontraron resultados para "{search}".</CommandEmpty>
          
          {matchedRooms.length > 0 && (
              <CommandGroup heading="Habitaciones (Acciones Rápidas)">
                  {matchedRooms.map(hab => (
                      <CommandItem key={hab.id} onSelect={() => runCommand(() => navigate('/habitaciones'))} className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                              <BedDouble className="w-4 h-4 text-primary" />
                              <span>Habitación {hab.numero} <span className="text-xs text-muted-foreground ml-1">({hab.tipo})</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase bg-muted px-1.5 py-0.5 rounded">{hab.estado}</span>
                              <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">
                                  Ver habitación
                              </span>
                          </div>
                      </CommandItem>
                  ))}
              </CommandGroup>
          )}

          <CommandGroup heading="Sugerencias Rápidas">
            {canAccessPath(user?.role, '/recepcion') && <CommandItem onSelect={() => runCommand(() => navigate('/recepcion'))}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Ir a Recepción</span>
              <CommandShortcut>⌘R</CommandShortcut>
            </CommandItem>}
            {canAccessPath(user?.role, '/habitaciones') && <CommandItem onSelect={() => runCommand(() => navigate('/habitaciones'))}>
              <BedDouble className="mr-2 h-4 w-4" />
              <span>Ver Habitaciones</span>
            </CommandItem>}
            {canAccessPath(user?.role, '/pos') && <CommandItem onSelect={() => runCommand(() => navigate('/pos'))}>
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Punto de Venta (Minimarket)</span>
            </CommandItem>}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navegación">
            {canAccessPath(user?.role, '/') && <CommandItem onSelect={() => runCommand(() => navigate('/'))}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              <span>Dashboard Gerencial</span>
            </CommandItem>}
            {canAccessPath(user?.role, '/configuracion') && <CommandItem onSelect={() => runCommand(() => navigate('/configuracion'))}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configuración del Hotel</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>}
            {canAccessPath(user?.role, '/huespedes') && <CommandItem onSelect={() => runCommand(() => navigate('/huespedes'))}>
              <User className="mr-2 h-4 w-4" />
              <span>Directorio de Huéspedes</span>
            </CommandItem>}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Sistema">
            <CommandItem 
              onSelect={() => {
                runCommand(async () => {
                  await auth.logout();
                });
              }}
            >
              <LogOut className="mr-2 h-4 w-4 text-red-500" />
              <span className="text-red-500">Cerrar Sesión</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
