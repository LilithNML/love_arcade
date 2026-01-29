/**
 * WORD HUNT - Configuración de Niveles
 * LoveArcade Integration
 * 
 * Cada nivel incluye:
 * - id: Identificador único
 * - title: Nombre descriptivo
 * - gridSize: Tamaño de la cuadrícula (mínimo 10x10)
 * - words: Array de palabras a encontrar
 * - rewardCoins: Monedas otorgadas al completar
 */

window.LA_WS_LEVELS = [
    {
        id: "lvl_01",
        title: "Inicio Fácil",
        gridSize: 10,
        words: ["SOL", "LUNA", "MAR", "CIELO"],
        rewardCoins: 50
    },
    {
        id: "lvl_02",
        title: "Animales",
        gridSize: 10,
        words: ["GATO", "PERRO", "PAJARO", "PEZ", "LEON"],
        rewardCoins: 60
    },
    {
        id: "lvl_03",
        title: "Colores",
        gridSize: 12,
        words: ["ROJO", "AZUL", "VERDE", "AMARILLO", "NEGRO"],
        rewardCoins: 70
    },
    {
        id: "lvl_04",
        title: "Frutas",
        gridSize: 12,
        words: ["MANZANA", "PLATANO", "UVA", "PERA", "NARANJA"],
        rewardCoins: 80
    },
    {
        id: "lvl_05",
        title: "Naturaleza",
        gridSize: 13,
        words: ["ARBOL", "FLOR", "MONTANA", "RIO", "BOSQUE", "PLAYA"],
        rewardCoins: 90
    },
    {
        id: "lvl_06",
        title: "Tecnología",
        gridSize: 13,
        words: ["COMPUTADORA", "TELEFONO", "INTERNET", "CODIGO", "ROBOT"],
        rewardCoins: 100
    },
    {
        id: "lvl_07",
        title: "Deportes",
        gridSize: 14,
        words: ["FUTBOL", "BASKETBALL", "TENIS", "NATACION", "VOLEIBOL"],
        rewardCoins: 110
    },
    {
        id: "lvl_08",
        title: "Música",
        gridSize: 14,
        words: ["GUITARRA", "PIANO", "BATERIA", "VIOLIN", "TROMPETA", "MUSICA"],
        rewardCoins: 120
    },
    {
        id: "lvl_09",
        title: "Países",
        gridSize: 15,
        words: ["MEXICO", "BRASIL", "JAPON", "FRANCIA", "ITALIA", "CANADA"],
        rewardCoins: 130
    },
    {
        id: "lvl_10",
        title: "Profesiones",
        gridSize: 15,
        words: ["MEDICO", "INGENIERO", "MAESTRO", "ARTISTA", "CHEF", "PILOTO"],
        rewardCoins: 140
    },
    {
        id: "lvl_11",
        title: "Espacio",
        gridSize: 16,
        words: ["ESTRELLA", "PLANETA", "GALAXIA", "COMETA", "ASTRONAUTA", "UNIVERSO"],
        rewardCoins: 150
    },
    {
        id: "lvl_12",
        title: "Comida",
        gridSize: 16,
        words: ["PIZZA", "HAMBURGUESA", "TACO", "SUSHI", "PASTA", "ENSALADA"],
        rewardCoins: 160
    },
    {
        id: "lvl_13",
        title: "Emociones",
        gridSize: 17,
        words: ["FELICIDAD", "TRISTEZA", "AMOR", "MIEDO", "ALEGRIA", "SORPRESA"],
        rewardCoins: 170
    },
    {
        id: "lvl_14",
        title: "Clima",
        gridSize: 17,
        words: ["LLUVIA", "NIEVE", "TORNADO", "HURACAN", "TORMENTA", "VIENTO"],
        rewardCoins: 180
    },
    {
        id: "lvl_15",
        title: "Transporte",
        gridSize: 18,
        words: ["AUTO", "AVION", "BARCO", "TREN", "BICICLETA", "HELICOPTERO", "METRO"],
        rewardCoins: 190
    },
    {
        id: "lvl_16",
        title: "Cuerpo Humano",
        gridSize: 18,
        words: ["CORAZON", "CEREBRO", "PULMON", "HIGADO", "ESTOMAGO", "RIÑON"],
        rewardCoins: 200
    },
    {
        id: "lvl_17",
        title: "Historia",
        gridSize: 19,
        words: ["IMPERIO", "REVOLUCION", "CONQUISTA", "CIVILIZACION", "GUERRA"],
        rewardCoins: 210
    },
    {
        id: "lvl_18",
        title: "Arte",
        gridSize: 19,
        words: ["PINTURA", "ESCULTURA", "FOTOGRAFIA", "DANZA", "TEATRO", "CINE"],
        rewardCoins: 220
    },
    {
        id: "lvl_19",
        title: "Ciencia",
        gridSize: 20,
        words: ["QUIMICA", "FISICA", "BIOLOGIA", "MATEMATICAS", "ASTRONOMIA"],
        rewardCoins: 230
    },
    {
        id: "lvl_20",
        title: "Literatura",
        gridSize: 20,
        words: ["NOVELA", "POESIA", "CUENTO", "ENSAYO", "LIBRO", "ESCRITOR"],
        rewardCoins: 240
    },
    {
        id: "lvl_21",
        title: "Mitos y Leyendas",
        gridSize: 21,
        words: ["DRAGON", "UNICORNIO", "FENIX", "MINOTAURO", "SIRENA", "CENTAURO"],
        rewardCoins: 250
    },
    {
        id: "lvl_22",
        title: "Instrumentos",
        gridSize: 21,
        words: ["FLAUTA", "SAXOFON", "ARPA", "ACORDEON", "TAMBOR", "CLARINETE"],
        rewardCoins: 260
    },
    {
        id: "lvl_23",
        title: "Arquitectura",
        gridSize: 22,
        words: ["CASTILLO", "CATEDRAL", "PIRAMIDE", "PUENTE", "TORRE", "PALACIO"],
        rewardCoins: 270
    },
    {
        id: "lvl_24",
        title: "Elementos",
        gridSize: 22,
        words: ["FUEGO", "AGUA", "TIERRA", "AIRE", "METAL", "MADERA"],
        rewardCoins: 280
    },
    {
        id: "lvl_25",
        title: "Desafío Final",
        gridSize: 25,
        words: ["AVENTURA", "MISTERIO", "VICTORIA", "CHAMPION", "LEYENDA", "EPICO", "SUPREMO"],
        rewardCoins: 500
    }
];

// Validación de niveles al cargar
(function validateLevels() {
    const seenIds = new Set();
    
    window.LA_WS_LEVELS.forEach((level, index) => {
        // Validar ID único
        if (seenIds.has(level.id)) {
            console.error(`[WordSearch] Error: ID duplicado "${level.id}" en nivel ${index + 1}`);
        }
        seenIds.add(level.id);

        // Validar gridSize mínimo
        if (level.gridSize < 10) {
            console.error(`[WordSearch] Error: gridSize debe ser >= 10 en nivel "${level.id}"`);
        }

        // Validar rewardCoins
        if (!Number.isInteger(level.rewardCoins) || level.rewardCoins <= 0) {
            console.error(`[WordSearch] Error: rewardCoins debe ser entero positivo en nivel "${level.id}"`);
        }

        // Validar palabras
        if (!Array.isArray(level.words) || level.words.length === 0) {
            console.error(`[WordSearch] Error: words debe ser array no vacío en nivel "${level.id}"`);
        }
    });

    console.log(`[WordSearch] ✓ ${window.LA_WS_LEVELS.length} niveles cargados correctamente`);
})();
