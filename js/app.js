(function () {
  var DEV_MODE = true;
  var DEV_LOCATION = { name: "서울", lat: 37.5665, lon: 126.978 };
  var locationButton = document.querySelector("#location-button");
  var locationText = document.querySelector("#location-text");
  var timeline = document.querySelector("#timeline");
  var weatherHero = document.querySelector("#weather-hero");
  var weatherStatus = document.querySelector("#weather-status");
  var weatherDescription = document.querySelector("#weather-description");
  var rainStart = document.querySelector("#rain-start");
  var rainEnd = document.querySelector("#rain-end");
  var umbrellaStatus = document.querySelector("#umbrella-status");
  var weatherNote = document.querySelector("#weather-note");
  var rainDrops = document.querySelector("#rain-drops");
  var devGuide = document.querySelector("#dev-guide");
  var devWeatherButtons = document.querySelectorAll("[data-weather-mode]");

  createRainDrops();
  initDevGuide();
  locationButton.addEventListener("click", requestLocation);

  requestLocation();

  function requestLocation() {
    if (DEV_MODE) {
      locationText.textContent = "서울 · DEV";
      fetchWeather(DEV_LOCATION.lat, DEV_LOCATION.lon);
      return;
    }

    if (!navigator.geolocation) {
      showError("이 브라우저에서는 위치 정보를 사용할 수 없어요.");
      return;
    }

    setLoading("위치를 찾는 중...");
    navigator.geolocation.getCurrentPosition(
      function (position) {
        fetchWeather(position.coords.latitude, position.coords.longitude);
      },
      function () {
        showError("위치 권한이 필요해요. 브라우저에서 위치 접근을 허용해 주세요.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  function initDevGuide() {
    if (!DEV_MODE || !devGuide) return;

    devGuide.hidden = false;

    devWeatherButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var mode = button.getAttribute("data-weather-mode");

        devWeatherButtons.forEach(function (item) {
          item.classList.toggle("is-active", item === button);
        });

        if (mode === "api") {
          fetchWeather(DEV_LOCATION.lat, DEV_LOCATION.lon);
          return;
        }

        renderWeather(createDevWeather(mode));
      });
    });
  }

  function createDevWeather(mode) {
    var presets = {
      sunny: {
        pty: 0,
        sky: 1,
        rainMm: 0,
        headline: "오늘은 맑고 산뜻해요 ☀️",
        description: "비 걱정 없이 가볍게 나가도 좋아요.",
        umbrella: "안 챙겨도 돼요",
      },
      cloudy: {
        pty: 0,
        sky: 4,
        rainMm: 0,
        headline: "구름이 몽글몽글해요 ☁️",
        description: "하늘은 흐리지만 당장 비 소식은 없어요.",
        umbrella: "아직은 괜찮아요",
      },
      rain: {
        pty: 1,
        sky: 4,
        rainMm: 2,
        rainText: "2mm",
        headline: "지금 비가 와요 🌧️",
        description: "한동안 비가 이어질 수 있으니 우산을 챙겨요.",
        umbrella: "꼭 챙겨요 ☂️",
      },
      shower: {
        pty: 1,
        sky: 3,
        rainMm: 5,
        rainText: "5mm",
        headline: "소나기가 후두둑 와요 🌦️",
        description: "짧고 굵게 내릴 수 있어 작은 우산이 든든해요.",
        umbrella: "챙겨가요 ☂️",
      },
      snow: {
        pty: 3,
        sky: 4,
        rainMm: 1,
        rainText: "눈",
        headline: "눈이 포슬포슬 내려요 ❄️",
        description: "길이 미끄러울 수 있으니 천천히 걸어요.",
        umbrella: "눈 대비해요",
      },
    };

    var preset = presets[mode] || presets.sunny;
    var now = new Date();
    var hours = [];

    for (var i = 0; i < 12; i += 1) {
      var date = new Date(now.getTime() + i * 60 * 60 * 1000);
      var hourPreset = Object.assign({}, preset);

      if (mode === "shower") {
        var showerOn = i >= 2 && i <= 4;
        hourPreset.pty = showerOn ? 1 : 0;
        hourPreset.sky = showerOn ? 4 : 3;
        hourPreset.rainMm = showerOn ? 5 : 0;
        hourPreset.rainText = showerOn ? "5mm" : "";
      }

      hours.push({
        datetime: date.toISOString(),
        timeLabel: String(date.getHours()).padStart(2, "0") + "시",
        temperature: 27 - Math.floor(i / 3),
        pty: hourPreset.pty,
        sky: hourPreset.sky,
        rainMm: hourPreset.rainMm,
        rainText: hourPreset.rainText || "",
      });
    }

    return {
      hours: hours,
      summary: {
        headline: preset.headline,
        description: preset.description,
        rainStart: mode === "rain" || mode === "snow" ? "지금" : mode === "shower" ? "2시간 뒤" : "예정 없음",
        rainEnd: mode === "rain" || mode === "snow" ? "4시간 뒤" : mode === "shower" ? "5시간 뒤" : "예정 없음",
        umbrella: preset.umbrella,
        horizonLimited: false,
      },
    };
  }

  function fetchWeather(lat, lon) {
    setLoading("구름을 모으는 중...");

    fetch("/api/weather?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon))
      .then(function (response) {
        if (!response.ok)
          return response.json().then(function (data) {
            throw new Error(data.message || "날씨를 불러오지 못했어요.");
          });
        return response.json();
      })
      .then(renderWeather)
      .catch(function (error) {
        showError(error.message || "날씨를 불러오지 못했어요.");
      });
  }
  function setWeatherClass(target, weather) {
    if (!target) return;

    var weatherClasses = ["is-sunny", "is-cloudy", "is-rainy", "is-snowy"];

    target.classList.remove(...weatherClasses);
    target.classList.add(getWeatherClass(weather));
  }

  function getWeatherClass(weather) {
    var pty = Number(weather.pty || 0);
    var sky = Number(weather.sky || 0);
    var rainMm = Number(weather.rainMm || 0);

    if (pty === 3 || pty === 7) return "is-snowy";
    if (pty > 0 || rainMm > 0) return "is-rainy";
    if (sky >= 3) return "is-cloudy";

    return "is-sunny";
  }
  function renderWeather(data) {
    var hours = data.hours || [];
    var summary = data.summary || {};
    var now = hours[0] || {};
    setWeatherClass(weatherHero, now);

    locationText.textContent = DEV_MODE ? "서울 · DEV" : "현재 위치";
    weatherStatus.textContent = summary.headline || "하늘을 확인했어요!";
    weatherDescription.textContent = summary.description || "앞으로의 강수 변화를 시간별로 보여드릴게요.";
    rainStart.textContent = summary.rainStart || "예정 없음";
    rainEnd.textContent = summary.rainEnd || "예정 없음";
    umbrellaStatus.textContent = summary.umbrella || "안 챙겨도 돼요";

    timeline.innerHTML = hours
      .map(function (hour, index) {
        var rain = isRain(hour);
        return [
          '<article class="timeline-card' + (index === 0 ? " is-now" : "") + (rain ? " is-rain" : "") + '">',
          '<time class="timeline-time" datetime="' +
            escapeHtml(hour.datetime) +
            '">' +
            (index === 0 ? "지금" : escapeHtml(hour.timeLabel)) +
            "</time>",
          '<span class="timeline-icon" aria-hidden="true">' + getWeatherIcon(hour) + "</span>",
          '<span class="timeline-weather">' + escapeHtml(getWeatherLabel(hour)) + "</span>",
          '<strong class="timeline-temp">' +
            (hour.temperature == null ? "-" : escapeHtml(String(Math.round(Number(hour.temperature)))) + "°") +
            "</strong>",
          '<span class="timeline-rain">' + getRainText(hour) + "</span>",
          "</article>",
        ].join("");
      })
      .join("");

    if (summary.horizonLimited) {
      weatherNote.textContent =
        "비가 12시간 뒤까지 이어져 정확한 그침 시각은 아직 알 수 없어요. 예보가 갱신되면 다시 확인해 주세요.";
    } else {
      weatherNote.textContent =
        "기상청 초단기예보 + 단기예보를 이어서 보여줘요. 실제 강수 시각은 지역과 관측 상황에 따라 달라질 수 있어요.";
    }
  }

  function isRain(hour) {
    return Number(hour.pty || 0) > 0 || Number(hour.rainMm || 0) > 0;
  }

  function getWeatherIcon(hour) {
    var pty = Number(hour.pty || 0);
    if (pty === 3 || pty === 7) return "🌨️";
    if (pty === 2 || pty === 6) return "🌦️";
    if (pty > 0) return "🌧️";
    if (Number(hour.sky) >= 4) return "☁️";
    if (Number(hour.sky) >= 3) return "⛅";
    return "🌤️";
  }

  function getWeatherLabel(hour) {
    var pty = Number(hour.pty || 0);
    if (pty === 1) return "비가 와요";
    if (pty === 2) return "비·눈";
    if (pty === 3) return "눈이 와요";
    if (pty === 5) return "빗방울 톡톡";
    if (pty === 6) return "빗방울·눈날림";
    if (pty === 7) return "눈날림";
    if (Number(hour.sky) >= 4) return "구름 가득";
    if (Number(hour.sky) >= 3) return "구름 살짝";
    return "맑고 산뜻";
  }

  function getRainText(hour) {
    if (!isRain(hour)) return "강수 없음";
    if (hour.rainText) return escapeHtml(hour.rainText);
    if (hour.rainMm != null) return escapeHtml(String(hour.rainMm)) + "mm";
    return "강수 예상";
  }

  function setLoading(message) {
    locationText.textContent = message;
    timeline.innerHTML =
      '<div class="timeline-loading"><span class="loading-cloud">☁️</span><span>' +
      escapeHtml(message) +
      "</span></div>";
  }

  function showError(message) {
    locationText.textContent = "다시 찾아보기";
    weatherStatus.textContent = "앗, 구름이 길을 잃었어요 🥲";
    weatherDescription.textContent = message;
    timeline.innerHTML =
      '<div class="timeline-loading"><span class="loading-cloud">☁️</span><span>잠시 뒤 다시 시도해 주세요.</span></div>';
  }

  function createRainDrops() {
    var drops = [];
    for (var i = 0; i < 24; i += 1) {
      var left = (i * 17 + 9) % 100;
      var delay = (i % 8) * -0.13;
      var duration = 0.75 + (i % 5) * 0.08;
      drops.push(
        '<span class="rain-drop" style="left:' +
          left +
          "%;animation-delay:" +
          delay +
          "s;animation-duration:" +
          duration +
          's"></span>',
      );
    }
    rainDrops.innerHTML = drops.join("");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
