import { Renderer3D, R6Rig } from './engine.js';

const canvas = document.getElementById('gameCanvas');
const engine = new Renderer3D(canvas);

// --- 1. SUPER CITY MAP & CENTRAL CAPTURE POINT ---
engine.addBox(22, 0.2, 180, '#3a3a3c', 0, 0.1, 0); // North-South City Road
engine.addBox(180, 0.2, 22, '#3a3a3c', 0, 0.1, 0); // East-West City Road

const capturePad = engine.addBox(14, 0.4, 14, '#8e8e93', 0, 0.25, 0);
engine.addLabel('City Capture Point (+25% Cash)', 0, 3.2, 0);
let captureProgress = 0;
let pointCaptured = false;

// --- 2. YOUR TYCOON BASE (Z = -42) ---
const BASE_Z = -42;
engine.addBox(34, 0.4, 42, '#7f8c8d', 0, 0.2, BASE_Z); // 1st Floor Pad
engine.addBox(12, 0.45, 10, '#2c3e50', 0, 0.22, BASE_Z + 24); // Spawn Walkway

// --- 3. R6 CHARACTER ---
const player = new R6Rig(engine, 0, 0, BASE_Z + 25);
player.ry = 0; // Facing North (-Z) right into the Tycoon Base!

// --- 4. DIRECT-FLOW CASH COLLECTORS ---
let cash = 0;
let floor1Vault = 0;
let floor2Vault = 0;
let floor1Income = 0;
let floor2Income = 0;
let upgraderMult = 1.0;

engine.addBox(5, 0.5, 5, '#2ecc71', -11, 0.45, BASE_Z + 12);
const vault1Label = engine.addLabel('Collect: $0', -11, 2.5, BASE_Z + 12);
let vault2Label = null;
let hasFloor2 = false;

function updateCash(amount) {
  cash = Math.floor(cash + amount);
  document.getElementById('cashDisplay').textContent = cash;
  document.getElementById('lbCash').textContent = '$' + cash;
}

function updateVaultLabels() {
  const totalBoost = upgraderMult * (pointCaptured ? 1.25 : 1.0);
  document.getElementById('lbBoost').textContent = totalBoost.toFixed(2) + 'x';
  vault1Label.text = `Collect: $${Math.floor(floor1Vault)}`;
  if (hasFloor2 && vault2Label) {
    vault2Label.text = `2F Collect: $${Math.floor(floor2Vault)}`;
  }
}

setInterval(() => {
  const totalBoost = upgraderMult * (pointCaptured ? 1.25 : 1.0);
  if (floor1Income > 0) floor1Vault += floor1Income * totalBoost;
  if (hasFloor2 && floor2Income > 0) floor2Vault += floor2Income * totalBoost;
  if (floor1Income > 0 || floor2Income > 0) updateVaultLabels();
}, 1500);

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.opacity = 1;
  clearTimeout(t.timer);
  t.timer = setTimeout(() => t.style.opacity = 0, 1800);
}

// --- 5. SUPER POWERS & PEDESTALS ---
let equippedPowers = [];
let activeSlot = null;
let isFlying = false;
let walkSpeed = 0.28;
let playerHP = 100;
let kos = 0;

const pedestals = [];
const hotbar = document.getElementById('hotbar');
const powerBtn = document.getElementById('power-btn');

function createPedestal(id, name, color, x, y, z) {
  engine.addBox(2.4, 1.2, 2.4, '#222222', x, y + 0.6, z);
  const orb = engine.addBox(1.3, 1.3, 1.3, color, x, y + 2.2, z);
  engine.addLabel(name, x, y + 3.6, z);
  pedestals.push({ id, name, color, x, y, z, orb });
  givePowerToPlayer(id, name, color);
}

function givePowerToPlayer(id, name, color) {
  if (equippedPowers.find(p => p.id === id)) return;
  equippedPowers.push({ id, name, color });
  renderHotbar();
  selectPower(id);
}

