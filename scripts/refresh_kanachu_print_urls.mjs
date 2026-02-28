// refresh_kanachu_print_urls.mjs
// node >= 18
import fs from "node:fs/promises";

const BASE = "https://www.kanachu.co.jp";
const TARGET = "kanachu_print_to_json.mjs";

function decodePrintUrl(url) {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

function parseRouteEntries(source) {
  const entries = [];
  const re = /id:\s*"([^"]+)"[\s\S]*?printUrl:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const id = m[1];
    const printUrl = m[2];
    const decoded = decodePrintUrl(printUrl);
    const cm = /\/cs:(\d+)-\d+\/nid:(\d+)/.exec(decoded);
    if (!cm) {
      throw new Error(`cannot parse cs/nid from printUrl for route ${id}`);
    }
    entries.push({
      id,
      printUrl,
      cid: cm[1],
      nid: cm[2],
    });
  }
  return entries;
}

function extractHrefPaths(html, pattern) {
  const out = [];
  const hrefRe = /href="([^"]+)"/g;
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1].replace(/&amp;/g, "&");
    if (pattern.test(href)) out.push(href);
  }
  return out;
}

function routeIdToSystemNo(id) {
  const m = /-([A-Z])(\d+)/.exec(id);
  if (!m) return null;
  const prefixMap = { O: "大", S: "相" };
  const prefix = prefixMap[m[1]];
  if (!prefix) return null;
  return `${prefix}${m[2]}`;
}

async function fetchTerminalTimetableMap(nid) {
  const queue = [`/dia/noriba/terminal?nid=${nid}`];
  const visited = new Set();
  const cidToTimetable = new Map();

  while (queue.length) {
    const path = queue.shift();
    if (!path || visited.has(path)) continue;
    visited.add(path);

    const url = `${BASE}${path}`;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`failed to fetch terminal page: ${url} (status=${res.status})`);
    }
    const html = await res.text();

    const ttLinks = extractHrefPaths(
      html,
      new RegExp(`^/dia/diagram/timetable/cs:\\d+-\\d+/nid:${nid}(?:/.*)?$`)
    );
    for (const link of ttLinks) {
      const m = /\/cs:(\d+)-\d+\//.exec(link);
      if (m) cidToTimetable.set(m[1], link);
    }

    const pageLinks = extractHrefPaths(
      html,
      new RegExp(`^/dia/noriba/terminal\\?nid=${nid}&pno=\\d+$`)
    );
    for (const p of pageLinks) {
      if (!visited.has(p) && !queue.includes(p)) queue.push(p);
    }
  }

  return cidToTimetable;
}

