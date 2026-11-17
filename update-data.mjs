// Frissíti az index.html-be ágyazott adatpillanatképet az Eurostat adataiból.
// Refreshes the data snapshot embedded in index.html from Eurostat data.
//
//   node scripts/update-data.mjs              letöltés az Eurostat API-ból / fetch from the Eurostat API (Node 18+)
//   node scripts/update-data.mjs --from DIR   kézzel letöltött TSV-fájlokból / from manually downloaded TSV files
//   ... --check                               csak ellenőrzés, az index.html nem változik / validate only, do not write
//
// A --from mappában az alábbi adatkészletek legyenek TSV- vagy SDMX-CSV-fájlként, a nevükben az adatkészlet kódjával
// (a Eurostat letöltési nevei, pl. estat_lfsa_argaeddl_en.csv, megfelelnek):
// lfsi_emp_a, hlth_dlm200, hlth_silc_12, hlth_silc_06, demo_pjangroup,
// lfsa_argaeddl, lfsa_ipgaeddl, lfsa_urgaeddl, lfsa_sup_dl, lfsa_egasdl.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const START = 2016;
const EU27 = ['BE', 'BG', 'CZ', 'DK', 'DE', 'EE', 'IE', 'EL', 'ES', 'FR', 'HR', 'IT', 'CY', 'LV', 'LT', 'LU', 'HU', 'MT', 'NL', 'AT', 'PL', 'PT', 'RO', 'SI', 'SK', 'FI', 'SE'];
const GEOS = [...EU27, 'EU27_2020'];
const BASE = 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/';
const SOURCES = {
  lfsi_emp_a: `lfsi_emp_a/A.EMP_LFS.T+M+F.Y20-64.PC_POP.`,
  hlth_dlm200: `hlth_dlm200/A.PC_PNT.SOME+SEV+SM_SEV.T+M+F.`,
  hlth_silc_12: `hlth_silc_12/A.PC.TOTAL..T+M+F.SM_SEV.`,
  hlth_silc_06: `hlth_silc_06/A.PC.EMP+POP+UNE+RET+INAC_OTH.Y16-64+Y20-64.T+M+F.NONE+SM_SEV+SEV+SOME.`,
  demo_pjangroup: `demo_pjangroup/A.NR.T+M+F.Y20-24+Y25-29+Y30-34+Y35-39+Y40-44+Y45-49+Y50-54+Y55-59+Y60-64.`,
  // Munkaerő-felmérés (LFS), a fogyatékossági kérdés kétévente (2022, 2024, ...). Külön blokk, a becslésbe nem kerül be.
  // Labour Force Survey, disability question every two years. A separate block; not used in the estimate.
  lfsa_argaeddl: `lfsa_argaeddl/A.TOTAL+NONE+SOME+SEV+SM_SEV.TOTAL.Y20-64.T+M+F.PC.`,
  lfsa_ipgaeddl: `lfsa_ipgaeddl/A.TOTAL.TOTAL+NONE+SOME+SEV+SM_SEV.Y20-64.T+M+F.PC.`,
  lfsa_urgaeddl: `lfsa_urgaeddl/A.TOTAL.TOTAL+NONE+SOME+SEV+SM_SEV.Y20-64.T+M+F.PC.`,
  lfsa_sup_dl: `lfsa_sup_dl/A.SLACK+NSEEK_AVL.TOTAL+NONE+SM_SEV.Y15-74.T+M+F.PC_ELF+THS_PER.`,
  lfsa_egasdl: `lfsa_egasdl/A.TOTAL+SM_SEV.EMP.Y20-64.T+M+F.THS_PER.`,
};
const LFS_LEVELS = ['TOTAL', 'NONE', 'SOME', 'SEV', 'SM_SEV'];
// 20–64 éves arány közelítése korsávokból, ha a hivatalos érték hiányzik.
// Approximating the 20–64 share from age bands where the official value is missing.
const BANDS = [
  ['Y20-24', ['Y20-24']],
  ['Y25-34', ['Y25-29', 'Y30-34']],
  ['Y35-44', ['Y35-39', 'Y40-44']],
  ['Y45-54', ['Y45-49', 'Y50-54']],
  ['Y55-64', ['Y55-59', 'Y60-64']],
];
const APPROX_FLAG = 'a'; // not an Eurostat flag; marks a value approximated from age bands

