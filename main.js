/*
 * DailyWear – Hauptskript
 *
 * Dieses Skript lädt für Gießen und Frankfurt die stündlichen Wetterdaten
 * über die Open‑Meteo‑API und berechnet daraus den Kleidungbedarf. Daraus
 * werden minimalistische Outfit‑Empfehlungen erzeugt. Für die Darstellung
 * der Wetterverläufe wird Chart.js verwendet.
 */

// Konfiguration für die Städte (Latitude, Longitude)
const cities = [
  { name: "Gießen", latitude: 50.5841, longitude: 8.6784 },
  { name: "Frankfurt", latitude: 50.1109, longitude: 8.6821 }
];

// Zuordnung der Wettercodes zu kleinen Emoji‑Icons
const weatherEmojis = {
  0: "☀️",   // klar
  1: "🌤️",  // überwiegend klar
  2: "⛅",   // leicht bewölkt
  3: "☁️",   // bewölkt
  45: "🌫️", // Nebel
  48: "🌫️", // Nebel mit Reif
  51: "🌦️", // leichter Niesel
  53: "🌦️", // Niesel
  55: "🌧️", // starker Niesel
  61: "🌦️", // leichter Regen
  63: "🌧️", // Regen
  65: "🌧️", // starker Regen
  66: "❄️", // gefrierender Regen
  67: "❄️", // gefrierender Regen stark
  71: "❄️", // leichter Schnee
  73: "❄️", // Schnee
  75: "❄️", // starker Schnee
  77: "❄️", // Graupel
  80: "🌧️", // Regenschauer
  81: "🌧️", // kräftiger Schauer
  82: "🌧️", // sehr kräftiger Schauer
  95: "⛈️", // Gewitter
  96: "⛈️", // Gewitter mit Hagel
  99: "⛈️"  // starkes Gewitter
};

// DOM‑Elemente
const cardsEl = document.getElementById("cards");

// Element für die aktuelle Uhrzeit aus dem DOM
const currentTimeEl = document.getElementById("current-time");

// Aktualisiert die Anzeige der aktuellen Uhrzeit
function updateCurrentTime() {
  if (!currentTimeEl) return;
  const now = new Date();
  const options = { hour: "2-digit", minute: "2-digit" };
  currentTimeEl.textContent = `Aktualisiert um ${now.toLocaleTimeString("de-DE", options)}`;
}

// Hilfsfunktionen

// Bestimmt eine grobe Skala (1–8) des Kleidungbedarfs anhand Temperatur, Wind und Regen.
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

// Gibt eine Outfit‑Struktur für den gegebenen Level zurück.
function buildOutfit(level) {
  const top = [];
  const outer = [];
  const bottom = [];
  const extras = [];

  if (level <= 2) {
    top.push("T‑Shirt", "leichtes Langarmshirt");
    outer.push("keine Jacke nötig");
    // Bei warmen Temperaturen können auch Shorts getragen werden
    bottom.push("Jeans", "Stoffhose", "Shorts");
  } else if (level <= 4) {
    top.push("Langarmshirt", "dünner Pullover");
    outer.push("leichte Jacke");
    bottom.push("Jeans", "Stoffhose");
  } else if (level <= 5) {
    top.push("Langarmshirt", "dünner Pullover");
    outer.push("Übergangsjacke");
    bottom.push("Jeans", "lange Hose");
    extras.push("leichter Schal");
  } else if (level <= 6) {
    top.push("Langarmshirt", "Pullover");
    outer.push("Winterjacke");
    bottom.push("Jeans", "lange Hose");
    extras.push("Schal");
  } else {
    top.push("Langarmshirt", "dicker Pullover");
    outer.push("langer Wintermantel");
    bottom.push("Jeans", "lange Hose");
    extras.push("dicker Schal", "Mütze", "Handschuhe");
  }

  return { top, outer, bottom, extras };
}

