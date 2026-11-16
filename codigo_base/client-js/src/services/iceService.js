import { Ice } from 'ice';
import * as Generated from '../generated/BookingService.js';

// En el navegador, ZeroC Ice registra el módulo en el registry de Ice o en window
const BookingApp = Generated.BookingApp 
  || (typeof window !== 'undefined' && window.BookingApp) 
  || Ice._ModuleRegistry.module('BookingApp');

    // Cadena de conexión usando EXCLUSIVAMENTE WebSocket (ws) en el puerto 10002 (RNF-4)
    const ENDPOINT = 'BookingService:ws -h localhost -p 10002';

    let communicator = null;
    let bookingServiceProxy = null;

    /**
     * Inicializa el Communicator de Ice y obtiene el proxy tipado asíncrono
     * @returns {Promise<BookingApp.BookingServicePrx>}
     */
    export async function getBookingService() {
      if (bookingServiceProxy) {
        return bookingServiceProxy;
      }

      try {
        console.log('[Ice] Inicializando communicator...');
        // 1. Inicialización de Ice en el navegador
        communicator = Ice.initialize();

        console.log(`[Ice] Conectando vía WebSocket a: ${ENDPOINT}`);
        // 2. Creación del proxy base con protocolo WebSocket
        const base = communicator.stringToProxy(ENDPOINT);

        console.log('[Ice] Realizando checkedCast a BookingServicePrx...');
        // 3. Downcast asíncrono tipado mediante async/await (Promise)
        bookingServiceProxy = await BookingApp.BookingServicePrx.checkedCast(base);

        if (!bookingServiceProxy) {
          throw new Error('No se pudo obtener el proxy: la interfaz BookingService no coincide o el servidor no responde.');
        }

        console.log('[Ice] Conexión establecida exitosamente con el backend.');
        return bookingServiceProxy;
      } catch (error) {
        console.error('[Ice] Error al conectar con el servidor:', error);
        // Limpieza en caso de error
        if (communicator) {
          await communicator.destroy();
          communicator = null;
        }
        throw error;
      }
    }

    /**
     * Destruye el communicator al cerrar o recargar la página
     */
    export async function destroyCommunicator() {
      if (communicator) {
        await communicator.destroy();
        communicator = null;
        bookingServiceProxy = null;
        console.log('[Ice] Communicator destruido.');
      }
    }