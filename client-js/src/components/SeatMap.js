import '../styles/seatmap.css';
import { getSeatZoneName, isLocked, isBooked } from '../utils/iceutils.js';
import { formatMoney } from '../utils/format.js';

const ZONE_ORDER = ['VIP', 'PLATEA', 'GENERAL'];
const ZONE_TITLES = { VIP: 'Zona VIP', PLATEA: 'Zona Platea', GENERAL: 'Zona General' };
const AISLE_AFTER = 5; // pasillo entre la silla 5 y la 6

// decide cómo se ve una silla según su estado y quién la tiene
function visualStatus(seat, clientId) {
  if (isBooked(seat)) return 'booked';
  if (isLocked(seat)) return seat.lockedByClientId === clientId ? 'mine' : 'locked';
  return 'available';
}

function createLegendItem(statusClass, text) {
  const item = document.createElement('div');
  item.className = 'legend__item';
  const sample = document.createElement('span');
  sample.className = `seat ${statusClass}`;
  const label = document.createElement('span');
  label.textContent = text;
  item.append(sample, label);
  return item;
}

// onSeatClick(seat) se ejecuta al pulsar una silla clicable
export function createSeatMap({ onSeatClick }) {
  const element = document.createElement('section');
  element.className = 'seatmap card';

  const title = document.createElement('h2');
  title.className = 'seatmap__title';
  title.textContent = 'Distribución de Sillas';

  const stage = document.createElement('div');
  stage.className = 'seatmap__stage';
  stage.textContent = '--- ESCENARIO ---';

  const grid = document.createElement('div');

  const legend = document.createElement('div');
  legend.className = 'legend';
  const legendTitle = document.createElement('strong');
  legendTitle.textContent = 'Convenciones de estado:';
  legend.append(
    legendTitle,
    createLegendItem('seat--available', 'Disponible'),
    createLegendItem('seat--mine', 'Seleccionada (mía)'),
    createLegendItem('seat--locked', 'Bloqueada (otro)'),
    createLegendItem('seat--booked', 'Vendida')
  );

  element.append(title, stage, grid, legend);

  const buttons = new Map();     // seatId -> <button>
  const latestSeats = new Map(); // seatId -> último objeto seat recibido
  const zoneTitles = {};         // 'VIP' | 'PLATEA' | 'GENERAL' -> nodo <h3>
  let zonePrices = null;         // precios por zona, vienen de getEventInfo()
  let built = false;

  // escribe "Zona VIP · $120.000" cuando ya hay precios y ya existen los títulos
  function applyPrices() {
    if (!zonePrices) return;
    for (const [zone, el] of Object.entries(zoneTitles)) {
      el.textContent = `${ZONE_TITLES[zone]} · ${formatMoney(zonePrices[zone])}`;
    }
  }

  // se ejecuta una sola vez: crea las 90 sillas
  function build(seats) {
    for (const zoneName of ZONE_ORDER) {
      const zone = document.createElement('div');
      zone.className = 'zone';
      const zoneTitle = document.createElement('h3');
      zoneTitle.className = 'zone__title';
      zoneTitle.textContent = ZONE_TITLES[zoneName];
      zoneTitles[zoneName] = zoneTitle;
      zone.appendChild(zoneTitle);

      const zoneSeats = seats.filter((s) => getSeatZoneName(s.zone) === zoneName);
      const rowNames = [...new Set(zoneSeats.map((s) => s.row))];

      for (const rowName of rowNames) {
        const row = document.createElement('div');
        row.className = 'row';
        const label = document.createElement('span');
        label.className = 'row__label';
        label.textContent = rowName;
        row.appendChild(label);

        for (const seat of zoneSeats.filter((s) => s.row === rowName)) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'seat seat--available';
          btn.textContent = seat.number;
          btn.addEventListener('click', () => onSeatClick(latestSeats.get(seat.id)));
          buttons.set(seat.id, btn);
          row.appendChild(btn);

          if (seat.number === AISLE_AFTER) {
            const aisle = document.createElement('span');
            aisle.className = 'row__aisle';
            row.appendChild(aisle);
          }
        }
        zone.appendChild(row);
      }
      grid.appendChild(zone);
    }
    applyPrices(); // por si los precios llegaron antes que las sillas
    built = true;
  }

  return {
    element,

    // se llama con cada respuesta del sondeo
    update(seats, clientId) {
      if (!built) build(seats);

      for (const seat of seats) {
        latestSeats.set(seat.id, seat);
        const btn = buttons.get(seat.id);
        const status = visualStatus(seat, clientId);
        btn.className = `seat seat--${status}`;
        btn.disabled = status === 'booked' || status === 'locked';
        btn.title = `${seat.id} · ${formatMoney(seat.price)}`;
      }
    },

    // info viene de getEventInfo()
    setPrices(info) {
      zonePrices = { VIP: info.vipPrice, PLATEA: info.plateaPrice, GENERAL: info.generalPrice };
      applyPrices();
    },
  };
}