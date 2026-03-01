// kanachu_print_to_json.mjs
// node >= 18
import fs from "node:fs/promises";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

const BASE = "https://www.kanachu.co.jp";
const STOP_NID = {
  sagamiono: "00114298",
  kitasato: "00129119",
};

const ROUTES = [
  {
    id: "S2K-O15",
    direction: "SAGAMI_ONO_TO_KITASATO",
    routeNo: "螟ｧ15",
    fromStop: "sagamiono",
    toStop: "kitasato",
    platform: "1",
    approxDurationMins: 28,
    printUrl:
      "https://www.kanachu.co.jp/dia/diagram/printdate/cs:0000803517-1/nid:00114298/chk:all/dts:1772215200",
  },
  {
    id: "S2K-O53",
    direction: "SAGAMI_ONO_TO_KITASATO",
    routeNo: "螟ｧ53",
    fromStop: "sagamiono",
    toStop: "kitasato",
    platform: "1",
    approxDurationMins: 27,
    printUrl:
      "https://www.kanachu.co.jp/dia/diagram/printdate/cs:0000801899-1/nid:00114298/chk:all/dts:1772215200",
  },
  {
    id: "S2K-O55",
    direction: "SAGAMI_ONO_TO_KITASATO",
    routeNo: "螟ｧ55",
    fromStop: "sagamiono",
    toStop: "kitasato",
    platform: "3",
    approxDurationMins: 26,
    printUrl:
      "https://www.kanachu.co.jp/dia/diagram/printdate/cs:0000804124-1/nid:00114298/chk:all/dts:1772215200",
  },
  {
    id: "S2K-O59",
    direction: "SAGAMI_ONO_TO_KITASATO",
    routeNo: "螟ｧ59",
    fromStop: "sagamiono",
    toStop: "kitasato",
    platform: "3",
    approxDurationMins: 26,
    printUrl:
      "https://www.kanachu.co.jp/dia/diagram/printdate/cs:0000804047-1/nid:00114298/chk:all/dts:1772215200",
  },
  {
    id: "S2K-S25",
    direction: "SAGAMI_ONO_TO_KITASATO",
    routeNo: "逶ｸ25",
    fromStop: "sagamiono",
    toStop: "kitasato",
    platform: "1",
    approxDurationMins: 24,
    printUrl:
      "https://www.kanachu.co.jp/dia/diagram/printdate/cs:0000803498-1/nid:00114298/chk:all/dts:1772215200",
  },
  {
    id: "S2K-O68",
    direction: "SAGAMI_ONO_TO_KITASATO",
    routeNo: "螟ｧ68",
    fromStop: "sagamiono",
    toStop: "kitasato",
    platform: "1",
    approxDurationMins: 24,
    printUrl:
      "https://www.kanachu.co.jp/dia/diagram/printdate/cs:0000803499-1/nid:00114298/chk:all/dts:1772215200",
  },
  {
    id: "K2S-O59",
    direction: "KITASATO_TO_SAGAMI_ONO",
    routeNo: "螟ｧ59",
    fromStop: "kitasato",
    toStop: "sagamiono",
    platform: "3",
    approxDurationMins: 29,
    printUrl:
      "https://www.kanachu.co.jp/dia/diagram/printdate/cs:0000804219-1/nid:00129119/chk:all/dts:1772215200",
  },
  {
    id: "K2S-O15",
    direction: "KITASATO_TO_SAGAMI_ONO",
    routeNo: "螟ｧ15",
    fromStop: "kitasato",
    toStop: "sagamiono",
    platform: "4",
    approxDurationMins: 30,
    printUrl:
      "https://www.kanachu.co.jp/dia/diagram/printdate/cs:0000803500-26/nid:00129119/chk:all/dts:1772215200",
  },
  {
    id: "K2S-O25",
    direction: "KITASATO_TO_SAGAMI_ONO",
    routeNo: "螟ｧ25",
    fromStop: "kitasato",
    toStop: "sagamiono",
    platform: "4",
    approxDurationMins: 29,
    printUrl:
      "https://www.kanachu.co.jp/dia/diagram/printdate/cs:0000803513-10/nid:00129119/chk:all/dts:1772215200",
  },
  {
    id: "K2S-O53",
    direction: "KITASATO_TO_SAGAMI_ONO",
    routeNo: "螟ｧ53",
    fromStop: "kitasato",
    toStop: "sagamiono",
    platform: "4",
    approxDurationMins: 31,
    printUrl:
      "https://www.kanachu.co.jp/dia/diagram/printdate/cs:0000803506-1/nid:00129119/chk:all/dts:1772215200",
  },
  {
    id: "K2S-O68",
    direction: "KITASATO_TO_SAGAMI_ONO",
    routeNo: "螟ｧ68",
    fromStop: "kitasato",
    toStop: "sagamiono",
    platform: "4",
    approxDurationMins: 30,
    printUrl:
      "https://www.kanachu.co.jp/dia/diagram/printdate/cs:0000803503-3/nid:00129119/chk:all/dts:1772215200",
  },
  {
    id: "K2S-S25",
    direction: "KITASATO_TO_SAGAMI_ONO",
    routeNo: "逶ｸ25",
    fromStop: "kitasato",
    toStop: "sagamiono",
    platform: "4",
    approxDurationMins: 27,
    printUrl:
      "https://www.kanachu.co.jp/dia/diagram/printdate/cs:0000803498-12/nid:00129119/chk:all/dts:1772215200",
  },
];

