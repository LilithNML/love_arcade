/**
 * LA_AssetLoader - Asset loading system
 * Loads custom sprites, backgrounds, and skins with fallback to procedural rendering
 */

export class LA_AssetLoader {
    constructor(game) {
        this.game = game;
        
        // Asset storage
        this.enemySprites = {};
        this.backgrounds = {};
        this.playerSkins = {};
        this.bossSprites = {};
        this.bulletSprites = {};
        this.itemSprites = {};
        
        // Loading state
        this.isLoaded = false;
        this.loadProgress = 0;
        this.assetsToLoad = 0;
        this.assetsLoaded = 0;
        
        // Asset configuration
        this.assetConfig = {
            enemies: {
                scout: 'assets/sprites/enemies/scout.png',
                shooter: 'assets/sprites/enemies/shooter.png',
                tank: 'assets/sprites/enemies/tank.png',
                elite: 'assets/sprites/enemies/elite.png'
            },
            bosses: {
                boss1: 'assets/sprites/bosses/boss1.png',
                boss2: 'assets/sprites/bosses/boss2.png',
                boss3: 'assets/sprites/bosses/boss3.png'
            },
            backgrounds: {
                space: 'assets/backgrounds/space.webp',
                nebula: 'assets/backgrounds/nebula.webp',
                stars: 'assets/backgrounds/stars.webp'
            },
            playerSkins: {
                default: 'assets/sprites/player/default.png',
                red: 'assets/sprites/player/red.png',
                blue: 'assets/sprites/player/blue.png',
                gold: 'assets/sprites/player/gold.png'
            },
            bullets: {
                player: 'assets/sprites/bullets/player.png',
                scout: 'assets/sprites/bullets/scout-.png',
                shooter: 'assets/sprites/bullets/shooter-.png',
                tank: 'assets/sprites/bullets/tank-.png',
                elite: 'assets/sprites/bullets/elite-.png',
                boss: 'assets/sprites/bullets/boss-.png'
            },
            items: {
                health: 'assets/sprites/items/health.png'
            }
        };
        
        // Current selections
        this.currentBackground = 'space';
        this.currentPlayerSkin = 'default';
    }
    
    async load() {
        console.log('[LA_ASSET_LOADER] Starting asset load...');
        
        // Count total assets
        this.assetsToLoad = 
            Object.keys(this.assetConfig.enemies).length +
            Object.keys(this.assetConfig.bosses).length +
            Object.keys(this.assetConfig.backgrounds).length +
            Object.keys(this.assetConfig.playerSkins).length +
            Object.keys(this.assetConfig.bullets).length +
            Object.keys(this.assetConfig.items).length;
        
        // Load all asset categories
        await Promise.all([
            this.loadEnemySprites(),
            this.loadBossSprites(),
            this.loadBackgrounds(),
            this.loadPlayerSkins(),
            this.loadBulletSprites(),
            this.loadItemSprites()
        ]);
        
        this.isLoaded = true;
        console.log('[LA_ASSET_LOADER] Asset loading complete:', {
            enemies: Object.keys(this.enemySprites).length,
            bosses: Object.keys(this.bossSprites).length,
            backgrounds: Object.keys(this.backgrounds).length,
            playerSkins: Object.keys(this.playerSkins).length,
            bullets: Object.keys(this.bulletSprites).length,
            items: Object.keys(this.itemSprites).length
        });
    }
    
    async loadEnemySprites() {
        for (const [type, path] of Object.entries(this.assetConfig.enemies)) {
            try {
                const sprite = await this.loadImage(path);
                this.enemySprites[type] = sprite;
                console.log(`[LA_ASSET_LOADER] Loaded enemy sprite: ${type}`);
            } catch (error) {
                console.warn(`[LA_ASSET_LOADER] Failed to load ${type}, using procedural rendering`);
                this.enemySprites[type] = null; // Will use procedural fallback
            }
            this.assetsLoaded++;
            this.updateProgress();
        }
    }
    