// Aus den benötigten Stundendaten den schlechtesten (höchsten Bedarf) ermitteln und Auswertung zusammenstellen.
function analyze(rows) {
  // Kälteste gefühlte Temperatur, stärkster Wind, höchstes Regenrisiko und wärmster Punkt
  const coldest = rows.reduce((a, b) => (b.apparent < a.apparent ? b : a));
  const windiest = rows.reduce((a, b) => (b.wind > a.wind ? b : a));
  const rainiest = rows.reduce((a, b) => (b.rainProbability > a.rainProbability ? b : a));
  const hottest = rows.reduce((a, b) => (b.apparent > a.apparent ? b : a));
  // berechne Basislevel für jede Stunde
  const baseNeed = Math.max(
    ...rows.map((row) => calculateNeed(row.apparent, row.wind, row.rainProbability))
  );
  // erhöhe das Bedürfnis um 1 Stufe, damit die Empfehlungen etwas wärmer werden
  let needLevel = Math.min(baseNeed + 1, 8);
  // Sommerlogik: bei hohen Tageshöchstwerten reduzieren
  const maxTemp = hottest.apparent;
  if (maxTemp >= 27) {
    needLevel = Math.max(1, needLevel - 2);
  } else if (maxTemp >= 24) {
    needLevel = Math.max(1, needLevel - 1);
  }
  const outfit = buildOutfit(needLevel);
  return { coldest, windiest, rainiest, hottest, needLevel, outfit };
}

// Fenster der Stunden von jetzt bis 18:00 (oder erste 8 Stunden, falls später)
function getWindowedHours(hourly) {
  const now = new Date();
  // Wir betrachten die Stunden zwischen 6 und 20 Uhr – wenn wir bereits später als 6 Uhr sind, starten wir ab jetzt
  const start = new Date(now);
  start.setHours(6, 0, 0, 0);
  const end = new Date(now);
  end.setHours(20, 0, 0, 0);

  const rows = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const time = new Date(hourly.time[i]);
    // Berücksichtige nur Stunden zwischen start und end
    if (time >= start && time <= end) {
      rows.push({
        time,
        apparent: hourly.apparent_temperature[i],
        temperature: hourly.temperature_2m[i],
        wind: hourly.windspeed_10m[i],
        rainProbability: hourly.precipitation_probability[i],
        code: hourly.weather_code[i]
      });
    }
  }
  // Falls das aktuelle Datum früher als 6 Uhr ist oder es noch keine Daten im Fenster gibt, nimm die ersten 12 Stunden des Tages
  if (rows.length === 0) {
    for (let i = 0; i < Math.min(12, hourly.time.length); i++) {
      rows.push({
        time: new Date(hourly.time[i]),
        apparent: hourly.apparent_temperature[i],
        temperature: hourly.temperature_2m[i],
        wind: hourly.windspeed_10m[i],
        rainProbability: hourly.precipitation_probability[i],
        code: hourly.weather_code[i]
      });
    }
  }
  return rows;
}

// Abfrage der Wetterdaten für eine Stadt
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
      "windspeed_10m",
      "weather_code"
    ].join(",")
  );
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Wetterdaten konnten nicht geladen werden");
  }
  const data = await response.json();
  const rows = getWindowedHours(data.hourly);
  return { city, rows, analysis: analyze(rows) };
}

