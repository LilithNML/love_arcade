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
        this.floatingTexts = [];
        this.powerups = [];
        this.lastTime = 0;
        
        // Temporizadores
        this.powerupTimer = 0;
        this.magnetSpawnTimer = 0;
        
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

        this.btnPause = document.getElementById('btnPause');
        this.btnMute = document.getElementById('btnMute');

        this.bindEvents();
        
        // --- INICIO ASÍNCRONO ---
        this.resources.loadAll().then(() => {
            this.state = 'MENU';
            this.resize();
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
        
        // CORRECCIÓN: QuitGame ahora sirve tanto para Pausa como para Game Over
        document.getElementById('btnQuit').onclick = () => this.quitGame();
        document.getElementById('btnGoHome').onclick = () => this.quitGame();
        
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

        // Teclado
        window.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
                if (this.state === 'PLAY' || this.state === 'PAUSE') this.togglePause();
            }
        });
        
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
                    this.openSkinMenu();
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
        this.floatingTexts = [];
        this.powerupTimer = 0;
        this.magnetSpawnTimer = 0;
        
        const skinKey = this.skinManager.getCurrentSkin();
        const skinImg = this.resources.get(skinKey);
        
        this.player = new Player(this.width, this.height, skinImg);
        this.spawner = new Spawner(this.width, this.height, this.resources);
        
        this.theme = new ThemeManager();
        this.applyTheme(this.theme.get());

        // Ocultar todas las pantallas excepto HUD
        this.uiStart.classList.add('hidden');
        this.uiGameOver.classList.add('hidden'); 
        this.uiGameOver.classList.remove('flex'); // Asegurar quitar flex
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
        this.audio.play('levelUp'); 
        let text = "";
        let color = "#fff";

        switch(type) {
            case 'shield': 
                this.player.hasShield = true; 
                text = "SHIELD UP!";
                color = "#06b6d4";
                break;
            case 'time': 
                this.activeEffects.slow = 5.0; 
                text = "SLOW MO";
                color = "#a855f7";
                break;
            case 'magnet': 
                this.activeEffects.magnet = 8.0; 
                text = "MAGNET ACTIVE";
                color = "#f59e0b";
                break;
            case 'orb': 
                this.score += 100; 
                text = "+100";
                color = "#facc15";
                break;
        }

        this.floatingTexts.push({
            x: this.player.x + 20,
            y: this.player.y,
            text: text,
            color: color,
            life: 1.0, 
            vy: -50 
        });
    }

    update(dt) {
        if (this.state !== 'PLAY') {
            this.starfield.update(dt * 0.5); 
            return;
        }

        let timeScale = 1.0;
        this.player.isMagnetActive = (this.activeEffects.magnet > 0);
        this.player.isSlowActive = (this.activeEffects.slow > 0);

        if (this.activeEffects.slow > 0) {
            this.activeEffects.slow -= dt;
            timeScale = 0.5; 
        }
        if (this.activeEffects.magnet > 0) {
            this.activeEffects.magnet -= dt;
        }

        const gameDt = dt * timeScale;

        // Imán Buff
        if (this.activeEffects.magnet > 0) {
            this.magnetSpawnTimer += gameDt;
            if (this.magnetSpawnTimer > 0.4) { 
                this.magnetSpawnTimer = 0;
                this.powerups.push(new PowerUp(this.width, 'orb', this.resources));
            }
        }

        this.score++;
        this.elScore.innerText = this.score;

        if (this.theme.update(this.score)) {
            this.applyTheme(this.theme.get());
            this.audio.play('levelUp');
        }
        
        this.starfield.update(gameDt);
        this.player.update(gameDt, this.input);
        
        const currentLevel = this.spawner.update(gameDt, this.score);
        if (currentLevel > this.level) {
            this.level = currentLevel;
            this.elLevel.innerText = this.level;
        }

        this.powerupTimer += gameDt;
        if (this.powerupTimer > 6) { 
            this.powerupTimer = 0;
            if (Math.random() < 0.4) { 
                const types = ['shield', 'time', 'magnet', 'orb', 'orb'];
                const type = types[Math.floor(Math.random() * types.length)];
                this.powerups.push(new PowerUp(this.width, type, this.resources));
            }
        }

        const isMagnet = this.activeEffects.magnet > 0;
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            let p = this.powerups[i];
            p.update(gameDt, this.player, isMagnet);
            if (p.checkCollision(this.player)) {
                this.activatePowerUp(p.type);
                this.powerups.splice(i, 1);
            } else if (p.y > this.height) {
                this.powerups.splice(i, 1);
            }
        }

        if (this.spawner.checkCollision(this.player)) {
            if (this.player.hasShield) {
                this.player.hasShield = false;
                this.audio.play('levelUp'); 
                this.spawner.obstacles = []; 
                this.createExplosion(this.player.x, this.player.y, '#06b6d4');
                this.floatingTexts.push({
                    x: this.player.x, y: this.player.y,
                    text: "BLOCKED!", color: "#06b6d4", life: 1.0, vy: -50
                });
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
                life: 1.0, color: color
            });
        }
    }

    triggerGameOver() {
        this.state = 'GAMEOVER';
        this.audio.play('crash');
        document.body.classList.add('shake');
        this.createExplosion(this.player.x, this.player.y, this.player.color || '#fff');
        const currentHigh = parseInt(localStorage.getItem('dodger_highscore') || 0);
        if (this.score > currentHigh) { localStorage.setItem('dodger_highscore', this.score); }
        const result = this.economy.payout(this.score);
        
        // Mostrar UI Game Over
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
        this.starfield.draw(this.ctx);
        
        if (this.state === 'PLAY' || this.state === 'PAUSE' || this.state === 'GAMEOVER') {
            this.spawner.draw(this.ctx);
            this.powerups.forEach(p => p.draw(this.ctx));
            if (this.state !== 'GAMEOVER') this.player.draw(this.ctx);
        }

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

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            let t = this.floatingTexts[i];
            t.y += t.vy * 0.016; 
            t.life -= 0.016;
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, t.life); 
            this.ctx.fillStyle = t.color;
            this.ctx.shadowColor = t.color;
            this.ctx.shadowBlur = 5;
            this.ctx.font = "bold 20px 'Courier New'";
            this.ctx.textAlign = "center";
            this.ctx.fillText(t.text, t.x, t.y);
            this.ctx.restore();
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
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

    // --- CORRECCIÓN FINAL: quitGame ---
    // Esta función limpia toda la UI y vuelve al StartScreen
    quitGame() {
        this.state = 'MENU';
        
        // Ocultar todas las pantallas posibles
        this.uiPause.classList.add('hidden');
        this.uiPause.classList.remove('flex');
        
        this.uiHUD.classList.add('hidden');
        this.uiHUD.classList.remove('flex');
        
        this.uiGameOver.classList.add('hidden'); // CRÍTICO: Antes faltaba esto
        this.uiGameOver.classList.remove('flex'); // CRÍTICO
        
        // Mostrar Inicio
        this.uiStart.classList.remove('hidden');
        
        if(this.btnPause) this.btnPause.innerText = '⏸';
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        if (this.state === 'PAUSE') { this.lastTime = timestamp; requestAnimationFrame((t)=>this.loop(t)); return; }
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); 
        this.lastTime = timestamp;
        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}
