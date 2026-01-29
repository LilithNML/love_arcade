/**
 * LA_EnemyFactory - Creates and configures enemy instances
 * Implements different enemy behaviors and AI patterns
 */

export class LA_EnemyFactory {
    constructor(game) {
        this.game = game;
        this.enemyConfigs = game.config.enemies;
    }
    
    createEnemy(type, x, y) {
        const enemy = this.game.pool.getEnemy();
        if (!enemy) {
            console.warn('[LA_ENEMY_FACTORY] No enemy available in pool');
            return null;
        }
        
        const config = this.enemyConfigs[type];
        if (!config) {
            console.error('[LA_ENEMY_FACTORY] Unknown enemy type:', type);
            return null;
        }
        
        // Initialize enemy properties
        enemy.type = type;
        enemy.config = config;
        enemy.x = x;
        enemy.y = y;
        enemy.vx = 0;
        enemy.vy = config.speed;
        enemy.hp = config.hp;
        enemy.maxHp = config.hp;
        enemy.isDead = false;
        enemy.state = 'idle';
        enemy.stateTimer = 0;
        enemy.fireTimer = Math.random() * config.fireRate; // Randomize initial fire
        
        // Bind methods
        enemy.update = this.getUpdateFunction(type).bind(enemy);
        enemy.takeDamage = this.takeDamage.bind(enemy);
        enemy.shootStraight = this.shootStraight.bind(enemy);
        enemy.shootAimedBurst = this.shootAimedBurst.bind(enemy);
        enemy.shootSpread = this.shootSpread.bind(enemy);
        enemy.shootHoming = this.shootHoming.bind(enemy);
        
        return enemy;
    }
    
    getUpdateFunction(type) {
        switch(type) {
            case 'scout':
                return this.updateScout;
            case 'shooter':
                return this.updateShooter;
            case 'tank':
                return this.updateTank;
            case 'elite':
                return this.updateElite;
            default:
                return this.updateScout;
        }
    }
    
    // === ENEMY BEHAVIORS ===
    
    updateScout(dt) {
        const game = this.game || window.la_shooter_game;
        
        // Zigzag movement
        this.stateTimer += dt;
        
        const zigzagFrequency = 3;
        const zigzagAmplitude = 100;
        this.vx = Math.sin(this.stateTimer * zigzagFrequency) * zigzagAmplitude;
        this.vy = this.config.speed;
        
        // Move
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Shoot occasionally
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && this.y > 50 && this.y < game.viewport.height - 200) {
            this.shootStraight(game);
            this.fireTimer = this.config.fireRate + Math.random();
        }
    }
    
    updateShooter(dt) {
        const game = this.game || window.la_shooter_game;
        
        // Slower downward movement with slight wobble
        this.stateTimer += dt;
        this.vx = Math.sin(this.stateTimer * 2) * 30;
        this.vy = this.config.speed;
        
        // Move
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Shoot aimed bursts
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && this.y > 100 && this.y < game.viewport.height - 150) {
            this.shootAimedBurst(game);
            this.fireTimer = this.config.fireRate;
        }
    }
    
    updateTank(dt) {
        const game = this.game || window.la_shooter_game;
        
        // Slow straight movement
        this.vy = this.config.speed;
        this.vx = 0;
        
        // Move
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Shoot spread pattern
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && this.y > 100 && this.y < game.viewport.height - 150) {
            this.shootSpread(game);
            this.fireTimer = this.config.fireRate;
        }
    }
    
    updateElite(dt) {
        const game = this.game || window.la_shooter_game;
        
        // Advanced movement - track player horizontally
        const player = game.player;
        const targetX = player.x;
        const dx = targetX - this.x;
        
        // Smooth horizontal tracking
        const trackSpeed = 150;
        if (Math.abs(dx) > 50) {
            this.vx = Math.sign(dx) * trackSpeed;
        } else {
            this.vx = dx * 2; // Slow down when close
        }
        
        // Downward movement with sine wave
        this.stateTimer += dt;
        this.vy = this.config.speed + Math.sin(this.stateTimer * 2) * 20;
        
        // Move
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Shoot homing pattern
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && this.y > 120 && this.y < game.viewport.height - 150) {
            this.shootHoming(game);
            this.fireTimer = this.config.fireRate;
        }
    }
    
    // === SHOOTING PATTERNS ===
    
    shootStraight(game) {
        const bullet = game.pool.getBullet();
        if (!bullet) return;
        
        bullet.x = this.x;
        bullet.y = this.y + 15;
        bullet.vx = 0;
        bullet.vy = 300;
        bullet.damage = 10;
        bullet.size = 5;
        bullet.isCharged = false;
        
        game.enemyBullets.push(bullet);
    }
    
    shootAimedBurst(game) {
        // Shoot 3 bullets in a small spread aimed at player
        const player = game.player;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const baseAngle = Math.atan2(dy, dx);
        
        const spread = 0.2;
        const angles = [baseAngle - spread, baseAngle, baseAngle + spread];
        
        for (const angle of angles) {
            const bullet = game.pool.getBullet();
            if (!bullet) continue;
            
            const speed = 350;
            bullet.x = this.x;
            bullet.y = this.y + 10;
            bullet.vx = Math.cos(angle) * speed;
            bullet.vy = Math.sin(angle) * speed;
            bullet.damage = 15;
            bullet.size = 5;
            bullet.isCharged = false;
            
            game.enemyBullets.push(bullet);
        }
    }
    
    shootSpread(game) {
        // Shoot 5 bullets in a wide spread
        const bulletCount = 5;
        const spreadAngle = Math.PI / 3; // 60 degrees
        const baseAngle = Math.PI / 2; // Downward
        
        for (let i = 0; i < bulletCount; i++) {
            const bullet = game.pool.getBullet();
            if (!bullet) continue;
            
            const angle = baseAngle + spreadAngle * ((i / (bulletCount - 1)) - 0.5);
            const speed = 300;
            
            bullet.x = this.x;
            bullet.y = this.y + 15;
            bullet.vx = Math.cos(angle) * speed;
            bullet.vy = Math.sin(angle) * speed;
            bullet.damage = 12;
            bullet.size = 6;
            bullet.isCharged = false;
            
            game.enemyBullets.push(bullet);
        }
    }
    
    shootHoming(game) {
        // Shoot 2 bullets that slightly track player
        const player = game.player;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const angle = Math.atan2(dy, dx);
        
        for (let i = 0; i < 2; i++) {
            const bullet = game.pool.getBullet();
            if (!bullet) continue;
            
            const offset = (i === 0 ? -0.15 : 0.15);
            const bulletAngle = angle + offset;
            const speed = 280;
            
            bullet.x = this.x + (i === 0 ? -10 : 10);
            bullet.y = this.y + 12;
            bullet.vx = Math.cos(bulletAngle) * speed;
            bullet.vy = Math.sin(bulletAngle) * speed;
            bullet.damage = 18;
            bullet.size = 6;
            bullet.isCharged = false;
            
            game.enemyBullets.push(bullet);
        }
    }
    
    // === DAMAGE HANDLING ===
    
    takeDamage(amount) {
        this.hp -= amount;
        
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
    }
}
