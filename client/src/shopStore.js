/* SupplyX local shop store: cart + orders (bank-paid) per user.
   Works in demo mode with no backend. Swap for API calls later. */

const KEY = (userId) => `supplyx:shop:${userId}`;

const EMPTY = {
  cart: [],
  orders: [],       // status: "pending_payment" | "paid" | "approved" | "cancelled" | "fulfilled"
  txns: [],         // payment receipts
};

export const loadShop = (userId) => {
  try {
    const raw = localStorage.getItem(KEY(userId));
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    /* corrupted storage — fall through to defaults */
  }
  return { ...EMPTY };
};

export const saveShop = (userId, state) =>
  localStorage.setItem(KEY(userId), JSON.stringify(state));

export const uid = () => Math.random().toString(36).slice(2, 10);

export const DELIVERY_FEE_CENTS = 4500;

/* The 4 most commonly bought products, shown by default.
   Everything else appears when the shop types into the search box. */
export const POPULAR_IDS = [
  "p_maize",
  "p_rice",
  "p_sugar",
  "p_oil",
];

export const seedProducts = (AREAS) => {
  const a = (i) => AREAS[i % AREAS.length];
  return [
    // ===== Staples =====
    { id: "p_maize", name: "Maize meal", pack: "10 kg", referenceCents: 9500, shipsFrom: a(0),
      variants: [
        { id: "v1", label: "Super fine", deltaCents: 0 },
        { id: "v2", label: "Standard", deltaCents: -500 },
      ] },
    { id: "p_rice", name: "Rice", pack: "10 kg", referenceCents: 18500, shipsFrom: a(0),
      variants: [
        { id: "v1", label: "Long grain", deltaCents: 0 },
        { id: "v2", label: "Parboiled", deltaCents: 1500 },
      ] },
    { id: "p_sugar", name: "Sugar", pack: "10 kg", referenceCents: 15500, shipsFrom: a(0), variants: [] },
    { id: "p_flour", name: "Flour", pack: "10 kg", referenceCents: 12500, shipsFrom: a(0),
      variants: [
        { id: "v1", label: "Cake flour", deltaCents: 0 },
        { id: "v2", label: "Bread flour", deltaCents: 800 },
      ] },
    { id: "p_oil", name: "Cooking oil", pack: "5 L", referenceCents: 13500, shipsFrom: a(0),
      variants: [
        { id: "v1", label: "Sunflower", deltaCents: 0 },
        { id: "v2", label: "Canola", deltaCents: 1200 },
      ] },
    { id: "p_salt", name: "Salt", pack: "1 kg", referenceCents: 1200, shipsFrom: a(1), variants: [] },
    { id: "p_pasta", name: "Pasta", pack: "500 g", referenceCents: 1800, shipsFrom: a(1),
      variants: [
        { id: "v1", label: "Macaroni", deltaCents: 0 },
        { id: "v2", label: "Fusilli", deltaCents: 0 },
      ] },
    { id: "p_spaghetti", name: "Spaghetti", pack: "500 g", referenceCents: 1700, shipsFrom: a(1), variants: [] },
    { id: "p_noodles", name: "Instant noodles", pack: "Pack of 12", referenceCents: 8400, shipsFrom: a(1),
      variants: [
        { id: "v1", label: "Beef", deltaCents: 0 },
        { id: "v2", label: "Chicken", deltaCents: 0 },
        { id: "v3", label: "Mixed", deltaCents: 300 },
      ] },
    { id: "p_samp", name: "Samp", pack: "5 kg", referenceCents: 6500, shipsFrom: a(1), variants: [] },
    { id: "p_beans", name: "Beans", pack: "2 kg", referenceCents: 4500, shipsFrom: a(1),
      variants: [
        { id: "v1", label: "Dried", deltaCents: 0 },
        { id: "v2", label: "Sugar beans", deltaCents: 500 },
      ] },
    { id: "p_lentils", name: "Lentils", pack: "2 kg", referenceCents: 5200, shipsFrom: a(1), variants: [] },

    // ===== Canned & pantry =====
    { id: "p_canfish", name: "Canned fish", pack: "Pack of 12", referenceCents: 18500, shipsFrom: a(2),
      variants: [
        { id: "v1", label: "Tuna", deltaCents: 0 },
        { id: "v2", label: "Pilchards", deltaCents: -1000 },
      ] },
    { id: "p_canbeans", name: "Canned baked beans", pack: "Pack of 12", referenceCents: 12500, shipsFrom: a(2), variants: [] },
    { id: "p_canveg", name: "Canned mixed vegetables", pack: "Pack of 12", referenceCents: 11500, shipsFrom: a(2), variants: [] },
    { id: "p_pilchards", name: "Canned pilchards", pack: "Pack of 12", referenceCents: 16500, shipsFrom: a(2), variants: [] },
    { id: "p_soup", name: "Soup packets", pack: "Pack of 10", referenceCents: 6500, shipsFrom: a(2),
      variants: [
        { id: "v1", label: "Brown onion", deltaCents: 0 },
        { id: "v2", label: "Chicken noodle", deltaCents: 0 },
        { id: "v3", label: "Vegetable", deltaCents: 0 },
      ] },
    { id: "p_stock", name: "Stock cubes", pack: "Pack of 24", referenceCents: 4200, shipsFrom: a(2),
      variants: [
        { id: "v1", label: "Beef", deltaCents: 0 },
        { id: "v2", label: "Chicken", deltaCents: 0 },
      ] },

    // ===== Spreads & breakfast =====
    { id: "p_peanut", name: "Peanut butter", pack: "400 g", referenceCents: 4200, shipsFrom: a(3),
      variants: [
        { id: "v1", label: "Smooth", deltaCents: 0 },
        { id: "v2", label: "Crunchy", deltaCents: 0 },
      ] },
    { id: "p_jam", name: "Jam", pack: "450 g", referenceCents: 3200, shipsFrom: a(3),
      variants: [
        { id: "v1", label: "Strawberry", deltaCents: 0 },
        { id: "v2", label: "Apricot", deltaCents: 0 },
      ] },
    { id: "p_tea", name: "Tea bags", pack: "100 bags", referenceCents: 6500, shipsFrom: a(3),
      variants: [
        { id: "v1", label: "Rooibos", deltaCents: 0 },
        { id: "v2", label: "Black", deltaCents: 0 },
      ] },
    { id: "p_coffee", name: "Coffee", pack: "250 g", referenceCents: 8500, shipsFrom: a(3),
      variants: [
        { id: "v1", label: "Instant", deltaCents: 0 },
        { id: "v2", label: "Ground", deltaCents: 1200 },
      ] },
    { id: "p_powdmilk", name: "Powdered milk", pack: "500 g", referenceCents: 6800, shipsFrom: a(3), variants: [] },
    { id: "p_uhtmilk", name: "Long-life / UHT milk", pack: "Pack of 6 × 1 L", referenceCents: 10500, shipsFrom: a(3),
      variants: [
        { id: "v1", label: "Full cream", deltaCents: 0 },
        { id: "v2", label: "Low fat", deltaCents: 0 },
      ] },
    { id: "p_cremora", name: "Cremora / coffee creamer", pack: "750 g", referenceCents: 5500, shipsFrom: a(3), variants: [] },
    { id: "p_cereal", name: "Cereal", pack: "500 g", referenceCents: 5900, shipsFrom: a(3),
      variants: [
        { id: "v1", label: "Corn flakes", deltaCents: 0 },
        { id: "v2", label: "Bran flakes", deltaCents: 500 },
      ] },
    { id: "p_oats", name: "Oats", pack: "1 kg", referenceCents: 4500, shipsFrom: a(3), variants: [] },

    // ===== Snacks & sweets =====
    { id: "p_biscuits", name: "Biscuits", pack: "Pack of 12", referenceCents: 8500, shipsFrom: a(4), variants: [] },
    { id: "p_chips", name: "Chips / snacks", pack: "Box of 24", referenceCents: 12000, shipsFrom: a(4), variants: [] },
    { id: "p_sweets", name: "Sweets", pack: "Box of 50", referenceCents: 9500, shipsFrom: a(4), variants: [] },
    { id: "p_choc", name: "Chocolates", pack: "Box of 24", referenceCents: 15000, shipsFrom: a(4), variants: [] },
    { id: "p_lolli", name: "Lollipops", pack: "Jar of 100", referenceCents: 7800, shipsFrom: a(4), variants: [] },
    { id: "p_gum", name: "Chewing gum", pack: "Box of 20", referenceCents: 5500, shipsFrom: a(4), variants: [] },

    // ===== Drinks =====
    { id: "p_soft", name: "Soft drinks", pack: "Case of 24 × 440 ml", referenceCents: 17500, shipsFrom: a(5),
      variants: [
        { id: "v1", label: "Cola", deltaCents: 0 },
        { id: "v2", label: "Lemonade", deltaCents: 0 },
        { id: "v3", label: "Orange", deltaCents: 0 },
      ] },
    { id: "p_energy", name: "Energy drinks", pack: "Case of 24 × 250 ml", referenceCents: 21000, shipsFrom: a(5), variants: [] },
    { id: "p_water", name: "Bottled water", pack: "Case of 24 × 500 ml", referenceCents: 8500, shipsFrom: a(5), variants: [] },
    { id: "p_juice", name: "Juice concentrate", pack: "2 L", referenceCents: 6500, shipsFrom: a(5),
      variants: [
        { id: "v1", label: "Orange", deltaCents: 0 },
        { id: "v2", label: "Mango", deltaCents: 0 },
        { id: "v3", label: "Mixed fruit", deltaCents: 0 },
      ] },

    // ===== Airtime / utilities / tobacco =====
    { id: "p_airtime", name: "Airtime vouchers", pack: "Batch of 20 × R10", referenceCents: 20000, shipsFrom: a(6),
      variants: [
        { id: "v1", label: "Vodacom", deltaCents: 0 },
        { id: "v2", label: "MTN", deltaCents: 0 },
        { id: "v3", label: "Telkom", deltaCents: 0 },
        { id: "v4", label: "Cell C", deltaCents: 0 },
      ] },
    { id: "p_electric", name: "Electricity tokens", pack: "Batch of R500", referenceCents: 50000, shipsFrom: a(6), variants: [] },
    { id: "p_cigs", name: "Cigarettes", pack: "Carton of 10 packs", referenceCents: 35000, shipsFrom: a(6),
      variants: [
        { id: "v1", label: "Regular", deltaCents: 0 },
        { id: "v2", label: "Light", deltaCents: 0 },
      ] },
    { id: "p_matches", name: "Matches", pack: "Box of 10", referenceCents: 2200, shipsFrom: a(6), variants: [] },
    { id: "p_candles", name: "Candles", pack: "Pack of 6", referenceCents: 3800, shipsFrom: a(6), variants: [] },

    // ===== Household & personal care =====
    { id: "p_tp", name: "Toilet paper", pack: "Pack of 10 rolls", referenceCents: 8500, shipsFrom: a(7),
      variants: [
        { id: "v1", label: "2-ply", deltaCents: 0 },
        { id: "v2", label: "3-ply", deltaCents: 1500 },
      ] },
    { id: "p_pads", name: "Sanitary pads", pack: "Pack of 10", referenceCents: 4500, shipsFrom: a(7),
      variants: [
        { id: "v1", label: "Regular", deltaCents: 0 },
        { id: "v2", label: "Night", deltaCents: 500 },
      ] },
    { id: "p_soap", name: "Soap bars", pack: "Pack of 12", referenceCents: 7200, shipsFrom: a(7),
      variants: [
        { id: "v1", label: "Bath", deltaCents: 0 },
        { id: "v2", label: "Laundry", deltaCents: -500 },
      ] },
    { id: "p_wash", name: "Washing powder", pack: "2 kg", referenceCents: 6800, shipsFrom: a(7), variants: [] },
    { id: "p_dish", name: "Dishwashing liquid", pack: "750 ml", referenceCents: 3200, shipsFrom: a(7), variants: [] },
    { id: "p_tooth", name: "Toothpaste", pack: "100 ml", referenceCents: 2400, shipsFrom: a(7), variants: [] },
    { id: "p_lotion", name: "Body lotion", pack: "400 ml", referenceCents: 5200, shipsFrom: a(7), variants: [] },
    { id: "p_deo", name: "Deodorant / roll-on", pack: "50 ml", referenceCents: 2900, shipsFrom: a(7),
      variants: [
        { id: "v1", label: "Men", deltaCents: 0 },
        { id: "v2", label: "Women", deltaCents: 0 },
      ] },
  ];
};