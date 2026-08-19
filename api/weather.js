const KMA_BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

module.exports = async function handler(req, res) {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const serviceKey = process.env.KMA_SERVICE_KEY;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ message: "위치 정보가 올바르지 않아요." });
    }
    if (!serviceKey) {
      return res.status(500).json({ message: "KMA_SERVICE_KEY가 설정되지 않았어요. .env.example을 확인해 주세요." });
    }

    const grid = toGrid(lat, lon);
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const ultraBase = getUltraBase(now);
    const villageBase = getVillageBase(now);

    const [ultraItems, villageItems] = await Promise.all([
      fetchKma("getUltraSrtFcst", serviceKey, ultraBase, grid, 100),
      fetchKma("getVilageFcst", serviceKey, villageBase, grid, 300),
    ]);

    const ultraHours = normalizeItems(ultraItems, "ultra");
    const villageHours = normalizeItems(villageItems, "village");
    const hours = mergeForecasts(ultraHours, villageHours, now, 12);
    const summary = makeSummary(hours);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
    return res.status(200).json({ grid, hours, summary });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message || "기상청 예보를 불러오지 못했어요." });
  }
};

async function fetchKma(endpoint, serviceKey, base, grid, numOfRows) {
  const params = new URLSearchParams({
    serviceKey,
    pageNo: "1",
    numOfRows: String(numOfRows),
    dataType: "JSON",
    base_date: base.date,
    base_time: base.time,
    nx: String(grid.nx),
    ny: String(grid.ny),
  });

  // 공공데이터포털의 'Decoding' 일반인증키를 환경변수에 넣는 것을 기준으로 한다.
  const response = await fetch(KMA_BASE + "/" + endpoint + "?" + params.toString());
  const text = await response.text();

  if (!response.ok) throw new Error("기상청 API 응답 오류 (" + response.status + ")");

  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error("기상청 API가 JSON이 아닌 응답을 반환했어요. 인증키를 확인해 주세요.");
  }

  const header = data?.response?.header;
  if (!header || header.resultCode !== "00") {
    throw new Error("기상청 API 오류: " + (header?.resultMsg || "알 수 없는 오류"));
  }

  return data.response.body?.items?.item || [];
}

function normalizeItems(items, source) {
  const map = new Map();

  items.forEach((item) => {
    const date = item.fcstDate;
    const time = item.fcstTime;
    if (!date || !time) return;

    const key = date + time.slice(0, 2);
    if (!map.has(key)) {
      map.set(key, {
        datetime: toIsoKst(date, time),
        date,
        time: time.slice(0, 2) + "00",
        source,
      });
    }

    const row = map.get(key);
    const value = item.fcstValue;
    if (item.category === "PTY") row.pty = numberOrZero(value);
    if (item.category === "SKY") row.sky = numberOrZero(value);
    if (item.category === "T1H" || item.category === "TMP") row.temperature = numberOrNull(value);
    if (item.category === "RN1") {
      row.rainText = normalizeRainText(value);
      row.rainMm = parseRainMm(value);
    }
    if (item.category === "PCP") {
      row.rainText = normalizeRainText(value);
      row.rainMm = parseRainMm(value);
    }
  });

  return Array.from(map.values()).sort((a, b) => a.datetime.localeCompare(b.datetime));
}

function mergeForecasts(ultra, village, nowKst, limit) {
  const nowHour = new Date(nowKst);
  nowHour.setUTCMinutes(0, 0, 0);
  const nowIso = nowHour.toISOString().slice(0, 13);
  const map = new Map();

  village.forEach((item) => map.set(item.datetime.slice(0, 13), item));
  ultra.forEach((item) => map.set(item.datetime.slice(0, 13), item));

  return Array.from(map.values())
    .filter((item) => item.datetime.slice(0, 13) >= nowIso)
    .sort((a, b) => a.datetime.localeCompare(b.datetime))
    .slice(0, limit)
    .map((item) => ({
      datetime: item.datetime,
      timeLabel: item.time.slice(0, 2) + "시",
      pty: item.pty ?? 0,
      sky: item.sky ?? 1,
      temperature: item.temperature ?? null,
      rainMm: item.rainMm ?? 0,
      rainText: item.rainText || "",
      source: item.source,
    }));
}

