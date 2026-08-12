import { useEffect, memo } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

const RegisterSW = memo(function RegisterSW() {
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
});
RegisterSW.displayName = 'RegisterSW';
export default RegisterSW;
