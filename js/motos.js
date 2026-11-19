"use strict";
const CustomShaders = {
  // 1. Domo Atmosférico GLSL com Espalhamento Rayleigh/Mie, Nuvens e Aurora
  createSkyDomeMaterial() {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.45, 0.42, -0.78).normalize() },
        uZenithColor: { value: new THREE.Color(0x0284c7) },
        uHorizonColor: { value: new THREE.Color(0xbae6fd) },
        uSunColor: { value: new THREE.Color(0xfef08a) },
        uNightMode: { value: 0.0 },
      },
      vertexShader: `
              varying vec3 vWorldPos;
              void main() {
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorldPos = wp.xyz;
                gl_Position = projectionMatrix * viewMatrix * wp;
              }
            `,
      fragmentShader: `
              varying vec3 vWorldPos;
              uniform float uTime;
              uniform vec3 uSunDir;
              uniform vec3 uZenithColor;
              uniform vec3 uHorizonColor;
              uniform vec3 uSunColor;
              uniform float uNightMode;

              float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
              }
              float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                           mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
              }
              float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                for (int i = 0; i < 4; i++) {
                  v += a * noise(p);
                  p *= 2.04;
                  a *= 0.5;
                }
                return v;
              }

              void main() {
                vec3 dir = normalize(vWorldPos);
                float h = clamp(dir.y, 0.0, 1.0);
                vec3 col = mix(uHorizonColor, uZenithColor, pow(h, 0.58));

                // Disco solar e halo Mie
                float sunAmt = max(dot(dir, uSunDir), 0.0);
                col += uSunColor * pow(sunAmt, 14.0) * 0.48;
                col += uSunColor * smoothstep(0.996, 0.9995, sunAmt) * 1.4;

                // Camada de nuvens cúmulos procedurais no horizonte alto
                if (dir.y > 0.04) {
                  vec2 uv = dir.xz / (dir.y + 0.16) * 1.35 + vec2(uTime * 0.018, uTime * 0.008);
                  float cl = fbm(uv);
                  float cloudMask = smoothstep(0.47, 0.76, cl) * smoothstep(0.04, 0.25, dir.y) * (1.0 - uNightMode * 0.65);
                  vec3 cloudCol = mix(uHorizonColor * 1.15, vec3(1.0), 0.65);
                  col = mix(col, cloudCol, cloudMask * 0.68);
                }

                // Estrelas e Aurora Vórtice no modo Noite Neon
                if (uNightMode > 0.1 && dir.y > 0.05) {
                  float stars = pow(hash(floor(dir.xz * 260.0)), 22.0) * smoothstep(0.15, 0.6, dir.y);
                  float aurora = sin(dir.x * 8.0 + uTime * 0.9) * cos(dir.z * 6.0 - uTime * 0.5);
                  vec3 aurCol = mix(vec3(0.0, 0.94, 1.0), vec3(1.0, 0.16, 0.52), aurora * 0.5 + 0.5);
                  col += aurCol * smoothstep(0.2, 0.65, aurora) * 0.35 * uNightMode;
                  col += vec3(stars) * uNightMode;
                }

                gl_FragColor = vec4(col, 1.0);
              }
            `,
    });
  },

  // 2. Shader GLSL de Oceano & Lagoa com Ondas Gerstner, Fresnel e Glitter Solar
  createOceanMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.45, 0.42, -0.78).normalize() },
        uSunColor: { value: new THREE.Color(0xfef08a) },
        uDeepColor: { value: new THREE.Color(0x0369a1) },
        uShallowColor: { value: new THREE.Color(0x00f0ff) },
        uSkyColor: { value: new THREE.Color(0x7dd3fc) },
      },
      vertexShader: `
              uniform float uTime;
              varying vec3 vWorldPos;
              varying vec3 vNormal;
              varying float vWaveHeight;

              void main() {
                vec3 p = position;
                float w1 = sin(p.x * 0.055 + uTime * 2.1) * cos(p.z * 0.045 + uTime * 1.7) * 0.24;
                float w2 = sin((p.x + p.z) * 0.11 - uTime * 3.1) * 0.09;
                p.y += w1 + w2;
                vWaveHeight = w1 + w2;

                // Normal aproximada por diferenças finitas
                float dx = cos(p.x * 0.055 + uTime * 2.1) * 0.055 * 0.24 + cos((p.x + p.z) * 0.11 - uTime * 3.1) * 0.11 * 0.09;
                float dz = -sin(p.z * 0.045 + uTime * 1.7) * 0.045 * 0.24 + cos((p.x + p.z) * 0.11 - uTime * 3.1) * 0.11 * 0.09;
                vNormal = normalize(vec3(-dx * 2.6, 1.0, -dz * 2.6));

                vec4 wp = modelMatrix * vec4(p, 1.0);
                vWorldPos = wp.xyz;
                gl_Position = projectionMatrix * viewMatrix * wp;
              }
            `,
      fragmentShader: `
              uniform float uTime;
              uniform vec3 uSunDir;
              uniform vec3 uSunColor;
              uniform vec3 uDeepColor;
              uniform vec3 uShallowColor;
              uniform vec3 uSkyColor;

              varying vec3 vWorldPos;
              varying vec3 vNormal;
              varying float vWaveHeight;

              void main() {
                vec3 V = normalize(cameraPosition - vWorldPos);
                // Micro-ondulação procedural na normal
                float detail = 1.0 - smoothstep(18.0, 125.0, distance(cameraPosition, vWorldPos));
                float waveA = sin(dot(vWorldPos.xz, vec2(0.54, 0.28)) + uTime * 2.3);
                float waveB = cos(dot(vWorldPos.xz, vec2(-0.69, 1.15)) - uTime * 2.9);
                float ripple = (waveA * 0.055 + waveB * 0.038) * (0.28 + 0.72 * detail);
                vec3 N = normalize(vNormal + vec3(ripple, 0.0, -ripple));

                // Efeito Fresnel
                float fresnel = pow(1.0 - max(dot(V, N), 0.0), 3.2);

                // Cáusticas turquesa nas cristas
                float crest = smoothstep(0.06, 0.30, vWaveHeight + ripple * 0.5);
                vec3 waterCol = mix(uDeepColor, uShallowColor, crest * 0.65 + 0.18);
                waterCol = mix(waterCol, uSkyColor, fresnel * 0.62);

                // Especular solar intenso (Glitter Path)
                vec3 H = normalize(uSunDir + V);
                float spec = pow(max(dot(N, H), 0.0), 96.0);
                waterCol += uSunColor * spec * 0.85;

                // Espuma branca nas cristas altas
                float foam = smoothstep(0.24, 0.34, vWaveHeight + ripple * 0.6);
                waterCol = mix(waterCol, vec3(0.95, 0.99, 1.0), foam * 0.45);

                gl_FragColor = vec4(waterCol, 1.0);
              }
            `,
    });
  },

  // 3. Shader GLSL de Pós-Combustão de Plasma com Shock Diamonds
  createAfterburnerMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uBoost: { value: 0.0 },
        uCoreColor: { value: new THREE.Color(0x00f0ff) },
        uBoostColor: { value: new THREE.Color(0xff2a85) },
      },
      vertexShader: `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
      fragmentShader: `
              varying vec2 vUv;
              uniform float uTime;
              uniform float uBoost;
              uniform vec3 uCoreColor;
              uniform vec3 uBoostColor;

              void main() {
                // vUv.y vai da base do bocal (1.0) até a ponta da chama (0.0)
                float along = vUv.y;
                // Shock diamonds periódicos ao longo do jato supersônico
                float diamonds = pow(abs(sin(along * 18.0 - uTime * 38.0)), 3.0);
                float core = smoothstep(0.0, 0.85, along);
                vec3 baseCol = mix(uCoreColor, uBoostColor, uBoost);
                vec3 finalCol = mix(baseCol, vec3(1.0, 0.98, 0.9), diamonds * 0.65 + pow(along, 3.0) * 0.5);
                float alpha = core * (0.55 + diamonds * 0.45);
                gl_FragColor = vec4(finalCol, alpha);
              }
            `,
    });
  },
};

class ProceduralTextureFactory {
  static createGlowSpriteTexture() {
    if (this._glowTex) return this._glowTex;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
    g.addColorStop(0.28, "rgba(255, 255, 255, 0.68)");
    g.addColorStop(0.65, "rgba(255, 255, 255, 0.16)");
    g.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    this._glowTex = new THREE.CanvasTexture(canvas);
    return this._glowTex;
  }

  static createGlowSprite(colorHex, scale = 2.5, opacity = 0.85) {
    const mat = new THREE.SpriteMaterial({
      map: this.createGlowSpriteTexture(),
      color: colorHex,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(scale, scale, 1);
    return sp;
  }

  static createCarbonBumpTexture() {
    if (this._carbonTex) return this._carbonTex;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) {
      for (let x = 0; x < 64; x += 8) {
        const offset = ((y / 8) % 2) * 4;
        ctx.fillStyle = "#c8c8c8";
        ctx.fillRect((x + offset) % 64, y, 4, 4);
        ctx.fillStyle = "#404040";
        ctx.fillRect((x + offset + 4) % 64, y + 4, 4, 4);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(18, 18);
    this._carbonTex = tex;
    return tex;
  }

  static createEnvMap(timeOfDay = "day") {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    const skyGrad = ctx.createLinearGradient(0, 0, 0, 512);
    if (timeOfDay === "day") {
      skyGrad.addColorStop(0.0, "#0284c7");
      skyGrad.addColorStop(0.32, "#38bdf8");
      skyGrad.addColorStop(0.49, "#e0f2fe");
      skyGrad.addColorStop(0.51, "#00f0ff");
      skyGrad.addColorStop(0.7, "#0284c7");
      skyGrad.addColorStop(1.0, "#042f2e");
    } else if (timeOfDay === "sunset") {
      skyGrad.addColorStop(0.0, "#1e1b4b");
      skyGrad.addColorStop(0.28, "#be185d");
      skyGrad.addColorStop(0.48, "#f97316");
      skyGrad.addColorStop(0.51, "#fde047");
      skyGrad.addColorStop(0.72, "#0f172a");
      skyGrad.addColorStop(1.0, "#020617");
    } else {
      skyGrad.addColorStop(0.0, "#020617");
      skyGrad.addColorStop(0.35, "#0f172a");
      skyGrad.addColorStop(0.49, "#00f0ff");
      skyGrad.addColorStop(0.52, "#ff2a85");
      skyGrad.addColorStop(0.75, "#090d16");
      skyGrad.addColorStop(1.0, "#020617");
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // Brilho especular de estúdio + sol para reflexos automotivos nítidos
    const sunGrad = ctx.createRadialGradient(512, 200, 6, 512, 200, 165);
    sunGrad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    sunGrad.addColorStop(0.35, "rgba(254, 240, 138, 0.85)");
    sunGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, 1024, 512);

    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(80, 130, 860, 14);
    ctx.fillStyle = "rgba(0, 240, 255, 0.35)";
    ctx.fillRect(100, 238, 280, 18);
    ctx.fillStyle = "rgba(255, 42, 133, 0.35)";
    ctx.fillRect(640, 238, 280, 18);

    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.needsUpdate = true;
    return tex;
  }

  static createRoadTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#182234";
    ctx.fillRect(0, 0, 512, 512);

    // Marcas de pneu / trilhas térmicas e granulação
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle =
        i % 2 === 0 ? "rgba(255,255,255,0.035)" : "rgba(2,6,23,0.10)";
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 16);
    }

    // Padrão de placas de titânio/asfalto
    ctx.strokeStyle = "rgba(56, 189, 248, 0.14)";
    ctx.lineWidth = 1.5;
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Zebras vermelhas e brancas nas bordas
    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = (y / 64) % 2 === 0 ? "#ef4444" : "#f8fafc";
      ctx.fillRect(0, y, 42, 64);
      ctx.fillRect(512 - 42, y, 42, 64);
    }

    // Guias luminosas ciano e laranja
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(44, 0, 7, 512);
    ctx.fillRect(512 - 51, 0, 7, 512);

    ctx.fillStyle = "rgba(255, 183, 3, 0.72)";
    for (let y = 14; y < 512; y += 64) {
      ctx.fillRect(251, y, 10, 38);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 42);
    return tex;
  }

  static createBoostChevronTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, 256, 256);

    const colors = ["#00f0ff", "#ff2a85", "#fde047"];
    for (let i = 0; i < 4; i++) {
      const y = i * 64;
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(22, y + 52);
      ctx.lineTo(128, y + 12);
      ctx.lineTo(234, y + 52);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
}

// =========================================================================
// 3. CONSTRUTOR DE JET MOTOS ULTRA-SCULPTED (4.800–6.200 TRIÂNGULOS)
//    COM LOFTING PARAMÉTRICO E PEÇAS MECÂNICAS MÓVEIS
// =========================================================================
class UltraSculptedJetMotoBuilder {
  // Gera uma malha esculpida suave por lofting entre costelas transversais
  static createLoftedBodyGeometry(stations, radialSegments = 28) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const numStations = stations.length;

    for (let s = 0; s < numStations; s++) {
      const st = stations[s];
      const v = s / (numStations - 1);
      for (let r = 0; r <= radialSegments; r++) {
        const u = r / radialSegments;
        const theta = u * Math.PI * 2;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);

        // Deformação aerodinâmica: quilha em V embaixo, carenagem esculpida em cima e vincos laterais
        const chine =
          1.0 +
          0.14 * Math.cos(theta * 2.0) -
          (cosT < 0 ? 0.12 * Math.pow(-cosT, 1.5) : 0);
        const x = sinT * st.rx * chine;
        const y = st.y + cosT * st.ry * (cosT > 0 ? 1.05 : 0.78);
        const z = st.z;

        positions.push(x, y, z);
        uvs.push(u, v);
      }
    }

    const ringVerts = radialSegments + 1;
    for (let s = 0; s < numStations - 1; s++) {
      for (let r = 0; r < radialSegments; r++) {
        const a = s * ringVerts + r;
        const b = a + 1;
        const c = (s + 1) * ringVerts + r;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  static build(chassisId, primaryColor, secondaryColor, accentColor) {
    const root = new THREE.Group();
    const tiltGroup = new THREE.Group();
    root.add(tiltGroup);

    const carbonBump = ProceduralTextureFactory.createCarbonBumpTexture();

    // Materiais PBR Automotivos Ultra-Brilhantes
    const hullMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(primaryColor),
      metalness: 0.62,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const secMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(secondaryColor),
      metalness: 0.48,
      roughness: 0.24,
      clearcoat: 0.8,
    });
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.35,
      roughness: 0.42,
      bumpMap: carbonBump,
      bumpScale: 0.015,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.95,
      roughness: 0.08,
    });
    const neonMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(accentColor),
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x090d16,
      metalness: 0.15,
      roughness: 0.04,
      transparent: true,
      opacity: 0.76,
      clearcoat: 1.0,
    });

    // 1. FUSELAGEM CENTRAL LOFTED (11 seções transversais esculpidas)
    const stations = [
      { z: -1.92, y: 0.56, rx: 0.03, ry: 0.03 },
      { z: -1.78, y: 0.54, rx: 0.36, ry: 0.22 },
      { z: -1.35, y: 0.52, rx: 0.54, ry: 0.3 },
      { z: -0.75, y: 0.48, rx: 0.62, ry: 0.32 },
      { z: -0.15, y: 0.48, rx: 0.66, ry: 0.36 },
      { z: 0.45, y: 0.52, rx: 0.6, ry: 0.38 },
      { z: 1.05, y: 0.5, rx: 0.48, ry: 0.3 },
      { z: 1.65, y: 0.46, rx: 0.34, ry: 0.22 },
      { z: 2.18, y: 0.42, rx: 0.18, ry: 0.12 },
      { z: 2.52, y: 0.4, rx: 0.06, ry: 0.05 },
      { z: 2.62, y: 0.4, rx: 0.01, ry: 0.01 },
    ];
    const loftedHullGeo = this.createLoftedBodyGeometry(stations, 28);
    const fuselage = new THREE.Mesh(loftedHullGeo, hullMat);
    fuselage.castShadow = true;
    tiltGroup.add(fuselage);

    // 2. NÚCLEO DO REATOR EXPOSTO SOB ALETAS TRASEIRAS
    const coreCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.85, 16).rotateX(Math.PI / 2),
      neonMat,
    );
    coreCylinder.position.set(0, 0.62, -1.12);
    tiltGroup.add(coreCylinder);
    for (let i = 0; i < 5; i++) {
      const louver = new THREE.Mesh(
        new THREE.TorusGeometry(0.27, 0.025, 8, 18, Math.PI),
        carbonMat,
      );
      louver.position.set(0, 0.62, -0.82 - i * 0.14);
      tiltGroup.add(louver);
    }

    // 3. PARA-BRISA CURVO FUMÊ + FARÓIS DIANTEIROS EM LED COM BLOOM
    const canopyGeo = new THREE.SphereGeometry(
      0.46,
      22,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.52,
    );
    canopyGeo.scale(0.86, 0.56, 1.85);
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    canopy.position.set(0, 0.76, 0.68);
    canopy.rotation.x = -0.24;
    tiltGroup.add(canopy);

    [-1, 1].forEach((side) => {
      const headlight = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.05, 0.32),
        new THREE.MeshBasicMaterial({ color: 0xe0f2fe }),
      );
      headlight.position.set(side * 0.24, 0.48, 2.02);
      headlight.rotation.y = side * 0.28;
      tiltGroup.add(headlight);
    });

    // 4. NACELES DE ADMISSÃO LATERAIS + TURBINAS INTERNAS GIRATÓRIAS (PEÇA MÓVEL #1)
    const intakeFans = [];
    [-1, 1].forEach((side) => {
      const podGeo = new THREE.CylinderGeometry(0.26, 0.33, 1.85, 18);
      podGeo.rotateX(Math.PI / 2);
      podGeo.scale(0.88, 0.78, 1.0);
      const pod = new THREE.Mesh(podGeo, secMat);
      pod.position.set(side * 0.56, 0.44, 0.16);
      pod.castShadow = true;
      tiltGroup.add(pod);

      // Rotor de turbina com 6 pás metálicas dentro da tomada de ar frontal
      const fanGroup = new THREE.Group();
      fanGroup.position.set(side * 0.56, 0.44, 1.06);
      const hub = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.18, 12).rotateX(Math.PI / 2),
        chromeMat,
      );
      fanGroup.add(hub);
      for (let b = 0; b < 6; b++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.19, 0.04, 0.02),
          chromeMat,
        );
        blade.rotation.z = (b / 6) * Math.PI * 2;
        blade.rotation.x = 0.45;
        fanGroup.add(blade);
      }
      const ringGlow = new THREE.Mesh(
        new THREE.TorusGeometry(0.21, 0.022, 8, 20),
        neonMat,
      );
      fanGroup.add(ringGlow);
      tiltGroup.add(fanGroup);
      intakeFans.push(fanGroup);

      // Tubos de plasma laterais
      const stripeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.64, 0.46, -1.42),
        new THREE.Vector3(side * 0.72, 0.5, 0.18),
        new THREE.Vector3(side * 0.34, 0.42, 1.98),
      ]);
      tiltGroup.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(stripeCurve, 20, 0.032, 8, false),
          neonMat,
        ),
      );
    });

    // 5. ESQUIS REPULSORES ARTICULADOS COM AMORTECEDORES HIDRÁULICOS (PEÇA MÓVEL #2)
    const hoverSkis = [];
    [
      { x: 0, z: 1.25, w: 0.42, l: 1.15 },
      { x: -0.44, z: -0.78, w: 0.34, l: 1.05 },
      { x: 0.44, z: -0.78, w: 0.34, l: 1.05 },
    ].forEach((skiCfg) => {
      const skiGroup = new THREE.Group();
      skiGroup.position.set(skiCfg.x, 0.12, skiCfg.z);

      // Braço amortecedor hidráulico cromado
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.36, 10),
        chromeMat,
      );
      strut.position.set(0, 0.18, 0);
      strut.rotation.x = -0.25;
      skiGroup.add(strut);

      // Sapata de esqui repulsor chanfrada
      const skiPlate = new THREE.Mesh(
        new THREE.BoxGeometry(skiCfg.w, 0.07, skiCfg.l),
        carbonMat,
      );
      skiGroup.add(skiPlate);

      // Anel emissor de plasma ventral
      const padGlow = new THREE.Mesh(
        new THREE.TorusGeometry(skiCfg.w * 0.42, 0.028, 8, 18).rotateX(
          Math.PI / 2,
        ),
        neonMat,
      );
      padGlow.position.y = -0.04;
      skiGroup.add(padGlow);

      tiltGroup.add(skiGroup);
      hoverSkis.push(skiGroup);
    });

    // 6. COCKPIT 3D DETALHADO (PAINEL HOLOGRÁFICO, GUIDÃO, MANETES E BANCO COSTURADO)
    const saddleGeo = new THREE.SphereGeometry(0.39, 18, 14);
    saddleGeo.scale(0.92, 0.44, 1.85);
    const saddle = new THREE.Mesh(saddleGeo, carbonMat);
    saddle.position.set(0, 0.68, -0.42);
    tiltGroup.add(saddle);

    const barCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.5, 0.88, 0.3),
      new THREE.Vector3(-0.24, 0.96, 0.48),
      new THREE.Vector3(0.0, 0.97, 0.52),
      new THREE.Vector3(0.24, 0.96, 0.48),
      new THREE.Vector3(0.5, 0.88, 0.3),
    ]);
    tiltGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(barCurve, 18, 0.036, 10, false),
        chromeMat,
      ),
    );

    // Manetes de freio e manoplas
    [-1, 1].forEach((side) => {
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.044, 0.22, 10).rotateZ(Math.PI / 2),
        carbonMat,
      );
      grip.position.set(side * 0.42, 0.9, 0.36);
      grip.rotation.y = -side * 0.35;
      tiltGroup.add(grip);
    });

    // Tela HUD 3D iluminada no cockpit (visível na Câmera de Cockpit!)
    const dashGroup = new THREE.Group();
    dashGroup.position.set(0, 0.94, 0.48);
    dashGroup.rotation.x = -0.58;
    const dashFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.22, 0.04),
      carbonMat,
    );
    const dashScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
    );
    dashScreen.position.z = 0.025;
    dashGroup.add(dashFrame, dashScreen);
    tiltGroup.add(dashGroup);

    // 7. FLAPS AERODINÂMICOS ATIVOS / AIRBRAKES (PEÇA MÓVEL #3) + ARQUITETURA DOS 6 CHASSIS
    const aeroFlaps = [];
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(1.18, -0.42);
    wingShape.lineTo(1.28, -0.88);
    wingShape.lineTo(0, -0.68);
    wingShape.closePath();
    const extrudeSettings = {
      depth: 0.06,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    };

    // Criar os dois Flaps móveis superiores que abrem na frenagem/drift
    [-1, 1].forEach((side) => {
      const flapPivot = new THREE.Group();
      flapPivot.position.set(side * 0.48, 0.58, -0.55);
      const flapMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.04, 0.42),
        secMat,
      );
      flapMesh.position.set(side * 0.22, 0.02, -0.18);
      const flapEdge = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.045, 0.05),
        neonMat,
      );
      flapEdge.position.set(side * 0.22, 0.025, -0.39);
      flapPivot.add(flapMesh, flapEdge);
      tiltGroup.add(flapPivot);
      aeroFlaps.push({ pivot: flapPivot, side });
    });

    if (chassisId === "marlin-x") {
      [-1, 1].forEach((side) => {
        const wGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
        wGeo.rotateX(Math.PI / 2);
        if (side < 0) wGeo.scale(-1, 1, 1);
        const wMesh = new THREE.Mesh(wGeo, hullMat);
        wMesh.position.set(side * 0.42, 0.42, 0.28);
        wMesh.rotation.z = -side * 0.12;
        tiltGroup.add(wMesh);

        const finGeo = new THREE.ConeGeometry(0.18, 0.92, 14);
        finGeo.scale(0.32, 1, 1.9);
        const fin = new THREE.Mesh(finGeo, secMat);
        fin.position.set(side * 0.38, 0.84, -1.18);
        fin.rotation.x = -0.38;
        tiltGroup.add(fin);
      });
    } else if (chassisId === "escarpa") {
      [-1, 1].forEach((side) => {
        const gullCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.45, 0.48, 0.12),
          new THREE.Vector3(side * 1.18, 0.72, -0.15),
          new THREE.Vector3(side * 1.72, 0.34, -0.45),
          new THREE.Vector3(side * 1.82, 0.82, -0.68),
        ]);
        const gullGeo = new THREE.TubeGeometry(gullCurve, 22, 0.14, 12, false);
        gullGeo.scale(1, 0.36, 2.25);
        tiltGroup.add(new THREE.Mesh(gullGeo, hullMat));
      });
    } else if (chassisId === "raia-gt") {
      const needleGeo = new THREE.ConeGeometry(0.26, 1.55, 20).rotateX(
        Math.PI / 2,
      );
      const needle = new THREE.Mesh(needleGeo, chromeMat);
      needle.position.set(0, 0.42, 2.72);
      tiltGroup.add(needle);

      // Quilha dorsal central de tubarão
      const spineFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.55, 1.45),
        hullMat,
      );
      spineFin.position.set(0, 0.86, -1.15);
      spineFin.rotation.x = -0.22;
      tiltGroup.add(spineFin);

      [-1, 1].forEach((side) => {
        const deltaGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
        deltaGeo.rotateX(Math.PI / 2);
        deltaGeo.scale(side * 1.38, 1, 1.5);
        const dMesh = new THREE.Mesh(deltaGeo, secMat);
        dMesh.position.set(side * 0.35, 0.38, 0.58);
        tiltGroup.add(dMesh);
      });
    } else if (chassisId === "bumerangue") {
      [-1, 1].forEach((side) => {
        const prongCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.48, 0.42, 0.4),
          new THREE.Vector3(side * 0.96, 0.46, 1.28),
          new THREE.Vector3(side * 0.52, 0.4, 2.62),
        ]);
        tiltGroup.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(prongCurve, 20, 0.16, 12, false),
            hullMat,
          ),
        );
      });
      const coil = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 1),
        neonMat,
      );
      coil.position.set(0, 0.44, 2.32);
      tiltGroup.add(coil);
      intakeFans.push(coil);
    } else if (chassisId === "raptor-jet") {
      const cageGeo = new THREE.TorusGeometry(0.6, 0.055, 12, 24, Math.PI);
      const cage = new THREE.Mesh(cageGeo, chromeMat);
      cage.position.set(0, 0.56, -0.15);
      tiltGroup.add(cage);
    } else if (chassisId === "nimbus") {
      const haloGeo = new THREE.TorusGeometry(0.95, 0.095, 16, 36).rotateY(
        Math.PI / 2,
      );
      const halo = new THREE.Mesh(haloGeo, hullMat);
      halo.position.set(0, 0.66, -0.78);
      tiltGroup.add(halo);

      const innerHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.84, 0.032, 10, 32).rotateY(Math.PI / 2),
        neonMat,
      );
      innerHalo.position.set(0, 0.66, -0.78);
      tiltGroup.add(innerHalo);
    }

    // 8. BOCAIS DE TURBINA VETORIZADOS (GIMBALED NOZZLES - PEÇA MÓVEL #4) + SHADER GLSL DE PLASMA
    const nozzleProfile = [
      new THREE.Vector2(0.17, 0.0),
      new THREE.Vector2(0.29, 0.24),
      new THREE.Vector2(0.24, 0.54),
      new THREE.Vector2(0.3, 0.72),
      new THREE.Vector2(0.22, 0.8),
    ];
    const nozzleGeo = new THREE.LatheGeometry(nozzleProfile, 20).rotateX(
      -Math.PI / 2,
    );
    const flameGeo = new THREE.ConeGeometry(0.23, 1.65, 18, 1, true).rotateX(
      -Math.PI / 2,
    );
    flameGeo.translate(0, 0, -0.82);

    const afterburnerMat = CustomShaders.createAfterburnerMaterial();
    const gimbalNozzles = [];
    const flames = [];

    const offsets =
      chassisId === "raptor-jet"
        ? [
            [-0.48, 0.54],
            [0.48, 0.54],
            [-0.28, 0.28],
            [0.28, 0.28],
          ]
        : [
            [-0.33, 0.45],
            [0.33, 0.45],
          ];

    offsets.forEach(([xOff, yOff]) => {
      const gimbalPivot = new THREE.Group();
      gimbalPivot.position.set(xOff, yOff, -1.42);

      const nozMesh = new THREE.Mesh(nozzleGeo, chromeMat);
      gimbalPivot.add(nozMesh);

      const innerGlow = new THREE.Mesh(
        new THREE.CircleGeometry(0.19, 14).rotateY(Math.PI),
        neonMat,
      );
      innerGlow.position.z = -0.76;
      gimbalPivot.add(innerGlow);

      const flMesh = new THREE.Mesh(flameGeo, afterburnerMat);
      flMesh.position.z = -0.76;
      gimbalPivot.add(flMesh);

      // Halo aditivo de Bloom no bocal
      const haloSprite = ProceduralTextureFactory.createGlowSprite(
        0x00f0ff,
        1.45,
        0.78,
      );
      haloSprite.position.z = -0.88;
      gimbalPivot.add(haloSprite);

      tiltGroup.add(gimbalPivot);
      gimbalNozzles.push(gimbalPivot);
      flames.push({ mesh: flMesh, halo: haloSprite });
    });

    // 9. PILOTO 3D ARTICULADO (~1.200 TRIÂNGULOS) + CACHECOL DE ENERGIA ESULPIDO
    const riderGroup = new THREE.Group();
    riderGroup.position.set(0, 0.68, -0.32);

    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.19, 0.62, 16),
      secMat,
    );
    torso.position.set(0, 0.32, 0.12);
    torso.rotation.x = 0.52;
    riderGroup.add(torso);

    // Protetor de coluna vertebral segmentado
    for (let s = 0; s < 4; s++) {
      const spineNode = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.08, 0.08),
        hullMat,
      );
      spineNode.position.set(0, 0.22 + s * 0.11, -0.06 + s * 0.06);
      spineNode.rotation.x = 0.52;
      riderGroup.add(spineNode);
    }

    // Capacete Esculpido + Viseira Cromada Iridescente
    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0, 0.68, 0.3);
    const helmetShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 20, 18),
      hullMat,
    );
    helmetShell.scale.set(0.92, 0.95, 1.18);
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      metalness: 0.96,
      roughness: 0.04,
      clearcoat: 1.0,
    });
    const visorMesh = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.236,
        18,
        14,
        -Math.PI * 0.35,
        Math.PI * 0.7,
        Math.PI * 0.28,
        Math.PI * 0.34,
      ),
      visorMat,
    );
    visorMesh.rotation.y = Math.PI * 0.5;
    helmetGroup.add(helmetShell, visorMesh);
    riderGroup.add(helmetGroup);

    // Cachecol / Fita Aero flutuante ao vento (PEÇA MÓVEL #5)
    const scarfGroup = new THREE.Group();
    scarfGroup.position.set(0, 0.56, 0.12);
    const scarfMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.85, 2, 8).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(accentColor),
        side: THREE.DoubleSide,
      }),
    );
    scarfMesh.position.z = -0.45;
    scarfGroup.add(scarfMesh);
    riderGroup.add(scarfGroup);

    [-1, 1].forEach((side) => {
      const shoulder = new THREE.Mesh(
        new THREE.SphereGeometry(0.115, 14, 12),
        hullMat,
      );
      shoulder.position.set(side * 0.25, 0.48, 0.22);
      riderGroup.add(shoulder);

      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.25, 0.48, 0.22),
        new THREE.Vector3(side * 0.36, 0.34, 0.46),
        new THREE.Vector3(side * 0.38, 0.24, 0.68),
      ]);
      riderGroup.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(armCurve, 12, 0.068, 10, false),
          secMat,
        ),
      );

      const legCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.16, 0.06, 0.02),
        new THREE.Vector3(side * 0.28, -0.08, 0.32),
        new THREE.Vector3(side * 0.26, -0.32, 0.05),
      ]);
      riderGroup.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(legCurve, 12, 0.082, 10, false),
          carbonMat,
        ),
      );
    });

    tiltGroup.add(riderGroup);

    return {
      root,
      tiltGroup,
      riderGroup,
      scarfGroup,
      intakeFans,
      hoverSkis,
      aeroFlaps,
      gimbalNozzles,
      flames,
      afterburnerMat,
    };
  }

  // Anima todas as peças mecânicas móveis da Jet Moto a cada frame!
  static animateMechanicalParts(
    bikeObj,
    dt,
    elapsed,
    speed,
    steer,
    isBoosting,
    isBrakingOrDrifting,
  ) {
    if (!bikeObj) return;

    // 1. Pás de admissão girando proporcionalmente à velocidade + turbo
    const fanSpinSpeed = 8.0 + Math.abs(speed) * 0.65 + (isBoosting ? 18.0 : 0);
    bikeObj.intakeFans.forEach((fan) => {
      fan.rotation.z += fanSpinSpeed * dt;
    });

    // 2. Flaps aerodinâmicos levantam ao frear ou derrapar
    const targetFlapAngle = isBrakingOrDrifting
      ? 0.58
      : isBoosting
        ? -0.1
        : 0.05;
    bikeObj.aeroFlaps.forEach((fl) => {
      fl.pivot.rotation.x = THREE.MathUtils.lerp(
        fl.pivot.rotation.x,
        targetFlapAngle,
        0.22,
      );
      fl.pivot.rotation.z = THREE.MathUtils.lerp(
        fl.pivot.rotation.z,
        fl.side * steer * 0.22,
        0.2,
      );
    });

    // 3. Bocais de turbina vetorizados (Gimbaled Nozzles) apontam na direção da curva
    const targetGimbalY = -steer * 0.32;
    const nozzleScale = isBoosting ? 1.16 : 1.0;
    bikeObj.gimbalNozzles.forEach((noz) => {
      noz.rotation.y = THREE.MathUtils.lerp(
        noz.rotation.y,
        targetGimbalY,
        0.24,
      );
      noz.scale.setScalar(THREE.MathUtils.lerp(noz.scale.x, nozzleScale, 0.2));
    });

    // 4. Esquis repulsores oscilam com a suspensão
    bikeObj.hoverSkis.forEach((ski, idx) => {
      ski.position.y = 0.11 + Math.sin(elapsed * 9.0 + idx * 1.4) * 0.022;
      ski.rotation.z = -steer * 0.14;
    });

    // 5. Pós-combustor GLSL + Halo Aditivo
    bikeObj.afterburnerMat.uniforms.uTime.value = elapsed;
    bikeObj.afterburnerMat.uniforms.uBoost.value = THREE.MathUtils.lerp(
      bikeObj.afterburnerMat.uniforms.uBoost.value,
      isBoosting ? 1.0 : 0.0,
      0.2,
    );
    const flameLen =
      0.52 +
      (Math.max(0, speed) / 44) * 0.92 +
      (isBoosting ? 1.25 : 0) +
      Math.sin(elapsed * 55) * 0.12;
    bikeObj.flames.forEach((f) => {
      f.mesh.scale.set(1, 1, flameLen);
      f.halo.material.color.setHex(isBoosting ? 0xff2a85 : 0x00f0ff);
      f.halo.scale.setScalar(isBoosting ? 2.1 : 1.35);
    });

    // 6. Cachecol do piloto ondulando ao vento
    if (bikeObj.scarfGroup) {
      bikeObj.scarfGroup.rotation.y =
        -steer * 0.35 + Math.sin(elapsed * (12 + speed * 0.4)) * 0.18;
      bikeObj.scarfGroup.rotation.x = Math.sin(elapsed * 16) * 0.12;
    }
  }
}

class HighPolyJetMotoBuilder {
  static build(chassisId, primaryColor, secondaryColor, accentColor) {
    const root = new THREE.Group();
    const tiltGroup = new THREE.Group();
    root.add(tiltGroup);

    // Materiais PBR Automotivos com Clearcoat
    const hullMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(primaryColor),
      metalness: 0.58,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });
    const secMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(secondaryColor),
      metalness: 0.45,
      roughness: 0.28,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.12,
    });
    const darkCarbonMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.35,
      roughness: 0.55,
    });
    const neonMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(accentColor),
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      metalness: 0.1,
      roughness: 0.05,
      transparent: true,
      opacity: 0.72,
      clearcoat: 1.0,
    });

    // 1. FUSELAGEM CENTRAL ESCULPIDA (LatheGeometry alongada de 20 segmentos radiais)
    const hullProfile = [
      new THREE.Vector2(0.01, -1.85),
      new THREE.Vector2(0.36, -1.65),
      new THREE.Vector2(0.56, -0.95),
      new THREE.Vector2(0.62, -0.15),
      new THREE.Vector2(0.52, 0.85),
      new THREE.Vector2(0.32, 1.75),
      new THREE.Vector2(0.08, 2.38),
      new THREE.Vector2(0.01, 2.52),
    ];
    const fuselageGeo = new THREE.LatheGeometry(hullProfile, 24);
    fuselageGeo.rotateX(Math.PI / 2);
    fuselageGeo.scale(1.0, 0.62, 1.0);
    const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
    fuselage.position.set(0, 0.46, 0.1);
    fuselage.castShadow = true;
    tiltGroup.add(fuselage);

    // 2. CARENAGEM FRONTAL SUPERIOR E PARA-BRISA CURVO TRANSLÚCIDO
    const canopyGeo = new THREE.SphereGeometry(
      0.46,
      20,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.55,
    );
    canopyGeo.scale(0.88, 0.55, 1.75);
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    canopy.position.set(0, 0.72, 0.65);
    canopy.rotation.x = -0.22;
    tiltGroup.add(canopy);

    // 3. TOMADAS DE AR LATERAIS ESCULPIDAS COM GRADES EMISSIVAS
    [-1, 1].forEach((side) => {
      const podGeo = new THREE.CylinderGeometry(0.24, 0.32, 1.75, 16);
      podGeo.rotateX(Math.PI / 2);
      podGeo.scale(0.85, 0.75, 1.0);
      const pod = new THREE.Mesh(podGeo, secMat);
      pod.position.set(side * 0.54, 0.42, 0.15);
      tiltGroup.add(pod);

      // Grade luminosa interna da tomada de ar
      const intakeGlow = new THREE.Mesh(
        new THREE.CircleGeometry(0.21, 14),
        neonMat,
      );
      intakeGlow.position.set(side * 0.54, 0.42, 1.03);
      tiltGroup.add(intakeGlow);

      // Friso neon lateral contínuo (TubeGeometry)
      const stripeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.62, 0.44, -1.35),
        new THREE.Vector3(side * 0.68, 0.48, 0.15),
        new THREE.Vector3(side * 0.34, 0.42, 1.85),
      ]);
      const stripeGeo = new THREE.TubeGeometry(
        stripeCurve,
        16,
        0.032,
        8,
        false,
      );
      tiltGroup.add(new THREE.Mesh(stripeGeo, neonMat));
    });

    // 4. ASSENTO ANATÔMICO, GUIDÃO TUBULAR E PAINEL HOLOGRÁFICO
    const saddleGeo = new THREE.SphereGeometry(0.38, 16, 12);
    saddleGeo.scale(0.9, 0.45, 1.8);
    const saddle = new THREE.Mesh(saddleGeo, darkCarbonMat);
    saddle.position.set(0, 0.66, -0.42);
    tiltGroup.add(saddle);

    const barCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.48, 0.88, 0.32),
      new THREE.Vector3(-0.22, 0.95, 0.48),
      new THREE.Vector3(0.0, 0.96, 0.52),
      new THREE.Vector3(0.22, 0.95, 0.48),
      new THREE.Vector3(0.48, 0.88, 0.32),
    ]);
    const handleGeo = new THREE.TubeGeometry(barCurve, 16, 0.035, 8, false);
    tiltGroup.add(new THREE.Mesh(handleGeo, chromeMat));

    const dashScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.16),
      neonMat,
    );
    dashScreen.position.set(0, 0.92, 0.46);
    dashScreen.rotation.x = -0.65;
    tiltGroup.add(dashScreen);

    // 5. PRATOS REPULSORES VENTRAIS (HOVER PADS COM ANÉIS DE PLASMA)
    [-0.85, 0.15, 1.15].forEach((zPos) => {
      const padDish = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.24, 0.12, 16),
        chromeMat,
      );
      padDish.position.set(0, 0.14, zPos);
      tiltGroup.add(padDish);

      const plasmaRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.035, 8, 20),
        neonMat,
      );
      plasmaRing.rotation.x = Math.PI / 2;
      plasmaRing.position.set(0, 0.09, zPos);
      tiltGroup.add(plasmaRing);
    });

    // 6. GEOMETRIA EXCLUSIVA POR CHASSIS (6 SILHUETAS DISTINTAS!)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(1.15, -0.45);
    wingShape.lineTo(1.25, -0.85);
    wingShape.lineTo(0, -0.65);
    wingShape.closePath();

    const extrudeSettings = {
      depth: 0.06,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    };

    if (chassisId === "marlin-x") {
      // Asas hidrodinâmicas equilibradas + duas quilhas dorsais
      [-1, 1].forEach((side) => {
        const wGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
        wGeo.rotateX(Math.PI / 2);
        if (side < 0) wGeo.scale(-1, 1, 1);
        const wMesh = new THREE.Mesh(wGeo, hullMat);
        wMesh.position.set(side * 0.42, 0.42, 0.25);
        wMesh.rotation.z = -side * 0.12;
        tiltGroup.add(wMesh);

        // Quilha dorsal
        const finGeo = new THREE.ConeGeometry(0.18, 0.85, 12);
        finGeo.scale(0.35, 1, 1.8);
        const fin = new THREE.Mesh(finGeo, secMat);
        fin.position.set(side * 0.36, 0.82, -1.15);
        fin.rotation.x = -0.35;
        tiltGroup.add(fin);
      });
    } else if (chassisId === "escarpa") {
      // Grandes asas de gaivota invertidas com winglets verticais
      [-1, 1].forEach((side) => {
        const gullCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.45, 0.48, 0.1),
          new THREE.Vector3(side * 1.15, 0.68, -0.15),
          new THREE.Vector3(side * 1.65, 0.35, -0.45),
          new THREE.Vector3(side * 1.75, 0.75, -0.65),
        ]);
        const gullGeo = new THREE.TubeGeometry(gullCurve, 18, 0.14, 10, false);
        gullGeo.scale(1, 0.38, 2.2);
        tiltGroup.add(new THREE.Mesh(gullGeo, hullMat));
      });
    } else if (chassisId === "raia-gt") {
      // Bico de agulha supersônico alongado + asa delta manta-ray
      const needleGeo = new THREE.ConeGeometry(0.28, 1.45, 18);
      needleGeo.rotateX(Math.PI / 2);
      const needle = new THREE.Mesh(needleGeo, chromeMat);
      needle.position.set(0, 0.44, 2.65);
      tiltGroup.add(needle);

      [-1, 1].forEach((side) => {
        const deltaGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
        deltaGeo.rotateX(Math.PI / 2);
        deltaGeo.scale(side * 1.35, 1, 1.45);
        const dMesh = new THREE.Mesh(deltaGeo, secMat);
        dMesh.position.set(side * 0.35, 0.38, 0.55);
        tiltGroup.add(dMesh);
      });
    } else if (chassisId === "bumerangue") {
      // Mandíbulas frontais duplas voltadas para a frente com bobina de plasma central
      [-1, 1].forEach((side) => {
        const prongCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.48, 0.42, 0.4),
          new THREE.Vector3(side * 0.92, 0.45, 1.25),
          new THREE.Vector3(side * 0.55, 0.4, 2.55),
        ]);
        const prongGeo = new THREE.TubeGeometry(
          prongCurve,
          16,
          0.16,
          12,
          false,
        );
        tiltGroup.add(new THREE.Mesh(prongGeo, hullMat));
      });
      const coil = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22, 1),
        neonMat,
      );
      coil.position.set(0, 0.44, 2.25);
      tiltGroup.add(coil);
    } else if (chassisId === "raptor-jet") {
      // Gaiola tubular pesada + 4 canhões de turbina
      const cageGeo = new THREE.TorusGeometry(0.58, 0.055, 10, 22, Math.PI);
      const cage = new THREE.Mesh(cageGeo, chromeMat);
      cage.position.set(0, 0.55, -0.15);
      tiltGroup.add(cage);
    } else if (chassisId === "nimbus") {
      // Anel Halo contínuo envolvendo a traseira da moto
      const haloGeo = new THREE.TorusGeometry(0.92, 0.09, 14, 32);
      haloGeo.rotateY(Math.PI / 2);
      const halo = new THREE.Mesh(haloGeo, hullMat);
      halo.position.set(0, 0.65, -0.75);
      tiltGroup.add(halo);

      const innerHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.82, 0.03, 8, 28),
        neonMat,
      );
      innerHalo.rotateY(Math.PI / 2);
      innerHalo.position.set(0, 0.65, -0.75);
      tiltGroup.add(innerHalo);
    }

    // 7. TURBINAS TRASEIRAS ESCULPIDAS (LatheGeometry) & CONES DE PÓS-COMBUSTÃO
    const nozzleProfile = [
      new THREE.Vector2(0.18, 0.0),
      new THREE.Vector2(0.28, 0.25),
      new THREE.Vector2(0.24, 0.55),
      new THREE.Vector2(0.29, 0.72),
      new THREE.Vector2(0.22, 0.78),
    ];
    const nozzleGeo = new THREE.LatheGeometry(nozzleProfile, 18);
    nozzleGeo.rotateX(-Math.PI / 2);

    const flameGeo = new THREE.ConeGeometry(0.21, 1.35, 14);
    flameGeo.rotateX(-Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.88,
    });

    const flames = [];
    const offsets =
      chassisId === "raptor-jet"
        ? [
            [-0.48, 0.52],
            [0.48, 0.52],
            [-0.28, 0.28],
            [0.28, 0.28],
          ]
        : [
            [-0.32, 0.44],
            [0.32, 0.44],
          ];

    offsets.forEach(([xOff, yOff]) => {
      const noz = new THREE.Mesh(nozzleGeo, chromeMat);
      noz.position.set(xOff, yOff, -1.42);
      tiltGroup.add(noz);

      const fl = new THREE.Mesh(flameGeo, flameMat);
      fl.position.set(xOff, yOff, -2.25);
      tiltGroup.add(fl);
      flames.push(fl);
    });

    // 8. PILOTO 3D ARTICULADO DE ALTA DENSIDADE (~900 TRIÂNGULOS)
    const riderGroup = new THREE.Group();
    riderGroup.position.set(0, 0.68, -0.32);

    // Tronco aerodinâmico inclinado à frente
    const torsoGeo = new THREE.CylinderGeometry(0.24, 0.19, 0.62, 14);
    const torso = new THREE.Mesh(torsoGeo, secMat);
    torso.position.set(0, 0.32, 0.12);
    torso.rotation.x = 0.52;
    riderGroup.add(torso);

    // Peitoral & Mochila Aero nas costas
    const packGeo = new THREE.SphereGeometry(0.2, 12, 10);
    packGeo.scale(0.85, 1.3, 0.6);
    const pack = new THREE.Mesh(packGeo, hullMat);
    pack.position.set(0, 0.38, -0.04);
    pack.rotation.x = 0.52;
    riderGroup.add(pack);

    // Capacete Esculpido + Viseira Cromada Iridescente + Spoiler Traseiro
    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0, 0.68, 0.3);
    const helmetShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 18, 16),
      hullMat,
    );
    helmetShell.scale.set(0.92, 0.95, 1.15);
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      metalness: 0.95,
      roughness: 0.05,
      clearcoat: 1.0,
    });
    const visorMesh = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.235,
        16,
        12,
        -Math.PI * 0.35,
        Math.PI * 0.7,
        Math.PI * 0.28,
        Math.PI * 0.34,
      ),
      visorMat,
    );
    visorMesh.rotation.y = Math.PI * 0.5;
    helmetGroup.add(helmetShell, visorMesh);
    riderGroup.add(helmetGroup);

    // Braços, Cotovelos, Antebraços (alcançando o guidão) e Pernas/Botas
    [-1, 1].forEach((side) => {
      // Ombreira
      const shoulder = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 10),
        hullMat,
      );
      shoulder.position.set(side * 0.25, 0.48, 0.22);
      riderGroup.add(shoulder);

      // Braço articulado em curva até a manopla
      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.25, 0.48, 0.22),
        new THREE.Vector3(side * 0.36, 0.34, 0.46),
        new THREE.Vector3(side * 0.38, 0.24, 0.68),
      ]);
      const armMesh = new THREE.Mesh(
        new THREE.TubeGeometry(armCurve, 10, 0.068, 8, false),
        secMat,
      );
      riderGroup.add(armMesh);

      // Coxa, Joelho e Bota apoiada na pedaleira
      const legCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.16, 0.06, 0.02),
        new THREE.Vector3(side * 0.28, -0.08, 0.32),
        new THREE.Vector3(side * 0.26, -0.32, 0.05),
      ]);
      const legMesh = new THREE.Mesh(
        new THREE.TubeGeometry(legCurve, 10, 0.082, 8, false),
        darkCarbonMat,
      );
      riderGroup.add(legMesh);
    });

    tiltGroup.add(riderGroup);

    return {
      root,
      tiltGroup,
      riderGroup,
      flames,
      flameMat,
      hullMat,
      secMat,
      neonMat,
    };
  }
}
