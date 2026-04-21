export default class AudioController {
    constructor() {
        this.ctx = null;
        this.isMuted = localStorage.getItem('dodger_muted') === 'true';
        
        // --- BUFFERS PARA SFX ---
        this.buffers = {};
        this.sfxList = {
            'start': 'assets/audio/sfx_start.mp3',
            'crash': 'assets/audio/sfx_explosion.mp3',
            'levelUp': 'assets/audio/sfx_levelup.mp3',
            'coin': 'assets/audio/sfx_coin.mp3',
            'shield': 'assets/audio/sfx_shield.mp3'
        };

        // --- REFERENCIAS DE AMBIENTE ---
        this.ambientNodes = {
            droneOsc: null,     // Array de osciladores
            droneGain: null,
            pulseOsc: null,
            tensionFilter: null,
            masterGain: null
        };
        
        this.pulseInterval = null;
        this.stopTimer = null; // NUEVO: Para cancelar limpiezas pendientes
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.loadSFX();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    async loadSFX() {
        for (const [key, url] of Object.entries(this.sfxList)) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.buffers[key] = audioBuffer;
            } catch (e) {
                console.log(`[Audio] Usando fallback para ${key}`);
            }
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('dodger_muted', this.isMuted);
        
        if (this.ambientNodes.masterGain) {
            this.ambientNodes.masterGain.gain.setTargetAtTime(
                this.isMuted ? 0 : 0.3, 
                this.ctx.currentTime, 
                0.1
            );
        }
        return this.isMuted;
    }

    // --- MOTOR DE AMBIENTE ---
    startMusic() {
        if (!this.ctx) return;
        
        // 1. Limpieza agresiva antes de empezar
        // Cancelamos cualquier "muerte programada" anterior para que no mate lo nuevo
        if (this.stopTimer) clearTimeout(this.stopTimer);
        this.stopMusic(true); // true = forzar parada inmediata sin fade-out

        const now = this.ctx.currentTime;
        
        // Crear Master Gain para la música
        this.ambientNodes.masterGain = this.ctx.createGain();
        this.ambientNodes.masterGain.connect(this.ctx.destination);
        
        // Fade in
        this.ambientNodes.masterGain.gain.setValueAtTime(0, now);
        this.ambientNodes.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.3, now + 2);

        // CAPA 1: DRONE
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const droneFilter = this.ctx.createBiquadFilter();
        
        osc1.type = 'sawtooth';
        osc1.frequency.value = 55; 
        osc2.type = 'triangle';
        osc2.frequency.value = 55.5; 

        droneFilter.type = 'lowpass';
        droneFilter.frequency.value = 150; 

        const droneGain = this.ctx.createGain();
        droneGain.gain.value = 0.5;

        osc1.connect(droneFilter);
        osc2.connect(droneFilter);
        droneFilter.connect(droneGain);
        droneGain.connect(this.ambientNodes.masterGain);

        osc1.start();
        osc2.start();

        // Guardar referencias
        this.ambientNodes.droneOsc = [osc1, osc2];
        this.ambientNodes.tensionFilter = droneFilter;

        // CAPA 2: PULSO
        this.pulseInterval = setInterval(() => {
            if (this.isMuted || !this.ctx) return;
            this.triggerPulse();
        }, 600);
    }

    triggerPulse() {
        // Validación extra por si el contexto murió
        if (!this.ambientNodes.masterGain) return; 

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        
        gain.gain.setValueAtTime(0.05, t); 
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        osc.connect(gain);
        gain.connect(this.ambientNodes.masterGain);
        osc.start(t);
        osc.stop(t + 0.15);
    }

    updateMusic(score) {
        if (!this.ambientNodes.tensionFilter) return;
        const targetFreq = Math.min(150 + (score * 0.15), 1200);
        this.ambientNodes.tensionFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 1.0);
    }

    stopMusic(immediate = false) {
        // Limpiar intervalo de pulso siempre
        if (this.pulseInterval) {
            clearInterval(this.pulseInterval);
            this.pulseInterval = null;
        }

        // Si no hay música sonando, salir
        if (!this.ambientNodes.masterGain) return;

        // CAPTURAR REFERENCIAS LOCALES (Clausura)
        // Esto es vital: guardamos "qué osciladores eran" en este momento exacto.
        // Si this.ambientNodes cambia después, esta función seguirá apagando los VIEJOS.
        const nodesToStop = this.ambientNodes.droneOsc;
        const masterGainToFade = this.ambientNodes.masterGain;

        // Limpiar referencias globales inmediatamente para que el sistema sepa que está "apagado"
        this.ambientNodes.droneOsc = null;
        this.ambientNodes.masterGain = null;
        this.ambientNodes.tensionFilter = null;

        const now = this.ctx.currentTime;

        if (immediate) {
            // Parada instantánea (al reiniciar)
            if(nodesToStop) nodesToStop.forEach(osc => { try { osc.stop(); } catch(e){} });
            masterGainToFade.disconnect();
        } else {
            // Parada suave (Game Over)
            masterGainToFade.gain.cancelScheduledValues(now);
            masterGainToFade.gain.setValueAtTime(masterGainToFade.gain.value, now);
            masterGainToFade.gain.linearRampToValueAtTime(0, now + 0.5); // Fade out 0.5s
            
            // Programar parada real de los osciladores capturados
            this.stopTimer = setTimeout(() => {
                if(nodesToStop) {
                    nodesToStop.forEach(osc => {
                        try { osc.stop(); } catch(e) {} // Try/catch por si ya pararon
                    });
                }
                // Desconectar para liberar memoria
                setTimeout(() => { try { masterGainToFade.disconnect(); } catch(e){} }, 100);
            }, 600);
        }
    }

    play(type) {
        if (this.isMuted || !this.ctx) return;
        
        if (this.buffers[type]) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers[type];
            source.connect(this.ctx.destination);
            source.start();
        } else {
            this.playSynthFallback(type);
        }
    }

    playSynthFallback(type) {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        const now = this.ctx.currentTime;

        switch (type) {
            case 'start':
                osc.type = 'sine'; osc.frequency.setValueAtTime(220, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
                gainNode.gain.setValueAtTime(0.1, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now); osc.stop(now + 0.3); break;
            case 'crash':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);
                gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now); osc.stop(now + 0.3); break;
            case 'levelUp':
            case 'coin':
            case 'shield':
                osc.type = 'triangle'; osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(880, now + 0.1);
                gainNode.gain.setValueAtTime(0.1, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
                osc.start(now); osc.stop(now + 0.2); break;
        }
    }
}
