"use strict";
function format(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const cs = Math.max(0, Math.round(seconds * 100));
  return (
    Math.floor(cs / 6000) +
    ":" +
    String(Math.floor(cs / 100) % 60).padStart(2, "0") +
    "," +
    String(cs % 100).padStart(2, "0")
  );
}
const modeInfo = {
  gp: [
    "Três voltas contra sete pilotos. Cruze a linha de chegada em primeiro.",
    3,
    7,
  ],
  quick: ["Duas voltas contra sete pilotos no circuito escolhido.", 2, 7],
  tt: [
    "Três voltas solo. Bata sua melhor volta e dispute com a gravação da classe.",
    3,
    0,
  ],
  training: ["Uma volta solo com orientações para aprender a pilotar.", 1, 0],
};
let state = "menu",
  prior = "",
  racers = [],
  player = null,
  ghost = null,
  ghostData = null,
  trace = [],
  lapTime = 0,
  bestRace = Infinity,
  lastLap = 0,
  clock = 0,
  visualTime = 0,
  countdown = 0,
  notice = "",
  noteTime = 0,
  camMode = 0,
  held = new Set(),
  muted = !!load("mute", false),
  touch = matchMedia("(pointer:coarse)").matches,
  context,
  osc,
  gain,
  master,
  rank = 1,
  acc = 0;
const hints = [
  "Reta da largada",
  "Costa das palmeiras",
  "Lagoa das boias",
  "Saída da lagoa",
  "Dunas de areia",
  "Curva magnética",
];
function section(t) {
  return t < 0.12
    ? 0
    : t < 0.235
      ? 1
      : t < 0.43
        ? 2
        : t < 0.58
          ? 3
          : t < 0.83
            ? 4
            : 5;
}
function notify(s, t = 1.5) {
  notice = s;
  noteTime = t;
}
function wakeSound() {
  try {
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)();
      master = context.createGain();
      master.connect(context.destination);
      osc = context.createOscillator();
      gain = context.createGain();
      osc.type = "triangle";
      osc.connect(gain).connect(master);
      gain.gain.value = 0;
      osc.start();
    }
    master.gain.value = muted ? 0 : 1;
    context.resume().catch(() => {});
  } catch {}
}
function tone(f, d = 0.12) {
  if (!context || muted) return;
  const o = context.createOscillator(),
    g = context.createGain(),
    t = context.currentTime;
  o.frequency.value = f;
  g.gain.setValueAtTime(0.085, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + d);
}
function engine() {
  if (!gain) return;
  const running = state === "race" || (state === "menu" && revTime > 0);
  gain.gain.setTargetAtTime(running ? 0.042 : 0, context.currentTime, 0.05);
  osc.frequency.setTargetAtTime(
    running ? 52 + (state === "race" ? Math.abs(player.speed) * 2.8 : 85) : 45,
    context.currentTime,
    0.045,
  );
}
function options() {
  return modeInfo[$("mode").value];
}
function keyBest() {
  return (
    (trackId === 0 ? "lagoon-v2/" : "mare-viva/" + trackId + "/") +
    $("mode").value +
    "/" +
    $("cc").selectedIndex
  );
}
function currentRecord() {
  return load(keyBest(), null);
}
function readBest() {
  const data = currentRecord();
  return Number.isFinite(data?.time) && data.time > 0 ? data.time : Infinity;
}
let sectorStart = null,
  latestSplit = null,
  sectorHistory = [],
  referenceSector = null,
  sectorRoute = "Boias";
function resetSector() {
  sectorStart = null;
  sectorRoute = circuits[trackId].main;
}
function sectorClock(r, prev, dt) {
  const crossingTime = (f) =>
    clock -
    dt +
    dt *
      clamp(
        ((Math.floor((prev - f * L) / L) + 1) * L + f * L - prev) /
          (r.d - prev),
        0,
        1,
      );
  if (crossed(prev, r.d, pier.startSector)) {
    sectorStart = crossingTime(pier.startSector);
    sectorRoute = circuits[trackId].main;
  }
  if (sectorStart === null) return;
  if (r.branch) sectorRoute = circuits[trackId].branch;
  else if (
    r.drift > 0.35 &&
    r.l > 1 &&
    sectorRoute !== circuits[trackId].branch
  )
    sectorRoute = "Drift por dentro";
  if (crossed(prev, r.d, pier.endSector)) {
    const time = crossingTime(pier.endSector) - sectorStart;
    latestSplit = {
      time,
      lap: Math.floor(r.d / L),
      route: sectorRoute,
      delta: referenceSector !== null ? time - referenceSector : null,
    };
    sectorHistory.push(latestSplit);
    resetSector();
  }
}
function deltaLabel(value) {
  return value === null
    ? ""
    : (value < 0 ? " −" : " +") +
        Math.abs(value).toFixed(2).replace(".", ",") +
        " s";
}

