/**
 * Love Arcade Shooter - Main Bootstrap
 * Entry point that initializes all game modules
 */

import { LA_CORE_Loop } from './core/la-core-loop.mjs';
import { LA_CORE_Renderer } from './core/la-core-renderer.mjs';
import { LA_CORE_Input } from './core/la-core-input.mjs';
import { LA_CORE_Pool } from './core/la-core-pool.mjs';
import { LA_UI } from './systems/la-ui.mjs';
import { LA_Sound } from './systems/la-sound.mjs';
import { LA_Player } from './entities/la-player.mjs';
import { LA_EnemyFactory } from './entities/la-enemy-factory.mjs';
import { LA_MODE_Infinite } from './modes/la-mode-infinite.mjs';

// Global game instance (read-only public access)
window.la_shooter_game = null;

class LA_SHOOTER_Game {
    constructor() {
        this.config = null;
        this.canvas = null;
        this.ctx = null;
        this.isRunning = false;
        this.isPaused = false;
        this.isGameOver = false;
        
        // Core systems
        this.loop = null;
        this.renderer = null;
        this.input = null;
        this.pool = null;
        this.ui = null;
        this.sound = null;
        
        // Game entities
        this.player = null;
        this.enemyFactory = null;
        this.mode = null;
        
        // Game state
        this.score = 0;
        this.wave = 1;
        this.multiplier = 1;
        this.multiplierTimer = 0;
        this.coins = 0;
        this.achievedMilestones = new Set();
        
        // Entity collections
        this.playerBullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.particles = [];
        this.powerups = [];
    }
    
    async init() {
        try {
            // Load configuration
            const response = await fetch('./js/config/la-config.json');
            this.config = await response.json();
            
            // Setup canvas
            this.canvas = document.getElementById('la-shooter-canvas');
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            
            // Initialize core systems
            this.loop = new LA_CORE_Loop(this);
            this.renderer = new LA_CORE_Renderer(this);
            this.input = new LA_CORE_Input(this);
            this.pool = new LA_CORE_Pool(this);
            this.ui = new LA_UI(this);
            this.sound = new LA_Sound(this);
            
            // Initialize game entities
            this.player = new LA_Player(this);
            this.enemyFactory = new LA_EnemyFactory(this);
            this.mode = new LA_MODE_Infinite(this);
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load settings
            this.loadSettings();
            
            // Hide loading screen
            document.getElementById('la-shooter-loading').style.display = 'none';
            
            // Start game
            this.start();
            
        } catch (error) {
            console.error('[LA_SHOOTER] Initialization error:', error);
            alert('Error al cargar el juego. Por favor, recarga la página.');
        }
    }
    
