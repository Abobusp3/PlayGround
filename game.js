const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
  time: document.getElementById('timeLabel'),
  power: document.getElementById('powerLabel'),
  battery: document.getElementById('batteryLabel'),
  status: document.getElementById('statusLabel'),
  message: document.getElementById('messageBox'),
  objectives: document.getElementById('objectiveList'),
  inventory: document.getElementById('inventoryList'),
  interact: document.getElementById('interactButton'),
  camera: document.getElementById('cameraButton'),
  flashlight: document.getElementById('flashlightButton')
};

const world = {
  width: canvas.width,
  height: canvas.height,
  timeMinutes: 22 * 60,
  power: 82,
  battery: 100,
  flashlightOn: true,
  cameraOpen: false,
  gameOver: false,
  ending: null,
  inventory: ['Flashlight'],
  danger: 0,
};

const state = {
  fuelCanFound: false,
  keyFound: false,
  officeUnlocked: false,
  stationLog: false,
  generatorRefilled: false,
  sawForest: false,
};

const player = {
  x: 170,
  y: 430,
  radius: 12,
  speed: 125,
  facingX: 1,
  facingY: 0,
};

const keysHeld = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

const stations = {
  pumpLane: { x: 120, y: 90, w: 210, h: 80, label: 'Pump lane' },
  register: { x: 255, y: 170, w: 60, h: 46, label: 'Counter' },
  garage: { x: 500, y: 150, w: 90, h: 24, label: 'Garage' },
  office: { x: 650, y: 180, w: 70, h: 54, label: 'Office' },
  generator: { x: 540, y: 250, w: 46, h: 50, label: 'Generator' },
  forest: { x: 760, y: 430, w: 120, h: 120, label: 'Forest edge' },
};

const items = [
  { id: 'battery', x: 320, y: 300, label: 'Battery', found: false },
  { id: 'fuelCan', x: 440, y: 450, label: 'Fuel Can', found: false },
  { id: 'key', x: 760, y: 240, label: 'Maintenance Key', found: false },
  { id: 'newspaper', x: 705, y: 410, label: 'Old newspaper', found: false },
  { id: 'radio', x: 160, y: 260, label: 'Portable radio', found: false },
];

const customers = [
  { x: 160, y: 250, name: 'Customer', active: true },
  { x: 350, y: 490, name: 'Trucker', active: false },
  { x: 820, y: 530, name: 'Watcher', active: false },
];

const cameraFeeds = [
  { name: 'Pump lane', x: 110, y: 70, w: 180, h: 120 },
  { name: 'Truck bay', x: 350, y: 70, w: 170, h: 120 },
  { name: 'Forest road', x: 560, y: 70, w: 180, h: 120 },
];

