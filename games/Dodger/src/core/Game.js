import EconomyManager from '../systems/Economy.js';
import InputHandler from './Input.js';
import AudioController from './Audio.js';
import Player from '../entities/Player.js';
import Spawner from '../entities/Spawner.js';

export default class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        this.economy = new EconomyManager();
        this.input = new InputHandler();
        this.audio = new AudioController();
        
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Referencias UI
        this.uiStart = document.getElementById('startScreen');
        this.uiHUD = document.getElementById('hud');
        this.uiGameOver = document.getElementById('gameOverScreen');
        this.uiPause = document.getElementById('pauseScreen');
        
        // Elementos de Texto
        this.elScore = document.getElementById('scoreDisplay');
        this.elLevel = document.getElementById('levelDisplay');
        this.elFinalScore = document.getElementById('finalScore');
        this.elCoinsEarned = document.getElementById('coinsEarned');

        // Botones Principales
        this.btnStart = document.getElementById('startBtn');
        this.btnRestart = document.getElementById('restartBtn');
        
        // Botones HUD/Pausa
        this.btnPause = document.getElementById('btnPause');
        this.btnMute = document.getElementById('btnMute');
        this.btnResume = document.getElementById('btnResume');
        this.btnQuit = document.getElementById('btnQuit');

        this.bindEvents();

        // Estado inicial
        this.state = 'MENU'; // MENU, PLAY, PAUSE, GAMEOVER
        this.particles = [];
        this.lastTime = 0;
        
        // Detección de cambio de pestaña (Auto-Pause)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAY') {
                this.togglePause();
            }
        });
        
        // Iniciar loop
        requestAnimationFrame((t) => this.loop(t));
    }

    bindEvents() {
        if(this.btnStart) this.btnStart.onclick = () => this.startGame();
        if(this.btnRestart) this.btnRestart.onclick = () => this.startGame();
        
        // Pausa
        if(this.btnPause) this.btnPause.onclick = () => this.togglePause();
        if(this.btnResume) this.btnResume.onclick = () => this.togglePause();
        if(this.btnQuit) this.btnQuit.onclick = () => this.quitGame();

        // Mute
        if(this.btnMute) {
            // Set icono inicial
            this.btnMute.innerText = this.audio.isMuted ? '🔇' : '🔊';
            
            this.btnMute.onclick = () => {
                const isMuted = this.audio.toggleMute();
                this.btnMute.innerText = isMuted ? '🔇' : '🔊';
                // Quitar foco para que espacio/enter no lo vuelva a activar
                this.btnMute.blur();
            };
        }

        // Tecla P para pausa
        window.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
                if (this.state === 'PLAY' || this.state === 'PAUSE') {
                    this.togglePause();
                }
            }
        });
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        if(this.player) {
            this.player.gameWidth = this.width;
            this.player.y = this.height - this.player.size - 50;
        }
    }

    togglePause() {
        if (this.state === 'PLAY') {
            this.state = 'PAUSE';
            this.uiPause.classList.remove('hidden');
            this.uiPause.classList.add('flex');
            this.btnPause.innerText = '▶'; // Icono Play
        } else if (this.state === 'PAUSE') {
            this.state = 'PLAY';
            this.uiPause.classList.add('hidden');
            this.uiPause.classList.remove('flex');
            this.btnPause.innerText = '⏸'; // Icono Pausa
            
            // CRÍTICO: Resetear lastTime para evitar saltos de tiempo (teletransporte)
            this.lastTime = performance.now();
        }
    }

    quitGame() {
        this.state = 'MENU';
        this.uiPause.classList.add('hidden');
        this.uiHUD.classList.add('hidden');
        this.uiStart.classList.remove('hidden');
        
        // Reset botones
        this.btnPause.innerText = '⏸';
    }

    startGame() {
        this.audio.init();
        this.audio.play('start');
        
        this.state = 'PLAY';
        this.score = 0;
        this.level = 1;
        this.particles = [];
        this.lastTime = performance.now();
        
        this.player = new Player(this.width, this.height);
        this.spawner = new Spawner(this.width, this.height);
        
        // UI reset
        this.uiStart.classList.add('hidden');
        this.uiGameOver.classList.add('hidden'); 
        this.uiHUD.classList.remove('hidden');
        this.uiHUD.classList.add('flex');
        
        this.elScore.innerText = "0";
        this.elLevel.innerText = "1";
        
        document.body.classList.remove('shake');
    }

    triggerGameOver() {
        if(this.state === 'GAMEOVER') return;

        this.state = 'GAMEOVER';
        this.audio.play('crash');
        
        document.body.classList.add('shake');
        this.createExplosion(this.player.x, this.player.y, this.player.color);

        const result = this.economy.payout(this.score);

        // UI Toggle
        this.uiHUD.classList.add('hidden');
        this.uiHUD.classList.remove('flex');

        this.uiGameOver.classList.remove('hidden');
        this.uiGameOver.classList.add('flex');
        
        this.elFinalScore.innerText = this.score;
        this.elCoinsEarned.innerText = `+${result.coins}`;
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0, color: color
            });
        }
    }

    update(dt) {
        if (this.state !== 'PLAY') return;
        
        this.score++;
        this.elScore.innerText = this.score;

        this.player.update(dt, this.input);
        
        const currentLevel = this.spawner.update(dt, this.score);
        
        if (currentLevel > this.level) {
            this.level = currentLevel;
            this.audio.play('levelUp');
            this.elLevel.innerText = this.level;
        }

        if (this.spawner.checkCollision(this.player)) {
            this.triggerGameOver();
        }
    }

    draw() {
        // En pausa, no borramos pantalla para que se vea el "congelado" detrás del menú
        if (this.state === 'PAUSE') return;

        this.ctx.clearRect(0, 0, this.width, this.height);

        // Partículas
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.05;
            
            this.ctx.save();
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();

            if (p.life <= 0) this.particles.splice(i, 1);
        }

        if (this.state === 'PLAY' || (this.state === 'GAMEOVER' && this.particles.length > 0)) {
            if(this.state === 'PLAY' && this.player) this.player.draw(this.ctx);
            if(this.spawner) this.spawner.draw(this.ctx);
        }
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        
        // Si estamos en pausa, actualizamos lastTime para que el dt no se dispare al volver
        if (this.state === 'PAUSE') {
            this.lastTime = timestamp;
            requestAnimationFrame((t) => this.loop(t));
            return;
        }

        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); 
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }
}
