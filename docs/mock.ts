import React, { useEffect, useMemo, useState } from "react";

/**
 * Kitasato Nav — UI prototype (frontend-only)
 * - Shows ONLY the nearest (next) bus for each direction.
 * - Day type (平日/土曜/休日) is auto-detected. No manual buttons.
 * - No refresh button (auto-updates every 20 seconds).
 * - Timetable data is stubbed. Replace TIMETABLES with real times.
 */

type DayType = "weekday" | "saturday" | "holiday";

type Direction = "SAGAMIONO_TO_KITASATO" | "KITASATO_TO_SAGAMIONO";

type Trip = {
  id: string;
  route: string;
  label: string;
  platform: string;
  durationMins?: number;
  times: string[]; // HH:mm
};

type Timetables = Record<Direction, Record<DayType, Trip[]>>;

// -----------------------------
// STUB DATA (replace with real timetable JSON)
// -----------------------------

const SAMPLE_S2K: Trip[] = [
  {
    id: "S2K-53",
    route: "大53",
    label: "北里大学病院・北里大学 行",
    platform: "1番のりば",
    durationMins: 25,
    times: [
      "06:50",
      "07:20",
      "07:50",
      "08:20",
      "08:50",
      "09:20",
      "10:20",
      "11:20",
      "12:20",
      "13:20",
      "14:20",
      "15:01",
      "15:31",
      "16:01",
      "16:31",
      "17:01",
      "17:31",
      "18:01",
      "18:31",
      "19:01",
    ],
  },
  {
    id: "S2K-59",
    route: "大59",
    label: "北里大学病院・北里大学 行",
    platform: "3番のりば",
    durationMins: 25,
    times: [
      "06:40",
      "07:00",
      "07:20",
      "07:40",
      "08:00",
      "08:20",
      "08:40",
      "09:05",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
      "17:00",
      "17:30",
      "18:00",
    ],
  },
  {
    id: "S2K-S25",
    route: "相25",
    label: "相模原駅南口 行（北里経由）",
    platform: "1番のりば",
    durationMins: 24,
    times: ["07:05", "08:15", "09:15", "10:45", "12:15", "13:45", "15:05", "16:45", "18:15"],
  },
];

const SAMPLE_K2S: Trip[] = [
  {
    id: "K2S-59",
    route: "大59",
    label: "相模大野駅 行",
    platform: "3番のりば",
    durationMins: 24,
    times: [
      "06:55",
      "07:25",
      "07:55",
      "08:25",
      "08:55",
      "09:25",
      "10:25",
      "11:25",
      "12:25",
      "13:25",
      "14:25",
      "15:05",
      "15:35",
      "16:05",
      "16:35",
      "17:05",
      "17:35",
      "18:05",
      "18:35",
      "19:05",
    ],
  },
  {
    id: "K2S-S25",
    route: "相25",
    label: "相模大野駅 行",
    platform: "4番のりば",
    durationMins: 24,
    times: ["07:20", "08:45", "09:45", "11:15", "12:45", "14:15", "15:29", "17:15", "18:45"],
  },
];

const TIMETABLES: Timetables = {
  SAGAMIONO_TO_KITASATO: {
    weekday: SAMPLE_S2K,
    saturday: SAMPLE_S2K,
    holiday: SAMPLE_S2K,
  },
  KITASATO_TO_SAGAMIONO: {
    weekday: SAMPLE_K2S,
    saturday: SAMPLE_K2S,
    holiday: SAMPLE_K2S,
  },
};

// -----------------------------
// Utils
// -----------------------------

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