function parseCidNidFromPrintUrl(url) {
  const m = /\/cs:(\d+)-\d+\/nid:(\d+)/.exec(url);
  if (!m) throw new Error(`cannot parse cs/nid from printUrl: ${url}`);
  return { cid: m[1], nid: m[2] };
}

function routeIdToSystemNo(id) {
  const m = /-([A-Z])(\d+)/.exec(id);
  if (!m) return null;
  const prefix = m[1] === "O" ? "大" : m[1] === "S" ? "相" : null;
  return prefix ? `${prefix}${m[2]}` : null;
}

function oppositeRouteId(id) {
  if (id.startsWith("S2K-")) return id.replace("S2K-", "K2S-");
  if (id.startsWith("K2S-")) return id.replace("K2S-", "S2K-");
  return null;
}

function extractCidFromTimetablePath(pathname) {
  return /\/cs:(\d+)-\d+\//.exec(pathname)?.[1] ?? null;
}

function extractHrefPaths(html, pattern) {
  const out = [];
  const re = /href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].replace(/&amp;/g, "&");
    if (pattern.test(href)) out.push(href);
  }
  return out;
}

async function fetchTerminalTimetableMap(nid) {
  const queue = [`/dia/noriba/terminal?nid=${nid}`];
  const visited = new Set();
  const cidToPath = new Map();

  while (queue.length) {
    const path = queue.shift();
    if (!path || visited.has(path)) continue;
    visited.add(path);

    const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
    if (!res.ok) throw new Error(`failed terminal fetch: ${path} status=${res.status}`);
    const html = await res.text();

    const ttLinks = extractHrefPaths(
      html,
      new RegExp(`^/dia/diagram/timetable/cs:\\d+-\\d+/nid:${nid}(?:/.*)?$`)
    );
    for (const link of ttLinks) {
      const cid = extractCidFromTimetablePath(link);
      if (cid) cidToPath.set(cid, link);
    }

    const pageLinks = extractHrefPaths(
      html,
      new RegExp(`^/dia/noriba/terminal\\?nid=${nid}&pno=\\d+$`)
    );
    for (const p of pageLinks) {
      if (!visited.has(p) && !queue.includes(p)) queue.push(p);
    }
  }

  return cidToPath;
}

async function fetchSystemToTimetablePaths(nid) {
  const res = await fetch(`${BASE}/dia/diagram/search?t=0&nid=${nid}`, {
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`failed search fetch nid=${nid}: status=${res.status}`);
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

    if (!out.has(systemNo)) out.set(systemNo, []);
    out.get(systemNo).push(tt.replace(/&amp;/g, "&"));
  }

  return out;
}

