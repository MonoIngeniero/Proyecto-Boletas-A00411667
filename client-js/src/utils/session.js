    const CLIENT_ID_KEY = 'icesi_booking_client_id';

    // obtiene el id del cliente o genera uno nuevo con uuid v4
    // se guarda en sessionstorage para mantenerse en la pestana actual
    export function getClientId() {
      let clientId = sessionStorage.getItem(CLIENT_ID_KEY);

      if (!clientId) {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          clientId = crypto.randomUUID();
        } else {
          clientId = 'client-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        }
        sessionStorage.setItem(CLIENT_ID_KEY, clientId);
        console.log(`[session] nuevo client id generado: ${clientId}`);
      } else {
        console.log(`[session] client id recuperado de sessionstorage: ${clientId}`);
      }

      return clientId;
    }

    // reinicia el id de cliente de la sesion actual si es necesario
    export function resetClientId() {
      sessionStorage.removeItem(CLIENT_ID_KEY);
      return getClientId();
    }