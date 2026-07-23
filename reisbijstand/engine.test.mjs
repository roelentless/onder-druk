// Validatieharnas voor de keuzehulp van reisbijstand — draait in CI (zie .github/workflows/pages.yml).
// Test de ECHTE geshipte engine: extraheert het <script>-blok uit index.html en
// draait het tegen een minimale DOM-stub, zodat data en logica niet gespiegeld hoeven te worden.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const match = html.match(/<script>\n([\s\S]*?)<\/script>/);
if (!match) throw new Error("geen <script>-blok gevonden in index.html");

// Minimale DOM-stub: genoeg voor de initiële renders in het script.
const el = (extra = {}) => ({ innerHTML: "", value: "1", checked: false, addEventListener() {}, ...extra });
const elementen = {
  "w-duur": el({ value: "14" }), "w-personen": el({ value: "4" }), "w-vertrek": el({ value: "14" }),
  "w-hoog": el(), "w-lang": el(), "w-ev": el(), "w-vervang": el({ checked: true }),
  "w-medisch": el(), "w-eilanden": el(),
  "aanbieder-cards": el(), "vgl-tabel": el(), "wresult": el(),
};
const documentStub = {
  getElementById: (id) => {
    if (!elementen[id]) throw new Error(`onbekend element: ${id}`);
    return elementen[id];
  },
  querySelector: (sel) => {
    if (sel === "#w-voertuig input:checked") return { value: "auto" };
    if (sel === "#w-caravan input:checked") return { value: "geen" };
    throw new Error(`onbekende selector: ${sel}`);
  },
  querySelectorAll: () => [],
};

const engine = new Function("document", `${match[1]}; return { PROVIDERS, beoordeel, prijsIndicatie };`)(documentStub);
const { PROVIDERS, beoordeel, prijsIndicatie } = engine;

// ---------- harnas ----------
let fouten = 0;
const test = (naam, fn) => {
  try { fn(); console.log(`  ✓ ${naam}`); }
  catch (e) { fouten++; console.error(`  ✗ ${naam}\n    ${e.message}`); }
};
const eis = (cond, boodschap) => { if (!cond) throw new Error(boodschap); };
const provider = (id) => {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`onbekende provider: ${id}`);
  return p;
};
const basisScenario = {
  duur: 14, personen: 4, vertrek: 14, voertuig: "auto",
  hoog: false, lang: false, ev: false, caravan: "geen",
  vervangBelangrijk: false, medischBelangrijk: false, eilanden: false,
};

console.log("reisbijstand keuzehulp-engine");

test("zes aanbieders in de dataset, Ethias als grensgeval", () => {
  eis(PROVIDERS.length === 6, `verwacht 6, kreeg ${PROVIDERS.length}`);
  eis(provider("ethias").grensgeval === true, "Ethias moet grensgeval zijn");
});

test("basisscenario (2 wk, gezin, auto): geen enkele optie geblokkeerd", () => {
  for (const p of PROVIDERS) {
    const { status } = beoordeel(p, basisScenario);
    eis(status !== "ongeschikt", `${p.naam} onterecht ongeschikt`);
  }
});

test("reisduur 40 dagen: Baloise (max 1 maand) valt af, Europ Assistance (45 d) niet", () => {
  eis(beoordeel(provider("baloise"), { ...basisScenario, duur: 40 }).status === "ongeschikt", "Baloise moet afvallen");
  eis(beoordeel(provider("europ"), { ...basisScenario, duur: 40 }).status !== "ongeschikt", "Europ mag niet afvallen");
});

test("reisduur 60 dagen: ook Europ Assistance (max 45 d) valt af, VAB (90 d) niet", () => {
  eis(beoordeel(provider("europ"), { ...basisScenario, duur: 60 }).status === "ongeschikt", "Europ moet afvallen");
  eis(beoordeel(provider("vab"), { ...basisScenario, duur: 60 }).status !== "ongeschikt", "VAB mag niet afvallen");
});

test("voertuig hoger dan 3 m: enkel VAB blokkeert (hoogtelimiet 3 m)", () => {
  eis(beoordeel(provider("vab"), { ...basisScenario, hoog: true }).status === "ongeschikt", "VAB moet blokkeren");
  eis(beoordeel(provider("touring"), { ...basisScenario, hoog: true }).status !== "ongeschikt", "Touring heeft geen hoogtelimiet");
});

test("langer dan 6,5 m: VAB blokkeert, Touring (7 m) waarschuwt enkel", () => {
  eis(beoordeel(provider("vab"), { ...basisScenario, lang: true }).status === "ongeschikt", "VAB moet blokkeren");
  const t = beoordeel(provider("touring"), { ...basisScenario, lang: true });
  eis(t.status === "aandacht", `Touring moet 'aandacht' geven, kreeg ${t.status}`);
});