// Zeichne den Karteneintrag für eine Stadt
function renderCard(result, index) {
  const { city, rows, analysis } = result;
  const article = document.createElement("article");
  article.className = "city-card";
  // Bestimme Symbol des ersten Zeitpunkts (aktuell)
  const firstCode = rows[0]?.code;
  const emoji = weatherEmojis[firstCode] || "🌡️";
  // Erzeuge HTML
  article.innerHTML = `
    <div class="card-top">
      <div>
        <h2 class="city-title">${city.name}</h2>
        <p class="city-subtitle">${emoji} heute</p>
      </div>
    </div>
    <div class="quick-grid">
      <div class="quick-item">
        <span class="quick-label">🌡️ kältester Punkt</span>
        <span class="quick-value">${analysis.coldest.apparent.toFixed(1)} °C</span>
      </div>
      <div class="quick-item">
        <span class="quick-label">🔥 wärmster Punkt</span>
        <span class="quick-value">${analysis.hottest.apparent.toFixed(1)} °C</span>
      </div>
      <div class="quick-item">
        <span class="quick-label">💨 stärkster Wind</span>
        <span class="quick-value">${Math.round(analysis.windiest.wind)} km/h</span>
      </div>
      <div class="quick-item">
        <span class="quick-label">🌧️ Regenrisiko</span>
        <span class="quick-value">${Math.round(analysis.rainiest.rainProbability)} %</span>
      </div>
    </div>
    <p class="reason">
      Grundlage: kältester Punkt ${analysis.coldest.apparent.toFixed(1)} °C, wärmster Punkt ${analysis.hottest.apparent.toFixed(1)} °C,
      Wind bis ${Math.round(analysis.windiest.wind)} km/h und Regenrisiko bis
      ${Math.round(analysis.rainiest.rainProbability)} %.
    </p>
    <div class="chart-wrap">
      <canvas id="chart-${index}" height="160"></canvas>
    </div>
  `;
  cardsEl.appendChild(article);
  // Grafik zeichnen
  const ctx = article.querySelector(`#chart-${index}`);
  new Chart(ctx, {
    type: "line",
    data: {
      labels: rows.map((row) =>
        row.time.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
      ),
      datasets: [
        {
          label: "gefühlte Temperatur",
          data: rows.map((row) => row.apparent),
          borderColor: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#b7d3f5",
          backgroundColor: "rgba(183, 211, 245, 0.2)",
          fill: true,
          tension: 0.35,
          pointRadius: 2
        },
        {
          label: "Regenrisiko %",
          data: rows.map((row) => row.rainProbability),
          borderColor: getComputedStyle(document.documentElement).getPropertyValue("--accent-2").trim() || "#f5b4d6",
          backgroundColor: "rgba(245, 180, 214, 0.2)",
          fill: false,
          tension: 0.35,
          pointRadius: 2,
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
            color: "#6b7280"
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#6b7280" },
          grid: { color: "rgba(0,0,0,0.05)" }
        },
        y: {
          ticks: { color: "#6b7280" },
          grid: { color: "rgba(0,0,0,0.05)" },
          title: {
            display: true,
            text: "°C",
            color: "#6b7280"
          }
        },
        y1: {
          position: "right",
          min: 0,
          max: 100,
          ticks: { color: "#6b7280" },
          grid: { drawOnChartArea: false },
          title: {
            display: true,
            text: "%",
            color: "#6b7280"
          }
        }
      }
    }
  });
}

// Zeigt die gemeinsame Outfit‑Empfehlung für beide Städte an
function renderCombinedOutfit(outfit, needLevel) {
  const resultEl = document.getElementById("outfit-result");
  if (!resultEl) return;
  resultEl.innerHTML = `
    <article class="outfit-card">
      <h2>Empfohlenes Outfit</h2>
      <div class="outfit-grid">
        <section class="outfit-group">
          <h3>Oberteil</h3>
          <div class="outfit-list">
            ${outfit.top.map((item) => `<span class="chip">${item}</span>`).join("")}
          </div>
        </section>
        <section class="outfit-group">
          <h3>Jacke</h3>
          <div class="outfit-list">
            ${outfit.outer.map((item) => `<span class="chip">${item}</span>`).join("")}
          </div>
        </section>
        <section class="outfit-group">
          <h3>Hose</h3>
          <div class="outfit-list">
            ${outfit.bottom.map((item) => `<span class="chip">${item}</span>`).join("")}
          </div>
        </section>
        <section class="outfit-group">
          <h3>Extras</h3>
          <div class="outfit-list">
            ${outfit.extras.length > 0
              ? outfit.extras.map((item) => `<span class="chip">${item}</span>`).join("")
              : `<span class="chip">–</span>`}
          </div>
        </section>
      </div>
    </article>
  `;
}

// Hauptfunktion: lädt alle Städte und zeichnet die Karten
async function loadAll() {
  cardsEl.innerHTML = "";
  // Aktuelle Uhrzeit aktualisieren
  updateCurrentTime();
  try {
    const results = await Promise.all(cities.map(fetchCityWeather));
    results.forEach((result, index) => renderCard(result, index));
    // Bestimme den höchsten Bedarf zwischen den Städten und zeige eine gemeinsame Outfit‑Empfehlung
    const maxNeed = Math.max(...results.map((r) => r.analysis.needLevel));
    const combinedOutfit = buildOutfit(maxNeed);
    renderCombinedOutfit(combinedOutfit, maxNeed);
  } catch (error) {
    cardsEl.innerHTML = `<article class="city-card"><div class="error">${error.message}</div></article>`;
  }
}

// Starte direkt beim Laden der Seite
loadAll();