export function parseTsv(text) {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines[0].split('\t').map(s => s.trim());
  const dims = head[0].split('\\')[0].split(',');
  const years = head.slice(1).map(Number);
  const rows = lines.slice(1).filter(Boolean).map(line => {
    const cells = line.split('\t').map(s => s.trim());
    const key = cells[0].split(',');
    const d = Object.fromEntries(dims.map((k, i) => [k, key[i]]));
    const vals = cells.slice(1).map(c => {
      const m = /^(-?\d+(?:\.\d+)?)\s*([a-z]*)$/.exec(c);
      return m ? m[1] + m[2] : null; // ":" or ": u" -> null
    });
    return { d, byYear: Object.fromEntries(years.map((y, i) => [y, vals[i] ?? null])) };
  });
  return { years, rows };
}

// Eurostat SDMX-CSV (a databrowser „Download → SDMX-CSV” formátuma) -> ugyanaz a szerkezet, mint a parseTsv-é
export function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const head = lines[0].split(',').map(s => s.trim());
  const iT = head.indexOf('TIME_PERIOD'), iV = head.indexOf('OBS_VALUE'), iF = head.indexOf('OBS_FLAG');
  if (iT < 0 || iV < 0) throw new Error('not an SDMX-CSV file');
  const dims = head.slice(0, iT).map((h, i) => [h, i]).filter(([h]) => h !== 'DATAFLOW' && h !== 'LAST UPDATE');
  const byKey = new Map(), years = new Set();
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const c = line.split(',');
    const y = Number(c[iT]); years.add(y);
    const key = dims.map(([, i]) => c[i]).join(',');
    let row = byKey.get(key);
    if (!row) { row = { d: Object.fromEntries(dims.map(([h, i]) => [h, c[i]])), byYear: {} }; byKey.set(key, row); }
    const v = (c[iV] ?? '').trim(), f = iF >= 0 ? (c[iF] ?? '').replace(/[^a-z]/g, '') : '';
    row.byYear[y] = /^-?\d+(?:\.\d+)?$/.test(v) ? v + f : null;
  }
  return { years: [...years].sort((a, b) => a - b), rows: [...byKey.values()] };
}

const num = t => (t == null ? null : parseFloat(t));
const flags = t => (t == null ? '' : t.replace(/^-?[\d.]+/, ''));

