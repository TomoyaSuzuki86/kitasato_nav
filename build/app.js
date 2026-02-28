const REFRESH_MS = 20_000;
const DAY_LABEL = { weekday: '平日', saturday: '土曜', holiday: '休日' };

const STATION_LABEL = {
  sagamiono: '相模大野駅北口',
  kitasato: '北里大学病院'
};

const SECTION_CONFIG = {
  SAGAMI_ONO_TO_KITASATO: {
    title: '相模大野駅北口 発',
    accent: 'primary',
    origin: STATION_LABEL.sagamiono,
    destination: STATION_LABEL.kitasato,
    platformPrefix: STATION_LABEL.sagamiono,
    includeRoutes: new Set(['大53', '大55', '大59', '大68', '相25', '大15'])
  },
  KITASATO_TO_SAGAMI_ONO: {
    title: '北里大学病院 発',
    accent: 'secondary',
    origin: STATION_LABEL.kitasato,
    destination: STATION_LABEL.sagamiono,
    platformPrefix: STATION_LABEL.kitasato,
    includeRoutes: new Set(['大15', '大25', '大53', '大59', '大68', '相25'])
  }
};

const ROUTE_BY_ID = {
  O15: '大15',
  O25: '大25',
  O53: '大53',
  O55: '大55',
  O59: '大59',
  O68: '大68',
  S25: '相25'
};

const state = {
  now: new Date(),
  timetables: null,
  holidays: new Set()
};

const app = document.getElementById('app');

const pad2 = (n) => String(n).padStart(2, '0');
const nowMins = (d) => d.getHours() * 60 + d.getMinutes();

const hhmmToMins = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const minsToHHMM = (mins) => {
  const n = ((mins % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(n / 60))}:${pad2(n % 60)}`;
};

const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function routeFromId(id) {
  const key = String(id || '').split('-').pop();
  return ROUTE_BY_ID[key] || String(id || '');
}

function getDayType(now) {
  if (state.holidays.has(dateKey(now)) || now.getDay() === 0) return 'holiday';
  if (now.getDay() === 6) return 'saturday';
  return 'weekday';
}

function eta(fromMins, depMins) {
  return depMins >= fromMins ? depMins - fromMins : 1440 - fromMins + depMins;
}

function toTrip(route, direction) {
  const cfg = SECTION_CONFIG[direction];
  const routeNo = routeFromId(route.id);
  if (!cfg || !cfg.includeRoutes.has(routeNo)) return null;

  return {
    id: route.id,
    route: routeNo,
    platform: `${route.platform}番`,
    label: `${cfg.destination} 行`,
    durationMins: route.approxDurationMins || 25,
    timetable: route.timetable || { weekday: [], saturday: [], holiday: [] }
  };
}

function normalizeTimetables(raw) {
  const normalized = {
    SAGAMI_ONO_TO_KITASATO: { weekday: [], saturday: [], holiday: [] },
    KITASATO_TO_SAGAMI_ONO: { weekday: [], saturday: [], holiday: [] }
  };

  const routes = Array.isArray(raw?.routes) ? raw.routes : [];
  for (const route of routes) {
    const direction = route.direction;
    const trip = toTrip(route, direction);
    if (!trip) continue;

    normalized[direction].weekday.push({ ...trip, times: trip.timetable.weekday || [] });
    normalized[direction].saturday.push({ ...trip, times: trip.timetable.saturday || [] });
    normalized[direction].holiday.push({ ...trip, times: trip.timetable.holiday || [] });
  }

  return normalized;
}

function pickNext(trips, nowMinutes) {
  const candidates = [];

  for (const trip of trips) {
    for (const depTime of trip.times) {
      const depMins = hhmmToMins(depTime);
      candidates.push({
        trip,
        depTime,
        depMins,
        etaMins: eta(nowMinutes, depMins),
        arrTime: minsToHHMM(depMins + trip.durationMins)
      });
    }
  }

  candidates.sort((a, b) => a.etaMins - b.etaMins || a.depMins - b.depMins || a.trip.route.localeCompare(b.trip.route, 'ja'));
  return candidates[0] || null;
}

function pickNextN(trips, nowMinutes, count = 2) {
  const candidates = [];

  for (const trip of trips) {
    for (const depTime of trip.times) {
      const depMins = hhmmToMins(depTime);
      candidates.push({
        trip,
        depTime,
        depMins,
        etaMins: eta(nowMinutes, depMins),
        arrTime: minsToHHMM(depMins + trip.durationMins)
      });
    }
  }

  candidates.sort((a, b) => a.etaMins - b.etaMins || a.depMins - b.depMins || a.trip.route.localeCompare(b.trip.route, 'ja'));

  const uniqueCandidates = [];
  const seen = new Set();
  for (const cand of candidates) {
    const key = `${cand.depTime}-${cand.trip.route}`;
    if (!seen.has(key)) {
      uniqueCandidates.push(cand);
      seen.add(key);
    }
  }

  return uniqueCandidates.slice(0, count);
}

function departureEpoch(depTime, now) {
  const [h, m] = depTime.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d.getTime() + 60_000 < now.getTime()) d.setDate(d.getDate() + 1);
  return Math.floor(d.getTime() / 1000);
}

function mapsUrl(direction, depTime) {
  const cfg = SECTION_CONFIG[direction];
  const params = new URLSearchParams({
    api: '1',
    origin: cfg.origin,
    destination: cfg.destination,
    travelmode: 'transit',
    transit_mode: 'bus',
    departure_time: String(departureEpoch(depTime, state.now))
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function busIcon() {
  return `
    <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7 3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M7 7h10M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M8 19v2M16 19v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M8.5 16.5h.01M15.5 16.5h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
}

