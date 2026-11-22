//lo tengo como componente: funcion que construye un trozo de la pag con el DOM y lo devuelve listo para usar 
//DOM: Es la forma en que el codigo "habla" con lo que se ve en pantalla

document.title = "Proyecto Boletas ";

import '../styles/header.css';

// crea un contador del encabezado y devuelve la caja y su nodo de valor
function createStat(label) {
  const box = document.createElement('div');
  box.className = 'stat';

  const labelEl = document.createElement('span');
  labelEl.className = 'stat__label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'stat__value';
  valueEl.textContent = '-';

  box.append(labelEl, valueEl);
  return { box, valueEl };
}

export function createHeader() {
  const element = document.createElement('header');
  element.className = 'header card';

  const info = document.createElement('div');
  const title = document.createElement('h1');
  title.className = 'header__title';
  title.textContent = 'Icesi Live Arena — Reserva de Boletas';
  const subtitle = document.createElement('p');
  subtitle.className = 'header__subtitle';
  subtitle.textContent = 'Cargando evento...';
  info.append(title, subtitle);

  const stats = document.createElement('div');
  stats.className = 'header__stats';
  const available = createStat('DISPONIBLES');
  const locked = createStat('RETENIDAS');
  const booked = createStat('OCUPADAS');
  const status = createStat('ESTADO');
  status.valueEl.textContent = 'OFFLINE';
  stats.append(available.box, locked.box, booked.box, status.box);

  element.append(info, stats);

  return {
    element,
    // eventInfo viene de getEventInfo()
    setEventInfo(eventInfo) {
      subtitle.textContent =
        `Evento: ${eventInfo.name} · ${eventInfo.venue} · Aforo total: ${eventInfo.totalSeats} sillas`;
    },
    // counts = { available, locked, booked }
    setCounts(counts) {
      available.valueEl.textContent = counts.available;
      locked.valueEl.textContent = counts.locked;
      booked.valueEl.textContent = counts.booked;
    },
    setOnline(isOnline) {
      status.valueEl.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
      status.valueEl.classList.toggle('stat__value--offline', !isOnline);
    },
  };
}