import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AIService } from '@/services/ai.service';
import { Plus, Trash2, Edit2, Check, Search } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
    { id: 'general', label: 'General' },
    { id: 'servicios', label: 'Servicios' },
    { id: 'politicas', label: 'Políticas' },
    { id: 'ubicacion', label: 'Ubicación' },
    { id: 'faq', label: 'Preguntas Frecuentes' },
    { id: 'amenidades', label: 'Amenidades' }
];

/** @typedef {import('@/types/ai.types').AIKnowledge} AIKnowledge */

export default function KnowledgeManager({ hotelId }) {
    const queryClient = useQueryClient();
    const [editingItem, setEditingItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    const { data: knowledgeList, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['ai-knowledge', hotelId],
        queryFn: () => AIService.getKnowledge(hotelId)
    });

    const upsertMutation = useMutation({
            mutationFn: (/** @type {any} */ data) => AIService.upsertKnowledge(hotelId, data),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['ai-knowledge', hotelId] });
                setEditingItem(null);
                toast.success("Conocimiento guardado correctamente");
            }
        });

        const deleteMutation = useMutation({
            /** @param {string} id */
            mutationFn: (id) => AIService.deleteKnowledge(id),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['ai-knowledge', hotelId] });
                toast.success("Entrada eliminada");
            }
        });

        const filteredList = (knowledgeList || []).filter((k) => {
            const matchesSearch = k.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  k.content.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeCategory === 'all' || k.category === activeCategory;
            return matchesSearch && matchesCategory;
        });

        const handleSave = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        upsertMutation.mutate({
            id: editingItem?.id,
            title: formData.get('title')?.toString() || '',
            category: formData.get('category')?.toString() || 'general',
            content: formData.get('content')?.toString() || '',
            priority: parseInt(formData.get('priority')?.toString() || '0', 10),
            activo: formData.get('activo') === 'on'
        });
    };

    return (
        <div className="space-y-6">
            {isError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">No se pudo cargar la base de conocimiento. {error?.message}<button type="button" onClick={() => refetch()} className="ml-2 underline">Reintentar</button></div>}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <p className="text-sm text-muted-foreground max-w-xl">
                    Lo que escribas aquí será utilizado por el asistente virtual para responder preguntas de los huéspedes. Sé claro y conciso.
                </p>
                <button 
                    onClick={() => setEditingItem({ title: '', content: '', category: 'general', priority: 0, activo: true })}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Entrada
                </button>
            </div>

            {editingItem && (
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Título</label>
                                <input name="title" defaultValue={editingItem.title} required className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm" placeholder="Ej: Horarios de desayuno" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Categoría</label>
                                <select name="category" defaultValue={editingItem.category} className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm">
                                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Contenido (Lo que sabrá el agente)</label>
                            <textarea 
                                name="content" 
                                defaultValue={editingItem.content} 
                                required 
                                rows={4}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm custom-scrollbar" 
                                placeholder="El desayuno buffet está incluido y se sirve de 7:00 AM a 10:00 AM en el restaurante del primer piso." 
                            />
                        </div>
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Prioridad (0-100)</label>
                                <input name="priority" type="number" defaultValue={editingItem.priority} className="w-24 px-3 py-2 bg-background border border-input rounded-md text-sm" />
                            </div>
                            <div className="flex items-center gap-2 mt-6">
                                <input type="checkbox" name="activo" id="activo" defaultChecked={editingItem.activo} className="w-4 h-4 rounded border-input" />
                                <label htmlFor="activo" className="text-sm">Activo (visible para la IA)</label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
                            <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted rounded-md transition-colors">Cancelar</button>
                            <button type="submit" disabled={upsertMutation.isPending} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2">
                                {upsertMutation.isPending ? 'Guardando...' : <><Check className="w-4 h-4"/> Guardar</>}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-between bg-muted/30 p-3 rounded-lg border border-border">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                        type="text" 
                        placeholder="Buscar conocimiento..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-input rounded-md"
                    />
                </div>
                <div className="flex space-x-2 overflow-x-auto custom-scrollbar">
                    <button onClick={() => setActiveCategory('all')} className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-colors ${activeCategory === 'all' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted'}`}>Todos</button>
                    {CATEGORIES.map(c => (
                        <button key={c.id} onClick={() => setActiveCategory(c.id)} className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-colors ${activeCategory === c.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{c.label}</button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-10 text-muted-foreground">Cargando base de conocimiento...</div>
            ) : filteredList.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground">
                    <p className="font-medium text-foreground">No hay entradas de conocimiento</p>
                    <p className="text-sm mt-1">Crea entradas para enseñarle al agente sobre tu hotel.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredList.map(item => (
                        <div key={item.id} className={`bg-card border rounded-xl p-4 flex flex-col hover:border-primary/50 transition-colors ${!item.activo ? 'opacity-60 grayscale-[50%]' : 'border-border'}`}>
                            <div className="flex justify-between items-start mb-2 gap-2">
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-sm">{CATEGORIES.find(c => c.id === item.category)?.label || item.category}</span>
                                    <h3 className="font-semibold text-foreground mt-1 line-clamp-1" title={item.title}>{item.title}</h3>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setEditingItem(item)} className="p-1.5 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded transition-colors" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>
                                    <button 
                                        onClick={() => { if(window.confirm('¿Eliminar esta entrada?')) deleteMutation.mutate(item.id) }} 
                                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors" title="Eliminar"
                                    ><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-4 flex-1 whitespace-pre-wrap">{item.content}</p>
                            {!item.activo && <div className="mt-3 text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-1 rounded inline-block self-start">Inactivo</div>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
