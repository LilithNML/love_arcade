/**
 * AudioSynth.js
 * Generador de efectos de sonido procedimentales (Sin archivos mp3).
 * Ideal para prototipos o bajo consumo de datos.
 */

export class AudioSynthesizer {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
    }

    play(type) {
        if (!this.enabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        switch (type) {
            case 'click':
                this.playTone(800, 'sine', 0.05);
                break;
            case 'snap':
                this.playTone(300, 'triangle', 0.1);
                this.playTone(600, 'sine', 0.05); // Pequeño armónico
                break;
            case 'win':
                this.playWinChord();
                break;
        }
    }

    playTone(freq, type, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playWinChord() {
        // Acorde Mayor (Do - Mi - Sol) escalonado
        setTimeout(() => this.playTone(523.25, 'sine', 0.3), 0);
        setTimeout(() => this.playTone(659.25, 'sine', 0.3), 100);
        setTimeout(() => this.playTone(783.99, 'square', 0.6), 200);
    }
}

export const AudioSynth = new AudioSynthesizer();
