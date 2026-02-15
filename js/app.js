/**
 * Game Center Core v6 - Promo Codes Added
 */

const CONFIG = {
    stateKey: 'gamecenter_v6_promos', // Cambiamos versión para evitar conflictos
    initialCoins: 0
};

// --- LISTA DE CÓDIGOS SECRETOS ---
// Formato: 'CODIGO': Cantidad_Monedas
const PROMO_CODES = {
    'GOUL50': 50,
    'AMRO50': 50,
    'GOVE50': 50,
    'FU50': 50,
    'GO50': 50,
    'GOBR50': 50,
    'CH50': 50,
    'ASYA50': 50,
    'MINA50': 50,
    'SA50': 50,
    'TRFU50': 50,
    'VEZA50': 50,
    'JADO50': 50,
    'JADOUNO50': 50,
    'JADODOS50': 50,
    'JADOTRES50': 50,
    'HAMI50': 50,
    'MA50': 50,
    'XI50': 50,
    'LADEHI50': 50,
    'HIGO50': 50,
    'KAWA50': 50,
    'SACAME': 60,
    'SAMUEL1000': 1000,
    'FEB14': 500,
    'SOFYEK300': 300, 
    'ERRORRC': 200
};

const defaultState = {
    coins: CONFIG.initialCoins,
    progress: { maze: [], wordsearch: [], secretWordsFound: [] },
    inventory: {},
    redeemedCodes: [], // NUEVO: Historial de códigos usados
    history: []
};

let store = { ...defaultState };

// Cargar estado
try {
    const data = localStorage.getItem(CONFIG.stateKey);
    if (data) {
        // Fusionamos con defaultState para asegurar que 'redeemedCodes' exista
        // incluso si cargamos datos de una versión anterior
        store = { ...defaultState, ...JSON.parse(data) };
    }
} catch (e) {
    console.error("Error cargando GameCenter:", e);
    store = { ...defaultState };
}

// API PÚBLICA
window.GameCenter = {
    // ... (Tus funciones anteriores completeLevel y buyItem siguen igual) ...
    completeLevel: (gameId, levelId, rewardAmount) => {
        if (!store.progress[gameId]) store.progress[gameId] = [];
        if (store.progress[gameId].includes(levelId)) return { paid: false, coins: store.coins };
        store.progress[gameId].push(levelId);
        store.coins += rewardAmount;
        saveState();
        return { paid: true, coins: store.coins };
    },

    buyItem: (itemData) => {
        const bought = store.inventory[itemData.id] || 0;
        if (bought >= itemData.stock) return { success: false, reason: 'stock' };
        if (store.coins < itemData.price) return { success: false, reason: 'coins' };
        store.coins -= itemData.price;
        store.inventory[itemData.id] = bought + 1;
        saveState();
        return { success: true };
    },

    // --- NUEVA FUNCIÓN: CANJEAR CÓDIGO ---
    redeemPromoCode: (inputCode) => {
        // 1. Limpieza: Mayúsculas y sin espacios
        const code = inputCode.trim().toUpperCase();

        // 2. Validar si el código existe
        const reward = PROMO_CODES[code];
        if (!reward) {
            return { success: false, message: "Código inválido" };
        }

        // 3. Validar si ya se usó
        if (store.redeemedCodes.includes(code)) {
            return { success: false, message: "Ya canjeaste este código" };
        }

        // 4. Aplicar recompensa
        store.coins += reward;
        store.redeemedCodes.push(code);
        
        // Registrar en historial (Opcional, para que se vea bonito)
        store.history.push({
            itemId: 'promo_code',
            name: `Código: ${code}`,
            code: 'CANJEADO',
            date: new Date().toISOString()
        });

        saveState();
        return { success: true, reward: reward, message: `¡+${reward} Monedas!` };
    },

    getBoughtCount: (id) => store.inventory[id] || 0,
    getBalance: () => store.coins
};

function saveState() {
    localStorage.setItem(CONFIG.stateKey, JSON.stringify(store));
    updateUI();
}

function updateUI() {
    const displays = document.querySelectorAll('.coin-display');
    if (displays.length) displays.forEach(el => el.textContent = store.coins);
}

// Inicialización Visual (Igual que antes)
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    if (window.lucide) lucide.createIcons();
    // ... (resto de inits: avatar, nav, etc) ...
});
