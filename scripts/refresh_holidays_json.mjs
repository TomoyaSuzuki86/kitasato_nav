import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOLIDAY_CSV_URL = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";

function decodeCsv(buffer) {
  try {
    return new TextDecoder("shift_jis").decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function toIsoDate(value) {
  const m = String(value).trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const y = m[1];
  const mm = m[2].padStart(2, "0");
  const dd = m[3].padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

async function main() {
  const res = await fetch(HOLIDAY_CSV_URL, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`failed to fetch holiday CSV: status=${res.status}`);
  }

  const text = decodeCsv(await res.arrayBuffer());
  const now = new Date();
  const years = new Set([now.getFullYear(), now.getFullYear() + 1]);

  const dates = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("国民の祝日")) continue;
    const firstCol = line.split(",")[0];
    const iso = toIsoDate(firstCol);
    if (!iso) continue;
    const year = Number(iso.slice(0, 4));
    if (!years.has(year)) continue;
    dates.add(iso);
  }

  const sorted = [...dates].sort();
  if (!sorted.length) {
    throw new Error("no holidays parsed from official CSV");
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.resolve(scriptDir, "..", "build", "holidays.json");
  await fs.writeFile(outPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf-8");

  console.log(`wrote ${outPath}`);
  console.log(`holiday count: ${sorted.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

