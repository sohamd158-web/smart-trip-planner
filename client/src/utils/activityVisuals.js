const CATEGORY_IMAGES = {
  Food: [
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com"
  ],
  Heritage: [
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com"
  ],
  Nature: [
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com"
  ],
  Adventure: [
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com"
  ],
  Culture: [
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com"
  ],
  Wildlife: [
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com"
  ],
  Sightseeing: [
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com"
  ]
};

const CATEGORY_COLORS = {
  Food: ["#f59e0b", "#b45309"],
  Heritage: ["#8b5cf6", "#4c1d95"],
  Nature: ["#10b981", "#065f46"],
  Adventure: ["#ef4444", "#7f1d1d"],
  Culture: ["#ec4899", "#831843"],
  Wildlife: ["#84cc16", "#365314"],
  Sightseeing: ["#3b82f6", "#1e3a8a"]
};

function hashText(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getCategoryFallbackSvg(category = "Sightseeing", dayNumber = 1) {
  const key = Object.keys(CATEGORY_COLORS).find((k) => k.toLowerCase() === String(category).toLowerCase()) || "Sightseeing";
  const [c1, c2] = CATEGORY_COLORS[key];
  const svg = `<svg xmlns="http://w3.org" width="240" height="240" viewBox="0 0 240 240">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
    <rect width="240" height="240" rx="24" fill="url(#g)"/>
    <text x="120" y="112" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="bold">DAY ${dayNumber}</text>
    <text x="120" y="144" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="16" opacity="0.9">${key.toUpperCase()}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export function getActivityImage(act, itemIdx = 0) {
  const rawCat = String(act?.category || "Sightseeing");
  const matchedKey = Object.keys(CATEGORY_IMAGES).find((k) => k.toLowerCase() === rawCat.toLowerCase()) || "Sightseeing";
  const pool = CATEGORY_IMAGES[matchedKey];
  const uniqueSeed = hashText(`${act?.title || ""}-${act?.dayNumber || 1}-${itemIdx}`);
  return pool[uniqueSeed % pool.length];
}
