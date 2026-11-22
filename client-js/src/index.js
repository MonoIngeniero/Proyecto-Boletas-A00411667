import './styles/base.css';
import { getBookingService } from './services/iceService.js';
import { startSeatsPolling, fetchSeatsOnce } from './services/pollingService.js';
import {
  isAvailable, isLocked, isBooked, formatIceError, normalizeBookingResult,
} from './utils/iceutils.js';
import { createHeader } from './components/Header.js';
import { createSeatMap } from './components/SeatMap.js';
import { createSelectionPanel } from './components/SelectionPanel.js';
import { createCheckoutModal } from './components/CheckoutModal.js';
import { createNotifier } from './components/Notifier.js';
import { getClientId } from './utils/session.js';

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
    onConfirm: () => modal.open(mySeats),
  });
  const modal = createCheckoutModal({
    onSubmit: handleCheckout,
    onLost: () => notifier.show('Tus sillas ya no están retenidas. Selecciónalas de nuevo.', 'error'),
  });

  const app = document.createElement('div');
  app.className = 'app';
  const main = document.createElement('div');
  main.className = 'main';
  main.append(seatMap.element, panel.element);
  app.append(header.element, main);
  document.body.append(app, modal.element);

  let mySeats = [];                // sillas retenidas por este cliente (ultima actualizacion)
  let mySeatIds = [];
  const releasedByMe = new Set();  // sillas que solté o compré a propósito
  const busy = new Set();          // sillas con una llamada RPC en curso

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
    mySeats = mine;
    mySeatIds = nowIds;
    panel.update(mine);
    modal.updateSeats(mine);
  }

  async function refresh() {
    try {
      applySeats(await fetchSeatsOnce());
    } catch (error) {
      header.setOnline(false);
    }
  }

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
      releaseOne(seat.id);
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

  // RF-5: confirma la compra de todas las sillas retenidas
  async function handleCheckout({ name, email }) {
    modal.setBusy(true);
    try {
      const service = await getBookingService();
      const raw = await service.confirmBooking([...mySeatIds], clientId, name, email);
      const result = normalizeBookingResult(raw);
      result.seatIds.forEach((id) => releasedByMe.add(id)); // pasaron a BOOKED, no expiraron
      modal.showReceipt(result, email);
      notifier.show('Compra confirmada.', 'success');
    } catch (error) {
      notifier.show(formatIceError(error), 'error');
    } finally {
      modal.setBusy(false);
      await refresh();
    }
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