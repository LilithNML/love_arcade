/**
 * LA_Sound - Simple sound system using Web Audio API
 * Generates procedural sounds for mobile-friendly performance
 */

export class LA_Sound {
    constructor(game) {
        this.game = game;
        this.audioContext = null;
        this.sounds = new Map();
        
        // Initialize on user interaction (required by browsers)
        this.initialized = false;
        this.init();
    }
    
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
            console.log('[LA_SHOOTER_SOUND] Audio initialized');
        } catch (e) {
            console.warn('[LA_SHOOTER_SOUND] Web Audio API not supported:', e);
            this.initialized = false;
        }
    }
    
    play(soundName, options = {}) {
        if (!this.initialized || !this.game.config.settings.sfx) return;
        
        // Resume audio context if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        switch(soundName) {
            case 'shoot':
                this.playShoot();
                break;
            case 'chargedShoot':
                this.playChargedShoot();
                break;
            case 'enemyDeath':
                this.playEnemyDeath();
                break;
            case 'playerHit':
                this.playPlayerHit();
                break;
            case 'dash':
                this.playDash();
                break;
            case 'milestone':
                this.playMilestone();
                break;
            case 'gameOver':
                this.playGameOver();
                break;
            default:
                console.warn('[LA_SHOOTER_SOUND] Unknown sound:', soundName);
        }
    }
    
    // === PROCEDURAL SOUNDS ===
    
    playShoot() {
        const now = this.audioContext.currentTime;
        
        // Oscillator
        const osc = this.audioContext.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        
        // Gain envelope
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        // Connect and play
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }
    
    playChargedShoot() {
        const now = this.audioContext.currentTime;
        
        // Oscillator 1
        const osc1 = this.audioContext.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(400, now);
        osc1.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        
        // Oscillator 2 (harmony)
        const osc2 = this.audioContext.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(600, now);
        osc2.frequency.exponentialRampToValueAtTime(150, now + 0.2);
        
        // Gain envelope
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        // Connect and play
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioContext.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.2);
        osc2.stop(now + 0.2);
    }
    
    playEnemyDeath() {
        const now = this.audioContext.currentTime;
        
        // Noise for explosion
        const bufferSize = this.audioContext.sampleRate * 0.3;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }
        
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;
        
        // Filter
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        
        // Gain
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        // Connect and play
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioContext.destination);
        noise.start(now);
    }
    
    playPlayerHit() {
        const now = this.audioContext.currentTime;
        
        // Low frequency pulse
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
        
        // Gain envelope
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        // Connect and play
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    }
    
    playDash() {
        const now = this.audioContext.currentTime;
        
        // Quick whoosh
        const osc = this.audioContext.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        
        // Filter
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(500, now);
        
        // Gain envelope
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        // Connect and play
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }
    
    playMilestone() {
        const now = this.audioContext.currentTime;
        
        // Happy ascending tones
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            
            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.1, now + i * 0.1 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
            
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        });
    }
    
    playGameOver() {
        const now = this.audioContext.currentTime;
        
        // Descending tones
        const notes = [392, 349.23, 293.66, 261.63]; // G4, F4, D4, C4
        
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.15);
            
            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0, now + i * 0.15);
            gain.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
            
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.4);
        });
    }
}
