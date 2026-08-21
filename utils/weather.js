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
      rainStart: "확인 어려움",
      rainEnd: "확인 어려움",
      umbrella: "-",
      horizonLimited: false,
    };
  }

  const current = hours[0];
  const rainIndexes = [];

  hours.forEach((hour, index) => {
    if (isRain(hour)) rainIndexes.push(index);
  });

  // 앞으로 강수 없음
  if (!rainIndexes.length) {
    if (current.sky === 1) {
      return {
        headline: "오늘은 맑고 산뜻해요☀️",
        description: "앞으로 12시간은 비 걱정 없이 지나갈 수 있어요.",
        rainStart: "예정 없음",
        rainEnd: "예정 없음",
        umbrella: "두고 가도 돼요",
        horizonLimited: false,
      };
    }

    if (current.sky === 3) {
      return {
        headline: "구름이 몽글몽글해요🌥️",
        description: "구름은 많지만 당분간 비 소식은 없어요.",
        rainStart: "예정 없음",
        rainEnd: "예정 없음",
        umbrella: "두고 가도 돼요",
        horizonLimited: false,
      };
    }

    if (current.sky === 4) {
      return {
        headline: "오늘은 하늘이 흐려요☁️",
        description: "흐린 하늘이지만 당분간 비 소식은 없어요.",
        rainStart: "예정 없음",
        rainEnd: "예정 없음",
        umbrella: "두고 가도 돼요",
        horizonLimited: false,
      };
    }
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

  // 현재 눈
  const isSnowing = Number(current.pty) === 3 || Number(current.pty) === 7;

  if (alreadyRaining && isSnowing) {
    return {
      headline: "지금 눈이 포슬포슬 내려요❄️",
      description:
        end !== null
          ? hours[end].timeLabel + "쯤부터는 눈이 잦아들 것으로 보여요."
          : "예보 범위 끝까지 눈 소식이 이어져요.",
      rainStart: rainStartText,
      rainEnd: rainEndText,
      umbrella: "눈길 조심해요",
      horizonLimited,
    };
  }

  return {
    headline: alreadyRaining ? "지금 비가 와요, 우산 챙겨요☔️" : hours[first].timeLabel + "쯤 비가 올 수 있어요💧",

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

var WeatherUtils = {
  mergeForecasts: mergeForecasts,
  makeSummary: makeSummary,
  isRain: isRain,
};

// Node / Vercel
if (typeof module !== "undefined" && module.exports) {
  module.exports = WeatherUtils;
}
// Browser 데브모드용
if (typeof window !== "undefined") {
  window.WeatherUtils = WeatherUtils;
}
