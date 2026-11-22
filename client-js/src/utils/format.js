//el model y el panel necesitan las mismas funciones de formato, entonces las trabajo aqui

export const formatMoney = (value) => `$${value.toLocaleString('es-CO')}`;

export function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// momento (ms) en que vence el bloqueo de una silla, segun el servidor
export const expiresAt = (seat) => seat.lockTimestamp + seat.lockDurationSeconds * 1000;