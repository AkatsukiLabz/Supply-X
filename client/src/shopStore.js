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

/* Seeded catalogue. products.shipsFrom must match an AREAS entry from
   auth.js so grouping matches everywhere else in the app. */
export const seedProducts = (AREAS) => {
  const a = (i) => AREAS[i % AREAS.length];
  return [
    {
      id: "p_bolts",
      name: "Hex Bolts (Grade 8.8)",
      category: "Fasteners",
      pack: "Box of 100",
      referenceCents: 45000,
      shipsFrom: a(0),
      variants: [
        { id: "v1", label: "M6 × 30mm", deltaCents: 0 },
        { id: "v2", label: "M8 × 40mm", deltaCents: 1200 },
        { id: "v3", label: "M10 × 60mm", deltaCents: 2800 },
      ],
    },
    {
      id: "p_helmets",
      name: "Safety Helmets",
      category: "PPE",
      pack: "Each",
      referenceCents: 18500,
      shipsFrom: a(1),
      variants: [
        { id: "v1", label: "Standard white", deltaCents: 0 },
        { id: "v2", label: "Vented yellow", deltaCents: 2500 },
      ],
    },
    {
      id: "p_pipe",
      name: "PVC Pipe 6m",
      category: "Plumbing",
      pack: "Length",
      referenceCents: 32000,
      shipsFrom: a(2),
      variants: [
        { id: "v1", label: "50mm", deltaCents: 0 },
        { id: "v2", label: "110mm", deltaCents: 14000 },
      ],
    },
    {
      id: "p_gloves",
      name: "Work Gloves",
      category: "PPE",
      pack: "Pair",
      referenceCents: 3800,
      shipsFrom: a(0),
      variants: [],
    },
  ];
};