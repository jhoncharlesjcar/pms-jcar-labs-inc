import { Wifi, Tv, Droplets, Bath } from 'lucide-react';

export const AMENITIES_MAP = [
    { id: 'wifi', label: 'WiFi', icon: Wifi },
    { id: 'tv', label: 'Smart TV', icon: Tv },
    { id: 'agua', label: 'Agua Caliente', icon: Droplets },
    { id: 'bano', label: 'Baño Privado', icon: Bath },
];

export const parseAmenities = (desc) => {
    try {
        const parsed = JSON.parse(desc);
        if (parsed && typeof parsed === 'object') return parsed;
    } catch {
        const text = desc || '';
        return {
            wifi: text.toLowerCase().includes('wifi'),
            tv: text.toLowerCase().includes('tv') || text.toLowerCase().includes('smart'),
            agua: text.toLowerCase().includes('agua'),
            bano: text.toLowerCase().includes('baño') || text.toLowerCase().includes('privado')
        };
    }
    return { wifi: false, tv: false, agua: false, bano: false };
};
