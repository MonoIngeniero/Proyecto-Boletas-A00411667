import './styles/base.css';
import { getBookingService } from './services/iceService.js';
import { startSeatsPolling, fetchSeatsOnce } from './services/pollingService.js';
import { isAvailable, isLocked, isBooked, formatIceError } from './utils/iceutils.js';
import { createHeader } from './components/Header.js';
import { createSeatMap } from './components/SeatMap.js';
import { createSelectionPanel } from './components/SelectionPanel.js';
import { createNotifier } from './components/Notifier.js';
import { getClientId } from './utils/session.js';

// cuenta las sillas por estado comparando enums por referencia
function countSeats(seats) {
  return {
    available: seats.filter(isAvailable).length,
    locked: seats.filter(isLocked).length,
    booked: seats.filter(isBooked).length,
  };
}

async function initApp() {
  const clientId = getClientId();
  const notifier = createNotifier();
  document.body.appendChild(notifier.element);

  const header = createHeader();
  const seatMap = createSeatMap({ onSeatClick: handleSeatClick });
  const panel = createSelectionPanel({
    onRelease: releaseOne,
    onReleaseAll: releaseAll,
    onConfirm: () => notifier.show('...', 'info'),
  });

  const app = document.createElement('div');

  app.className = 'app';
  const main = document.createElement('div');
  main.className = 'main';
  main.append(seatMap.element, panel.element);
  app.append(header.element, main);
  document.body.appendChild(app);

  let mySeatIds = [];              // sillas que este cliente tenia en la ultima actualizacion
  const releasedByMe = new Set();  // sillas que yo solté a propósito
  const busy = new Set();          // sillas con una llamada RPC en curso

  // aplica una lista de sillas a todos los componentes
  function applySeats(seats) {
    header.setOnline(true);
    header.setCounts(countSeats(seats));
    seatMap.update(seats, clientId);

    const mine = seats.filter((s) => isLocked(s) && s.lockedByClientId === clientId);
    const nowIds = mine.map((s) => s.id);

    // una silla que estaba en mi carrito y desaparecio sin que yo la soltara: expiró
    for (const id of mySeatIds) {
      if (!nowIds.includes(id)) {
        if (releasedByMe.has(id)) releasedByMe.delete(id);
        else notifier.show(`El tiempo de la silla ${id} expiró y fue liberada.`, 'error');
      }
    }
    mySeatIds = nowIds;
    panel.update(mine);
  }

  // consulta inmediata, sin esperar el siguiente ciclo del sondeo

  async function refresh() {
    try {
      applySeats(await fetchSeatsOnce());
    } catch (error) {
      header.setOnline(false);
    }
  }

  // ejecuta una llamada RPC sobre una silla, evitando doble clic y notificando errores
  async function runSeatAction(seatId, action) {
    if (busy.has(seatId)) return;
    busy.add(seatId);
    try {
      await action(await getBookingService());
    } catch (error) {
      notifier.show(formatIceError(error), 'error');
    } finally {
      busy.delete(seatId);
      await refresh();
    }
  }

  function handleSeatClick(seat) {
    const isMine = isLocked(seat) && seat.lockedByClientId === clientId;
    if (isMine) {
      releaseOne(seat.id); // clic sobre una silla mia: la suelto
      return;
    }
    runSeatAction(seat.id, async (service) => {
      await service.lockSeat(seat.id, clientId);
      notifier.show(`Silla ${seat.id} retenida por 90 segundos.`, 'success');
    });

  }

  function releaseOne(seatId) {
    releasedByMe.add(seatId);
    return runSeatAction(seatId, (service) => service.releaseSeat(seatId, clientId));
  }

  function releaseAll() {
    return Promise.allSettled(mySeatIds.map(releaseOne));
  }

  try {
    const service = await getBookingService();
    header.setEventInfo(await service.getEventInfo());
    startSeatsPolling(applySeats, () => header.setOnline(false));
  } catch (error) {
    header.setOnline(false);
    const box = document.createElement('div');
    box.className = 'error-box';
    box.textContent = `No se pudo conectar con el servidor: ${formatIceError(error)}`;
    app.appendChild(box);
  }
}

window.addEventListener('DOMContentLoaded', initApp);