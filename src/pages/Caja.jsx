import { useState } from 'react';
import { Wallet, Plus, ArrowRightLeft, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Context
import { useHotel } from '@/lib/HotelContext';
import { useAuth } from '@/contexts/AuthContext';

// Hooks
import { useCajaData } from './Caja/hooks/useCajaData';
import { useCajaExport } from './Caja/hooks/useCajaExport';

// Componentes
import { CajaOverview } from './Caja/components/CajaOverview';
import { CajaListEgresos } from './Caja/components/CajaListEgresos';
import { CajaListCierres } from './Caja/components/CajaListCierres';
import { CajaEgresoModal } from './Caja/components/CajaEgresoModal';
import { CajaCierreModal } from './Caja/components/CajaCierreModal';

Caja.displayName = 'Caja';
export default function Caja() {
    const { hotelActual } = useHotel();
    const { user } = useAuth();


    // States locales para modales
    const [expenseModal, setExpenseModal] = useState(false);
    const [closureModal, setClosureModal] = useState(false);

    // Lógica pesada aislada en hooks
    const { egresos, cierres, stats, addEgreso, addCierre } = useCajaData(hotelActual?.id);
    
    const { 
        handlePrintTicket, handlePrintHotel, handlePrintPOS, 
        handleExportPDF, handleExportExcel 
    } = useCajaExport(hotelActual, user, stats);

    return (
        <div className="mx-auto max-w-7xl space-y-5 px-4 pb-12 pt-2 page-enter sm:px-6 lg:px-8">

            {/* Header Section */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-sm">
                            <Wallet className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tighter leading-none">Caja</h1>
                            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Gestión diaria y flujos de efectivo · Auditoría y arqueo
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <div className="hidden h-11 items-center gap-2 rounded-lg border border-border/50 bg-card px-3 text-xs text-muted-foreground lg:flex">
                        <Calendar className="h-4 w-4" />
                        {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <Button 
                        variant="outline" 
                        className="h-11 flex-1 gap-2 rounded-lg px-4 text-xs font-semibold sm:flex-none"
                        onClick={() => setClosureModal(true)}
                    >
                        <ArrowRightLeft className="h-4 w-4" />
                        Cerrar turno
                    </Button>
                    <Button 
                        className="h-11 flex-1 gap-2 rounded-lg px-4 text-xs font-semibold shadow-md sm:flex-none"
                        onClick={() => setExpenseModal(true)}
                    >
                        <Plus className="h-4 w-4" />
                        Registrar egreso
                    </Button>
                </div>
            </div>

                {/* Overview / Stats */}
                <CajaOverview stats={stats} />

            {/* Main Content Tabs (Listas) */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <CajaListEgresos egresos={egresos} />
                <CajaListCierres cierres={cierres} />
            </div>

            {/* Modals */}
            <CajaEgresoModal 
                expenseModal={expenseModal} 
                setExpenseModal={setExpenseModal} 
                addEgreso={addEgreso} 
                user={user} 
            />

            <CajaCierreModal 
                closureModal={closureModal} 
                setClosureModal={setClosureModal} 
                stats={stats} 
                user={user} 
                hotelActual={hotelActual}
                addCierre={addCierre}
                handlePrintHotel={handlePrintHotel}
                handlePrintPOS={handlePrintPOS}
                handleExportPDF={handleExportPDF}
                handleExportExcel={handleExportExcel}
                handlePrintTicket={handlePrintTicket}
            />
        </div>
    );
}
