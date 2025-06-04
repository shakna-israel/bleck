let gameState = {
    player: { x: 50, y: 50, trail: [] },
    items: [],
    enemies: [],
    superEnemies: [],
    score: 0,
    maxScore: 0,
    highscore: 0,
    canvas: null,
    ctx: null,
    lastTime: 0,
    keymap: {},
    pointerTarget: null,
    pointerActive: false,
    gameRunning: true,
    itemSpawnTimer: 0,
    enemySpawnTimer: 0,
};

const PLAYER_SPEED = 0.2;
const PLAYER_SIZE = 10;
const ITEM_SIZE = 12;
const ENEMY_SIZE = 8;
const SUPER_ENEMY_SIZE = 6;
const TRAIL_MAX_LENGTH = 20;
const TRAIL_MAX_AGE = 300;
const ITEM_SPAWN_INTERVAL = 5000;
const ENEMY_SPAWN_INTERVAL = 6000;
const BASE_ENEMY_SPEED = 0.05;
const BASE_SUPER_ENEMY_SPEED = 0.08;
const MAX_ENEMY_SPEED = 0.18;
const MAX_SUPER_ENEMY_SPEED = 0.30;
const ENEMY_AGGRO_RADIUS_FACTOR = 0.33;

function getFrameTime() {
    let now = performance.now();
    let deltaTime = now - (gameState.lastTime || now);
    gameState.lastTime = now;
    return deltaTime;
}

function spawnReset() {
    let el = document.getElementById('reset');
    el.textContent = '';

    let button = document.createElement('button');

    if(gameState.maxScore == gameState.highscore) {
        button.innerHTML = `New Personal Best: ${gameState.highscore}!<br />Play Again?`;
    } else {
        button.textContent = 'Play Again?';
    }

    button.addEventListener('click', function() {
        gameState = {
            player: { x: 50, y: 50, trail: [] },
            items: [],
            enemies: [],
            superEnemies: [],
            score: 0,
            maxScore: 0,
            highscore: 0,
            canvas: null,
            ctx: null,
            lastTime: 0,
            keymap: {},
            pointerTarget: null,
            pointerActive: false,
            gameRunning: true,
            itemSpawnTimer: 0,
            enemySpawnTimer: 0,
        };

        gameState.canvas = document.getElementById('gameCanvas');
        if (!gameState.canvas) {
            console.error("Canvas element not found!");
            return;
        }
        gameState.ctx = gameState.canvas.getContext('2d');
        if (!gameState.ctx) {
            console.error("Could not get 2D context!");
            return;
        }

        gameState.lastTime = performance.now();

        resizeCanvas();
        setupEventListeners();

        requestAnimationFrame(gameLoop);

        button.remove();
    });

    el.appendChild(button);
}

function spawnItem(deltaTime) {
    gameState.itemSpawnTimer += deltaTime;
    if (gameState.itemSpawnTimer < ITEM_SPAWN_INTERVAL) return;
    gameState.itemSpawnTimer = 0;

    if (!gameState.canvas || gameState.items.length > Math.abs(Math.max(gameState.canvas.width / 2 / 10, gameState.canvas.height / 2 / 10))) {
        return;
    }
    const padding = 30;
    if (gameState.items.length < 5 || gameState.items.length < gameState.score / 2) {
        gameState.items.push({
            x: Math.random() * (gameState.canvas.width - ITEM_SIZE - 2 * padding) + padding,
            y: Math.random() * (gameState.canvas.height - ITEM_SIZE - 2 * padding) + padding,
        });
    }
}

function spawnEnemy() {
    if (!gameState.canvas || gameState.enemies.length > Math.abs(Math.max(gameState.canvas.width / 2 / 10, gameState.canvas.height / 2 / 10))) {
        return;
    }
    const padding = 20;
    if (gameState.enemies.length < 2 || (gameState.enemies.length + gameState.superEnemies.length) < (gameState.score * 2)) {
        if(gameState.score > 0 && gameState.score > 10) {
            gameState.superEnemies.push({
                x: Math.random() * (gameState.canvas.width - ITEM_SIZE - 2 * padding) + padding,
                y: Math.random() * (gameState.canvas.height - ITEM_SIZE - 2 * padding) + padding,
                trail: [],
            });
        } else {
            gameState.enemies.push({
                x: Math.random() * (gameState.canvas.width - ITEM_SIZE - 2 * padding) + padding,
                y: Math.random() * (gameState.canvas.height - ITEM_SIZE - 2 * padding) + padding,
                trail: [],
            });
        }
    }
}

