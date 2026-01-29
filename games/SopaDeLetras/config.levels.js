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
        title: "Genshin Impact",
        gridSize: 10,
        words: ["VENTI", "ZHONGLI", "RAIDEN", "NAHIDA", "FURINA"],
        rewardCoins: 50
    },
    {
        id: "lvl_02",
        title: "Zenless Zone Zero",
        gridSize: 10,
        words: ["BILLY", "ANBY", "NICOLE", "ELLEN", "LYCAON"],
        rewardCoins: 50
    },
    {
        id: "lvl_03",
        title: "NieR Automata",
        gridSize: 10,
        words: ["YORHA", "PASCAL", "ADAM", "EMIL", "PODO"],
        rewardCoins: 50
    },
    {
        id: "lvl_04",
        title: "Dragon Ball",
        gridSize: 11,
        words: ["GOKU", "VEGETA", "GOHAN", "PICCOLO", "FREEZER", "TRUNKS"],
        rewardCoins: 60
    },
    {
        id: "lvl_05",
        title: "Five Nights Freddy",
        gridSize: 10,
        words: ["FREDDY", "BONNIE", "CHICA", "FOXY", "GOLDEN"],
        rewardCoins: 50
    },
    {
        id: "lvl_06",
        title: "Steven Universe",
        gridSize: 11,
        words: ["STEVEN", "GARNET", "PERLA", "AMATISTA", "LAPIS", "CONNIE"],
        rewardCoins: 60
    },
    {
        id: "lvl_07",
        title: "Bocchi the Rock",
        gridSize: 10,
        words: ["HITORI", "NIJIKA", "RYO", "IKUYO", "ROCK", "BANDA"],
        rewardCoins: 60
    },
    {
        id: "lvl_08",
        title: "Sonic the Hedgehog",
        gridSize: 12,
        words: ["SONIC", "TAILS", "KNUCKLES", "AMY", "EGGMAN", "SHADOW", "SILVER"],
        rewardCoins: 70
    },
    {
        id: "lvl_09",
        title: "Angry Birds",
        gridSize: 10,
        words: ["RED", "CHUCK", "BOMB", "STELLA", "CERDO", "HUEVO"],
        rewardCoins: 60
    },
    {
        id: "lvl_10",
        title: "Filosofía",
        gridSize: 11,
        words: ["PLATON", "SENECA", "KANT", "HEGEL", "LOGICA", "ETICA", "DUDA"],
        rewardCoins: 70
    },
    {
        id: "lvl_11",
        title: "Mitología Griega",
        gridSize: 12,
        words: ["ZEUS", "HERA", "APOLO", "ATENEA", "HERMES", "HADES", "ARES", "CRONOS"],
        rewardCoins: 80
    },
    {
        id: "lvl_12",
        title: "Arte Moderno",
        gridSize: 10,
        words: ["DALÍ", "PICASSO", "MUSEO", "LIENZO", "PINCEL", "OLEO"],
        rewardCoins: 60
    },
    {
        id: "lvl_13",
        title: "Naturaleza",
        gridSize: 11,
        words: ["BOSQUE", "SELVA", "DESIERTO", "PRADO", "VALLE", "COSTA"],
        rewardCoins: 60
    },
    {
        id: "lvl_14",
        title: "Animales Marinos",
        gridSize: 10,
        words: ["BALLENA", "DELFIN", "TIBURON", "PULPO", "RAYA", "MEDUSA", "CORAL", "PEZ"],
        rewardCoins: 80
    },
    {
        id: "lvl_15",
        title: "Colores Vivos",
        gridSize: 10,
        words: ["VIOLETA", "CARMESI", "DORADO", "PLATA", "BRONCE", "TURQUESA", "VERDE"],
        rewardCoins: 70
    },
    {
        id: "lvl_16",
        title: "Programación",
        gridSize: 12,
        words: ["PYTHON", "SCRIPT", "VARIABLE", "BUCLE", "DATOS", "CODIGO", "DEBUG", "CLASE", "ARRAY", "STRING"],
        rewardCoins: 100
    },
    {
        id: "lvl_17",
        title: "Star Wars",
        gridSize: 12,
        words: ["VADER", "YODA", "SKYWALKER", "LEIA", "KENOBI", "ANDOR", "AHSOKA", "SOLO"],
        rewardCoins: 80
    },
    {
        id: "lvl_18",
        title: "Postres Ricos",
        gridSize: 10,
        words: ["PASTEL", "HELADO", "FLAN", "DONA", "CHURRO", "MOUSSE", "CANELA"],
        rewardCoins: 70
    },
    {
        id: "lvl_19",
        title: "Cine Clásico",
        gridSize: 11,
        words: ["ACTOR", "GUION", "CAMARA", "ESCENA", "PREMIO", "BUTACA", "RODAJE"],
        rewardCoins: 70
    },
    {
        id: "lvl_20",
        title: "Harry Potter",
        gridSize: 12,
        words: ["HARRY", "RON", "HERMIONE", "SNAPE", "ALBUS", "DOBBY", "DRACO", "LUNA", "MAGIA"],
        rewardCoins: 90
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