function formatClock(minutes) {
  const total = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function setMessage(text) {
  ui.message.textContent = text;
}

function addItem(name) {
  if (!world.inventory.includes(name)) {
    world.inventory.push(name);
  }
}

function objectiveText() {
  if (world.gameOver) return [world.ending ? `Ending: ${world.ending}` : 'Morning has arrived.'];
  if (!state.fuelCanFound) return ['Find fuel for the generator.'];
  if (!state.generatorRefilled) return ['Refuel the generator at the station.'];
  if (!state.keyFound) return ['Search the counter for the maintenance key.'];
  if (!state.officeUnlocked) return ['Unlock the office and learn the station’s secret.'];
  return ['Choose whether to flee or stay for the truth before dawn.'];
}

function updateHUD() {
  ui.time.textContent = formatClock(world.timeMinutes);
  ui.power.textContent = `${Math.round(world.power)}%`;
  ui.battery.textContent = `${Math.round(world.battery)}%`;
  ui.status.textContent = world.gameOver ? (world.ending === 'escape' ? 'Escaped' : (world.ending === 'survive' ? 'Survived' : 'Lost')) : (world.flashlightOn ? 'Flashlight on' : 'Flashlight out');

  ui.objectives.innerHTML = objectiveText().map(item => `<li>${item}</li>`).join('');
  ui.inventory.innerHTML = world.inventory.map(item => `<li>${item}</li>`).join('') || '<li>Empty</li>';
}

function triggerEnding(ending, text) {
  world.gameOver = true;
  world.ending = ending;
  setMessage(text);
  statusLabelUpdate();
}

function statusLabelUpdate() {
  if (world.gameOver) {
    ui.status.textContent = world.ending === 'escape' ? 'Escaped' : (world.ending === 'survive' ? 'Survived' : 'Lost');
  }
}

function nearestThing() {
  for (const item of items) {
    if (!item.found && Math.hypot(player.x - item.x, player.y - item.y) < 32) {
      return { type: 'item', item };
    }
  }

  for (const [name, station] of Object.entries(stations)) {
    if (Math.hypot(player.x - (station.x + station.w / 2), player.y - (station.y + station.h / 2)) < 40) {
      return { type: 'station', name };
    }
  }

  return null;
}

function pickup(item) {
  item.found = true;
  addItem(item.label);
  setMessage(`${item.label} recovered.`);

  if (item.id === 'battery') {
    world.battery = Math.min(100, world.battery + 25);
  }
  if (item.id === 'fuelCan') {
    state.fuelCanFound = true;
    setMessage('A full fuel can. The generator can be saved.');
  }
  if (item.id === 'newspaper') {
    setMessage('The paper reads: “Witnesses say the station guards its own dark after midnight.”');
  }
  if (item.id === 'radio') {
    setMessage('The radio crackles with a whisper: “Do not let it in.”');
  }
  if (item.id === 'key') {
    state.keyFound = true;
    setMessage('The maintenance key fits the office lock.');
  }
}

function interact() {
  if (world.gameOver) return;

  const near = nearestThing();

  if (!near) {
    setMessage('Nothing nearby. Keep moving.');
    return;
  }

  if (near.type === 'item') {
    pickup(near.item);
    return;
  }

  const { name } = near;

  if (name === 'generator') {
    if (!state.fuelCanFound) {
      setMessage('The generator is dead. You need fuel.');
      return;
    }
    if (!state.generatorRefilled) {
      state.generatorRefilled = true;
      world.power = 100;
      setMessage('You feed the generator a fresh can of fuel. The station lights return.');
      return;
    }
    setMessage('The generator is stable and humming.');
    return;
  }

  if (name === 'register') {
    if (!state.keyFound && !items.find(item => item.id === 'key').found) {
      const keyItem = items.find(item => item.id === 'key');
      keyItem.found = false;
      pickup(keyItem);
      return;
    }
    setMessage('The drawer is empty. The station feels wrong.');
    return;
  }

  if (name === 'office') {
    if (!state.keyFound) {
      setMessage('The office is locked. The maintenance key must be nearby.');
      return;
    }
    if (!state.officeUnlocked) {
      state.officeUnlocked = true;
      state.stationLog = true;
      addItem('Station Log');
      setMessage('Inside the office: a logbook describes a “watcher” that waits for stragglers after midnight.');
      return;
    }
    setMessage('The office log is cold and damp. Someone kept writing in here.');
    return;
  }

  if (name === 'forest') {
    if (state.officeUnlocked) {
      triggerEnding('escape', 'You run toward the road as the forest behind you goes still. Sunrise finds you alive.');
      return;
    }
    setMessage('The forest is too deep and too dark. Something waits beyond the tree line.');
    return;
  }

  if (name === 'pumpLane') {
    setMessage('The pump lane is empty, but the fog keeps moving like it has a mind of its own.');
  }
}

function useCamera() {
  world.cameraOpen = !world.cameraOpen;
  setMessage(world.cameraOpen ? 'Security feeds flicker to life. The pump lane and forest road are visible.' : 'The cameras go dark again.');
}

function toggleFlashlight() {
  world.flashlightOn = !world.flashlightOn;
  setMessage(world.flashlightOn ? 'Flashlight on. The world sharpens around you.' : 'Flashlight off. The dark begins to breathe.');
}

function updateWorld(dt) {
  world.timeMinutes += dt * 6;

  const powerUse = world.flashlightOn ? 0.14 : 0.06;
  world.power = Math.max(0, Math.min(100, world.power - (powerUse * dt) + (state.generatorRefilled ? 0.18 * dt : 0)));
  world.battery = Math.max(0, world.battery - (world.flashlightOn ? dt * 0.12 : 0));

  if (world.battery <= 0 && world.flashlightOn) {
    world.flashlightOn = false;
    setMessage('Your flashlight dies. The dark closes in.');
  }

  if (world.timeMinutes >= 30 * 60) {
    if (world.power > 0 && state.officeUnlocked) {
      triggerEnding('survive', 'Dawn breaks. The station survives the night, but the truth still watches from the woods.');
    } else if (world.power > 20) {
      triggerEnding('survive', 'Morning arrives by a thread. The station holds on, but you are too late to know what waited here.');
    } else {
      triggerEnding('lost', 'The power fails before dawn. The station dies with the last shift still inside it.');
    }
    return;
  }

  if (world.timeMinutes >= 23 * 60 && !state.sawForest) {
    state.sawForest = true;
    setMessage('A shape passes between the trees near the forest edge. It pauses and looks back.');
  }

  if (world.timeMinutes >= 26 * 60 && world.timeMinutes < 27 * 60) {
    customers[1].active = true;
  }
  if (world.timeMinutes >= 28 * 60) {
    customers[2].active = true;
  }

  if (world.power <= 12 && world.timeMinutes >= 4 * 60) {
    world.danger = Math.min(1, world.danger + dt * 0.08);
    if (world.danger > 0.6) {
      setMessage('The station flickers. Something in the dark is drifting closer.');
    }
  }
}

function updatePlayer(dt) {
  let dx = 0;
  let dy = 0;
  if (keysHeld.ArrowUp) dy -= 1;
  if (keysHeld.ArrowDown) dy += 1;
  if (keysHeld.ArrowLeft) dx -= 1;
  if (keysHeld.ArrowRight) dx += 1;

  if (dx || dy) {
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
    player.x = Math.max(50, Math.min(world.width - 50, player.x));
    player.y = Math.max(50, Math.min(world.height - 50, player.y));
    player.facingX = dx;
    player.facingY = dy;
  }
}

function drawBackground() {
  ctx.fillStyle = '#07140f';
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.fillStyle = '#0e1d20';
  ctx.fillRect(60, 60, 820, 470);

  ctx.fillStyle = '#8aa0a9';
  ctx.fillRect(90, 120, 140, 90);
  ctx.fillRect(260, 120, 140, 90);
  ctx.fillRect(660, 150, 120, 115);
  ctx.fillRect(410, 120, 170, 220);

  ctx.fillStyle = '#2f3d42';
  ctx.fillRect(90, 210, 140, 150);
  ctx.fillRect(260, 210, 140, 150);
  ctx.fillRect(660, 270, 120, 90);
  ctx.fillRect(470, 360, 130, 110);

  ctx.fillStyle = '#4b4335';
  ctx.fillRect(120, 440, 150, 60);
  ctx.fillRect(730, 430, 130, 90);
  ctx.fillRect(540, 265, 62, 70);

  ctx.fillStyle = '#1a1d26';
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.fillStyle = 'rgba(190, 240, 255, 0.08)';
  for (let i = 0; i < 60; i++) {
    const x = ((i * 133) + (performance.now() * 0.04)) % (world.width + 50);
    const y = ((i * 71) + (performance.now() * 0.02)) % (world.height + 50);
    ctx.fillRect(x - 25, y - 25, 2, 2);
  }
}

function drawStations() {
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#dfeffc';
  Object.values(stations).forEach((station) => {
    ctx.fillText(station.label, station.x + 6, station.y - 8);
  });

  ctx.fillStyle = '#5a5648';
  for (const station of Object.values(stations)) {
    ctx.fillRect(station.x, station.y, station.w, station.h);
  }
}

function drawItems() {
  for (const item of items) {
    if (item.found) continue;
    const color = item.id === 'battery' ? '#f7d874' : item.id === 'fuelCan' ? '#ff9f67' : item.id === 'key' ? '#cfe3ff' : '#dce9f0';
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(item.x, item.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCustomers() {
  for (const customer of customers) {
    if (!customer.active) continue;
    ctx.beginPath();
    ctx.fillStyle = customer.name === 'Watcher' ? '#d9d4ff' : '#d3a66d';
    ctx.arc(customer.x, customer.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  ctx.beginPath();
  ctx.fillStyle = '#edf5ff';
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = '#9fc8ef';
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + player.facingX * 20, player.y + player.facingY * 20);
  ctx.stroke();
}

function drawCameraOverlay() {
  if (!world.cameraOpen) return;
  ctx.fillStyle = 'rgba(12, 18, 24, 0.72)';
  ctx.fillRect(0, 0, world.width, world.height);
  ctx.fillStyle = 'rgba(102, 164, 255, 0.08)';
  cameraFeeds.forEach((feed) => {
    ctx.fillRect(feed.x, feed.y, feed.w, feed.h);
    ctx.strokeStyle = '#d8ebff';
    ctx.strokeRect(feed.x, feed.y, feed.w, feed.h);
    ctx.fillStyle = '#d8ebff';
    ctx.font = '12px sans-serif';
    ctx.fillText(feed.name, feed.x + 10, feed.y + 20);
  });
}

function drawFog() {
  ctx.fillStyle = `rgba(0, 0, 0, ${world.flashlightOn ? 0.45 : 0.7})`;
  ctx.fillRect(0, 0, world.width, world.height);

  if (world.flashlightOn) {
    const grad = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, 190);
    grad.addColorStop(0, 'rgba(255,255,210,0.9)');
    grad.addColorStop(0.18, 'rgba(255,255,220,0.35)');
    grad.addColorStop(1, 'rgba(8, 12, 16, 0.05)');
    ctx.fillStyle = grad;
    ctx.fillRect(player.x - 200, player.y - 200, 400, 400);
  }
}

function draw() {
  drawBackground();
  drawStations();
  drawItems();
  drawCustomers();
  drawPlayer();
  drawCameraOverlay();
  drawFog();
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
  last = ts;

  if (!world.gameOver) {
    updatePlayer(dt);
    updateWorld(dt);
  }

  updateHUD();
  draw();
  requestAnimationFrame(loop);
}

function handleMoveKey(event, isDown) {
  if (event.key in keysHeld) {
    keysHeld[event.key] = isDown;
    event.preventDefault();
  }
  if (!isDown || event.repeat) return;
  if (event.key === 'e' || event.key === 'E') interact();
  if (event.key === 'c' || event.key === 'C') useCamera();
  if (event.key === 'f' || event.key === 'F') toggleFlashlight();
}

document.addEventListener('keydown', (event) => handleMoveKey(event, true));
document.addEventListener('keyup', (event) => handleMoveKey(event, false));

ui.interact.addEventListener('click', interact);
ui.camera.addEventListener('click', useCamera);
ui.flashlight.addEventListener('click', toggleFlashlight);

document.querySelectorAll('.move-btn').forEach((button) => {
  const key = button.dataset.key;
  const press = (event) => {
    event.preventDefault();
    keysHeld[key] = true;
  };
  const release = (event) => {
    event.preventDefault();
    keysHeld[key] = false;
  };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointerleave', release);
  button.addEventListener('pointercancel', release);
});

setMessage('Your shift begins. Keep the station fueled, the dark out, and yourself alive until morning.');
updateHUD();
requestAnimationFrame(loop);
