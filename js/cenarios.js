"use strict";
const $ = (id) => document.getElementById(id),
  TAU = Math.PI * 2,
  clamp = THREE.MathUtils.clamp;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pilots = [
  "Lia Maré",
  "Kaito Faísca",
  "Bia Coral",
  "Rocco Duna",
  "Nina Vento",
  "Otto Ferro",
  "Yara Aurora",
  "Zion Turbo",
  "Vega Eclipse",
  "Flora Nébula",
  "Theo Volt",
  "Axel Prisma",
];
const stats = [
  [3, 3, 4, 3, 3],
  [4, 4, 2, 2, 4],
  [2, 4, 5, 3, 2],
  [3, 2, 2, 5, 4],
  [3, 3, 5, 2, 3],
  [2, 5, 3, 4, 2],
  [4, 3, 3, 3, 3],
  [3, 3, 3, 2, 5],
  [5, 2, 3, 2, 4],
  [2, 4, 4, 4, 2],
  [4, 3, 4, 3, 2],
  [5, 3, 3, 3, 2],
];
const chassis = [
    "Marlin-X",
    "Escarpa",
    "Raia-GT",
    "Bumerangue",
    "Raptor Jet",
    "Nimbus",
  ],
  chassisIds = [
    "marlin-x",
    "escarpa",
    "raia-gt",
    "bumerangue",
    "raptor-jet",
    "nimbus",
  ];
const paints = ["#fe552f", "#04c8c4", "#f0af29", "#9d62f9", "#53b852"];
function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem("jr-coast-2/" + key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem("jr-coast-2/" + key, JSON.stringify(value));
  } catch {}
}
let pilot = clamp(Math.trunc(+load("pilot", 0)) || 0, 0, 11),
  chassisId = clamp(Math.trunc(+load("chassis", 0)) || 0, 0, 5),
  paint = clamp(Math.trunc(+load("paint", 0)) || 0, 0, 4);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.83;
renderer.setClearColor(0, 0);
renderer.domElement.id = "view";
const studio = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(56, 1, 0.12, 2200);
const hemi = new THREE.HemisphereLight(0xfff7db, 0x68a59c, 1.3),
  sun = new THREE.DirectionalLight(0xfff1d7, 1.5);
sun.position.set(80, 110, 30);

studio.add(hemi.clone(), sun.clone());
const envTex = ProceduralTextureFactory.createEnvMap("day"),
  pmrem = new THREE.PMREMGenerator(renderer),
  env = pmrem.fromEquirectangular(envTex);
studio.environment = env.texture;
envTex.dispose();
pmrem.dispose();
let showroom,
  orbit = 0.98,
  zoomed = false,
  revTime = 0,
  dragging = null;
