# Onder Druk — Duiken & Decompressie begrijpen

Een gratis, deelbaar leermiddel over de fysiologie van decompressie, gemaakt voor
de Nederlandse en Vlaamse duikgemeenschap. Het legt uit wat er met de stikstof in
je bloed gebeurt op diepte — en waarom je op weg naar boven moet stoppen.

**Live:** https://roelentless.github.io/onder-druk/

## Wat zit erin

- **De natuurkunde** — druk, wet van Boyle, wet van Henry, partiële druk (interactief).
- **Op- en afzadelen** — hoe stikstof je weefsels in- en uitstroomt.
- **16 weefselcompartimenten** — het Bühlmann-model, visueel.
- **Duikplanner** — diepte / bodemtijd / ademgas / conservatisme → nuldecompressielimiet,
  decompressiestops, ppO₂ + MOD, narcose, profiel- en weefselgrafiek.
- **Drie scenario's** — rif, wrak en een noodopstijging, live afgespeeld.
- **De regels onder water** — opstijgsnelheid, veiligheidsstop, narcose, zuurstoftoxiciteit,
  DCS-symptomen en eerste hulp.

## Rekenkern

Eén zelfstandig HTML-bestand (`index.html`), geen build, geen afhankelijkheden
(alleen een Google-Fonts-link die offline terugvalt op systeemfonts). De berekeningen
gebruiken het **Bühlmann ZHL-16C** algoritme voor stikstof (16 compartimenten,
halfwaardetijden 4–635 min) met één instelbare gradiëntfactor.

De rekenkern is numeriek gevalideerd; zie `engine.test.mjs` (`node engine.test.mjs`).
NDL-waarden komen overeen met gepubliceerde tabellen (ruw, GF 1.0): 18 m → 59,
30 m → 16, 40 m → 9 min.

## ⚠️ Disclaimer

Dit is **uitsluitend een leermiddel — geen duikcomputer.** Plan een echte duik
**nooit** op basis van deze pagina. De berekeningen zijn een vereenvoudigde
implementatie en kunnen afwijken van je duikcomputer. Niets hier vervangt een
gecertificeerde duikopleiding, een goedgekeurde duikcomputer of -tabellen, of
medisch advies. Duik binnen je brevet (CMAS / Nelos / NOB / PADI) en op eigen
verantwoordelijkheid.

## Lokaal openen

Dubbelklik `index.html`, of:

```sh
open index.html        # macOS
```

Vrij te delen en te gebruiken.
