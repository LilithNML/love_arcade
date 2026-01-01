/**
 * AudioManager.js
 * Gestor de efectos de sonido reales (SFX).
 * Utiliza Audio API nativo con clonación para permitir sonidos superpuestos.
 */

export class AudioManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.init();
    }

    init() {
        // Mapa de sonidos. 
        // ¡ASEGÚRATE DE SUBIR ESTOS ARCHIVOS A TU CARPETA ASSETS!
        const soundFiles = {
            'click': './assets/sounds/click.mp3', // Sonido de cartón/madera al levantar
            'snap': './assets/sounds/snap.mp3',   // Sonido satisfactorio de encaje
            'win': './assets/sounds/win.mp3'      // Fanfarria o acorde final
        };

        // Precarga
        for (const [key, path] of Object.entries(soundFiles)) {
            const audio = new Audio();
            audio.src = path;
            audio.preload = 'auto';
            audio.volume = 0.6;
            this.sounds[key] = audio;
        }
    }

    play(key) {
        if (!this.enabled || !this.sounds[key]) return;

        // Clonar nodo para permitir disparos rápidos (overlapping)
        // Esto permite que suenen varios "clicks" seguidos sin cortarse
        const clone = this.sounds[key].cloneNode();
        clone.volume = this.sounds[key].volume;
        
        // Manejo de errores (por si el usuario no ha interactuado aún)
        clone.play().catch(e => console.warn("Audio play blocked:", e));
    }

    toggle(state) {
        this.enabled = state;
    }
}

// Instancia singleton para usar en toda la app
export const AudioMgr = new AudioManager();
