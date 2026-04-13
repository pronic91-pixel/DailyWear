const cities = [
  { name: "Gießen", latitude: 50.5841, longitude: 8.6784 },
  { name: "Frankfurt", latitude: 50.1109, longitude: 8.6821 }
];

const clothingCatalog = {
  lightTop: ["T Shirt", "Langarmshirt"],
  warmTop: ["Langarmshirt", "dünner Pullover", "dicker Pullover"],
  lightOuter: ["dünne Jacke", "Übergangsjacke"],
  warmOuter: ["Übergangsjacke", "Winterjacke", "langer Wintermantel"],
  bottomLight: ["Jeans", "Stoffhose"],
  bottomWarm: ["Jeans", "Rock mit Strumpfhose"],
  extras: ["Schal", "Mütze", "Handschuhe", "Wärmeflasche optional"]
};

const cardsEl = document.getElementById("cards");

function scoreToPercent(level) {
  return Math.max(62, Math.min(96, Math.round(96 - Math.max(0, level - 2) * 6)));
}

function describeWeather(code) {
  const map = {
    0: "klar",
    1: "überwiegend klar",
    2: "leicht bewölkt",
    3: "bewölkt",
    45: "neblig",
    48: "Raureifnebel",
    51: "leichter Niesel",
    53: "Niesel",
    55: "starker Niesel",
    61: "leichter Regen",
    63: "Regen",
    65: "starker Regen",
    71: "leichter Schnee",
    73: "Schnee",
    75: "starker Schnee",
    80: "Regenschauer",
    81: "kräftige Schauer",
    82: "starke Schauer",
    95: "Gewitter"
  };
  return map[code] || "wechselhaft";
}

function calculateNeed(apparentTemp, wind, rainProbability) {
  let level;
  if (apparentTemp >= 20) level = 1;
  else if (apparentTemp >= 15) level = 2;
  else if (apparentTemp >= 10) level = 3;
  else if (apparentTemp >= 5) level = 4;
  else if (apparentTemp >= 0) level = 5;
  else level = 6;

  if (wind >= 20) level += 1;
  if (wind >= 35) level += 1;
  if (rainProbability >= 40) level += 1;

  return Math.min(level, 8);
}

function buildOutfit(level) {
  const top = [];
  const outer = [];
  const bottom = [];
  const extras = [];

  if (level <= 2) {
    top.push("T Shirt oder Langarmshirt");
    outer.push("dünne Jacke optional");
    bottom.push("Jeans oder Stoffhose");
  } else if (level <= 4) {
    top.push("Langarmshirt");
    top.push("dünner Pullover");
    outer.push("Übergangsjacke");
    bottom.push("Jeans oder Stoffhose");
  } else if (level <= 6) {
    top.push("Langarmshirt");
    top.push("Pullover");
    outer.push("Winterjacke");
    bottom.push("Jeans oder Rock mit Strumpfhose");
    extras.push("Schal");
  } else {
    top.push("Langarmshirt");
    top.push("dicker Pullover");
    outer.push("langer Wintermantel");
    bottom.push("Jeans oder Rock mit Strumpfhose");
    extras.push("dicker Schal");
    extras.push("Mütze");
    extras.push("Handschuhe");
    extras.push("Wärmeflasche optional");
  }

  return { top, outer, bottom, extras };
}

function getWindowedHours(hourly) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(18, 0, 0, 0);

  const rows = [];
  for (let i = 0; i < hourly.time.length; i += 1) {
    const time = new Date(hourly.time[i]);
    if (time >= now && time <= end) {
      rows.push({
        time,
        apparent: hourly.apparent_temperature[i],
        temperature: hourly.temperature_2m[i],
        wind: hourly.wind_speed_10m[i],
        rainProbability: hourly.precipitation_probability[i],
        code: hourly.weather_code[i]
      });
    }
  }

  if (rows.length === 0) {
    for (let i = 0; i < Math.min(8, hourly.time.length); i += 1) {
      rows.push({
        time: new Date(hourly.time[i]),
        apparent: hourly.apparent_temperature[i],
        temperature: hourly.temperature_2m[i],
        wind: hourly.wind_speed_10m[i],
        rainProbability: hourly.precipitation_probability[i],
        code: hourly.weather_code[i]
      });
    }
  }

  return rows;
}

function analyze(rows) {
  const coldest = rows.reduce((a, b) => (b.apparent < a.apparent ? b : a));
  const windiest = rows.reduce((a, b) => (b.wind > a.wind ? b : a));
  const rainiest = rows.reduce((a, b) => (b.rainProbability > a.rainProbability ? b : a));
  const needLevel = Math.max(...rows.map((row) => calculateNeed(row.apparent, row.wind, row.rainProbability)));
  const outfit = buildOutfit(needLevel);
  const score = scoreToPercent(needLevel);
  return { coldest, windiest, rainiest, needLevel, outfit, score };
}

