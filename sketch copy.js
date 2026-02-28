/*
  Week 6 — Example 4: Adding HUD (Score/Health), Enemies, and Interactive Objects

  Course: GBDA302 | Instructors: Dr. Karen Cochrane & David Han
  Date: Feb. 26, 2026

  Controls:
    A or D (Left / Right Arrow)   Horizontal movement
    W (Up Arrow)                  Jump
    Space Bar                     Attack

  Tile key:
    g = groundTile.png       (surface ground)
    d = groundTileDeep.png   (deep ground, below surface)
    L = platformLC.png       (platform left cap)
    R = platformRC.png       (platform right cap)
    [ = wallL.png            (wall left side)
    ] = wallR.png            (wall right side)
      = empty (no sprite)
*/

let player, sensor;
let playerImg;

let playerAnis = {
  idle: { row: 0, frames: 4, frameDelay: 10 },
  run: { row: 1, frames: 4, frameDelay: 3 },
  jump: { row: 2, frames: 3, frameDelay: Infinity, frame: 0 },
  attack: { row: 3, frames: 6, frameDelay: 2 },
  hurtPose: { row: 5, frames: 4, frameDelay: Infinity },
  death: { row: 5, frames: 4, frameDelay: 16 },
};



let attacking = false; // track if the player is attacking
let attackFrameCounter = 0; // tracking attack animation

let invulnTimer = 0; // counts down frames
const INVULN_FRAMES = 45; // ~0.75s at 60fps

let knockTimer = 0;
const KNOCK_FRAMES = 30; // how long we "force" knockback control

let ground, groundDeep, platformsL, platformsR, wallsL, wallsR;
let groundTile1Img, groundTile2Img, platforTileLImg, platforTileRImg, wallTileLImg, wallTileRImg;

let bgLayers = [];
let bgForeImg, bgMidImg, bgFarImg;

let leaf;
let leafImg;
let leafSpawns = []; // stores leaf sprite refs + spawn positions

let fire;
let fireImg;

let fontImg;
let hudGfx;
let lastScore = null;
let lastHealth = null;
let lastMaxHealth = null;

let score = 0;
let maxHealth = 3;
let health = maxHealth;

let dead = false;
let pendingDeath = false; // set when health hits 0, but we wait until knockback ends
let deathStarted = false; // prevents death animation from being restarted every frame
let deathFrameTimer = 0; // drives the death animation once, then holds last frame

// --- TILE MAP ---
// an array that uses the tile key to create the level
let level = [
  "                    g   g      x        ", // row  0
  "                  x         LggR        ", // row  1
  "      x   f     LggR                    ", // row  2
  "     LR   LgR          LR               ", // row  3:
  "   fx           x                       ", // row  4
  "   LgggR   x   LR   LgR x     xf       ", // row  5:
  "         LgR    x       g   LggggR      ", // row  6:
  " fx           LgR                    fx ", // row  7
  " LgR                                LggR", // row  8
  "         LgR        f x    LR  LgR  [dd]", // row  9:
  "   x     [d]      x gggg   x    ff  [dd]", // row 10:
  "gggggffggggggggfffggggggfffgfggggggggggg", // row 11: surface ground WITH GAPS
  "dddddddddddddddddddddddddddddddddddddddd", // row 12: deep ground
];

// --- LEVEL CONSTANTS ---

// tile width & height
const TILE_W = 24;
const TILE_H = 24;

// animation frames width & height
const FRAME_W = 32;
const FRAME_H = 32;

// level size width & height based on level map
const LEVELW = TILE_W * level[0].length;
const LEVELH = TILE_H * level.length;

// camera view size
// uses tile size to determine how much we can see
const VIEWTILE_W = 10; // how many tiles wide should the camera view be
const VIEWTILE_H = 8; // how many tiles high should the camera view be
const VIEWW = TILE_W * VIEWTILE_W;
const VIEWH = TILE_H * VIEWTILE_H;

