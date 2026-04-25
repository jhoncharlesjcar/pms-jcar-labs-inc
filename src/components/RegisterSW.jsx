import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

export default function RegisterSW() {
  useEffect(() => {
    registerSW({
      onNeedRefresh() {
        toast('Nueva versión disponible', {
          action: {
            label: 'Actualizar',
            onClick: () => window.location.reload(),
          },
        });
      },
      onOfflineReady() {
        toast.success('Sistema listo para usar sin internet');
      },
    });
  }, []);

  return null;
}
