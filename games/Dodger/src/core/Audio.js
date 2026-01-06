export default class AudioController {
    constructor() {
        this.ctx = null;
        this.isMuted = localStorage.getItem('dodger_muted') === 'true';
        
        // --- BUFFERS PARA SFX (Archivos Reales) ---
        this.buffers = {};
        this.sfxList = {
            'start': 'assets/audio/sfx_start.mp3',
            'crash': 'assets/audio/sfx_explosion.mp3',
            'levelUp': 'assets/audio/sfx_levelup.mp3', // Usado para powers también
            'coin': 'assets/audio/sfx_coin.mp3',
            'shield': 'assets/audio/sfx_shield.mp3'
        };

        // --- NODOS DE AMBIENTE PROCEDURAL ---
        this.ambientNodes = {
            droneOsc: null,
            droneGain: null,
            pulseOsc: null,
            pulseGain: null,
            tensionFilter: null,
            masterGain: null
        };
        
        this.pulseInterval = null;
        this.currentScore = 0;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.loadSFX(); // Cargar archivos reales
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Carga de archivos MP3
    async loadSFX() {
        for (const [key, url] of Object.entries(this.sfxList)) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.buffers[key] = audioBuffer;
            } catch (e) {
                // Silencioso: si no está el archivo, usaremos fallback sintético
                console.log(`[Audio] Archivo ${key} no encontrado, usando sintetizador.`);
            }
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('dodger_muted', this.isMuted);
        
        // Apagar/Prender ambiente en tiempo real
        if (this.ambientNodes.masterGain) {
            this.ambientNodes.masterGain.gain.setTargetAtTime(
                this.isMuted ? 0 : 0.3, 
                this.ctx.currentTime, 
                0.1
            );
        }
        return this.isMuted;
    }

    // --- MOTOR DE AMBIENTE (Procedural) ---
    startMusic() {
        if (!this.ctx) return;
        this.stopMusic(); // Limpiar anterior

        const now = this.ctx.currentTime;
        this.ambientNodes.masterGain = this.ctx.createGain();
        this.ambientNodes.masterGain.connect(this.ctx.destination);
        // Fade in inicial
        this.ambientNodes.masterGain.gain.setValueAtTime(0, now);
        this.ambientNodes.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.3, now + 2);

        // CAPA 1: DRONE (Base)
        // Dos osciladores desafinados para crear textura "gruesa"
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const droneFilter = this.ctx.createBiquadFilter();
        
        osc1.type = 'sawtooth';
        osc1.frequency.value = 55; // Nota baja (A1)
        osc2.type = 'triangle';
        osc2.frequency.value = 55.5; // Desafinación ligera

        droneFilter.type = 'lowpass';
        droneFilter.frequency.value = 150; // Muy oscuro al inicio

        const droneGain = this.ctx.createGain();
        droneGain.gain.value = 0.5;

        osc1.connect(droneFilter);
        osc2.connect(droneFilter);
        droneFilter.connect(droneGain);
        droneGain.connect(this.ambientNodes.masterGain);

        osc1.start();
        osc2.start();

        // Guardar referencias para modificar o parar
        this.ambientNodes.droneOsc = [osc1, osc2];
        this.ambientNodes.tensionFilter = droneFilter;

        // CAPA 2: PULSO RÍTMICO (Hearthbeat)
        // Generado por intervalo para simular BPM
        this.pulseInterval = setInterval(() => {
            if (this.isMuted || !this.ctx) return;
            this.triggerPulse();
        }, 600); // ~100 BPM
    }

    triggerPulse() {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // Sonido "Tick" suave
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        
        gain.gain.setValueAtTime(0.05, t); // Muy sutil
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        osc.connect(gain);
        gain.connect(this.ambientNodes.masterGain);
        osc.start(t);
        osc.stop(t + 0.15);
    }

    updateMusic(score) {
        if (!this.ambientNodes.tensionFilter) return;
        
        // CAPA 3: TENSIÓN PROGRESIVA
        // Abrimos el filtro LowPass del drone según el score
        // Score 0 -> 150Hz (Oscuro)
        // Score 5000 -> 800Hz (Brillante/Tenso)
        const targetFreq = Math.min(150 + (score * 0.15), 1200);
        
        this.ambientNodes.tensionFilter.frequency.setTargetAtTime(
            targetFreq, 
            this.ctx.currentTime, 
            1.0 // Transición suave
        );
    }

    stopMusic() {
        if (this.ambientNodes.masterGain) {
            // Fade out rápido
            const now = this.ctx.currentTime;
            this.ambientNodes.masterGain.gain.cancelScheduledValues(now);
            this.ambientNodes.masterGain.gain.setValueAtTime(this.ambientNodes.masterGain.gain.value, now);
            this.ambientNodes.masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
            
            setTimeout(() => {
                if(this.ambientNodes.droneOsc) {
                    this.ambientNodes.droneOsc.forEach(osc => osc.stop());
                }
                clearInterval(this.pulseInterval);
            }, 600);
        } else {
             clearInterval(this.pulseInterval);
        }
    }

    // --- REPRODUCCIÓN SFX (Híbrida: Archivo o Sintetizador) ---
    play(type) {
        if (this.isMuted || !this.ctx) return;

        // Opción A: Reproducir archivo cargado
        if (this.buffers[type]) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers[type];
            source.connect(this.ctx.destination);
            source.start();
            return;
        }

        // Opción B: Fallback (Sintetizador Web Audio antiguo)
        // Esto asegura que el juego tenga sonido aunque no subas los mp3
        this.playSynthFallback(type);
    }

    playSynthFallback(type) {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        const now = this.ctx.currentTime;

        switch (type) {
            case 'start':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
                break;
            case 'crash':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);
                gainNode.gain.setValueAtTime(0.3, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
                break;
            case 'levelUp':
            case 'coin':
            case 'shield':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(880, now + 0.1);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
                osc.start(now); osc.stop(now + 0.2);
                break;
        }
    }
}
