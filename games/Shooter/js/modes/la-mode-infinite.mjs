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
        
        // Spawn enemies
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnEnemy();
            this.spawnTimer = this.spawnInterval;
        }
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
        
        // Check if wave is complete
        if (this.enemiesKilled >= this.enemiesPerWave) {
            this.completeWave();
        }
    }
    
    completeWave() {
        this.isTransitioning = true;
        this.waveTransitionTimer = this.config.waveTransitionDelay;
        
        // Show notification
        this.game.ui.showNotification(`¡Oleada ${this.wave} Completada!`, 2000);
    }
    
    startNextWave() {
        this.wave++;
        this.enemiesKilled = 0;
        this.enemiesPerWave += 5; // Increase enemies per wave
        this.isTransitioning = false;
        
        // Update UI
        this.game.ui.updateWave(this.wave);
        
        // Show new wave notification
        this.game.ui.showNotification(`Oleada ${this.wave}`, 1500);
    }
}
