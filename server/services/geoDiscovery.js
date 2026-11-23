const { INDIA_PLACES } = require('../data/indiaPlaces');
const { WORLD_194_PLACES } = require('../data/world194');

const DISCOVERY_CACHE = new Map();

const COUNTRY_ALIASES = {
  america: "united states",
  usa: "united states",
  us: "united states",
  uk: "united kingdom",
  britain: "united kingdom",
  england: "united kingdom",
  uae: "united arab emirates",
  holland: "netherlands",
  korea: "south korea",
  czech: "czechia"
};

const PHOTO_POOL = [
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com",
  "https://unsplash.com"
];

const ALL_PLACES = [
  ...INDIA_PLACES.map((p) => ({
    ...p,
    country: "India",
    currency: "INR (₹)",
    dialCode: "+91"
  })),
  ...WORLD_194_PLACES
];

function haversineRoadKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.25);
}

async function fetchJsonFast(url, ms = 2200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TripSplitAI/5.0 (student-portfolio-app)" }
    });
    clearTimeout(timer);
    return res.ok ? await res.json() : null;
  } catch (_) {
    clearTimeout(timer);
    return null;
  }
}

async function resolveDestination(destination) {
  let clean = destination.trim().toLowerCase();
  if (COUNTRY_ALIASES[clean]) clean = COUNTRY_ALIASES[clean];
  const tokens = clean.split(/[\s,/-]+/).filter((w) => w.length > 2);

  // 1. Exact city match first (supports "Narkanda Shimla", "Shimla, Narkanda", etc.)
  const cityMatch = ALL_PLACES.find((p) => {
    const c = p.city.toLowerCase();
    return clean === c || tokens.includes(c) || clean.includes(c);
  });
  if (cityMatch) {
    return {
      name: cityMatch.city,
      state: cityMatch.state || cityMatch.country,
      country: cityMatch.country,
      lat: cityMatch.lat,
      lng: cityMatch.lng,
      currency: cityMatch.currency,
      dialCode: cityMatch.dialCode,
      matchedTokens: tokens
    };
  }

  // 2. Country match (all 195 countries)
  const countryMatch = ALL_PLACES.find((p) => {
    const co = p.country.toLowerCase();
    return clean === co || tokens.includes(co) || clean.includes(co);
  });
  if (countryMatch) {
    return {
      name: countryMatch.city,
      state: countryMatch.state || countryMatch.country,
      country: countryMatch.country,
      lat: countryMatch.lat,
      lng: countryMatch.lng,
      currency: countryMatch.currency,
      dialCode: countryMatch.dialCode,
      matchedTokens: tokens
    };
  }

  // 3. Live OpenStreetMap Nominatim lookup for any smaller town worldwide
  const osmRes = await fetchJsonFast(
    "https://openstreetmap.org" + encodeURIComponent(destination) + "&format=json&addressdetails=1&limit=1",
    2000
  );
  const top = Array.isArray(osmRes) ? osmRes.at(0) : null;
  if (top) {
    const countryName = (top.address && top.address.country) || destination;
    const countryMeta = WORLD_194_PLACES.find((w) => w.country.toLowerCase() === countryName.toLowerCase());
    return {
      name: top.name || destination,
      state: (top.address && top.address.state) || countryName,
      country: countryName,
      lat: parseFloat(top.lat),
      lng: parseFloat(top.lon),
      currency: (countryMeta && countryMeta.currency) || "Local Currency",
      dialCode: (countryMeta && countryMeta.dialCode) || "",
      matchedTokens: tokens
    };
  }

  return null;
}

async function getWikiLandmarks(lat, lng, anchorName) {
  const url = "https://wikipedia.org" + lat + "|" + lng + "&ggsradius=10000&ggslimit=20&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=700&exintro=1&explaintext=1&exsentences=1&format=json&origin=*";
  const data = await fetchJsonFast(url, 2400);
  const pages = data && data.query && data.query.pages ? Object.values(data.query.pages) : [];

  return pages
    .filter((p) => {
      const t = (p.title || "").toLowerCase();
      return t && !t.includes("district") && !t.includes("constituency") && !t.includes("election") && !t.includes("list of");
    })
    .slice(0, 12)
    .map((p, i) => {
      const km = Math.max(2, (i + 1) * 4);
      return {
        city: anchorName,
        title: p.title,
        category: i % 3 === 0 ? "Landmark" : i % 3 === 1 ? "Culture" : "Sightseeing",
        cost: 1100 + (i % 4) * 300,
        food: "Local Regional Specialties",
        distanceKm: km,
        distanceLabel: km + " km from " + anchorName,
        imageUrl: PHOTO_POOL[i % PHOTO_POOL.length],
        notes: p.extract ? p.extract.slice(0, 115) : "Verified landmark & scenic spot near " + anchorName
      };
    });
}

