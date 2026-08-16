/**
 * PageSkeleton — Sistema de loading states unificado
 * 
 * Renderiza esqueletos animados específicos para cada página.
 * Se usa como fallback de React.Suspense o como loading state
 * mientras los datos se cargan.
 * 
 * @example
 * <PageSkeleton variant="dashboard" />
 * <PageSkeleton variant="recepcion" />
 * <PageSkeleton variant="table" />
 * <PageSkeleton variant="default" />
 */

import { memo } from 'react';
import SkeletonBlock from './SkeletonBlock';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-6">
        <div className="space-y-3">
          <SkeletonBlock className="h-10 w-64" />
          <SkeletonBlock className="h-4 w-48" />
        </div>
        <SkeletonBlock className="h-12 w-44 rounded-xl" />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={`kpi-${i}`} variant="card" className="min-h-[100px]" />
        ))}
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-3">
          <SkeletonBlock variant="chart" className="min-h-[300px]" />
        </div>
        <div className="col-span-2 lg:col-span-1">
          <SkeletonBlock variant="card" className="min-h-[300px]" />
        </div>
        <div className="col-span-2 lg:col-span-2">
          <SkeletonBlock variant="card" className="min-h-[180px]" />
        </div>
        <div className="col-span-2 lg:col-span-2">
          <SkeletonBlock variant="card" className="min-h-[180px]" />
        </div>
      </div>
    </div>
  );
}
DashboardSkeleton.displayName = 'DashboardSkeleton';

function TableSkeleton({ rows = 6 }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-40" />
          <SkeletonBlock className="h-4 w-56" />
        </div>
        <SkeletonBlock className="h-10 w-36 rounded-lg" />
      </div>

      {/* Search/filter bar */}
      <div className="flex gap-3">
        <SkeletonBlock className="h-10 flex-1 rounded-lg" />
        <SkeletonBlock className="h-10 w-48 rounded-lg" />
      </div>

      {/* Table body */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={`th-${i}`} className="h-3 flex-1" />
            ))}
          </div>
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonBlock key={`row-${i}`} variant="table-row" />
        ))}
      </div>
    </div>
  );
}
TableSkeleton.displayName = 'TableSkeleton';

function RecepcionSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-36" />
          <SkeletonBlock className="h-4 w-48" />
        </div>
        <SkeletonBlock className="h-10 w-40 rounded-lg" />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <SkeletonBlock className="h-10 flex-1 rounded-lg" />
        <SkeletonBlock className="h-10 w-64 rounded-lg" />
      </div>

      {/* Reservation cards */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={`res-${i}`} variant="card" />
        ))}
      </div>
    </div>
  );
}
RecepcionSkeleton.displayName = 'RecepcionSkeleton';

function VentasSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-48" />
          <SkeletonBlock className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-10 w-32 rounded-lg" />
          <SkeletonBlock className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={`stat-${i}`} variant="card" className="min-h-[100px]" />
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={`th-${i}`} className="h-3 flex-1" />
            ))}
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={`row-${i}`} variant="table-row" />
        ))}
      </div>
    </div>
  );
}
VentasSkeleton.displayName = 'VentasSkeleton';

function CajaSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-24" />
          <SkeletonBlock className="h-4 w-40" />
        </div>
        <SkeletonBlock className="h-10 w-36 rounded-lg" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={`caja-stat-${i}`} variant="card" className="min-h-[104px]" />
        ))}
      </div>

      {/* Egresos table */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={`th-${i}`} className="h-3 flex-1" />
            ))}
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={`row-${i}`} variant="table-row" />
        ))}
      </div>
    </div>
  );
}
CajaSkeleton.displayName = 'CajaSkeleton';

function POSSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Catalog (2 columns) */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-8 w-40" />
          <SkeletonBlock className="h-10 w-48 rounded-lg" />
        </div>
        {/* Category pills */}
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={`cat-${i}`} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        {/* Product grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={`prod-${i}`} variant="card" className="min-h-[120px]" />
          ))}
        </div>
      </div>

      {/* Cart (1 column) */}
      <div className="space-y-4">
        <SkeletonBlock className="h-8 w-24" />
        <SkeletonBlock variant="card" className="min-h-[300px]" />
        <SkeletonBlock className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
POSSkeleton.displayName = 'POSSkeleton';

function ConfigSkeleton() {
  return (
    <div className="space-y-6">
      {/* Section tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={`tab-${i}`} className="h-10 w-28 rounded-lg" />
        ))}
      </div>

      {/* Form */}
      <div className="bg-card border border-border/50 rounded-xl p-6 space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`field-${i}`} className="space-y-2">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <SkeletonBlock className="h-10 w-28 rounded-lg" />
          <SkeletonBlock className="h-10 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
ConfigSkeleton.displayName = 'ConfigSkeleton';

function ReportesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header with date range */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-36" />
          <SkeletonBlock className="h-4 w-52" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-10 w-36 rounded-lg" />
          <SkeletonBlock className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      {/* Chart */}
      <SkeletonBlock variant="chart" className="min-h-[300px]" />

      {/* Table */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={`th-${i}`} className="h-3 flex-1" />
            ))}
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={`row-${i}`} variant="table-row" />
        ))}
      </div>
    </div>
  );
}
ReportesSkeleton.displayName = 'ReportesSkeleton';

function LimpiezaSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-32" />
          <SkeletonBlock className="h-4 w-44" />
        </div>
        <SkeletonBlock className="h-10 w-36 rounded-lg" />
      </div>

      {/* Room cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonBlock key={`room-${i}`} variant="card" className="min-h-[100px]" />
        ))}
      </div>
    </div>
  );
}
LimpiezaSkeleton.displayName = 'LimpiezaSkeleton';

function HuespedesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-36" />
          <SkeletonBlock className="h-4 w-48" />
        </div>
      </div>
      <SkeletonBlock className="h-10 w-full rounded-lg" />
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={`huesp-${i}`} variant="table-row" />
        ))}
      </div>
    </div>
  );
}
HuespedesSkeleton.displayName = 'HuespedesSkeleton';

/**
 * PageSkeleton — Componente principal
 * 
 * @param {Object} props
 * @param {'dashboard'|'recepcion'|'ventas'|'caja'|'pos'|'config'|'reportes'|'limpieza'|'huespedes'|'table'|'default'} props.variant
 * @param {number} props.rows - Number of table rows (for 'table' variant)
 */
const PageSkeleton = memo(function PageSkeleton(/** @type {any} */ { variant = 'default', rows }) {
  const variants = {
    dashboard: <DashboardSkeleton />,
    recepcion: <RecepcionSkeleton />,
    ventas: <VentasSkeleton />,
    caja: <CajaSkeleton />,
    pos: <POSSkeleton />,
    config: <ConfigSkeleton />,
    reportes: <ReportesSkeleton />,
    limpieza: <LimpiezaSkeleton />,
    huespedes: <HuespedesSkeleton />,
    table: <TableSkeleton rows={rows} />,
    default: <TableSkeleton rows={rows ?? 5} />,
  };

  return (
    <div className="w-full" role="status" aria-label="Cargando contenido">
      {variants[variant] ?? variants.default}
      <span className="sr-only">Cargando...</span>
    </div>
  );
});
PageSkeleton.displayName = 'PageSkeleton';
export default PageSkeleton;
