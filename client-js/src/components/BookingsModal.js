import '../styles/bookings.css';
import { formatMoney } from '../utils/format.js';

export function createBookingsModal() {
  const element = document.createElement('div');
  element.className = 'modal';
  const box = document.createElement('div');
  box.className = 'modal__box';

  const head = document.createElement('div');
  head.className = 'modal__head';
  const title = document.createElement('h2');
  title.className = 'modal__title';
  title.textContent = 'Mis Reservas';
  const closeX = document.createElement('button');
  closeX.type = 'button';
  closeX.className = 'modal__close';
  closeX.textContent = '✕';
  head.append(title, closeX);

  const list = document.createElement('div');
  list.className = 'bookings';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn--secondary';
  closeBtn.textContent = 'Cerrar';

  box.append(head, list, closeBtn);
  element.appendChild(box);

  const close = () => element.classList.remove('modal--open');

  closeX.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  element.addEventListener('click', (event) => {
    if (event.target === element) close();
  });

  function line(text) {
    const p = document.createElement('p');
    p.className = 'booking__line';
    p.textContent = text;
    return p;
  }

  return {
    element,
    // records: reservas ya normalizadas (timestamp como numero)
    show(records) {
      list.replaceChildren();

      if (records.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'bookings__empty';
        empty.textContent = 'Aún no tienes compras confirmadas en esta sesión.';
        list.appendChild(empty);
      }

      // la mas reciente primero
      const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp);
      for (const record of sorted) {
        const card = document.createElement('div');
        card.className = 'booking';


        const code = document.createElement('div');
        code.className = 'booking__code';
        code.textContent = record.bookingCode;

        card.append(
          code,
          line(`Sillas: ${record.seatIds.join(', ')}`),
          line(`Total: ${formatMoney(record.totalAmount)}`),
          line(`Comprador: ${record.customerName} (${record.customerEmail})`),
          line(`Fecha: ${new Date(record.timestamp).toLocaleString('es-CO')}`)
        );
        list.appendChild(card);
      }
      element.classList.add('modal--open');
    },
  };
}