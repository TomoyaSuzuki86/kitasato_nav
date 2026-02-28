const REFRESH_MS = 20_000;
const DAY_LABEL = { weekday: '平日', saturday: '土曜', holiday: '休日' };

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

function getDayType(now) {
  if (state.holidays.has(dateKey(now)) || now.getDay() === 0) return 'holiday';
  if (now.getDay() === 6) return 'saturday';
  return 'weekday';
}

function eta(fromMins, depMins) {
  return depMins >= fromMins ? depMins - fromMins : 1440 - fromMins + depMins;
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

function departureEpoch(depTime, now) {
  const [h, m] = depTime.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d.getTime() + 60_000 < now.getTime()) d.setDate(d.getDate() + 1);
  return Math.floor(d.getTime() / 1000);
}

function mapsUrl(direction, depTime) {
  const origin = direction === 'SAGAMIONO_TO_KITASATO' ? '相模大野駅北口' : '北里大学病院';
  const destination = direction === 'SAGAMIONO_TO_KITASATO' ? '北里大学病院' : '相模大野駅北口';
  const params = new URLSearchParams({
    api: '1', origin, destination,
    travelmode: 'transit', transit_mode: 'bus',
    departure_time: String(departureEpoch(depTime, state.now))
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function card(title, direction, nextBus) {
  const wrapper = document.createElement('section');
  wrapper.className = 'section';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  wrapper.append(h2);

  if (!nextBus) {
    const empty = document.createElement('div');
    empty.className = 'card empty';
    empty.textContent = '本日のデータが未設定です';
    wrapper.append(empty);
    return wrapper;
  }

  const el = document.createElement('button');
  el.className = 'card';
  el.onclick = () => window.open(mapsUrl(direction, nextBus.depTime), '_blank', 'noopener,noreferrer');
  const soonClass = nextBus.etaMins <= 2 ? 'soon' : '';
  el.innerHTML = `
    <div class="head">
      <strong class="time">${nextBus.depTime}</strong>
      <div class="eta ${soonClass}">
        <span>${nextBus.etaMins <= 2 ? 'まもなく出発' : '出発まであと'}</span>
        <strong>${nextBus.etaMins}分</strong>
      </div>
    </div>
    <div class="routeRow">
      <div><span class="route">${nextBus.trip.route}</span> ${nextBus.trip.platform}</div>
      <div>${nextBus.arrTime}着</div>
    </div>
    <div class="note">${nextBus.trip.label} / 到着時刻は概算</div>
  `;
  wrapper.append(el);
  return wrapper;
}

function render() {
  const dayType = getDayType(state.now);
  const clock = `${pad2(state.now.getHours())}:${pad2(state.now.getMinutes())}`;
  const root = document.createDocumentFragment();

  const top = document.createElement('header');
  top.className = 'topbar';
  top.innerHTML = `<div class="brand"><span>🚌</span><h1>Kitasato Nav</h1></div><div class="status"><span>${DAY_LABEL[dayType]}</span><strong>${clock}</strong></div>`;
  root.append(top);

  if (!state.timetables) {
    const loading = document.createElement('div');
    loading.className = 'card empty';
    loading.textContent = 'データを読み込み中です…';
    root.append(loading);
  } else {
    const n = nowMins(state.now);
    root.append(card('相模大野駅北口 発', 'SAGAMIONO_TO_KITASATO', pickNext(state.timetables.SAGAMIONO_TO_KITASATO[dayType] ?? [], n)));
    root.append(card('北里大学病院 発', 'KITASATO_TO_SAGAMIONO', pickNext(state.timetables.KITASATO_TO_SAGAMIONO[dayType] ?? [], n)));
  }

  app.replaceChildren(root);
}

async function boot() {
  try {
    const [tRes, hRes] = await Promise.all([fetch('/timetables.json'), fetch('/holidays.json')]);
    state.timetables = await tRes.json();
    state.holidays = new Set(await hRes.json());
  } catch (e) {
    console.error('静的JSONの読み込みに失敗', e);
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
