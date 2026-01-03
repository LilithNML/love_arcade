import EconomyManager from '../systems/Economy.js';
import InputHandler from './Input.js';
import Player from '../entities/Player.js';
import Spawner from '../entities/Spawner.js';

export default class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Sistemas
        this.economy = new EconomyManager();
        this.input = new InputHandler();
        
        // Dimensiones
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Entidades (se inicializan en startRun)
        this.player = null;
        this.spawner = null;

        // Estado Global
        this.state = 'MENU'; 
        this.score = 0; // Tiempo en segundos
        this.lastTime = 0;
        this.startTime = 0;
        this.difficulty = 0;
        
        // Referencias UI (DOM)
        this.uiMenu = document.getElementById('mainMenu');
        this.uiScore = document.getElementById('scoreDisplay');
        this.uiHud = document.getElementById('hud');
        this.btnPlay = document.getElementById('btnPlay');
        this.menuTitle = document.getElementById('menuTitle');
        this.menuSubtitle = document.getElementById('menuSubtitle');

        // Event Listener para el botón Jugar
        if (this.btnPlay) {
            this.btnPlay.addEventListener('click', () => this.startRun());
        }

        // Manejo de resize
        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.canvas.width = this.width;
            this.canvas.height = this.height;
            // Si el jugador existe, aseguramos que no quede fuera
            if (this.player) {
                this.player.gameWidth = this.width;
                this.player.gameHeight = this.height;
                this.player.y = this.height - 100;
            }
        });
        
        // Iniciar Loop
        requestAnimationFrame((t) => this.loop(t));
    }

    startRun() {
        this.state = 'PLAY';
        this.score = 0;
        this.difficulty = 0;
        this.startTime = Date.now();
        
        // Inicializar entidades
        this.player = new Player(this.width, this.height);
        this.spawner = new Spawner(this.width, this.height);
        
        // UI Updates
        this.uiMenu.classList.remove('active');
        this.uiHud.style.display = 'block';
    }

    gameOver() {
        this.state = 'GAMEOVER';
        const finalTime = this.score;
        
        // Transacción económica
        const result = this.economy.payout(finalTime);
        
        // Feedback Visual
        this.uiHud.style.display = 'none';
        this.uiMenu.classList.add('active');
        this.menuTitle.innerText = "CRASHED";
        this.btnPlay.innerText = "REINTENTAR";
        
        let msg = `Tiempo: ${finalTime}s`;
        if (result.sent) {
            msg += `\n +${result.coins} Monedas`;
        } else if (result.coins > 0) {
            msg += `\n (Offline: ${result.coins} coins)`;
        }
        this.menuSubtitle.innerText = msg;
    }

    update(dt) {
        if (this.state !== 'PLAY') return;

        // Actualizar tiempo/score
        const elapsed = (Date.now() - this.startTime) / 1000;
        this.score = Math.floor(elapsed);
        this.difficulty = elapsed / 10; // Aumenta dificultad cada 10s
        
        if (this.uiScore) this.uiScore.innerText = this.score;

        // Actualizar Entidades
        if (this.player) this.player.update(dt, this.input);
        if (this.spawner) this.spawner.update(dt, this.difficulty);

        // Chequear Colisiones
        if (this.spawner && this.player) {
            if (this.spawner.checkCollision(this.player)) {
                this.gameOver();
            }
        }
    }

    draw() {
        // Limpiar pantalla
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.state === 'PLAY') {
            if (this.player) this.player.draw(this.ctx);
            if (this.spawner) this.spawner.draw(this.ctx);
        }
    }

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }
}