// Y-coordinate of player start (4 tiles above the bottom)
const PLAYER_START_Y = LEVELH - TILE_H * 4;

// HUD constants
const FONT_COLS = 19;
const FONT_ROWS = 5;
const CELL = 30; // source cell size in the PNG

const FONT_SCALE = 1 / 3; // 30px -> 10px (nice for HUD)
const GLYPH_W = CELL * FONT_SCALE; // 10
const GLYPH_H = CELL * FONT_SCALE; // 10

const FONT_CHARS =
  " !\"#$%&'()*+,-./0123456789:;<=>?@" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`" + "abcdefghijklmnopqrstuvwxyz{|}~";

// damage constants
// tune these
const KNOCK_X = 3.0; // horizontal push strength
const KNOCK_Y = 4.2; // upward push strength

// gravity
const GRAVITY = 10;

function preload() {
  // --- IMAGES ---

  // player sprite sheet
  playerImg = loadImage("assets/foxSpriteSheet.png");

  // leaf sprite sheet
  leafImg = loadImage("assets/leafSpriteSheet.png");

  // fire sprite sheet
  fireImg = loadImage("assets/fireSpriteSheet.png");

  // background images
  bgFarImg = loadImage("assets/background_layer_1.png");
  bgMidImg = loadImage("assets/background_layer_2.png");
  bgForeImg = loadImage("assets/background_layer_3.png");

  // tile images
  groundTile1Img = loadImage("assets/groundTile.png");
  groundTile2Img = loadImage("assets/groundTileDeep.png");
  platformTileLImg = loadImage("assets/platformLC.png");
  platformTileRImg = loadImage("assets/platformRC.png");
  wallTileLImg = loadImage("assets/wallL.png");
  wallTileRImg = loadImage("assets/wallR.png");

  // bitmap font image
  fontImg = loadImage("assets/bitmapFont.png");
}

function setup() {
  // pixelated rendering with autoscaling
  new Canvas(VIEWW, VIEWH, "pixelated");
  noSmooth();

  // force integer CSS scaling (prevents shimmer/blur)
  applyIntegerScale();
  window.addEventListener("resize", applyIntegerScale);

  // needed to correct an visual artifacts from attempted antialiasing
  allSprites.pixelPerfect = true;

  // uncomment the line below to show the collision box for every sprite
  //allSprites.debug = true;

  // we need to turn off the automated physics
  // so we can manually control when to advance it
  // the automated phyiscs can cause rendering issues
  world.autoStep = false;

  // --- HUD  ---
  // Create a graphics buffer for rendering the HUD
  hudGfx = createGraphics(VIEWW, VIEWH);
  hudGfx.noSmooth();
  hudGfx.pixelDensity(1);

  // build the world (tiles + groups + player)
  makeWorld();

  // store leaf spawn points so we can "respawn" them on restart
  leafSpawns = [];
  for (const s of leaf) {
    s.active = true; // custom flag
    leafSpawns.push({ s, x: s.x, y: s.y });
  }
}

function draw() {
  background(69, 61, 79);

  // manually advance the physics engine each time through the draw loop
  world.step();

  // --- CAMERA ---
  // assign the width and height of the camera view
  camera.width = VIEWW;
  camera.height = VIEWH;

  // camera follow player
  let targetX = constrain(player.x, VIEWW / 2, LEVELW - VIEWW / 2 - TILE_W / 2);
  let targetY = constrain(player.y, VIEWH / 2 - TILE_H * 2, LEVELH - VIEWH / 2 - TILE_H);

  // smooth + snap
  camera.x = Math.round(lerp(camera.x || targetX, targetX, 0.1));
  camera.y = Math.round(lerp(camera.y || targetY, targetY, 0.1));

  // --- PLAYER CONTROLS ---
  // first check to see if the player is on the ground or a platform
  let grounded = sensor.overlapping(ground) || sensor.overlapping(platformsL) || sensor.overlapping(platformsR);

  // -- ATTACK INPUT --
  // disabled if dead, and also disabled during knockback
  if (!dead && knockTimer === 0 && !pendingDeath && grounded && !attacking && kb.presses("space")) {
    attacking = true;
    attackFrameCounter = 0;
    player.vel.x = 0;
    player.ani.frame = 0;
    player.ani = "attack";
    player.ani.play(); // plays once to end
  }

  // -- JUMP --
  // disabled if dead
  if (!dead && knockTimer === 0 && !pendingDeath && grounded && kb.presses("up")) {
    player.vel.y = -4.5;
  }

  // --- STATE MACHINE ---
  // IMPORTANT:
  // - "dead" should NOT constantly re-assign the animation every frame
  //   because that can reset it / fight with play()
  // - so: when dead, we leave the animation alone (it is set when we enter dead)
  if (!dead && knockTimer > 0) {
    // Hurt wins over everything (even in the air)
    player.ani = "hurtPose";
    player.ani.frame = 1; // row 5, frame 1 (adjust if you want a different hurt frame)
  } else if (!dead && pendingDeath) {
    // waiting to land to die: keep a hurt/fall pose instead of jump
    player.ani = "hurtPose";
    player.ani.frame = 1;
  } else if (!dead && attacking) {
    attackFrameCounter++;
    if (attackFrameCounter > 12) {
      attacking = false;
      attackFrameCounter = 0;
    }
  } else if (!dead && !grounded) {
    player.ani = "jump";
    player.ani.frame = player.vel.y < 0 ? 0 : 1;
  } else if (!dead) {
    player.ani = kb.pressing("left") || kb.pressing("right") ? "run" : "idle";
  }

  // --- MOVEMENT ---
  if (dead) {
    // no movement when dead (death animation / game over)
    player.vel.x = 0;
  } else if (knockTimer > 0) {
    // during knockback: no player control (leave vel as-is)
    // IMPORTANT: do NOT zero vel.x here, knockback needs it
  } else if (pendingDeath) {
    // knockback finished, but we’re waiting to land before dying:
    // freeze player control now (optional), but allow gravity to land them
    player.vel.x = 0;
  } else if (!attacking) {
    player.vel.x = 0;
    if (kb.pressing("left")) {
      player.vel.x = -1.5;
      player.mirror.x = true;
    } else if (kb.pressing("right")) {
      player.vel.x = 1.5;
      player.mirror.x = false;
    }
  }

  // --- PLAYER BOUNDS ---
  player.x = constrain(player.x, FRAME_W / 2, LEVELW - FRAME_W / 2);

  // --- BACKGROUNDS (screen space) ---
  camera.off();
  imageMode(CORNER);

  // hard-disable smoothing at the canvas context level
  drawingContext.imageSmoothingEnabled = false;

  for (const layer of bgLayers) {
    const img = layer.img;
    const w = img.width; // background images are 341px wide

    // camera.x is already rounded, but keep the scroll pixel-snapped
    let x = Math.round((-camera.x * layer.speed) % w);

    // keep x in [-w, 0] so we can draw forward
    if (x > 0) x -= w;

    // draw enough copies to fill the view
    for (let tx = x; tx < VIEWW + w; tx += w) {
      image(img, tx, 0);
    }
  }

  camera.on();

  // --- PLAYER LOSE STATE ---
  // falls off level (only if not dead; death screen should be stable)
  if (!dead && player.y > LEVELH + TILE_H * 3) {
    player.x = FRAME_W;
    player.y = PLAYER_START_Y;
    player.vel.x = 0;
    player.vel.y = 0;
  }

  // --- TIMERS ---
  // NOTE: timers tick once per frame, after movement/inputs are applied
  if (invulnTimer > 0) invulnTimer--;
  if (knockTimer > 0) knockTimer--;

  // --- PLAYER DYING ---
  // We only enter "dead" once:
  // 1) knockback is finished, AND
  // 2) player has landed on a surface (ground/platform)
  if (!dead && pendingDeath && knockTimer === 0 && grounded) {
    dead = true;
    pendingDeath = false;
    deathStarted = false;
  }
  // start death animation ONCE (the frame we become dead)
  if (dead && !deathStarted) {
    deathStarted = true;

    player.tint = "#ffffff";
    player.vel.x = 0;
    player.vel.y = 0;

    // switch to death ani, but DO NOT play() (p5play often loops)
    player.ani = "death";
    player.ani.frame = 0;

    // reset our manual timer
    deathFrameTimer = 0;
  }
  // if dead, manually advance death frames ONCE, then hold on last frame
  if (dead) {
    const frames = playerAnis.death.frames; // 4
    const delayFrames = playerAnis.death.frameDelay; // 6 (meaning: hold each frame for 6 "60fps frames")

    // convert that "delayFrames" into milliseconds using 60fps as the baseline
    const msPerFrame = (delayFrames * 1000) / 60;

    deathFrameTimer += deltaTime; // ms since last draw
    const f = Math.floor(deathFrameTimer / msPerFrame);

    // clamp to the last frame (so it never loops)
    player.ani.frame = Math.min(frames - 1, f);
  }

  // --- PIXEL SNAP (render only) ---
  // this is needed to help with some blurring that happens
  // with pixel art based animations
  const px = player.x,
    py = player.y;
  const sx = sensor.x,
    sy = sensor.y;

  player.x = Math.round(player.x);
  player.y = Math.round(player.y);
  sensor.x = Math.round(sensor.x);
  sensor.y = Math.round(sensor.y);

  // --- HURT VISUALS ---
  // blink only while alive
  if (!dead && invulnTimer > 0) {
    if (Math.floor(invulnTimer / 4) % 2 === 0) player.tint = "#ff5050";
    else player.tint = "#ffffff";
  } else {
    player.tint = "#ffffff";
  }

  allSprites.draw();

  player.x = px;
  player.y = py;
  sensor.x = sx;
  sensor.y = sy;

  // --- HUD (screen space) ---
  // check to see if any HUD info has changed
  if (score !== lastScore || health !== lastHealth || maxHealth !== lastMaxHealth) {
    redrawHUD();
    lastScore = score;
    lastHealth = health;
    lastMaxHealth = maxHealth;
  }

  // draw the HUD
  camera.off();
  imageMode(CORNER);
  drawingContext.imageSmoothingEnabled = false;
  image(hudGfx, 0, 0);
  camera.on();

  // draw death screen if player died
  if (dead) drawDeathOverlay();

  // restart input only while dead (prevents accidental restarts during play)
  if (dead && kb.presses("r")) {
    restartGame();
  }
}

function applyIntegerScale() {
  const c = document.querySelector("canvas");
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEWW, window.innerHeight / VIEWH)));
  c.style.width = VIEWW * scale + "px";
  c.style.height = VIEWH * scale + "px";
}

function drawBitmapTextToGfx(g, str, x, y, scale = FONT_SCALE) {
  str = String(str);

  const dw = CELL * scale;
  const dh = CELL * scale;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const idx = FONT_CHARS.indexOf(ch);
    if (idx === -1) continue;

    const col = idx % FONT_COLS;
    const row = Math.floor(idx / FONT_COLS);

    const sx = col * CELL;
    const sy = row * CELL;

    g.image(fontImg, Math.round(x + i * dw), Math.round(y), dw, dh, sx, sy, CELL, CELL);
  }
}

function drawOutlinedTextToGfx(g, str, x, y, fillHex) {
  // outline
  g.tint("#000000");
  drawBitmapTextToGfx(g, str, x - 1, y);
  drawBitmapTextToGfx(g, str, x + 1, y);
  drawBitmapTextToGfx(g, str, x, y - 1);
  drawBitmapTextToGfx(g, str, x, y + 1);

  // fill
  g.tint(fillHex);
  drawBitmapTextToGfx(g, str, x, y);

  g.noTint();
}

function redrawHUD() {
  hudGfx.clear();
  hudGfx.drawingContext.imageSmoothingEnabled = false;
  hudGfx.imageMode(CORNER);

  // SCORE
  drawOutlinedTextToGfx(hudGfx, `RESCUED ${score}/15`, 6, 6, "#ffdc00");

  // HEARTS
  const heartChar = "~";
  const heartX = 200;
  const heartY = 6;
  const spacing = GLYPH_W + 2;

  for (let i = 0; i < maxHealth; i++) {
    const x = heartX + i * spacing;
    const col = i < health ? "#ff5050" : "#783030";
    drawOutlinedTextToGfx(hudGfx, heartChar, x, heartY, col);
  }
}

function rescueLeaf(player, leaf) {
  if (!leaf.active) return;
  leaf.active = false;
  leaf.visible = false;
  leaf.removeColliders(); // disables overlaps cleanly
  score++;
}

function takeDamageFromFire(player, fire) {
  // ignore damage if invulnerable OR already dead
  if (invulnTimer > 0 || dead) return;

  health = max(0, health - 1);

  // if this hit reduces us to 0, we don't die instantly:
  // we finish knockback first, then switch to death once knockTimer ends
  if (health <= 0) {
    pendingDeath = true;
  }

  // start invulnerability + knockback window
  invulnTimer = INVULN_FRAMES;
  knockTimer = KNOCK_FRAMES;

  // knock direction: away from fire
  const dir = player.x < fire.x ? -1 : 1; // if fire is to the right, knock left

  player.vel.x = dir * KNOCK_X;
  player.vel.y = -KNOCK_Y;

  // cancel attack so it doesn't fight with hurt
  attacking = false;
  attackFrameCounter = 0;
}

function drawDeathOverlay() {
  camera.off();
  drawingContext.imageSmoothingEnabled = false;

  // darken screen
  push();
  noStroke();
  fill(0, 160);
  rect(0, 0, VIEWW, VIEWH);
  pop();

  // --- bitmap text ---
  // measure in "glyph units" (10px per glyph because FONT_SCALE = 1/3)
  const msg1 = "YOU DIED";
  const msg2 = "Press R to restart";

  const msg1W = msg1.length * GLYPH_W;
  const msg2W = msg2.length * GLYPH_W;

  const x1 = Math.round((VIEWW - msg1W) / 2);
  const x2 = Math.round((VIEWW - msg2W) / 2);

  const y1 = Math.round(VIEWH / 2 - 18);
  const y2 = Math.round(VIEWH / 2 + 2);

  // outlined white text (same look as HUD)
  drawOutlinedTextToGfx(window, msg1, x1, y1, "#ffffff");
  drawOutlinedTextToGfx(window, msg2, x2, y2, "#ffffff");

  camera.on();
}

function restartGame() {
  // reset stats
  score = 0;
  health = maxHealth;

  invulnTimer = 0;
  knockTimer = 0;

  dead = false;
  pendingDeath = false;
  deathStarted = false;
  deathFrameTimer = 0;

  attacking = false;
  attackFrameCounter = 0;

  // --- reset player physics ---
  player.x = FRAME_W;
  player.y = PLAYER_START_Y;
  player.vel.x = 0;
  player.vel.y = 0;

  // put the sensor back under the player immediately
  sensor.x = player.x;
  sensor.y = player.y + player.h / 2;
  sensor.vel.x = 0;
  sensor.vel.y = 0;

  // restore animation/tint
  player.ani = "idle";
  player.tint = "#ffffff";

  // reset camera smoothing seed
  // (so camera doesn't "snap" from old values)
  camera.x = undefined;
  camera.y = undefined;

  // --- respawn leaves ---
  for (const item of leafSpawns) {
    const s = item.s;
    s.x = item.x;
    s.y = item.y;

    s.active = true;
    s.visible = true;

    // put collisions back
    s.collider = "static"; // if this errors, tell me and we'll use a fallback
  }

  // force HUD refresh
  lastScore = lastHealth = lastMaxHealth = null;
}

function makeWorld() {
  world.gravity.y = GRAVITY;

  // --- INTERACTIVE TILE GROUPS ---
  // --- LEAF ---
  leaf = new Group();
  leaf.physics = "static";
  leaf.spriteSheet = leafImg;
  leaf.addAnis({ idle: { w: 32, h: 32, row: 0, frames: 5 } });
  leaf.w = 10;
  leaf.h = 6;
  leaf.anis.offset.x = 2;
  leaf.anis.offset.y = -4;
  leaf.tile = "x";

  // --- FIRE ---
  fire = new Group();
  fire.physics = "static";
  fire.spriteSheet = fireImg;
  fire.addAnis({ burn: { w: 32, h: 32, row: 0, frames: 16 } });
  fire.w = 18;
  fire.h = 16;
  fire.tile = "f";

  // --- LEVEL TILE GROUPS ---
  ground = new Group();
  ground.physics = "static";
  ground.img = groundTile1Img;
  ground.tile = "g";

  groundDeep = new Group();
  groundDeep.physics = "static";
  groundDeep.img = groundTile2Img;
  groundDeep.tile = "d";

  platformsL = new Group();
  platformsL.physics = "static";
  platformsL.img = platformTileLImg;
  platformsL.tile = "L";

  platformsR = new Group();
  platformsR.physics = "static";
  platformsR.img = platformTileRImg;
  platformsR.tile = "R";

  wallsL = new Group();
  wallsL.physics = "static";
  wallsL.img = wallTileLImg;
  wallsL.tile = "[";

  wallsR = new Group();
  wallsR.physics = "static";
  wallsR.img = wallTileRImg;
  wallsR.tile = "]";

  // creates the tiles based on the level map array
  new Tiles(level, 0, 0, TILE_W, TILE_H);

  // --- PLAYER ---
  player = new Sprite(FRAME_W, PLAYER_START_Y, FRAME_W, FRAME_H);
  player.spriteSheet = playerImg;
  player.rotationLock = true; // needed to turn off rotations
  player.anis.w = FRAME_W;
  player.anis.h = FRAME_H;
  player.anis.offset.y = -8; // offset the collision box up
  player.addAnis(playerAnis);

  player.ani = "idle";
  player.w = 18; // set the width of the collsion box
  player.h = 12; // set the height of the collsion box
  player.friction = 0;
  player.bounciness = 0;

  // knockback damage from fire
  player.overlaps(fire, takeDamageFromFire);

  // action for rescuing leaves
  player.overlaps(leaf, rescueLeaf);

  // --- GROUND SENSOR --- for use when detecting if the player is standing on the ground
  sensor = new Sprite();
  sensor.x = player.x;
  sensor.y = player.y + player.h / 2; // sits at player feet
  sensor.w = player.w;
  sensor.h = 2;
  sensor.mass = 0.01;

  // IMPORTANT: this makes it a "query box" that doesn't push things around
  sensor.removeColliders();
  sensor.visible = false; // make it invisible
  let sensorJoint = new GlueJoint(player, sensor); // "glues" the sensor to the feet of the player
  sensorJoint.visible = false; // make this invisible too

  // --- BACKGROUND  ---
  // Parallax backgrounds
  bgLayers = [
    { img: bgFarImg, speed: 0.2 },
    { img: bgMidImg, speed: 0.4 },
    { img: bgForeImg, speed: 0.6 },
  ];
}