function updatePlayer(deltaTime) {
    if (!gameState.canvas) return;

    if(!!gameState.god) { gameState.score = 990; }

    gameState.maxScore = Math.max(gameState.score, gameState.maxScore);
    if(gameState.score < 0) {
        gameState.gameRunning = false;
        spawnReset();
        return;
    }
    try {
        let k = sessionStorage.getItem("highscore");
        if(!!k) {
            let highscore = JSON.parse(k);
            gameState.highscore = Math.max(gameState.score, gameState.maxScore, highscore);
        }
    } catch(e) {}
    try {
        let k = localStorage.getItem("highscore");
        if(!!k) {
            let highscore = JSON.parse(k);
            gameState.highscore = Math.max(gameState.score, gameState.maxScore, highscore);
        }
    } catch(e) {}

    try {
        sessionStorage.setItem("highscore", JSON.stringify(gameState.highscore));
    } catch(e) {}
    try {
        localStorage.setItem("highscore", JSON.stringify(gameState.highscore));
    } catch(e) {}

    const movement = PLAYER_SPEED * deltaTime;
    let newX = gameState.player.x;
    let newY = gameState.player.y;
    let movedByKey = false;

    if (gameState.keymap["ArrowLeft"] || gameState.keymap["a"]) {
        newX -= movement;
        movedByKey = true;
    }
    if (gameState.keymap["ArrowRight"] || gameState.keymap["d"]) {
        newX += movement;
        movedByKey = true;
    }
    if (gameState.keymap["ArrowUp"] || gameState.keymap["w"]) {
        newY -= movement;
        movedByKey = true;
    }
    if (gameState.keymap["ArrowDown"] || gameState.keymap["s"]) {
        newY += movement;
        movedByKey = true;
    }

    if (gameState.pointerActive && gameState.pointerTarget && !movedByKey) {
        const targetX = gameState.pointerTarget.x;
        const targetY = gameState.pointerTarget.y;
        const dx = targetX - gameState.player.x;
        const dy = targetY - gameState.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const arrivalThreshold = PLAYER_SIZE / 2; 

        if (distance > arrivalThreshold) {
            const moveRatio = Math.min(1, movement / distance); 
            if(isNaN(moveRatio)) { moveRatio = 1; }
            newX += dx * moveRatio;
            newY += dy * moveRatio;
        }
    }

    const movedThreshold = 0.1;
    let moved = Math.abs(newX - gameState.player.x) > movedThreshold || Math.abs(newY - gameState.player.y) > movedThreshold;

    if (moved) {
        gameState.player.trail.push({
            x: gameState.player.x,
            y: gameState.player.y,
            timestamp: performance.now()
        });
        if (gameState.player.trail.length > TRAIL_MAX_LENGTH) {
            gameState.player.trail.shift();
        }
    }

    if (newX >= gameState.canvas.width - PLAYER_SIZE) newX = 0;
    if (newX < 0) newX = gameState.canvas.width - PLAYER_SIZE;
    if (newY >= gameState.canvas.height - PLAYER_SIZE) newY = 0;
    if (newY < 0) newY = gameState.canvas.height - PLAYER_SIZE;
    
    gameState.player.x = newX;
    gameState.player.y = newY;

    let now = performance.now();
    gameState.player.trail = gameState.player.trail.filter(point => now - point.timestamp < TRAIL_MAX_AGE);
}