function renderHotbar() {
  hotbar.innerHTML = equippedPowers.map((p, idx) => `
    <div class="slot ${activeSlot === p.id ? 'active' : ''}" data-power="${p.id}">
      <span>[${idx + 1}]</span>
      <div style="color:#fff">${p.name}</div>
    </div>
  `).join('');

  hotbar.querySelectorAll('.slot').forEach(el => {
    el.addEventListener('click', () => selectPower(el.dataset.power));
  });
}

function selectPower(id) {
  activeSlot = id;
  renderHotbar();
  powerBtn.style.display = 'flex';
  if (id === 'speed') {
    walkSpeed = 0.58; isFlying = false; powerBtn.textContent = 'DASH';
  } else if (id === 'flight') {
    walkSpeed = 0.38; powerBtn.textContent = isFlying ? 'LAND' : 'FLY';
  } else if (id === 'laser') {
    walkSpeed = 0.28; isFlying = false; powerBtn.textContent = 'LASER';
  } else if (id === 'smash') {
    walkSpeed = 0.28; isFlying = false; powerBtn.textContent = 'SMASH';
  } else {
    walkSpeed = 0.28; isFlying = false; powerBtn.textContent = 'BLAST';
  }
}

const projectiles = [];
function shootProjectile(color, speed, size, dmg) {
  const dirX = -Math.sin(camYaw);
  const dirZ = -Math.cos(camYaw);
  player.ry = Math.atan2(-dirX, -dirZ);
  const orb = engine.addBox(size, size, size, color, player.x + dirX * 2, player.y + 3.2, player.z + dirZ * 2);
  projectiles.push({ mesh: orb, dx: dirX, dz: dirZ, speed, dmg, life: 70 });
}

function triggerActivePower() {
  if (!activeSlot) return;
  if (activeSlot === 'blast') {
    shootProjectile('#00e5ff', 0.95, 1.2, 40);
  } else if (activeSlot === 'laser') {
    shootProjectile('#ff2d55', 1.65, 0.7, 65);
  } else if (activeSlot === 'speed') {
    player.x -= Math.sin(camYaw) * 7;
    player.z -= Math.cos(camYaw) * 7;
  } else if (activeSlot === 'flight') {
    isFlying = !isFlying;
    powerBtn.textContent = isFlying ? 'LAND' : 'FLY';
  } else if (activeSlot === 'smash') {
    const ring = engine.addBox(14, 0.4, 14, '#ff9500', player.x, player.y + 0.3, player.z, 0.6);
    setTimeout(() => engine.removeBox(ring), 300);
    for (const en of enemies) {
      if (Math.hypot(en.rig.x - player.x, en.rig.z - player.z) < 9) {
        damageEnemy(en, 100);
      }
    }
  }
}

powerBtn.addEventListener('touchstart', e => { e.preventDefault(); triggerActivePower(); }, { passive: false });
powerBtn.addEventListener('click', triggerActivePower);

// --- 6. TYCOON BUTTONS ---
const buttons = [];
function addButton(label, cost, x, y, z, color, floorReq, onBuy) {
  const pad = engine.addBox(3.4, 0.4, 3.4, color, x, y + 0.4, z);
  const sprite = engine.addLabel(cost === 0 ? `${label} (FREE)` : `${label} ($${cost})`, x, y + 2.2, z);
  buttons.push({ pad, sprite, cost, x, y, z, floorReq, bought: false, onBuy });
}

addButton('Claim Extractor 1', 0, -11, 0, BASE_Z + 4, '#34c759', 1, () => {
  floor1Income += 25;
  engine.addBox(3, 5, 3, '#34495e', -13, 2.7, BASE_Z + 4);
  engine.addBox(1.5, 1.5, 1.5, '#34c759', -13, 5.8, BASE_Z + 4);
  showToast('Extractor 1 Started (+$25/tick)!');
});

