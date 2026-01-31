/**
 * LA_MODE_Infinite - Infinite arcade mode
 * Spawns waves of enemies with increasing difficulty
 */

export class LA_MODE_Infinite {
    constructor(game) {
        this.game = game;
        this.config = game.config.waves;
        
        // Wave state
        this.wave = 1;
        this.difficulty = 1;
        this.enemiesKilled = 0;
        this.enemiesPerWave = 10;
        
        // Spawn state
        this.spawnTimer = 0;
        this.spawnInterval = this.config.baseSpawnInterval;
        this.waveTransitionTimer = 0;
        this.isTransitioning = false;
        
        // Boss state
        this.bossSpawned = false;
        this.bossWaves = this.config.bossWaves || [5, 10, 15, 20, 25, 30];
    }
    
    start() {
        this.wave = 1;
        this.difficulty = 1;
        this.enemiesKilled = 0;
        this.enemiesPerWave = 10;
        this.spawnTimer = 1.0; // Start spawning after 1 second
        this.spawnInterval = this.config.baseSpawnInterval;
        this.waveTransitionTimer = 0;
        this.isTransitioning = false;
        this.bossSpawned = false;
    }
    
    update(dt) {
        // Update difficulty based on score
        this.updateDifficulty();
        
        // Handle wave transitions
        if (this.isTransitioning) {
            this.waveTransitionTimer -= dt;
            if (this.waveTransitionTimer <= 0) {
                this.startNextWave();
            }
            return;
        }
        
        // Check if this is a boss wave
        if (this.isBossWave() && !this.bossSpawned) {
            this.spawnBoss();
            this.bossSpawned = true;
            return; // Don't spawn regular enemies during boss wave
        }
        
        // Spawn enemies
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnEnemy();
            this.spawnTimer = this.spawnInterval;
        }
        
        // Random health item spawn (5% chance every 3 seconds)
        if (Math.random() < 0.05 && this.game.powerups.length < 3) {
            this.spawnHealthItem();
        }
    }
    
    isBossWave() {
        return this.bossWaves.includes(this.wave);
    }
    
    updateDifficulty() {
        // Calculate difficulty based on score
        const scoreDifficulty = Math.min(
            1 + this.game.score / 10000,
            this.config.maxDifficulty
        );
        
        this.difficulty = scoreDifficulty;
        
        // Adjust spawn rate based on difficulty
        this.spawnInterval = this.config.baseSpawnInterval / this.difficulty;
        this.spawnInterval = Math.max(0.5, this.spawnInterval); // Minimum 0.5s
    }
    
    spawnEnemy() {
        // Don't spawn if too many enemies on screen
        if (this.game.enemies.length >= 15) return;
        
        // Choose enemy type based on difficulty
        const type = this.chooseEnemyType();
        
        // Random spawn position at top of screen
        const x = 50 + Math.random() * (this.game.viewport.width - 100);
        const y = -30;
        
        // Create enemy
        const enemy = this.game.enemyFactory.createEnemy(type, x, y);
        if (enemy) {
            // Scale HP with difficulty
            enemy.hp *= this.difficulty;
            enemy.maxHp = enemy.hp;
            
            this.game.enemies.push(enemy);
        }
    }
    
    spawnBoss() {
        console.log(`[LA_MODE_INFINITE] Spawning boss for wave ${this.wave}`);
        
        // Spawn at center top
        const x = this.game.viewport.width / 2;
        const y = -50;
        
        const boss = this.game.enemyFactory.createEnemy('boss', x, y);
        if (boss) {
            // Bosses get extra HP based on wave
            const waveMultiplier = 1 + (this.wave / 10);
            boss.hp *= waveMultiplier;
            boss.maxHp = boss.hp;
            
            this.game.enemies.push(boss);
            
            // Show boss notification
            this.game.ui.showNotification('⚠️ ¡JEFE APARECIDO!', 3000);
            this.game.sound.play('milestone'); // Use milestone sound for boss
        }
    }
    
    spawnHealthItem() {
        const x = 50 + Math.random() * (this.game.viewport.width - 100);
        const y = -20;
        
        const item = {
            type: 'health',
            x: x,
            y: y,
            vx: 0,
            vy: 80, // Slow fall
            size: 16,
            healAmount: 5,
            collected: false
        };
        
        this.game.powerups.push(item);
    }
    
    chooseEnemyType() {
        const rand = Math.random();
        
        if (this.difficulty < 1.5) {
            // Early game: mostly scouts
            if (rand < 0.7) return 'scout';
            if (rand < 0.95) return 'shooter';
            return 'tank';
        } else if (this.difficulty < 3) {
            // Mid game: mix of enemies
            if (rand < 0.4) return 'scout';
            if (rand < 0.7) return 'shooter';
            if (rand < 0.9) return 'tank';
            return 'elite';
        } else {
            // Late game: harder enemies
            if (rand < 0.2) return 'scout';
            if (rand < 0.5) return 'shooter';
            if (rand < 0.8) return 'tank';
            return 'elite';
        }
    }
    
    onEnemyKilled(enemy) {
        this.enemiesKilled++;
        
        // If boss killed, complete wave immediately
        if (enemy.type === 'boss') {
            this.completeWave();
            return;
        }
        
        // Check if wave is complete
        if (this.enemiesKilled >= this.enemiesPerWave && !this.isBossWave()) {
            this.completeWave();
        }
    }
    
    completeWave() {
        this.isTransitioning = true;
        this.waveTransitionTimer = this.config.waveTransitionDelay;
        
        // Award wave completion bonus
        const waveBonus = this.game.config.rewards.waveCompletion;
        if (typeof window.GameCenter !== 'undefined' && 
            typeof window.GameCenter.completeLevel === 'function') {
            try {
                window.GameCenter.completeLevel(
                    this.game.config.game.id,
                    `wave_${this.wave}`,
                    waveBonus
                );
            } catch (error) {
                console.error('[LA_MODE_INFINITE] Error awarding wave bonus:', error);
            }
        }
        
        // Show notification
        this.game.ui.showNotification(`¡Oleada ${this.wave} Completada! +${waveBonus} monedas`, 2000);
    }
    
    startNextWave() {
        this.wave++;
        this.enemiesKilled = 0;
        this.enemiesPerWave += 5; // Increase enemies per wave
        this.isTransitioning = false;
        this.bossSpawned = false; // Reset boss flag
        
        // Update UI
        this.game.ui.updateWave(this.wave);
        
        // Show new wave notification
        if (this.isBossWave()) {
            this.game.ui.showNotification(`⚔️ Oleada ${this.wave} - ¡JEFE!`, 2000);
        } else {
            this.game.ui.showNotification(`Oleada ${this.wave}`, 1500);
        }
    }
}
