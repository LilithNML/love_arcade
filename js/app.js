/**
 * Game Center Core v5 - Architecture Fixed
 */

// --- 1. CONFIGURACIÓN Y ESTADO (Inmediato) ---
const CONFIG = {
    stateKey: 'gamecenter_v4_master',
    initialCoins: 0
};

const defaultState = {
    coins: CONFIG.initialCoins,
    progress: { maze: [], wordsearch: [], secretWordsFound: [] },
    inventory: {},
    history: []
};

let store = { ...defaultState };

// Cargar datos inmediatamente (sin esperar al DOM)
try {
    const data = localStorage.getItem(CONFIG.stateKey);
    if (data) {
        const parsed = JSON.parse(data);
        store = { ...defaultState, ...parsed, progress: { ...defaultState.progress, ...parsed.progress } };
    }
} catch (e) {
    console.error("Error cargando estado:", e);
}

// --- 2. API PÚBLICA (Disponible Inmediatamente para los juegos) ---
window.GameCenter = {
    completeLevel: (gameId, levelId, rewardAmount) => {
        if (!store.progress[gameId]) store.progress[gameId] = [];
        
        // Evitar duplicados
        if (store.progress[gameId].includes(levelId)) {
            console.log(`[GameCenter] ${levelId} ya pagado.`);
            return { paid: false, coins: store.coins };
        }

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

    getBoughtCount: (id) => store.inventory[id] || 0,
    getBalance: () => store.coins
};

// Función auxiliar interna
function saveState() {
    localStorage.setItem(CONFIG.stateKey, JSON.stringify(store));
    updateUI(); // Intenta actualizar si el UI ya existe
}

function updateUI() {
    // Solo funciona si el DOM ya cargó
    const displays = document.querySelectorAll('.coin-display');
    if (displays.length) displays.forEach(el => el.textContent = store.coins);
}

// --- 3. LÓGICA VISUAL (Espera a que el HTML esté listo) ---
document.addEventListener('DOMContentLoaded', () => {
    
    // A. Inicializar UI de Monedas
    updateUI();
    
    // B. Inicializar Iconos
    if (window.lucide) lucide.createIcons();

    // C. Lógica de Navegación (Active State)
    updateActiveNav();
    window.addEventListener('hashchange', updateActiveNav);

    // D. Lógica de Avatar
    initAvatarSystem();
});

// --- FUNCIONES DE UI (Protegidas) ---

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

function initAvatarSystem() {
    const avatarInput = document.getElementById('avatar-upload');
    const avatarDisplay = document.getElementById('user-avatar-display');
    
    if (!avatarInput || !avatarDisplay) return; // Seguridad si no estamos en una pág con avatar

    const storedAvatar = localStorage.getItem('user_avatar_image');
    if (storedAvatar) {
        avatarDisplay.style.backgroundImage = `url('${storedAvatar}')`;
        avatarDisplay.innerHTML = '';
    }

    avatarInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    localStorage.setItem('user_avatar_image', event.target.result);
                    avatarDisplay.style.backgroundImage = `url('${event.target.result}')`;
                    avatarDisplay.innerHTML = '';
                } catch (err) {
                    alert("Imagen muy grande. Intenta con una más pequeña.");
                }
            };
            reader.readAsDataURL(file);
        }
    });
}