// tables: { lfsi_emp_a, hlth_dlm200, hlth_silc_12, demo_pjangroup } -> parsed TSVs
export function buildSnapshot(tables, updated) {
  const years = tables.lfsi_emp_a.years.filter(y => y >= START);
  const series = {};
  const put = (name, geo, y, v) => {
    if (!GEOS.includes(geo)) return;
    ((series[name] ??= {})[geo] ??= Object.fromEntries(years.map(yy => [yy, null])))[y] = v;
  };
  for (const r of tables.lfsi_emp_a.rows)
    for (const y of years) put(`emp.${r.d.sex}`, r.d.geo, y, r.byYear[y] ?? null);
  for (const r of tables.hlth_dlm200.rows)
    for (const y of years) put(`gap.${r.d.lev_limit}.${r.d.sex}`, r.d.geo, y, r.byYear[y] ?? null);

  // index silc and population
  const silc = {}, pop = {};
  for (const r of tables.hlth_silc_12.rows) if (r.d.lev_limit === 'SM_SEV' && r.d.quant_inc === 'TOTAL')
    silc[`${r.d.sex}|${r.d.age}|${r.d.geo}`] = r.byYear;
  for (const r of tables.demo_pjangroup.rows) pop[`${r.d.sex}|${r.d.age}|${r.d.geo}`] = r.byYear;
  const popOf = (sex, age, geo, y) => {
    if (geo === 'EU27_2020' && !pop[`${sex}|${age}|${geo}`]) { // sum of member states
      let s = 0; for (const g of EU27) { const v = num(pop[`${sex}|${age}|${g}`]?.[y]); if (v == null) return null; s += v; } return s;
    }
    return num(pop[`${sex}|${age}|${geo}`]?.[y]);
  };
  const approx = (sex, geo, y) => {
    let sw = 0, sp = 0, fl = new Set();
    for (const [band, parts] of BANDS) {
      const t = silc[`${sex}|${band}|${geo}`]?.[y]; const p = num(t); if (p == null) return null;
      let w = 0; for (const a of parts) { const v = popOf(sex, a, geo, y); if (v == null) return null; w += v; }
      sw += w; sp += w * p; for (const f of flags(t)) fl.add(f);
    }
    return { v: sp / sw, f: [...fl].filter(f => f === 'b' || f === 'u').join('') };
  };

  // The raw approximation is shifted by the mean (official − approximation) of the three nearest years
  // that have both values, which removes most of each country's systematic difference.
  const calibrated = (ap, pairs, y) => {
    const near = pairs.slice().sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y) || a.y - b.y).slice(0, 3);
    const off = near.length ? near.reduce((s, x) => s - x.diff, 0) / near.length : 0;
    return { v: ap.v + off, f: ap.f, raw: ap.v, off };
  };
  const validation = [];
  for (const sex of ['T', 'M', 'F']) for (const geo of GEOS) {
    const pairs = [], missing = [];
    for (const y of years) {
      const off = silc[`${sex}|Y20-64|${geo}`]?.[y] ?? null;
      const ap = approx(sex, geo, y);
      if (off != null) {
        put(`prev.${sex}`, geo, y, off);
        if (ap) pairs.push({ sex, geo, y, official: num(off), approx: ap.v, diff: ap.v - num(off) });
      } else if (ap) missing.push([y, ap]);
      else put(`prev.${sex}`, geo, y, null);
    }
    validation.push(...pairs);
    for (const [y, ap] of missing) put(`prev.${sex}`, geo, y, calibrated(ap, pairs, y).v.toFixed(1) + APPROX_FLAG + ap.f);
  }
  // EU-27: where no age-band figure exists, use the 20–64 population-weighted mean of the member states
  const pop2064 = (sex, geo, y) => { let w = 0; for (const [, parts] of BANDS) for (const a of parts) { const v = popOf(sex, a, geo, y); if (v == null) return null; w += v; } return w; };
  const euMean = (sex, y) => {
    let sw = 0, sp = 0, fl = new Set();
    for (const g of EU27) {
      const t = series[`prev.${sex}`]?.[g]?.[y]; const p = num(t); const w = pop2064(sex, g, y);
      if (p == null || w == null) continue; // a country without data is left out of the mean
      sw += w; sp += w * p; for (const f of flags(t)) if (f === 'b') fl.add(f);
    }
    return sw ? { v: sp / sw, f: [...fl].join('') } : null;
  };
  for (const sex of ['T', 'M', 'F']) {
    const pairs = [], missing = [];
    for (const y of years) {
      const off = silc[`${sex}|Y20-64|EU27_2020`]?.[y] ?? null;
      const m = euMean(sex, y);
      if (off != null && m) pairs.push({ sex, geo: 'EU27_2020*', y, official: num(off), approx: m.v, diff: m.v - num(off) });
      if (off == null && series[`prev.${sex}`]?.EU27_2020?.[y] == null && m) missing.push([y, m]);
    }
    validation.push(...pairs);
    for (const [y, m] of missing) put(`prev.${sex}`, 'EU27_2020', y, calibrated(m, pairs, y).v.toFixed(1) + APPROX_FLAG + m.f);
  }
  // EU-SILC: share of people with limitation among the employed (EMP) and in the population (POP), ages 20–64.
  // Where 20–64 is not published (mostly before 2019/2020), the employed share falls back to ages 16–64
  // (almost no 16–19-year-olds are employed) and the population share to hlth_silc_12 (series prev.*).
  const s06 = {};
  for (const r of tables.hlth_silc_06.rows) if (r.d.unit === 'PC')
    s06[`${r.d.wstatus}|${r.d.age}|${r.d.sex}|${r.d.lev_limit}|${r.d.geo}`] = r.byYear;
  const fallbackCheck = [];
  for (const sex of ['T', 'M', 'F']) for (const lev of ['SM_SEV', 'SEV']) for (const geo of GEOS) for (const y of years) {
    const e20 = s06[`EMP|Y20-64|${sex}|${lev}|${geo}`]?.[y] ?? null;
    const e16 = s06[`EMP|Y16-64|${sex}|${lev}|${geo}`]?.[y] ?? null;
    if (e20 != null && e16 != null) fallbackCheck.push(num(e16) - num(e20));
    put(`silc.EMP.${lev}.${sex}`, geo, y, e20 ?? (e16 != null ? num(e16).toFixed(1) + APPROX_FLAG + flags(e16).replace(APPROX_FLAG, '') : null));
    const p20 = s06[`POP|Y20-64|${sex}|${lev}|${geo}`]?.[y] ?? null;
    put(`silc.POP.${lev}.${sex}`, geo, y, p20 ?? (lev === 'SM_SEV' ? series[`prev.${sex}`]?.[geo]?.[y] ?? null : null));
  }
  // EU-SILC: share of people with limitation among the unemployed, the retired and other people outside the labour force,
  // ages 20–64 only (no 16–64 fallback: 16–19-year-old students would distort the 'other inactive' group).
  for (const ws of ['UNE', 'RET', 'INAC_OTH']) for (const sex of ['T', 'M', 'F']) for (const geo of GEOS) for (const y of years)
    put(`silc.${ws}.SM_SEV.${sex}`, geo, y, s06[`${ws}|Y20-64|${sex}|SM_SEV|${geo}`]?.[y] ?? null);
  const fb = fallbackCheck.map(Math.abs).sort((a, b) => a - b);
  validation.fallback = fb.length ? `employed share 16–64 vs 20–64, n=${fb.length}: median |diff| ${fb[fb.length >> 1].toFixed(2)}, 95th pct ${fb[Math.floor(0.95 * fb.length)].toFixed(2)}, max ${fb.at(-1).toFixed(2)} pp` : 'no overlap';

  const out = {};
  for (const [k, s] of Object.entries(series)) {
    out[k] = {};
    for (const g of GEOS) out[k][g] = years.map(y => s[g]?.[y] ?? null);
  }
  const need = ['silc.EMP.SM_SEV.T', 'silc.POP.SM_SEV.T', 'emp.T', 'emp.M', 'emp.F', 'gap.SM_SEV.T', 'gap.SM_SEV.M', 'gap.SM_SEV.F', 'gap.SEV.T', 'gap.SOME.T', 'prev.T', 'prev.M', 'prev.F'];
  for (const k of need) {
    const filled = out[k] ? Object.values(out[k]).filter(a => a.some(v => v != null)).length : 0;
    if (filled < 20) throw new Error(`missing or thin series: ${k} (${filled} countries)`);
  }
  const lfs = buildLfs(tables);
  if (lfs) for (const k of ['act.SM_SEV.T', 'inact.SM_SEV.T', 'act.NONE.T', 'unemp.SM_SEV.T']) {
    const filled = Object.values(lfs.series[k] ?? {}).filter(a => a.some(v => v != null)).length;
    if (filled < 20) throw new Error(`missing or thin LFS series: ${k} (${filled} countries)`);
  }
  return { snapshot: { updated, years, series: out, ...(lfs ? { lfs } : {}) }, validation };
}

