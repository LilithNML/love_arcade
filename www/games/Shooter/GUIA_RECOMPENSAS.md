# Guía Completa del Sistema de Recompensas - Space Shooter

## Ubicación del Archivo

**Archivo principal de configuración:**
```
games/Shooter/js/config/la-config.json
```

---

## Parámetros de Recompensas

### 1. **Monedas por Enemigo** (`enemies.*.coins`)

Ubicación: `config.enemies.[tipo].coins`

**Qué hace:**
- Define cuántas monedas otorga cada tipo de enemigo al ser eliminado
- Se aplica **inmediatamente** cuando el enemigo muere
- **NO depende** del score, es una recompensa directa

**Valores de ejemplo:**
```json
"enemies": {
  "scout": { "coins": 8 },      // Enemigo básico
  "shooter": { "coins": 20 },   // Enemigo medio
  "tank": { "coins": 40 },      // Enemigo tanque
  "elite": { "coins": 80 },     // Enemigo élite
  "boss": { "coins": 400 }      // Jefe
}
```

**Para DISMINUIR recompensas:**
```json
"scout": { "coins": 1 },    // Muy bajo
"shooter": { "coins": 2 },
"tank": { "coins": 5 },
"elite": { "coins": 10 },
"boss": { "coins": 50 }
```

**Para AUMENTAR recompensas:**
```json
"scout": { "coins": 20 },   // Muy generoso
"shooter": { "coins": 50 },
"tank": { "coins": 100 },
"elite": { "coins": 200 },
"boss": { "coins": 1000 }
```

---

### 2. **Ratio Score → Monedas** (`rewards.scoreToCoins`)

Ubicación: `config.rewards.scoreToCoins`

**Qué hace:**
- Convierte puntuación acumulada en monedas al final de la partida
- Fórmula: `monedas_finales = score_total / scoreToCoins`
- Se calcula **solo al morir** (Game Over)

**Valor de ejemplo:**
```json
"rewards": {
  "scoreToCoins": 12
}
```
Significa: Cada **12 puntos** = 1 moneda

**Ejemplos:**
- Score 1,200 → 1,200 ÷ 12 = **100 monedas**
- Score 12,000 → 12,000 ÷ 12 = **1,000 monedas**

**Para DISMINUIR recompensas:**
```json
"scoreToCoins": 100   // Cada 100 pts = 1 moneda (muy bajo)
"scoreToCoins": 50    // Cada 50 pts = 1 moneda (bajo)
```

**Para AUMENTAR recompensas:**
```json
"scoreToCoins": 5     // Cada 5 pts = 1 moneda (alto)
"scoreToCoins": 1     // Cada 1 pt = 1 moneda (muy alto)
```

**Tabla de referencia:**
| scoreToCoins | Score 10,000 → | Generosidad |
|--------------|----------------|-------------|
| 200 | 50 monedas | Muy bajo |
| 100 | 100 monedas | Bajo |
| 50 | 200 monedas | Medio-bajo |
| 25 | 400 monedas | Medio |
| 12 | 833 monedas | Medio-alto |
| 10 | 1,000 monedas | Alto |
| 5 | 2,000 monedas | Muy alto |
| 1 | 10,000 monedas | Extremo |

---

### 3. **Bonus por Oleada** (`rewards.waveCompletion`)

Ubicación: `config.rewards.waveCompletion`

**Qué hace:**
- Otorga monedas cada vez que completas una oleada
- Se entrega **al completar** la oleada (antes de comenzar la siguiente)
- Es **independiente** de los enemigos eliminados

**Valor de ejemplo:**
```json
"rewards": {
  "waveCompletion": 40
}
```
Significa: **40 monedas** por cada oleada completada

**Para DISMINUIR recompensas:**
```json
"waveCompletion": 5    // Muy bajo
"waveCompletion": 10   // Bajo
```

**Para AUMENTAR recompensas:**
```json
"waveCompletion": 100  // Alto
"waveCompletion": 200  // Muy alto
```