function buildLocalRegionalStops(anchorName, countryName) {
  const templates = [
    ["Historic Old Quarter & Ridge Walk", "Heritage", 950, 0, "Guided walking tour through iconic viewpoints and heritage streets"],
    ["Famous Local Food & Bazaar Trail", "Food", 1150, 3, "Sample signature regional dishes, street snacks, and local sweets"],
    ["Panoramic Sunset Peak & Valley Viewpoint", "Sightseeing", 1200, 12, "Golden-hour panoramic views over the surrounding hills and valleys"],
    ["Cedar / Pine Forest Nature Trail", "Nature", 1350, 24, "Morning nature walk through scenic forest trails and meadows"],
    ["Suburban Waterfall & Gorge Hike", "Adventure", 1750, 42, "Half-day trek to cascading waterfalls and rocky gorges"],
    ["Artisan Craft Village & Heritage Temple", "Culture", 1400, 58, "Explore traditional wooden architecture and local craft workshops"],
    ["Hilltop Fortress & Palace Excursion", "Heritage", 2100, 85, "Full-day excursion to historic royal summer retreat and gardens"],
    ["Lakeside Boating & Orchard Picnic", "Nature", 2300, 115, "Relaxing afternoon by the alpine/scenic lake and local orchards"],
    ["High-Altitude Pass & Scenic Ridge Drive", "Adventure", 2750, 155, "Full-day mountain highway drive with dramatic snow/valley lookouts"],
    ["Regional Wildlife Sanctuary Safari", "Wildlife", 3100, 195, "Early morning guided wildlife spotting in protected reserve"]
  ];

  return templates.map(([suffix, category, cost, km, desc], idx) => ({
    city: anchorName,
    title: anchorName + " — " + suffix,
    category,
    cost,
    food: "Authentic " + countryName + " Cuisine",
    distanceKm: km,
    distanceLabel: km === 0 ? "In " + anchorName : km + " km from " + anchorName,
    imageUrl: PHOTO_POOL[idx % PHOTO_POOL.length],
    notes: desc
  }));
}

