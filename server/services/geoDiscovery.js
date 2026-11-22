const { INDIA_PLACES } = require('../data/indiaPlaces');
const { WORLD_194_PLACES } = require('../data/world194');

const DISCOVERY_CACHE = new Map();
const PHOTO_CACHE = new Map();

const CATEGORY_PHOTOS = {
  Heritage: "https://unsplash.com",
  Nature: "https://unsplash.com",
  Adventure: "https://unsplash.com",
  Culture: "https://unsplash.com",
  Food: "https://unsplash.com",
  Wildlife: "https://unsplash.com",
  Sightseeing: "https://unsplash.com",
  Landmark: "https://unsplash.com"
};

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

async function fetchJsonFast(url, ms = 2000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TripSplitAI/3.1 (student-portfolio-app)" }
    });
    clearTimeout(timer);
    return res.ok ? await res.json() : null;
  } catch (_) {
    clearTimeout(timer);
    return null;
  }
}

// Fetch real photo for any searched city/place from Wikipedia API (cached)
async function getPlacePhoto(query, fallbackCategory = "Sightseeing") {
  const key = query.toLowerCase().trim();
  if (PHOTO_CACHE.has(key)) return PHOTO_CACHE.get(key);

  const cleanTerm = query.split(",").trim();
  const url = `https://wikipedia.org{encodeURIComponent(cleanTerm)}&gsrlimit=3&prop=pageimages&piprop=thumbnail&pithumbsize=800&format=json&origin=*`;
  const data = await fetchJsonFast(url, 1800);
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  const withImg = pages.find((p) => p.thumbnail?.source);

  const photo = withImg?.thumbnail?.source || CATEGORY_PHOTOS[fallbackCategory] || CATEGORY_PHOTOS.Sightseeing;
  PHOTO_CACHE.set(key, photo);
  return photo;
}

async function resolveDestination(destination) {
  const clean = destination.trim().toLowerCase();
  const primaryPart = clean.split(",").trim();

  const localMatch = ALL_PLACES.find(
    (p) =>
      primaryPart.includes(p.city.toLowerCase()) ||
      clean.includes(p.city.toLowerCase()) ||
      clean.includes(p.country.toLowerCase()) ||
      p.city.toLowerCase().includes(primaryPart)
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
    `https://openstreetmap.org{encodeURIComponent(primaryPart)}&format=json&addressdetails=1&limit=1`,
    2000
  );
  const top = Array.isArray(osmRes) ? osmRes.at(0) : null;
  if (top) {
    const countryName = top.address?.country || destination;
    const countryMeta = WORLD_194_PLACES.find((w) => w.country.toLowerCase() === countryName.toLowerCase());
    return {
      name: top.name || primaryPart,
      country: countryName,
      lat: parseFloat(top.lat),
      lng: parseFloat(top.lon),
      currency: countryMeta?.currency || "Local Currency",
      dialCode: countryMeta?.dialCode || ""
    };
  }

  return null;
}

async function getWikiLandmarksWithPhotos(lat, lng, anchorName) {
  const url = `https://wikipedia.org{lat}|${lng}&ggsradius=10000&ggslimit=8&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=700&exintro=1&explaintext=1&exsentences=1&format=json&origin=*`;
  const data = await fetchJsonFast(url, 2000);
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];

  return pages
    .filter((p) => p.title && !p.title.toLowerCase().includes("district") && !p.title.toLowerCase().includes("constituency"))
    .slice(0, 6)
    .map((p, i) => {
      const km = Math.max(2, (i + 1) * 4);
      return {
        city: anchorName,
        title: p.title,
        category: "Landmark",
        cost: 1100,
        food: "Local Regional Specialties",
        distanceKm: km,
        distanceLabel: `${km} km from ${anchorName}`,
        imageUrl: p.thumbnail?.source || CATEGORY_PHOTOS.Landmark,
        notes: p.extract ? p.extract.slice(0, 120) : `Verified landmark & cultural site near ${anchorName}`
      };
    });
}