**Impacto en 10 oleadas:**
| Valor | 10 oleadas → | Generosidad |
|-------|--------------|-------------|
| 5 | 50 monedas | Bajo |
| 10 | 100 monedas | Medio-bajo |
| 40 | 400 monedas | Medio-alto |
| 100 | 1,000 monedas | Alto |
| 200 | 2,000 monedas | Muy alto |

---

### 4. **Hitos de Puntuación** (`rewards.milestones`)

Ubicación: `config.rewards.milestones[]`

**Qué hace:**
- Otorga monedas bonus al alcanzar puntuaciones específicas
- Se entrega **una sola vez** por partida (no se repite si ya se logró)
- Usa un `id` único para evitar duplicados en Love Arcade

**Valores de ejemplo:**
```json
"milestones": [
  { "score": 500, "coins": 80, "id": "score_500" },
  { "score": 1000, "coins": 200, "id": "score_1000" },
  { "score": 2500, "coins": 400, "id": "score_2500" },
  { "score": 5000, "coins": 800, "id": "score_5000" },
  { "score": 10000, "coins": 2000, "id": "score_10000" },
  { "score": 25000, "coins": 4000, "id": "score_25000" },
  { "score": 50000, "coins": 8000, "id": "score_50000" },
  { "score": 100000, "coins": 20000, "id": "score_100000" }
]
```

**Para DISMINUIR recompensas:**
```json
"milestones": [
  { "score": 1000, "coins": 10, "id": "score_1000" },
  { "score": 5000, "coins": 25, "id": "score_5000" },
  { "score": 10000, "coins": 50, "id": "score_10000" },
  { "score": 50000, "coins": 100, "id": "score_50000" }
]
```

**Para AUMENTAR recompensas:**
```json
"milestones": [
  { "score": 100, "coins": 50, "id": "score_100" },
  { "score": 500, "coins": 200, "id": "score_500" },
  { "score": 1000, "coins": 500, "id": "score_1000" },
  { "score": 5000, "coins": 2500, "id": "score_5000" },
  { "score": 10000, "coins": 10000, "id": "score_10000" }
]
```

**Recomendaciones de diseño:**
- Progresión geométrica (cada hito ~2x el anterior)
- Primeros hitos fáciles de alcanzar (motivación)
- Últimos hitos desafiantes (meta a largo plazo)
- IDs únicos y descriptivos (evita duplicados)

**Fórmula sugerida:**
```
coins = score / 10  o  score / 5
```
Ejemplo: Score 5,000 → 5,000/10 = 500 monedas

---

## Cálculo Total de Recompensas

### Fórmula Completa:

```
MONEDAS_TOTALES = 
  (Enemigos_Scout × coins_scout) +
  (Enemigos_Shooter × coins_shooter) +
  (Enemigos_Tank × coins_tank) +
  (Enemigos_Elite × coins_elite) +
  (Bosses × coins_boss) +
  (Score_Final ÷ scoreToCoins) +
  (Oleadas_Completadas × waveCompletion) +
  SUMA(Hitos_Alcanzados)
```

### Ejemplo Práctico (Partida de 10 minutos):

**Logros:**
- 60 scouts eliminados
- 20 shooters eliminados
- 5 tanks eliminados
- 1 elite eliminado
- 0 bosses
- Score final: 8,000
- 5 oleadas completadas
- Hitos alcanzados: 500, 1K, 2.5K, 5K

**Con valores de ejemplo:**
```
Scouts:    60 × 8    = 480
Shooters:  20 × 20   = 400
Tanks:     5 × 40    = 200
Elites:    1 × 80    = 80
Bosses:    0 × 400   = 0
Score:     8000 ÷ 12 = 666
Oleadas:   5 × 40    = 200
Hitos:     80+200+400+800 = 1,480
─────────────────────────────
TOTAL:     3,506 monedas
```

**Con valores bajos:**
```
Scouts:    60 × 1    = 60
Shooters:  20 × 2    = 40
Tanks:     5 × 5     = 25
Elites:    1 × 10    = 10
Score:     8000 ÷ 100 = 80
Oleadas:   5 × 5     = 25
Hitos:     10+25+50+100 = 185
─────────────────────────────
TOTAL:     425 monedas
```

