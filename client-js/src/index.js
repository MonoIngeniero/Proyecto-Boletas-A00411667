import './styles/base.css';
import { getBookingService } from './services/iceService.js';
import { startSeatsPolling } from './services/pollingService.js';
import { isAvailable, isLocked, isBooked, formatIceError } from './utils/iceutils.js';
import { createHeader } from './components/Header.js';
import { createSeatMap } from './components/SeatMap.js';
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
  const app = document.createElement('div');
  app.className = 'app';
  document.body.appendChild(app);

  const clientId = getClientId();

  const header = createHeader();
  app.appendChild(header.element);

  const seatMap = createSeatMap({
    onSeatClick: (seat) => console.log('Clic en silla:', seat.id),
  });
  app.appendChild(seatMap.element);


  try {
    const service = await getBookingService();
    header.setEventInfo(await service.getEventInfo());

    startSeatsPolling(
      (seats) => {
        header.setOnline(true);
        header.setCounts(countSeats(seats));
        seatMap.update(seats, clientId);
      },
      () => header.setOnline(false)
    );
  } catch (error) {
    header.setOnline(false);
    const box = document.createElement('div');
    box.className = 'error-box';
    box.textContent = `No se pudo conectar con el servidor: ${formatIceError(error)}`;
    app.appendChild(box);
  }
}

window.addEventListener('DOMContentLoaded', initApp);