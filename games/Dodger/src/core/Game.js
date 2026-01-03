import EconomyManager from '../systems/Economy.js';

export default class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.economy = new EconomyManager();
        
        // Ajuste de resolución (DPI)
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Estado
        this.state = 'MENU'; // MENU, PLAY, GAMEOVER
        this.score = 0; // Tiempo en segundos
        this.lastTime = 0;
        this.accumulator = 0;
        
        // UI References
        this.uiMenu = document.getElementById('mainMenu');
        this.uiScore = document.getElementById('scoreDisplay');
        this.uiHud = document.getElementById('hud');
        this.btnPlay = document.getElementById('btnPlay');
        this.menuTitle = document.getElementById('menuTitle');
        this.menuSubtitle = document.getElementById('menuSubtitle');

        // Event Listeners UI
        this.btnPlay.addEventListener('click', () => this.startRun());
        
        // Loop
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    startRun() {
        this.state = 'PLAY';
        this.score = 0;
        this.startTime = Date.now();
        
        // UI Updates
        this.uiMenu.classList.remove('active');
        this.uiHud.style.display = 'block';
        
        // TODO: Reset Player & Spawner here
    }

    gameOver() {
        this.state = 'GAMEOVER';
        const finalTime = Math.floor((Date.now() - this.startTime) / 1000);
        
        // --- INTEGRACIÓN ECONOMÍA ---
        // Llamamos al pago una sola vez al morir
        const result = this.economy.payout(finalTime);
        
        // Feedback Visual
        this.uiHud.style.display = 'none';
        this.uiMenu.classList.add('active');
        this.menuTitle.innerText = "CRASHED";
        this.btnPlay.innerText = "REINTENTAR";
        
        let msg = `Sobreviviste ${finalTime}s.`;
        if (result.sent) {
            msg += `\n¡Ganaste +${result.coins} Monedas!`;
        }
        this.menuSubtitle.innerText = msg;
    }

    update(dt) {
        if (this.state !== 'PLAY') return;

        // Actualizar Score UI
        const currentSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        this.uiScore.innerText = currentSeconds;

        // Simulación de muerte para testing (click en canvas mata)
        // TODO: Reemplazar con lógica real de colisiones
        /* if (input.clicked) {
             this.gameOver();
        } 
        */
    }

    draw() {
        // Limpiar pantalla
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.state === 'PLAY') {
            // Dibujar Player (Placeholder)
            this.ctx.fillStyle = '#0ff';
            this.ctx.beginPath();
            this.ctx.moveTo(this.width/2, this.height - 50);
            this.ctx.lineTo(this.width/2 - 15, this.height - 20);
            this.ctx.lineTo(this.width/2 + 15, this.height - 20);
            this.ctx.fill();
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
