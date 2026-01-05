import EconomyManager from '../systems/Economy.js';
import InputHandler from './Input.js';
import AudioController from './Audio.js';
import ThemeManager from './Theme.js';
import ResourceManager from './ResourceManager.js'; // NUEVO
import SkinManager from './SkinManager.js';       // NUEVO
import Player from '../entities/Player.js';
import Spawner from '../entities/Spawner.js';
import Starfield from '../entities/Starfield.js';
import PowerUp from '../entities/PowerUp.js';     // NUEVO

export default class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Sistemas Principales
        this.economy = new EconomyManager();
        this.input = new InputHandler();
        this.audio = new AudioController();
        this.theme = new ThemeManager();
        this.resources = new ResourceManager();
        this.skinManager = new SkinManager();
        
        // Estado de Juego
        this.state = 'LOADING'; // Iniciamos cargando
        this.powerups = [];
        this.powerupTimer = 0;
        this.activeEffects = {
            magnet: 0, // Tiempo restante
            slow: 0
        };

        // UI Refs
        this.uiStart = document.getElementById('startScreen');
        this.uiHUD = document.getElementById('hud');
        this.uiGameOver = document.getElementById('gameOverScreen');
        this.uiPause = document.getElementById('pauseScreen');
        this.uiSkins = document.getElementById('skinMenu'); // NUEVO UI
        
        // Bindings UI
        this.bindEvents();
        
        // Iniciar Carga de Assets
        this.resources.loadAll().then(() => {
            this.state = 'MENU';
            this.resize();
            this.starfield = new Starfield(this.width, this.height);
            // Render inicial del menú
            this.loop(0);
        });

        window.addEventListener('resize', () => this.resize());
    }

    bindEvents() {
        // Botones existentes
        document.getElementById('startBtn').onclick = () => this.startGame();
        document.getElementById('restartBtn').onclick = () => this.startGame();
        document.getElementById('btnPause').onclick = () => this.togglePause();
        document.getElementById('btnResume').onclick = () => this.togglePause();
        document.getElementById('btnQuit').onclick = () => this.quitGame();
        
        // Botón Skins
        document.getElementById('btnSkins').onclick = () => this.openSkinMenu();
        document.getElementById('btnBackSkins').onclick = () => this.closeSkinMenu();

        // Mute
        const btnMute = document.getElementById('btnMute');
        btnMute.innerText = this.audio.isMuted ? '🔇' : '🔊';
        btnMute.onclick = () => {
            const isMuted = this.audio.toggleMute();
            btnMute.innerText = isMuted ? '🔇' : '🔊';
            btnMute.blur();
        };

        // Teclado
        window.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
                if (this.state === 'PLAY' || this.state === 'PAUSE') this.togglePause();
            }
        });
    }

    // --- LOGICA DE SKINS ---
    openSkinMenu() {
        this.uiStart.classList.add('hidden');
        this.uiSkins.classList.remove('hidden');
        this.uiSkins.classList.add('flex');
        
        // Generar grid de skins
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
            
            // Imagen del sprite
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
                    this.openSkinMenu(); // Refrescar UI
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

    // --- CORE GAME ---
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
        this.level = 1;
        this.lastTime = performance.now();
        this.activeEffects = { magnet: 0, slow: 0 };
        this.powerups = []; // Limpiar powerups
        
        // Obtener skin seleccionada
        const skinKey = this.skinManager.getCurrentSkin();
        const skinImg = this.resources.get(skinKey);
        
        this.player = new Player(this.width, this.height, skinImg);
        // Spawner ahora necesita los recursos para dibujar asteroides
        this.spawner = new Spawner(this.width, this.height, this.resources);
        
        this.theme = new ThemeManager();
        this.applyTheme(this.theme.get());

        // UI Reset
        this.uiStart.classList.add('hidden');
        this.uiGameOver.classList.add('hidden'); 
        this.uiHUD.classList.remove('hidden');
        this.uiHUD.classList.add('flex');
        
        document.getElementById('scoreDisplay').innerText = "0";
        document.body.classList.remove('shake');
    }

    update(dt) {
        if (this.state !== 'PLAY') {
            this.starfield.update(dt * 0.5); // Fondo lento en menús
            return;
        }

        // 1. Gestión de Efectos de Tiempo (Slow Mo Powerup)
        let timeScale = 1.0;
        if (this.activeEffects.slow > 0) {
            this.activeEffects.slow -= dt;
            timeScale = 0.5; // 50% velocidad
        }
        if (this.activeEffects.magnet > 0) {
            this.activeEffects.magnet -= dt;
        }

        const gameDt = dt * timeScale; // Delta time afectado por slow mo

        // 2. Actualizar Entidades
        this.score++; // Score por tiempo
        document.getElementById('scoreDisplay').innerText = this.score;

        // Tema
        if (this.theme.update(this.score)) {
            this.applyTheme(this.theme.get());
            this.audio.play('levelUp');
        }
        
        this.starfield.update(gameDt);
        this.player.update(gameDt, this.input);
        
        // Spawner y Dificultad
        const currentLevel = this.spawner.update(gameDt, this.score);
        if (currentLevel > this.level) {
            this.level = currentLevel;
            document.getElementById('levelDisplay').innerText = this.level;
        }

        // 3. Generación de PowerUps (Aleatorio)
        this.powerupTimer += gameDt;
        if (this.powerupTimer > 5) { // Intentar cada 5 segundos de juego
            this.powerupTimer = 0;
            if (Math.random() < 0.4) { // 40% chance
                const types = ['shield', 'time', 'magnet', 'orb', 'orb', 'orb']; // Orbs son más comunes
                const type = types[Math.floor(Math.random() * types.length)];
                this.powerups.push(new PowerUp(this.width, type, this.resources));
            }
        }

        // 4. Actualizar Powerups (con lógica de Imán)
        const isMagnet = this.activeEffects.magnet > 0;
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            let p = this.powerups[i];
            p.update(gameDt, this.player, isMagnet);
            
            // Colisión con PowerUp
            if (p.checkCollision(this.player)) {
                this.activatePowerUp(p.type);
                this.powerups.splice(i, 1);
            } else if (p.y > this.height) {
                this.powerups.splice(i, 1);
            }
        }

        // 5. Colisiones con Enemigos
        if (this.spawner.checkCollision(this.player)) {
            if (this.player.hasShield) {
                // Consumir escudo
                this.player.hasShield = false;
                this.audio.play('levelUp'); // Sonido positivo reciclado
                // Limpiar enemigos cercanos para dar respiro
                this.spawner.obstacles = []; 
            } else {
                this.triggerGameOver();
            }
        }
    }

    activatePowerUp(type) {
        this.audio.play('levelUp'); // Sonido de recolección
        switch(type) {
            case 'shield': this.player.hasShield = true; break;
            case 'time': this.activeEffects.slow = 5.0; break; // 5 segudos
            case 'magnet': this.activeEffects.magnet = 8.0; break;
            case 'orb': this.score += 100; break; // Puntos extra
        }
    }

    draw() {
        if (this.state === 'LOADING') return;

        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.starfield.draw(this.ctx);
        
        if (this.state === 'PLAY' || this.state === 'PAUSE') {
            this.spawner.draw(this.ctx);
            // Dibujar Powerups
            this.powerups.forEach(p => p.draw(this.ctx));
            this.player.draw(this.ctx);
        }
    }

    // ... Métodos togglePause, quitGame, triggerGameOver, applyTheme iguales a Fase 2 ...
    // Solo asegúrate de incluir el método applyTheme que faltaba en este snippet:
    applyTheme(palette) {
        // La nave ya tiene su skin propia, solo aplicamos glow o efectos si queremos
        this.spawner.setColor(palette);
        this.starfield.setColor(palette.star);
    }
    
    // Métodos estándar (copiar de Fase 2 si faltan aquí, pero arriba está lo vital)
    togglePause() { /* Igual Fase 2 */ 
        if (this.state === 'PLAY') {
            this.state = 'PAUSE';
            this.uiPause.classList.remove('hidden'); this.uiPause.classList.add('flex');
            document.getElementById('btnPause').innerText = '▶';
        } else if (this.state === 'PAUSE') {
            this.state = 'PLAY';
            this.uiPause.classList.add('hidden'); this.uiPause.classList.remove('flex');
            document.getElementById('btnPause').innerText = '⏸';
            this.lastTime = performance.now();
        }
    }

    quitGame() { /* Igual Fase 2 */ 
        this.state = 'MENU';
        this.uiPause.classList.add('hidden');
        this.uiHUD.classList.add('hidden');
        this.uiStart.classList.remove('hidden');
    }

    triggerGameOver() { /* Igual Fase 2 */
        this.state = 'GAMEOVER';
        this.audio.play('crash');
        document.body.classList.add('shake');
        
        // Guardar High Score localmente para desbloquear skins
        const currentHigh = parseInt(localStorage.getItem('dodger_highscore') || 0);
        if (this.score > currentHigh) {
            localStorage.setItem('dodger_highscore', this.score);
        }

        const result = this.economy.payout(this.score);
        this.uiHUD.classList.add('hidden'); this.uiHUD.classList.remove('flex');
        this.uiGameOver.classList.remove('hidden'); this.uiGameOver.classList.add('flex');
        
        document.getElementById('finalScore').innerText = this.score;
        document.getElementById('coinsEarned').innerText = `+${result.coins}`;
    }

    loop(timestamp) { /* Igual Fase 2 */ 
        if (!this.lastTime) this.lastTime = timestamp;
        if (this.state === 'PAUSE') { this.lastTime = timestamp; requestAnimationFrame((t)=>this.loop(t)); return; }
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); 
        this.lastTime = timestamp;
        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}
