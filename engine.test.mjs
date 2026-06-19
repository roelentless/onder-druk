// Throwaway validation harness for the Bühlmann ZHL-16C engine.
// Mirrors the engine embedded in index.html. Used only to sanity-check numbers.

const HT = [4.0,8.0,12.5,18.5,27.0,38.3,54.3,77.0,109.0,146.0,187.0,239.0,305.0,390.0,498.0,635.0];
const AC = [1.2599,1.0,0.8618,0.7562,0.62,0.5043,0.441,0.4,0.375,0.35,0.3295,0.3065,0.2835,0.261,0.248,0.2327];
const BC = [0.505,0.6514,0.7222,0.7825,0.8126,0.8434,0.8693,0.891,0.9092,0.9222,0.9319,0.9403,0.9477,0.9544,0.9602,0.9653];
const PH2O = 0.0627, PSURF = 1.0, FN2_AIR = 0.79;

const pAmb = d => PSURF + d * 0.1;
const dFromP = p => (p - PSURF) / 0.1;
const pN2insp = (d, fN2) => (pAmb(d) - PH2O) * fN2;
const surfaceComp = () => HT.map(() => (PSURF - PH2O) * FN2_AIR);

function tick(comp, d, fN2, dt) {
  const pi = pN2insp(d, fN2);
  const out = new Array(16);
  for (let i = 0; i < 16; i++) out[i] = comp[i] + (pi - comp[i]) * (1 - Math.pow(2, -dt / HT[i]));
  return out;
}
function ceilAmb(comp, gf) {
  let m = 0;
  for (let i = 0; i < 16; i++) {
    const tol = (comp[i] - AC[i] * gf) / (gf / BC[i] - gf + 1);
    if (tol > m) m = tol;
  }
  return m;
}
function ndl(depth, fN2, gf) {
  let comp = surfaceComp(); const dt = 0.1; let t = 0;
  while (t < 999) {
    comp = tick(comp, depth, fN2, dt); t += dt;
    if (ceilAmb(comp, gf) > PSURF + 1e-9) return t;
  }
  return 999;
}
function simulate(maxDepth, bottomTime, fO2, gf, opts = {}) {
  const fN2 = 1 - fO2; const dt = 0.1;
  let comp = surfaceComp(); let t = 0, depth = 0;
  const tl = []; let nextSample = 0; const SAMP = 0.25;
  const push = () => tl.push({ t, depth, comp: comp.slice() });
  push();
  while (depth < maxDepth) {
    depth = Math.min(maxDepth, depth + 18 * dt);
    comp = tick(comp, depth, fN2, dt); t += dt;
    if (t >= nextSample) { push(); nextSample += SAMP; }
  }
  while (t < bottomTime) {
    comp = tick(comp, depth, fN2, dt); t += dt;
    if (t >= nextSample) { push(); nextSample += SAMP; }
  }
  const firstCeil = dFromP(ceilAmb(comp, gf));
  let firstStop = firstCeil > 0 ? Math.ceil(firstCeil / 3) * 3 : 0;
  const stops = [];
  const ascRate = opts.ascentRate || 9;
  if (opts.ignoreStops) {
    while (depth > 0) { depth = Math.max(0, depth - ascRate * dt); comp = tick(comp, depth, fN2, dt); t += dt; if (t >= nextSample) { push(); nextSample += SAMP; } }
    const end = t + 8; while (t < end) { comp = tick(comp, 0, fN2, dt); t += dt; if (t >= nextSample) { push(); nextSample += SAMP; } }
  } else if (firstStop <= 0) {
    while (depth > 5) { depth = Math.max(5, depth - 9 * dt); comp = tick(comp, depth, fN2, dt); t += dt; if (t >= nextSample) { push(); nextSample += SAMP; } }
    if (maxDepth >= 10) {
      const end = t + 3; while (t < end) { comp = tick(comp, 5, fN2, dt); t += dt; if (t >= nextSample) { push(); nextSample += SAMP; } }
      stops.push({ depth: 5, min: 3, type: 'safety' });
    }
    while (depth > 0) { depth = Math.max(0, depth - 9 * dt); comp = tick(comp, depth, fN2, dt); t += dt; if (t >= nextSample) { push(); nextSample += SAMP; } }
  } else {
    let stop = firstStop;
    while (stop > 0) {
      while (depth > stop) { depth = Math.max(stop, depth - 9 * dt); comp = tick(comp, depth, fN2, dt); t += dt; if (t >= nextSample) { push(); nextSample += SAMP; } }
      let waited = 0; const target = stop - 3;
      while (true) {
        if (dFromP(ceilAmb(comp, gf)) <= target + 1e-6) break;
        comp = tick(comp, stop, fN2, dt); t += dt; waited += dt;
        if (t >= nextSample) { push(); nextSample += SAMP; }
        if (waited > 400) break;
      }
      stops.push({ depth: stop, min: Math.max(1, Math.ceil(waited)), type: 'deco' });
      stop -= 3;
    }
    while (depth > 0) { depth = Math.max(0, depth - 9 * dt); comp = tick(comp, depth, fN2, dt); t += dt; if (t >= nextSample) { push(); nextSample += SAMP; } }
  }
  push();
  let maxCeil = 0, maxOver = 0;
  for (const s of tl) {
    s.ceil = dFromP(ceilAmb(s.comp, gf));
    if (s.ceil > maxCeil) maxCeil = s.ceil;
    for (let i = 0; i < 16; i++) {
      const mRaw = PSURF * (1 / BC[i]) + AC[i]; // gf=1 surfacing tension limit
      const over = s.comp[i] / mRaw;
      if (over > maxOver) maxOver = over;
    }
  }
  return { stops, runtime: t, samples: tl.length, maxCeil, maxOverPct: maxOver * 100, hasNaN: tl.some(s => s.comp.some(Number.isNaN)) };
}

console.log('== NDL (lucht, GF 0.85) ==');
for (const d of [12, 15, 18, 21, 24, 27, 30, 36, 40]) {
  console.log(`${d}m: ${ndl(d, 0.79, 0.85).toFixed(0)} min`);
}
console.log('\n== NDL (lucht, raw GF 1.0) ==');
for (const d of [18, 30, 40]) console.log(`${d}m: ${ndl(d, 0.79, 1.0).toFixed(0)} min`);

console.log('\n== NDL nitrox vergelijking @ 28m, GF 0.85 ==');
console.log(`lucht:  ${ndl(28, 0.79, 0.85).toFixed(0)} min`);
console.log(`EAN32:  ${ndl(28, 0.68, 0.85).toFixed(0)} min`);

console.log('\n== Scenario rif: 14m / 50min lucht, GF 0.85 (moet no-deco zijn) ==');
console.log(JSON.stringify(simulate(14, 50, 0.21, 0.85)));
console.log('\n== Scenario wrak: 30m / 25min lucht, GF 0.85 ==');
console.log(JSON.stringify(simulate(30, 25, 0.21, 0.85)));
console.log('\n== Scenario noodopstijging: 30m / 25min, recht omhoog ==');
console.log(JSON.stringify(simulate(30, 25, 0.21, 0.85, { ignoreStops: true, ascentRate: 18 })));
console.log('\n== Diepe deco: 40m / 30min lucht, GF 0.70 ==');
console.log(JSON.stringify(simulate(40, 30, 0.21, 0.70)));