function menuInfo() {
  let solo = !options()[2];
  const gp = $("mode").value === "gp";
  const stage = gp
    ? (cup?.rounds.length ?? 0)
    : clamp($("circuit").selectedIndex, 0, 2);
  changeCircuit(stage);
  $("circuit").selectedIndex = stage;
  $("circuit").disabled = gp;
  const cfg = circuits[stage];
  $("stageNo").textContent = "Copa Maré Viva / Circuito 0" + (stage + 1);
  $("trackName").textContent = cfg.name;
  $("stageArt").style.setProperty("--stage-tint", cfg.pale);
  $("trackBrief").textContent = cfg.details;
  $("start").textContent = gp
    ? cup
      ? "Retomar etapa " + (stage + 1)
      : "Iniciar Copa Maré Viva"
    : "Largar em " + cfg.short;
  $("description").textContent = gp
    ? cup
      ? "Progresso salvo · " +
        pilots[cup.pilot] +
        " · " +
        [100, 150, 200][cup.cc] +
        " cc."
      : "Três circuitos, três voltas por etapa. Some pontos para conquistar a copa."
    : options()[0];
  $("cc").disabled = gp && !!cup;
  $("diff").disabled = solo || (gp && !!cup);
  if (gp && cup) {
    $("cc").selectedIndex = cup.cc;
    $("diff").selectedIndex = cup.diff;
  }
  $("newCup").hidden = !(gp && cup);
  mapDraw($("mapPreview"), false);
  $("record").textContent = format(readBest());
  const old =
    trackId === 0 ? load("best/" + $("cc").selectedIndex, null) : null;
  $("previousRecord").hidden = !(Number.isFinite(old) && old > 0);
  if (!$("previousRecord").hidden)
    $("previousRecord").textContent =
      "Circuito anterior · melhor volta geral " + format(old);

  $("length").textContent =
    (L / 1000).toFixed(2).replace(".", ",") + " km / volta";
}
function switchCanvas(racing) {
  let host = $(racing ? "raceview" : "showview");
  host.appendChild(renderer.domElement);
  resize();
}
function resize() {
  const stage = state === "menu" ? $("showview") : $("race");
  let { width: w, height: h } = stage.getBoundingClientRect();
  if (!w || !h) return;
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, [0.85, 1.25, 1.75][$("quality").selectedIndex]),
  );
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function fixedLap() {
  return Math.max(0, Math.floor((player?.d || 0) / L));
}
function resetInputs() {
  held.clear();
  if (player) {
    player.drift = 0;
    player.hook = 0;
  }
  hookLine.visible = false;
}
function wipeGrid() {
  for (let r of racers) {
    disposeBike({ root: r.proxy });
    if (r.bike) {
      scene.remove(r.obj);
      studio.add(r.obj);
    } else disposeBike({ root: r.obj });
    scene.remove(r.shadow);
    r.shadow.geometry.dispose();
    r.shadow.material.dispose();
  }
  racers = [];
  player = null;
  if (ghost) {
    disposeBike({ root: ghost });
    ghost = null;
  }
  hookLine.visible = false;
}
function racer(i) {
  const mine = i === 0,
    bike = mine ? showroom : null,
    id = mine ? pilot : (pilot + i) % pilots.length,
    gridOffsets = [0, 9, 8, 4, -1, -5, -6, -10];
  const color = mine
    ? paints[paint]
    : [
        "#15bfca",
        "#fe864c",
        "#aa86ee",
        "#efcb46",
        "#e75077",
        "#40da91",
        "#6cb6ff",
      ][i - 1];
  const obj = mine ? bike.root : markerBike(color, i % 6);
  scene.add(obj);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 5.2),
    new THREE.MeshBasicMaterial({
      map: shadowMap,
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  return {
    obj,
    bike,
    shadow,
    id,
    i,
    d: gridOffsets[i],
    l: mine ? 0 : i % 2 ? 3.4 : -3.4,
    yaw: 0,
    slip: 0,
    branch: false,
    aiLane: 0,
    nextDecision: 0,
    routeChoice: "",
    itemAge: 0,
    immunity: 0,
    pulseAt: 0,
    proxy: mine ? markerBike(color, chassisId) : simpleBike(color),
    steer: 0,
    speed: 0,
    boost: 0,
    air: 0,
    hang: 0,
    trick: false,
    drift: 0,
    hook: 0,
    hookCool: 0,
    item: "",
    shield: 0,
    stun: 0,
    contact: 0,
    finish: null,
    safe: 0,
    checkpoint: 0,
  };
}
function startRace() {
  closeModal();
  wakeSound();
  wipeGrid();
  state = "count";
  updateWakes([], 0, true);
  $("menu").hidden = true;
  $("race").hidden = false;
  switchCanvas(true);
  illuminate();
  resetInputs();
  clock = lapTime = lastLap = 0;
  bestRace = Infinity;
  countdown = 3;
  camMode = 0;
  resetSector();
  latestSplit = null;
  sectorHistory = [];
  referenceSector = currentRecord()?.sector ?? null;
  acc = 0;
  noteTime = 0;
  trace = [[0, 0, 0, 0]];
  rank = 1;
  for (let i = 0; i <= options()[2]; i++) racers.push(racer(i));
  player = racers[0];
  for (const r of racers) {
    scene.add(r.proxy);
    r.proxy.visible = false;
  }
  rank = order().indexOf(player) + 1;
  boxes.forEach((b) => {
    b.cool = 0;
    b.m.visible = !!options()[2];
  });
  ghostData = $("mode").value === "tt" ? currentRecord() : null;
  if (
    ghostData &&
    Array.isArray(ghostData.frames) &&
    ghostData.frames.length > 1
  )
    ensureGhost();
  showTouch();
  raceVisuals(0, true);
  drawHUD();
  tone(360);
}
function ensureGhost() {
  if (ghost) return;
  ghost = markerBike(0x88f9e9);
  ghost.traverse((o) => {
    if (o.material) {
      o.material.transparent = true;
      o.material.opacity = 0.3;
      o.material.depthWrite = false;
    }
  });
  scene.add(ghost);
}
function returnMenu() {
  resetInputs();
  wipeGrid();
  closeModal();
  state = "menu";
  $("menu").hidden = false;
  $("race").hidden = true;
  switchCanvas(false);
  showroom.tiltGroup.rotation.set(0, 0, 0);
  showroom.riderGroup.visible = true;
  showroom.root.rotation.set(0, 0, 0);
  showroom.root.position.set(0, 0, 0);
  menuInfo();
  engine();
}
function pauseRace() {
  if (!["race", "count"].includes(state)) return;
  prior = state;
  state = "paused";
  resetInputs();
  engine();
  modal(
    "Corrida pausada",
    "<p>A corrida continua do ponto em que você parou.</p>",
    [
      ["Continuar", resume],
      ["Reiniciar", startRace],
      ["Garagem", returnMenu],
    ],
  );
}
function resume() {
  closeModal();
  state = prior;
  acc = 0;
  last = performance.now();
  engine();
}
function classSpeed(r) {
  return (
    [25, 30, 35][$("cc").selectedIndex] *
    (1 +
      (stats[r.id][0] - 3) * 0.011 +
      (r.i === 0 && chassisId === 2 ? 0.018 : 0))
  );
}
function giveBoost(r, t) {
  r.boost = Math.max(
    t *
      (1 +
        (stats[r.id][4] - 3) * 0.035 -
        (r.i === 0 && chassisId === 4 ? 0.03 : 0)),
    r.boost,
  );
  if (!r.i) tone(610, 0.14);
}
function useItem() {
  activateItem(player);
}
function nearby(a, b, range) {
  return (
    b !== a &&
    b.finish === null &&
    a.branch === b.branch &&
    Math.abs(a.d - b.d) < range
  );
}
function activateItem(r) {
  if (
    (state !== "race" && !(state === "settling" && r?.i)) ||
    !r?.item ||
    r.finish !== null
  )
    return;
  const item = r.item;
  r.item = "";
  r.itemAge = 0;
  r.pulseAt = 0;
  if (item === "Turbo") giveBoost(r, 2.2);
  if (item === "Escudo") r.shield = 4;
  if (item === "Pulso") {
    let hits = 0;
    for (const other of racers) {
      if (!nearby(r, other, 28) || other.shield || other.immunity) continue;
      other.stun = 0.85;
      other.immunity = 2.8;
      other.speed *= 0.75;
      hits++;
      if (!other.i) {
        other.hook = 0;
        other.hookCool = 1.4;
        notify("Pulso rival!");
      }
    }
    if (!r.i) notify(hits ? "Pulso atingiu os rivais" : "Pulso emitido");
  } else if (!r.i) notify(item + " ativado");
}
function cornerAt(d, branch) {
  const scale = branch ? pier.span / pier.length : 1;
  return (
    ang(
      routeFrame(d + 3 * scale, branch).angle -
        routeFrame(d - 3 * scale, branch).angle,
    ) / 6
  );
}
function hookGeometry(r) {
  const f = frameAt(r.d),
    p = routePoint(r.d, r.l, r.branch),
    pole =
      r.hook && poles[r.anchor]
        ? poles[r.anchor]
        : poles.reduce((a, b) =>
            Math.hypot(p.x - b.pos.x, p.z - b.pos.z) <
            Math.hypot(p.x - a.pos.x, p.z - a.pos.z)
              ? b
              : a,
          ),
    polePos = pole.pos,
    dx = polePos.x - p.x,
    dz = polePos.z - p.z,
    dy = 6.4 - (0.85 + height(r));
  const ahead = dx * Math.sin(f.angle - r.yaw) + dz * Math.cos(f.angle - r.yaw),
    side = -dx * f.c + dz * f.s,
    offset = wrap(r.d - pole.t * L + L / 2, L) - L / 2;
  const facing = f.angle - r.yaw,
    alignment = Math.cos(ang(facing - frameAt(pole.t * L + 22).angle));
  return {
    pole,
    dist: Math.hypot(dx, dy, dz),
    side,
    ready:
      !r.branch &&
      !r.hang &&
      !r.stun &&
      r.speed > 7 &&
      !r.hookCool &&
      ahead > -1 &&
      Math.hypot(dx, dy, dz) < 18,
    good:
      offset >= 0 &&
      offset < 20 &&
      r.hook > 0.14 &&
      alignment > 0.92 &&
      Math.abs(r.l) < 10,
  };
}

function crossed(prev, now, f) {
  let target = (Math.floor((prev - f * L) / L) + 1) * L + f * L;
  return now >= target && target > prev + 1e-8;
}
function hookRelease() {
  let r = player;
  if (!r || !r.hook) return;
  if (hookGeometry(r).good) {
    giveBoost(r, 1);
    notify("Gancho perfeito · Turbo!");
  }
  r.hook = 0;
  r.hookCool = 2.8;
  hookLine.visible = false;
}
function action(code) {
  if (code === "Escape" || code === "KeyP") {
    if (state === "paused") resume();
    else if (state === "menu" && !$("modal").hidden) closeModal();
    else pauseRace();
    return;
  }
  if (state !== "race" && state !== "count") return;
  if (code === "KeyV") {
    camMode = (camMode + 1) % 3;
    notify(["Perseguição", "Ação", "Cockpit"][camMode]);
    return;
  }
  if (state !== "race") return;
  let r = player;
  if (code === "KeyQ") useItem();
  if (code === "KeyR") {
    r.d = r.branch
      ? Math.floor(r.d / L) * L + pier.entry - 13
      : Math.min(r.d, Math.max((r.checkpoint * L) / 4, r.safe));
    r.branch = false;
    r.yaw = r.slip = 0;
    r.checkpoint = Math.max(0, Math.floor(r.d / (L / 4)));
    r.safe = r.d;
    resetSector();
    r.l = r.steer = r.speed = r.hang = r.air = 0;
    r.trick = false;
    resetInputs();
    notify("De volta à pista");
  }
  if (code === "KeyF" && r.hang > 0 && !r.trick) {
    r.trick = true;
    notify("Acrobacia!");
  }
  if (code === "KeyE" && !r.hook && hookGeometry(r).ready) {
    r.anchor = poles.indexOf(hookGeometry(r).pole);
    r.hook = 0.01;
    notify("Segure o gancho e solte no verde");
  }
}
function planRival(r, curve) {
  const t = wrap(r.d, L) / L,
    nextCurve = cornerAt(r.d + 12, r.branch);
  let aim = r.branch
    ? pier.lane
    : clamp(-nextCurve * 230, -6, 6) + ((r.i % 3) - 1) * 1.1;
  r.routeChoice = r.branch ? "Píer" : "Trajetória";
  if (!r.branch && !r.item) {
    const box = boxes
      .filter((b) => !b.cool && wrap(b.d - r.d, L) < 45)
      .sort((a, b) => Math.abs(a.l - r.l) - Math.abs(b.l - r.l))[0];
    if (box && (Math.abs(box.l - aim) < 5 || r.i % 3 !== 0)) {
      aim = box.l;
      r.routeChoice = "Caixa";
    }
  }
  if (t > pier.startSector && t < marks.ramp && r.i % 3 === 1) {
    aim = pier.lane;
    r.routeChoice = "Píer";
  }
  const leader = racers
    .filter((o) => nearby(r, o, 15) && o.d > r.d && Math.abs(o.l - r.l) < 2.6)
    .sort((a, b) => a.d - b.d)[0];
  if (leader && !r.branch) {
    const side = leader.l > 1 ? -1 : leader.l < -1 ? 1 : r.i % 2 ? 1 : -1;
    aim = leader.l + side * 3.6;
    r.routeChoice = "Ultrapassagem";
  }
  r.aiLane = clamp(aim, r.branch ? 2.4 : -8, r.branch ? 7.6 : 8);
  if (!r.item || r.itemAge < 0.55) return;
  const rivals = racers.filter((o) => nearby(r, o, 25));
  if (r.item === "Pulso") {
    if (r.pulseAt) {
      if (clock >= r.pulseAt) activateItem(r);
      return;
    }
    if (rivals.some((o) => !o.shield && !o.immunity && o.d >= r.d - 2)) {
      r.pulseAt = clock + 0.95;
      if (nearby(r, player, 28)) notify("Pulso chegando · use o escudo!", 0.9);
    }
    return;
  }
  if (
    (r.item === "Turbo" &&
      ((Math.abs(curve) < 0.007 && !r.hang) || r.itemAge > 7)) ||
    (r.item === "Escudo" &&
      rivals.some((o) => o.item === "Pulso" || Math.abs(o.d - r.d) < 4))
  ) {
    activateItem(r);
  }
}
function drivePhysics(r, dt, steer, drift, curve, kind) {
  const mine = !r.i,
    assist = mine
      ? ([0.82, 0.59, 0.25][$("assist").selectedIndex] ?? 0.59)
      : 0.7;
  const ratio = clamp(Math.abs(r.speed) / 18, 0, 1),
    grip = trackId === 2 && r.branch ? 2.65 : kind === "water" ? 4.4 : 6.5;
  r.steer += (steer - r.steer) * Math.min(1, dt * 8);
  // Orientação relativa à tangente; a inércia lateral é independente do guidão.
  const yawRate =
    (mine && chassisId === 3 ? 1.29 : 1.2) + (stats[r.id][2] - 3) * 0.04;
  r.yaw +=
    dt *
    (r.steer * yawRate * ratio +
      curve * r.speed * (1 - assist) -
      r.yaw * (1.5 + assist));
  r.yaw = clamp(r.yaw, -0.68, 0.68);
  const sliding =
    drift &&
    !r.hang &&
    Math.abs(curve) > 0.0048 &&
    r.speed > 12 &&
    r.steer * curve < -0.0005 &&
    Math.abs(r.yaw) > 0.045 &&
    Math.abs(r.l) < 9.8;
  r.slip +=
    (Math.sin(r.yaw) * r.speed - r.slip) *
    Math.min(1, dt * (sliding ? 2.25 : grip));
  if (sliding) {
    r.drift = Math.min(3, r.drift + dt);
  } else if (
    !drift ||
    r.hang ||
    Math.abs(r.l) > 10 ||
    Math.abs(curve) < 0.003
  ) {
    if (r.drift >= 0.45 && Math.abs(r.l) < 10) {
      giveBoost(r, 0.55 + Math.min(3, Math.floor(r.drift / 0.55)) * 0.34);
      if (mine) notify("Saída de curva · Mini-turbo!");
    }
    r.drift = 0;
  }
  if (r.hook) {
    const h = hookGeometry(r);
    r.hook += dt;
    if (h.dist > 25 || r.hook > 1.45 || r.stun) {
      r.hook = 0;
      r.hookCool = 2.8;
    } else {
      r.slip += clamp(h.side * 0.65, -11, 11) * dt;
      r.yaw += clamp(h.side * 0.016, -0.19, 0.19) * dt;
    }
  }
  r.l += r.slip * dt;
  const half = r.branch ? 5.3 : 12,
    base = r.branch ? pier.lane : 0;
  if (Math.abs(r.l - base) >= half) {
    r.l = clamp(r.l, base - half, base + half);
    r.slip *= 0.5;
  }
}
function updateRacer(r, dt) {
  if (r.finish !== null) return;
  let mine = r.i === 0,
    t = wrap(r.d, L) / L,
    kind = surf(t),
    prev = r.d,
    eff = classSpeed(r),
    throttle,
    brake,
    target,
    steer;
  for (let k of ["boost", "shield", "stun", "contact", "hookCool"])
    r[k] = Math.max(0, r[k] - dt);
  const curve = cornerAt(r.d, r.branch);
  if (r.branch) kind = trackId === 0 ? "road" : "water";
  r.immunity = Math.max(0, r.immunity - dt);
  if (r.item) r.itemAge += dt;
  let drift = false;
  if (mine) {
    throttle = held.has("KeyW") || held.has("ArrowUp");
    brake = held.has("KeyS") || held.has("ArrowDown");
    steer =
      +(held.has("KeyD") || held.has("ArrowRight")) -
      +(held.has("KeyA") || held.has("ArrowLeft"));
    drift = held.has("Space");
    target = brake ? (r.speed > 0 ? 0 : -5) : throttle ? eff : 0;
  } else {
    r.nextDecision -= dt;
    if (r.nextDecision <= 0) {
      planRival(r, curve);
      r.nextDecision = 0.16 + 0.015 * r.i;
    }
    const desiredYaw = clamp(
      (r.aiLane - r.l) * 0.12 - r.slip * 0.026,
      -0.48,
      0.48,
    );
    steer = clamp(
      (desiredYaw - r.yaw) * 3.6 + desiredYaw * 1.5 - curve * r.speed * 0.28,
      -1,
      1,
    );
    throttle = true;
    brake = false;
    drift =
      !!$("diff").selectedIndex && Math.abs(curve) > 0.01 && steer * curve < 0;
    target =
      eff *
      ([0.8, 0.94, 1.0][$("diff").selectedIndex] + 0.013 * Math.sin(r.i * 2.1));
  }
  drivePhysics(r, dt, steer, drift, curve, kind);
  if (r.boost && !brake) target = eff * 1.36;
  const lane = r.l - (r.branch ? pier.lane : 0);
  if (Math.abs(lane) > (r.branch ? pier.half : 10))
    target = Math.min(target, eff * (r.branch ? 0.6 : 0.53));
  if (kind === "sand" && r.l < -4) target *= 0.77;
  // A linha externa comporta entrada larga; cortar por dentro reduz o arco percorrido.
  const metric = clamp(1 + curve * lane, 0.68, 1.35);
  const courseGain =
    (Math.cos(r.yaw) / metric) * (r.branch ? pier.span / pier.length : 1);
  if (r.stun) target *= 0.62;
  let rate =
    target > r.speed
      ? r.boost
        ? 30
        : 12 + (stats[r.id][1] - 2) * 0.6 + (mine && chassisId === 4 ? 1 : 0)
      : brake
        ? 25
        : throttle
          ? 16
          : 7;
  r.speed += clamp(target - r.speed, -rate * dt, rate * dt);
  r.d = Math.max(
    (r.checkpoint * L) / 4 - (r.checkpoint ? 0 : 26),
    r.d + r.speed * courseGain * dt,
  );
  // Cada quarto de volta precisa ser cruzado no sentido da corrida.
  while (r.d >= ((r.checkpoint + 1) * L) / 4) {
    r.checkpoint++;
    r.safe = (r.checkpoint * L) / 4;
  }
  if (!r.branch && r.speed > 3 && Math.abs(r.l) < 9 && r.hang <= 0 && r.d >= 0)
    r.safe = Math.max(r.safe, r.d - 4);
  if (
    !r.branch &&
    marks.pads.some((p) => crossed(prev, r.d, p)) &&
    Math.abs(r.l) < 2.2
  ) {
    giveBoost(r, 1.15);
    if (mine) notify("Faixa turbo!");
  }
  if (crossed(prev, r.d, marks.ramp) && Math.abs(r.l - pier.lane) < pier.half) {
    if (r.speed >= (trackId === 2 ? 6 : 17) && Math.abs(r.yaw) < 0.39) {
      r.branch = true;

      r.hang = r.air = trackId === 2 ? 0 : trackId === 1 ? 0.83 : 1.35;
      r.trick = false;
      if (mine)
        notify(
          circuits[trackId].branch +
            (r.hang ? " · F para acrobacia" : " · aderência reduzida"),
        );
    } else if (mine) notify("Siga pela rota principal");
  }
  if (r.branch && crossed(prev, r.d, pier.exit / L)) {
    r.branch = false;
  }
  if (!r.branch) {
    for (const h of hazards) {
      if (
        crossed(prev, r.d, h.t) &&
        Math.abs(r.l - h.l) < h.radius &&
        !r.hang &&
        !r.shield
      ) {
        r.speed *= h.type === "root" ? 0.65 : 0.73;
        r.slip += r.l < h.l ? -3 : 3;
        if (mine)
          notify(
            h.type === "root" ? "Raiz na pista!" : "Arrasto do redemoinho",
          );
      }
    }
    for (const t of jumps) {
      if (crossed(prev, r.d, t) && Math.abs(r.l) < 3.5 && r.speed > 14) {
        r.hang = r.air = 0.78;
        r.trick = false;
        if (mine) notify("Salto do canal · F para acrobacia");
      }
    }
  }
  if (r.hang > 0) {
    r.hang = Math.max(0, r.hang - dt);
    if (
      !r.hang &&
      r.trick &&
      (!r.branch || Math.abs(r.l - pier.lane) <= pier.half)
    ) {
      giveBoost(r, 0.85);
      if (mine) notify("Pouso perfeito!");
    }
  }
  if (!r.hang) r.trick = false;
  if (r.branch && r.d % L < pier.entry) r.branch = false;
  if (options()[2] && r.speed > 0 && !r.item) {
    for (let b of boxes) {
      if (
        !!b.branch === r.branch &&
        !b.cool &&
        Math.abs(b.l - r.l) < 2.25 &&
        crossed(prev, r.d, b.d / L) &&
        (!mine || !r.item)
      ) {
        b.cool = 2;
        b.m.visible = false;
        r.item = ["Escudo", "Turbo", "Pulso"][Math.floor(Math.random() * 3)];
        r.itemAge = 0;
        if (mine) notify("Item coletado · " + r.item);
        break;
      }
    }
  }
  if (mine) sectorClock(r, prev, dt);
  if (r.d >= options()[1] * L && r.checkpoint >= options()[1] * 4) {
    r.finish =
      clock - Math.max(0, r.d - options()[1] * L) / Math.max(1, r.speed);
    r.d = options()[1] * L;
  }
}
function lapDone() {
  const duration = (player.finish ?? clock) - lapTime;
  lastLap = duration;
  bestRace = Math.min(bestRace, duration);
  if (duration < readBest()) {
    const record = {
      time: duration,
      sector: latestSplit?.lap === fixedLap() - 1 ? latestSplit.time : null,
    };
    if ($("mode").value === "tt") {
      trace.push([duration, L, player.l, 0, 0, player.yaw]);
      record.frames = trace;
      ghostData = record;
      ensureGhost();
    }
    save(keyBest(), record);
    referenceSector = record.sector;
  }
  lapTime = clock;
  trace = [[0, 0, player.l, 0]];
  notify("Volta concluída · " + format(duration), 2);
}
function order() {
  return [...racers].sort((a, b) => {
    if (a.finish !== null || b.finish !== null)
      return (a.finish ?? Infinity) - (b.finish ?? Infinity);
    return b.d - a.d || a.i - b.i;
  });
}
function finishRace() {
  state = "result";
  resetInputs();
  engine();
  let sorted = order(),
    pos = sorted.indexOf(player) + 1;
  const gp = $("mode").value === "gp";
  let html =
    "<p>Tempo total <b>" +
    format(player.finish) +
    "</b><br>Melhor volta <b>" +
    format(bestRace) +
    "</b></p>";
  if (sectorHistory.length)
    html +=
      "<p><b>Parciais · " +
      circuits[trackId].sector +
      "</b></p>" +
      sectorHistory
        .map(
          (s) =>
            '<div class="resultrow"><span>Volta ' +
            (s.lap + 1) +
            " · " +
            s.route +
            "</span><b>" +
            format(s.time) +
            "</b></div>",
        )
        .join("");
  if (racers.length > 1)
    html += sorted
      .map(
        (r, i) =>
          '<div class="resultrow ' +
          (r === player ? "me" : "") +
          '"><span>' +
          (i + 1) +
          "º · " +
          pilots[r.id] +
          "</span><span>" +
          (r.finish !== null ? format(r.finish) : "Na pista") +
          "</span></div>",
      )
      .join("");
  if (gp && cup) {
    cupResult();
    return;
  }
  if (gp)
    html +=
      "<p>Pontos da etapa <b>" +
      [15, 12, 10, 8, 6, 4, 2, 1][pos - 1] +
      "</b></p>";
  modal(
    racers.length > 1
      ? pos + "º lugar · " + circuits[trackId].short
      : $("mode").value === "tt"
        ? "Prova concluída"
        : "Treino concluído",
    html,
    [
      ["Correr de novo", startRace],
      ["Garagem", returnMenu],
    ],
  );
}
function tickGrid(dt) {
  for (let b of boxes)
    if (b.cool > 0) {
      b.cool = Math.max(0, b.cool - dt);
      if (!b.cool) b.m.visible = true;
    }
  racers.forEach((r) => updateRacer(r, dt));
  for (let i = 0; i < racers.length; i++)
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i],
        b = racers[j];
      if (
        a.contact ||
        b.contact ||
        a.finish !== null ||
        !nearby(a, b, 2.5) ||
        Math.abs(a.l - b.l) > 1.5 ||
        Math.abs(height(a) - height(b)) > 1.1
      )
        continue;
      const direction = a.l < b.l ? -1 : 1;
      a.l += direction * 0.7;
      b.l -= direction * 0.7;
      for (const rider of [a, b]) {
        if (!rider.shield) rider.speed *= 0.95;
        if (rider.hook) {
          rider.hook = 0;
          rider.hookCool = 2.8;
        }
        rider.contact = 0.72;
      }
    }
}
function step(dt) {
  if (state === "count") {
    let before = Math.ceil(countdown);
    countdown -= dt;
    if (countdown <= 0) {
      state = "race";
      notify("Já! Acelere!", 1);
      tone(780);
      if (held.has("KeyW") || held.has("ArrowUp")) giveBoost(player, 0.55);
    } else if (Math.ceil(countdown) !== before) tone(340);
    return;
  }
  if (state !== "race") return;
  clock += dt;
  noteTime = Math.max(0, noteTime - dt);
  let prevLap = fixedLap();
  tickGrid(dt);
  if (fixedLap() > prevLap) lapDone();
  else if (
    $("mode").value === "tt" &&
    clock - lapTime - trace.at(-1)[0] >= 0.12
  )
    trace.push([
      clock - lapTime,
      Math.max(0, player.d % L),
      player.l,
      height(player),
      +player.branch,
      player.yaw,
    ]);
  rank = order().indexOf(player) + 1;
  if (player.finish !== null) finishRace();
}
function bridgeAngle() {
  return (0.5 + 0.5 * Math.sin(clock * 0.8)) * 0.105;
}
function height(r) {
  let t = wrap(r.d, L),
    dist = marks.ramp * L - t;
  const ramp =
    dist >= 0 && dist <= 11 && Math.abs(r.l - pier.lane) < pier.half
      ? (1 - dist / 11) * 2.4
      : 0;
  if (!r.hang) {
    if (bridge && !r.branch) {
      const d = t - bridge.t * L;
      if (d >= 0 && d < bridge.span && Math.abs(r.l) < 9)
        return 0.28 + Math.sin(bridgeAngle()) * d;
    }
    if (trackId === 1 && !r.branch) {
      for (const j of jumps) {
        const d = j * L - t;
        if (d >= 0 && d < 6 && Math.abs(r.l) < 3.5) return (1 - d / 6) * 1.15;
      }
    }
    return trackId === 2
      ? 0
      : r.branch && trackId === 0 && Math.abs(r.l - pier.lane) <= pier.half
        ? 0.34
        : ramp;
  }
  let k = 1 - r.hang / r.air;
  return (
    (r.air < 1 ? 1.15 : 2.4) * (1 - k) +
    (r.air < 1 ? 1.85 : 4) * Math.sin(Math.PI * k)
  );
}
function positionObject(obj, d, l, y, branch = false, yaw = 0) {
  let a = routeFrame(d, branch);
  if (branch && wrap(d, L) >= pier.entry && wrap(d, L) <= pier.exit)
    l -= pier.lane;
  obj.position.set(a.x - a.c * l, y, a.z + a.s * l);
  obj.rotation.y = a.angle - yaw;
}
let activeQuality = -1;
function updateDetail() {
  const level = $("quality").selectedIndex,
    low = level === 0;
  if (level !== activeQuality) {
    for (const m of fullProps) m.visible = !low;
    ocean.visible = !low;
    liteWater.visible = low;
    activeQuality = level;
  }
  if (low) {
    const light = $("light").value;
    liteWater.material.color.setHex(
      light === "night"
        ? 0x1a4e68
        : light === "sunset"
          ? 0x598888
          : [0x329e9d, 0x258d9b, 0x546f58][trackId],
    );
  }
  for (const m of liteProps) {
    const bounds = m.geometry.boundingSphere;
    m.visible =
      low && camera.position.distanceTo(bounds.center) - bounds.radius < 220;
  }
  for (const a of racers) {
    const simple =
      (low && !a.i) ||
      (a.i > 0 &&
        a.obj.position.distanceToSquared(camera.position) >
          (low ? 12 : level === 1 ? 70 : 110) ** 2);
    const cockpit = !a.i && camMode === 2 && !held.has("KeyC");
    a.obj.visible = !simple && !cockpit;
    a.proxy.visible = simple && !cockpit;
    if (simple) {
      a.proxy.position.copy(a.obj.position);
      a.proxy.rotation.copy(a.obj.rotation);
      a.proxy.rotation.z = a.i
        ? a.steer * 0.15
        : player.bike.tiltGroup.rotation.z;
    }
  }
}
function raceVisuals(dt, snap = false) {
  const r = player;
  if (!r) return;
  for (const a of racers) {
    let surfY =
        (trackId !== 0 || !a.branch || Math.abs(a.l - pier.lane) > pier.half) &&
        surf(wrap(a.d, L) / L) === "water"
          ? -0.38
          : 0,
      y = height(a);
    positionObject(
      a.obj,
      a.d,
      a.l,
      0.49 + surfY + y + Math.sin(visualTime * 6 + a.i) * 0.058,
      a.branch,
      a.yaw,
    );
    a.shadow.position.set(a.obj.position.x, surfY + 0.12, a.obj.position.z);
    a.shadow.rotation.z = -a.obj.rotation.y;
    a.shadow.scale.setScalar(1 / (1 + y * 0.06));
  }
  let angle = r.obj.rotation.y,
    steer = r.steer;
  r.bike.tiltGroup.rotation.z =
    steer * 0.22 + (r.trick ? TAU * (1 - r.hang / r.air) : 0);
  r.bike.tiltGroup.rotation.x = r.hang ? -0.14 : 0;
  r.bike.riderGroup.visible = camMode !== 2;
  r.obj.visible = camMode !== 2 || held.has("KeyC");
  UltraSculptedJetMotoBuilder.animateMechanicalParts(
    r.bike,
    dt,
    visualTime,
    Math.abs(r.speed),
    steer,
    r.boost > 0,
    !!r.drift || held.has("KeyS") || held.has("ArrowDown"),
  );
  let back = held.has("KeyC"),
    dist = back ? -7 : camMode === 2 ? -0.8 : camMode === 1 ? 5.7 : 8.7,
    up = camMode === 2 && !back ? 1.18 : camMode === 1 ? 2.05 : 3.7;
  const probe = r.d + (back ? -15 : 11);
  const ahead = routePoint(probe, r.l, r.branch);
  ahead.x -= Math.cos(angle) * r.yaw * 3;
  ahead.z += Math.sin(angle) * r.yaw * 3;
  const pos = r.obj.position;
  const desired = V(
    pos.x - Math.sin(angle) * dist,
    pos.y + up,
    pos.z - Math.cos(angle) * dist,
  );
  camera.position.lerp(
    desired,
    snap || camMode === 2 ? 1 : 1 - Math.exp(-dt * 12),
  );
  camera.lookAt(ahead.x, pos.y + (camMode === 2 ? 0.7 : 0.45), ahead.z);
  camera.fov = camMode === 1 ? 64 : camMode === 2 ? 76 : r.boost ? 64 : 58;
  camera.updateProjectionMatrix();
  updateDetail();
  const magnet = hookGeometry(r);
  for (const pole of poles)
    pole.lamp.material.color.setHex(
      pole === magnet.pole
        ? r.hook
          ? 0xffef77
          : magnet.ready
            ? 0x82ff8b
            : 0x326e69
        : 0x326e69,
    );
  if (bridge) bridge.o.rotation.x = -bridgeAngle();
  for (const m of movers) {
    if (trackId === 1) m.rotation.y = visualTime * 0.91;
    else m.rotation.z = visualTime * 0.5;
  }
  updateWakes(racers, clock);
  hookLine.visible = r.hook > 0;
  if (r.hook) {
    let p = hookLine.geometry.attributes.position;
    p.setXYZ(0, pos.x, pos.y + 0.5, pos.z);
    p.setXYZ(1, magnet.pole.pos.x, 6.4, magnet.pole.pos.z);
    p.needsUpdate = true;
  }
  if (ghost && ghostData) {
    let frames = ghostData.frames,
      time = clock - lapTime,
      lo = 0,
      hi = frames.length - 1;
    while (lo + 1 < hi) {
      let mid = (lo + hi) >> 1;
      if (frames[mid][0] < time) lo = mid;
      else hi = mid;
    }
    let a = frames[lo],
      b = frames[hi],
      k = clamp((time - a[0]) / Math.max(0.001, b[0] - a[0]), 0, 1),
      d = a[1] + (b[1] - a[1]) * k;
    ghost.visible = time > 0 && time < ghostData.time;
    positionObject(
      ghost,
      d,
      a[2] + (b[2] - a[2]) * k,
      0.55 + a[3] + (b[3] - a[3]) * k,
      !!(a[4] || b[4]) && wrap(d, L) >= pier.entry && wrap(d, L) < pier.exit,
      (a[5] || 0) + ((b[5] || 0) - (a[5] || 0)) * k,
    );
  }
  boxes.forEach((b) => {
    if (b.m.visible) b.m.rotation.y = visualTime * 2;
  });
  sky.material.uniforms.uTime.value = visualTime;
  ocean.material.uniforms.uTime.value = visualTime;
}
let bounds;
function updateMapBounds() {
  bounds = {
    minX: Math.min(...samples.map((p) => p.x)),
    maxX: Math.max(...samples.map((p) => p.x)),
    minZ: Math.min(...samples.map((p) => p.z)),
    maxZ: Math.max(...samples.map((p) => p.z)),
  };
}
updateMapBounds();
function mapDraw(canvas, live) {
  const g = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height,
    s = Math.min(
      (w - 18) / (bounds.maxZ - bounds.minZ),
      (h - 16) / (bounds.maxX - bounds.minX),
    ),
    px = (p) => w / 2 + (p.z - (bounds.minZ + bounds.maxZ) / 2) * s,
    py = (p) => h / 2 + (p.x - (bounds.minX + bounds.maxX) / 2) * s;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = live ? "#b2d2c6" : "#24665c";
  g.lineWidth = live ? 4 : 5;
  g.beginPath();
  for (let i = 0; i < N; i += 7) {
    let p = samples[i];
    i ? g.lineTo(px(p), py(p)) : g.moveTo(px(p), py(p));
  }
  g.closePath();
  g.stroke();
  g.beginPath();
  g.strokeStyle = live ? "#ffc06d" : "#d87840";
  g.lineWidth = live ? 2.4 : 2;
  for (let i = 0; i < pierSamples.length; i += 3) {
    const p = pierSamples[i];
    i ? g.lineTo(px(p), py(p)) : g.moveTo(px(p), py(p));
  }
  g.stroke();
  function dot(p, c, r) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(px(p), py(p), r, 0, TAU);
    g.fill();
  }
  if (live) {
    [...racers]
      .reverse()
      .forEach((r) =>
        dot(
          routePoint(r.d, r.l, r.branch),
          r.i ? "#eee5c5" : "#ff6033",
          r.i ? 3.2 : 5.5,
        ),
      );
  } else dot(samples[0], "#ff5b37", 6);
}
function drawHUD() {
  if (!player) return;
  const t = wrap(player.d, L) / L,
    s = section(t);
  $("rank").textContent = rank + "/" + racers.length;
  $("lap").textContent =
    Math.min(options()[1], fixedLap() + 1) + "/" + options()[1];
  $("elapsed").textContent = format(clock);
  $("sector").textContent = player.branch
    ? circuits[trackId].branch
    : circuits[trackId].hints[s];
  $("split").textContent =
    sectorStart !== null
      ? circuits[trackId].sector + " · " + format(clock - sectorStart)
      : latestSplit
        ? circuits[trackId].sector +
          " · " +
          latestSplit.route +
          " " +
          format(latestSplit.time) +
          deltaLabel(latestSplit.delta)
        : "";
  $("split").hidden = !$("split").textContent;
  $("speed").textContent = Math.round(Math.abs(player.speed) * 3.6);
  $("use").hidden = !options()[2];
  $("use").textContent = "Q · " + (player.item || "Item vazio");
  $("count").textContent = state === "count" ? Math.ceil(countdown) : "";
  $("message").textContent =
    state === "count"
      ? "Prepare-se"
      : noteTime > 0
        ? notice
        : $("mode").value === "training"
          ? (trackId === 1
              ? [
                  "Acelere até o primeiro arco",
                  "Fenda à direita. Mantenha mais de 61 km/h.",
                  "Atravesse a fenda ou contorne os recifes",
                  "F para girar no salto do canal",
                  "Evite as espirais na água",
                  "Use E quando o poste acender",
                ]
              : trackId === 2
                ? [
                    "Acelere até a usina",
                    "Prepare a bifurcação",
                    "Canal à direita ou passarela à frente",
                    "Atravesse a ponte basculante",
                    "Desvie das raízes sinalizadas",
                    "Use E quando o poste acender",
                  ]
                : [
                    "Segure W ou ↑ para acelerar",
                    "Prepare a lagoa. Píer à direita ou boias à frente.",
                    "Boias por fora ou drift por dentro. F no salto do píer.",
                    "Mantenha a velocidade na saída da lagoa.",
                    "Evite a areia fofa à esquerda",
                    "Segure E junto ao poste verde. Solte na zona ideal.",
                  ])[s]
          : "";
  let a = player;
  $("ability").textContent = a.hook
    ? hookGeometry(a).good
      ? "Solte agora!"
      : "Gancho preso"
    : a.drift
      ? "Drift · carga " + Math.min(3, Math.floor(a.drift / 0.7))
      : a.boost
        ? "Turbo ativo"
        : a.shield
          ? "Escudo ativo"
          : hookGeometry(a).ready
            ? "E · Gancho disponível"
            : a.hang
              ? "F · Acrobacia"
              : "";
  $("ability").hidden = !$("ability").textContent;
  mapDraw($("map"), true);
}
