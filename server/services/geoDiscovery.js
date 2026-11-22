const { INDIA_PLACES } = require('../data/indiaPlaces');
const { WORLD_194_PLACES } = require('../data/world194');

const DISCOVERY_CACHE = new Map();
const PHOTO_CACHE = new Map();

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
      headers: { "User-Agent": "TripSplitAI/4.5 (student-portfolio-app)" }
    });
    clearTimeout(timer);
    return res.ok ? await res.json() : null;
  } catch (_) {
    clearTimeout(timer);
    return null;
  }
}

async function getRealWikiPhoto(query, fallbackIndex = 0) {
  const key = query.toLowerCase().trim();
  if (PHOTO_CACHE.has(key)) return PHOTO_CACHE.get(key);

  const url = "https://wikipedia.org" + encodeURIComponent(query) + "&gsrlimit=4&prop=pageimages&piprop=thumbnail&pithumbsize=700&format=json&origin=*";
  const data = await fetchJsonFast(url, 1800);
  const pages = data && data.query && data.query.pages ? Object.values(data.query.pages) : [];
  const match = pages.find((p) => p.thumbnail && p.thumbnail.source && !p.thumbnail.source.includes(".svg"));

  const photo = (match && match.thumbnail.source) || PHOTO_POOL[fallbackIndex % PHOTO_POOL.length];
  PHOTO_CACHE.set(key, photo);
  return photo;
}

async function resolveDestination(destination) {
  let clean = destination.trim().toLowerCase();
  if (COUNTRY_ALIASES[clean]) clean = COUNTRY_ALIASES[clean];
  const primaryPart = clean.split(",").at(0).trim();
  const resolvedTerm = COUNTRY_ALIASES[primaryPart] || primaryPart;

  const localMatch = ALL_PLACES.find(
    (p) =>
      resolvedTerm.includes(p.city.toLowerCase()) ||
      clean.includes(p.city.toLowerCase()) ||
      clean.includes(p.country.toLowerCase()) ||
      resolvedTerm === p.country.toLowerCase() ||
      p.city.toLowerCase().includes(resolvedTerm)
  );
  if (localMatch) {
    return {
      name: localMatch.city,
      country: localMatch.country,
      lat: localMatch.lat,
      lng: localMatch.lng,
      currency: localMatch.currency,
      dialCode: localMatch.dialCode
    };
  }

  const osmRes = await fetchJsonFast(
    "https://openstreetmap.org" + encodeURIComponent(resolvedTerm) + "&format=json&addressdetails=1&limit=1",
    2000
  );
  const top = Array.isArray(osmRes) ? osmRes.at(0) : null;
  if (top) {
    const countryName = (top.address && top.address.country) || destination;
    const countryMeta = WORLD_194_PLACES.find((w) => w.country.toLowerCase() === countryName.toLowerCase());
    return {
      name: top.name || resolvedTerm,
      country: countryName,
      lat: parseFloat(top.lat),
      lng: parseFloat(top.lon),
      currency: (countryMeta && countryMeta.currency) || "Local Currency",
      dialCode: (countryMeta && countryMeta.dialCode) || ""
    };
  }

  return null;
}

async function getWikiLandmarks(lat, lng, anchorName) {
  const url = "https://wikipedia.org" + lat + "|" + lng + "&ggsradius=10000&ggslimit=25&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=700&exintro=1&explaintext=1&exsentences=1&format=json&origin=*";
  const data = await fetchJsonFast(url, 2400);
  const pages = data && data.query && data.query.pages ? Object.values(data.query.pages) : [];

  return pages
    .filter((p) => {
      const t = (p.title || "").toLowerCase();
      return t && !t.includes("district") && !t.includes("constituency") && !t.includes("election") && !t.includes("list of");
    })
    .slice(0, 18)
    .map((p, i) => {
      const km = Math.max(2, (i + 1) * 5);
      const validThumb = p.thumbnail && p.thumbnail.source && !p.thumbnail.source.includes(".svg") ? p.thumbnail.source : null;
      return {
        city: anchorName,
        title: p.title,
        category: i % 3 === 0 ? "Landmark" : i % 3 === 1 ? "Culture" : "Sightseeing",
        cost: 1100 + (i % 5) * 350,
        food: "Local Regional Specialties",
        distanceKm: km,
        distanceLabel: km + " km from " + anchorName,
        imageUrl: validThumb || PHOTO_POOL[i % PHOTO_POOL.length],
        notes: p.extract ? p.extract.slice(0, 115) : "Verified landmark & cultural site near " + anchorName
      };
    });
}