    async loadBossSprites() {
        for (const [type, path] of Object.entries(this.assetConfig.bosses)) {
            try {
                const sprite = await this.loadImage(path);
                this.bossSprites[type] = sprite;
                console.log(`[LA_ASSET_LOADER] Loaded boss sprite: ${type}`);
            } catch (error) {
                console.warn(`[LA_ASSET_LOADER] Failed to load ${type}, using procedural rendering`);
                this.bossSprites[type] = null;
            }
            this.assetsLoaded++;
            this.updateProgress();
        }
    }
    
    async loadBackgrounds() {
        for (const [name, path] of Object.entries(this.assetConfig.backgrounds)) {
            try {
                const bg = await this.loadImage(path);
                this.backgrounds[name] = bg;
                console.log(`[LA_ASSET_LOADER] Loaded background: ${name}`);
            } catch (error) {
                console.warn(`[LA_ASSET_LOADER] Failed to load background ${name}, using starfield`);
                this.backgrounds[name] = null;
            }
            this.assetsLoaded++;
            this.updateProgress();
        }
    }
    
    async loadPlayerSkins() {
        for (const [name, path] of Object.entries(this.assetConfig.playerSkins)) {
            try {
                const skin = await this.loadImage(path);
                this.playerSkins[name] = skin;
                console.log(`[LA_ASSET_LOADER] Loaded player skin: ${name}`);
            } catch (error) {
                console.warn(`[LA_ASSET_LOADER] Failed to load skin ${name}, using procedural rendering`);
                this.playerSkins[name] = null;
            }
            this.assetsLoaded++;
            this.updateProgress();
        }
    }
    
    async loadBulletSprites() {
        for (const [type, path] of Object.entries(this.assetConfig.bullets)) {
            try {
                const sprite = await this.loadImage(path);
                this.bulletSprites[type] = sprite;
                console.log(`[LA_ASSET_LOADER] Loaded bullet sprite: ${type}`);
            } catch (error) {
                console.warn(`[LA_ASSET_LOADER] Failed to load bullet ${type}, using procedural rendering`);
                this.bulletSprites[type] = null;
            }
            this.assetsLoaded++;
            this.updateProgress();
        }
    }
    
    async loadItemSprites() {
        for (const [type, path] of Object.entries(this.assetConfig.items)) {
            try {
                const sprite = await this.loadImage(path);
                this.itemSprites[type] = sprite;
                console.log(`[LA_ASSET_LOADER] Loaded item sprite: ${type}`);
            } catch (error) {
                console.warn(`[LA_ASSET_LOADER] Failed to load item ${type}, using procedural rendering`);
                this.itemSprites[type] = null;
            }
            this.assetsLoaded++;
            this.updateProgress();
        }
    }
    
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load: ${src}`));
            img.src = src;
        });
    }
    
    updateProgress() {
        this.loadProgress = this.assetsLoaded / this.assetsToLoad;
    }
    
    // === GETTERS ===
    
    getEnemySprite(type) {
        return this.enemySprites[type] || null;
    }
    
    getBossSprite(type) {
        return this.bossSprites[type] || null;
    }
    
    getCurrentBackground() {
        return this.backgrounds[this.currentBackground] || null;
    }
    
    getCurrentPlayerSkin() {
        return this.playerSkins[this.currentPlayerSkin] || null;
    }
    
    getBulletSprite(type) {
        return this.bulletSprites[type] || null;
    }
    
    getItemSprite(type) {
        return this.itemSprites[type] || null;
    }
    
    setBackground(name) {
        if (this.backgrounds[name] !== undefined) {
            this.currentBackground = name;
        }
    }
    
    setPlayerSkin(name) {
        if (this.playerSkins[name] !== undefined) {
            this.currentPlayerSkin = name;
        }
    }
    
    hasAssets() {
        return Object.keys(this.enemySprites).length > 0 ||
               Object.keys(this.backgrounds).length > 0 ||
               Object.keys(this.playerSkins).length > 0;
    }
}