async function fetchSystemToTimetablePaths(nid) {
  const url = `${BASE}/dia/diagram/search?t=0&nid=${nid}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`failed to fetch search page: ${url} (status=${res.status})`);
  }
  const html = await res.text();
  const out = new Map();
  const rowRe = /<tr[^>]*>[\s\S]*?<\/tr>/g;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const row = m[0];
    const tt = /href="([^"]*\/dia\/diagram\/timetable\/[^"]+)"/.exec(row)?.[1];
    if (!tt) continue;
    const sysCell = /<td[^>]*class="system"[^>]*>([\s\S]*?)<\/td>/.exec(row)?.[1] ?? "";
    const systemNo = sysCell.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!systemNo) continue;
    const destCell =
      /<td[^>]*class="destination"[^>]*>([\s\S]*?)<\/td>/.exec(row)?.[1] ?? "";
    const destination = destCell.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!out.has(systemNo)) out.set(systemNo, []);
    out.get(systemNo).push({
      path: tt.replace(/&amp;/g, "&"),
      destination,
    });
  }
  return out;
}

function directionKeywordFromRouteId(id) {
  if (id.startsWith("S2K-")) return "北里";
  if (id.startsWith("K2S-")) return "相模大野";
  return null;
}

function extractCidFromTimetablePath(path) {
  return /\/cs:(\d+)-\d+\//.exec(path)?.[1] ?? null;
}

function oppositeRouteId(id) {
  if (id.startsWith("S2K-")) return id.replace("S2K-", "K2S-");
  if (id.startsWith("K2S-")) return id.replace("K2S-", "S2K-");
  return null;
}

async function fetchPrintUrlFromTimetablePath(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`failed to fetch timetable page: ${url} (status=${res.status})`);
  }
  const html = await res.text();
  const matches = extractHrefPaths(
    html,
    /^\/dia\/diagram\/printdate\/cs:\d+-\d+\/nid:\d+\/chk:[^/]+\/dts:\d+$/
  );
  if (!matches.length) {
    throw new Error(`printdate link not found in timetable page: ${url}`);
  }
  return `${BASE}${matches[0]}`;
}

async function ensureNot404(url) {
  const res = await fetch(url, { redirect: "follow" });
  const finalUrl = res.url;
  if (!res.ok || finalUrl.endsWith("/404.html")) {
    throw new Error(`resolved to unavailable page (status=${res.status}, finalUrl=${finalUrl})`);
  }
  return finalUrl;
}

async function main() {
  const source = await fs.readFile(TARGET, "utf-8");
  const entries = parseRouteEntries(source);
  if (!entries.length) {
    throw new Error(`no route entries found in ${TARGET}`);
  }
  const entryById = new Map(entries.map((e) => [e.id, e]));

  const nids = [...new Set(entries.map((e) => e.nid))];
  const mapByNid = new Map();
  const systemMapByNid = new Map();
  for (const nid of nids) {
    const m = await fetchTerminalTimetableMap(nid);
    mapByNid.set(nid, m);
    systemMapByNid.set(nid, await fetchSystemToTimetablePaths(nid));
    console.log(`nid ${nid}: collected ${m.size} timetable cids`);
  }

  let nextSource = source;
  const report = [];
  for (const e of entries) {
    const cidMap = mapByNid.get(e.nid);
    let timetablePath = cidMap?.get(e.cid);
    if (!timetablePath) {
      const systemNo = routeIdToSystemNo(e.id);
      const records = systemNo ? systemMapByNid.get(e.nid)?.get(systemNo) ?? [] : [];
      let candidates = records;
      const dirKey = directionKeywordFromRouteId(e.id);
      if (dirKey) {
        const narrowed = records.filter((x) => x.destination.includes(dirKey));
        if (narrowed.length) candidates = narrowed;
      }
      if (candidates.length > 1) {
        const opposite = oppositeRouteId(e.id);
        const oppositeCid = opposite ? entryById.get(opposite)?.cid : null;
        if (oppositeCid) {
          const narrowed = candidates.filter(
            (x) => extractCidFromTimetablePath(x.path) === oppositeCid
          );
          if (narrowed.length) candidates = narrowed;
        }
      }
      if (candidates.length === 1) {
        timetablePath = candidates[0].path;
        console.log(`route ${e.id}: fallback by system ${systemNo} -> ${timetablePath}`);
      }
    }
    if (!timetablePath) {
      throw new Error(`route ${e.id}: cid ${e.cid} not found in terminal pages for nid ${e.nid}`);
    }

    const freshPrintUrl = await fetchPrintUrlFromTimetablePath(timetablePath);
    const finalUrl = await ensureNot404(freshPrintUrl);
    nextSource = nextSource.replace(e.printUrl, freshPrintUrl);
    report.push({ id: e.id, old: e.printUrl, new: freshPrintUrl, finalUrl });
  }

  await fs.writeFile(TARGET, nextSource, "utf-8");

  console.log(`updated ${report.length} printUrl entries in ${TARGET}`);
  for (const r of report) {
    console.log(`${r.id}`);
    console.log(`  old: ${r.old}`);
    console.log(`  new: ${r.new}`);
    console.log(`  final: ${r.finalUrl}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