// LFS: activity, inactivity and unemployment rates by level of limitation (ages 20–64), labour market slack and
// people available but not seeking (ages 15–74), employed persons (thousands, for the LFS share of people with limitation).
export function buildLfs(tables) {
  if (!tables.lfsa_argaeddl) return null;
  const years = tables.lfsa_argaeddl.years.filter(y => tables.lfsa_argaeddl.rows.some(r => r.byYear[y] != null));
  const series = {};
  const put = (name, geo, y, v) => {
    if (!GEOS.includes(geo)) return;
    ((series[name] ??= {})[geo] ??= Object.fromEntries(years.map(yy => [yy, null])))[y] = v;
  };
  const take = (table, name, ok) => {
    for (const r of tables[table]?.rows ?? []) {
      if (!ok(r.d)) continue;
      for (const y of years) put(name(r.d), r.d.geo, y, r.byYear[y] ?? null);
    }
  };
  const base = d => d.age === 'Y20-64' && d.isced11 === 'TOTAL' && d.unit === 'PC' && LFS_LEVELS.includes(d.lev_limit);
  take('lfsa_argaeddl', d => `act.${d.lev_limit}.${d.sex}`, base);
  take('lfsa_ipgaeddl', d => `inact.${d.lev_limit}.${d.sex}`, base);
  take('lfsa_urgaeddl', d => `unemp.${d.lev_limit}.${d.sex}`, base);
  take('lfsa_sup_dl', d => `slack.${d.lev_limit}.${d.sex}`, d => d.wstatus === 'SLACK' && d.unit === 'PC_ELF' && d.age === 'Y15-74');
  take('lfsa_sup_dl', d => `nseek.${d.lev_limit}.${d.sex}`, d => d.wstatus === 'NSEEK_AVL' && d.unit === 'THS_PER' && d.age === 'Y15-74');
  take('lfsa_egasdl', d => `empth.${d.lev_limit}.${d.sex}`, d => d.wstatus === 'EMP' && d.unit === 'THS_PER' && d.age === 'Y20-64' && (d.lev_limit === 'SM_SEV' || d.lev_limit === 'TOTAL'));
  const out = {};
  for (const [k, s] of Object.entries(series)) {
    out[k] = {};
    for (const g of GEOS) out[k][g] = years.map(y => s[g]?.[y] ?? null);
  }
  return { years, series: out };
}