addButton('Extractor 2', 200, -11, 0, BASE_Z - 3, '#34c759', 1, () => {
  floor1Income += 25;
  engine.addBox(3, 5, 3, '#34495e', -13, 2.7, BASE_Z - 3);
  engine.addBox(1.5, 1.5, 1.5, '#34c759', -13, 5.8, BASE_Z - 3);
  showToast('Extractor 2 Built (+$25/tick)!');
});

addButton('Power Upgrader (+25%)', 600, -11, 0, BASE_Z - 10, '#af52de', 1, () => {
  upgraderMult += 0.25;
  engine.addBox(4, 6, 4, '#5e5ce6', -13, 3.2, BASE_Z - 10);
  showToast('Output Boosted +25%!');
});

addButton('Hyper Extractor', 1500, -11, 0, BASE_Z - 16, '#ff9500', 1, () => {
  floor1Income += 125;
  engine.addBox(4, 7, 4, '#ff9500', -13, 3.7, BASE_Z - 16);
  showToast('Hyper Extractor Built (+$125/tick)!');
});

addButton('Base Walls & Laser Door', 300, 4, 0, BASE_Z + 16, '#00d2ff', 1, () => {
  engine.addBox(34, 10, 1, '#95a5a6', 0, 5.2, BASE_Z - 20.5);
  engine.addBox(1, 10, 42, '#95a5a6', -16.5, 5.2, BASE_Z);
  engine.addBox(1, 10, 42, '#95a5a6', 16.5, 5.2, BASE_Z);
  engine.addBox(12, 10, 1, '#95a5a6', -11, 5.2, BASE_Z + 20.5);
  engine.addBox(12, 10, 1, '#95a5a6', 11, 5.2, BASE_Z + 20.5);
  engine.addBox(10, 9, 0.4, '#00e5ff', 0, 4.7, BASE_Z + 20.5, 0.35);
  showToast('Owner-Only Laser Door Built!');
});

addButton('Power: Magic Blast', 150, 9, 0, BASE_Z + 8, '#00e5ff', 1, () => {
  createPedestal('blast', 'Magic Blast', '#00e5ff', 13, 0, BASE_Z + 8);
  showToast('Unlocked Magic Blast!');
});

addButton('Power: Super Speed', 500, 9, 0, BASE_Z + 1, '#ffcc00', 1, () => {
  createPedestal('speed', 'Super Speed', '#ffcc00', 13, 0, BASE_Z + 1);
  showToast('Unlocked Super Speed!');
});

addButton('Power: Ground Smash', 1200, 9, 0, BASE_Z - 6, '#ff9500', 1, () => {
  createPedestal('smash', 'Ground Smash', '#ff9500', 13, 0, BASE_Z - 6);
  showToast('Unlocked Ground Smash!');
});

addButton('Buy 2nd Floor', 5000, 0, 0, BASE_Z - 14, '#ff2d55', 1, () => {
  hasFloor2 = true;
  engine.addBox(34, 0.6, 42, '#7f8c8d', 0, 10.5, BASE_Z);
  engine.addBox(34, 10, 1, '#95a5a6', 0, 15.5, BASE_Z - 20.5);
  engine.addBox(1, 10, 42, '#95a5a6', -16.5, 15.5, BASE_Z);
  engine.addBox(1, 10, 42, '#95a5a6', 16.5, 15.5, BASE_Z);

  const ramp = engine.addBox(6, 0.6, 18, '#34495e', 0, 5.4, BASE_Z - 4);
  ramp.rx = Math.atan2(10.5, 15);

  engine.addBox(5, 0.6, 5, '#ffcc00', -11, 11, BASE_Z + 12);
  vault2Label = engine.addLabel('2F Collect: $0', -11, 13.5, BASE_Z + 12);
  showToast('2nd Floor Unlocked!');
});

addButton('Super Dropper', 8000, -11, 10.8, BASE_Z + 2, '#ffcc00', 2, () => {
  floor2Income += 600;
  engine.addBox(4.5, 7, 4.5, '#ffcc00', -13, 14.3, BASE_Z + 2);
  showToast('Super Dropper Built (+$600/tick)!');
});