function updateEnemies(deltaTime) {
    if (!gameState.canvas || !gameState.gameRunning) return;
    const aggroRadius = gameState.canvas.width * ENEMY_AGGRO_RADIUS_FACTOR;

    gameState.enemies.forEach(enemy => {
        let dxPlayer = gameState.player.x - enemy.x;
        let dyPlayer = gameState.player.y - enemy.y;
        
        if(isNaN(enemy.driftDx) || !enemy.driftDx) {
            const angle = Math.random() * Math.PI * 2;
            enemy.driftDx = Math.cos(angle);
        }
        if(isNaN(enemy.driftDy) || !enemy.driftDy) {
            const angle = Math.random() * Math.PI * 2;
            enemy.driftDy = Math.cos(angle);
        }

        // Handle horizontal wrapping
        if (Math.abs(dxPlayer) > gameState.canvas.width / 2) {
            if (dxPlayer > 0) {
                dxPlayer = dxPlayer - gameState.canvas.width;
            } else {
                dxPlayer = dxPlayer + gameState.canvas.width;
            }
        }
        
        // Handle vertical wrapping
        if (Math.abs(dyPlayer) > gameState.canvas.height / 2) {
            if (dyPlayer > 0) {
                dyPlayer = dyPlayer - gameState.canvas.height;
            } else {
                dyPlayer = dyPlayer + gameState.canvas.height;
            }
        }
        
        const distanceToPlayer = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);

        let enemyMoved = false;
        let newEnemyX = enemy.x;
        let newEnemyY = enemy.y;

        if (distanceToPlayer < aggroRadius && distanceToPlayer > (PLAYER_SIZE / 2)) {
            const speedFactor = Math.max(0, 1 - (distanceToPlayer / aggroRadius));
            const currentEnemySpeed = BASE_ENEMY_SPEED + (MAX_ENEMY_SPEED - BASE_ENEMY_SPEED) * speedFactor;
            const enemyMovement = currentEnemySpeed * deltaTime;

            const moveRatio = Math.min(1, enemyMovement / distanceToPlayer);
            if(isNaN(moveRatio)) { moveRatio = 1; }
            
            newEnemyX += dxPlayer * moveRatio;
            newEnemyY += dyPlayer * moveRatio;
            enemyMoved = true;
        } else {
            const driftMovement = BASE_ENEMY_SPEED * deltaTime;
            if(isNaN(driftMovement)) { driftMovement = 1; }
            newEnemyX += enemy.driftDx * driftMovement;
            newEnemyY += enemy.driftDy * driftMovement;
            enemyMoved = true;
        }
        
        gameState.enemies.forEach(otherEnemy => {
            if (enemy === otherEnemy) return;
            const distToOther = Math.sqrt(Math.pow(newEnemyX - otherEnemy.x, 2) + Math.pow(newEnemyY - otherEnemy.y, 2));
            if (distToOther < ENEMY_SIZE * 1.5 && distToOther > 0) {
                const avoidanceFactor = 0.04;
                newEnemyX += (newEnemyX - otherEnemy.x) / distToOther * ENEMY_SIZE * avoidanceFactor;
                newEnemyY += (newEnemyY - otherEnemy.y) / distToOther * ENEMY_SIZE * avoidanceFactor;
            }
        });

        gameState.items.forEach(otherEnemy => {
            if (enemy === otherEnemy) return;
            const distToOther = Math.sqrt(Math.pow(newEnemyX - otherEnemy.x, 2) + Math.pow(newEnemyY - otherEnemy.y, 2));
            if (distToOther < ITEM_SIZE * 1.5 && distToOther > 0) {
                const avoidanceFactor = 0.04;
                newEnemyX += (newEnemyX - otherEnemy.x) / distToOther * ENEMY_SIZE * avoidanceFactor;
                newEnemyY += (newEnemyY - otherEnemy.y) / distToOther * ENEMY_SIZE * avoidanceFactor;
            }
        });

        gameState.superEnemies.forEach(otherEnemy => {
            if (enemy === otherEnemy) return;
            const distToOther = Math.sqrt(Math.pow(newEnemyX - otherEnemy.x, 2) + Math.pow(newEnemyY - otherEnemy.y, 2));
            if (distToOther < ENEMY_SIZE * 1.5 && distToOther > 0) {
                const avoidanceFactor = 0.40;
                newEnemyX += (newEnemyX - otherEnemy.x) / distToOther * ENEMY_SIZE * avoidanceFactor;
                newEnemyY += (newEnemyY - otherEnemy.y) / distToOther * ENEMY_SIZE * avoidanceFactor;
            }
        });

        if (newEnemyX >= gameState.canvas.width - ENEMY_SIZE) newEnemyX = ENEMY_SIZE;
        if (newEnemyX < 0) newEnemyX = gameState.canvas.width - ENEMY_SIZE;
        if (newEnemyY >= gameState.canvas.height - ENEMY_SIZE) newEnemyY = ENEMY_SIZE;
        if (newEnemyY < 0) newEnemyY = gameState.canvas.height - ENEMY_SIZE;
        
        enemy.x = newEnemyX;
        enemy.y = newEnemyY;

        if (enemyMoved) {
            enemy.trail.push({ x: enemy.x, y: enemy.y, timestamp: performance.now() });
            if (enemy.trail.length > TRAIL_MAX_LENGTH) {
                enemy.trail.shift();
            }
        }

        let now = performance.now();
        enemy.trail = enemy.trail.filter(point => now - point.timestamp < (TRAIL_MAX_AGE / 2));
    });

    gameState.superEnemies.forEach(enemy => {
        let dxPlayer = gameState.player.x - enemy.x;
        let dyPlayer = gameState.player.y - enemy.y;
        
        if(isNaN(enemy.driftDx) || !enemy.driftDx) {
            const angle = Math.random() * Math.PI * 2;
            enemy.driftDx = Math.cos(angle);
        }
        if(isNaN(enemy.driftDy) || !enemy.driftDy) {
            const angle = Math.random() * Math.PI * 2;
            enemy.driftDy = Math.cos(angle);
        }

        // Handle horizontal wrapping
        if (Math.abs(dxPlayer) > gameState.canvas.width / 2) {
            if (dxPlayer > 0) {
                dxPlayer = dxPlayer - gameState.canvas.width;
            } else {
                dxPlayer = dxPlayer + gameState.canvas.width;
            }
        }
        
        // Handle vertical wrapping
        if (Math.abs(dyPlayer) > gameState.canvas.height / 2) {
            if (dyPlayer > 0) {
                dyPlayer = dyPlayer - gameState.canvas.height;
            } else {
                dyPlayer = dyPlayer + gameState.canvas.height;
            }
        }
        
        const distanceToPlayer = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);

        let enemyMoved = false;
        let newEnemyX = enemy.x;
        let newEnemyY = enemy.y;

        if (distanceToPlayer < aggroRadius && distanceToPlayer > (PLAYER_SIZE / 2)) {
            const speedFactor = Math.max(0, 1 - (distanceToPlayer / aggroRadius));
            const currentEnemySpeed = BASE_SUPER_ENEMY_SPEED + (MAX_SUPER_ENEMY_SPEED - BASE_SUPER_ENEMY_SPEED) * speedFactor;
            const enemyMovement = currentEnemySpeed * deltaTime;

            const moveRatio = Math.min(1, enemyMovement / distanceToPlayer);
            if(isNaN(moveRatio)) { moveRatio = 1; }
            
            newEnemyX += dxPlayer * moveRatio;
            newEnemyY += dyPlayer * moveRatio;
            enemyMoved = true;
        } else {
            const driftMovement = BASE_SUPER_ENEMY_SPEED * deltaTime;
            if(isNaN(driftMovement)) { driftMovement = 1; }
            newEnemyX += enemy.driftDx * driftMovement;
            newEnemyY += enemy.driftDy * driftMovement;
            enemyMoved = true;
        }
        
        gameState.items.forEach(otherEnemy => {
            if (enemy === otherEnemy) return;
            const distToOther = Math.sqrt(Math.pow(newEnemyX - otherEnemy.x, 2) + Math.pow(newEnemyY - otherEnemy.y, 2));
            if (distToOther < ITEM_SIZE * 1.5 && distToOther > 0) {
                const avoidanceFactor = 0.40;
                newEnemyX += (newEnemyX - otherEnemy.x) / distToOther * ENEMY_SIZE * avoidanceFactor;
                newEnemyY += (newEnemyY - otherEnemy.y) / distToOther * ENEMY_SIZE * avoidanceFactor;
            }
        });

        gameState.superEnemies.forEach(otherEnemy => {
            if (enemy === otherEnemy) return;
            const distToOther = Math.sqrt(Math.pow(newEnemyX - otherEnemy.x, 2) + Math.pow(newEnemyY - otherEnemy.y, 2));
            if (distToOther < SUPER_ENEMY_SIZE * 1.5 && distToOther > 0) {
                const avoidanceFactor = 0.40;
                newEnemyX += (newEnemyX - otherEnemy.x) / distToOther * ENEMY_SIZE * avoidanceFactor;
                newEnemyY += (newEnemyY - otherEnemy.y) / distToOther * ENEMY_SIZE * avoidanceFactor;
            }
        });

        gameState.enemies.forEach(otherEnemy => {
            if (enemy === otherEnemy) return;
            const distToOther = Math.sqrt(Math.pow(newEnemyX - otherEnemy.x, 2) + Math.pow(newEnemyY - otherEnemy.y, 2));
            if (distToOther < ENEMY_SIZE * 1.5 && distToOther > 0) {
                const avoidanceFactor = 0.40;
                newEnemyX += (newEnemyX - otherEnemy.x) / distToOther * ENEMY_SIZE * avoidanceFactor;
                newEnemyY += (newEnemyY - otherEnemy.y) / distToOther * ENEMY_SIZE * avoidanceFactor;
            }
        });

        if (newEnemyX >= gameState.canvas.width - SUPER_ENEMY_SIZE) newEnemyX = SUPER_ENEMY_SIZE;
        if (newEnemyX < 0) newEnemyX = gameState.canvas.width - SUPER_ENEMY_SIZE;
        if (newEnemyY >= gameState.canvas.height - SUPER_ENEMY_SIZE) newEnemyY = SUPER_ENEMY_SIZE;
        if (newEnemyY < 0) newEnemyY = gameState.canvas.height - SUPER_ENEMY_SIZE;
        
        enemy.x = newEnemyX;
        enemy.y = newEnemyY;

        if (enemyMoved) {
            enemy.trail.push({ x: enemy.x, y: enemy.y, timestamp: performance.now() });
            if (enemy.trail.length > TRAIL_MAX_LENGTH) {
                enemy.trail.shift();
            }
        }

        let now = performance.now();
        enemy.trail = enemy.trail.filter(point => now - point.timestamp < (TRAIL_MAX_AGE / 2));
    });
}