export function summarizeValidation(v) {
  if (!v.length) return 'no overlap to validate against';
  const abs = v.map(x => Math.abs(x.diff)).sort((a, b) => a - b);
  const q = p => abs[Math.min(abs.length - 1, Math.floor(p * abs.length))];
  const mean = v.reduce((s, x) => s + x.diff, 0) / v.length;
  return `approximation vs official 20–64 share, n=${v.length}: mean diff ${mean.toFixed(2)} pp, median |diff| ${q(0.5).toFixed(2)}, 95th pct ${q(0.95).toFixed(2)}, max ${abs.at(-1).toFixed(2)}`;
}

async function load(fromDir) {
  const tables = {};
  if (fromDir) {
    const files = await readdir(fromDir);
    for (const name of Object.keys(SOURCES)) {
      const f = files.find(x => x.includes(name) && /\.(tsv|txt)$/i.test(x)) ?? files.find(x => x.includes(name) && /\.csv$/i.test(x));
      if (!f) throw new Error(`no file for ${name} in ${fromDir}`);
      const text = await readFile(join(fromDir, f), 'utf8');
      tables[name] = /\.csv$/i.test(f) ? parseCsv(text) : parseTsv(text);
    }
  } else {
    for (const [name, key] of Object.entries(SOURCES)) {
      const res = await fetch(`${BASE}${key}?format=TSV&startPeriod=${START}`);
      if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
      tables[name] = parseTsv(await res.text());
    }
  }
  return tables;
}

export function embed(html, snapshot) {
  const json = JSON.stringify(snapshot).replace(/</g, '\\u003c');
  const block = `<!--DATA:START-->\n<script id="snapshot" type="application/json">${json}</script>\n<!--DATA:END-->`;
  if (!/<!--DATA:START-->[\s\S]*?<!--DATA:END-->/.test(html)) throw new Error('data markers not found in index.html');
  return html.replace(/<!--DATA:START-->[\s\S]*?<!--DATA:END-->/, () => block);
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--from');
  const fromDir = i >= 0 ? args[i + 1] : null;
  const tables = await load(fromDir);
  const { snapshot, validation } = buildSnapshot(tables, new Date().toISOString().slice(0, 10));
  console.log(summarizeValidation(validation));
  console.log(validation.fallback);
  const nApprox = Object.values(snapshot.series['prev.T']).flat().filter(v => v && v.includes(APPROX_FLAG)).length;
  console.log(`${snapshot.years[0]}–${snapshot.years.at(-1)}, ${Object.keys(snapshot.series).length} series, ${nApprox} approximated shares (sex T)`);
  if (snapshot.lfs) console.log(`LFS ${snapshot.lfs.years.join(', ')}: ${Object.keys(snapshot.lfs.series).length} series`);
  if (args.includes('--check')) return;
  const file = new URL('../index.html', import.meta.url);
  await writeFile(file, embed(await readFile(file, 'utf8'), snapshot));
  console.log('index.html updated');
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
