import '../styles/selection.css';
import { getSeatZoneName } from '../utils/iceutils.js';
import { formatMoney, formatTime, expiresAt } from '../utils/format.js';

const WARNING_MS = 15000; // el temporizador se pone rojo con 15s o menos

function createButton(text, className) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn ${className}`;
  btn.textContent = text;
  return btn;
}

export function createSelectionPanel({ onRelease, onReleaseAll, onConfirm, onShowBookings }) {
    
  const element = document.createElement('aside');
  element.className = 'selection card';

  const title = document.createElement('h2');
  title.className = 'selection__title';
  title.textContent = 'Resumen de Selección';


  const timerBox = document.createElement('div');
  timerBox.className = 'timer';
  const timerLabel = document.createElement('span');
  timerLabel.className = 'timer__label';
  timerLabel.textContent = 'Tiempo de retención:';
  const timerValue = document.createElement('span');
  timerValue.className = 'timer__value';
  timerValue.textContent = '--:--';
  timerBox.append(timerLabel, timerValue);

  const subtitle = document.createElement('p');
  subtitle.className = 'selection__subtitle';

  const list = document.createElement('div');
  list.className = 'cart';

  const totalRow = document.createElement('div');
  totalRow.className = 'selection__total';
  const totalLabel = document.createElement('span');
  totalLabel.textContent = 'Total a pagar:';
  const totalValue = document.createElement('span');
  totalValue.className = 'selection__total-value';
  totalRow.append(totalLabel, totalValue);

  const confirmBtn = createButton('Confirmar Reserva', 'btn--primary');
  const releaseBtn = createButton('Liberar Sillas', 'btn--secondary');
  confirmBtn.addEventListener('click', () => onConfirm());
  releaseBtn.addEventListener('click', () => onReleaseAll());

  const bookingsLink = document.createElement('button');
  bookingsLink.type = 'button'; 
  bookingsLink.className = 'link-btn';
  bookingsLink.textContent = 'Ver mis reservas';
  bookingsLink.addEventListener('click', () => onShowBookings());

  element.append(title, timerBox, subtitle, list, totalRow, confirmBtn, releaseBtn, bookingsLink);


  let mySeats = [];

  // el tiempo mostrado es el del bloqueo que vence primero
  function renderTimer() {
    if (mySeats.length === 0) {
      timerValue.textContent = '--:--';
      timerBox.classList.remove('timer--warning');
      return;
    }
    const remaining = Math.min(...mySeats.map((s) => expiresAt(s) - Date.now()));
    timerValue.textContent = formatTime(remaining);
    timerBox.classList.toggle('timer--warning', remaining <= WARNING_MS);
  }

  function renderCart() {
    subtitle.textContent = `Sillas en retención (${mySeats.length}):`;
    list.replaceChildren();

    if (mySeats.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cart__empty';
      empty.textContent = 'Aún no has seleccionado sillas.';
      list.appendChild(empty);
    }

    for (const seat of mySeats) {
      const item = document.createElement('div');
      item.className = 'cart__item';

      const name = document.createElement('span');
      name.className = 'cart__name';
      name.textContent = `Silla ${seat.id} (${getSeatZoneName(seat.zone)})`;


      const price = document.createElement('span');
      price.textContent = formatMoney(seat.price);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'cart__remove';
      remove.textContent = '✕';
      remove.title = 'Quitar silla';
      remove.addEventListener('click', () => onRelease(seat.id));

      item.append(name, price, remove);
      list.appendChild(item);
    }

    totalValue.textContent = formatMoney(mySeats.reduce((sum, s) => sum + s.price, 0));
    confirmBtn.disabled = mySeats.length === 0;
    releaseBtn.disabled = mySeats.length === 0;
  }

  // reloj local: repinta el temporizador cada segundo, sin consultar al servidor
  const tickId = setInterval(renderTimer, 1000);
  renderCart();

  return {
    element,
    // recibe solo las sillas retenidas por este cliente
    update(seats) {
      mySeats = seats;
      renderCart();
      renderTimer();
    },

    destroy() { clearInterval(tickId); },
  };
}