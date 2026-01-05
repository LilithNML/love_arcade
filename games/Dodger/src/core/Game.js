import EconomyManager from '../systems/Economy.js';
import InputHandler from './Input.js';
import AudioController from './Audio.js';
import ThemeManager from './Theme.js'; // NUEVO
import Player from '../entities/Player.js';
import Spawner from '../entities/Spawner.js';
import Starfield from '../entities/Starfield.js'; // NUEVO

export default class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Sistemas
        this.economy = new EconomyManager();
        this.input = new InputHandler();
        this.audio = new AudioController();
        this.theme = new ThemeManager(); // Gestor de Temas
        
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // UI References
        this.uiStart = document.getElementById('startScreen');
        this.uiHUD = document.getElementById('hud');
        this.uiGameOver = document.getElementById('gameOverScreen');
        this.uiPause = document.getElementById('pauseScreen');
        
        this.elScore = document.getElementById('scoreDisplay');
        this.elLevel = document.getElementById('levelDisplay');
        this.elFinalScore = document.getElementById('finalScore');
        this.elCoinsEarned = document.getElementById('coinsEarned');

        // Buttons
        this.btnStart = document.getElementById('startBtn');
        this.btnRestart = document.getElementById('restartBtn');
        this.btnPause = document.getElementById('btnPause');
        this.btnMute = document.getElementById('btnMute');
        this.btnResume = document.getElementById('btnResume');
        this.btnQuit = document.getElementById('btnQuit');

        this.bindEvents();

        this.state = 'MENU';
        this.particles = [];
        this.lastTime = 0;
        this.timeScale = 1.0; // Control de velocidad del tiempo (para Slow-mo)
        
        // Fondo de estrellas inicial
        this.starfield = new Starfield(this.width, this.height);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAY') this.togglePause();
        });
        
        requestAnimationFrame((t) => this.loop(t));
    }

    bindEvents() {
        if(this.btnStart) this.btnStart.onclick = () => this.startGame();
        if(this.btnRestart) this.btnRestart.onclick = () => this.startGame();
        if(this.btnPause) this.btnPause.onclick = () => this.togglePause();
        if(this.btnResume) this.btnResume.onclick = () => this.togglePause();
        if(this.btnQuit) this.btnQuit.onclick = () => this.quitGame();

        if(this.btnMute) {
            this.btnMute.innerText = this.audio.isMuted ? '🔇' : '🔊';
            this.btnMute.onclick = () => {
                const isMuted = this.audio.toggleMute();
                this.btnMute.innerText = isMuted ? '🔇' : '🔊';
                this.btnMute.blur();
            };
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
                if (this.state === 'PLAY' || this.state === 'PAUSE') this.togglePause();
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
            this.btnPause.innerText = '▶';
        } else if (this.state === 'PAUSE') {
            this.state = 'PLAY';
            this.uiPause.classList.add('hidden');
            this.uiPause.classList.remove('flex');
            this.btnPause.innerText = '⏸';
            this.lastTime = performance.now();
        }
    }

    quitGame() {
        this.state = 'MENU';
        this.uiPause.classList.add('hidden');
        this.uiHUD.classList.add('hidden');
        this.uiStart.classList.remove('hidden');
        this.btnPause.innerText = '⏸';
    }

    startGame() {
        this.audio.init();
        this.audio.play('start');
        
        this.state = 'PLAY';
        this.score = 0;
        this.level = 1;
        this.timeScale = 1.0; // Reset velocidad normal
        this.particles = [];
        this.lastTime = performance.now();
        
        // Reset Entidades
        this.player = new Player(this.width, this.height);
        this.spawner = new Spawner(this.width, this.height);
        
        // Reset Tema (Zona 0)
        this.theme = new ThemeManager(); // Reiniciar gestor
        this.applyTheme(this.theme.get()); // Aplicar colores iniciales

        this.uiStart.classList.add('hidden');
        this.uiGameOver.classList.add('hidden'); 
        this.uiHUD.classList.remove('hidden');
        this.uiHUD.classList.add('flex');
        
        this.elScore.innerText = "0";
        this.elLevel.innerText = "1";
        document.body.classList.remove('shake');
    }

    applyTheme(palette) {
        // Propagar paleta a todas las entidades
        this.player.setColor(palette);
        this.spawner.setColor(palette);
        this.starfield.setColor(palette.star);
        // Opcional: Cambiar CSS del borde del HUD o similar
    }

    triggerGameOver() {
        if(this.state === 'DYING' || this.state === 'GAMEOVER') return;

        // Fase 1: Muerte Dramática (Slow Motion)
        this.state = 'DYING'; 
        this.timeScale = 0.1; // Ralentizar el tiempo al 10%
        this.audio.play('crash');
        document.body.classList.add('shake');
        this.createExplosion(this.player.x, this.player.y, this.player.color);

        // Fase 2: Mostrar UI después de 1 segundo (que en slowmo parecerá más)
        setTimeout(() => {
            this.finalizeGameOver();
        }, 800);
    }

    finalizeGameOver() {
        this.state = 'GAMEOVER';
        this.timeScale = 1.0; // Restaurar tiempo para animaciones de UI si las hubiera
        
        const result = this.economy.payout(this.score);

        this.uiHUD.classList.add('hidden');
        this.uiHUD.classList.remove('flex');
        this.uiGameOver.classList.remove('hidden');
        this.uiGameOver.classList.add('flex');
        
        this.elFinalScore.innerText = this.score;
        this.elCoinsEarned.innerText = `+${result.coins}`;
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 30; i++) { // Más partículas
            this.particles.push({
                x: x + 10, y: y + 10,
                vx: (Math.random() - 0.5) * 15, // Más explosivo
                vy: (Math.random() - 0.5) * 15,
                life: 1.0, 
                color: color
            });
        }
    }

    update(dt) {
        // Starfield se actualiza siempre para que el fondo se mueva suave en menús
        // Si estamos muriendo, el fondo también se ralentiza
        this.starfield.update(dt * this.timeScale, this.state === 'DYING' ? 0.1 : 1);

        if (this.state !== 'PLAY' && this.state !== 'DYING') return;
        
        // Multiplicamos dt por timeScale para efecto SlowMo
        const gameDt = dt * this.timeScale;

        if (this.state === 'PLAY') {
            this.score++;
            this.elScore.innerText = this.score;

            // Revisar cambio de tema
            if (this.theme.update(this.score)) {
                this.applyTheme(this.theme.get());
                this.audio.play('levelUp'); // Sonido al cambiar de zona visual
            }
        }

        this.player.update(gameDt, this.input);
        
        const currentLevel = this.spawner.update(gameDt, this.score);
        
        // Solo actualizamos nivel UI si estamos jugando vivo
        if (this.state === 'PLAY' && currentLevel > this.level) {
            this.level = currentLevel;
            // Nota: Ya no usamos el sonido de levelUp aquí si queremos reservarlo para el cambio de zona,
            // o podemos dejarlo. Por ahora lo dejamos para dificultad.
            this.elLevel.innerText = this.level;
        }

        // Colisiones (solo si estamos vivos)
        if (this.state === 'PLAY') {
            if (this.spawner.checkCollision(this.player)) {
                this.triggerGameOver();
            }
        }
    }

    draw() {
        if (this.state === 'PAUSE') return;

        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. Dibujar Fondo (Estrellas)
        this.starfield.draw(this.ctx);

        // 2. Partículas
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            // Las partículas también respetan el slow motion
            p.x += p.vx * this.timeScale; 
            p.y += p.vy * this.timeScale;
            p.life -= 0.03 * this.timeScale; // Mueren más lento en slowmo
            
            this.ctx.save();
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, Math.random() * 3 + 1, 0, Math.PI * 2); // Sparkle size
            this.ctx.fill();
            this.ctx.restore();

            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // 3. Juego
        if (this.state === 'PLAY' || this.state === 'DYING' || (this.state === 'GAMEOVER' && this.particles.length > 0)) {
            // Si estamos muriendo, el jugador parpadea o desaparece
            if (this.state !== 'DYING') this.player.draw(this.ctx);
            
            this.spawner.draw(this.ctx);
        }
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;

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
