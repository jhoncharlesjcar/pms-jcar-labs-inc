import React, { memo } from 'react';
import InventarioInsumos from '@/components/insumos/InventarioInsumos';

const InsumosPage = memo(function InsumosPage() {
    return (
        <div className="w-full space-y-4 page-enter">
            <InventarioInsumos />
        </div>
    );
});

export default InsumosPage;
