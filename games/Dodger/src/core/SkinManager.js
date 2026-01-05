export default class SkinManager {
    constructor() {
        // Definición de Skins y requisitos
        this.skins = [
            { id: 'ship_default', name: 'Mark I', req: 0, desc: 'Nave estándar.' },
            { id: 'ship_neon', name: 'Neon X', req: 1000, desc: 'Desbloquea a los 1,000 pts.' },
            { id: 'ship_gold', name: 'Golden Era', req: 2500, desc: 'Desbloquea a los 2,500 pts.' },
            { id: 'ship_void', name: 'Ghost', req: 5000, desc: 'Desbloquea a los 5,000 pts.' }
        ];
        
        // Cargar selección guardada
        this.currentSkinId = localStorage.getItem('dodger_skin') || 'ship_default';
    }

    getUnlockedSkins(highScore) {
        return this.skins.map(skin => ({
            ...skin,
            locked: highScore < skin.req
        }));
    }

    selectSkin(skinId, highScore) {
        const skin = this.skins.find(s => s.id === skinId);
        if (skin && highScore >= skin.req) {
            this.currentSkinId = skinId;
            localStorage.setItem('dodger_skin', skinId);
            return true;
        }
        return false;
    }

    getCurrentSkin() {
        return this.currentSkinId;
    }
}