async function discoverWithin400Km(destination, preferences = "") {
  const cacheKey = `${destination.toLowerCase().trim()}::${preferences.toLowerCase().trim()}`;
  if (DISCOVERY_CACHE.has(cacheKey)) return DISCOVERY_CACHE.get(cacheKey);

  // If user typed a specific destination/country in preferences (e.g., "AMERICA" or "Manali"), check if it matches a known place
  const prefGeo = preferences && preferences.trim().length > 2 ? await resolveDestination(preferences) : null;
  const geo = prefGeo || (await resolveDestination(destination));
  const activeQuery = prefGeo ? preferences.trim() : destination;
  const targetCountry = geo?.country || activeQuery;

  const [heroPhoto, weatherData, wikiPlaces] = await Promise.all([
    getPlacePhoto(activeQuery, "Sightseeing"),
    geo ? fetchJsonFast(`https://open-meteo.com{geo.lat}&longitude=${geo.lng}&current_weather=true`, 1800) : Promise.resolve(null),
    geo ? getWikiLandmarksWithPhotos(geo.lat, geo.lng, geo.name) : Promise.resolve([])
  ]);

  let curatedNearby = [];
  if (geo) {
    curatedNearby = ALL_PLACES.map((p) => {
      const distKm = p.city.toLowerCase() === geo.name.toLowerCase() ? 0 : haversineRoadKm(geo.lat, geo.lng, p.lat, p.lng);
      return {
        ...p,
        distanceKm: distKm,
        distanceLabel: distKm === 0 ? `In ${geo.name}` : `${distKm} km from ${geo.name}`,
        imageUrl: CATEGORY_PHOTOS[p.category] || CATEGORY_PHOTOS.Sightseeing
      };
    }).filter((p) => p.distanceKm <= 400);

    // Enrich top 4 curated places with real Wikipedia photos in parallel
    await Promise.all(
      curatedNearby.slice(0, 4).map(async (item) => {
        item.imageUrl = await getPlacePhoto(item.city + " " + item.category, item.category);
      })
    );
  }

  const seen = new Set();
  let places = [...curatedNearby, ...wikiPlaces]
    .filter((item) => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (places.length === 0) {
    places = [
      { title: `${activeQuery} Historic Old Town & Monuments`, category: "Heritage", cost: 1200, food: "Local Street Specialties", distanceKm: 0, distanceLabel: `In ${activeQuery}`, imageUrl: heroPhoto, notes: "Explore historic monuments and cultural squares" },
      { title: `${activeQuery} Culinary & Night Market Trail`, category: "Food", cost: 1400, food: "Signature Regional Dishes", distanceKm: 5, distanceLabel: `5 km from ${activeQuery}`, imageUrl: CATEGORY_PHOTOS.Food, notes: "Authentic street food and traditional eateries" },
      { title: `Scenic Nature Reserve & Panoramic Overlook`, category: "Nature", cost: 1800, food: "Viewpoint Cafe", distanceKm: 55, distanceLabel: `55 km from ${activeQuery}`, imageUrl: CATEGORY_PHOTOS.Nature, notes: "Half-day nature excursion within 400 km radius" },
      { title: `Regional Heritage Citadel & Museum Excursion`, category: "Culture", cost: 2400, food: "Traditional Platter", distanceKm: 180, distanceLabel: `180 km from ${activeQuery}`, imageUrl: CATEGORY_PHOTOS.Culture, notes: "Full-day road trip within 400 km radius" }
    ];
  }

  if (preferences && preferences.trim() && !prefGeo) {
    const words = preferences.toLowerCase().split(/[\s,]+/).filter(Boolean);
    places.sort((a, b) => {
      const aMatch = words.some((w) => (a.title + " " + a.category + " " + a.notes).toLowerCase().includes(w)) ? 0 : 1;
      const bMatch = words.some((w) => (b.title + " " + b.category + " " + b.notes).toLowerCase().includes(w)) ? 0 : 1;
      return aMatch - bMatch || a.distanceKm - b.distanceKm;
    });
  }

  const temp = weatherData?.current_weather?.temperature;
  const weatherText = temp !== undefined ? `${temp}°C • Wind ${weatherData.current_weather.windspeed} km/h` : "Check forecast";
  const isIndia = targetCountry.toLowerCase() === "india";
  const currency = geo?.currency || (isIndia ? "INR (₹)" : "Local Currency");
  const dialCode = geo?.dialCode || (isIndia ? "+91" : "Check local");
  const topFoods = [...new Set(places.map((p) => p.food).filter(Boolean))].slice(0, 4).join(" • ");

  const resources = [
    {
      title: `1. Live Weather & Climate (${geo?.name || activeQuery})`,
      detail: `Current: ${weatherText}. Best explored between 6:30–10:00 AM and late afternoon for photography & outdoor walks.`
    },
    {
      title: `2. Currency, UPI & Forex (${currency})`,
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
const firstPlace = places.at(0);
const result = {
destination: (geo && geo.name) || activeQuery,
country: targetCountry,
heroImage: heroPhoto || (firstPlace && firstPlace.imageUrl) || CATEGORY_PHOTOS.Sightseeing,
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
const pool = discovery.nearbyPlaces;
const totalActivities = days * 2;
const budgetScale = budget > 0 ? Math.min(1.4, Math.max(0.65, budget / (totalActivities * 1500))) : 1;
const schedule = [];
for (let i = 0; i < totalActivities; i++) {
const place = pool[i % pool.length];
const dayNumber = Math.floor(i / 2) + 1;
schedule.push({
dayNumber,
title: place.title,
category: place.category,
estimatedCost: Math.round((place.cost * budgetScale) / 50) * 50,
notes: place.distanceLabel + " • " + place.notes,
imageUrl: place.imageUrl
});
}
return schedule;
}
module.exports = { discoverWithin400Km, generateGeoItinerary, getPlacePhoto };
