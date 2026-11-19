"use strict";
const pointsTable = [15, 12, 10, 8, 6, 4, 2, 1];
function loadCup() {
  const c = load("mare-viva/cup", null);
  const slot = (value, size) =>
    Number.isInteger(value) && value >= 0 && value < size;
  if (
    !c ||
    !slot(c.pilot, pilots.length) ||
    !slot(c.chassisId, chassis.length) ||
    !slot(c.paint, paints.length) ||
    !slot(c.cc, 3) ||
    !slot(c.diff, 3) ||
    !Array.isArray(c.rounds) ||
    c.rounds.length >= circuits.length
  )
    return null;
  if (
    !c.rounds.every(
      (round) =>
        Array.isArray(round) &&
        round.length === pointsTable.length &&
        round.every(
          (r) =>
            r &&
            slot(r.id, pilots.length) &&
            Number.isFinite(r.time) &&
            r.time > 0,
        ) &&
        new Set(round.map((r) => r.id)).size === pointsTable.length,
    )
  )
    return null;
  return c;
}
let cup = loadCup();
function cupConfig() {
  return {
    pilot,
    chassisId,
    paint,
    cc: $("cc").selectedIndex,
    diff: $("diff").selectedIndex,
    rounds: [],
  };
}
function launchFromMenu() {
  if ($("mode").value === "gp") {
    if (!cup) {
      cup = cupConfig();
      save("mare-viva/cup", cup);
    }
    pilot = cup.pilot;
    chassisId = cup.chassisId;
    paint = cup.paint;
    $("cc").selectedIndex = cup.cc;
    $("diff").selectedIndex = cup.diff;
    refreshBike();
    changeCircuit(cup.rounds.length);
  } else changeCircuit($("circuit").selectedIndex);
  startRace();
}
function cupStandings(rounds) {
  const rows = new Map();
  for (const round of rounds) {
    round.forEach((result, index) => {
      let row = rows.get(result.id);
      if (!row) {
        row = { id: result.id, points: 0, time: 0, places: Array(8).fill(0) };
        rows.set(result.id, row);
      }
      row.points += pointsTable[index];
      row.places[index]++;
      row.time += result.time;
    });
  }
  return [...rows.values()].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    for (let i = 0; i < 8; i++)
      if (a.places[i] !== b.places[i]) return b.places[i] - a.places[i];
    return a.time - b.time || a.id - b.id;
  });
}
function cupResult() {
  // Finish the remaining rivals with the race simulation before awarding points.
  const finishClock = clock;
  state = "settling";
  for (let i = 0; i < 18000 && racers.some((r) => r.finish === null); i++) {
    clock += 1 / 60;
    tickGrid(1 / 60);
  }
  state = "result";
  const sorted = order(),
    round = sorted.map((r) => ({ id: r.id, time: r.finish ?? clock }));
  clock = finishClock;
  const stage = trackId;
  cup.rounds[stage] = round;
  const standings = cupStandings(cup.rounds),
    place = standings.findIndex((r) => r.id === pilot) + 1,
    index = sorted.indexOf(player);
  const final = stage === circuits.length - 1;
  let html =
    "<p>" +
    circuits[stage].name +
    " · " +
    (index + 1) +
    "º lugar · " +
    format(player.finish) +
    " · <b>+" +
    pointsTable[index] +
    " pontos</b></p><h3>Classificação " +
    (final ? "final" : "acumulada") +
    "</h3>" +
    standings
      .map(
        (r, i) =>
          '<div class="resultrow ' +
          (r.id === pilot ? "me" : "") +
          '"><span>' +
          (i + 1) +
          "º · " +
          pilots[r.id] +
          "</span><b>" +
          r.points +
          " pts</b></div>",
      )
      .join("");
  if (final) {
    save("mare-viva/last", { rounds: cup.rounds, pilot, place });
    cup = null;
  }
  save("mare-viva/cup", cup);
  modal(
    final
      ? "Copa Maré Viva · " + place + "º lugar"
      : "Etapa " + (stage + 1) + " de 3 concluída",
    html,
    final
      ? [["Voltar à garagem", returnMenu]]
      : [
          [
            "Largar em " + circuits[stage + 1].short,
            () => {
              wipeGrid();
              changeCircuit(stage + 1);
              startRace();
            },
          ],
          ["Salvar e sair", returnMenu],
        ],
  );
}
