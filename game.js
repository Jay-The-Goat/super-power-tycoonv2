import { Renderer3D, R6Rig } from './engine.js';

const canvas = document.getElementById('gameCanvas');
const engine = new Renderer3D(canvas);

// 1. SUPER CITY MAP & CENTRAL CAPTURE POINT
engine.addBox(22, 0.2, 180, '#3a3a3c', 0, 0.1, 0);
engine.addBox(180, 0.2, 22, '#3a3a3c', 0, 0.1, 0);

const capturePad = engine.addBox(14, 0.4, 14, '#8e8e93', 0, 0.25, 0);
engine.addLabel('City Capture Point (+25% Cash)', 0, 3.2, 0);
let captureProgress = 0;
let pointCaptured = false;

// 2. YOUR TYCOON BASE
const BASE_Z = -42;
engine.addBox(34, 0.4, 42, '#7f8c8d', 0, 0.2, BASE_Z);
engine.addBox(12, 0.45, 10, '#2c3e50', 0, 0.22, BASE_Z + 24);

// 3. R6 CHARACTER
const player = new R6Rig(engine, 0, 0, BASE_Z + 25);
player.ry = 0;

// 4. DIRECT-FLOW CASH COLLECTORS
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
  vault1Label.text = 'Collect: $' + Math.floor(floor1Vault);
  if (hasFloor2 && vault2Label) {
    vault2Label.text = '2F Collect: $' + Math.floor(floor2Vault);
  }
}

setInterval(() => {
  const totalBoost = upgraderMult * (pointCaptured ? 1.25 : 1.0);
  if (floor1Income > 0) {
    floor1Vault += floor1Income * totalBoost;
  }
  if (hasFloor2 && floor2Income > 0) {
    floor2Vault += floor2Income * totalBoost;
  }
  if (floor1Income > 0 || floor2Income > 0) {
    updateVaultLabels();
  }
}, 1500);

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t.timer);
  t.timer = setTimeout(() => {
    t.style.opacity = '0';
  }, 1800);
}

// 5. SUPER POWERS & PEDESTALS
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
  hotbar.innerHTML = '';
  for (let i = 0; i < equippedPowers.length; i++) {
    const p = equippedPowers[i];
    const slot = document.createElement('div');
    slot.className = activeSlot === p.id ? 'slot active' : 'slot';
    slot.innerHTML = '<span>[' + (i + 1) + ']</span><div style="color:#fff">' + p.name + '</div>';
    slot.addEventListener('click', () => selectPower(p.id));
    hotbar.appendChild(slot);
  }
}

function selectPower(id) {
  activeSlot = id;
  renderHotbar();
  powerBtn.style.display = 'flex';
  if (id === 'speed') {
    walkSpeed = 0.58;
    isFlying = false;
    powerBtn.textContent = 'DASH';
  } else if (id === 'flight') {
    walkSpeed = 0.38;
    powerBtn.textContent = isFlying ? 'LAND' : 'FLY';
  } else if (id === 'laser') {
    walkSpeed = 0.28;
    isFlying = false;
    powerBtn.textContent = 'LASER';
  } else if (id === 'smash') {
    walkSpeed = 0.28;
    isFlying = false;
    powerBtn.textContent = 'SMASH';
  } else {
    walkSpeed = 0.28;
    isFlying = false;
    powerBtn.textContent = 'BLAST';
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

powerBtn.addEventListener('touchstart', e => {
  e.preventDefault();
  triggerActivePower();
}, { passive: false });
powerBtn.addEventListener('click', triggerActivePower);

// 6. TYCOON BUTTONS
const buttons = [];
function addButton(label, cost, x, y, z, color, floorReq, onBuy) {
  const pad = engine.addBox(3.4, 0.4, 3.4, color, x, y + 0.4, z);
  const text = cost === 0 ? label + ' (FREE)' : label + ' ($' + cost + ')';
  const sprite = engine.addLabel(text, x, y + 2.2, z);
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

// 7. SUPER VILLAIN NPCs
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