addButton('Power: Hero Flight', 10000, 9, 10.8, BASE_Z + 6, '#34c759', 2, () => {
  createPedestal('flight', 'Hero Flight', '#34c759', 13, 10.8, BASE_Z + 6);
  showToast('Unlocked Hero Flight!');
});

addButton('Power: Laser Vision', 15000, 9, 10.8, BASE_Z - 3, '#ff2d55', 2, () => {
  createPedestal('laser', 'Laser Vision', '#ff2d55', 13, 10.8, BASE_Z - 3);
  showToast('Unlocked Laser Vision!');
});

// --- 7. SUPER VILLAIN NPCs ---
const enemies = [];
function spawnVillain(x, z) {
  const rig = new R6Rig(engine, x, 0, z, '#8e44ad', '#333333', '#111111');
  enemies.push({ rig, hp: 100, cooldown: 0, walk: 0 });
}
spawnVillain(-18, 12);
spawnVillain(18, 12);
spawnVillain(0, 28);
spawnVillain(28, -10);

function damageEnemy(en, dmg) {
  en.hp -= dmg;
  if (en.hp <= 0) {
    kos++;
    document.getElementById('lbKOs').textContent = kos;
    updateCash(150);
    showToast('Villain Smashed! +$150');
    en.hp = 100;
    en.rig.x = (Math.random() - 0.5) * 70;
    en.rig.z = 10 + Math.random() * 35;
  }
}