    setupEventListeners() {
        // Resize handler
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Visibility change (pause when tab not visible)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRunning && !this.isPaused) {
                this.pause();
            }
        });
        
        // Keyboard for desktop
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
                if (this.isGameOver) return;
                this.isPaused ? this.resume() : this.pause();
            }
        });
    }
    
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Store viewport dimensions
        this.viewport = {
            width: rect.width,
            height: rect.height
        };
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('la_shooter_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.config.settings = { ...this.config.settings, ...settings };
                this.ui.updateSettingsUI(settings);
            }
        } catch (e) {
            console.warn('[LA_SHOOTER] Could not load settings:', e);
        }
    }
    
    saveSettings() {
        try {
            localStorage.setItem('la_shooter_settings', JSON.stringify(this.config.settings));
        } catch (e) {
            console.warn('[LA_SHOOTER] Could not save settings:', e);
        }
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this.isGameOver = false;
        
        // Reset game state
        this.score = 0;
        this.wave = 1;
        this.multiplier = 1;
        this.multiplierTimer = 0;
        this.coins = 0;
        this.achievedMilestones.clear();
        
        // Reset entities
        this.playerBullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.particles = [];
        this.powerups = [];
        
        // Reset player
        this.player.reset();
        
        // Start mode
        this.mode.start();
        
        // Start game loop
        this.loop.start();
        
        // Update UI
        this.ui.updateScore(0);
        this.ui.updateWave(1);
        this.ui.updateHealth(this.player.health);
    }
    
    pause() {
        if (!this.isRunning || this.isPaused || this.isGameOver) return;
        
        this.isPaused = true;
        this.ui.showPause();
    }
    
    resume() {
        if (!this.isRunning || !this.isPaused) return;
        
        this.isPaused = false;
        this.ui.hidePause();
    }
    
    restart() {
        this.isRunning = false;
        this.isPaused = false;
        this.isGameOver = false;
        this.ui.hideGameOver();
        this.start();
    }
    
    gameOver() {
        if (this.isGameOver) return;
        
        this.isGameOver = true;
        this.isRunning = false;
        
        // Calculate final coins
        const finalCoins = Math.floor(this.score / this.config.rewards.scoreToCoins);
        this.coins = finalCoins;
        
        // Check and save highscore
        const isNewHighscore = this.checkHighscore();
        
        // Award coins to Love Arcade system
        this.awardCoins(finalCoins);
        
        // Show game over screen
        this.ui.showGameOver(this.score, this.wave, finalCoins, isNewHighscore);
        
        // Play sound
        this.sound.play('gameOver');
    }
    
    checkHighscore() {
        try {
            const saved = localStorage.getItem('la_shooter_highscore');
            const highscore = saved ? parseInt(saved) : 0;
            
            if (this.score > highscore) {
                localStorage.setItem('la_shooter_highscore', this.score.toString());
                return true;
            }
            return false;
        } catch (e) {
            console.warn('[LA_SHOOTER] Could not check highscore:', e);
            return false;
        }
    }
    
    awardCoins(amount) {
        // Integration with Love Arcade GameCenter
        // Following the technical documentation requirements
        if (typeof window.GameCenter !== 'undefined' && 
            typeof window.GameCenter.completeLevel === 'function') {
            
            try {
                const result = window.GameCenter.completeLevel(
                    this.config.game.id,
                    `final_score_${this.score}`,
                    amount
                );
                
                console.log('[LA_SHOOTER] Coins awarded to GameCenter:', result);
            } catch (error) {
                console.error('[LA_SHOOTER] Error awarding coins:', error);
            }
        } else {
            console.warn('[LA_SHOOTER] GameCenter not available (standalone mode)');
        }
    }
    
    checkMilestone(score) {
        // Check if any milestone was reached
        for (const milestone of this.config.rewards.milestones) {
            if (score >= milestone.score && !this.achievedMilestones.has(milestone.id)) {
                this.achievedMilestones.add(milestone.id);
                this.awardMilestoneCoins(milestone);
            }
        }
    }
    
    awardMilestoneCoins(milestone) {
        // Award milestone coins to Love Arcade system
        if (typeof window.GameCenter !== 'undefined' && 
            typeof window.GameCenter.completeLevel === 'function') {
            
            try {
                const result = window.GameCenter.completeLevel(
                    this.config.game.id,
                    milestone.id,
                    milestone.coins
                );
                
                // Show notification
                this.ui.showNotification(`¡Hito alcanzado! +${milestone.coins} monedas`);
                this.sound.play('milestone');
                
                console.log('[LA_SHOOTER] Milestone coins awarded:', result);
            } catch (error) {
                console.error('[LA_SHOOTER] Error awarding milestone coins:', error);
            }
        }
    }
    
    addScore(points) {
        this.score += points * this.multiplier;
        this.multiplierTimer = 3.0; // Reset multiplier timer
        this.ui.updateScore(this.score);
        
        // Check for milestones
        this.checkMilestone(this.score);
    }
    
    increaseMultiplier() {
        this.multiplier = Math.min(this.multiplier + 0.5, 8);
        this.ui.updateMultiplier(this.multiplier);
    }
    
    resetMultiplier() {
        this.multiplier = 1;
        this.ui.updateMultiplier(this.multiplier);
    }
    
    update(dt) {
        if (this.isPaused || this.isGameOver) return;
        
        // Update multiplier timer
        if (this.multiplierTimer > 0) {
            this.multiplierTimer -= dt;
            if (this.multiplierTimer <= 0) {
                this.resetMultiplier();
            }
        }
        
        // Update player
        this.player.update(dt);
        
        // Update mode (spawning, waves, etc)
        this.mode.update(dt);
        
        // Update bullets
        this.updateBullets(dt);
        
        // Update enemies
        this.updateEnemies(dt);
        
        // Update particles
        this.updateParticles(dt);
        
        // Check collisions
        this.checkCollisions();
    }
    
    updateBullets(dt) {
        // Update player bullets
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const bullet = this.playerBullets[i];
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            
            // Remove if out of bounds
            if (this.isOutOfBounds(bullet)) {
                this.playerBullets.splice(i, 1);
                this.pool.releaseBullet(bullet);
            }
        }
        
        // Update enemy bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            
            // Remove if out of bounds
            if (this.isOutOfBounds(bullet)) {
                this.enemyBullets.splice(i, 1);
                this.pool.releaseBullet(bullet);
            }
        }
    }
    
    updateEnemies(dt) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(dt);
            
            // Remove if dead or out of bounds
            if (enemy.isDead || this.isOutOfBounds(enemy, 100)) {
                this.enemies.splice(i, 1);
                this.pool.releaseEnemy(enemy);
            }
        }
    }
    
    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.life -= dt;
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.alpha = particle.life / particle.maxLife;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
                this.pool.releaseParticle(particle);
            }
        }
    }
    
    checkCollisions() {
        // Player bullets vs enemies
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const bullet = this.playerBullets[i];
            
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                
                if (this.circleCollision(bullet, enemy, bullet.size, enemy.config.collisionRadius)) {
                    // Damage enemy
                    enemy.takeDamage(bullet.damage);
                    
                    // Create impact particles
                    this.createExplosion(bullet.x, bullet.y, 5, '#00d4ff');
                    
                    // Remove bullet
                    this.playerBullets.splice(i, 1);
                    this.pool.releaseBullet(bullet);
                    
                    // Check if enemy died
                    if (enemy.isDead) {
                        this.onEnemyKilled(enemy);
                    }
                    
                    break;
                }
            }
        }
        
        // Enemy bullets vs player
        if (!this.player.isInvincible) {
            for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
                const bullet = this.enemyBullets[i];
                
                if (this.circleCollision(bullet, this.player, bullet.size, this.player.config.collisionRadius)) {
                    // Damage player
                    this.player.takeDamage(bullet.damage);
                    
                    // Create impact particles
                    this.createExplosion(bullet.x, bullet.y, 5, '#ff3366');
                    
                    // Remove bullet
                    this.enemyBullets.splice(i, 1);
                    this.pool.releaseBullet(bullet);
                    
                    // Vibrate if enabled
                    if (this.config.settings.vibration && navigator.vibrate) {
                        navigator.vibrate(100);
                    }
                }
            }
        }
        
        // Enemies vs player
        if (!this.player.isInvincible) {
            for (const enemy of this.enemies) {
                if (this.circleCollision(enemy, this.player, enemy.config.collisionRadius, this.player.config.collisionRadius)) {
                    // Damage player
                    this.player.takeDamage(20);
                    
                    // Damage enemy
                    enemy.takeDamage(999);
                    
                    // Create explosion
                    this.createExplosion(enemy.x, enemy.y, 10, '#ff6600');
                    
                    // Vibrate if enabled
                    if (this.config.settings.vibration && navigator.vibrate) {
                        navigator.vibrate([50, 50, 100]);
                    }
                }
            }
        }
    }
    
    circleCollision(a, b, radiusA, radiusB) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < radiusA + radiusB;
    }
    
    isOutOfBounds(obj, margin = 0) {
        return obj.x < -margin || 
               obj.x > this.viewport.width + margin || 
               obj.y < -margin || 
               obj.y > this.viewport.height + margin;
    }
    
    onEnemyKilled(enemy) {
        // Add score
        this.addScore(enemy.config.score);
        
        // Increase multiplier
        this.increaseMultiplier();
        
        // Create death explosion
        this.createExplosion(enemy.x, enemy.y, 15, '#ff00aa');
        
        // Play sound
        this.sound.play('enemyDeath');
        
        // Notify mode
        this.mode.onEnemyKilled(enemy);
    }
    
    createExplosion(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const particle = this.pool.getParticle();
            if (!particle) break;
            
            const angle = (Math.PI * 2 * i) / count;
            const speed = 100 + Math.random() * 100;
            
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.color = color;
            particle.size = 2 + Math.random() * 3;
            particle.maxLife = 0.3 + Math.random() * 0.7;
            particle.life = particle.maxLife;
            particle.alpha = 1;
            
            this.particles.push(particle);
        }
    }
    
    draw() {
        // Clear canvas
        this.renderer.clear();
        
        // Draw starfield background
        this.renderer.drawStarfield();
        
        // Draw particles
        for (const particle of this.particles) {
            this.renderer.drawParticle(particle);
        }
        
        // Draw bullets
        for (const bullet of this.playerBullets) {
            this.renderer.drawPlayerBullet(bullet);
        }
        for (const bullet of this.enemyBullets) {
            this.renderer.drawEnemyBullet(bullet);
        }
        
        // Draw enemies
        for (const enemy of this.enemies) {
            this.renderer.drawEnemy(enemy);
        }
        
        // Draw player
        this.renderer.drawPlayer(this.player);
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[LA_SHOOTER] Initializing game...');
    
    const game = new LA_SHOOTER_Game();
    window.la_shooter_game = game;
    
    await game.init();
});
