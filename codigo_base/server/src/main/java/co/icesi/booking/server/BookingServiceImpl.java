package co.icesi.booking.server;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import com.zeroc.Ice.Current;

import BookingApp.BookingException;
import BookingApp.BookingRecord;
import BookingApp.BookingResult;
import BookingApp.BookingService;
import BookingApp.EventInfo;
import BookingApp.InvalidBookingException;
import BookingApp.LockExpiredException;
import BookingApp.LockResult;
import BookingApp.Seat;
import BookingApp.SeatNotAvailableException;
import BookingApp.SeatNotFoundException;
import BookingApp.SeatState;
import BookingApp.SeatZone;

public class BookingServiceImpl implements BookingService {

    public static final long DEFAULT_LOCK_DURATION_SECONDS = 90;

    private final EventInfo eventInfo;
    private final Map<String, Seat> seatsMap = new HashMap<>();
    private final ReentrantLock lock = new ReentrantLock();
    private final List<BookingRecord> bookingsList = new ArrayList<>();

    //en caso de encontrar x silla vencida, la cambia inmediatemente a AVAILABLE
    //ahora tenemos la expiracion "activa"
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "seat-expiration-cleaner");
        t.setDaemon(true);
        return t;
    });

    public BookingServiceImpl() {
        this.eventInfo = new EventInfo(
                "EVT-2026-LIVE",
                "Concierto Icesi Live Rock & Pop 2026",
                "2026-11-28 20:00",
                "Auditorio Manuelita - Universidad Icesi",
                90, 90, 0, 0,
                120000.0, 75000.0, 45000.0
        );
        initSeats();
        //expiracion automatica cada 1seg
        scheduler.scheduleAtFixedRate(this::cleanExpiredLocks, 1, 1, TimeUnit.SECONDS);
    }
   
    //recorre las sillas bajo el candado
    private void cleanExpiredLocks() {
            lock.lock();
            try {
                for (Seat seat : seatsMap.values()) {
                    if (seat.state == SeatState.LOCKED && isLockExpired(seat)) {
                        System.out.printf("[AUTO-EXPIRE] Bloqueo de silla %s expiró. Liberada
                        automáticamente.%n", seat.id);
                        seat.state = SeatState.AVAILABLE;
                        seat.lockedByClientId = "";
                        seat.lockTimestamp = 0L;
                    }
                }
            } finally {
                lock.unlock();
            }
        }


    private void initSeats() {
        seatsMap.clear();
        bookingsList.clear();

        createSeatsForZone("A", 1, 10, SeatZone.ZONEVIP, 120000.0);
        createSeatsForZone("B", 1, 10, SeatZone.ZONEVIP, 120000.0);

        createSeatsForZone("C", 1, 10, SeatZone.ZONEPLATEA, 75000.0);
        createSeatsForZone("D", 1, 10, SeatZone.ZONEPLATEA, 75000.0);
        createSeatsForZone("E", 1, 10, SeatZone.ZONEPLATEA, 75000.0);

        createSeatsForZone("F", 1, 10, SeatZone.ZONEGENERAL, 45000.0);
        createSeatsForZone("G", 1, 10, SeatZone.ZONEGENERAL, 45000.0);
        createSeatsForZone("H", 1, 10, SeatZone.ZONEGENERAL, 45000.0);
        createSeatsForZone("I", 1, 10, SeatZone.ZONEGENERAL, 45000.0);

        updateEventCounters();
        System.out.printf("[INFO] Inventario inicializado con %d sillas en 3 zonas (VIP, Platea, General).%n", seatsMap.size());
    }

    private void createSeatsForZone(String row, int startNum, int endNum, SeatZone zone, double price) {
        for (int num = startNum; num <= endNum; num++) {
            String seatId = String.format("%s-%d", row, num);
            Seat seat = new Seat(
                    seatId,
                    zone,
                    row,
                    num,
                    price,
                    SeatState.AVAILABLE,
                    "",
                    0L,
                    DEFAULT_LOCK_DURATION_SECONDS
            );
            seatsMap.put(seatId, seat);
        }
    }

    //antes se dividia(al hacer eso el resultado descartaba los decimales y redondeaba hacia abajo)
   //la silla no se expiraba a los 90seg sino a los 91seg
   //convertimos los 90seg a milisegundos y usamos >= 
  segundos a milisegundos (90 * 1000 = 90.000 ms).
    private boolean isLockExpired(Seat seat) {
        if (seat.state != SeatState.LOCKED) return false;
        long now = System.currentTimeMillis();
        return (now - seat.lockTimestamp) >= (seat.lockDurationSeconds * 1000L);
    }

    private void updateEventCounters() {
        int avail = 0;
        int locked = 0;
        int booked = 0;
        for (Seat s : seatsMap.values()) {
            if (s.state == SeatState.BOOKED) {
                booked++;
            } else if (s.state == SeatState.LOCKED && !isLockExpired(s)) {
                locked++;
            } else {
                avail++;
            }
        }
        eventInfo.totalSeats = seatsMap.size();
        eventInfo.availableSeats = avail;
        eventInfo.lockedSeats = locked;
        eventInfo.bookedSeats = booked;
    }
//aqui lo q se hace es: calcular contadores y retornar nuevo objeto bajo el candado
    @Override
     public EventInfo getEventInfo(Current current) {
        lock.lock();
        try {
            int avail = 0;
            int locked = 0;
            int booked = 0;
            for (Seat s : seatsMap.values()) {
                if (s.state == SeatState.BOOKED) {
                    booked++;
                } else if (s.state == SeatState.LOCKED && !isLockExpired(s)) {
                    locked++;
                } else {
                    avail++;
                }
            }
            return new EventInfo(
                    eventInfo.id,
                    eventInfo.name,
                    eventInfo.date,
                    eventInfo.venue,
                    seatsMap.size(),
                    avail,
                    locked,
                    booked,
                    eventInfo.vipPrice,
                    eventInfo.plateaPrice,
                    eventInfo.generalPrice
            );
        } finally {
            lock.unlock();
        }
    }

    //se itera bajo el candado y se agrega copia (s.clone() )
    @Override
    public Seat[] getAllSeats(Current current) {
        lock.lock();
        try {
            List<Seat> list = new ArrayList<>();
            for (Seat s : seatsMap.values()) {
                list.add(s.clone());
            }
            list.sort(Comparator.comparing((Seat s) -> s.row).thenComparingInt(s -> s.number));
            return list.toArray(new Seat[0]);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public Seat[] getSeatsByZone(SeatZone zone, Current current) {
        lock.lock();
        try {
            List<Seat> list = new ArrayList<>();
            for (Seat s : seatsMap.values()) {
                if (s.zone == zone) {
                    list.add(s.clone());
                }
            }
            list.sort(Comparator.comparing((Seat s) -> s.row).thenComparingInt(s -> s.number));
            return list.toArray(new Seat[0]);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public Seat getSeat(String seatId, Current current) throws SeatNotFoundException {
        lock.lock();
        try {
            Seat seat = seatsMap.get(seatId);
            if (seat == null) {
                throw new SeatNotFoundException("Silla no encontrada en inventario: " + seatId);
            }
            return seat.clone();
        } finally {
            lock.unlock();
        }

    @Override
    public LockResult lockSeat(String seatId, String clientId, Current current)
            throws SeatNotFoundException, SeatNotAvailableException {
        lock.lock();
        try {                              
            Seat seat = seatsMap.get(seatId);
            if (seat == null) {
                throw new SeatNotFoundException("Silla no encontrada: " + seatId);
            }

            // Si estaba bloqueada pero expiró el tiempo de retención, liberarla
            if (seat.state == SeatState.LOCKED && isLockExpired(seat)) {
                System.out.printf("[LOCK-EXPIRED] El bloqueo de la silla %s expiró. Liberando.%n", seatId);
                seat.state = SeatState.AVAILABLE;
                seat.lockedByClientId = "";
            }

            // Validación de disponibilidad
            if (seat.state != SeatState.AVAILABLE) {
                if (seat.state == SeatState.LOCKED && clientId.equals(seat.lockedByClientId)) {
                    // El mismo cliente renueva el bloqueo
                    seat.lockTimestamp = System.currentTimeMillis();
                    long expiresAt = seat.lockTimestamp + (seat.lockDurationSeconds * 1000L);
                    return new LockResult(true, seatId, "Bloqueo renovado con éxito.", expiresAt);
                }
                throw new SeatNotAvailableException(String.format("La silla %s ya no se encuentra disponible (Estado: %s).", seatId, seat.state));
            }

            // Simulación de latencia de red / I/O en base de datos (No remover)
            try {
                Thread.sleep(25);
            } catch (InterruptedException ignored) {
            }

            seat.state = SeatState.LOCKED;
            seat.lockedByClientId = clientId;
            seat.lockTimestamp = System.currentTimeMillis();
            seat.lockDurationSeconds = DEFAULT_LOCK_DURATION_SECONDS;

            long expiresAt = seat.lockTimestamp + (DEFAULT_LOCK_DURATION_SECONDS * 1000L);
            System.out.printf("[LOCK-OK] Silla %s bloqueada exitosamente para cliente: %s (expira en %ds)%n",
                    seatId, clientId, DEFAULT_LOCK_DURATION_SECONDS);

            return new LockResult(true, seatId, "Silla bloqueada exitosamente.", expiresAt);

        } finally {                        
            lock.unlock();
        }
    }
    

//toma el candado
    @Override
    public boolean releaseSeat(String seatId, String clientId, Current current) throws
    SeatNotFoundException {
        lock.lock();
        try {
            Seat seat = seatsMap.get(seatId);
            if (seat == null) {
                throw new SeatNotFoundException("Silla no encontrada: " + seatId);
            }

            // Solo puede liberar el cliente que la bloqueó o si ya expiró
            if (seat.state == SeatState.LOCKED) {
                if (clientId.equals(seat.lockedByClientId) || isLockExpired(seat)) {
                    seat.state = SeatState.AVAILABLE;
                    seat.lockedByClientId = "";
                    seat.lockTimestamp = 0L;
                    System.out.printf("[RELEASE-OK] Silla %s liberada por cliente: %s%n", seatId,
                    clientId);
                    return true;
                }
            }
            return false;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public BookingResult confirmBooking(String[] seatIds, String clientId, String customerName, String customerEmail, Current current)
            throws InvalidBookingException, BookingException {

        if (seatIds == null || seatIds.length == 0) {
            throw new InvalidBookingException("Debe seleccionar al menos una silla para completar la reserva.");
        }
        //el id el usuario nunca lo escribe (esto es lo q genera el cliente y lo manda en cada llamada)
        if (clientId == null || clientId.trim().isEmpty()) {
        throw new InvalidBookingException("El identificador de cliente es obligatorio.");
        }
        if (customerName == null || customerName.trim().isEmpty()) {
            throw new InvalidBookingException("El nombre del comprador es obligatorio.");
        }
        if (customerEmail == null || !customerEmail.contains("@")) {
            throw new InvalidBookingException("El correo electrónico del comprador es inválido.");
        }

        // quitar duplicados conservando el orden
        String[] uniqueIds = new LinkedHashSet<>(Arrays.asList(seatIds)).toArray(new String[0]);

        lock.lock();
        try{
            double totalAmount = 0.0;
            List<Seat> validatedSeats = new ArrayList<>();

            // Paso 1: Validación preliminar de las sillas
            for (String seatId : seatIds) {
                Seat seat = seatsMap.get(seatId);
                if (seat == null) {
                    throw new SeatNotFoundException("Silla no existe: " + seatId);
                }
                if (seat.state == SeatState.BOOKED) {
                    throw new BookingException("La silla " + seatId + " ya fue vendida definitivamente.");
                }
                if (seat.state == SeatState.LOCKED) {
                    if (isLockExpired(seat)) {
                        throw new LockExpiredException("El bloqueo temporal de la silla " + seatId + " ha expirado.");
                    }
                    if (!clientId.equals(seat.lockedByClientId)) {
                        throw new BookingException("La silla " + seatId + " se encuentra bloqueada por otro comprador.");
                    }
                }
                totalAmount += seat.price;
                validatedSeats.add(seat);
            }
                 // Paso 2: Confirmación y cambio a BOOKED 
            for (Seat s : validatedSeats) {
                s.state = SeatState.BOOKED;
                s.lockedByClientId = clientId;
                s.lockTimestamp = 0L;
            }

            String bookingCode = "RES-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            long now = System.currentTimeMillis();

            BookingRecord record = new BookingRecord(
                    bookingCode,
                    eventInfo.id,
                    clientId,
                    customerName.trim(),
                    customerEmail.trim(),
                    uniqueIds,
                    totalAmount,
                    now
            );
            bookingsList.add(record);

            System.out.printf("[BOOKING-CONFIRMED] Código: %s | Cliente: %s (%s) | %d sillas | Total: $%,.0f COP%n",
                    bookingCode, customerName, clientId, uniqueIds.length, totalAmount);

            return new BookingResult(
                    true,
                    bookingCode,
                    "Reserva confirmada con éxito. Disfrute del evento.",
                    uniqueIds,
                    totalAmount,
                    now
            );
    }      
  }
 
    @Override
    public Seat[] getMyLockedSeats(String clientId, Current current) {
        lock.lock();
        try {
            List<Seat> list = new ArrayList<>();
            if (clientId != null && !clientId.isEmpty()) {
                for (Seat s : seatsMap.values()) {
                    if (s.state == SeatState.LOCKED && clientId.equals(s.lockedByClientId) &&
                    !isLockExpired(s)) {
                        list.add(s.clone());
                    }
                }
            }
            return list.toArray(new Seat[0]);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public BookingRecord[] getMyBookings(String clientId, Current current) {
        lock.lock();
        try {
            List<BookingRecord> list = new ArrayList<>();
            if (clientId != null && !clientId.isEmpty()) {
                for (BookingRecord b : bookingsList) {
                    if (clientId.equals(b.clientId)) {
                        list.add(b.clone());
                    }
                }
            }
            return list.toArray(new BookingRecord[0]);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void resetSeats(Current current) {
        lock.lock();
        try {
            initSeats();
            System.out.println("[RESET] Inventario y reservas reiniciadas a estado de fábrica.");
        } finally {
            lock.unlock();
        }

     //para detener el limpiador automatico de sillas de forma ordenada, asegurando que termine de liberar la silla actual
     // y suelte el candado antes de que el servidor se apague por completo
 
    public void shutdown() {
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(2, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("[INFO] Limpiador de bloqueos expirados detenido correctamente.");
    }

    @Override
    public void close() {
        shutdown();
    }

    }