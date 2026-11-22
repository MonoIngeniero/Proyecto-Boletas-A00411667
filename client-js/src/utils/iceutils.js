
    import {
      SeatState,
      SeatZone,
      BookingException,
      SeatNotFoundException,
      SeatNotAvailableException,
      LockExpiredException,
      InvalidBookingException
    } from '../services/iceService.js';

    // convierte un objeto ice.long a numero nativo de js con .tonumber()
    export function longToNumber(val) {
      if (val === null || val === undefined) {
        return 0;
      }
      if (typeof val === 'object' && typeof val.toNumber === 'function') {
        return val.toNumber();
      }
      return Number(val) || 0;
    }

    // normaliza los campos de tipo long de un asiento
    export function normalizeSeat(seat) {
      if (!seat) return null;
      return {
        ...seat,
        lockTimestamp: longToNumber(seat.lockTimestamp),
        lockDurationSeconds: longToNumber(seat.lockDurationSeconds),
      };
    }

    // normaliza el resultado de bloqueo convirtiendo expiresat
    export function normalizeLockResult(lockResult) {
      if (!lockResult) return null;
      return {
        ...lockResult,
        expiresAt: longToNumber(lockResult.expiresAt),
      };
    }

    // normaliza el resultado de compra convirtiendo timestamp
    export function normalizeBookingResult(result) {
      if (!result) return null;
      return {
        ...result,
        timestamp: longToNumber(result.timestamp),
      };
    }

    // normaliza el registro historico de reserva convirtiendo timestamp
    export function normalizeBookingRecord(record) {
      if (!record) return null;
      return {
        ...record,
        timestamp: longToNumber(record.timestamp),
      };
    }

    // helpers para comparar enums por referencia de objeto y no por strings
    export const isAvailable = (seat) => seat && seat.state === SeatState.AVAILABLE;
    export const isLocked = (seat) => seat && seat.state === SeatState.LOCKED;
    export const isBooked = (seat) => seat && seat.state === SeatState.BOOKED;

    // obtiene el nombre en texto del estado para clases css o etiquetas
    export function getSeatStateName(state) {
      if (state === SeatState.AVAILABLE) return 'AVAILABLE';
      if (state === SeatState.LOCKED) return 'LOCKED';
      if (state === SeatState.BOOKED) return 'BOOKED';
      return 'UNKNOWN';
    }

    // obtiene el nombre en texto de la zona para clases css o etiquetas
    export function getSeatZoneName(zone) {
      if (zone === SeatZone.ZONEVIP) return 'VIP';
      if (zone === SeatZone.ZONEPLATEA) return 'PLATEA';
      if (zone === SeatZone.ZONEGENERAL) return 'GENERAL';
      return 'UNKNOWN';
    }

    // formatea errores de slice usando instanceof y extrayendo ex.reason
    export function formatIceError(ex) {
      if (ex instanceof SeatNotAvailableException) {
        return ex.reason || 'la silla ya no esta disponible';
      }
      if (ex instanceof SeatNotFoundException) {
        return ex.reason || 'la silla no fue encontrada';
      }
      if (ex instanceof LockExpiredException) {
        return ex.reason || 'el tiempo de reserva ha expirado';
      }
      if (ex instanceof InvalidBookingException) {
        return ex.reason || 'datos de reserva no validos';
      }
      if (ex instanceof BookingException) {
        return ex.reason || 'error en la reserva';
      }
      if (ex && typeof ex.ice_name === 'function') {
        return `error de comunicacion (${ex.ice_name()})`;
      }
      return ex.message || 'error inesperado';
    }