**Con valores altos:**
```
Scouts:    60 × 20   = 1,200
Shooters:  20 × 50   = 1,000
Tanks:     5 × 100   = 500
Elites:    1 × 200   = 200
Score:     8000 ÷ 5  = 1,600
Oleadas:   5 × 100   = 500
Hitos:     200+500+1000+2500 = 4,200
─────────────────────────────
TOTAL:     9,200 monedas
```

---

## Presets Recomendados

### PRESET "CASUAL" (Bajo)
*Para juego relajado, progresión lenta*

```json
"enemies": {
  "scout": { "coins": 1 },
  "shooter": { "coins": 3 },
  "tank": { "coins": 8 },
  "elite": { "coins": 15 },
  "boss": { "coins": 75 }
},
"rewards": {
  "scoreToCoins": 100,
  "waveCompletion": 5,
  "milestones": [
    { "score": 1000, "coins": 10, "id": "score_1000" },
    { "score": 5000, "coins": 50, "id": "score_5000" },
    { "score": 10000, "coins": 100, "id": "score_10000" }
  ]
}
```
**Partida 10min:** ~300-500 monedas

---

### PRESET "BALANCED" (Medio)
*Balance entre desafío y recompensa*

```json
"enemies": {
  "scout": { "coins": 3 },
  "shooter": { "coins": 8 },
  "tank": { "coins": 15 },
  "elite": { "coins": 30 },
  "boss": { "coins": 150 }
},
"rewards": {
  "scoreToCoins": 50,
  "waveCompletion": 15,
  "milestones": [
    { "score": 500, "coins": 25, "id": "score_500" },
    { "score": 1000, "coins": 75, "id": "score_1000" },
    { "score": 5000, "coins": 250, "id": "score_5000" },
    { "score": 10000, "coins": 750, "id": "score_10000" }
  ]
}
```
**Partida 10min:** ~1,200-1,800 monedas

---

### PRESET "GENEROUS" (Alto) - ACTUAL v3
*Progresión rápida, muy gratificante*

```json
"enemies": {
  "scout": { "coins": 8 },
  "shooter": { "coins": 20 },
  "tank": { "coins": 40 },
  "elite": { "coins": 80 },
  "boss": { "coins": 400 }
},
"rewards": {
  "scoreToCoins": 12,
  "waveCompletion": 40,
  "milestones": [
    { "score": 500, "coins": 80, "id": "score_500" },
    { "score": 1000, "coins": 200, "id": "score_1000" },
    { "score": 5000, "coins": 800, "id": "score_5000" },
    { "score": 10000, "coins": 2000, "id": "score_10000" }
  ]
}
```
**Partida 10min:** ~3,500-4,500 monedas

---

### PRESET "EXTREME" (Muy Alto)
*Para eventos especiales o promociones*

```json
"enemies": {
  "scout": { "coins": 15 },
  "shooter": { "coins": 40 },
  "tank": { "coins": 80 },
  "elite": { "coins": 150 },
  "boss": { "coins": 800 }
},
"rewards": {
  "scoreToCoins": 5,
  "waveCompletion": 100,
  "milestones": [
    { "score": 100, "coins": 100, "id": "score_100" },
    { "score": 500, "coins": 300, "id": "score_500" },
    { "score": 1000, "coins": 800, "id": "score_1000" },
    { "score": 5000, "coins": 3000, "id": "score_5000" },
    { "score": 10000, "coins": 10000, "id": "score_10000" }
  ]
}
```
**Partida 10min:** ~8,000-12,000 monedas

---

## Consideraciones de Diseño

### 1. **Balance Economía del Juego**

Pregúntate:
- ¿Cuánto cuesta el item más caro en la tienda?
- ¿Cuántas partidas debería tomar comprarlo?
- ¿Qué tan rápido quieres que progresen los jugadores?

**Ejemplo:**
- Item más caro: 5,000 monedas
- Partidas deseadas: 3-5 partidas
- Entonces: 1,000-1,700 monedas por partida
- **Usar preset: BALANCED**

