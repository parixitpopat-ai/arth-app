// src/domain/invoices/brands.js — splits a printed item name into BRAND + PRODUCT so the expense can show the plain product ("Magic Masala Chips") while the brand is
// remembered in the background (for comparing brands later). Pure.
//
// The invoice has no brand field, so this is a best-effort reading of the START of the name:
//   1. what the person told Arth about this barcode (UPC) last time wins, even if they said "no brand";
//   2. else a STARTER list of common brands below (UNVERIFIED and not exhaustive; corrections made in the review screen are remembered by barcode);
//   3. else no brand is assumed and the full name is kept. Nothing is ever dropped when it is not recognised.
// The full printed name is always kept in the background record, so nothing is lost.

// Longest first matters ("Haldiram's Nagpur" must win over "Haldiram's"); the lookup sorts by length, so order here is free.
export const STARTER_BRANDS = [
  "Haldiram's Nagpur", "Haldiram's", "Haldirams", "Bikano", "Bikaji", "Balaji", "Lay's", "Kurkure", "Uncle Chipps", "Bingo!", "Bingo", "Doritos", "Pringles", "4700BC", "Act II", "Too Yumm",
  "Amul", "Mother Dairy", "Nandini", "Milky Mist", "Epigamia", "Heritage", "Aashirvaad", "Pillsbury", "Annapurna", "Tata Sampann", "Tata Salt", "Tata Tea", "Tata", "Fortune", "Saffola", "Dhara",
  "Patanjali", "Daawat", "India Gate", "Maggi", "Yippee", "Top Ramen", "Knorr", "Kissan", "Del Monte", "Kellogg's", "Quaker", "Bournvita", "Horlicks", "Boost", "Complan", "Nestle", "Nescafe", "Bru",
  "Red Label", "Taj Mahal", "Brooke Bond", "Wagh Bakri", "Society", "Lipton", "Britannia", "Parle-G", "Parle", "Sunfeast", "Good Day", "Oreo", "Cadbury", "Kit Kat", "5 Star", "Munch", "Perk", "Ferrero",
  "Dettol", "Surf Excel", "Ariel", "Tide", "Rin", "Wheel", "Vim", "Harpic", "Lizol", "Colin", "Domex", "Comfort", "Vanish", "Odonil", "Good Knight", "Hit", "All Out", "Mortein",
  "Colgate", "Pepsodent", "Closeup", "Sensodyne", "Dabur", "Himalaya", "Dove", "Lux", "Lifebuoy", "Pears", "Santoor", "Medimix", "Cinthol", "Fiama", "Head & Shoulders", "Clinic Plus", "Sunsilk", "Pantene",
  "Tresemme", "Garnier", "Nivea", "Vaseline", "Parachute", "Whisper", "Stayfree", "Pampers", "Huggies", "Gillette", "Park Avenue", "Axe",
  "Real", "Tropicana", "Paper Boat", "B Natural", "Coca-Cola", "Coca Cola", "Pepsi", "Sprite", "Thums Up", "Limca", "Fanta", "Maaza", "Frooti", "Slice", "Red Bull", "Bisleri", "Kinley", "Aquafina",
  "MDH", "Everest", "Catch", "Badshah", "Aachi", "Ching's Secret", "Kissan", "Sakthi", "Rajdhani", "24 Mantra", "Organic India", "Borges", "Figaro", "Sundrop", "Gemini", "Freedom",
];

const norm = s => String(s == null ? "" : s).replace(/[‘’ʼ`]/g, "'").replace(/\s+/g, " ").trim();
const PACK_WORDS = "pack|packet|bag|pouch|box|bottle|can|jar|tub|tin|carton|sachet|tetra pack|btl|pet bottle|combo";
const TRAILING_PACK = new RegExp(`\\s*\\((?:${PACK_WORDS})\\)\\s*$`, "i");

const sorted = list => [...new Set(list)].sort((a, b) => b.length - a.length);
const STARTER_SORTED = sorted(STARTER_BRANDS);

/** The size printed in the name ("1 L", "500 g", "200 ml", "5 kg"), or null. Kept for per-unit price comparison; not removed from the name. */
export function sizeOf(name) {
  const m = /(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|l|ltr|litre|liter|ml|pcs|pc|nos|n)\b/i.exec(norm(name));
  return m ? `${m[1]} ${m[2].toLowerCase().replace(/^(gm|gms)$/, "g").replace(/^(ltr|litre|liter)$/, "l")}` : null;
}

/** Remove a trailing generic pack word "(Pack)", "(Bag)"… from a product name. Other brackets such as "(0% Maida)" stay. */
export function cleanProduct(s) {
  let p = norm(s);
  for (let i = 0; i < 3 && TRAILING_PACK.test(p); i++) p = p.replace(TRAILING_PACK, "");
  return p.replace(/^[\s\-–—,:;.]+|[\s\-–—,:;]+$/g, "").trim();
}

/**
 * @param {string} name the printed item name
 * @param {{upc?:string, remembered?:Array<{upc:string, brand:string|null, product:string}>, extraBrands?:string[]}} [opts]
 * @returns {{brand:string|null, product:string, full:string, source:"remembered"|"starter-list"|"none"}}
 */
export function splitBrand(name, { upc = null, remembered = [], extraBrands = [] } = {}) {
  const full = norm(name);
  const mem = upc ? (remembered || []).find(r => r && String(r.upc) === String(upc)) : null;
  if (mem) return { brand: mem.brand || null, product: mem.product || cleanProduct(full), full, source: "remembered" };
  const lower = full.toLowerCase();
  for (const b of [...sorted(extraBrands), ...STARTER_SORTED]) {
    const bl = norm(b).toLowerCase();
    if (!bl || !lower.startsWith(bl)) continue;
    const next = full.charAt(bl.length);
    if (next && /[a-z0-9]/i.test(next)) continue;                    // "Amulya" must not match "Amul"
    const product = cleanProduct(full.slice(bl.length));
    if (product.length < 2) return { brand: null, product: cleanProduct(full), full, source: "none" };   // nothing left to show: keep the full name
    return { brand: full.slice(0, bl.length), product, full, source: "starter-list" };
  }
  return { brand: null, product: cleanProduct(full), full, source: "none" };
}
