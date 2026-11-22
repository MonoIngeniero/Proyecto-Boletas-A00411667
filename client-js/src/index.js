import './styles/base.css';
import { getBookingService } from './services/iceService.js';
import { startSeatsPolling } from './services/pollingService.js';
import { isAvailable, isLocked, isBooked, formatIceError } from './utils/iceutils.js';
import { createHeader } from './components/Header.js';

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

  const header = createHeader();
  app.appendChild(header.element);

  try {
    const service = await getBookingService();
    header.setEventInfo(await service.getEventInfo());

    startSeatsPolling(
      (seats) => {
        header.setOnline(true);
        header.setCounts(countSeats(seats));
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