function checkCollisions() {
    if (!gameState.canvas) return;
    let itemsToRemove = [];

    for (let i = 0; i < gameState.items.length; i++) {
        let item = gameState.items[i];
        if (gameState.player.x < item.x + ITEM_SIZE &&
            gameState.player.x + PLAYER_SIZE > item.x &&
            gameState.player.y < item.y + ITEM_SIZE &&
            gameState.player.y + PLAYER_SIZE > item.y) {
            itemsToRemove.push(i);
        }
    }

    for (let i = itemsToRemove.length - 1; i >= 0; i--) {
        gameState.items.splice(itemsToRemove[i], 1);
        gameState.score++;
    }

    itemsToRemove = [];
    for (let i = 0; i < gameState.enemies.length; i++) {
        let item = gameState.enemies[i];
        if (gameState.player.x < item.x + ENEMY_SIZE &&
            gameState.player.x + PLAYER_SIZE > item.x &&
            gameState.player.y < item.y + ENEMY_SIZE &&
            gameState.player.y + PLAYER_SIZE > item.y) {
            itemsToRemove.push(i);
        }
    }

    for (let i = itemsToRemove.length - 1; i >= 0; i--) {
        gameState.enemies.splice(itemsToRemove[i], 1);
        gameState.score -= 2;
    }

    for (let i = 0; i < gameState.superEnemies.length; i++) {
        let item = gameState.superEnemies[i];
        const padding = 30;
        if (gameState.player.x < item.x + SUPER_ENEMY_SIZE &&
            gameState.player.x + PLAYER_SIZE > item.x &&
            gameState.player.y < item.y + SUPER_ENEMY_SIZE &&
            gameState.player.y + PLAYER_SIZE > item.y) {
                gameState.superEnemies[i].x = Math.random() * (gameState.canvas.width - SUPER_ENEMY_SIZE - 2 * padding) + padding;
                gameState.superEnemies[i].y = Math.random() * (gameState.canvas.height - SUPER_ENEMY_SIZE - 2 * padding) + padding;
                gameState.superEnemies[i].trail = [];
                gameState.score -= 1;
        }
    }

    document.getElementById('score').textContent = `Score: ${gameState.maxScore}/${gameState.highscore} Lives: ${Math.floor(gameState.score / 2)}`;
}