function makeSummary(hours) {
  if (!hours.length) {
    return {
      headline: "예보 데이터가 없어요",
      description: "잠시 뒤 다시 확인해 주세요.",
      umbrella: "-",
      horizonLimited: false,
    };
  }

  const rainIndexes = [];
  hours.forEach((hour, index) => {
    if (isRain(hour)) rainIndexes.push(index);
  });

  if (!rainIndexes.length) {
    return {
      headline: "당분간 비 소식 없어요 🌤️",
      description: "앞으로 12시간은 비교적 보송하게 지나갈 가능성이 커요.",
      rainStart: "예정 없음",
      rainEnd: "예정 없음",
      umbrella: "두고 가도 돼요",
      horizonLimited: false,
    };
  }

  const first = rainIndexes[0];
  let end = null;
  for (let i = first + 1; i < hours.length; i += 1) {
    if (!isRain(hours[i])) {
      end = i;
      break;
    }
  }

  const alreadyRaining = first === 0;
  const horizonLimited = end === null && rainIndexes[rainIndexes.length - 1] === hours.length - 1;
  const rainStartText = alreadyRaining ? "지금" : hours[first].timeLabel;
  const rainEndText = end !== null ? hours[end].timeLabel : horizonLimited ? "12시간 이후" : "확인 어려움";

  return {
    headline: alreadyRaining ? "지금 비가 와요, 우산 챙겨요 ☔️" : hours[first].timeLabel + "쯤 비가 올 수 있어요 💧",
    description:
      end !== null
        ? alreadyRaining
          ? hours[end].timeLabel + "쯤부터는 비가 잠잠해질 것으로 보여요."
          : rainStartText + "부터 " + rainEndText + " 전후까지 강수가 예상돼요."
        : "예보 범위 끝까지 강수 신호가 이어져요. 그침 시각은 다음 예보에서 더 정확해져요.",
    rainStart: rainStartText,
    rainEnd: rainEndText,
    umbrella: "챙겨가요 ☂️",
    horizonLimited,
  };
}

function isRain(hour) {
  return Number(hour.pty || 0) > 0 || Number(hour.rainMm || 0) > 0;
}

function getUltraBase(nowKst) {
  const date = new Date(nowKst);
  // 초단기예보는 매시 30분 생성, 통상 45분 이후 안정적으로 조회한다.
  if (date.getUTCMinutes() < 45) date.setUTCHours(date.getUTCHours() - 1);
  return { date: formatDate(date), time: pad(date.getUTCHours()) + "30" };
}

function getVillageBase(nowKst) {
  const slots = [2, 5, 8, 11, 14, 17, 20, 23];
  const date = new Date(nowKst);
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  let chosen = null;

  for (let i = slots.length - 1; i >= 0; i -= 1) {
    if (hour > slots[i] || (hour === slots[i] && minute >= 10)) {
      chosen = slots[i];
      break;
    }
  }

  if (chosen === null) {
    date.setUTCDate(date.getUTCDate() - 1);
    chosen = 23;
  }

  return { date: formatDate(date), time: pad(chosen) + "00" };
}

function toIsoKst(date, time) {
  return date.slice(0, 4) + "-" + date.slice(4, 6) + "-" + date.slice(6, 8) + "T" + time.slice(0, 2) + ":00:00+09:00";
}

function formatDate(date) {
  return date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate());
}

function pad(value) {
  return String(value).padStart(2, "0");
}
function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeRainText(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "강수없음") return "";
  return text;
}

function parseRainMm(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "강수없음") return 0;
  if (text.includes("미만")) return 0.1;
  const match = text.match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
}

// 기상청 DFS Lambert Conformal Conic 격자 변환
function toGrid(lat, lon) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}
