import './styles/base.css';
import { getBookingService } from './services/iceService.js';
import { startSeatsPolling, fetchSeatsOnce } from './services/pollingService.js';
import {
  isAvailable, isLocked, isBooked, formatIceError,
  normalizeBookingResult, normalizeBookingRecord,
} from './utils/iceutils.js';
import { createHeader } from './components/Header.js';
import { createSeatMap } from './components/SeatMap.js';
import { createSelectionPanel } from './components/SelectionPanel.js';
import { createCheckoutModal } from './components/CheckoutModal.js';
import { createBookingsModal } from './components/BookingsModal.js';
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
    onConfirm: () => modal.open(mySeats),
    onShowBookings: showMyBookings,
  });
  const modal = createCheckoutModal({
    onSubmit: handleCheckout,
    onLost: () => notifier.show('Tus sillas ya no están retenidas. Selecciónalas de nuevo.', 'error'),
  });
  const bookingsModal = createBookingsModal();

  const app = document.createElement('div');
  app.className = 'app';
  const main = document.createElement('div');
  main.className = 'main';
  main.append(seatMap.element, panel.element);
  app.append(header.element, main);

  // aviso de desconexión (RF-7), oculto mientras haya conexión
  const offlineBox = document.createElement('div');
  offlineBox.className = 'error-box';
  offlineBox.textContent = 'Sin conexión con el servidor. Reintentando automáticamente...';
  offlineBox.hidden = true;
  app.prepend(offlineBox);

  document.body.append(app, modal.element, bookingsModal.element);


  let mySeats = [];                // sillas retenidas por este cliente (última actualización)
  let mySeatIds = [];
  const releasedByMe = new Set();  // sillas que se soltaron o compradas 
  const busy = new Set();          // sillas con una llamada RPC en curso
  let online = null;               
  let eventInfoLoaded = false;     // si ya cargamos nombre del evento y precios

  function setConnection(isOnline) {
    header.setOnline(isOnline);
    offlineBox.hidden = isOnline;
    // avisa solo cuando cambia el estado, no en cada consulta
    if (online !== null && online !== isOnline) {
      notifier.show(
        isOnline ? 'Conexión con el servidor restablecida.' : 'Se perdió la conexión con el servidor.',
        isOnline ? 'success' : 'error'
      );
    }
    online = isOnline;
  }

  // carga nombre del evento y precios
  // si falla, se reintenta en la próxima actualización
  async function loadEventInfo() {
    if (eventInfoLoaded) return;
    eventInfoLoaded = true; // evita llamadas simultáneas
    try {
      const service = await getBookingService();
      const info = await service.getEventInfo();
      header.setEventInfo(info);
      seatMap.setPrices(info);
    } catch (error) {
      eventInfoLoaded = false;
    }
  }

  // aplica una lista de sillas a todos los componentes
  function applySeats(seats) {
    setConnection(true);
    loadEventInfo();
    header.setCounts(countSeats(seats));
    seatMap.update(seats, clientId);

    const mine = seats.filter((s) => isLocked(s) && s.lockedByClientId === clientId);
    const nowIds = mine.map((s) => s.id);

    // una silla que estaba en el carrito y desapareció sin que la soltara
    // : expiró
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

  // consulta inmediata
  //  sin esperar el siguiente ciclo del sondeo
  async function refresh() {
    try {
      applySeats(await fetchSeatsOnce());
    } catch (error) {
      setConnection(false);
    }
  }

  // ejecuta una llamada RPC sobre una silla
  // evitando doble clic y notificando errores
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

  // RF-2: clic en una silla
  function handleSeatClick(seat) {
    const isMine = isLocked(seat) && seat.lockedByClientId === clientId;
    if (isMine) {
      releaseOne(seat.id); // clic sobre una silla mía: la suelto
      return;
    }
    runSeatAction(seat.id, async (service) => {
      await service.lockSeat(seat.id, clientId);
      notifier.show(`Silla ${seat.id} retenida por 90 segundos.`, 'success');
    });
  }

  // RF-4: liberación manual
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

  // RF-6: consulta las compras confirmadas de este cliente
  async function showMyBookings() {
    try {
      const service = await getBookingService();
      const raw = await service.getMyBookings(clientId);
      bookingsModal.show(raw.map(normalizeBookingRecord));
    } catch (error) {
      notifier.show(formatIceError(error), 'error');
    }
  }

  //arranque
  // el sondeo arranca siempre: si el servidor está apagado, reintenta solo hasta que aparezca
  startSeatsPolling(applySeats, () => setConnection(false));
}

window.addEventListener('DOMContentLoaded', initApp);