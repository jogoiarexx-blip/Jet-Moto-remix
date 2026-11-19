"use strict";
let opener = null;
function closeModal() {
  $("modal").hidden = true;
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  opener = null;
}
function modal(title, html, buttons) {
  if ($("modal").hidden) opener = document.activeElement;
  $("mt").textContent = title;
  $("mb").innerHTML = html;
  $("ma").replaceChildren();
  for (let [label, fn] of buttons) {
    let b = document.createElement("button");
    b.textContent = label;
    b.onclick = fn;
    if (!$("ma").children.length) b.className = "primary";
    $("ma").append(b);
  }
  $("modal").hidden = false;
  $("ma").firstElementChild.focus({ preventScroll: true });
}
$("garage").onclick = () => {
  modal(
    "Garagem da liga",
    '<div class="row"><div class="field"><label for="pilotPick">Piloto</label><select id="pilotPick"></select></div><div class="field"><label for="bikePick">Chassis</label><select id="bikePick"></select></div></div><p id="traits" class="summary"></p><label>Pintura</label><div class="paint" id="paints"></div>',
    [["Voltar ao grid", closeModal]],
  );
  function populate(id, names, value, set) {
    let el = $(id);
    names.forEach((n, i) => el.add(new Option(n, i)));
    el.selectedIndex = value;
    el.onchange = () => {
      set(el.selectedIndex);
      refreshBike();
      traits();
    };
  }
  function traits() {
    $("traits").textContent = [
      "Velocidade",
      "Aceleração",
      "Curva",
      "Estabilidade",
      "Turbo",
    ]
      .map((s, i) => s + " " + stats[pilot][i] + "/5")
      .join(" · ");
  }
  populate("pilotPick", pilots, pilot, (i) => {
    pilot = i;
    save("pilot", i);
  });
  populate("bikePick", chassis, chassisId, (i) => {
    chassisId = i;
    save("chassis", i);
  });
  traits();
  paints.forEach((color, i) => {
    let b = document.createElement("button");
    b.style.background = color;
    b.title = ["Coral", "Turquesa", "Solar", "Nébula", "Esmeralda"][i];
    b.setAttribute("aria-label", b.title);
    b.setAttribute("aria-pressed", i === paint);
    b.onclick = () => {
      paint = i;
      save("paint", i);
      refreshBike();
      [...$("paints").children].forEach((e, j) =>
        e.setAttribute("aria-pressed", j === i),
      );
    };
    $("paints").append(b);
  });
};
$("manual").onclick = () =>
  modal(
    "Comandos de pilotagem",
    "<dl><dt>W / ↑</dt><dd>Acelerar</dd><dt>S / ↓</dt><dd>Frear e dar ré</dd><dt>A / D · ← / →</dt><dd>Virar</dd><dt>Espaço</dt><dd>Segure enquanto inclina a moto para dentro da curva. Solte na saída para ganhar mini-turbo.</dd><dt>E</dt><dd>Aproxime-se do poste pela direita. Segure quando ele acender e solte ao passar por ele, alinhado à saída.</dd><dt>Píer</dt><dd>Na praia e no coral, entre pela direita, alinhado e acima de 61 km/h. Mantenha a moto no deque após o salto. F faz a acrobacia.</dd><dt>Q</dt><dd>Usar o item coletado</dd><dt>V / C</dt><dd>Alternar câmera / segurar para olhar para trás</dd><dt>R</dt><dd>Reposicionar a moto na pista</dd><dt>Esc / P</dt><dd>Pausar ou continuar</dd></dl><p>No celular, use os botões de toque. A tela deitada dá mais espaço para pilotar.</p>",
    [["Voltar", closeModal]],
  );
$("lore").onclick = () =>
  modal(
    "Crônicas do Vórtice",
    "<p><b>Arquipélago Vórtice, 2094.</b> Entre usinas de maré e ilhas artificiais, Nara Flux abre a primeira etapa da Copa Maré Viva.</p><p>Beto Parafuso termina o ajuste dos esquis repulsores. Do outro lado do píer, Axel Prisma já espera no grid. A primeira curva da praia é sua chance de passar à frente.</p>",
    [["Voltar ao grid", closeModal]],
  );
$("start").onclick = launchFromMenu;
$("circuit").onchange = menuInfo;
$("newCup").onclick = () =>
  modal(
    "Recomeçar a copa?",
    "<p>Os pontos da copa em andamento serão zerados.</p>",
    [
      ["Continuar a copa", closeModal],
      [
        "Zerar pontos",
        () => {
          cup = null;
          save("mare-viva/cup", null);
          closeModal();
          menuInfo();
        },
      ],
    ],
  );