function minutesToHHMM(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function nowMinutes(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

function getDayType(d = new Date()): DayType {
  const day = d.getDay();
  if (day === 6) return "saturday";
  if (day === 0) return "holiday";
  return "weekday";
}

function diffMinutes(fromMins: number, toMins: number) {
  if (toMins >= fromMins) return toMins - fromMins;
  return 24 * 60 - fromMins + toMins;
}

function pickNext1(trips: Trip[], nowMins: number) {
  const flattened: Array<{
    trip: Trip;
    depTime: string;
    depMins: number;
    etaMins: number;
    arrTime: string;
  }> = [];

  for (const t of trips) {
    const dur = t.durationMins ?? 25;
    for (const depTime of t.times) {
      const depMins = hhmmToMinutes(depTime);
      const etaMins = diffMinutes(nowMins, depMins);
      const arrTime = minutesToHHMM((depMins + dur) % (24 * 60));
      flattened.push({ trip: t, depTime, depMins, etaMins, arrTime });
    }
  }

  flattened.sort((a, b) => {
    if (a.etaMins !== b.etaMins) return a.etaMins - b.etaMins;
    if (a.depMins !== b.depMins) return a.depMins - b.depMins;
    return a.trip.route.localeCompare(b.trip.route);
  });

  return flattened[0] ?? null;
}

function buildGoogleMapsTransitUrl(params: {
  origin: string;
  destination: string;
  departureEpochSec?: number;
}) {
  const base = "https://www.google.com/maps/dir/?api=1";
  const q = new URLSearchParams();
  q.set("origin", params.origin);
  q.set("destination", params.destination);
  q.set("travelmode", "transit");
  q.set("transit_mode", "bus");
  if (params.departureEpochSec) q.set("departure_time", String(params.departureEpochSec));
  return `${base}&${q.toString()}`;
}

function epochForNextDeparture(depHHMM: string) {
  const [h, m] = depHHMM.split(":").map((x) => parseInt(x, 10));
  const d = new Date();
  d.setSeconds(0);
  d.setMilliseconds(0);
  d.setHours(h);
  d.setMinutes(m);
  if (d.getTime() < Date.now() - 60 * 1000) d.setDate(d.getDate() + 1);
  return Math.floor(d.getTime() / 1000);
}

function dayTypeLabel(dt: DayType) {
  if (dt === "weekday") return "平日";
  if (dt === "saturday") return "土曜";
  return "休日";
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 4h9l-1.2 3L17 10H8V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function BusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M7 3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M7 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 19v2M16 19v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 16.5h.01M15.5 16.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// -----------------------------
// UI helpers
// -----------------------------

type Accent = "indigo" | "emerald";

function accentClasses(accent: Accent) {
  if (accent === "indigo") {
    return {
      strip: "bg-indigo-500",
      dot: "bg-indigo-500",
      badge: "bg-indigo-500 text-white",
      etaStrong: "text-red-500",
      etaNormal: "text-indigo-600",
    };
  }
  return {
    strip: "bg-emerald-500",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500 text-white",
    etaStrong: "text-red-500",
    etaNormal: "text-emerald-600",
  };
}

function TopBar({ title, dayLabel, nowLabel }: { title: string; dayLabel: string; nowLabel: string }) {
  return (
    <div className="rounded-[32px] border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-indigo-600 text-white shadow-sm">
            <BusIcon className="h-6 w-6" />
          </div>
          <div className="text-xl font-semibold tracking-tight">{title}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-neutral-700 shadow-sm">{dayLabel}</div>
          <div className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-900">{nowLabel}</div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ accent, text }: { accent: Accent; text: string }) {
  const a = accentClasses(accent);
  return (
    <div className="flex items-center gap-3 px-1">
      <span className={`h-3 w-3 rounded-full ${a.dot}`} />
      <h2 className="text-xl font-semibold tracking-tight text-neutral-800">{text}</h2>
    </div>
  );
}

function BusCard({
  accent,
  depTime,
  etaMins,
  route,
  platform,
  arrTime,
  onOpen,
}: {
  accent: Accent;
  depTime: string;
  etaMins: number;
  route: string;
  platform: string;
  arrTime: string;
  onOpen: () => void;
}) {
  const a = accentClasses(accent);
  const isSoon = etaMins <= 2;

  return (
    <button
      onClick={onOpen}
      className="group w-full overflow-hidden rounded-[32px] border border-white/60 bg-white/75 text-left shadow-sm backdrop-blur transition hover:shadow"
    >
      <div className={`h-2 ${a.strip}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="text-[64px] font-semibold leading-none tracking-tight text-neutral-900 tabular-nums">{depTime}</div>

          <div className="flex flex-col items-end gap-1 pt-2">
            <div className={"text-sm font-semibold " + (isSoon ? a.etaStrong : "text-neutral-500")}>{isSoon ? "まもなく出発" : "出発まであと"}</div>
            <div className={"text-4xl font-semibold leading-none tabular-nums " + (isSoon ? a.etaStrong : a.etaNormal)}>
              {etaMins}
              <span className="ml-1 text-2xl font-semibold">分</span>
            </div>
          </div>
        </div>

        <div className="my-4 h-px bg-neutral-200/70" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`rounded-2xl px-3 py-2 text-sm font-semibold ${a.badge}`}>{route}</span>
            <span className="text-base font-semibold text-neutral-800">{platform}</span>
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-500">
            <FlagIcon className="h-5 w-5" />
            <span className="tabular-nums">{arrTime}</span>
            <span>着</span>
          </div>
        </div>

        <div className="mt-3 text-right text-xs text-neutral-400 opacity-0 transition group-hover:opacity-100">Googleマップで経路案内を開く</div>
      </div>
    </button>
  );
}

function EmptyCard({ accent, text }: { accent: Accent; text: string }) {
  const a = accentClasses(accent);
  return (
    <div className="overflow-hidden rounded-[32px] border border-white/60 bg-white/70 shadow-sm backdrop-blur">
      <div className={`h-2 ${a.strip}`} />
      <div className="p-5 text-sm font-semibold text-neutral-700">{text}</div>
    </div>
  );
}

// -----------------------------
// App
// -----------------------------

export default function App() {
  const [now, setNow] = useState<Date>(() => new Date());

  // Auto update
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  const dt = useMemo(() => getDayType(now), [now]);
  const nowMins = useMemo(() => nowMinutes(now), [now]);
  const nowLabel = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  const s2kTrips = useMemo(() => TIMETABLES.SAGAMIONO_TO_KITASATO[dt] ?? [], [dt]);
  const k2sTrips = useMemo(() => TIMETABLES.KITASATO_TO_SAGAMIONO[dt] ?? [], [dt]);

  const nextS2K = useMemo(() => pickNext1(s2kTrips, nowMins), [s2kTrips, nowMins]);
  const nextK2S = useMemo(() => pickNext1(k2sTrips, nowMins), [k2sTrips, nowMins]);

  const originSagamiono = "相模大野駅";
  const destKitasato = "北里大学病院";

  const openMaps = (direction: Direction, depTime: string) => {
    const url =
      direction === "SAGAMIONO_TO_KITASATO"
        ? buildGoogleMapsTransitUrl({
            origin: originSagamiono,
            destination: destKitasato,
            departureEpochSec: epochForNextDeparture(depTime),
          })
        : buildGoogleMapsTransitUrl({
            origin: destKitasato,
            destination: originSagamiono,
            departureEpochSec: epochForNextDeparture(depTime),
          });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-emerald-100">
      <div className="mx-auto max-w-md px-4 pb-10 pt-6">
        <TopBar title="Kitasato Nav" dayLabel={dayTypeLabel(dt)} nowLabel={nowLabel} />

        <div className="mt-8 space-y-8">
          <div className="space-y-4">
            <SectionTitle accent="indigo" text="相模大野駅北口 発" />
            {nextS2K ? (
              <BusCard
                accent="indigo"
                depTime={nextS2K.depTime}
                etaMins={nextS2K.etaMins}
                route={nextS2K.trip.route}
                platform={nextS2K.trip.platform}
                arrTime={nextS2K.arrTime}
                onOpen={() => openMaps("SAGAMIONO_TO_KITASATO", nextS2K.depTime)}
              />
            ) : (
              <EmptyCard accent="indigo" text="この曜日の時刻表データが未設定です" />
            )}
          </div>

          <div className="space-y-4">
            <SectionTitle accent="emerald" text="北里大学病院 発" />
            {nextK2S ? (
              <BusCard
                accent="emerald"
                depTime={nextK2S.depTime}
                etaMins={nextK2S.etaMins}
                route={nextK2S.trip.route}
                platform={nextK2S.trip.platform}
                arrTime={nextK2S.arrTime}
                onOpen={() => openMaps("KITASATO_TO_SAGAMIONO", nextK2S.depTime)}
              />
            ) : (
              <EmptyCard accent="emerald" text="この曜日の時刻表データが未設定です" />
            )}
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/60 p-4 text-xs text-neutral-700 shadow-sm backdrop-blur">
            <div className="font-semibold">メモ</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>ダイヤ種別（平日/土曜/休日）は自動判定です。</li>
              <li>表示は「直近1便」だけにしています。</li>
              <li>到着時刻は durationMins の概算で計算（本番は時刻表ベースが確実）。</li>
              <li>Googleマップは出発時刻で寄せて開きます。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
