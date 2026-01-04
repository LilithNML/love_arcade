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
        
        // Elementos UI Dinámicos
        this.elScore = document.getElementById('scoreDisplay');
        this.elLevel = document.getElementById('levelDisplay');
        this.elFinalScore = document.getElementById('finalScore');
        this.elCoinsEarned = document.getElementById('coinsEarned');

        // Botones
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.startGame());

        // Estado
        this.state = 'MENU';
        this.particles = [];
        this.loop(0);
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
        this.audio.init();
        this.audio.play('start');
        
        this.state = 'PLAY';
        this.score = 0;
        this.particles = [];
        
        // Reiniciar Entidades
        this.player = new Player(this.width, this.height);
        this.spawner = new Spawner(this.width, this.height);
        
        // UI
        this.uiStart.classList.add('hidden');
        this.uiGameOver.classList.add('hidden');
        this.uiHUD.classList.remove('hidden');
        this.uiHUD.style.display = 'flex'; // Tailwind fix
        
        document.body.classList.remove('shake');
    }

    triggerGameOver() {
        this.state = 'GAMEOVER';
        this.audio.play('crash');
        
        // Efecto Shake
        document.body.classList.add('shake');
        
        // Explosión de partículas
        this.createExplosion(this.player.x, this.player.y, this.player.color);

        // Economía
        const result = this.economy.payout(this.score);

        // UI Updates
        this.uiHUD.classList.add('hidden');
        this.uiGameOver.classList.remove('hidden');
        this.uiGameOver.style.display = 'flex'; // Tailwind fix
        
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

    update() {
        if (this.state !== 'PLAY') return;
        
        this.score++;
        this.elScore.innerText = this.score;

        // Entidades
        this.player.update(1/60, this.input);
        const currentLevel = this.spawner.update(1/60, this.score);
        this.elLevel.innerText = currentLevel;

        // Colisiones
        if (this.spawner.checkCollision(this.player)) {
            this.triggerGameOver();
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Dibujar Partículas (siempre, incluso en game over para ver la explosión)
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
            if(this.state === 'PLAY') this.player.draw(this.ctx);
            this.spawner.draw(this.ctx);
        }
    }

    loop() {
        if (this.state === 'PLAY' || this.state === 'GAMEOVER') {
            this.update();
            this.draw();
        }
        requestAnimationFrame(() => this.loop());
    }
}
