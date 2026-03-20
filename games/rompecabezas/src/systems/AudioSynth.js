/**
 * AudioSynth.js
 * Generador de efectos de sonido procedimentales
 * (mobile / web games)
 */

export class AudioSynthesizer {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;

        // Bus maestro
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(this.ctx.destination);

        // Compresión ligera (cola más limpia)
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 6;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;

        this.compressor.connect(this.master);
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    play(type) {
        if (!this.enabled) return;
        this.resume();

        switch (type) {
            case 'click':
                this.uiClick();
                break;
            case 'snap':
                this.pieceSnap();
                break;
            case 'win':
                this.winChord();
                break;
        }
    }

    // ------------------------
    // Sonidos
    // ------------------------

    uiClick() {
        const now = this.ctx.currentTime;

        // Transiente
        this.tone({
            freq: 1200,
            type: 'triangle',
            attack: 0.001,
            decay: 0.03,
            volume: 0.15,
            time: now
        });

        // Cuerpo suave
        this.tone({
            freq: 500,
            type: 'sine',
            attack: 0.002,
            decay: 0.06,
            volume: 0.08,
            time: now
        });
    }

    pieceSnap() {
        const now = this.ctx.currentTime;

        // Golpe inicial
        this.tone({
            freq: 220,
            type: 'square',
            attack: 0.001,
            decay: 0.08,
            volume: 0.18,
            time: now,
            lowpass: 1200
        });

        // Click metálico corto
        this.tone({
            freq: 900,
            type: 'triangle',
            attack: 0.001,
            decay: 0.04,
            volume: 0.12,
            time: now
        });
    }

    winChord() {
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99]; // C - E - G

        notes.forEach((freq, i) => {
            this.tone({
                freq,
                type: 'sine',
                attack: 0.01,
                decay: 0.6,
                volume: 0.12,
                time: now + i * 0.12
            });
        });

        // Brillo final
        this.tone({
            freq: 1567.98,
            type: 'triangle',
            attack: 0.02,
            decay: 0.8,
            volume: 0.08,
            time: now + 0.25,
            highpass: 800
        });
    }

    // ------------------------
    //  Motor de síntesis base
    // ------------------------

    tone({
        freq,
        type = 'sine',
        attack = 0.01,
        decay = 0.1,
        volume = 0.1,
        time,
        lowpass = null,
        highpass = null
    }) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(volume, time + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);

        let node = osc;

        // Filtros opcionales
        if (lowpass || highpass) {
            const filter = this.ctx.createBiquadFilter();
            filter.type = lowpass ? 'lowpass' : 'highpass';
            filter.frequency.value = lowpass || highpass;
            node.connect(filter);
            node = filter;
        }

        node.connect(gain);
        gain.connect(this.compressor);

        osc.start(time);
        osc.stop(time + attack + decay + 0.05);
    }
}

export const AudioSynth = new AudioSynthesizer();
