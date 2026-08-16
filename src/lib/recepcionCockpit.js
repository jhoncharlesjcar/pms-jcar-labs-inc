const OPERATIONAL_PRIORITY = {
    departure_overdue: 0,
    arrival_overdue: 1,
    departure_today: 2,
    arrival_today: 3,
    in_house: 4,
    future_arrival: 5,
    history: 6,
};

export const OPERATIONAL_STATE_CONFIG = {
    departure_overdue: { label: 'Salida vencida', tone: 'destructive' },
    arrival_overdue: { label: 'Llegada vencida', tone: 'destructive' },
    departure_today: { label: 'Sale hoy', tone: 'warning' },
    arrival_today: { label: 'Llega hoy', tone: 'info' },
    in_house: { label: 'En estancia', tone: 'success' },
    future_arrival: { label: 'Próxima llegada', tone: 'neutral' },
    history: { label: 'Historial', tone: 'neutral' },
};

function toLocalDay(value) {
    if (!value) return null;
    if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    const dateOnly = String(value).slice(0, 10);
    const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}
function compareDays(value, today) {
    const day = toLocalDay(value);
    const currentDay = toLocalDay(today);
    if (!day || !currentDay) return null;
    return Math.sign(day.getTime() - currentDay.getTime());
}

export function getReservationOperationalState(reserva, today = new Date()) {
    if (reserva?.estado === 'pendiente') {
        const arrivalComparison = compareDays(reserva.fecha_entrada, today);
        if (arrivalComparison !== null && arrivalComparison < 0) return 'arrival_overdue';
        if (arrivalComparison === 0) return 'arrival_today';
        return 'future_arrival';
    }

    if (reserva?.estado === 'activa') {
        const departureComparison = compareDays(reserva.fecha_salida, today);
        if (departureComparison !== null && departureComparison < 0) return 'departure_overdue';
        if (departureComparison === 0) return 'departure_today';
        return 'in_house';
    }

    return 'history';
}

export function isAttentionReservation(reserva, today = new Date()) {
    return ['departure_overdue', 'arrival_overdue', 'departure_today', 'arrival_today']
        .includes(getReservationOperationalState(reserva, today));
}

export function matchesReceptionFilter(reserva, filter, today = new Date()) {
    switch (filter) {
        case 'atencion':
            return isAttentionReservation(reserva, today);
        case 'activa':
            return reserva.estado === 'activa';
        case 'pendiente':
            return reserva.estado === 'pendiente';
        case 'historial':
            return reserva.estado === 'finalizada' || reserva.estado === 'cancelada';
        case 'todas':
        default:
            return true;
    }
}

export function sortReservationsByOperationalPriority(reservas, today = new Date()) {
    return [...reservas].sort((a, b) => {
        const priorityDiff = OPERATIONAL_PRIORITY[getReservationOperationalState(a, today)]
            - OPERATIONAL_PRIORITY[getReservationOperationalState(b, today)];
        if (priorityDiff !== 0) return priorityDiff;

        const dateA = toLocalDay(a.fecha_salida || a.fecha_entrada)?.getTime() || 0;
        const dateB = toLocalDay(b.fecha_salida || b.fecha_entrada)?.getTime() || 0;
        return dateA - dateB;
    });
}

export function buildReceptionSummary(reservas = [], habitaciones = [], today = new Date()) {
    const attention = reservas.filter(reserva => isAttentionReservation(reserva, today)).length;
    const active = reservas.filter(reserva => reserva.estado === 'activa').length;
    const pending = reservas.filter(reserva => reserva.estado === 'pendiente').length;
    const history = reservas.filter(reserva => ['finalizada', 'cancelada'].includes(reserva.estado)).length;
    const arrivalsToday = reservas.filter(reserva => getReservationOperationalState(reserva, today) === 'arrival_today').length;
    const departuresToday = reservas.filter(reserva => getReservationOperationalState(reserva, today) === 'departure_today').length;
    const availableRooms = habitaciones.filter(habitacion => habitacion.estado === 'disponible').length;
    const cleaningRooms = habitaciones.filter(habitacion => habitacion.estado === 'limpieza').length;

    return {
        attention,
        active,
        pending,
        history,
        total: reservas.length,
        arrivalsToday,
        departuresToday,
        availableRooms,
        cleaningRooms,
        totalRooms: habitaciones.length,
    };
}