function render() {
    if (!gameState.ctx || !gameState.canvas) return;

    gameState.ctx.clearRect(0, 0, gameState.canvas.width, gameState.canvas.height);

    let now = performance.now();
    for (let i = 0; i < gameState.player.trail.length; i++) {
        let point = gameState.player.trail[i];
        let age = now - point.timestamp;
        let alpha = Math.max(0, 1 - (age / TRAIL_MAX_AGE));
        let size = PLAYER_SIZE * (0.3 + 0.7 * alpha); 

        gameState.ctx.fillStyle = `rgba(64, 64, 64, ${alpha * 0.6})`;
        gameState.ctx.fillRect(
            point.x + (PLAYER_SIZE - size) / 2,
            point.y + (PLAYER_SIZE - size) / 2,
            size,
            size
        );
    }

    gameState.ctx.fillStyle = 'black';
    gameState.ctx.fillRect(gameState.player.x, gameState.player.y, PLAYER_SIZE, PLAYER_SIZE);

    gameState.ctx.fillStyle = 'green';
    for (let item of gameState.items) {
        gameState.ctx.fillRect(item.x, item.y, ITEM_SIZE, ITEM_SIZE);
    }

    gameState.enemies.forEach(enemy => {
        for (let i = 0; i < enemy.trail.length; i++) {
            let point = enemy.trail[i];
            let age = now - point.timestamp;
            let alpha = Math.max(0, 1 - (age / TRAIL_MAX_AGE));
            let size = ENEMY_SIZE * (0.2 + 0.8 * alpha);

            gameState.ctx.fillStyle = `rgba(192, 57, 43, ${alpha * 0.4})`;
            gameState.ctx.beginPath();
            gameState.ctx.arc(point.x + ENEMY_SIZE / 2, point.y + ENEMY_SIZE / 2, size / 2, 0, Math.PI * 2);
            gameState.ctx.fill();
        }
        gameState.ctx.fillStyle = '#e74c3c';
        gameState.ctx.fillRect(enemy.x, enemy.y, ENEMY_SIZE, ENEMY_SIZE);
    });

    gameState.superEnemies.forEach(enemy => {
        for (let i = 0; i < enemy.trail.length; i++) {
            let point = enemy.trail[i];
            let age = now - point.timestamp;
            let alpha = Math.max(0, 1 - (age / TRAIL_MAX_AGE));
            let size = ENEMY_SIZE * (0.2 + 0.8 * alpha);

            gameState.ctx.fillStyle = `rgba(0, 57, 43, ${alpha * 0.4})`;
            gameState.ctx.beginPath();
            gameState.ctx.arc(point.x + SUPER_ENEMY_SIZE / 2, point.y + SUPER_ENEMY_SIZE / 2, size / 2, 0, Math.PI * 2);
            gameState.ctx.fill();
        }
        gameState.ctx.fillStyle = 'cyan';
        gameState.ctx.fillRect(enemy.x, enemy.y, SUPER_ENEMY_SIZE, SUPER_ENEMY_SIZE);
    });
}