function disposeBike(b) {
  if (!b) return;
  b.root.removeFromParent
    ? b.root.removeFromParent()
    : b.root.parent?.remove(b.root);
  const gs = new Set(),
    ms = new Set();
  b.root.traverse((o) => {
    if (o.geometry && !o.isSprite) gs.add(o.geometry);
    if (o.material) ms.add(o.material);
  });
  gs.forEach((g) => g.dispose());
  ms.forEach((m) => m.dispose());
}
function makeBike(index, color) {
  const bike = UltraSculptedJetMotoBuilder.build(
    chassisIds[index],
    color,
    "#374b51",
    "#36ffdc",
  );
  const paints = new Set();
  bike.root.traverse((o) => {
    if (o.material?.isMeshStandardMaterial) paints.add(o.material);
  });
  paints.forEach((m) => {
    m.color.convertSRGBToLinear();
    m.envMapIntensity = 0.65;
  });
  return bike;
}
function refreshBike() {
  disposeBike(showroom);
  showroom = makeBike(chassisId, paints[paint]);
  studio.add(showroom.root);
  $("combo").textContent = pilots[pilot] + " / " + chassis[chassisId];
}
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(3.45, 3.56, 0.12, 80),
  new THREE.MeshStandardMaterial({
    color: 0x345751,
    metalness: 0.24,
    roughness: 0.58,
  }),
);
pedestal.position.y = -0.34;
studio.add(pedestal);
const rim = new THREE.Mesh(
  new THREE.TorusGeometry(3.15, 0.012, 4, 100),
  new THREE.MeshBasicMaterial({ color: 0xf5ffe0 }),
);
rim.rotation.x = Math.PI / 2;
rim.position.y = -0.273;
studio.add(rim);
function createCircuit(id) {
  const config = circuits[id],
    scene = new THREE.Scene();
  scene.environment = env.texture;
  scene.add(hemi, sun);
  const points = config.points || [
    [0, 0],
    [0, 110],
    [-34, 178],
    [-107, 211],
    [-175, 182],
    [-182, 105],
    [-132, 46],
    [-114, -24],
    [-165, -99],
    [-158, -158],
    [-94, -202],
    [-30, -163],
    [3, -90],
  ];
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => V(x * config.scale, 0, z * config.scale)),
    true,
    "centripetal",
  );
  curve.arcLengthDivisions = 2400;
  curve.updateArcLengths();
  const L = curve.getLength(),
    N = 850,
    samples = [],
    width = 11;
  for (let i = 0; i < N; i++) {
    let t = i / N,
      p = curve.getPointAt(t),
      a = curve.getTangentAt(t);
    samples.push({ x: p.x, z: p.z, angle: Math.atan2(a.x, a.z) });
  }
  function wrap(n, m) {
    return ((n % m) + m) % m;
  }
  function ang(a) {
    return Math.atan2(Math.sin(a), Math.cos(a));
  }
  function frameAt(d) {
    const f = (wrap(d, L) * N) / L,
      i = Math.floor(f),
      a = samples[i],
      b = samples[(i + 1) % N],
      k = f - i;
    const angle = a.angle + ang(b.angle - a.angle) * k;
    return {
      x: a.x + (b.x - a.x) * k,
      z: a.z + (b.z - a.z) * k,
      angle,
      s: Math.sin(angle),
      c: Math.cos(angle),
    };
  }
  function locate(d, lane = 0) {
    const a = frameAt(d);
    return V(a.x - a.c * lane, 0, a.z + a.s * lane);
  }
  function surf(t) {
    if (id === 1)
      return t < 0.056 || t > 0.958 || (t > 0.611 && t < 0.661)
        ? "road"
        : "water";
    if (id === 2)
      return (t > 0.247 && t < 0.415) ||
        (t > 0.544 && t < 0.584) ||
        (t > 0.712 && t < 0.82)
        ? "water"
        : t > 0.1 && t < 0.185
          ? "sand"
          : "road";
    return t > 0.235 && t < 0.43
      ? "water"
      : t > 0.58 && t < 0.83
        ? "sand"
        : "road";
  }
  const marks = {
    ramp: config.ramp,
    pole: config.poles.at(-1),
    boxes: config.boxes,
    pads: config.pads,
  };
  // A distância de classificação segue a volta principal. No píer, a física usa
  // o comprimento real da bifurcação e converte o avanço para a mesma escala.
  const pier = {
    entry: marks.ramp * L,
    exit: config.exit * L,
    lane: 5,
    half: id === 1 ? 2.65 : 3.5,
    startSector: config.ramp - 0.028,
    endSector: config.exit + 0.039,
  };
  const entryPoint = locate(pier.entry, pier.lane),
    exitPoint = locate(pier.exit, pier.lane);
  function tangentAt(d) {
    const f = frameAt(d);
    return V(f.s, 0, f.c);
  }
  const pierCurve = new THREE.CubicBezierCurve3(
    entryPoint,
    entryPoint.clone().addScaledVector(tangentAt(pier.entry), 25),
    exitPoint.clone().addScaledVector(tangentAt(pier.exit), -24),
    exitPoint,
  );
  pier.length = pierCurve.getLength();
  pier.span = pier.exit - pier.entry;
  const pierSamples = Array.from({ length: 181 }, (_, i) => {
    const t = i / 180,
      p = pierCurve.getPointAt(t),
      v = pierCurve.getTangentAt(t);
    return { x: p.x, z: p.z, angle: Math.atan2(v.x, v.z) };
  });
  function routeFrame(d, onPier) {
    const local = wrap(d, L);
    if (!onPier || local < pier.entry || local > pier.exit) return frameAt(d);
    const u = clamp(((local - pier.entry) / pier.span) * 180, 0, 180),
      i = Math.min(179, Math.floor(u)),
      k = u - i,
      a = pierSamples[i],
      b = pierSamples[i + 1],
      angle = a.angle + ang(b.angle - a.angle) * k;
    return {
      x: a.x + (b.x - a.x) * k,
      z: a.z + (b.z - a.z) * k,
      angle,
      s: Math.sin(angle),
      c: Math.cos(angle),
    };
  }
  function routePoint(d, l, onPier) {
    const f = routeFrame(d, onPier),
      offset =
        onPier && wrap(d, L) >= pier.entry && wrap(d, L) <= pier.exit
          ? l - pier.lane
          : l;
    return V(f.x - f.c * offset, 0, f.z + f.s * offset);
  }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1550, 36, 16),
    CustomShaders.createSkyDomeMaterial(),
  );
  scene.add(sky);
  const oceanGeo = new THREE.PlaneGeometry(2650, 2650, 96, 96);
  oceanGeo.rotateX(-Math.PI / 2);
  const ocean = new THREE.Mesh(oceanGeo, CustomShaders.createOceanMaterial());
  ocean.position.y = -0.7;
  scene.add(ocean);
  function illuminate() {
    const light = $("light").value,
      night = light === "night",
      late = light === "sunset";
    const su = sky.material.uniforms,
      ou = ocean.material.uniforms;
    su.uZenithColor.value.setHex(night ? 0x102044 : late ? 0x56679f : 0x187fa6);
    su.uHorizonColor.value.setHex(
      night ? 0x50427c : late ? 0xffbc87 : 0xd3f2e6,
    );
    su.uNightMode.value = +night;
    su.uSunDir.value
      .set(-0.52, night ? 0.15 : late ? 0.12 : 0.32, 0.76)
      .normalize();
    ou.uSunDir.value.copy(su.uSunDir.value);
    ou.uDeepColor.value.setHex(night ? 0x102942 : 0x086f79);
    ou.uShallowColor.value.setHex(night ? 0x244a69 : 0x2db9ac);
    ou.uSkyColor.value.copy(su.uHorizonColor.value);
    hemi.intensity = night ? 0.72 : 1.25;
    sun.color.setHex(late ? 0xffbc7c : night ? 0xaac9ff : 0xffedd4);
    if (id === 1) {
      ou.uDeepColor.value.setHex(night ? 0x202f65 : 0x086d8c);
      ou.uShallowColor.value.setHex(night ? 0x29758b : 0x49dfc4);
    }
    if (id === 2) {
      ou.uDeepColor.value.setHex(night ? 0x182e32 : 0x264d40);
      ou.uShallowColor.value.setHex(night ? 0x41716a : 0x739166);
      if (!night) su.uHorizonColor.value.setHex(late ? 0xf4ab78 : 0xc6d3a8);
    }
    scene.fog = new THREE.FogExp2(
      night ? 0x403e66 : late ? 0xecc4a5 : 0xc2e2d6,
      id === 2 ? 0.0035 : 0.00165,
    );
  }
  function material(color) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).convertSRGBToLinear(),
      roughness: 0.93,
      envMapIntensity: 0.14,
      side: THREE.DoubleSide,
    });
  }
  const mats = {},
    batches = new Map(),
    dummy = new THREE.Object3D();
  const cube = new THREE.BoxGeometry(1, 1, 1),
    cyl = new THREE.CylinderGeometry(1, 1, 1, 12),
    cone = new THREE.ConeGeometry(1, 1, 10),
    round = new THREE.SphereGeometry(1, 14, 9),
    leaf = new THREE.BufferGeometry();
  // A nervura e as pontas recortadas dão volume às folhas vistas contra o céu.
  const frond = [];
  for (let k = 0; k < 13; k++) {
    const u = k / 13,
      v = (k + 1) / 13,
      spine = (t) => [0, 0.26 * Math.sin(t * Math.PI) - 0.27 * t * t, t],
      w = 0.23 * Math.sin(Math.PI * (u + 0.04));
    for (const side of [-1, 1])
      frond.push(
        ...spine(u),
        side * w,
        spine(u)[1] - 0.07,
        u + 0.14,
        ...spine(v),
      );
  }
  leaf.setAttribute("position", new THREE.Float32BufferAttribute(frond, 3));
  leaf.computeVertexNormals();
  function prop(geo, col, x, y, z, w, h, len, ry = 0, rz = 0, rx = 0) {
    const key = geo.uuid + col;
    if (!batches.has(key)) batches.set(key, { geo, col, matrices: [] });
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz, "YXZ");
    dummy.scale.set(w, h, len);
    dummy.updateMatrix();
    batches.get(key).matrices.push(dummy.matrix.clone());
  }
  function along(d, l, y, g, col, w, h, len, turn = 0) {
    const p = locate(d, l);
    prop(g, col, p.x, y, p.z, w, h, len, frameAt(d).angle + turn);
  }
  let seed = 48;
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function palm(x, y, z, h) {
    const lean = 0.12;
    prop(
      cyl,
      0x94654c,
      x + (h * lean) / 2,
      y + h / 2,
      z,
      0.036 * h,
      h,
      0.036 * h,
      0,
      -lean,
    );
    for (let i = 0; i < 9; i++)
      prop(
        leaf,
        i % 2 ? 0x24694b : 0x438a54,
        x + h * lean,
        y + h,
        z,
        h * 0.65,
        h * 0.78,
        h * 0.66,
        (i * TAU) / 9 + x,
      );
  }
  // Faixas contínuas acompanham a mesma linha central usada pela pilotagem.
  const ribbons = {};
  function quad(key, verts, uv) {
    const b = (ribbons[key] ??= { pos: [], uv: [] });
    for (const i of [0, 1, 2, 0, 2, 3]) {
      b.pos.push(...verts[i]);
      b.uv.push(...uv[i]);
    }
  }
  for (let i = 0; i < N; i++) {
    let t = (i + 0.5) / N,
      kind = surf(t),
      d0 = (i * L) / N,
      d1 = ((i + 1) * L) / N;
    function band(key, left, right, y) {
      const ps = [
        [d0, left],
        [d0, right],
        [d1, right],
        [d1, left],
      ].map(([d, l]) => {
        const p = locate(d, l);
        return [p.x, y, p.z];
      });
      quad(key, ps, [
        [0, d0 / 13],
        [1, d0 / 13],
        [1, d1 / 13],
        [0, d1 / 13],
      ]);
    }
    if (kind !== "water") {
      band(kind, -width, width, 0.02);
      band("shoulder", -width - 6 - 3 * Math.cos(t * TAU * 7), -width, -0.03);
      band("shoulder", width, width + 17 + 8 * Math.sin(t * TAU * 5), -0.03);
      for (let side of [-1, 1])
        band(i % 10 < 5 ? "white" : "red", side * 10.4, side * 11, 0.07);
    }
  }
  function dockTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d"),
      tones = ["#805c43", "#866249", "#986e4f", "#795a46"];
    for (let i = 0; i < 16; i++) {
      const y = i * 16;
      ctx.fillStyle = tones[i % 4];
      ctx.fillRect(0, y, 512, 16);
      ctx.fillStyle = "#493d34";
      ctx.fillRect(0, y, 512, 1.4);
      for (let j = 0; j < 45; j++) {
        ctx.fillStyle = j % 2 ? "rgba(222,175,108,.24)" : "rgba(60,44,36,.24)";
        ctx.fillRect(
          random() * 512,
          y + 2 + random() * 13,
          10 + random() * 72,
          0.7,
        );
      }
      for (const x of [29, 30 + 152, 482]) {
        ctx.fillStyle = "#403b35";
        ctx.fillRect(x, y + 7, 2.6, 2.6);
      }
    }
    return new THREE.CanvasTexture(canvas);
  }
  let roadTexture =
    id === 2 ? dockTexture() : ProceduralTextureFactory.createRoadTexture();
  roadTexture.repeat.set(1, 1);
  roadTexture.wrapT = THREE.RepeatWrapping;
  roadTexture.encoding = THREE.sRGBEncoding;
  for (const [key, b] of Object.entries(ribbons)) {
    let g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
    g.computeVertexNormals();
    let m = material(
      {
        road: 0xffffff,
        sand: 0xf4c482,
        shoulder: 0xcab684,
        white: 0xfff0d8,
        red: id === 2 ? 0xd5a444 : id === 1 ? 0xd96283 : 0xf86841,
      }[key],
    );
    if (key === "road") m.map = roadTexture;
    if (key === "sand" || key === "shoulder") {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#f2ebd9";
      ctx.fillRect(0, 0, 128, 128);
      for (let j = 0; j < 1600; j++) {
        ctx.fillStyle = j % 2 ? "rgba(86,64,42,.18)" : "rgba(255,255,255,.42)";
        ctx.fillRect(random() * 128, random() * 128, 1 + random() * 2, 1);
      }
      m.map = new THREE.CanvasTexture(c);
      m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
      m.map.encoding = THREE.sRGBEncoding;
    }

    scene.add(new THREE.Mesh(g, m));
  }
  for (let i = 0; i < 95; i++) {
    let d = (i * L) / 95,
      t = d / L;
    for (const side of [-1, 1]) {
      if (surf(t) === "water") {
        along(
          d,
          side * width,
          0.2,
          round,
          side < 0 ? 0xff7345 : 0xfff0bf,
          0.65,
          0.86,
          0.65,
        );
        along(d, side * width, 0.95, cyl, 0xfff7e3, 0.18, 0.65, 0.18);
      } else if (i % 2 === 0) {
        along(d, side * (width + 1), 0.65, cyl, 0x273f42, 0.13, 1.3, 0.13);
        along(d, side * (width + 1), 1.26, cyl, 0x91ffdf, 0.16, 0.24, 0.16);
      }
    }
  }
  for (let i = 0; i < (id === 0 ? 88 : id === 1 ? 22 : 0); i++) {
    let t = i / 88,
      s = i % 3 === 0 ? -1 : 1,
      l = s * (24 + random() * 29),
      p = locate(t * L, l);
    if (surf(t) === "water" && s === -1) continue;
    if (pierSamples.some((f) => Math.hypot(f.x - p.x, f.z - p.z) < 12))
      continue;
    const h = 2 + random() * 2;
    prop(
      round,
      0xe6bd82,
      p.x,
      -h + 0.2,
      p.z,
      10 + random() * 4,
      h,
      10 + random() * 4,
    );
    palm(p.x, 0.08, p.z, 6 + random() * 5);
  }
  for (let i = 0; i < 36; i++) {
    const a = (i * TAU) / 36,
      r = 370 + random() * 170;
    prop(
      round,
      i % 2 ? 0x527c6d : 0x638879,
      Math.cos(a) * r,
      -9,
      Math.sin(a) * r,
      45 + random() * 65,
      15 + random() * 26,
      48 + random() * 45,
      a,
    );
  }
  function lighthouse(x, z) {
    prop(round, 0xd4b181, x, -2, z, 22, 4, 16);
    for (let i = 0; i < 6; i++)
      prop(
        cyl,
        i % 2 ? 0xd75c44 : 0xfff0d0,
        x,
        2 + i * 3,
        z,
        3.3 - i * 0.24,
        3.05,
        3.3 - i * 0.24,
      );
    prop(cyl, 0x344842, x, 19, z, 3.3, 0.7, 3.3);
    prop(cyl, 0xffda81, x, 20.5, z, 1.8, 2.8, 1.8);
    prop(cone, 0x824d40, x, 23, z, 3, 2, 3);
  }
  if (!id) lighthouse(-259, 173);
  for (let i = 0; i < (id === 0 ? 6 : 0); i++) {
    let x = 80 + i * 27,
      z = 90 + Math.sin(i) * 28;
    prop(cyl, 0xe8eae0, x, 16, z, 0.8, 33, 0.8);
    for (let j = 0; j < 3; j++) {
      let a = (j * TAU) / 3 + i;
      prop(
        cube,
        0xf2eede,
        x - Math.sin(a) * 6,
        33 + Math.cos(a) * 6,
        z + 1,
        0.8,
        12,
        0.3,
        0,
        a,
      );
    }
  }
  const padColor = 0x41e8b3;
  function stripePad(d, l) {
    along(d, l, 0.09, cube, 0x186963, 4, 0.09, 7);
    for (let k = -2; k <= 2; k += 2) {
      along(d + k, l - 0.55, 0.16, cube, padColor, 0.25, 0.08, 1.7, 0.76);
      along(d + k, l + 0.55, 0.16, cube, padColor, 0.25, 0.08, 1.7, -0.76);
    }
  }
  for (let d of marks.pads) stripePad(d * L, 0);
  const rampMat = material(0xc08245);
  const rampGeo = new THREE.BufferGeometry();
  {
    let a = marks.ramp * L - 11,
      b = marks.ramp * L,
      vertices = [];
    for (let [d, l, h] of [
      [a, 1, 0.13],
      [a, 8, 0.13],
      [b, 8, 2.5],
      [a, 1, 0.13],
      [b, 8, 2.5],
      [b, 1, 2.5],
    ]) {
      const p = locate(d, l);
      vertices.push(p.x, h, p.z);
    }
    rampGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    rampGeo.computeVertexNormals();
    if (id !== 2) scene.add(new THREE.Mesh(rampGeo, rampMat));
    for (let k = 0; k < (id === 2 ? 0 : 7); k++)
      along(a + 1.5 * k, 4.5, 0.23 + k * 0.32, cube, 0xf8d79a, 7, 0.09, 0.14);
  }
  // Tábuas de madeira marcam a recepção depois do vão de salto.
  const deckVertices = [];
  for (let i = 0; i < 90; i++) {
    const distance = ((i + 0.5) / 90) * pier.length;
    if (distance < 20 && id === 0) continue;
    for (const [idx, offset] of [
      [i, -3.4],
      [i, 3.4],
      [i + 1, 3.4],
      [i, -3.4],
      [i + 1, 3.4],
      [i + 1, -3.4],
    ]) {
      const pos = routePoint(
        pier.entry + (pier.span * idx) / 90,
        pier.lane + offset,
        true,
      );
      deckVertices.push(pos.x, 0.34, pos.z);
    }
    if (id === 0 && i % 4 === 0) {
      const f = pierSamples[i * 2];
      prop(cube, 0xe3c28b, f.x, 0.375, f.z, 6.8, 0.06, 0.28, f.angle);
    }
    if (i % 9 === 0) {
      for (const side of [-1, 1]) {
        const p = routePoint(
          pier.entry + (pier.span * i) / 90,
          5 + side * 3.7,
          true,
        );
        prop(cyl, 0x157e76, p.x, 0.95, p.z, 0.17, 1.9, 0.17);
        prop(round, 0xe5f8b4, p.x, 1.92, p.z, 0.24, 0.24, 0.24);
      }
    }
  }
  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(deckVertices, 3),
  );
  deckGeo.computeVertexNormals();
  if (!id) scene.add(new THREE.Mesh(deckGeo, material(0xab7548)));
  const poles = config.poles.map((t) => {
    const pos = locate(t * L, 12);
    prop(cyl, 0x204754, pos.x, 3, pos.z, 0.5, 6, 0.5);
    const lamp = new THREE.Mesh(
      round,
      new THREE.MeshBasicMaterial({ color: 0x378577 }),
    );
    lamp.scale.setScalar(1.05);
    lamp.position.copy(pos);
    lamp.position.y = 6.4;
    scene.add(lamp);
    return { t, pos, lamp };
  });
  // Relief and landmarks sit outside the rideable lanes of both routes.
  const crag = new THREE.IcosahedronGeometry(1, 1),
    cragPos = crag.attributes.position;
  for (let i = 0; i < cragPos.count; i++) {
    const x = cragPos.getX(i),
      y = cragPos.getY(i),
      z = cragPos.getZ(i);
    const k = 1 + 0.12 * Math.sin(x * 9 + z * 3) * Math.cos(y * 7 - z * 4);
    cragPos.setXYZ(
      i,
      x * k + Math.max(0, y) * 0.12,
      Math.sign(y) * Math.pow(Math.abs(y), 0.78) * k,
      z * k,
    );
  }
  crag.computeVertexNormals();
  function clearLand(p, radius) {
    return (
      !samples.some(
        (q, i) =>
          i % 3 === 0 && Math.hypot(q.x - p.x, q.z - p.z) < width + radius,
      ) &&
      !pierSamples.some(
        (q, i) =>
          i % 3 === 0 && Math.hypot(q.x - p.x, q.z - p.z) < pier.half + radius,
      )
    );
  }
  function limb(a, b, r, color) {
    const dir = b.clone().sub(a),
      center = a.clone().lerp(b, 0.5),
      ori = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(
          V(0, 1, 0),
          dir.clone().normalize(),
        ),
        "YXZ",
      );
    prop(
      cyl,
      color,
      center.x,
      center.y,
      center.z,
      r,
      dir.length(),
      r,
      ori.y,
      ori.z,
      ori.x,
    );
  }
  function coralTree(p, h, shade) {
    const trunk = V(p.x, 1, p.z),
      top = V(p.x + 0.28 * h, h, p.z);
    limb(trunk, top, h * 0.095, shade);
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4 + p.x,
        base = trunk.clone().lerp(top, 0.25 + i * 0.1),
        k = h * (0.28 + 0.15 * (i % 2)),
        bend = base.clone().add(V(Math.cos(a) * k, k * 0.44, Math.sin(a) * k));
      limb(base, bend, h * 0.063, shade);
      limb(
        bend,
        bend.clone().add(V(0.12 * k, k * 0.87, 0.1 * k)),
        h * 0.048,
        shade,
      );
      const fork = bend
        .clone()
        .add(
          V(
            Math.cos(a + 0.9) * k * 0.55,
            k * 0.43,
            Math.sin(a + 0.9) * k * 0.55,
          ),
        );
      limb(bend, fork, h * 0.042, shade);
      prop(
        round,
        shade,
        fork.x,
        fork.y,
        fork.z,
        h * 0.055,
        h * 0.08,
        h * 0.055,
      );
    }
  }
  function sail(x, z, scale, a) {
    const p = V(x, 0, z);
    if (!clearLand(p, 4)) return;
    prop(crag, 0xf9e9c4, x, 0.1, z, 1.15 * scale, 0.6 * scale, 3.9 * scale, a);
    prop(
      cyl,
      0x665240,
      x,
      2.6 * scale,
      z,
      0.06 * scale,
      5.2 * scale,
      0.06 * scale,
    );
    prop(sailShape, 0xe94e3a, x, 0.5 * scale, z, scale, scale, scale, a);
    prop(
      sailShape,
      0xffe7aa,
      x,
      0.5 * scale,
      z,
      scale * 0.65,
      scale * 0.76,
      scale * 0.7,
      a + Math.PI,
    );
  }
  const sailShape = new THREE.BufferGeometry();
  sailShape.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0.3, 0.08, 0, 4.9, 0.08, 0.22, 1, 2.3, 0, 0.3, 0.08, 0.22, 1, 2.3, 0,
        0.3, 2.55,
      ],
      3,
    ),
  );
  sailShape.computeVertexNormals();
  const movers = [],
    hazards = [],
    jumps = [];
  let bridge = null;
  function gate(t, steel = false) {
    const f = frameAt(t * L);
    for (const side of [-1, 1]) {
      const p = locate(t * L, side * 14.6);
      if (steel) {
        along(t * L, side * 13.5, 5, cube, 0x3e5550, 0.85, 10, 1.4);
        along(t * L, side * 13.5, 1.5, cube, 0xf7bb4d, 1.15, 0.7, 1.6);
      } else {
        prop(crag, 0x986c64, p.x, 3, p.z, 3, 5.6, 3, f.angle);
        coralTree(p, 6.5, side < 0 ? 0xde6f72 : 0xe69650);
        const cap = locate(t * L, side * 8.8);
        prop(
          crag,
          0xc47f78,
          cap.x,
          8.6,
          cap.z,
          6.6,
          2.3,
          2.5,
          f.angle,
          side * 0.15,
        );
      }
    }
    if (steel) {
      along(t * L, 0, 9.7, cube, 0x9a6339, 28, 0.65, 1.5);
      for (let l = -12; l <= 12; l += 4)
        along(t * L, l, 9.2, cube, 0xffbb68, 0.8, 0.27, 0.7);
    }
  }
  function warningBoard(t, l, label) {
    const p = locate(t * L, l),
      b = sign(label, 6, 1.2, "#593526", "#ffe0a2");
    b.position.set(p.x, 2.8, p.z);
    b.rotation.y = frameAt(t * L).angle + Math.PI;
    scene.add(b);
    along(t * L, l, 1.35, cyl, 0x3f4743, 0.13, 2.7, 0.13);
  }
  const palette =
    id === 0
      ? [0x9b8977, 0xcab990, 0x5b875a]
      : id === 1
        ? [0xa87870, 0xd1a684, 0x438a76]
        : [0x52624e, 0x938760, 0x446242];
  for (let i = 0; i < 62; i++) {
    const t = (i + 0.4) / 62,
      d = t * L,
      side = i % 2 ? 1 : -1,
      p = locate(d, side * (32 + random() * 34)),
      r = 6 + random() * 8;
    if (!clearLand(p, r)) continue;
    if (id !== 2) {
      const h = 2 + random() * (id ? 10 : 5);
      prop(crag, palette[0], p.x, h * 0.15, p.z, r, h, r * 0.78, i * 0.7);
      prop(
        crag,
        palette[1],
        p.x - 1,
        h * 0.2,
        p.z + 1,
        r * 0.95,
        h * 0.68,
        r * 0.88,
        i * 0.7,
      );
      prop(
        crag,
        palette[2],
        p.x + 0.5,
        h * 0.67,
        p.z,
        r * 0.64,
        h * 0.36,
        r * 0.56,
        i * 0.7,
      );
      if (id === 1) {
        coralTree(
          V(p.x + r * 0.6, 0, p.z),
          3 + random() * 3,
          i % 2 ? 0xcf5978 : 0xdc875b,
        );
      }
    } else {
      prop(crag, 0x746545, p.x, -1, p.z, r, 2.3, r);
      for (let j = 0; j < 3; j++) {
        const x = p.x + Math.sin(i + j) * 3,
          z = p.z + Math.cos(i - j) * 3,
          h = 6 + random() * 4;
        const trunk = V(x, 3, z);
        limb(trunk, V(x + 0.7, h, z), 0.43, 0x6a5840);
        for (let k = 0; k < 4; k++) {
          const a = k * 1.57 + i;
          limb(
            trunk,
            V(x + Math.cos(a) * 2.8, -0.6, z + Math.sin(a) * 2.8),
            0.22,
            0x836947,
          );
        }
        for (let k = 0; k < 3; k++)
          prop(
            crag,
            [0x365e44, 0x477447, 0x5c804d][k],
            x + Math.cos(k * 2.1) * 2,
            h + k * 0.3,
            z + Math.sin(k * 2.1) * 2,
            3.7,
            2.4,
            3.4,
            i + k,
          );
      }
    }
  }
  if (id === 0) {
    for (const [d, l, a] of [
      [0.06, 53, 0.4],
      [0.33, -69, -0.2],
      [0.397, -41, 1.6],
      [0.83, -47, 0.8],
    ]) {
      const p = locate(d * L, l);
      sail(p.x, p.z, 1.5, a);
    }
    for (const t of [0.085, 0.22, 0.52, 0.73]) {
      for (let k = 0; k < 5; k++) {
        const p = locate(t * L + k * 4, -16);
        prop(cyl, 0x775d47, p.x, 2.5, p.z, 0.07, 5, 0.07);
        prop(
          sailShape,
          k % 2 ? 0xfb754f : 0xffce60,
          p.x,
          2.8,
          p.z,
          0.43,
          0.43,
          0.43,
          frameAt(t * L).angle + 0.7,
        );
      }
    }
  } else if (id === 1) {
    for (const t of [0.075, 0.18, 0.406, 0.59, 0.83]) gate(t);
    for (const [t, l] of [
      [0.194, -4],
      [0.552, 4],
      [0.803, -2],
    ]) {
      const p = locate(t * L, l),
        mat = new THREE.MeshBasicMaterial({
          color: 0x78ffe2,
          transparent: true,
          opacity: 0.64,
          depthWrite: false,
        });
      const spiralPts = Array.from({ length: 74 }, (_, k) => {
        const a = k * 0.16,
          r = 0.22 + k * 0.047;
        return V(Math.sin(a) * r, 0, Math.cos(a) * r);
      });
      const whirl = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(spiralPts),
        mat,
      );
      whirl.position.set(p.x, -0.11, p.z);
      scene.add(whirl);
      hazards.push({ t, l, type: "whirl", radius: 3.4 });
      movers.push(whirl);
      warningBoard(t - 0.013, -12, "REDEMOINHO");
    }
    for (const t of [0.475, 0.7]) {
      jumps.push(t);
      for (let j = 0; j < 5; j++)
        along(
          t * L - 6 + j * 1.3,
          0,
          0.12 + j * 0.21,
          cube,
          0xdaa38e,
          7,
          0.24,
          1.65,
        );
    }
  } else {
    for (const t of [0.11, 0.427, 0.61, 0.88]) gate(t, true);
    const mechanicalMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.74,
      metalness: 0.13,
    });
    function assemblyPart(
      g,
      color,
      x,
      y,
      z,
      sx = 1,
      sy = 1,
      sz = 1,
      angle = 0,
    ) {
      dummy.position.set(x, y, z);
      dummy.scale.set(sx, sy, sz);
      dummy.rotation.set(0, 0, angle);
      dummy.updateMatrix();
      return { g, color, matrix: dummy.matrix.clone() };
    }
    const gearParts = [
      assemblyPart(new THREE.TorusGeometry(2, 0.38, 5, 20), 0xc28c51, 0, 0, 0),
    ];
    for (let k = 0; k < 10; k++) {
      const a = (k * TAU) / 10;
      gearParts.push(
        assemblyPart(
          cube,
          0xc28c51,
          Math.sin(a) * 2.26,
          Math.cos(a) * 2.26,
          0,
          0.62,
          0.85,
          0.55,
          -a,
        ),
      );
    }
    const wheelGeometry = mergeParts(gearParts);
    for (const t of [0.12, 0.41, 0.54, 0.78]) {
      const p = locate(t * L, 24),
        f = frameAt(t * L);
      prop(cube, 0x384b45, p.x, 6, p.z, 3, 12, 3, f.angle);
      prop(cube, 0xbc864b, p.x, 12, p.z, 14, 0.7, 1, f.angle);
      const gear = new THREE.Mesh(wheelGeometry, mechanicalMaterial);
      gear.rotation.y = f.angle;
      gear.position.set(p.x, 6, p.z + 1.8);
      scene.add(gear);
      movers.push(gear);
    }
    const t = 0.55,
      span = 19,
      f = frameAt(t * L);
    const bridgeParts = [
      assemblyPart(cube, 0x967956, 0, 0, span / 2, 18, 0.36, span),
    ];
    for (let k = 0; k < 10; k++)
      bridgeParts.push(
        assemblyPart(cube, 0x534c3d, 0, 0.23, 1 + 1.8 * k, 18, 0.08, 0.12),
      );
    const o = new THREE.Mesh(mergeParts(bridgeParts), mechanicalMaterial);
    o.position.copy(locate(t * L));
    o.position.y = 0.1;
    o.rotation.y = f.angle;
    o.rotation.order = "YXZ";
    scene.add(o);
    bridge = { t, span, o };
    for (const [at, l] of [
      [0.21, -4],
      [0.677, 3],
      [0.815, -2],
    ]) {
      const d = at * L;
      along(d, l, 0.4, crag, 0x86684b, 2.5, 0.85, 1.3, 0.45);
      hazards.push({ t: at, l, type: "root", radius: 2.6 });
      warningBoard(at - 0.016, -12, "RAÍZES");
    }
  }

  if (id > 0) {
    for (let k = 2; k < 17; k++) {
      const p = routePoint(
        pier.entry + (pier.span * k) / 18,
        pier.lane + (k % 2 ? 1 : -1) * (pier.half + 1.8),
        true,
      );
      if (id === 1) {
        prop(crag, 0xae8179, p.x, 0.6, p.z, 1.8, 2.3, 2.3, k);
        if (k % 3 === 0) coralTree(p, 2.8, 0xe89270);
      } else prop(cyl, 0x986a41, p.x, 0.7, p.z, 0.27, 2.4, 0.27);
    }
  }
  for (let s of [-1, 1]) along(0, s * 12, 4.1, cube, 0xff6437, 0.85, 8.2, 1.1);
  along(0, 0, 8, cube, 0x163637, 25, 1.9, 1.1);
  for (let i = 0; i < 20; i++)
    for (let k = 0; k < 2; k++)
      along(
        k * 0.95,
        -10.45 + i * 1.1,
        0.11,
        cube,
        (i + k) % 2 ? 0xf9f6e5 : 0x203332,
        1.1,
        0.09,
        0.95,
      );
  const fullProps = [],
    liteChunks = new Map(),
    liteRound = new THREE.SphereGeometry(1, 8, 5),
    liteCylinder = new THREE.CylinderGeometry(1, 1, 1, 6);
  for (const b of batches.values()) {
    for (const matrix of b.matrices) {
      const x = matrix.elements[12],
        z = matrix.elements[14],
        key = Math.floor(x / 110) + "," + Math.floor(z / 110);
      const bin = liteChunks.get(key) ?? [];
      liteChunks.set(key, bin);
      bin.push({
        g: b.geo === round ? liteRound : b.geo === cyl ? liteCylinder : b.geo,
        matrix,
        color: b.col,
      });
    }

    const m = new THREE.InstancedMesh(
      b.geo,
      (mats[b.col] ??= material(b.col)),
      b.matrices.length,
    );
    b.matrices.forEach((v, i) => m.setMatrixAt(i, v));
    m.frustumCulled = false;
    fullProps.push(m);
    scene.add(m);
  }
  batches.clear();
  function mergeParts(parts) {
    const positions = [],
      normals = [],
      colors = [],
      indices = [],
      v = V(),
      n = new THREE.Matrix3();
    for (const { g, matrix, color } of parts) {
      const p = g.attributes.position,
        norm = g.attributes.normal,
        offset = positions.length / 3,
        c = new THREE.Color(color).convertSRGBToLinear();
      n.getNormalMatrix(matrix);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(matrix);
        positions.push(v.x, v.y, v.z);
        v.fromBufferAttribute(norm, i).applyNormalMatrix(n);
        normals.push(v.x, v.y, v.z);
        colors.push(c.r, c.g, c.b);
      }
      const count = g.index?.count ?? p.count;
      for (let i = 0; i < count; i++)
        indices.push(offset + (g.index ? g.index.getX(i) : i));
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(indices);
    for (const [k, v] of [
      ["position", positions],
      ["normal", normals],
      ["color", colors],
    ])
      g.setAttribute(k, new THREE.Float32BufferAttribute(v, 3));
    g.computeBoundingSphere();
    return g;
  }
  const liteProps = [],
    liteSurface = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    });
  for (const bin of liteChunks.values()) {
    const m = new THREE.Mesh(mergeParts(bin), liteSurface);
    m.visible = false;
    scene.add(m);
    liteProps.push(m);
  }
  liteChunks.clear();
  const liteWater = new THREE.Mesh(
    new THREE.PlaneGeometry(2650, 2650, 1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x309b9b }),
  );
  liteWater.position.y = -0.7;
  liteWater.visible = false;
  scene.add(liteWater);
  function simpleBike(paint) {
    const parts = [];
    function part(g, c, x, y, z, w, h, l, rx = 0) {
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, 0, 0);
      dummy.scale.set(w, h, l);
      dummy.updateMatrix();
      parts.push({ g, matrix: dummy.matrix.clone(), color: c });
    }
    part(liteRound, paint, 0, 0.38, 0.1, 0.68, 0.4, 2.35);
    for (const side of [-1, 1]) {
      part(liteRound, 0x1c3942, side * 0.64, 0.23, -0.14, 0.24, 0.23, 1.65);
      part(liteRound, 0x42efdb, side * 0.59, 0.33, -1.68, 0.15, 0.13, 0.64);
    }
    part(liteRound, 0x294450, 0, 0.89, -0.12, 0.25, 0.43, 0.28, 0.5);
    part(liteRound, paint, 0, 1.28, 0.12, 0.25, 0.25, 0.24);
    part(liteRound, 0x153440, 0, 1.29, 0.28, 0.23, 0.13, 0.12);
    return new THREE.Mesh(
      mergeParts(parts),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
  }

  function sign(text, w, h, bg, fg) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 128);
    g.fillStyle = fg;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "italic 900 80px Arial";
    g.fillText(text, 512, 69, 990);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    const o = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    return o;
  }
  for (const [d, l, text] of [
    [
      pier.entry - 29,
      12,
      [
        "PÍER  ›   |   BOIAS  ↑",
        "FENDA  ›   |   ARCOS  ↑",
        "CANAL  ›   |   PONTE  ↑",
      ][id],
    ],
    [pier.entry + 26, 0, id === 2 ? "CANAL" : "POUSO"],
    [marks.pole * L - 25, 12, "GANCHO  •  E"],
  ]) {
    const landing = text === "POUSO" || text === "CANAL",
      f = routeFrame(d, landing),
      p = routePoint(d, landing ? pier.lane + 7.4 : l, landing),
      board = sign(
        text,
        landing ? 4.6 : 9,
        landing ? 0.8 : 1.5,
        "#134744",
        "#f5e9b2",
      );
    board.position.set(p.x, landing ? 2.3 : 3, p.z);
    board.rotation.y = f.angle + Math.PI;
    scene.add(board);
  }
  const gantrySign = sign(
    "JET RUSH    //    " + config.name.toUpperCase(),
    23.6,
    1.8,
    "#153435",
    "#eeeedf",
  );
  gantrySign.position.copy(locate(0));
  gantrySign.position.y = 8;
  gantrySign.rotation.y = frameAt(0).angle + Math.PI;
  gantrySign.translateZ(0.57);
  scene.add(gantrySign);
  const boxes = [];
  for (const d of marks.boxes) {
    for (const l of [-5, 0, 5]) {
      let m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.94),
        new THREE.MeshStandardMaterial({
          color: 0xffc156,
          emissive: 0xbb4907,
          emissiveIntensity: 0.6,
          flatShading: true,
        }),
      );
      m.position.copy(locate(d * L, l));
      m.position.y = 1.45;
      scene.add(m);
      boxes.push({ m, d: d * L, l, cool: 0 });
    }
  }
  if (id === 1) {
    const d = pier.entry + 0.55 * pier.span,
      m = boxes[0].m.clone();
    m.position.copy(routePoint(d, pier.lane, true));
    m.position.y = 1.4;
    scene.add(m);
    boxes.push({ m, d, l: pier.lane, branch: true, cool: 0 });
  }
  const hookLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([V(), V()]),
    new THREE.LineBasicMaterial({ color: 0x62ffc9 }),
  );
  hookLine.frustumCulled = false;
  scene.add(hookLine);
  hookLine.visible = false;
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  const shadowCtx = shadowCanvas.getContext("2d"),
    shadowGrad = shadowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  shadowGrad.addColorStop(0, "rgba(10,26,31,.7)");
  shadowGrad.addColorStop(1, "rgba(10,26,31,0)");
  shadowCtx.fillStyle = shadowGrad;
  shadowCtx.fillRect(0, 0, 64, 64);
  const shadowMap = new THREE.CanvasTexture(shadowCanvas);
  // Uma malha estática por adversário mantém os detalhes da moto com uma chamada de desenho.
  function markerBike(color, index = 0) {
    const built = HighPolyJetMotoBuilder.build(
      chassisIds[index],
      color,
      "#273b42",
      "#2ae2bb",
    );
    built.root.updateMatrixWorld(true);
    const vertices = [],
      normals = [],
      colors = [],
      indices = [],
      v = V(),
      normalMatrix = new THREE.Matrix3();
    built.root.traverse((part) => {
      if (!part.isMesh) return;
      const g = part.geometry,
        pos = g.attributes.position,
        norm = g.attributes.normal,
        c = part.material.color.clone().convertSRGBToLinear(),
        offset = vertices.length / 3;
      normalMatrix.getNormalMatrix(part.matrixWorld);
      for (let j = 0; j < pos.count; j++) {
        v.fromBufferAttribute(pos, j).applyMatrix4(part.matrixWorld);
        vertices.push(v.x, v.y, v.z);
        v.fromBufferAttribute(norm, j).applyNormalMatrix(normalMatrix);
        normals.push(v.x, v.y, v.z);
        colors.push(c.r, c.g, c.b);
      }
      const count = g.index ? g.index.count : pos.count;
      for (let j = 0; j < count; j++)
        indices.push(offset + (g.index ? g.index.getX(j) : j));
    });
    disposeBike(built);
    const g = new THREE.BufferGeometry();
    g.setIndex(indices);
    for (const [name, data] of [
      ["position", vertices],
      ["normal", normals],
      ["color", colors],
    ])
      g.setAttribute(name, new THREE.Float32BufferAttribute(data, 3));
    return new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.58,
        metalness: 0.32,
        envMapIntensity: 0.55,
      }),
    );
  }

  function waterFX() {
    const count = 8,
      segments = 12,
      positions = new Float32Array(count * segments * 12),
      colors = new Float32Array(positions.length),
      alpha = new Float32Array(positions.length / 3),
      indices = [],
      history = Array.from({ length: count }, () => []);
    const g = new THREE.BufferGeometry();
    for (let i = 0; i < count; i++)
      for (let s = 0; s < segments - 1; s++)
        for (let side = 0; side < 2; side++) {
          const k = (i * segments + s) * 4 + side * 2;
          indices.push(k, k + 1, k + 4, k + 1, k + 5, k + 4);
        }
    g.setIndex(indices);
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute(
      "weight",
      new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage),
    );
    const material = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      vertexShader:
        "attribute vec3 color;attribute float weight;varying vec3 tint;varying float opacity;void main(){tint=color;opacity=weight;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader:
        "varying vec3 tint;varying float opacity;void main(){gl_FragColor=vec4(tint,opacity);}",
    });
    const ribbon = new THREE.Mesh(g, material);
    ribbon.frustumCulled = false;
    ribbon.renderOrder = 3;
    scene.add(ribbon);
    let lastTime = -1;
    return (riders, time, reset = false) => {
      if (reset || time < lastTime) {
        history.forEach((h) => (h.length = 0));
        lastTime = -1;
      }
      if (lastTime >= 0 && time - lastTime < 0.044) return;
      lastTime = time;
      alpha.fill(0);
      for (let i = 0; i < riders.length; i++) {
        const r = riders[i],
          p = r.obj.position,
          f = r.obj.rotation.y,
          h = history[i],
          wet = surf(wrap(r.d, L) / L) === "water" && (!r.branch || id === 2),
          hot = r.boost > 0,
          sliding = r.drift > 0.1 || Math.abs(r.slip) > 4;
        const power =
          r.hang || Math.abs(r.speed) < 5
            ? 0
            : hot
              ? 0.76
              : wet
                ? 0.62
                : sliding
                  ? 0.49
                  : 0;
        const y = wet ? -0.12 : Math.max(0.13, p.y - 0.32),
          sample = {
            x: p.x - Math.sin(f) * 1.85,
            y,
            z: p.z - Math.cos(f) * 1.85,
            c: Math.cos(f),
            s: Math.sin(f),
            wet,
            hot,
            power,
          };
        if (h.length && Math.hypot(sample.x - h[0].x, sample.z - h[0].z) > 9)
          h.length = 0;
        h.unshift(sample);
        if (h.length > segments) h.pop();
        for (let j = 0; j < segments; j++) {
          const a = h[Math.min(j, h.length - 1)],
            age = j / (segments - 1),
            offset = 0.45 + (a.wet ? 2.8 : 0.45) * age,
            width = (a.wet ? 0.3 : 0.15) * (1 - age) + 0.045;
          for (let q = 0; q < 4; q++) {
            const k = (i * segments + j) * 4 + q,
              sign = q < 2 ? -1 : 1,
              lateral = sign * (offset + (q % 2 ? width : -width));
            positions[3 * k] = a.x + a.c * lateral;
            positions[3 * k + 1] = a.y + 0.03 * age;
            positions[3 * k + 2] = a.z - a.s * lateral;
            colors[3 * k] = a.hot ? 0.25 : a.wet ? 0.83 : 1;
            colors[3 * k + 1] = a.hot ? 0.95 : a.wet ? 0.99 : 0.79;
            colors[3 * k + 2] = a.hot ? 0.85 : a.wet ? 1 : 0.49;
            alpha[k] = j < h.length ? a.power * (1 - age) ** 1.4 : 0;
          }
        }
      }
      for (const attr of ["position", "color", "weight"])
        g.attributes[attr].needsUpdate = true;
    };
  }
  const updateWakes = waterFX();

  return {
    scene,
    L,
    N,
    samples,
    surf,
    frameAt,
    locate,
    wrap,
    ang,
    pier,
    marks,
    routeFrame,
    routePoint,
    pierSamples,
    sky,
    ocean,
    liteWater,
    liteProps,
    fullProps,
    poles,
    boxes,
    hookLine,
    shadowMap,
    markerBike,
    simpleBike,
    illuminate,
    hazards,
    jumps,
    bridge,
    movers,
    updateWakes,
  };
}
let {
  scene,
  L,
  N,
  samples,
  surf,
  frameAt,
  locate,
  wrap,
  ang,
  pier,
  marks,
  routeFrame,
  routePoint,
  pierSamples,
  sky,
  ocean,
  liteWater,
  liteProps,
  fullProps,
  poles,
  boxes,
  hookLine,
  shadowMap,
  markerBike,
  simpleBike,
  illuminate,
  hazards,
  jumps,
  bridge,
  movers,
  updateWakes,
} = createCircuit(0);
function changeCircuit(id) {
  if (id === trackId) return;
  const materials = new Set(),
    geometries = new Set(),
    textures = new Set([shadowMap]);
  scene.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material) materials.add(o.material);
  });
  materials.forEach((m) => {
    for (const value of Object.values(m))
      if (value?.isTexture && value !== env.texture) textures.add(value);
    m.dispose();
  });
  textures.forEach((t) => t.dispose());
  geometries.forEach((g) => g.dispose());
  renderer.renderLists?.dispose();
  trackId = id;
  ({
    scene,
    L,
    N,
    samples,
    surf,
    frameAt,
    locate,
    wrap,
    ang,
    pier,
    marks,
    routeFrame,
    routePoint,
    pierSamples,
    sky,
    ocean,
    liteWater,
    liteProps,
    fullProps,
    poles,
    boxes,
    hookLine,
    shadowMap,
    markerBike,
    simpleBike,
    illuminate,
    hazards,
    jumps,
    bridge,
    movers,
    updateWakes,
  } = createCircuit(id));
  activeQuality = -1;
  updateMapBounds();
  illuminate();
}
