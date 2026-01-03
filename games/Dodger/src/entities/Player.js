export default class Player {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.width = 30;
        this.height = 30;
        
        // Posición inicial (centro abajo)
        this.x = gameWidth / 2 - this.width / 2;
        this.y = gameHeight - 100;
        
        this.speed = 400; // Píxeles por segundo
    }

    update(dt, input) {
        // Movimiento
        if (input.keys.left) {
            this.x -= this.speed * dt;
        }
        if (input.keys.right) {
            this.x += this.speed * dt;
        }

        // Límites de pantalla
        if (this.x < 0) this.x = 0;
        if (this.x > this.gameWidth - this.width) this.x = this.gameWidth - this.width;
    }

    draw(ctx) {
        // Dibujamos una nave simple (Triángulo)
        ctx.fillStyle = '#0ff'; // Cian Neón
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y); // Punta
        ctx.lineTo(this.x, this.y + this.height); // Izq
        ctx.lineTo(this.x + this.width, this.y + this.height); // Der
        ctx.closePath();
        ctx.fill();

        // Efecto simple de motor
        ctx.fillStyle = '#f0f';
        ctx.fillRect(this.x + 10, this.y + this.height, 10, 5);
    }
}