function gameLoop() {
    if (!gameState.gameRunning) {
        return;
    }
    if (!gameState.canvas) { 
        requestAnimationFrame(gameLoop);
        return;
    }
    let deltaTime = getFrameTime();
    
    spawnItem(deltaTime);
    spawnEnemy(deltaTime);

    updatePlayer(deltaTime);
    updateEnemies(deltaTime);
    checkCollisions();
    render();
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    if (!gameState.canvas) return;
    const container = document.getElementById('game-container');
    const newWidth = container.clientWidth * 0.95; 
    const newHeight = container.clientHeight * 0.95;

    gameState.canvas.width = newWidth;
    gameState.canvas.height = newHeight;
    render(); 
}

function setupEventListeners() {
    window.addEventListener('keydown', function(evt) {
        if (!gameState.gameRunning) {
            return;
        }
        gameState.keymap[evt.key] = true;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(evt.key)) {
            evt.preventDefault();
        }
    });

    window.addEventListener('keyup', function(evt) {
        if (!gameState.gameRunning) {
            return;
        }
        delete gameState.keymap[evt.key];
    });

    window.addEventListener('resize', resizeCanvas);

    if (gameState.canvas) {
        gameState.canvas.addEventListener('touchstart', function(evt) {
            evt.preventDefault(); 
            if (!gameState.gameRunning) {
                return;
            }
            if (evt.touches.length > 0) {
                const touch = evt.touches[0];
                const rect = gameState.canvas.getBoundingClientRect();
                gameState.pointerTarget = {
                    x: touch.clientX - rect.left,
                    y: touch.clientY - rect.top
                };
                gameState.pointerActive = true;
            }
        }, { passive: false }); 

        gameState.canvas.addEventListener('touchmove', function(evt) {
            evt.preventDefault();
            if (!gameState.gameRunning) {
                return;
            }
            if (evt.touches.length > 0 && gameState.pointerActive) {
                const touch = evt.touches[0];
                const rect = gameState.canvas.getBoundingClientRect();
                gameState.pointerTarget = {
                    x: touch.clientX - rect.left,
                    y: touch.clientY - rect.top
                };
            }
        }, { passive: false });

        gameState.canvas.addEventListener('touchend', function(evt) {
            evt.preventDefault();
            if (!gameState.gameRunning) {
                return;
            }
            if (evt.touches.length === 0) {
                    gameState.pointerActive = false;
            }
        });

        gameState.canvas.addEventListener('touchcancel', function(evt) {
            evt.preventDefault();
            if (!gameState.gameRunning) {
                return;
            }
            gameState.pointerActive = false;
        });

        gameState.canvas.addEventListener('mousedown', function(evt) {
            if (!gameState.gameRunning) {
                return;
            }
            if (evt.button === 0) {
                const rect = gameState.canvas.getBoundingClientRect();
                gameState.pointerTarget = {
                    x: evt.clientX - rect.left,
                    y: evt.clientY - rect.top
                };
                gameState.pointerActive = true;
            }
        });

        gameState.canvas.addEventListener('mousemove', function(evt) {
            if (!gameState.gameRunning) {
                return;
            }
            if (gameState.pointerActive) {
                const rect = gameState.canvas.getBoundingClientRect();
                gameState.pointerTarget = {
                    x: evt.clientX - rect.left,
                    y: evt.clientY - rect.top
                };
            }
        });

        gameState.canvas.addEventListener('mouseup', function(evt) {
            if (!gameState.gameRunning) {
                return;
            }
            if (evt.button === 0) {
                gameState.pointerActive = false;
            }
        });

        gameState.canvas.addEventListener('mouseleave', function(evt) {
            if (!gameState.gameRunning) {
                return;
            }
            if (gameState.pointerActive) {
                gameState.pointerActive = false;
            }
        });
    }
}

window.addEventListener('load', function() {
    gameState.canvas = document.getElementById('gameCanvas');
    if (!gameState.canvas) {
        console.error("Canvas element not found!");
        return;
    }
    gameState.ctx = gameState.canvas.getContext('2d');
    if (!gameState.ctx) {
        console.error("Could not get 2D context!");
        return;
    }

    gameState.lastTime = performance.now();

    resizeCanvas(); 
    setupEventListeners();

    requestAnimationFrame(gameLoop);
    setInterval(spawnItem, ITEM_SPAWN_INTERVAL / 2);
    setInterval(spawnEnemy, ENEMY_SPAWN_INTERVAL / 2);
});
