/*
 * Einfacher Outfit-Beratungsclient
 *
 * Dieser Code nutzt die Open‑Meteo API (https://open-meteo.com/) um stündliche
 * Wetterdaten abzurufen. Anschließend wird eine einfache Regelengine
 * verwendet, die aufgrund von Temperatur, Wind, Regen und individueller
 * Kälteempfindlichkeit eine Outfit-Empfehlung generiert.
 */

const form = document.getElementById("location-form");
const resultContainer = document.getElementById("result");
const weatherSummaryEl = document.getElementById("weather-summary");
const outfitRecEl = document.getElementById("outfit-recommendation");
const explanationEl = document.getElementById("explanation");

// Beispielhafter Kältefaktor: höher = friert schneller
const personalColdFactor = 1; // Wert zwischen 0 und 2, 1 = normal, >1 = friert schneller

// Kleine Outfit-Datenbank für Kategorien
const clothingItems = [
  {
    name: "T‑Shirt",
    category: "top",
    warmth: 1,
    wind: 1,
    rain: 0
  },
  {
    name: "Langarmshirt",
    category: "top",
    warmth: 2,
    wind: 1,
    rain: 0
  },
  {
    name: "Pullover (dünn)",
    category: "top",
    warmth: 3,
    wind: 2,
    rain: 0
  },
  {
    name: "Pullover (dick)",
    category: "top",
    warmth: 5,
    wind: 3,
    rain: 0
  },
  {
    name: "Übergangsjacke",
    category: "outer",
    warmth: 3,
    wind: 4,
    rain: 2
  },
  {
    name: "Dünne Jacke",
    category: "outer",
    warmth: 2,
    wind: 3,
    rain: 1
  },
  {
    name: "Winterjacke",
    category: "outer",
    warmth: 6,
    wind: 5,
    rain: 3
  },
  {
    name: "Wintermantel (lang)",
    category: "outer",
    warmth: 7,
    wind: 6,
    rain: 3
  },
  {
    name: "Jeans",
    category: "bottom",
    warmth: 2,
    wind: 2,
    rain: 0
  },
  {
    name: "Stoffhose",
    category: "bottom",
    warmth: 2,
    wind: 1,
    rain: 0
  },
  {
    name: "Rock + Strumpfhose",
    category: "bottom",
    warmth: 3,
    wind: 2,
    rain: 0
  },
  {
    name: "Schal (dünn)",
    category: "accessory",
    warmth: 2,
    wind: 2,
    rain: 0
  },
  {
    name: "Schal (mittel)",
    category: "accessory",
    warmth: 4,
    wind: 3,
    rain: 0
  },
  {
    name: "Schal (dick)",
    category: "accessory",
    warmth: 6,
    wind: 4,
    rain: 0
  },
  {
    name: "Mütze",
    category: "accessory",
    warmth: 2,
    wind: 2,
    rain: 0
  },
  {
    name: "Handschuhe",
    category: "accessory",
    warmth: 2,
    wind: 1,
    rain: 0
  }
];

// Hilfsfunktion zum Berechnen der benötigten Wärmestufe
function calculateNeededWarmth(temp, wind, rain, timeOfDay) {
  // Basierend auf gefühlter Temperatur (temp) und Wind steigert sich der Bedarf
  let base = 0;
  if (temp >= 20) {
    base = 1;
  } else if (temp >= 15) {
    base = 2;
  } else if (temp >= 10) {
    base = 3;
  } else if (temp >= 5) {
    base = 4;
  } else if (temp >= 0) {
    base = 5;
  } else {
    base = 6;
  }

  // Wind stärker als 20 km/h erhöht den Bedarf
  if (wind > 20) base += 1;
  // Wind sehr stark
  if (wind > 35) base += 1;

  // Regen erhöht Wärmebedarf wegen Nässe und Komfort
  if (rain > 30) base += 1;
  // Persönlicher Kältefaktor
  base = Math.round(base * personalColdFactor);

  return base;
}

