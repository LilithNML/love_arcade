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
    'AMOR2024': 60,
    'TEAMO': 45,
    'YEKATERINA': 50,
    'LUNA100': 100,
    'BOCCHI': 1300,
    'ALBONDIGA': 400,
    'RAIDEN': 1200,
    'FIX': 100,
    'TAO250': 250,
    'UIKA250': 250,
    'SHADOW777: 777
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
