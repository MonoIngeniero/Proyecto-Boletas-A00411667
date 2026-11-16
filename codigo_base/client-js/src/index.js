    import { getBookingService } from './services/iceService.js';

    async function initApp() {
      console.log('Iniciando cliente web de Reserva de Boletas...');

      try {
        const service = await getBookingService();

        // Prueba de llamada RPC asíncrona: obtener información del evento
        const eventInfo = await service.getEventInfo();
        console.log('Información del evento recibida del servidor:', eventInfo);

        // Renderizado básico inicial de prueba
        document.body.innerHTML = `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h1>🎟️ ${eventInfo.name}</h1>
            <p><strong>Lugar:</strong> ${eventInfo.venue}</p>
            <p><strong>Fecha:</strong> ${eventInfo.date}</p>
            <p><strong>Total de Sillas:</strong> ${eventInfo.totalSeats}</p>
            <p><strong>Disponibles:</strong> ${eventInfo.availableSeats} |
               <strong>Bloqueadas:</strong> ${eventInfo.lockedSeats} |
               <strong>Vendidas:</strong> ${eventInfo.bookedSeats}</p>
            <p style="color: green; font-weight: bold;"> Conectado exitosamente al servidor
            ZeroC Ice vía WebSocket.</p>
          </div>
        `;
      } catch (error) {
        console.error('Fallo en la conexión inicial:', error);
        document.body.innerHTML = `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: red;">
            <h2> Error de conexión con el backend</h2>
            <p>${error.message || error}</p>
            <p>Asegúrate de que el servidor Java esté corriendo (<code>./gradlew
            runServer</code>).</p>
          </div>
        `;
      }
    }

    // Ejecutar al cargar la página
    window.addEventListener('DOMContentLoaded', initApp);