function damagePlayer(dmg) {
  playerHP -= dmg;
  if (playerHP <= 0) {
    playerHP = 100;
    equippedPowers = [];
    activeSlot = null;
    isFlying = false;
    walkSpeed = 0.28;
    renderHotbar();
    powerBtn.style.display = 'none';
    player.x = 0;
    player.y = 0;
player.z = BASE_Z + 25;
showToast('Knocked Out! Touch pedestals in base to re-equip powers.');
}
document.getElementById('hp-bar').style.width = playerHP + '%';
}
// --- 8. UNIVERSAL CONTROLS (PC & MOBILE) ---
let touchMoveX = 0, touchMoveZ = 0, velY = 0, isGrounded = true;
const keys = {};
const joyZone = document.getElementById('joystick-zone');
const joyKnob = document.getElementById('joystick-knob');
const jumpBtn = document.getElementById('jump-btn');
function doJump() {
if (isFlying) {
player.y += 3;
} else if (isGrounded) {
velY = 0.45;
isGrounded = false;
}
}
window.addEventListener('keydown', e => {
const k = e.key.toLowerCase();
keys[k] = true;
if (e.code === 'Space') doJump();
if (k === 'e') triggerActivePower();
if (['1', '2', '3', '4', '5'].includes(k)) {
const idx = parseInt(k) - 1;
if (equippedPowers[idx]) selectPower(equippedPowers[idx].id);
}
});
window.addEventListener('keyup', e => {
keys[e.key.toLowerCase()] = false;
});
let camYaw = 0;
let camPitch = 0.35;
let camDist = 17;
let isMouseDragging = false;
let mouseMoved = false;
let lastMouseX = 0, lastMouseY = 0;
canvas.addEventListener('mousedown', e => {
isMouseDragging = true;
mouseMoved = false;
lastMouseX = e.clientX;
lastMouseY = e.clientY;
});
window.addEventListener('mousemove', e => {
if (!isMouseDragging) return;
const dx = e.clientX - lastMouseX;
const dy = e.clientY - lastMouseY;
if (Math.hypot(dx, dy) > 3) mouseMoved = true;
camYaw -= dx * 0.007;
camPitch = Math.max(-0.15, Math.min(1.25, camPitch + dy * 0.007));
lastMouseX = e.clientX;
lastMouseY = e.clientY;
});
window.addEventListener('mouseup', e => {
if (isMouseDragging && !mouseMoved && e.button === 0) {
triggerActivePower();
}
isMouseDragging = false;
});
window.addEventListener('wheel', e => {
camDist = Math.max(7, Math.min(34, camDist + e.deltaY * 0.01));
});
let joyTouchId = null;
joyZone.addEventListener('touchstart', e => {
e.preventDefault();
const t = e.changedTouches;
joyTouchId = t.identifier;
handleJoy(t);
}, { passive: false });
joyZone.addEventListener('touchmove', e => {
e.preventDefault();
for (let i = 0; i < e.changedTouches.length; i++) {
if (e.changedTouches[i].identifier === joyTouchId) handleJoy(e.changedTouches[i]);
}
}, { passive: false });
function resetJoy() {
joyTouchId = null;
touchMoveX = 0;
touchMoveZ = 0;
joyKnob.style.transform = translate(0px, 0px);
}
joyZone.addEventListener('touchend', resetJoy);
joyZone.addEventListener('touchcancel', resetJoy);
function handleJoy(t) {
const rect = joyZone.getBoundingClientRect();
let dx = t.clientX - (rect.left + rect.width / 2);
let dy = t.clientY - (rect.top + rect.height / 2);
const max = 38, dist = Math.hypot(dx, dy);
if (dist > max) {
dx = (dx / dist) * max;
dy = (dy / dist) * max;
}
joyKnob.style.transform = translate(${dx}px, ${dy}px);
touchMoveX = dx / max;
touchMoveZ = dy / max;
}
jumpBtn.addEventListener('touchstart', e => { e.preventDefault(); doJump(); }, { passive: false });
jumpBtn.addEventListener('click', doJump);
let lookTouchId = null, lastTouchX = 0, lastTouchY = 0;
canvas.addEventListener('touchstart', e => {
for (let i = 0; i < e.changedTouches.length; i++) {
const t = e.changedTouches[i];
if (lookTouchId === null && t.identifier !== joyTouchId) {
lookTouchId = t.identifier;
lastTouchX = t.clientX;
lastTouchY = t.clientY;
}
}
}, { passive: true });
canvas.addEventListener('touchmove', e => {
for (let i = 0; i < e.changedTouches.length; i++) {
const t = e.changedTouches[i];
if (t.identifier === lookTouchId) {
camYaw -= (t.clientX - lastTouchX) * 0.008;
camPitch = Math.max(-0.15, Math.min(1.25, camPitch + (t.clientY - lastTouchY) * 0.008));
lastTouchX = t.clientX;
lastTouchY = t.clientY;
}
}
}, { passive: true });
canvas.addEventListener('touchend', e => {
for (let i = 0; i < e.changedTouches.length; i++) {
if (e.changedTouches[i].identifier === lookTouchId) lookTouchId = null;
}
});
// --- 9. MAIN GAME LOOP ---
let walkCycle = 0;
function animate() {
requestAnimationFrame(animate);
let inputX = touchMoveX;
let inputZ = touchMoveZ;
if (keys['w'] || keys['arrowup']) inputZ -= 1;
if (keys['s'] || keys['arrowdown']) inputZ += 1;
if (keys['a'] || keys['arrowleft']) inputX -= 1;
if (keys['d'] || keys['arrowright']) inputX += 1;
const mag = Math.hypot(inputX, inputZ);
if (mag > 0.05) {
const normX = inputX / Math.max(1, mag);
const normZ = inputZ / Math.max(1, mag);
const moveAngle = Math.atan2(-normX, -normZ) + camYaw;
player.x -= Math.sin(moveAngle) * walkSpeed;
player.z -= Math.cos(moveAngle) * walkSpeed;
player.ry = moveAngle;
walkCycle += walkSpeed * 0.9;
player.swing = Math.sin(walkCycle) * 0.85;
} else {
player.swing *= 0.8;
}
let groundHeight = 0;
if (hasFloor2) {
const inBaseX = Math.abs(player.x) < 16.5;
const inBaseZ = player.z > BASE_Z - 20.5 && player.z < BASE_Z + 20.5;
if (Math.abs(player.x) < 3.2 && player.z >= BASE_Z - 12 && player.z <= BASE_Z + 4) {
const progress = (BASE_Z + 4 - player.z) / 16;
groundHeight = Math.max(0, Math.min(10.8, progress * 10.8));
} else if (inBaseX && inBaseZ && player.y >= 9.5) {
groundHeight = 10.8;
}
}
if (isFlying) {
velY = 0;
if (player.y < groundHeight + 6) player.y += 0.2;
} else {
player.y += velY;
if (player.y > groundHeight) {
velY -= 0.022;
} else {
player.y = groundHeight;
velY = 0;
isGrounded = true;
}
}
player.sync();
if (floor1Vault > 0 && player.y < 3 && Math.hypot(player.x - (-11), player.z - (BASE_Z + 12)) < 3.2) {
updateCash(floor1Vault);
floor1Vault = 0;
updateVaultLabels();
}
if (hasFloor2 && floor2Vault > 0 && player.y > 9 && Math.hypot(player.x - (-11), player.z - (BASE_Z + 12)) < 3.2) {
updateCash(floor2Vault);
floor2Vault = 0;
updateVaultLabels();
}
for (const ped of pedestals) {
ped.orb.ry += 0.03;
if (Math.abs(player.y - ped.y) < 3 && Math.hypot(player.x - ped.x, player.z - ped.z) < 2.4) {
givePowerToPlayer(ped.id, ped.name, ped.color);
}
}
for (const b of buttons) {
if (b.bought) continue;
if (b.floorReq === 2 && !hasFloor2) continue;
if (Math.abs(player.y - b.y) < 3 && Math.hypot(player.x - b.x, player.z - b.z) < 2.3) {
if (cash >= b.cost) {
updateCash(-b.cost);
b.bought = true;
engine.removeBox(b.pad);
engine.removeLabel(b.sprite);
b.onBuy();
updateVaultLabels();
} else {
showToast(Need $${b.cost}!);
}
}
}
if (!pointCaptured && Math.hypot(player.x, player.z) < 7.5) {
captureProgress += 0.5;
if (captureProgress >= 100) {
pointCaptured = true;
capturePad.color = '#34c759';
showToast('City Point Captured! +25% Cash Boost Active!');
updateVaultLabels();
}
}
for (let i = projectiles.length - 1; i >= 0; i--) {
const p = projectiles[i];
p.mesh.x += p.dx * p.speed;
p.mesh.z += p.dz * p.speed;
p.life--;
for (const en of enemies) {
if (Math.hypot(p.mesh.x - en.rig.x, p.mesh.z - en.rig.z) < 2.6) {
damageEnemy(en, p.dmg);
p.life = 0;
}
}
if (p.life <= 0) {
engine.removeBox(p.mesh);
projectiles.splice(i, 1);
}
}
for (const en of enemies) {
const distToPlayer = Math.hypot(player.x - en.rig.x, player.z - en.rig.z);
const playerInsideBase = Math.abs(player.x) < 16 && player.z < BASE_Z + 20;
if (distToPlayer < 35 && !playerInsideBase) {
const ang = Math.atan2(-(player.x - en.rig.x), -(player.z - en.rig.z));
en.rig.x -= Math.sin(ang) * 0.14;
en.rig.z -= Math.cos(ang) * 0.14;
en.rig.ry = ang;
en.walk += 0.18;
en.rig.swing = Math.sin(en.walk) * 0.8;
if (distToPlayer < 2.5 && en.cooldown <= 0) {
damagePlayer(15);
en.cooldown = 45;
}
} else {
en.rig.swing *= 0.8;
}
en.rig.sync();
if (en.cooldown > 0) en.cooldown--;
}
// Camera position looking at player
const targetY = player.y + 3.2;
const horizDist = camDist * Math.cos(camPitch);
engine.cam.x = player.x + Math.sin(camYaw) * horizDist;
engine.cam.z = player.z + Math.cos(camYaw) * horizDist;
engine.cam.y = Math.max(1.2, targetY + Math.sin(camPitch) * camDist);
engine.cam.yaw = camYaw;
engine.cam.pitch = camPitch;
engine.render();
}
animate();