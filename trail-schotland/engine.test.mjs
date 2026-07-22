// Validatieharnas voor de planner-rekenkern van trail-schotland.
// Spiegelt de engine in index.html — draait in CI (zie .github/workflows/pages.yml).

// ---------- engine (gespiegeld uit index.html) ----------

// Naismith met expliciete parameters: vlakke snelheid, klimtempo, pauzefactor.
// Klassiek Naismith: 4.83 km/u vlak + 1 u per 600 m stijging, pauzefactor 1.
function wandeltijdUren({ km, stijgingM, snelheidKmh, klimMPerUur, pauzeFactor }) {
  if (!(km >= 0) || !(stijgingM >= 0)) throw new Error(`ongeldige afstand/stijging: ${km}/${stijgingM}`);
  if (!(snelheidKmh > 0) || !(klimMPerUur > 0) || !(pauzeFactor >= 1)) {
    throw new Error(`ongeldig tempo-profiel: ${snelheidKmh}/${klimMPerUur}/${pauzeFactor}`);
  }
  return (km / snelheidKmh + stijgingM / klimMPerUur) * pauzeFactor;
}

// Lineaire partitie: verdeel opeenvolgende segmenten tussen waypoints over `dagen`
// dagen, minimaliseer de zwaarste dag (in uren). Waypoints: {naam, km, stijgingM}
// waar km/stijgingM cumulatief vanaf de start zijn.
function verdeelEtappes(waypoints, dagen, tempo) {
  const n = waypoints.length - 1; // aantal segmenten
  if (n < 1) throw new Error("minstens twee waypoints nodig");
  if (dagen < 1 || dagen > n) throw new Error(`dagen ${dagen} buiten bereik 1..${n}`);

  const kost = (i, j) => wandeltijdUren({
    km: waypoints[j].km - waypoints[i].km,
    stijgingM: waypoints[j].stijgingM - waypoints[i].stijgingM,
    ...tempo,
  });

  // f[d][j] = minimale max-dagtijd om waypoint j te bereiken in d dagen
  const f = Array.from({ length: dagen + 1 }, () => new Array(n + 1).fill(Infinity));
  const keuze = Array.from({ length: dagen + 1 }, () => new Array(n + 1).fill(-1));
  f[0][0] = 0;
  for (let d = 1; d <= dagen; d++) {
    for (let j = d; j <= n; j++) {
      for (let i = d - 1; i < j; i++) {
        const v = Math.max(f[d - 1][i], kost(i, j));
        if (v < f[d][j] - 1e-12) { f[d][j] = v; keuze[d][j] = i; }
      }
    }
  }
  const grens = [n];
  for (let d = dagen, j = n; d >= 1; d--) { j = keuze[d][j]; grens.unshift(j); }
  return grens.slice(0, -1).map((i, d) => {
    const j = grens[d + 1];
    return {
      van: waypoints[i].naam,
      naar: waypoints[j].naam,
      km: waypoints[j].km - waypoints[i].km,
      stijgingM: waypoints[j].stijgingM - waypoints[i].stijgingM,
      uren: kost(i, j),
    };
  });
}

// Budget: posten expliciet aangeleverd; geen verborgen defaults.
function reisbudget({ dagen, nachten, tarieven, verblijf, maaltijd, bagagetransport, eenmalig }) {
  if (!(dagen >= 1) || !(nachten >= 0)) throw new Error(`ongeldige dagen/nachten: ${dagen}/${nachten}`);
  const posten = [
    { label: "Verblijf", totaal: tarieven.verblijf[verblijf] * nachten },
    { label: "Eten & drinken", totaal: tarieven.maaltijd[maaltijd] * dagen },
    ...(bagagetransport ? [{ label: "Bagagetransport", totaal: tarieven.bagagePerEtappe * (dagen - 1) }] : []),
    ...eenmalig.map(p => ({ label: p.label, totaal: p.bedrag })),
  ];
  return { posten, totaal: posten.reduce((s, p) => s + p.totaal, 0) };
}

// ---------- tests ----------

