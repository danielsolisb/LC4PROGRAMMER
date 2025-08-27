// web/js/constants.js

export const LIGHT_MAP = {
    // Puerto D
    'R1': { port: 'portD', bit: 7 }, 'A1': { port: 'portD', bit: 6 }, 'V1': { port: 'portD', bit: 5 },
    'R2': { port: 'portD', bit: 4 }, 'A2': { port: 'portD', bit: 3 }, 'V2': { port: 'portD', bit: 2 },
    'R3': { port: 'portD', bit: 1 }, 'A3': { port: 'portD', bit: 0 },
    // Puerto E
    'V3': { port: 'portE', bit: 7 }, 'R4': { port: 'portE', bit: 6 }, 'A4': { port: 'portE', bit: 5 },
    'V4': { port: 'portE', bit: 4 }, 'R5': { port: 'portE', bit: 3 }, 'A5': { port: 'portE', bit: 2 },
    'V5': { port: 'portE', bit: 1 }, 'R6': { port: 'portE', bit: 0 },
    // Puerto F
    'A6': { port: 'portF', bit: 7 }, 'V6': { port: 'portF', bit: 6 }, 'R7': { port: 'portF', bit: 5 },
    'A7': { port: 'portF', bit: 4 }, 'V7': { port: 'portF', bit: 3 }, 'R8': { port: 'portF', bit: 2 },
    'A8': { port: 'portF', bit: 1 }, 'V8': { port: 'portF', bit: 0 },
};

export const LIGHT_ORDER = [
    'R1','A1','V1','R2','A2','V2','R3','A3','V3','R4','A4','V4',
    'R5','A5','V5','R6','A6','V6','R7','A7','V7','R8','A8','V8'
];

export const DAY_TYPE_MAP = {
    0: [0], 1: [1], 2: [2], 3: [3], 4: [4], 5: [5], 6: [6],
    7: [1, 2, 3, 4, 5, 6, 0], 8: [1, 2, 3, 4, 5, 6], 9: [6, 0],
    10: [1, 2, 3, 4, 5], 11: [5, 6, 0], 12: [1, 2, 3, 4],
    13: [5, 6], 14: [7]
};

export const PLAN_COLORS = [
    '#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
];

// =======================================================
// --- NUEVO: Constantes para la Programación de Planes ---
// =======================================================

export const DAY_TYPE_LEGEND = {
    0: 'Domingo',
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
    7: 'Todos los días',
    8: 'Todos los días menos Domingos',
    9: 'Sábado y Domingo',
    10: 'Todos excepto Sábado y Domingo',
    11: 'Viernes, Sábado y Domingo',
    12: 'Todos menos Vie, Sáb, Dom',
    13: 'Viernes y Sábado',
    14: 'Feriados'
};