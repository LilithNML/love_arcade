import EconomyManager from '../systems/Economy.js';

export default class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        // Aquí es donde fallaba antes debido al error en Economy.js
        this.economy = new EconomyManager();
        
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.state = 'MENU'; 
        this.score = 0; 
        this.lastTime = 0;
        this.startTime = 0;
        
        // Referencias UI
        this.uiMenu = document.getElementById('mainMenu');
        this.uiScore = document.getElementById('scoreDisplay');
        this.uiHud = document.getElementById('hud');
        this.btnPlay = document.getElementById('btnPlay');
        this.menuTitle = document.getElementById('menuTitle');
        this.menuSubtitle = document.getElementById('menuSubtitle');

        // Event Listeners
        if (this.btnPlay) {
            this.btnPlay.addEventListener('click', () => this.startRun());
        } else {
            console.error("No se encontró el botón JUGAR en el HTML");
        }
        
        // Iniciar Loop
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
        
        this.uiMenu.classList.remove('active');
        this.uiHud.style.display = 'block';
    }

    gameOver() {
        this.state = 'GAMEOVER';
        const finalTime = Math.floor((Date.now() - this.startTime) / 1000);
        
        const result = this.economy.payout(finalTime);
        
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
        const currentSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        if (this.uiScore) this.uiScore.innerText = currentSeconds;
    }

    draw() {
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.state === 'PLAY') {
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
