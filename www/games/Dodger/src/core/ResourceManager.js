export default class ResourceManager {
    constructor() {
        this.images = {};
        this.assetsPath = 'assets/sprites/';
        
        // Definición de assets requeridos
        this.manifest = {
            'ship_default': { color: '#3b82f6', type: 'ship' },
            'ship_gold':    { color: '#fbbf24', type: 'ship' },
            'ship_neon':    { color: '#a855f7', type: 'ship' },
            'ship_void':    { color: '#ffffff', type: 'ship' },
            'asteroid':     { color: '#ef4444', type: 'rock' },
            'orb':          { color: '#facc15', type: 'circle' }, // Puntos extra
            'pw_shield':    { color: '#06b6d4', type: 'icon', label: '🛡️' },
            'pw_time':      { color: '#8b5cf6', type: 'icon', label: '⏱️' },
            'pw_magnet':    { color: '#f59e0b', type: 'icon', label: '🧲' }
        };
    }

    async loadAll() {
        const promises = Object.keys(this.manifest).map(key => this.loadImage(key));
        await Promise.all(promises);
    }

    loadImage(key) {
        return new Promise((resolve) => {
            const img = new Image();
            // Intentar cargar desde carpeta assets
            img.src = `${this.assetsPath}${key}.png`;
            
            img.onload = () => {
                this.images[key] = img;
                resolve();
            };

            // FALLBACK: Si no existe la imagen (aún no la subes), generamos una por código
            img.onerror = () => {
                this.images[key] = this.createPlaceholder(key);
                resolve();
            };
        });
    }

    get(key) {
        return this.images[key];
    }

    // Generador de Sprites Temporales (Para que funcione sin archivos externos)
    createPlaceholder(key) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const meta = this.manifest[key];

        if (meta.type === 'ship') {
            ctx.fillStyle = meta.color;
            ctx.beginPath();
            ctx.moveTo(32, 4); ctx.lineTo(4, 60); ctx.lineTo(32, 48); ctx.lineTo(60, 60);
            ctx.fill();
            // Cockpit
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.arc(32, 32, 8, 0, Math.PI*2); ctx.fill();
        } 
        else if (meta.type === 'rock') {
            ctx.fillStyle = meta.color;
            ctx.fillRect(8, 8, 48, 48);
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 4;
            ctx.strokeRect(8, 8, 48, 48);
        }
        else if (meta.type === 'icon') {
            ctx.fillStyle = meta.color; // Fondo
            ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = '30px Arial';
            ctx.textAlign = 'center'; 
            ctx.textBaseline = 'middle';
            ctx.fillText(meta.label, 32, 34);
        }
        else if (meta.type === 'circle') {
            ctx.fillStyle = meta.color;
            ctx.beginPath(); ctx.arc(32, 32, 16, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
        }

        const finalImg = new Image();
        finalImg.src = canvas.toDataURL();
        return finalImg;
    }
}
