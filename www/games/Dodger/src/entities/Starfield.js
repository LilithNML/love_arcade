export default class Starfield {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.stars = [];
        this.baseSpeed = 100; // Velocidad base del scroll
        this.color = '#94a3b8'; // Color inicial
        
        // Crear 100 estrellas
        for(let i=0; i<100; i++) {
            this.stars.push(this.createStar());
        }
    }

    createStar() {
        return {
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            size: Math.random() * 2 + 0.5, // 0.5px a 2.5px
            speedFactor: Math.random() * 0.8 + 0.2, // Parallax: algunas son más lentas (lejanas)
            alpha: Math.random() // Brillo variable
        };
    }

    setColor(hexColor) {
        this.color = hexColor;
    }

    update(dt, speedMultiplier = 1) {
        const speed = this.baseSpeed * speedMultiplier;

        this.stars.forEach(star => {
            // Mover estrella hacia abajo
            star.y += speed * star.speedFactor * dt;

            // Twinkle effect (parpadeo suave)
            star.alpha += (Math.random() - 0.5) * 2 * dt;
            if (star.alpha > 1) star.alpha = 1;
            if (star.alpha < 0.3) star.alpha = 0.3;

            // Loop infinito
            if (star.y > this.height) {
                star.y = 0;
                star.x = Math.random() * this.width;
            }
        });
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        
        this.stars.forEach(star => {
            ctx.globalAlpha = star.alpha;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();
    }
}