test("vervangwagen belangrijk: Europ Assistance en Ethias vallen af (geen vervangwagen buitenland)", () => {
  const s = { ...basisScenario, vervangBelangrijk: true };
  eis(beoordeel(provider("europ"), s).status === "ongeschikt", "Europ moet afvallen");
  eis(beoordeel(provider("ethias"), s).status === "ongeschikt", "Ethias moet afvallen");
  eis(beoordeel(provider("allianz"), s).status !== "ongeschikt", "Allianz (10 d) mag niet afvallen");
});

test("Canarische Eilanden: VAB valt af (expliciete uitsluiting)", () => {
  eis(beoordeel(provider("vab"), { ...basisScenario, eilanden: true }).status === "ongeschikt", "VAB moet afvallen");
});

test("zware caravan (1,5–3,5 t): Touring (max 1,5 t) valt af, VAB en Allianz niet", () => {
  const s = { ...basisScenario, caravan: "zwaar" };
  eis(beoordeel(provider("touring"), s).status === "ongeschikt", "Touring moet afvallen");
  eis(beoordeel(provider("vab"), s).status !== "ongeschikt", "VAB (3,5 t) mag niet afvallen");
  eis(beoordeel(provider("allianz"), s).status !== "ongeschikt", "Allianz (3,5 t) mag niet afvallen");
});

test("last-minute (vertrek over 2 dagen): wachttijd-waarschuwing bij VAB en Europ, pluspunt bij Touring", () => {
  const s = { ...basisScenario, vertrek: 2 };
  eis(beoordeel(provider("vab"), s).redenen.some((r) => r.type === "waarschuwing" && r.tekst.includes("Wachttijd")), "VAB mist wachttijd-waarschuwing");
  eis(beoordeel(provider("europ"), s).redenen.some((r) => r.type === "waarschuwing" && r.tekst.includes("Wachttijd")), "Europ mist wachttijd-waarschuwing");
  eis(beoordeel(provider("touring"), s).redenen.some((r) => r.type === "plus" && r.tekst.includes("last-minute")), "Touring mist last-minute-pluspunt");
});

test("hoog medisch plafond belangrijk: Ethias (€75k) valt af, Touring (onbeperkt) scoort een plus", () => {
  const s = { ...basisScenario, medischBelangrijk: true };
  eis(beoordeel(provider("ethias"), s).status === "ongeschikt", "Ethias moet afvallen");
  eis(beoordeel(provider("touring"), s).redenen.some((r) => r.type === "plus" && r.tekst.includes("Medisch")), "Touring mist medisch-pluspunt");
});

test("bestelwagen: VAB waarschuwt (niet expliciet in AV), Touring bevestigt", () => {
  const s = { ...basisScenario, voertuig: "bestelwagen" };
  eis(beoordeel(provider("vab"), s).redenen.some((r) => r.type === "waarschuwing" && r.tekst.includes("Bestelwagen")), "VAB mist bestelwagen-waarschuwing");
  eis(beoordeel(provider("touring"), s).redenen.some((r) => r.type === "plus" && r.tekst.includes("Bestelwagen")), "Touring mist bestelwagen-pluspunt");
});

test("geblokkeerde optie sorteert altijd onder een niet-geblokkeerde", () => {
  const s = { ...basisScenario, vervangBelangrijk: true };
  const geblokkeerd = beoordeel(provider("europ"), s).score;
  const ok = beoordeel(provider("touring"), s).score;
  eis(geblokkeerd < ok, `score geblokkeerd (${geblokkeerd}) moet lager zijn dan ok (${ok})`);
});

test("prijsindicatie VAB volgt dagtarief ×duur met minimum €25", () => {
  eis(prijsIndicatie(provider("vab"), { ...basisScenario, duur: 14 }) === "≈ €48–€60", `kreeg ${prijsIndicatie(provider("vab"), { ...basisScenario, duur: 14 })}`);
  eis(prijsIndicatie(provider("vab"), { ...basisScenario, duur: 3 }).includes("€25"), "minimum €25 niet toegepast bij korte reis");
});

test("prijsindicatie Touring: €10 p.p. + €35 voertuigoptie", () => {
  const uit = prijsIndicatie(provider("touring"), { ...basisScenario, personen: 4 });
  eis(uit.includes("€75"), `verwacht €75+ voor 4 personen, kreeg ${uit}`);
});

test("providers zonder berekening geven 'op offerte'", () => {
  eis(prijsIndicatie(provider("baloise"), basisScenario) === "op offerte", "Baloise moet 'op offerte' geven");
  eis(prijsIndicatie(provider("ethias"), basisScenario) === "op offerte", "Ethias moet 'op offerte' geven");
});

if (fouten > 0) { console.error(`\n${fouten} test(s) gefaald`); process.exit(1); }
console.log("\nalle tests geslaagd");
