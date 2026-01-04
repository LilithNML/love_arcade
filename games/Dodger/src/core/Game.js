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
        
        // Elementos de Texto
        this.elScore = document.getElementById('scoreDisplay');
        this.elLevel = document.getElementById('levelDisplay');
        this.elFinalScore = document.getElementById('finalScore');
        this.elCoinsEarned = document.getElementById('coinsEarned');

        // --- FIX BOTONES ---
        this.btnStart = document.getElementById('startBtn');
        this.btnRestart = document.getElementById('restartBtn');

        // Vinculación segura de eventos
        if(this.btnStart) {
            this.btnStart.onclick = () => { // Usamos onclick directo para evitar duplicados
                this.startGame();
            };
        }
        
        if(this.btnRestart) {
            this.btnRestart.onclick = () => {
                console.log("[Dodger] Botón Reiniciar presionado");
                this.startGame();
            };
        }

        // Estado inicial
        this.state = 'MENU';
        this.particles = [];
        this.lastTime = 0;
        
        // Loop principal
        requestAnimationFrame((t) => this.loop(t));
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

    startGame() {
        console.log("[Dodger] Iniciando partida...");
        this.audio.init();
        this.audio.play('start');
        
        this.state = 'PLAY';
        this.score = 0;
        this.level = 1;
        this.particles = [];
        this.lastTime = performance.now();
        
        this.player = new Player(this.width, this.height);
        this.spawner = new Spawner(this.width, this.height);
        
        // --- UI TOGGLE FIX ---
        // Usamos solo clases de Tailwind, sin tocar style.display inline
        this.uiStart.classList.add('hidden');
        this.uiGameOver.classList.add('hidden'); 
        this.uiHUD.classList.remove('hidden');
        this.uiHUD.classList.add('flex'); // Asegurar flex layout
        
        this.elScore.innerText = "0";
        this.elLevel.innerText = "1";
        
        document.body.classList.remove('shake');
    }

    triggerGameOver() {
        if(this.state === 'GAMEOVER') return;

        console.log("[Dodger] Game Over Triggered");
        this.state = 'GAMEOVER';
        this.audio.play('crash');
        
        document.body.classList.add('shake');
        this.createExplosion(this.player.x, this.player.y, this.player.color);

        const result = this.economy.payout(this.score);

        // --- UI TOGGLE FIX ---
        this.uiHUD.classList.add('hidden');
        this.uiHUD.classList.remove('flex');

        this.uiGameOver.classList.remove('hidden');
        this.uiGameOver.classList.add('flex'); // Restaurar flex layout
        
        // Aseguramos que la pantalla sea interactiva
        this.uiGameOver.style.pointerEvents = 'auto'; 
        
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
        // Cap del delta time para evitar saltos gigantes tras pausa/reinicio
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); 
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }
}
