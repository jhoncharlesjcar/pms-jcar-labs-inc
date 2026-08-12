/**
 * Envía un buffer ESC/POS a RawBT para imprimir en impresora térmica
 * @param {string} escPosBuffer - Buffer generado por un template comprobanteTermico.js
 * @returns {Promise<void>}
 */
export const printEscPos = async (escPosBuffer) => {
  const RAWBT_URL = 'http://localhost:8080/';
  const RAWBT_INTENT = 'intent://rawbt?';

  // Detectar entorno: móvil Android usa intent://, desktop usa HTTP local
  const isMobile = /Android/i.test(navigator.userAgent);

  if (isMobile) {
    // Android: abrir RawBT via deep link con el contenido codificado
    const encoded = encodeURIComponent(escPosBuffer);
    window.location.href = `${RAWBT_INTENT}text=${encoded}`;
    return;
  }

  // Desktop: enviar POST al servidor local de RawBT
  const response = await fetch(RAWBT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: escPosBuffer,
  });

  if (!response.ok) {
    throw new Error(`RawBT respondió con status ${response.status}. ¿Está ejecutándose RawBT?`);
  }
};