let fouten = 0;
const ok = (naam, cond) => { if (!cond) { fouten++; console.error(`FAIL ${naam}`); } else console.log(`ok   ${naam}`); };
const bijna = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// Naismith klassiek: 20 km + 600 m @ 4.83 km/u, 600 m/u → 20/4.83 + 1 = 5.140…
ok("naismith klassiek", bijna(
  wandeltijdUren({ km: 20, stijgingM: 600, snelheidKmh: 4.83, klimMPerUur: 600, pauzeFactor: 1 }),
  20 / 4.83 + 1,
));
// Pauzefactor schaalt lineair
ok("pauzefactor", bijna(
  wandeltijdUren({ km: 10, stijgingM: 0, snelheidKmh: 4, klimMPerUur: 500, pauzeFactor: 1.2 }),
  3,
));
// Ongeldige input gooit
ok("gooit op negatief", (() => { try { wandeltijdUren({ km: -1, stijgingM: 0, snelheidKmh: 4, klimMPerUur: 500, pauzeFactor: 1 }); return false; } catch { return true; } })());

const tempo = { snelheidKmh: 4, klimMPerUur: 500, pauzeFactor: 1.15 };
// WHW-achtige waypointset (cumulatief, afgeronde vorm — puur voor DP-gedrag)
const wp = [
  { naam: "A", km: 0, stijgingM: 0 },
  { naam: "B", km: 19, stijgingM: 150 },
  { naam: "C", km: 31, stijgingM: 400 },
  { naam: "D", km: 45, stijgingM: 550 },
  { naam: "E", km: 67, stijgingM: 900 },
  { naam: "F", km: 80, stijgingM: 1200 },
  { naam: "G", km: 96, stijgingM: 1900 },
];

// Volledige dekking: dagen sluiten aan en sommen kloppen
const plan4 = verdeelEtappes(wp, 4, tempo);
ok("4 dagen → 4 rijen", plan4.length === 4);
ok("km-som klopt", bijna(plan4.reduce((s, d) => s + d.km, 0), 96));
ok("stijging-som klopt", bijna(plan4.reduce((s, d) => s + d.stijgingM, 0), 1900));
ok("aansluitend", plan4.every((d, i) => i === 0 || plan4[i - 1].naar === d.van));

// DP optimaal: vergelijk met brute force over alle splitsingen
function bruteMax(wpts, dagen, t) {
  const n = wpts.length - 1;
  let best = Infinity;
  const rec = (start, resterend, huidigeMax) => {
    if (resterend === 1) {
      const u = wandeltijdUren({ km: wpts[n].km - wpts[start].km, stijgingM: wpts[n].stijgingM - wpts[start].stijgingM, ...t });
      best = Math.min(best, Math.max(huidigeMax, u));
      return;
    }
    for (let j = start + 1; j <= n - resterend + 1; j++) {
      const u = wandeltijdUren({ km: wpts[j].km - wpts[start].km, stijgingM: wpts[j].stijgingM - wpts[start].stijgingM, ...t });
      rec(j, resterend - 1, Math.max(huidigeMax, u));
    }
  };
  rec(0, dagen, 0);
  return best;
}
for (const d of [2, 3, 4, 5, 6]) {
  const plan = verdeelEtappes(wp, d, tempo);
  const maxDag = Math.max(...plan.map(x => x.uren));
  ok(`DP optimaal bij ${d} dagen`, bijna(maxDag, bruteMax(wp, d, tempo)));
}
// Meer dagen → zwaarste dag wordt nooit zwaarder
{
  let vorige = Infinity;
  let monotoon = true;
  for (let d = 1; d <= 6; d++) {
    const m = Math.max(...verdeelEtappes(wp, d, tempo).map(x => x.uren));
    if (m > vorige + 1e-9) monotoon = false;
    vorige = m;
  }
  ok("monotoon in dagen", monotoon);
}
ok("gooit op te veel dagen", (() => { try { verdeelEtappes(wp, 7, tempo); return false; } catch { return true; } })());

// Budget telt op en respecteert toggles
const tarieven = {
  verblijf: { kamperen: 12, hostel: 25, bnb: 55 },
  maaltijd: { zelf: 15, pub: 35 },
  bagagePerEtappe: 9,
};
const b1 = reisbudget({ dagen: 7, nachten: 6, tarieven, verblijf: "hostel", maaltijd: "pub", bagagetransport: true, eenmalig: [{ label: "Transport", bedrag: 60 }] });
ok("budget totaal", bijna(b1.totaal, 25 * 6 + 35 * 7 + 9 * 6 + 60));
const b2 = reisbudget({ dagen: 7, nachten: 6, tarieven, verblijf: "kamperen", maaltijd: "zelf", bagagetransport: false, eenmalig: [] });
ok("budget zonder transfer", bijna(b2.totaal, 12 * 6 + 15 * 7));

if (fouten > 0) { console.error(`${fouten} test(s) gefaald`); process.exit(1); }
console.log("alle engine-tests geslaagd");
