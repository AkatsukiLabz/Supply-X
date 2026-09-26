/* SupplyX local shop store: cart, wallet and pending orders per user.
   Works in demo mode with no backend. Swap for API calls later. */

const KEY = (userId) => `supplyx:shop:${userId}`;

const EMPTY = { cart: [], orders: [], balanceCents: 250000, txns: [] };

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

/* Flat delivered fee per area — one destination per order keeps the
   final price honest. Change to per-area later if logistics differ. */
export const DELIVERY_FEE_CENTS = 4500;

/* Fallback spaza catalogue for local demo/offline work. In connected mode,
   ShopsPage uses /api/products first so the storefront follows the database. */
export const seedProducts = (AREAS) => {
  const a = (i) => AREAS[i % AREAS.length];
  return [
    {
      id: "p_cooking_oil",
      name: "Cooking oil",
      category: "Groceries",
      pack: "6 x 750 ml case",
      referenceCents: 18000,
      shipsFrom: a(0),
      variants: [
        { id: "v1", label: "750 ml bottles", deltaCents: 0 },
        { id: "v2", label: "2 L bottles", deltaCents: 4200 },
      ],
    },
    {
      id: "p_maize_meal",
      name: "Maize meal",
      category: "Staples",
      pack: "10 kg bag",
      referenceCents: 12500,
      shipsFrom: a(1),
      variants: [
        { id: "v1", label: "10 kg bag", deltaCents: 0 },
        { id: "v2", label: "12.5 kg bag", deltaCents: 2500 },
      ],
    },
    {
      id: "p_sugar",
      name: "Sugar",
      category: "Staples",
      pack: "10 x 1 kg case",
      referenceCents: 21000,
      shipsFrom: a(2),
      variants: [
        { id: "v1", label: "1 kg bags", deltaCents: 0 },
        { id: "v2", label: "2 kg bags", deltaCents: 3200 },
      ],
    },
    {
      id: "p_rice",
      name: "Rice",
      category: "Staples",
      pack: "10 kg bag",
      referenceCents: 16500,
      shipsFrom: a(0),
      variants: [],
    },
  ];
};