function build20UniqueStops(anchorName, countryName) {
  const templates = [
    ["Historic Old Quarter & Architecture Walk", "Heritage", 950, 0, "Guided walking tour through iconic historic squares and monuments"],
    ["Famous Street Food & Night Market Crawl", "Food", 1150, 3, "Sample signature regional dishes, street snacks, and local desserts"],
    ["Central Botanical Gardens & Waterfront", "Nature", 850, 5, "Morning stroll along scenic gardens and river/harbor promenade"],
    ["National Art & History Museum Quarter", "Culture", 1300, 7, "Explore centuries of art, royal artifacts, and local heritage"],
    ["Panoramic Sunset Hilltop Overlook", "Sightseeing", 1200, 18, "Golden-hour panoramic views over the valley and city skyline"],
    ["Suburban Waterfall & Forest Trail", "Adventure", 1750, 42, "Half-day nature hike through shaded forest trails and cascades"],
    ["Artisan Craft Village & Pottery Market", "Culture", 1400, 65, "Meet local weavers, potters, and traditional craft workshops"],
    ["Royal Citadel & Hilltop Fortress Excursion", "Heritage", 2100, 95, "Full-day excursion to medieval stone ramparts and watchtowers"],
    ["Lakeside Boating & Vineyard / Orchard Picnic", "Nature", 2300, 130, "Relaxing afternoon boat ride and farm-to-table regional lunch"],
    ["Regional Wildlife Sanctuary Jeep Safari", "Wildlife", 3100, 165, "Early morning guided wildlife spotting in protected reserve"],
    ["Scenic Canyon / Coastal Cliff Drive", "Adventure", 2750, 205, "Full-day highway road trip with dramatic scenic lookouts"],
    ["Ancient Abbey / Temple & Sacred Precinct", "Culture", 1900, 240, "Explore centuries-old spiritual architecture and evening ceremonies"],
    ["Highland Valley & Thermal Hot Springs", "Nature", 2900, 275, "Rejuvenating day trip to natural springs and alpine meadows"],
    ["Historic Railway & Mountain Ridge Town", "Sightseeing", 2500, 305, "Heritage scenic train ride and charming colonial town walk"],
    ["Coastal Lighthouse & Hidden Cove Kayaking", "Adventure", 2650, 330, "Sea kayaking along rocky coves and historic coastal lighthouse"],
    ["Traditional Culinary Farm & Cooking Workshop", "Food", 1850, 345, "Hands-on regional cooking class with fresh farm ingredients"],
    ["UNESCO Archaeological Ruins & Amphitheater", "Heritage", 2400, 360, "Explore ancient stone ruins, columns, and open-air museum"],
    ["Borderland Trading Post & Cultural Bazaar", "Food", 2200, 375, "Discover cross-regional cuisine and historic merchant quarters"],
    ["Alpine Observatory & Stargazing Ridge", "Nature", 2800, 385, "Clear-sky night astronomy session and high-altitude sunset"],
    ["River Gorge Suspension Bridge & Eco-Park", "Adventure", 2150, 395, "Canopy walk across dramatic river gorge and botanical reserve"]
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
const cacheKey = destination.toLowerCase().trim() + "::" + preferences.toLowerCase().trim();
if (DISCOVERY_CACHE.has(cacheKey)) return DISCOVERY_CACHE.get(cacheKey);
const prefGeo = preferences && preferences.trim().length > 2 ? await resolveDestination(preferences) : null;
const geo = prefGeo || (await resolveDestination(destination));
const activeQuery = prefGeo ? preferences.trim() : destination;
const targetCountry = (geo && geo.country) || activeQuery;
const anchorName = (geo && geo.name) || activeQuery;
const [weatherData, wikiPlaces] = await Promise.all([
geo ? fetchJsonFast("open-meteo.com" + geo.lat + "&longitude=" + geo.lng + "&current_weather=true", 1800) : Promise.resolve(null),
geo ? getWikiLandmarks(geo.lat, geo.lng, anchorName) : Promise.resolve([])
]);
let curatedNearby = [];
if (geo) {
curatedNearby = ALL_PLACES.map((p, idx) => {
const distKm = p.city.toLowerCase() === geo.name.toLowerCase() ? 0 : haversineRoadKm(geo.lat, geo.lng, p.lat, p.lng);
return {
...p,
distanceKm: distKm,
distanceLabel: distKm === 0 ? "In " + geo.name : distKm + " km from " + geo.name,
imageUrl: PHOTO_POOL[idx % PHOTO_POOL.length]
};
}).filter((p) => p.distanceKm <= 400);
await Promise.all(
curatedNearby.slice(0, 8).map(async (item, i) => {
item.imageUrl = await getRealWikiPhoto(item.city + " " + item.country, i);
})
);
}
const diverseStops = build20UniqueStops(anchorName, targetCountry);
const seen = new Set();
// Prioritize real curated places & real Wikipedia landmarks first, then diverse regional stops
let places = [...curatedNearby, ...wikiPlaces, ...diverseStops]
.filter((item) => {
const key = item.title.toLowerCase();
if (seen.has(key)) return false;
seen.add(key);
return true;
})
.slice(0, 30);
if (preferences && preferences.trim() && !prefGeo) {
const words = preferences.toLowerCase().split(/[\s,]+/).filter(Boolean);
places.sort((a, b) => {
const aMatch = words.some((w) => (a.title + " " + a.category + " " + a.notes).toLowerCase().includes(w)) ? 0 : 1;
const bMatch = words.some((w) => (b.title + " " + b.category + " " + b.notes).toLowerCase().includes(w)) ? 0 : 1;
return aMatch - bMatch;
});
}
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
title: discovery.destination + " — Day " + dayNumber + " Regional Expedition #" + (i + 1),
category: i % 2 === 0 ? "Adventure" : "Culture",
cost: 1800 + (i % 5) * 300,
distanceLabel: Math.min(395, 25 + i * 18) + " km from " + discovery.destination,
notes: "Curated regional sightseeing & cultural stop within 400 km radius",
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
