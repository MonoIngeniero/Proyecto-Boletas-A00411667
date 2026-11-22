    import { getBookingService } from './iceService.js';
    import { normalizeSeat } from '../utils/iceutils.js';

    let pollingIntervalId = null;
    let isPollingActive = false;

    // inicia el sondeo periodico del inventario de asientos
    // consulta getallseats cada intervalms milisegundos (por defecto 2500ms)
    export function startSeatsPolling(onSeatsUpdated, onError = null, intervalMs = 2500) {
      if (isPollingActive) {
        return;
      }

      isPollingActive = true;
      console.log(`[polling] iniciando sondeo cada ${intervalMs}ms`);

      const poll = async () => {
        if (!isPollingActive) return;

        try {
          const service = await getBookingService();
          const rawSeats = await service.getAllSeats();

          // convierte los campos long a numeros nativos de javascript
          const seats = rawSeats.map(normalizeSeat);

          if (onSeatsUpdated) {
            onSeatsUpdated(seats);
          }
        } catch (error) {
          console.warn('[polling] error al consultar inventario de sillas:', error);
          if (onError) onError(error);
        }
      };

      // primera ejecucion inmediata
      poll();

      // ejecucion recurrente
      pollingIntervalId = setInterval(poll, intervalMs);
    }

    // detiene el sondeo periodico
    export function stopSeatsPolling() {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
      }
      isPollingActive = false;
      console.log('[polling] sondeo detenido');
    }

    // consulta manual puntual sin esperar el intervalo del sondeo
    export async function fetchSeatsOnce() {
      const service = await getBookingService();
      const rawSeats = await service.getAllSeats();
      return rawSeats.map(normalizeSeat);
    }