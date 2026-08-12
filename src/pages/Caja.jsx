import { useState } from 'react';
import { Wallet, Plus, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Context
import { useHotel } from '@/lib/HotelContext';
import { useAuth } from '@/contexts/AuthContext';

// Hooks
import { useCajaData } from './Caja/hooks/useCajaData';
import { useCajaExport } from './Caja/hooks/useCajaExport';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';

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
    const { egresos, cierres, stats, addEgreso, addCierre } = useCajaData(hotelActual?.id, user);
    
    const { 
        handlePrintTicket, handlePrintHotel, handlePrintPOS, 
        handleExportPDF, handleExportExcel 
    } = useCajaExport(hotelActual, user, stats);

    return (
        <div className="pt-2 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-4 page-enter">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-sm">
                            <Wallet className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tighter leading-none">Caja</h1>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">
                                Gestión diaria y flujos de efectivo
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button 
                        variant="outline" 
                        className="flex-1 sm:flex-none h-9 px-4 rounded-md border-border/50 hover:bg-muted/50 text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                        onClick={() => setClosureModal(true)}
                    >
                        <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                        Cierre
                    </Button>
                    <Button 
                        className="flex-1 sm:flex-none h-9 px-4 rounded-md bg-primary hover:bg-primary/90 shadow-md text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
                        onClick={() => setExpenseModal(true)}
                    >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Egreso
                    </Button>
                </div>
            </div>

                {/* Overview / Stats */}
                <CajaOverview stats={stats} />

            {/* Main Content Tabs (Listas) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
