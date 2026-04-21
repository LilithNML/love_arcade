/**
 * LA_UI - User Interface system
 * Handles HUD updates and overlay screens
 */

export class LA_UI {
    constructor(game) {
        this.game = game;
        
        // HUD elements
        this.lifeValue = document.getElementById('la-shooter-life-value');
        this.scoreValue = document.getElementById('la-shooter-score-value');
        this.multiplierValue = document.getElementById('la-shooter-multiplier');
        this.waveInfo = document.getElementById('la-shooter-wave-info');
        
        // Overlay screens
        this.gameOverScreen = document.getElementById('la-shooter-gameover');
        this.pauseScreen = document.getElementById('la-shooter-pause');
        this.settingsScreen = document.getElementById('la-shooter-settings');
        
        // Game over elements
        this.finalScore = document.getElementById('la-shooter-final-score');
        this.finalWave = document.getElementById('la-shooter-final-wave');
        this.finalCoins = document.getElementById('la-shooter-final-coins');
        this.highscoreContainer = document.getElementById('la-shooter-highscore-container');
        this.newHighscore = document.getElementById('la-shooter-new-highscore');
        
        // Buttons
        this.btnRestart = document.getElementById('la-shooter-btn-restart');
        this.btnResume = document.getElementById('la-shooter-btn-resume');
        this.btnSettings = document.getElementById('la-shooter-btn-settings');
        this.btnCloseSettings = document.getElementById('la-shooter-btn-close-settings');
        
        // Settings
        this.settingAutofire = document.getElementById('la-shooter-setting-autofire');
        this.settingSfx = document.getElementById('la-shooter-setting-sfx');
        this.settingVibration = document.getElementById('la-shooter-setting-vibration');
        this.settingSensitivity = document.getElementById('la-shooter-setting-sensitivity');
        
        this.setupEventListeners();
        
        // Notification system
        this.notifications = [];
    }
    
    setupEventListeners() {
        // Helper para añadir eventos táctiles y de mouse
        const addTouchAndClick = (element, handler) => {
            element.addEventListener('click', handler);
            element.addEventListener('touchend', (e) => {
                e.preventDefault();
                handler(e);
            });
        };
        
        // Restart button
        addTouchAndClick(this.btnRestart, () => {
            this.game.restart();
        });
        
        // Resume button
        addTouchAndClick(this.btnResume, () => {
            this.game.resume();
        });
        
        // Settings buttons
        addTouchAndClick(this.btnSettings, () => {
            this.showSettings();
        });
        
        addTouchAndClick(this.btnCloseSettings, () => {
            this.hideSettings();
        });
        
        // Settings change handlers
        this.settingAutofire.addEventListener('change', (e) => {
            this.game.config.settings.autoFire = e.target.checked;
            this.game.saveSettings();
        });
        
        this.settingSfx.addEventListener('change', (e) => {
            this.game.config.settings.sfx = e.target.checked;
            this.game.saveSettings();
        });
        
        this.settingVibration.addEventListener('change', (e) => {
            this.game.config.settings.vibration = e.target.checked;
            this.game.saveSettings();
        });
        
        this.settingSensitivity.addEventListener('input', (e) => {
            this.game.config.settings.sensitivity = parseFloat(e.target.value);
            this.game.saveSettings();
        });
    }
    
    // === HUD UPDATES ===
    
    updateHealth(health) {
        this.lifeValue.textContent = Math.max(0, Math.floor(health));
        
        // Color based on health
        if (health > 60) {
            this.lifeValue.style.color = '#00ff88';
        } else if (health > 30) {
            this.lifeValue.style.color = '#ffaa00';
        } else {
            this.lifeValue.style.color = '#ff3366';
        }
    }
    
    updateScore(score) {
        this.scoreValue.textContent = Math.floor(score);
    }
    
    updateMultiplier(multiplier) {
        this.multiplierValue.textContent = `x${multiplier.toFixed(1)}`;
        
        // Pulse animation on change
        this.multiplierValue.style.animation = 'none';
        setTimeout(() => {
            this.multiplierValue.style.animation = '';
        }, 10);
    }
    
    updateWave(wave) {
        this.waveInfo.textContent = `Oleada ${wave}`;
    }
    
    // === OVERLAYS ===
    
    showGameOver(score, wave, coins, isNewHighscore) {
        this.finalScore.textContent = Math.floor(score);
        this.finalWave.textContent = wave;
        this.finalCoins.textContent = coins;
        
        if (isNewHighscore) {
            this.highscoreContainer.style.display = 'flex';
            this.newHighscore.textContent = Math.floor(score);
        } else {
            this.highscoreContainer.style.display = 'none';
        }
        
        this.gameOverScreen.style.display = 'flex';
    }
    
    hideGameOver() {
        this.gameOverScreen.style.display = 'none';
    }
    
    showPause() {
        this.pauseScreen.style.display = 'flex';
    }
    
    hidePause() {
        this.pauseScreen.style.display = 'none';
    }
    
    showSettings() {
        this.settingsScreen.style.display = 'flex';
    }
    
    hideSettings() {
        this.settingsScreen.style.display = 'none';
    }
    
    updateSettingsUI(settings) {
        this.settingAutofire.checked = settings.autoFire;
        this.settingSfx.checked = settings.sfx;
        this.settingVibration.checked = settings.vibration;
        this.settingSensitivity.value = settings.sensitivity;
    }
    
    // === NOTIFICATIONS ===
    
    showNotification(message, duration = 3000) {
        const notification = document.createElement('div');
        notification.className = 'la-shooter-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 212, 255, 0.9);
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-size: 1.25rem;
            font-weight: 700;
            z-index: 1000;
            animation: la-shooter-notification-fade 0.3s ease;
            box-shadow: 0 8px 32px rgba(0, 212, 255, 0.4);
            pointer-events: none;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'la-shooter-notification-fade 0.3s ease reverse';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, duration);
    }
    
    // === DASH COOLDOWN INDICATOR ===
    
    setDashCooldown(cooldownPercent) {
        const dashBtn = document.getElementById('la-shooter-btn-dash');
        
        if (cooldownPercent > 0) {
            dashBtn.classList.add('cooldown');
            dashBtn.style.opacity = 0.5 + (cooldownPercent * 0.5);
        } else {
            dashBtn.classList.remove('cooldown');
            dashBtn.style.opacity = 1;
        }
    }
}

// Add notification animation to global styles
const style = document.createElement('style');
style.textContent = `
@keyframes la-shooter-notification-fade {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
`;
document.head.appendChild(style);
