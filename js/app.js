/**
 * Game Center Core v4 - Stock, Progreso y Economía
 */

const CONFIG = {
    stateKey: 'gamecenter_v4_master',
    initialCoins: 0
};

// Estado por defecto
const defaultState = {
    coins: CONFIG.initialCoins,
    // Registro de progreso: { gameId: [levelIdsCompletados...] }
    progress: { 
        maze: [], 
        wordsearch: [],
        secretWordsFound: [] // Nuevo: Registro de palabras secretas para no pagar doble
    },
    // Inventario: { itemId: cantidadComprada }
    inventory: {},
    history: []
};

let store = { ...defaultState };

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    updateUI();
    if (window.lucide) lucide.createIcons();
});

function loadState() {
    try {
        const data = localStorage.getItem(CONFIG.stateKey);
        if (data) {
            const parsed = JSON.parse(data);
            // Fusión profunda para asegurar compatibilidad futura
            store = { 
                ...defaultState, 
                ...parsed, 
                progress: { ...defaultState.progress, ...parsed.progress },
                inventory: { ...defaultState.inventory, ...parsed.inventory }
            };
        } else {
            saveState();
        }
    } catch (e) {
        console.error("Error cargando estado. Reiniciando seguridad.", e);
        store = { ...defaultState };
    }
}

function saveState() {
    localStorage.setItem(CONFIG.stateKey, JSON.stringify(store));
    updateUI();
}

function updateUI() {
    document.querySelectorAll('.coin-display').forEach(el => {
        el.textContent = store.coins;
    });
}

// --- API PÚBLICA ---

window.GameCenter = {
    /**
     * Completa un nivel y otorga recompensa si es la primera vez.
     */
    completeLevel: (gameId, levelId, rewardAmount) => {
        if (!store.progress[gameId]) store.progress[gameId] = [];

        if (store.progress[gameId].includes(levelId)) {
            return { paid: false, coins: store.coins };
        }

        store.progress[gameId].push(levelId);
        store.coins += rewardAmount;
        saveState();
        return { paid: true, coins: store.coins };
    },

    /**
     * Reclama recompensa por palabra secreta (Solo una vez por palabra/nivel)
     */
    claimSecretWord: (uniqueWordId, rewardAmount) => {
        if (!store.progress.secretWordsFound) store.progress.secretWordsFound = [];
        
        if (store.progress.secretWordsFound.includes(uniqueWordId)) {
            return false;
        }

        store.progress.secretWordsFound.push(uniqueWordId);
        store.coins += rewardAmount;
        saveState();
        return true;
    },

    /**
     * Sistema de Compra con Stock
     */
    buyItem: (itemData) => {
        const boughtCount = store.inventory[itemData.id] || 0;
        
        // 1. Validar Stock
        if (boughtCount >= itemData.stock) {
            return { success: false, reason: 'stock' };
        }

        // 2. Validar Monedas
        if (store.coins < itemData.price) {
            return { success: false, reason: 'coins' };
        }

        // 3. Ejecutar Compra
        store.coins -= itemData.price;
        store.inventory[itemData.id] = boughtCount + 1;
        
        // Generar código de seguridad
        const securityCode = `${itemData.name.substring(0,3).toUpperCase()}-${Date.now().toString().slice(-4)}-${Math.floor(Math.random()*1000)}`;
        
        store.history.push({
            itemId: itemData.id,
            name: itemData.name,
            code: securityCode,
            date: new Date().toISOString()
        });

        saveState();
        return { success: true, code: securityCode, remaining: itemData.stock - (boughtCount + 1) };
    },

    /**
     * Obtiene cuántos items ha comprado de un tipo
     */
    getBoughtCount: (itemId) => {
        return store.inventory[itemId] || 0;
    },

    /**
     * Gasta monedas para utilidades (Pistas)
     */
    spendCoins: (amount) => {
        if (store.coins >= amount) {
            store.coins -= amount;
            saveState();
            return true;
        }
        return false;
    },

    getBalance: () => store.coins
};
    
