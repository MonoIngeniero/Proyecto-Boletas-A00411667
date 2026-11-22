import '../styles/checkout.css';
import { formatMoney, formatTime, expiresAt } from '../utils/format.js';
import { getSeatZoneName } from '../utils/iceutils.js';

const WARNING_MS = 15000;
// misma regla de correo que valida el servidor
const EMAIL_PATTERN = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function createField(labelText, type, placeholder) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const label = document.createElement('label');
  label.className = 'field__label';
  label.textContent = labelText;
  const input = document.createElement('input');
  input.className = 'field__input';
  input.type = type;
  input.placeholder = placeholder;
  const error = document.createElement('div');
  error.className = 'field__error';
  wrap.append(label, input, error);
  return { wrap, input, error };
}

function createButton(text, className, type = 'button') {
  const btn = document.createElement('button');
  btn.type = type;
  btn.className = `btn ${className}`;
  btn.textContent = text;
  return btn;
}


// onSubmit({ name, email }) lo ejecuta quien use el modal; onLost() avisa que ya no hay sillas vigentes
export function createCheckoutModal({ onSubmit, onLost }) {
  const element = document.createElement('div');
  element.className = 'modal';
  const box = document.createElement('div');
  box.className = 'modal__box';

  // cabecera
  const head = document.createElement('div');
  head.className = 'modal__head';
  const title = document.createElement('h2');
  title.className = 'modal__title';
  title.textContent = 'Datos del Comprador';
  const closeX = document.createElement('button');
  closeX.type = 'button';
  closeX.className = 'modal__close';
  closeX.textContent = '✕';
  head.append(title, closeX);

  const hint = document.createElement('p');
  hint.className = 'modal__hint';
  hint.textContent = 'Ingrese su información para emitir el boleto.';

  // resumen de la compra
  const summary = document.createElement('div');
  summary.className = 'summary';
  const summarySeats = document.createElement('div');
  const summaryTime = document.createElement('div');
  summaryTime.className = 'summary__time';
  summary.append(summarySeats, summaryTime);

  // formulario

  const form = document.createElement('form');
  form.noValidate = true; // la validacion la hacemos nosotros, con mensajes propios
  const nameField = createField('Nombre Completo', 'text', 'Nombre y apellido');
  const emailField = createField('Correo Electrónico', 'email', 'correo@ejemplo.com');
  const submitBtn = createButton('Finalizar y Pagar', 'btn--primary', 'submit');
  const backBtn = createButton('Volver al Plano', 'btn--secondary');
  form.append(nameField.wrap, emailField.wrap, submitBtn, backBtn);

  // comprobante (oculto hasta que la compra se confirma)
  const receipt = document.createElement('div');
  receipt.className = 'receipt';
  receipt.hidden = true;
  const receiptTitle = document.createElement('h3');
  receiptTitle.className = 'receipt__title';
  receiptTitle.textContent = '--- COMPROBANTE GENERADO ---';
  const receiptMsg = document.createElement('p');
  receiptMsg.className = 'receipt__msg';
  const receiptCode = document.createElement('div');
  receiptCode.className = 'receipt__code';
  const receiptSeats = document.createElement('p');
  receiptSeats.className = 'receipt__detail';
  const receiptTotal = document.createElement('p');
  receiptTotal.className = 'receipt__detail';
  const receiptEmail = document.createElement('p');
  receiptEmail.className = 'receipt__detail';
  const receiptClose = createButton('Cerrar', 'btn--secondary');
  receipt.append(receiptTitle, receiptMsg, receiptCode, receiptSeats, receiptTotal, receiptEmail, receiptClose);

  box.append(head, hint, summary, form, receipt);
  element.appendChild(box);

  let state = 'closed'; // closed | form | receipt

  let busy = false;
  let seats = [];
  let tickId = null;

  function renderSummary() {
    const total = seats.reduce((sum, s) => sum + s.price, 0);
    const names = seats.map((s) => `${s.id} (${getSeatZoneName(s.zone)})`).join(', ');
    summarySeats.textContent = `Sillas: ${names} · Valor total: ${formatMoney(total)}`;

    if (seats.length > 0) {
      const remaining = Math.min(...seats.map((s) => expiresAt(s) - Date.now()));
      summaryTime.textContent = `Retención activa: ${formatTime(remaining)} restantes`;
      summaryTime.classList.toggle('summary__time--warning', remaining <= WARNING_MS);
    }
  }

  function close() {
    if (busy) return; // no se cierra mientras se procesa el pago
    state = 'closed';
    element.classList.remove('modal--open');
    clearInterval(tickId);
    tickId = null;
  }

  function validate() {
    const name = nameField.input.value.trim();
    const email = emailField.input.value.trim();
    nameField.error.textContent = name ? '' : 'El nombre es obligatorio.';
    emailField.error.textContent = EMAIL_PATTERN.test(email) ? '' : 'Ingresa un correo válido.';
    return name && EMAIL_PATTERN.test(email) ? { name, email } : null;
  }


  form.addEventListener('submit', (event) => {
    event.preventDefault(); // evita que el navegador recargue la pagina
    if (busy) return;
    const data = validate();
    if (data) onSubmit(data);
  });
  backBtn.addEventListener('click', close);
  closeX.addEventListener('click', close);
  receiptClose.addEventListener('click', close);
  element.addEventListener('click', (event) => {
    if (event.target === element) close(); // clic en el fondo oscuro
  });

  return {
    element,

    open(currentSeats) {
      seats = currentSeats;
      state = 'form';
      form.hidden = false;
      hint.hidden = false;
      summary.hidden = false;
      receipt.hidden = true;
      title.textContent = 'Datos del Comprador';
      nameField.input.value = '';
      emailField.input.value = '';
      nameField.error.textContent = '';
      emailField.error.textContent = '';
      renderSummary();
      element.classList.add('modal--open');
      clearInterval(tickId);
      tickId = setInterval(renderSummary, 1000); // reloj local del modal

      nameField.input.focus();
    },

    // recibe las sillas vigentes del cliente en cada actualizacion
    updateSeats(currentSeats) {
      if (state !== 'form') return; // con el comprobante abierto no se toca nada
      if (currentSeats.length === 0) {
        busy = false;
        close();
        onLost();
        return;
      }
      seats = currentSeats;
      renderSummary();
    },

    setBusy(value) {
      busy = value;
      submitBtn.disabled = value;
      backBtn.disabled = value;
      submitBtn.textContent = value ? 'Procesando...' : 'Finalizar y Pagar';
    },

    // result viene de confirmBooking y ya esta normalizado
    showReceipt(result, email) {
      state = 'receipt';
      title.textContent = 'Compra completada';
      form.hidden = true;
      hint.hidden = true;
      summary.hidden = true;
      receipt.hidden = false;
      receiptMsg.textContent = result.message;

      receiptCode.textContent = `CÓDIGO: ${result.bookingCode}`;
      receiptSeats.textContent = `Sillas: ${result.seatIds.join(', ')}`;
      receiptTotal.textContent = `Total pagado: ${formatMoney(result.totalAmount)}`;
      receiptEmail.textContent = `Correo registrado: ${email}`;
      clearInterval(tickId);
      tickId = null;
    },
  };
}