    import { Ice } from 'ice';
    import * as Generated from '../generated/BookingService.js';

    // modulo raiz de slice generado
    export const BookingApp = Generated.BookingApp
      || (typeof window !== 'undefined' && window.BookingApp)
      || Ice._ModuleRegistry.module('BookingApp');

    // enums oficiales de slice para comparacion por objeto
    export const SeatState = BookingApp.SeatState;
    export const SeatZone = BookingApp.SeatZone;

    // excepciones de negocio de slice
    export const {
      BookingException,
      SeatNotFoundException,
      SeatNotAvailableException,
      LockExpiredException,
      InvalidBookingException,
    } = BookingApp;

    // endpoint exclusivo por websocket en puerto 10002 segun rnf-4
    const ENDPOINT = 'BookingService:ws -h localhost -p 10002';

    let communicator = null;
    let bookingServiceProxy = null;

    // inicializa el communicator y obtiene el proxy tipado con checkedcast
    export async function getBookingService() {
      if (bookingServiceProxy) {
        return bookingServiceProxy;
      }

      try {
        console.log('[ice] inicializando communicator...');
        communicator = Ice.initialize();

        console.log(`[ice] conectando via websocket a: ${ENDPOINT}`);
        const base = communicator.stringToProxy(ENDPOINT);

        console.log('[ice] realizando checkedcast a bookingserviceprx...');
        bookingServiceProxy = await BookingApp.BookingServicePrx.checkedCast(base);

        if (!bookingServiceProxy) {
          throw new Error('no se pudo obtener el proxy bookingservice');
        }

        console.log('[ice] conexion establecida con exito.');
        return bookingServiceProxy;
      } catch (error) {
        console.error('[ice] error al conectar:', error);
        if (communicator) {
          await communicator.destroy();
          communicator = null;
        }
        throw error;
      }
    }

    // destruye el communicator al cerrar sesion o desmontar
    export async function destroyCommunicator() {
      if (communicator) {
        await communicator.destroy();
        communicator = null;
        bookingServiceProxy = null;
        console.log('[ice] communicator destruido');
      }
    }