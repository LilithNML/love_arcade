/**
 * LA_CORE_Pool - Object pooling for performance
 * Reduces garbage collection by reusing objects
 */

export class LA_CORE_Pool {
    constructor(game) {
        this.game = game;
        
        // Pools
        this.bulletPool = [];
        this.enemyPool = [];
        this.particlePool = [];
        
        // Pre-allocate pools
        this.preallocate();
    }
    
    preallocate() {
        // Pre-create bullets
        for (let i = 0; i < this.game.config.game.maxBullets; i++) {
            this.bulletPool.push(this.createBullet());
        }
        
        // Pre-create particles
        for (let i = 0; i < this.game.config.particles.poolSize; i++) {
            this.particlePool.push(this.createParticle());
        }
        
        console.log('[LA_SHOOTER_POOL] Preallocated:', {
            bullets: this.bulletPool.length,
            particles: this.particlePool.length
        });
    }
    
    // === BULLETS ===
    
    createBullet() {
        return {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            damage: 0,
            size: 0,
            isCharged: false,
            inUse: false
        };
    }
    
    getBullet() {
        for (const bullet of this.bulletPool) {
            if (!bullet.inUse) {
                bullet.inUse = true;
                return bullet;
            }
        }
        
        // Pool exhausted, create new (shouldn't happen often)
        console.warn('[LA_SHOOTER_POOL] Bullet pool exhausted, creating new');
        const bullet = this.createBullet();
        bullet.inUse = true;
        this.bulletPool.push(bullet);
        return bullet;
    }
    
    releaseBullet(bullet) {
        bullet.inUse = false;
    }
    
    // === ENEMIES ===
    
    createEnemy() {
        return {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            type: '',
            hp: 0,
            maxHp: 0,
            config: null,
            state: 'idle',
            stateTimer: 0,
            fireTimer: 0,
            isDead: false,
            inUse: false,
            update: null,
            takeDamage: null
        };
    }
    
    getEnemy() {
        for (const enemy of this.enemyPool) {
            if (!enemy.inUse) {
                enemy.inUse = true;
                enemy.isDead = false;
                return enemy;
            }
        }
        
        // Pool exhausted, create new
        const enemy = this.createEnemy();
        enemy.inUse = true;
        this.enemyPool.push(enemy);
        return enemy;
    }
    
    releaseEnemy(enemy) {
        enemy.inUse = false;
        enemy.isDead = true;
    }
    
    // === PARTICLES ===
    
    createParticle() {
        return {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            color: '#ffffff',
            size: 1,
            life: 0,
            maxLife: 1,
            alpha: 1,
            inUse: false
        };
    }
    
    getParticle() {
        for (const particle of this.particlePool) {
            if (!particle.inUse) {
                particle.inUse = true;
                return particle;
            }
        }
        
        // Pool exhausted
        return null;
    }
    
    releaseParticle(particle) {
        particle.inUse = false;
    }
    
    // === STATS ===
    
    getStats() {
        return {
            bullets: {
                total: this.bulletPool.length,
                inUse: this.bulletPool.filter(b => b.inUse).length
            },
            enemies: {
                total: this.enemyPool.length,
                inUse: this.enemyPool.filter(e => e.inUse).length
            },
            particles: {
                total: this.particlePool.length,
                inUse: this.particlePool.filter(p => p.inUse).length
            }
        };
    }
}