### 2. **Curva de Progresión**

**Inicio (Oleadas 1-3):**
- Enemigos fáciles (scouts, shooters)
- Recompensas frecuentes pero pequeñas
- Hitos tempranos alcanzables

**Medio (Oleadas 4-8):**
- Mezcla de enemigos
- Recompensas medianas
- Hitos espaciados

**Avanzado (Oleadas 9+):**
- Enemigos difíciles (elites, bosses)
- Recompensas grandes
- Hitos desafiantes

### 3. **Retención del Jugador**

**Para más engagement:**
- Hitos frecuentes pero pequeños (dopamina constante)
- Primer hito muy fácil (100-500 pts)
- Bonus por oleada significativo (40+)

**Para jugadores hardcore:**
- Hitos espaciados pero grandes
- Recompensas por score más importantes
- Bosses muy lucrativos

### 4. **Eventos Temporales**

Puedes cambiar temporalmente las recompensas:
- **Fin de semana:** +50% todas las recompensas
- **Evento especial:** x2 coins por enemigo
- **Happy hour:** x3 scoreToCoins

---

## Checklist de Modificación

Antes de cambiar las recompensas:

- [ ] Define el objetivo (más generoso / más difícil)
- [ ] Calcula monedas/partida promedio
- [ ] Compara con precios de la tienda
- [ ] Prueba con 3-5 partidas reales
- [ ] Ajusta según feedback
- [ ] Documenta los cambios

---

## Errores Comunes

### NO HACER:

1. **scoreToCoins = 0** → División por cero (error)
2. **coins negativos** → Rompe la lógica
3. **Hitos sin ID** → Duplicados en Love Arcade
4. **IDs repetidos** → Jugador recibe monedas múltiples veces
5. **Hitos desordenados** → Confusión

### SÍ HACER:

1. Mantener valores enteros positivos
2. IDs únicos y descriptivos: `"score_5000"`
3. Progresión lógica (scout < shooter < tank)
4. Probar cambios antes de publicar
5. Documentar la economía del juego

---

## Herramienta de Cálculo Rápido

### Para estimar monedas/partida:

```javascript
// Valores promedio de una partida de 10 minutos
const partidaTipica = {
  scouts: 60,
  shooters: 20,
  tanks: 5,
  elites: 1,
  bosses: 0,
  score: 8000,
  oleadas: 5
};

// Tu configuración
const tuConfig = {
  scoutCoins: 8,
  shooterCoins: 20,
  tankCoins: 40,
  eliteCoins: 80,
  bossCoins: 400,
  scoreToCoins: 12,
  waveBonus: 40,
  milestones: [80, 200, 400, 800] // Suma de hitos alcanzables
};

// Cálculo
const total = 
  partidaTipica.scouts * tuConfig.scoutCoins +
  partidaTipica.shooters * tuConfig.shooterCoins +
  partidaTipica.tanks * tuConfig.tankCoins +
  partidaTipica.elites * tuConfig.eliteCoins +
  partidaTipica.bosses * tuConfig.bossCoins +
  partidaTipica.score / tuConfig.scoreToCoins +
  partidaTipica.oleadas * tuConfig.waveBonus +
  tuConfig.milestones.reduce((a, b) => a + b, 0);

console.log(`Monedas esperadas: ${Math.floor(total)}`);
```

---

## Resumen Ejecutivo

| Parámetro | Ubicación | Para Disminuir | Para Aumentar |
|-----------|-----------|----------------|---------------|
| **Monedas por enemigo** | `enemies.*.coins` | Valores 1-5 | Valores 15-100 |
| **Score → Monedas** | `rewards.scoreToCoins` | Valores 100-200 | Valores 5-10 |
| **Bonus oleada** | `rewards.waveCompletion` | Valores 5-10 | Valores 100-200 |
| **Hitos** | `rewards.milestones` | Pocos y pequeños | Muchos y grandes |

**Archivo a editar:** `games/Shooter/js/config/la-config.json`

**Recarga la página** después de modificar para aplicar cambios.
