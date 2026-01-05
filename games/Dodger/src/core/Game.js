import EconomyManager from '../systems/Economy.js';
import InputHandler from './Input.js';
import AudioController from './Audio.js';
import ThemeManager from './Theme.js';
import ResourceManager from './ResourceManager.js';
import SkinManager from './SkinManager.js';
import Player from '../entities/Player.js';
import Spawner from '../entities/Spawner.js';
import Starfield from '../entities/Starfield.js';
import PowerUp from '../entities/PowerUp.js';

export default class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // --- SISTEMAS ---
        this.economy = new EconomyManager();
        this.input = new InputHandler();
        this.audio = new AudioController();
        this.theme = new ThemeManager();
        this.resources = new ResourceManager();
        this.skinManager = new SkinManager();
        
        // --- ESTADO ---
        this.state = 'LOADING'; 
        this.score = 0;
        this.level = 1;
        this.particles = [];
        this.powerups = [];
        this.lastTime = 0;
        
        // Temporizadores de efectos
        this.powerupTimer = 0;
        this.activeEffects = {
            magnet: 0, 
            slow: 0
        };

        // --- UI REFS ---
        this.uiStart = document.getElementById('startScreen');
        this.uiHUD = document.getElementById('hud');
        this.uiGameOver = document.getElementById('gameOverScreen');
        this.uiPause = document.getElementById('pauseScreen');
        this.uiSkins = document.getElementById('skinMenu');
        
        this.elScore = document.getElementById('scoreDisplay');
        this.elLevel = document.getElementById('levelDisplay');
        this.elFinalScore = document.getElementById('finalScore');
        this.elCoinsEarned = document.getElementById('coinsEarned');

        // Botones HUD
        this.btnPause = document.getElementById('btnPause');
        this.btnMute = document.getElementById('btnMute');

        this.bindEvents();
        
        // --- INICIO ASÍNCRONO ---
        // Esperamos a que carguen las imágenes antes de iniciar el loop
        this.resources.loadAll().then(() => {
            this.state = 'MENU';
            this.resize();
            // Creamos el fondo inicial
            this.starfield = new Starfield(this.width, this.height);
            this.loop(0);
        });

        window.addEventListener('resize', () => this.resize());
    }

    bindEvents() {
        // Botones de Pantalla
        document.getElementById('startBtn').onclick = () => this.startGame();
        document.getElementById('restartBtn').onclick = () => this.startGame();
        document.getElementById('btnResume').onclick = () => this.togglePause();
        document.getElementById('btnQuit').onclick = () => this.quitGame();
        
        // Botones de Menú Skins
        document.getElementById('btnSkins').onclick = () => this.openSkinMenu();
        document.getElementById('btnBackSkins').onclick = () => this.closeSkinMenu();

        // Botón Pausa (HUD)
        if(this.btnPause) this.btnPause.onclick = () => this.togglePause();

        // Botón Mute (HUD)
        if(this.btnMute) {
            this.btnMute.innerText = this.audio.isMuted ? '🔇' : '🔊';
            this.btnMute.onclick = () => {
                const isMuted = this.audio.toggleMute();
                this.btnMute.innerText = isMuted ? '🔇' : '🔊';
                this.btnMute.blur();
            };
        }

        // Teclado (Pausa)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
                if (this.state === 'PLAY' || this.state === 'PAUSE') this.togglePause();
            }
        });
        
        // Auto-Pausa al cambiar de pestaña
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAY') this.togglePause();
        });
    }

    // --- MENÚ DE SKINS ---
    openSkinMenu() {
        this.uiStart.classList.add('hidden');
        this.uiSkins.classList.remove('hidden');
        this.uiSkins.classList.add('flex');
        
        const container = document.getElementById('skinsGrid');
        container.innerHTML = '';
        
        const highScore = parseInt(localStorage.getItem('dodger_highscore') || 0);
        const skins = this.skinManager.getUnlockedSkins(highScore);
        const currentId = this.skinManager.getCurrentSkin();

        skins.forEach(skin => {
            const div = document.createElement('div');
            div.className = `p-4 rounded-lg border-2 flex flex-col items-center cursor-pointer transition ${
                skin.locked ? 'border-gray-700 bg-gray-900 opacity-50' : 
                skin.id === currentId ? 'border-blue-500 bg-blue-900/40' : 'border-gray-500 hover:bg-gray-800'
            }`;
            
            // Preview de la nave
            const img = this.resources.get(skin.id);
            if(img) {
                const preview = img.cloneNode();
                preview.style.width = '48px';
                div.appendChild(preview);
            }

            const name = document.createElement('div');
            name.className = 'text-white font-bold mt-2';
            name.innerText = skin.locked ? '???' : skin.name;
            div.appendChild(name);

            const desc = document.createElement('div');
            desc.className = 'text-xs text-gray-400 text-center mt-1';
            desc.innerText = skin.locked ? `Req: ${skin.req} pts` : 'Desbloqueado';
            div.appendChild(desc);

            if (!skin.locked) {
                div.onclick = () => {
                    this.skinManager.selectSkin(skin.id, highScore);
                    this.openSkinMenu(); // Refrescar para actualizar borde azul
                };
            }
            container.appendChild(div);
        });
    }

    closeSkinMenu() {
        this.uiSkins.classList.add('hidden');
        this.uiSkins.classList.remove('flex');
        this.uiStart.classList.remove('hidden');
    }

    // --- LÓGICA CORE ---
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        if(this.player) {
            this.player.gameWidth = this.width;
            this.player.y = this.height - this.player.size - 80;
        }
    }

    startGame() {
        this.audio.init();
        this.audio.play('start');
        
        this.state = 'PLAY';
        this.score = 0;
        this.level = 1;
        this.lastTime = performance.now();
        this.activeEffects = { magnet: 0, slow: 0 };
        this.powerups = [];
        this.particles = [];
        this.powerupTimer = 0;
        
        // 1. Obtener Skin
        const skinKey = this.skinManager.getCurrentSkin();
        const skinImg = this.resources.get(skinKey);
        
        // 2. Inicializar Entidades
        this.player = new Player(this.width, this.height, skinImg);
        this.spawner = new Spawner(this.width, this.height, this.resources);
        
        // 3. Reset Tema
        this.theme = new ThemeManager();
        this.applyTheme(this.theme.get());

        // 4. UI
        this.uiStart.classList.add('hidden');
        this.uiGameOver.classList.add('hidden'); 
        this.uiHUD.classList.remove('hidden');
        this.uiHUD.classList.add('flex');
        
        this.elScore.innerText = "0";
        this.elLevel.innerText = "1";
        document.body.classList.remove('shake');
    }

    applyTheme(palette) {
        this.spawner.setColor(palette);
        this.starfield.setColor(palette.star);
    }

    activatePowerUp(type) {
        this.audio.play('levelUp'); // Sonido feedback
        switch(type) {
            case 'shield': this.player.hasShield = true; break;
            case 'time': this.activeEffects.slow = 5.0; break; // 5 seg slow-mo
            case 'magnet': this.activeEffects.magnet = 8.0; break; // 8 seg imán
            case 'orb': this.score += 100; break; // Puntos extra
        }
    }

    update(dt) {
        // Fondo animado incluso en menú (lento)
        if (this.state !== 'PLAY') {
            this.starfield.update(dt * 0.5); 
            return;
        }

        // --- 1. LÓGICA DE TIEMPO (SLOW MO) ---
        let timeScale = 1.0;
        
        // Sincronizar efectos visuales del jugador con el estado del juego
        this.player.isMagnetActive = (this.activeEffects.magnet > 0);
        this.player.isSlowActive = (this.activeEffects.slow > 0);

        if (this.activeEffects.slow > 0) {
            this.activeEffects.slow -= dt;
            timeScale = 0.5; // El juego corre al 50% de velocidad
        }
        if (this.activeEffects.magnet > 0) {
            this.activeEffects.magnet -= dt;
        }

        const gameDt = dt * timeScale;

        // --- 2. ACTUALIZACIÓN BÁSICA ---
        this.score++;
        this.elScore.innerText = this.score;

        // Tema Dinámico
        if (this.theme.update(this.score)) {
            this.applyTheme(this.theme.get());
            this.audio.play('levelUp');
        }
        
        // Entidades
        this.starfield.update(gameDt);
        this.player.update(gameDt, this.input); // Player usa su propia física, pero recibe input
        
        // Enemigos
        const currentLevel = this.spawner.update(gameDt, this.score);
        if (currentLevel > this.level) {
            this.level = currentLevel;
            this.elLevel.innerText = this.level;
        }

        // --- 3. POWER-UPS ---
        this.powerupTimer += gameDt;
        // Cada 6 segundos intenta crear un powerup
        if (this.powerupTimer > 6) { 
            this.powerupTimer = 0;
            // 40% de probabilidad de spawn
            if (Math.random() < 0.4) { 
                const types = ['shield', 'time', 'magnet', 'orb', 'orb', 'orb'];
                const type = types[Math.floor(Math.random() * types.length)];
                this.powerups.push(new PowerUp(this.width, type, this.resources));
            }
        }

        const isMagnet = this.activeEffects.magnet > 0;
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            let p = this.powerups[i];
            p.update(gameDt, this.player, isMagnet);
            
            // Recoger Powerup
            if (p.checkCollision(this.player)) {
                this.activatePowerUp(p.type);
                this.powerups.splice(i, 1);
            } else if (p.y > this.height) {
                this.powerups.splice(i, 1);
            }
        }

        // --- 4. COLISIONES ---
        if (this.spawner.checkCollision(this.player)) {
            if (this.player.hasShield) {
                // Escudo salva el golpe
                this.player.hasShield = false;
                this.audio.play('levelUp'); 
                // Limpiar pantalla de enemigos cercanos para dar oportunidad
                this.spawner.obstacles = []; 
                this.createExplosion(this.player.x, this.player.y, '#06b6d4'); // Explosión cian
            } else {
                this.triggerGameOver();
            }
        }
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: x + 20, y: y + 20,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 1.0, 
                color: color
            });
        }
    }

    triggerGameOver() {
        this.state = 'GAMEOVER';
        this.audio.play('crash');
        document.body.classList.add('shake');
        this.createExplosion(this.player.x, this.player.y, this.player.color || '#fff');

        // Guardar High Score Local (para skins)
        const currentHigh = parseInt(localStorage.getItem('dodger_highscore') || 0);
        if (this.score > currentHigh) {
            localStorage.setItem('dodger_highscore', this.score);
        }

        // Payout Universal
        const result = this.economy.payout(this.score);

        // UI
        this.uiHUD.classList.add('hidden');
        this.uiHUD.classList.remove('flex');
        this.uiGameOver.classList.remove('hidden');
        this.uiGameOver.classList.add('flex');
        
        this.elFinalScore.innerText = this.score;
        this.elCoinsEarned.innerText = `+${result.coins}`;
    }

    draw() {
        if (this.state === 'LOADING') return;

        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 1. Fondo
        this.starfield.draw(this.ctx);
        
        if (this.state === 'PLAY' || this.state === 'PAUSE' || this.state === 'GAMEOVER') {
            // 2. Enemigos
            this.spawner.draw(this.ctx);
            
            // 3. Powerups
            this.powerups.forEach(p => p.draw(this.ctx));
            
            // 4. Jugador (Si es Game Over, solo dibujamos si hay partículas vivas para ver explosión)
            if (this.state !== 'GAMEOVER') {
                this.player.draw(this.ctx);
            }
        }

        // 5. Partículas (Siempre encima)
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.05;
            
            this.ctx.save();
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, Math.random() * 3 + 1, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();

            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    togglePause() {
        if (this.state === 'PLAY') {
            this.state = 'PAUSE';
            this.uiPause.classList.remove('hidden'); this.uiPause.classList.add('flex');
            if(this.btnPause) this.btnPause.innerText = '▶';
        } else if (this.state === 'PAUSE') {
            this.state = 'PLAY';
            this.uiPause.classList.add('hidden'); this.uiPause.classList.remove('flex');
            if(this.btnPause) this.btnPause.innerText = '⏸';
            this.lastTime = performance.now();
        }
    }

    quitGame() {
        this.state = 'MENU';
        this.uiPause.classList.add('hidden');
        this.uiHUD.classList.add('hidden');
        this.uiStart.classList.remove('hidden');
        if(this.btnPause) this.btnPause.innerText = '⏸';
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
