/**
 * Game Center Core v4 - Fixed
 */

const CONFIG = {
    stateKey: 'gamecenter_v4_master',
    initialCoins: 0
};

// Estado por defecto
const defaultState = {
    coins: CONFIG.initialCoins,
    progress: { 
        maze: [], 
        wordsearch: [],
        secretWordsFound: [] 
    },
    inventory: {},
    history: []
};

let store = { ...defaultState };

// Cargar estado inmediatamente para que esté disponible lo antes posible
loadState();

document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    updateActiveNav(); // Iniciar navegación activa
    if (window.lucide) lucide.createIcons();
});

function loadState() {
    try {
        const data = localStorage.getItem(CONFIG.stateKey);
        if (data) {
            const parsed = JSON.parse(data);
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
        console.error("Error cargando estado:", e);
        store = { ...defaultState };
    }
}

function saveState() {
    localStorage.setItem(CONFIG.stateKey, JSON.stringify(store));
    updateUI();
}

function updateUI() {
    // Actualiza todos los contadores de monedas en la pantalla
    const displays = document.querySelectorAll('.coin-display');
    if (displays.length > 0) {
        displays.forEach(el => el.textContent = store.coins);
    }
}

// --- API PÚBLICA (Se define inmediatamente) ---

window.GameCenter = {
    completeLevel: (gameId, levelId, rewardAmount) => {
        if (!store.progress[gameId]) store.progress[gameId] = [];

        // Verificar si ya se pagó este ID específico
        if (store.progress[gameId].includes(levelId)) {
            console.log(`[GameCenter] ${levelId} ya fue pagado anteriormente.`);
            return { paid: false, coins: store.coins };
        }

        store.progress[gameId].push(levelId);
        store.coins += rewardAmount;
        saveState();
        console.log(`[GameCenter] Pago exitoso: +${rewardAmount} monedas.`);
        return { paid: true, coins: store.coins };
    },

    buyItem: (itemData) => {
        const boughtCount = store.inventory[itemData.id] || 0;
        if (boughtCount >= itemData.stock) return { success: false, reason: 'stock' };
        if (store.coins < itemData.price) return { success: false, reason: 'coins' };

        store.coins -= itemData.price;
        store.inventory[itemData.id] = boughtCount + 1;
        
        const securityCode = `${itemData.name.substring(0,3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        
        store.history.push({
            itemId: itemData.id,
            name: itemData.name,
            code: securityCode,
            date: new Date().toISOString()
        });

        saveState();
        return { success: true, code: securityCode, remaining: itemData.stock - (boughtCount + 1) };
    },

    getBoughtCount: (itemId) => store.inventory[itemId] || 0,
    addCoins: (amount) => { store.coins += amount; saveState(); }, // Método helper extra
    getBalance: () => store.coins
};

// --- LOGICA DE AVATAR ---
document.addEventListener('DOMContentLoaded', () => {
    const avatarInput = document.getElementById('avatar-upload');
    const avatarDisplay = document.getElementById('user-avatar-display');
    const storedAvatar = localStorage.getItem('user_avatar_image');

    if (storedAvatar && avatarDisplay) {
        avatarDisplay.style.backgroundImage = `url('${storedAvatar}')`;
        avatarDisplay.innerHTML = '';
    }

    if (avatarInput) {
        avatarInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        localStorage.setItem('user_avatar_image', event.target.result);
                        if (avatarDisplay) {
                            avatarDisplay.style.backgroundImage = `url('${event.target.result}')`;
                            avatarDisplay.innerHTML = '';
                        }
                    } catch (err) {
                        alert("Imagen demasiado grande.");
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

// --- SISTEMA DE NAVEGACIÓN ---
function updateActiveNav() {
    const path = window.location.pathname;
    const hash = window.location.hash;
    const allLinks = document.querySelectorAll('.nav-link, .b-nav-item');
    
    if(!allLinks.length) return;

    allLinks.forEach(link => link.classList.remove('active'));
    let target = 'home';

    if (path.includes('shop.html')) target = 'shop';
    else if (hash === '#games') target = 'games';
    else if (hash === '#faq') target = 'faq';

    allLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        if (target === 'shop' && href.includes('shop.html')) link.classList.add('active');
        else if (target === 'games' && href.includes('#games')) link.classList.add('active');
        else if (target === 'faq' && href.includes('#faq')) link.classList.add('active');
        else if (target === 'home' && (href === '#' || href === 'index.html')) link.classList.add('active');
    });
}
window.addEventListener('hashchange', updateActiveNav);