$("rev").onclick = () => {
  wakeSound();
  revTime = 2;
  tone(280);
};
$("zoom").onclick = () => (zoomed = !zoomed);
$("mode").onchange = $("cc").onchange = menuInfo;
$("quality").onchange = resize;
$("assist").selectedIndex = clamp(Number(load("steer-assist", 1)) || 0, 0, 2);
$("assist").onchange = () => save("steer-assist", $("assist").selectedIndex);
$("pause").onclick = pauseRace;
$("cam").onclick = () => action("KeyV");
$("use").onclick = useItem;
function showTouch() {
  $("touch").hidden = !touch;
  $("race").classList.toggle("withtouch", touch);
}
$("touchToggle").onclick = () => {
  touch = !touch;
  resetInputs();
  showTouch();
};
$("audio").onclick = () => {
  muted = !muted;
  save("mute", muted);
  wakeSound();
  setAudio();
};
function setAudio() {
  $("audio").textContent = muted ? "Som desligado" : "Som ligado";
}
function press(code) {
  if (!held.has(code)) {
    action(code);
    if (["race", "count"].includes(state)) held.add(code);
  }
}
function release(code) {
  if (code === "KeyE" && held.has(code) && state === "race") hookRelease();
  held.delete(code);
}
document.querySelectorAll("[data-key]").forEach((b) => {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    press(b.dataset.key);
  };
  b.onpointerup =
    b.onpointercancel =
    b.onlostpointercapture =
      () => release(b.dataset.key);
});
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (state === "menu" && !$("modal").hidden && e.code === "Escape") {
    closeModal();
    return;
  }
  if (state === "menu" || state === "result") return;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  press(e.code);
});
window.addEventListener("keyup", (e) => release(e.code));
window.addEventListener("blur", () => {
  if (["count", "race"].includes(state)) pauseRace();
  resetInputs();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseRace();
});
window.addEventListener("resize", resize);
$("showview").onpointerdown = (e) => {
  dragging = e.clientX;
  e.currentTarget.setPointerCapture(e.pointerId);
};
$("showview").onpointermove = (e) => {
  if (dragging !== null) {
    orbit -= (e.clientX - dragging) * 0.011;
    dragging = e.clientX;
  }
};
$("showview").onpointerup = $("showview").onpointercancel = () =>
  (dragging = null);
let last = performance.now(),
  hudTimer = 0;
function render(now) {
  let dt = Math.min(0.15, Math.max(0, (now - last) / 1000));
  last = now;
  if (state === "menu") {
    visualTime += dt;
    revTime = Math.max(0, revTime - dt);
    if (dragging === null) orbit += dt * 0.085;
    showroom.root.visible = true;
    showroom.root.position.y = 0.08 + Math.sin(visualTime * 2) * 0.035;
    UltraSculptedJetMotoBuilder.animateMechanicalParts(
      showroom,
      dt,
      visualTime,
      revTime ? 40 : 4,
      0,
      revTime > 0,
      revTime > 0,
    );
    const radius = (zoomed ? 4.55 : 5.75) * Math.max(1, 1.34 / camera.aspect);
    camera.fov = 44;
    camera.updateProjectionMatrix();
    camera.position.set(
      Math.sin(orbit) * radius,
      2 + radius * 0.13,
      Math.cos(orbit) * radius,
    );
    camera.lookAt(0, 1.0, 0);
    renderer.render(studio, camera);
  } else if (state === "race" || state === "count") {
    visualTime += dt;
    acc += dt;
    while (acc >= 1 / 60 && (state === "count" || state === "race")) {
      step(1 / 60);
      acc -= 1 / 60;
    }
    if (state === "race" || state === "count") {
      raceVisuals(dt);
      hudTimer -= dt;
      if (hudTimer <= 0) {
        drawHUD();
        hudTimer = 0.064;
      }
      renderer.render(scene, camera);
    }
  }
  engine();
  requestAnimationFrame(render);
}
refreshBike();
switchCanvas(false);
menuInfo();
setAudio();
illuminate();
mapDraw($("mapPreview"), false);
new ResizeObserver(() => {
  if (state === "menu") resize();
}).observe($("showview"));
requestAnimationFrame(render);

window.removeEventListener("error", showStartupError, true);