async function fetchPrintUrlFromTimetablePath(pathname) {
  const res = await fetch(`${BASE}${pathname}`, { redirect: "follow" });
  if (!res.ok) throw new Error(`failed timetable fetch: ${pathname} status=${res.status}`);
  const html = await res.text();
  const matches = extractHrefPaths(
    html,
    /^\/dia\/diagram\/printdate\/cs:\d+-\d+\/nid:\d+\/chk:[^/]+\/dts:\d+$/
  );
  if (!matches.length) throw new Error(`printdate not found in timetable page: ${pathname}`);
  return `${BASE}${matches[0]}`;
}

async function ensureValidPrintUrl(url) {
  const res = await fetch(url, { redirect: "follow" });
  const finalPath = new URL(res.url).pathname;
  if (!res.ok || finalPath === "/404.html") {
    throw new Error(`unavailable print page (status=${res.status}, finalUrl=${res.url})`);
  }
  return { finalUrl: res.url, html: await res.text() };
}

function dayTypeFromTm(tm) {
  const ymd = tm.slice(0, 10);
  const day = new Date(`${ymd}T00:00:00`).getDay();
  if (day === 6) return "saturday";
  if (day === 0) return "holiday";
  return "weekday";
}

function depTimeFromTm(tm) {
  return tm.slice(11, 16);
}

function parseDurationFromRouteHtml(html) {
  const m = /所要時間は約\s*([0-9]+)\s*分/.exec(html);
  if (!m) return null;
  return Number(m[1]);
}

function parseDurationToTargetByParts(html, targetNid) {
  const liRe = /<li id="(\d+)-\d+"[\s\S]*?<\/li>/g;
  let total = 0;
  for (const m of html.matchAll(liRe)) {
    const nid = m[1];
    const li = m[0];
    const part = /<p class="part">(?:約)?\s*([0-9]+)\s*分\//.exec(li);
    if (part) total += Number(part[1]);
    if (nid === targetNid) {
      return total > 0 ? total : null;
    }
  }
  return null;
}

function parseArrivalAtNidFromRouteHtml(html, nid) {
  const reArr = new RegExp(
    `<li id="${nid}-\\d+"[\\s\\S]*?<p class="timetable[^"]*">[\\s\\S]*?(\\d{1,2}:\\d{2})<span>着<\\/span>`,
    "i"
  );
  const mArr = reArr.exec(html);
  if (mArr) return mArr[1];

  const reAny = new RegExp(
    `<li id="${nid}-\\d+"[\\s\\S]*?<p class="timetable[^"]*">[\\s\\S]*?(\\d{1,2}:\\d{2})<span>(?:着|発)<\\/span>`,
    "i"
  );
  const mAny = reAny.exec(html);
  return mAny ? mAny[1] : null;
}

function diffMinutes(depHHMM, arrHHMM) {
  const [dh, dm] = depHHMM.split(":").map(Number);
  const [ah, am] = arrHHMM.split(":").map(Number);
  const dep = dh * 60 + dm;
  const arr = ah * 60 + am;
  return arr >= dep ? arr - dep : 1440 - dep + arr;
}