function flagIcon() {
  return `
    <svg class="flag" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 3v18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M8 4h9l-1.2 3L17 10H8V4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
}

function topBar(dayType, clock) {
  const top = document.createElement('header');
  top.className = 'topbar';
  top.innerHTML = `
    <div class="brand">
      <div class="brand-icon">${busIcon()}</div>
      <h1>Kitasato Nav</h1>
    </div>
    <div class="status">
      <span class="day-chip">${DAY_LABEL[dayType]}</span>
      <strong class="clock">${clock}</strong>
    </div>
  `;
  return top;
}

function emptyCard(accent) {
  const empty = document.createElement('div');
  empty.className = `card ${accent}`;
  empty.innerHTML = `
    <div class="strip"></div>
    <div class="card-body empty">この曜日の時刻表データが未設定です</div>
  `;
  return empty;
}

function busCard(direction, nextBus, accent, options = { clickable: true, secondary: false }) {
  const card = document.createElement(options.clickable ? 'button' : 'div');
  card.className = `card ${options.clickable ? 'clickable' : 'static'} ${options.secondary ? 'secondary-style' : ''} ${accent}`;
  if (options.clickable) {
    card.onclick = () => window.open(mapsUrl(direction, nextBus.depTime), '_blank', 'noopener,noreferrer');
  }

  const platformLabel = `${SECTION_CONFIG[direction].platformPrefix} ${nextBus.trip.platform}`;
  const isSoon = nextBus.etaMins <= 2;

  card.innerHTML = `
    <div class="strip"></div>
    <div class="card-body">
      <div class="head">
        <strong class="time">${nextBus.depTime}</strong>
        <div class="eta ${isSoon ? 'soon' : ''}">
          <span>${isSoon ? 'まもなく出発' : '出発まであと'}</span>
          <strong>${nextBus.etaMins}<small>分</small></strong>
        </div>
      </div>
      <div class="divider"></div>
      <div class="route-row">
        <div class="left-meta">
          <span class="route-chip">${nextBus.trip.route}</span>
          <span class="platform">${platformLabel}</span>
        </div>
        <div class="arrive">${flagIcon()}<span>${nextBus.arrTime}着</span></div>
      </div>
    </div>
  `;
  return card;
}

function section(direction, nextBus) {
  const cfg = SECTION_CONFIG[direction];
  const wrapper = document.createElement('section');
  wrapper.className = 'section';

  const title = document.createElement('h2');
  title.className = `section-title ${cfg.accent}`;
  title.innerHTML = `<span class="dot"></span>${cfg.title}`;

  wrapper.append(title);
  if (!nextBus || !nextBus.length) {
    wrapper.append(emptyCard(cfg.accent));
    return wrapper;
  }

  wrapper.append(busCard(direction, nextBus[0], cfg.accent, { clickable: true, secondary: false }));
  if (nextBus[1]) {
    wrapper.append(busCard(direction, nextBus[1], cfg.accent, { clickable: false, secondary: true }));
  }

  return wrapper;
}

function render() {
  const dayType = getDayType(state.now);
  const clock = `${pad2(state.now.getHours())}:${pad2(state.now.getMinutes())}`;

  const root = document.createDocumentFragment();
  root.append(topBar(dayType, clock));

  if (!state.timetables) {
    root.append(emptyCard('indigo'));
    app.replaceChildren(root);
    return;
  }

  const minute = nowMins(state.now);
  const nextS2K = pickNextN(state.timetables.SAGAMI_ONO_TO_KITASATO[dayType] || [], minute, 2);
  const nextK2S = pickNextN(state.timetables.KITASATO_TO_SAGAMI_ONO[dayType] || [], minute, 2);

  root.append(section('SAGAMI_ONO_TO_KITASATO', nextS2K));
  root.append(section('KITASATO_TO_SAGAMI_ONO', nextK2S));

  app.replaceChildren(root);
}

async function boot() {
  try {
    const [tRes, hRes] = await Promise.all([fetch('/timetables.json'), fetch('/holidays.json')]);
    const rawTimetables = await tRes.json();
    state.timetables = normalizeTimetables(rawTimetables);
    state.holidays = new Set(await hRes.json());
  } catch (error) {
    console.error('データ読み込みに失敗しました', error);
  }

  render();
}

setInterval(() => {
  state.now = new Date();
  render();
}, REFRESH_MS);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(console.error));
}

boot();
render();
