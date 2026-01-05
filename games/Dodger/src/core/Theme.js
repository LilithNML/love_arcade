export default class ThemeManager {
    constructor() {
        // Paletas tipo "Neon Space"
        this.palettes = [
            // Zona 0: Deep Space (Azul/Cian) - Inicio
            { 
                threshold: 0, 
                player: '#3b82f6', // Blue-500
                enemy: '#ef4444',  // Red-500
                star: '#94a3b8',   // Slate-400
                glow: '#60a5fa'    // Blue-400
            },
            // Zona 1: Nebula (Púrpura/Rosa) - 3000 pts
            { 
                threshold: 3000, 
                player: '#d946ef', // Fuchsia-500
                enemy: '#facc15',  // Yellow-400
                star: '#e879f9',   // Fuchsia-300
                glow: '#c026d3'    // Fuchsia-600
            },
            // Zona 2: Hazard (Naranja/Verde) - 6000 pts
            { 
                threshold: 6000, 
                player: '#f97316', // Orange-500
                enemy: '#22c55e',  // Green-500
                star: '#fdba74',   // Orange-300
                glow: '#ea580c'    // Orange-600
            },
            // Zona 3: Void (Blanco/Negro Invertido) - 9000 pts
            { 
                threshold: 9000, 
                player: '#ffffff', 
                enemy: '#000000',  // Enemigos oscuros con borde
                star: '#cbd5e1',   
                glow: '#ffffff'
            }
        ];

        this.currentIdx = 0;
        this.currentPalette = this.palettes[0];
    }

    update(score) {
        // Verificar si toca cambio de zona
        const nextIdx = this.currentIdx + 1;
        if (nextIdx < this.palettes.length && score >= this.palettes[nextIdx].threshold) {
            this.currentIdx = nextIdx;
            this.currentPalette = this.palettes[nextIdx];
            return true; // Hubo cambio
        }
        return false;
    }

    get() {
        return this.currentPalette;
    }
}