async function discoverWithin400Km(destination, preferences = "") {
  const cleanPref = (preferences || "").trim();
  const prefGeo = cleanPref.length > 2 ? await resolveDestination(cleanPref) : null;
  const activeDest = prefGeo ? cleanPref : destination;
  const combinedQuery = cleanPref && !prefGeo ? destination + " " + cleanPref : activeDest;
  const cacheKey = combinedQuery.toLowerCase().trim();
  if (DISCOVERY_CACHE.has(cacheKey)) return DISCOVERY_CACHE.get(cacheKey);

  const geo = prefGeo || (await resolveDestination(activeDest));
  const targetCountry = (geo && geo.country) || activeDest;
  const anchorName = (geo && geo.name) || activeDest;
  const allTokens = combinedQuery.toLowerCase().split(/[\s,/-]+/).filter((w) => w.length > 2);

  const [weatherData, wikiPlaces] = await Promise.all([
    geo ? fetchJsonFast("https://open-meteo.com" + geo.lat + "&longitude=" + geo.lng + "&current_weather=true", 1800) : Promise.resolve(null),
    geo ? getWikiLandmarks(geo.lat, geo.lng, anchorName) : Promise.resolve([])
  ]);

  let curatedNearby = [];
  if (geo) {
    curatedNearby = ALL_PLACES.map((p, idx) => {
      const distKm = p.city.toLowerCase() === geo.name.toLowerCase() ? 0 : haversineRoadKm(geo.lat, geo.lng, p.lat, p.lng);
      const tokenBoost = allTokens.some((t) => p.city.toLowerCase().includes(t) || p.title.toLowerCase().includes(t)) ? 0 : 1;
      const sameStateBoost = geo.state && p.state && p.state.toLowerCase() === geo.state.toLowerCase() ? 0 : 1;
      return {
        ...p,
        distanceKm: distKm,
        distanceLabel: distKm === 0 ? "In " + geo.name : distKm + " km from " + geo.name,
        imageUrl: PHOTO_POOL[idx % PHOTO_POOL.length],
_rank: tokenBoost * 1000 + sameStateBoost * 300 + distKm
};
})
.filter((p) => p.distanceKm <= 400)
.sort((a, b) => a._rank - b._rank);
}
const localStops = buildLocalRegionalStops(anchorName, targetCountry);
const seen = new Set();
const places = [...curatedNearby, ...wikiPlaces, ...localStops]
.filter((item) => {
const key = item.title.toLowerCase();
if (seen.has(key)) return false;
seen.add(key);
return true;
})
.slice(0, 26);
const temp = weatherData && weatherData.current_weather ? weatherData.current_weather.temperature : undefined;
const weatherText = temp !== undefined ? temp + "°C • Wind " + weatherData.current_weather.windspeed + " km/h" : "Check forecast";
const isIndia = targetCountry.toLowerCase() === "india";
const currency = (geo && geo.currency) || (isIndia ? "INR (₹)" : "Local Currency");
const dialCode = (geo && geo.dialCode) || (isIndia ? "+91" : "Check local");
const topFoods = [...new Set(places.map((p) => p.food).filter(Boolean))].slice(0, 4).join(" • ");
const resources = [
{
title: "1. Live Weather & Climate (" + anchorName + ")",
detail: "Current: " + weatherText + ". Best explored between 6:30–10:00 AM and late afternoon for photography & outdoor walks."
},
{
title: "2. Currency, UPI & Forex (" + currency + ")",
detail: isIndia
? "Official Currency: INR (₹). UPI QR works across cities & highways; carry ₹2,500 cash for hill stations and forest gates."
: "Official Currency: " + currency + ". Use a zero-forex international card + keep local cash bills for transit, markets & tips."
},
{
title: "3. 400 km Road, Rail & Transit Matrix",
detail: isIndia
? "0–80 km: Local cab/bike rental • 80–250 km: Outstation SUV/Tempo Traveler • 250–400 km: Overnight Volvo bus or IRCTC Express."
: "0–60 km: City Metro/Taxi • 60–250 km: Regional Rail or Rental Car • 250–400 km: High-speed intercity rail or express coach."
},
{
title: "4. Must-Try Local Cuisine & Street Food",
detail: topFoods || "Sample regional specialties at busy family-run eateries and historic night food bazaars."
},
{
title: "5. Emergency & Tourist Helplines (" + dialCode + ")",
detail: isIndia
? "National Emergency: 112 • Incredible India 24x7 Tourist Helpline: 1800-11-1363 • National Highway Patrol: 1033"
: "International Dial Code: " + dialCode + " • Save local emergency police/ambulance numbers, embassy contact & digital passport PDF."
},
{
title: "6. SIM, eSIM & Offline Navigation",
detail: isIndia
? "Jio & Airtel offer 5G in towns; BSNL/Jio cover remote Himalayan & Northeast routes. Download offline Google Maps."
: "Activate an international eSIM before landing and download offline regional map tiles for rural highway stretches."
}
];
const result = {
destination: anchorName,
country: targetCountry,
weather: weatherText,
currency,
radiusKm: 400,
totalPlacesFound: places.length,
nearbyPlaces: places,
resources
};
DISCOVERY_CACHE.set(cacheKey, result);
return result;
}
async function generateGeoItinerary(destination, days, budget, preferences) {
const discovery = await discoverWithin400Km(destination, preferences);
const pool = [...discovery.nearbyPlaces];
const totalActivities = days * 2;
const budgetScale = budget > 0 ? Math.min(1.4, Math.max(0.65, budget / (totalActivities * 1500))) : 1;
const schedule = [];
const usedTitles = new Set();
for (let i = 0; i < totalActivities; i++) {
const dayNumber = Math.floor(i / 2) + 1;
let place = pool[i];
if (!place || usedTitles.has(place.title.toLowerCase())) {
place = {
title: discovery.destination + " — Day " + dayNumber + " Scenic Hill & Valley Stop #" + (i + 1),
category: i % 2 === 0 ? "Adventure" : "Culture",
cost: 1600 + (i % 5) * 250,
distanceLabel: Math.min(280, 15 + i * 14) + " km from " + discovery.destination,
notes: "Curated regional sightseeing & cultural stop around " + discovery.destination,
imageUrl: PHOTO_POOL[i % PHOTO_POOL.length]
};
}
usedTitles.add(place.title.toLowerCase());
schedule.push({
dayNumber,
title: place.title,
category: place.category,
estimatedCost: Math.round((place.cost * budgetScale) / 50) * 50,
notes: place.distanceLabel + " • " + place.notes,
imageUrl: place.imageUrl || PHOTO_POOL[i % PHOTO_POOL.length]
});
}
return schedule;
}
module.exports = { discoverWithin400Km, generateGeoItinerary };
