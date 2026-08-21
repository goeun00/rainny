(function () {
  var DEV_MODE = false;
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
      fetchWeather(DEV_LOCATION.lat, DEV_LOCATION.lon);
      fetchLocationName(DEV_LOCATION.lat, DEV_LOCATION.lon).then(function (name) {
        locationText.textContent = name;
      });
      return;
    }
    if (!navigator.geolocation) {
      showError("이 브라우저에서는 위치 정보를 사용할 수 없어요.");
      return;
    }
    setLoading("위치를 찾는 중...");
    navigator.geolocation.getCurrentPosition(
      function (position) {
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        fetchWeather(lat, lon);
        fetchLocationName(lat, lon).then(function (name) {
          locationText.textContent = name;
        });
      },
      function () {
        showError("위치 권한이 필요해요. 브라우저에서 위치 접근을 허용해 주세요.");
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }

  function initDevGuide() {
    if (!devGuide) return;
    devGuide.hidden = !DEV_MODE;
    if (!DEV_MODE) return;
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
        rainText: "",
      },
      cloudy: {
        pty: 0,
        sky: 4,
        rainMm: 0,
        rainText: "",
      },
      rain: {
        pty: 1,
        sky: 4,
        rainMm: 2,
        rainText: "2mm",
      },
      snow: {
        pty: 3,
        sky: 4,
        rainMm: 0,
        rainText: "눈",
      },
    };

    var preset = presets[mode] || presets.sunny;
    var now = new Date();
    var hours = [];

    for (var i = 0; i < 12; i += 1) {
      var date = new Date(now.getTime() + i * 60 * 60 * 1000);

      hours.push({
        datetime: date.toISOString(),
        timeLabel: String(date.getHours()).padStart(2, "0") + "시",
        temperature: 27 - Math.floor(i / 3),
        pty: preset.pty,
        sky: preset.sky,
        rainMm: preset.rainMm,
        rainText: preset.rainText,
        source: "dev",
      });
    }

    return {
      hours: hours,
      summary: WeatherUtils.makeSummary(hours),
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

  function updateThemeColor() {
    var color = getComputedStyle(document.body).getPropertyValue("--gradient1").trim();
    var themeColor = document.querySelector('meta[name="theme-color"]');
    if (!color) return;
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
    if (themeColor) {
      themeColor.content = color;
    }
  }
  updateThemeColor();

  function setWeatherClass(target, weather) {
    if (!target) return;
    var weatherClasses = ["is-sunny", "is-cloudy", "is-rainy", "is-snowy"];
    document.body.classList.remove(...weatherClasses);
    document.body.classList.add(getWeatherClass(weather));
    updateThemeColor();
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

  async function fetchLocationName(lat, lon) {
    try {
      const response = await fetch("/api/location?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon));

      const data = await response.json();

      if (!response.ok) {
        console.error("Location API Error:", data);
        throw new Error(data.message || "위치 이름을 불러오지 못했어요.");
      }

      var region1 = data.region1.replace("특별시", "시").replace("광역시", "시");

      return region1 + " " + data.region2;
    } catch (error) {
      console.error("fetchLocationName 실패:", error);

      // 계속 '확인 중'으로 보이지 않게
      return "현재 위치";
    }
  }
})();