function parseRouteIndexLinks(html) {
  const links = extractHrefPaths(
    html,
    /^\/dia\/route\/index\/(?:cid:[^"']+\/ssnid:\d+\/sn:\d+\/tm:[^/]+\/op:[^/]+\/|cid:\d+\/dts:\d+)\/?$/
  );
  return Array.from(new Set(links));
}

function parseTimetable01Path(html) {
  const links = extractHrefPaths(
    html,
    /^\/dia\/diagram\/timetable01\/cs:\d+-\d+\/rt:\d+\/nid:\d+\/dts:\d+$/
  );
  return links[0] ?? null;
}

function buildTimetableUrlFromPrintUrl(printUrl) {
  const m = /\/printdate\/cs:(\d+-\d+)\/nid:(\d+)\//.exec(printUrl);
  if (!m) return null;
  return `${BASE}/dia/diagram/timetable/cs:${m[1]}/nid:${m[2]}`;
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid];
  return Math.round((s[mid - 1] + s[mid]) / 2);
}

async function fetchDurationByTimeFromOfficial(route, timetable) {
  const out = { weekday: {}, saturday: {}, holiday: {} };
  const timetableUrl = buildTimetableUrlFromPrintUrl(route.printUrl);
  if (!timetableUrl) return out;

  const ttRes = await fetch(timetableUrl, { redirect: "follow" });
  if (!ttRes.ok) return out;
  const ttHtml = await ttRes.text();
  const routeLinks = parseRouteIndexLinks(ttHtml);
  const targetNid = STOP_NID[route.toStop];

  for (const link of routeLinks) {
    const tmRaw = /\/tm:([^/]+)\//.exec(link)?.[1];
    if (!tmRaw) continue;
    const tm = decodeURIComponent(tmRaw);
    const dayType = dayTypeFromTm(tm);
    const dep = depTimeFromTm(tm);
    if (out[dayType][dep] != null) continue;

    const res = await fetch(`${BASE}${link}`, { redirect: "follow" });
    if (!res.ok) continue;
    const html = await res.text();
    if (!targetNid) continue;
    const arr = parseArrivalAtNidFromRouteHtml(html, targetNid);
    let duration = null;
    if (arr) {
      duration = diffMinutes(dep, arr);
    } else {
      duration = parseDurationToTargetByParts(html, targetNid);
    }
    if (!Number.isFinite(duration) || duration < 5 || duration > 120) continue;
    out[dayType][dep] = duration;
  }

  const hasAnyDuration = Object.values(out).some((m) => Object.keys(m).length > 0);
  if (!hasAnyDuration || route.id === "K2S-S25") {
    const timetable01Path = parseTimetable01Path(ttHtml);
    if (timetable01Path) {
      const t01Res = await fetch(`${BASE}${timetable01Path}`, { redirect: "follow" });
      if (t01Res.ok) {
        const t01Html = await t01Res.text();
        const fallbackRouteLinks = parseRouteIndexLinks(t01Html);

        let representative = null;
        for (const link of fallbackRouteLinks) {
          const tmRaw = /\/tm:([^/]+)\//.exec(link)?.[1];
          const res = await fetch(`${BASE}${link}`, { redirect: "follow" });
          if (!res.ok) continue;
          const html = await res.text();
          const duration = parseDurationFromRouteHtml(html);
          if (!Number.isFinite(duration) || duration < 5 || duration > 120) continue;

          if (tmRaw) {
            const tm = decodeURIComponent(tmRaw);
            const dayType = dayTypeFromTm(tm);
            const dep = depTimeFromTm(tm);
            if (out[dayType][dep] == null) out[dayType][dep] = duration;
          } else if (representative == null) {
            representative = duration;
          }
        }

        if (representative != null && timetable) {
          for (const dayType of ["weekday", "saturday", "holiday"]) {
            const times = timetable[dayType] || [];
            for (const dep of times) {
              if (out[dayType][dep] == null) out[dayType][dep] = representative;
            }
          }
        }
      }
    }
  }

  return out;
}

async function resolveRoutesWithLatestPrintUrls(routes) {
  const seeded = routes.map((r) => ({ ...r, ...parseCidNidFromPrintUrl(r.printUrl) }));
  const byId = new Map(seeded.map((r) => [r.id, r]));

  const nids = [...new Set(seeded.map((r) => r.nid))];
  const cidMapByNid = new Map();
  const systemMapByNid = new Map();

  for (const nid of nids) {
    cidMapByNid.set(nid, await fetchTerminalTimetableMap(nid));
    systemMapByNid.set(nid, await fetchSystemToTimetablePaths(nid));
  }

  const resolved = [];
  for (const r of seeded) {
    let timetablePath = cidMapByNid.get(r.nid)?.get(r.cid);

    if (!timetablePath) {
      const systemNo = routeIdToSystemNo(r.id);
      let candidates = systemNo ? systemMapByNid.get(r.nid)?.get(systemNo) ?? [] : [];

      if (candidates.length > 1) {
        const oppId = oppositeRouteId(r.id);
        const oppCid = oppId ? byId.get(oppId)?.cid : null;
        if (oppCid) {
          const narrowed = candidates.filter((p) => extractCidFromTimetablePath(p) === oppCid);
          if (narrowed.length) candidates = narrowed;
        }
      }

      if (candidates.length === 1) timetablePath = candidates[0];
    }

    if (!timetablePath) {
      throw new Error(`cannot resolve timetable path for route ${r.id} (cid=${r.cid}, nid=${r.nid})`);
    }

    const printUrl = await fetchPrintUrlFromTimetablePath(timetablePath);
    resolved.push({ ...r, printUrl });
  }

  return resolved;
}

function parsePrintHtmlToTimes(html) {
  const dayKeys = ["weekday", "saturday", "holiday"];
  const out = { weekday: [], saturday: [], holiday: [] };

  const rowStarts = Array.from(html.matchAll(/<tr class="row2"[^>]*>/gi))
    .map((m) => m.index)
    .filter((n) => Number.isFinite(n));

  const rowChunks = rowStarts.map((start, i) => {
    const end = i + 1 < rowStarts.length ? rowStarts[i + 1] : html.length;
    return html.slice(start, end);
  });

  for (const row of rowChunks) {
    const hourText =
      /<th[^>]*class="hour"[^>]*>([\s\S]*?)<\/th>/i.exec(row)?.[1]
        ?.replace(/<[^>]*>/g, " ")
        .trim() ?? "";
    const hm = /^(\d{1,2})$/.exec(hourText);
    if (!hm) continue;

    const hour = Number(hm[1]);
    if (hour < 0 || hour > 24) continue;

    const openRe =
      /<td[^>]*id="hournd\d+"[^>]*class="[^"]*col_(weekday|saturday|holiday)[^"]*"[^>]*>/gi;
    const cells = [];
    let om;
    while ((om = openRe.exec(row)) !== null) {
      cells.push({ key: om[1], start: om.index + om[0].length });
    }

    for (let i = 0; i < cells.length; i++) {
      const key = cells[i].key;
      const start = cells[i].start;
      const end = i + 1 < cells.length ? cells[i + 1].start : row.length;
      const cellText = row.slice(start, end).replace(/<[^>]*>/g, " ");

      for (const m of cellText.matchAll(/(\d{1,2})/g)) {
        const mm = Number(m[1]);
        if (mm >= 0 && mm <= 59) {
          out[key].push(`${String(hour).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
        }
      }
    }
  }

  for (const k of dayKeys) out[k] = Array.from(new Set(out[k])).sort();
  if (!out.weekday.length && !out.saturday.length && !out.holiday.length) {
    throw new Error("timetable rows not found");
  }
  return out;
}

async function main() {
  const resolvedRoutes = await resolveRoutesWithLatestPrintUrls(ROUTES);

  const routes = [];
  const fetchErrors = [];
  for (const r of resolvedRoutes) {
    try {
      const { finalUrl, html } = await ensureValidPrintUrl(r.printUrl);
      const timetable = parsePrintHtmlToTimes(html);
      const durationByTime = await fetchDurationByTimeFromOfficial(r, timetable);
      const allDurations = Object.values(durationByTime)
        .flatMap((x) => Object.values(x))
        .filter((n) => Number.isFinite(n));
      const approxDurationMins = median(allDurations) ?? r.approxDurationMins;
      routes.push({
        ...r,
        approxDurationMins,
        durationByTime,
        timetable,
        source: { printUrl: r.printUrl, finalUrl },
      });
    } catch (e) {
      fetchErrors.push({
        id: r.id,
        routeNo: r.routeNo,
        printUrl: r.printUrl,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (fetchErrors.length) {
    const detail = fetchErrors
      .map((x) => `- ${x.id}(${x.routeNo}): ${x.message}\n  printUrl=${x.printUrl}`)
      .join("\n");
    throw new Error(`failed to fetch/parse ${fetchErrors.length}/${resolvedRoutes.length} routes\n${detail}`);
  }

  const json = {
    meta: {
      generatedAt: new Date().toISOString(),
      timezone: "Asia/Tokyo",
      notes: [
        "weekday=weekdays, saturday=Saturdays, holiday=Sundays/holidays",
        "approxDurationMins is an estimated travel time in minutes.",
      ],
    },
    stops: {
      sagamiono: { name: "逶ｸ讓｡螟ｧ驥朱ｧ・圏蜿｣", nid: "00114298" },
      kitasato: { name: "蛹鈴㈹螟ｧ蟄ｦ逞・劼繝ｻ蛹鈴㈹螟ｧ蟄ｦ", nid: "00129119" },
    },
    routes,
  };

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.resolve(scriptDir, "..", "build", "timetables.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(json, null, 2), "utf-8");
  console.log(`wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