async function fetchCityWeather(city) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", city.latitude);
  url.searchParams.set("longitude", city.longitude);
  url.searchParams.set("timezone", "Europe/Berlin");
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "apparent_temperature",
      "precipitation_probability",
      "wind_speed_10m",
      "weather_code"
    ].join(",")
  );

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Wetterdaten konnten nicht geladen werden.");
  }
  const data = await response.json();
  const rows = getWindowedHours(data.hourly);
  return {
    city,
    rows,
    analysis: analyze(rows)
  };
}

function renderCard(result, index) {
  const { city, rows, analysis } = result;

  const article = document.createElement("article");
  article.className = "city-card";
  article.innerHTML = `
    <div class="card-top">
      <div>
        <h2 class="city-title">${city.name}</h2>
        <p class="city-subtitle">
          ${describeWeather(rows[0]?.code)} · bis 18 Uhr
        </p>
      </div>
      <div class="score-badge">
        <strong>${analysis.score}%</strong>
        <span>passt gut</span>
      </div>
    </div>

    <div class="quick-grid">
      <div class="quick-item">
        <span class="quick-label">gefühlt kälteste Stunde</span>
        <span class="quick-value">${analysis.coldest.apparent.toFixed(1)} °C</span>
      </div>
      <div class="quick-item">
        <span class="quick-label">max Wind</span>
        <span class="quick-value">${Math.round(analysis.windiest.wind)} kmh</span>
      </div>
      <div class="quick-item">
        <span class="quick-label">max Regenrisiko</span>
        <span class="quick-value">${Math.round(analysis.rainiest.rainProbability)}%</span>
      </div>
    </div>

    <h3 class="section-title">Empfehlung</h3>
    <div class="outfit-grid">
      <section class="outfit-group">
        <h3>Oberteil</h3>
        <div class="outfit-list">
          ${analysis.outfit.top.map((item) => `<span class="chip">${item}</span>`).join("")}
        </div>
      </section>
      <section class="outfit-group">
        <h3>Jacke</h3>
        <div class="outfit-list">
          ${analysis.outfit.outer.map((item) => `<span class="chip">${item}</span>`).join("")}
        </div>
      </section>
      <section class="outfit-group">
        <h3>Unten</h3>
        <div class="outfit-list">
          ${analysis.outfit.bottom.map((item) => `<span class="chip">${item}</span>`).join("")}
        </div>
      </section>
      <section class="outfit-group">
        <h3>Extras</h3>
        <div class="outfit-list">
          ${(analysis.outfit.extras.length ? analysis.outfit.extras : ["nichts extra nötig"])
            .map((item) => `<span class="chip">${item}</span>`).join("")}
        </div>
      </section>
    </div>

    <p class="reason">
      Grundlage: kälteste gefühlte Temperatur bei ${analysis.coldest.apparent.toFixed(1)} °C,
      Wind bis ${Math.round(analysis.windiest.wind)} kmh und Regenrisiko bis
      ${Math.round(analysis.rainiest.rainProbability)}%.
    </p>

    <div class="chart-wrap">
      <canvas id="chart-${index}" height="160"></canvas>
    </div>
  `;

  cardsEl.appendChild(article);

  const ctx = article.querySelector(`#chart-${index}`);
  new Chart(ctx, {
    type: "line",
    data: {
      labels: rows.map((row) =>
        row.time.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
      ),
      datasets: [
        {
          label: "gefühlt",
          data: rows.map((row) => row.apparent),
          borderColor: "#8fb7ff",
          backgroundColor: "rgba(143, 183, 255, 0.18)",
          fill: true,
          tension: 0.35,
          pointRadius: 2
        },
        {
          label: "Regenrisiko %",
          data: rows.map((row) => row.rainProbability),
          borderColor: "#b8f2e6",
          backgroundColor: "rgba(184, 242, 230, 0.08)",
          fill: false,
          tension: 0.25,
          pointRadius: 1.5,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#d1d5db"
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#9ca3af" },
          grid: { color: "rgba(255,255,255,0.06)" }
        },
        y: {
          ticks: { color: "#9ca3af" },
          grid: { color: "rgba(255,255,255,0.06)" },
          title: {
            display: true,
            text: "°C",
            color: "#9ca3af"
          }
        },
        y1: {
          position: "right",
          min: 0,
          max: 100,
          ticks: { color: "#9ca3af" },
          grid: { drawOnChartArea: false },
          title: {
            display: true,
            text: "%",
            color: "#9ca3af"
          }
        }
      }
    }
  });
}

async function loadAll() {
  cardsEl.innerHTML = "";
  try {
    const results = await Promise.all(cities.map(fetchCityWeather));
    results.forEach((result, index) => renderCard(result, index));
  } catch (error) {
    cardsEl.innerHTML = `<article class="city-card"><div class="error">${error.message}</div></article>`;
  }
}

loadAll();
