/**
 * AudioSynth.js
 * Generador de efectos de sonido usando WebAudio API.
 * No requiere assets externos.
 */

import { Storage } from './Storage.js';

let audioCtx = null;

function getContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
    }
    return audioCtx;
}

export const AudioSynth = {
    play: (type) => {
        // 1. Verificar settings del usuario
        const settings = Storage.get('settings');
        if (!settings.sound) return;

        const ctx = getContext();
        if (!ctx) return;

        // Reanudar contexto si está suspendido (política de navegadores)
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        const vol = settings.volume || 0.5;

        switch (type) {
            case 'click': // Sonido corto "pop" al agarrar
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
                gain.gain.setValueAtTime(vol * 0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;

            case 'snap': // Sonido de encajar pieza
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.linearRampToValueAtTime(300, now + 0.1);
                gain.gain.setValueAtTime(vol * 0.8, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
                break;

            case 'win': // Acorde de victoria
                createNote(ctx, 523.25, now, 0.4, vol); // Do
                createNote(ctx, 659.25, now + 0.1, 0.4, vol); // Mi
                createNote(ctx, 783.99, now + 0.2, 0.6, vol); // Sol
                break;
        }
    }
};

// Helper para acordes
function createNote(ctx, freq, time, duration, maxVol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(maxVol, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.start(time);
    osc.stop(time + duration);
}