function generateOutfitRecommendation(hourlyData) {
  // Wir betrachten die Stunden ab jetzt bis 18 Uhr
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
  const neededWarmthLevels = [];
  for (let i = 0; i < hourlyData.time.length; i++) {
    const t = new Date(hourlyData.time[i]);
    if (t > endOfDay) continue;

    const temp = hourlyData.apparent_temperature[i];
    const wind = hourlyData.windspeed_10m[i];
    const rain = hourlyData.precipitation_probability[i];

    const level = calculateNeededWarmth(temp, wind, rain, t);
    neededWarmthLevels.push({ time: t, level, temp, wind, rain });
  }

  // Wir nehmen das Maximum, um auf Nummer sicher zu gehen (morgens oder abends kann es sehr kalt sein)
  const maxLevelObj = neededWarmthLevels.reduce((prev, curr) =>
    curr.level > prev.level ? curr : prev
  );

  const level = maxLevelObj.level;

  // Auswahl der Kleidungsstücke nach benötigtem Wärmewert
  // Wir sammeln Top, Bottom, Outer und Accessory separat.
  const selected = { top: [], bottom: [], outer: [], accessory: [] };
  let remaining = level;

  // Outerwear hat die stärkste Wirkung; zuerst wählen
  clothingItems
    .filter((c) => c.category === "outer")
    .sort((a, b) => b.warmth - a.warmth)
    .forEach((item) => {
      if (remaining > 0 && remaining >= item.warmth - 1) {
        selected.outer.push(item.name);
        remaining -= item.warmth;
      }
    });

  // Top
  clothingItems
    .filter((c) => c.category === "top")
    .sort((a, b) => b.warmth - a.warmth)
    .forEach((item) => {
      if (remaining > 0 && remaining >= item.warmth - 1) {
        selected.top.push(item.name);
        remaining -= item.warmth;
      }
    });

  // Bottom (ein Kleidungsstück auswählen, reicht)
  clothingItems
    .filter((c) => c.category === "bottom")
    .sort((a, b) => b.warmth - a.warmth)
    .some((item) => {
      // Wähle das passendste. Wenn der Level hoch ist, nimm wärmeres.
      if (level >= 5 && item.warmth >= 3) {
        selected.bottom.push(item.name);
        return true;
      }
      if (level >= 3 && item.warmth >= 2) {
        selected.bottom.push(item.name);
        return true;
      }
      if (level < 3) {
        selected.bottom.push(item.name);
        return true;
      }
      return false;
    });

  // Accessoires optional
  if (level >= 4) {
    // je höher, desto dickerer Schal
    if (level >= 6) {
      selected.accessory.push("Schal (dick)");
    } else if (level >= 5) {
      selected.accessory.push("Schal (mittel)");
    } else {
      selected.accessory.push("Schal (dünn)");
    }
  }
  if (maxLevelObj.temp < 5) {
    selected.accessory.push("Mütze");
    selected.accessory.push("Handschuhe");
  }

  return { selected, neededWarmthLevels, maxLevelObj };
}

function renderResult(data, recommendation) {
  // Wetter Zusammenfassung
  const { maxLevelObj } = recommendation;

  const weatherHtml = `
    <p><strong>Gefühlte Temperatur (Peak):</strong> ${maxLevelObj.temp.toFixed(
      1
    )} °C</p>
    <p><strong>Wind (max):</strong> ${maxLevelObj.wind} km/h</p>
    <p><strong>Regenwahrscheinlichkeit (max):</strong> ${maxLevelObj.rain}%</p>
  `;
  weatherSummaryEl.innerHTML = weatherHtml;

  // Outfit Empfehlung
  const { selected } = recommendation;
  let outfitHtml = "";
  Object.keys(selected).forEach((category) => {
    if (selected[category].length > 0) {
      outfitHtml += `<p><strong>${category.charAt(0).toUpperCase() + category.slice(1)}:</strong></p>`;
      selected[category].forEach((item) => {
        outfitHtml += `<div class="outfit-item">${item}</div>`;
      });
    }
  });
  outfitRecEl.innerHTML = outfitHtml;

  // Erklärung
  explanationEl.innerHTML = `Aufgrund der niedrigsten gefühlten Temperatur, des stärksten Winds und der Regenwahrscheinlichkeit wurde ein Wärmestufe‑Bedarf von <strong>${recommendation.maxLevelObj.level}</strong> berechnet. Je höher dieser Wert, desto wärmere Kleidung wird empfohlen.`;

  resultContainer.classList.remove("hidden");
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=apparent_temperature,precipitation_probability,windspeed_10m&timezone=Europe%2FBerlin`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fehler beim Abrufen der Wetterdaten");
  const data = await res.json();
  return data.hourly;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const lat = parseFloat(document.getElementById("lat").value);
  const lon = parseFloat(document.getElementById("lon").value);
  try {
    weatherSummaryEl.innerHTML = "";
    outfitRecEl.innerHTML = "";
    explanationEl.innerHTML = "";
    resultContainer.classList.add("hidden");

    const hourlyData = await fetchWeather(lat, lon);
    const recommendation = generateOutfitRecommendation(hourlyData);
    renderResult(hourlyData, recommendation);
  } catch (err) {
    weatherSummaryEl.innerHTML = `<p style="color:red">${err.message}</p>`;
    resultContainer.classList.remove("hidden");
  }
});

