const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
let swaggerUi = null;
try {
  swaggerUi = require("swagger-ui-express");
} catch (e) {
  swaggerUi = null;
}
const { createAuth } = require("./middleware/auth");
const { ensureBranchAccess } = require("./utils/access");
const { isPhone, isNin, isAlphaNumMin2, isProduceType } = require("./utils/validators");
const { createUpsertStock } = require("./services/stockService");
const { openApiSpec } = require("./docs/openapi");
const createProcurementRoutes = require("./routes/procurementRoutes");
const createSalesRoutes = require("./routes/salesRoutes");
const createUsersRoutes = require("./routes/usersRoutes");
const createRegisterRoutes = require("./routes/registerRoutes");
const createSuppliersRoutes = require("./routes/suppliersRoutes");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/kgl_db";
const IS_LOCAL_MONGO_URI = /^mongodb:\/\/(127\.0\.0\.1|localhost)/i.test(MONGODB_URI);

const BRANCHES = ["Maganjo", "Matugga"];
const PRODUCE = {
  Beans: "Legume",
  "Grain Maize": "Cereal Grain",
  "Cow Peas": "Legume",
  "G-nuts": "Oilseed/Legume",
  Soybeans: "Oilseed/Legume"
};

app.use(cors());
app.use(express.json());

if (swaggerUi) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, { explorer: true }));
  app.get("/api-docs.json", (req, res) => {
    res.json(openApiSpec);
  });
} else {
  console.warn("Swagger UI disabled: install 'swagger-ui-express' to enable /api-docs.");
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ["director", "manager", "agent"], required: true },
    branch: { type: String, enum: ["Maganjo", "Matugga", "All"], required: true },
    passwordHash: { type: String, required: true }
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    type: { type: String, required: true }
  },
  { timestamps: true }
);

const priceSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, unique: true },
    pricePerKg: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

const inventorySchema = new mongoose.Schema(
  {
    branch: { type: String, enum: BRANCHES, required: true },
    productName: { type: String, required: true },
    quantityKg: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);
inventorySchema.index({ branch: 1, productName: 1 }, { unique: true });

const procurementSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    sourceType: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    tonnage: { type: Number, required: true, min: 100 },
    cost: { type: Number, required: true, min: 10000 },
    sell: { type: Number, required: true, min: 100 },
    branch: { type: String, enum: BRANCHES, required: true },
    dealer: { type: String, required: true },
    contact: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

const saleSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["cash"], default: "cash" },
    produce: { type: String, required: true },
    produceType: { type: String, required: true },
    tonnage: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 10000 },
    buyer: { type: String, required: true },
    agent: { type: String, required: true },
    branch: { type: String, enum: BRANCHES, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    recordedByRole: { type: String, enum: ["manager", "agent"], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

const creditSchema = new mongoose.Schema(
  {
    buyer: { type: String, required: true },
    nin: { type: String, required: true },
    location: { type: String, required: true },
    contact: { type: String, required: true },
    amountDue: { type: Number, required: true, min: 10000 },
    dueDate: { type: String, required: true },
    produce: { type: String, required: true },
    type: { type: String, required: true },
    tonnage: { type: Number, required: true, min: 1 },
    agent: { type: String, required: true },
    branch: { type: String, enum: BRANCHES, required: true },
    dispatch: { type: String, required: true },
    recordedByRole: { type: String, enum: ["manager", "agent"], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

const supplierSchema = new mongoose.Schema(
  {
    sourceType: { type: String, required: true },
    entityName: { type: String, required: true },
    location: { type: String, required: true },
    produce: { type: String, required: true },
    contact: { type: String, default: "" },
    branch: { type: String, enum: BRANCHES, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

const accountChangeRequestSchema = new mongoose.Schema(
  {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    currentName: { type: String, required: true },
    currentRole: { type: String, enum: ["manager", "agent"], required: true },
    currentBranch: { type: String, enum: BRANCHES, required: true },
    requestedName: { type: String, default: "" },
    requestedPasswordHash: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Product = mongoose.model("Product", productSchema);
const Price = mongoose.model("Price", priceSchema);
const Inventory = mongoose.model("Inventory", inventorySchema);
const Procurement = mongoose.model("Procurement", procurementSchema);
const Sale = mongoose.model("Sale", saleSchema);
const Credit = mongoose.model("Credit", creditSchema);
const Supplier = mongoose.model("Supplier", supplierSchema);
const AccountChangeRequest = mongoose.model("AccountChangeRequest", accountChangeRequestSchema);

const auth = createAuth({ jwt, JWT_SECRET, User });
const upsertStock = createUpsertStock({ Inventory });

app.use(
  "/api",
  createUsersRoutes({
    auth,
    bcrypt,
    jwt,
    JWT_SECRET,
    BRANCHES,
    User,
    AccountChangeRequest
  })
);

app.use(
  createRegisterRoutes({
    bcrypt,
    jwt,
    JWT_SECRET,
    BRANCHES,
    User
  })
);

app.get("/api/products", auth(), async (req, res) => {
  const products = await Product.find({}, { _id: 0, name: 1, type: 1 }).sort({ name: 1 });
  res.json(products);
});

app.get("/api/prices", auth(), async (req, res) => {
  const rows = await Price.find({});
  const payload = {};
  rows.forEach((r) => {
    payload[r.productName] = Number(r.pricePerKg || 0);
  });
  res.json(payload);
});

app.put("/api/prices", auth(["manager"]), async (req, res) => {
  const entries = req.body && typeof req.body === "object" ? Object.entries(req.body) : [];
  for (const [productName, pricePerKg] of entries) {
    await Price.findOneAndUpdate(
      { productName },
      { productName, pricePerKg: Number(pricePerKg || 0) },
      { upsert: true, new: true }
    );
  }
  res.json({ message: "Prices saved" });
});

app.get("/api/inventory", auth(), async (req, res) => {
  const rows = await Inventory.find({});
  const data = { Maganjo: {}, Matugga: {} };
  Object.keys(PRODUCE).forEach((p) => {
    data.Maganjo[p] = 0;
    data.Matugga[p] = 0;
  });
  rows.forEach((r) => {
    data[r.branch][r.productName] = Number(r.quantityKg || 0);
  });
  if (req.user.role === "director") return res.json(data);
  return res.json({ [req.user.branch]: data[req.user.branch] });
});

app.use(
  "/api",
  createProcurementRoutes({
    auth,
    PRODUCE,
    isProduceType,
    isAlphaNumMin2,
    ensureBranchAccess,
    isPhone,
    Procurement,
    upsertStock,
    Price
  })
);

app.use(
  "/api",
  createSalesRoutes({
    auth,
    PRODUCE,
    isProduceType,
    isAlphaNumMin2,
    ensureBranchAccess,
    isNin,
    isPhone,
    upsertStock,
    Sale,
    Credit
  })
);

app.use(
  "/api",
  createSuppliersRoutes({
    auth,
    ensureBranchAccess,
    isAlphaNumMin2,
    isPhone,
    Supplier
  })
);

app.get("/api/director/aggregates", auth(["director"]), async (req, res) => {
  const sales = await Sale.find({});
  const credits = await Credit.find({});
  const prices = await Price.find({});
  const inventory = await Inventory.find({});

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const sumSales = (start) =>
    sales
      .filter((s) => {
        const d = new Date(s.date || s.createdAt);
        return !Number.isNaN(d.getTime()) && d >= start && d <= now;
      })
      .reduce((acc, s) => acc + Number(s.amount || 0), 0);

  const magRevenue = sales.filter((s) => s.branch === "Maganjo").reduce((a, s) => a + Number(s.amount || 0), 0);
  const matRevenue = sales.filter((s) => s.branch === "Matugga").reduce((a, s) => a + Number(s.amount || 0), 0);
  const magCredit = credits.filter((c) => c.branch === "Maganjo").reduce((a, c) => a + Number(c.amountDue || 0), 0);
  const matCredit = credits.filter((c) => c.branch === "Matugga").reduce((a, c) => a + Number(c.amountDue || 0), 0);

  const priceMap = {};
  prices.forEach((p) => {
    priceMap[p.productName] = Number(p.pricePerKg || 0);
  });

  let totalStockValue = 0;
  let lowStockItems = 0;
  let outStockItems = 0;
  let magStockValue = 0;
  let matStockValue = 0;
  let magUnits = 0;
  let matUnits = 0;
  let magLow = 0;
  let matLow = 0;

  for (const item of inventory) {
    const q = Number(item.quantityKg || 0);
    const val = q * Number(priceMap[item.productName] || 0);
    totalStockValue += val;
    if (q <= 0) outStockItems += 1;
    if (q > 0 && q < 500) lowStockItems += 1;
    if (item.branch === "Maganjo") {
      magStockValue += val;
      magUnits += q;
      if (q > 0 && q < 500) magLow += 1;
    } else {
      matStockValue += val;
      matUnits += q;
      if (q > 0 && q < 500) matLow += 1;
    }
  }

  res.json({
    dailySales: sumSales(dayStart),
    weeklySales: sumSales(weekStart),
    monthlySales: sumSales(monthStart),
    annualSales: sumSales(yearStart),
    magRevenue,
    matRevenue,
    magCredit,
    matCredit,
    totalStockValue,
    lowStockItems,
    outStockItems,
    trackedProducts: Object.keys(PRODUCE).length,
    magStockValue,
    matStockValue,
    magUnits,
    matUnits,
    magLow,
    matLow
  });
});

app.get("/api/state", auth(), async (req, res) => {
  const [pricesRows, inventoryRows, salesRows, creditRows, procurementRows, staffRows, supplierRows] = await Promise.all([
    Price.find({}),
    Inventory.find({}),
    Sale.find({}),
    Credit.find({}),
    Procurement.find({}),
    req.user.role === "director" ? User.find({}, { name: 1, role: 1, branch: 1 }) : Promise.resolve([]),
    Supplier.find({})
  ]);

  const prices = {};
  pricesRows.forEach((p) => {
    prices[p.productName] = Number(p.pricePerKg || 0);
  });

  const inventoryByBranch = { Maganjo: {}, Matugga: {} };
  Object.keys(PRODUCE).forEach((p) => {
    inventoryByBranch.Maganjo[p] = 0;
    inventoryByBranch.Matugga[p] = 0;
  });
  inventoryRows.forEach((i) => {
    inventoryByBranch[i.branch][i.productName] = Number(i.quantityKg || 0);
  });

  let sales = salesRows.map((s) => ({
    id: String(s._id),
    type: "cash",
    produce: s.produce,
    produceType: s.produceType,
    tonnage: s.tonnage,
    amount: s.amount,
    buyer: s.buyer,
    agent: s.agent,
    branch: s.branch,
    date: s.date,
    time: s.time,
    created: s.createdAt,
    recordedByRole: s.recordedByRole
  }));
  let credits = creditRows.map((c) => ({
    id: String(c._id),
    buyer: c.buyer,
    nin: c.nin,
    location: c.location,
    contact: c.contact,
    amountDue: c.amountDue,
    dueDate: c.dueDate,
    produce: c.produce,
    type: c.type,
    tonnage: c.tonnage,
    agent: c.agent,
    branch: c.branch,
    dispatch: c.dispatch,
    created: c.createdAt,
    recordedByRole: c.recordedByRole
  }));

  if (req.user.role !== "director") {
    sales = sales.filter((s) => s.branch === req.user.branch);
    credits = credits.filter((c) => c.branch === req.user.branch);
  }

  const procurements = procurementRows
    .filter((p) => req.user.role === "director" || p.branch === req.user.branch)
    .map((p) => ({
      id: String(p._id),
      name: p.name,
      type: p.type,
      sourceType: p.sourceType,
      date: p.date,
      time: p.time,
      tonnage: p.tonnage,
      cost: p.cost,
      sell: p.sell,
      branch: p.branch,
      dealer: p.dealer,
      contact: p.contact,
      created: p.createdAt
    }));

  const staff = staffRows.map((s) => ({
    id: String(s._id),
    name: s.name,
    role: s.role,
    branch: s.branch
  }));

  const suppliers = supplierRows
    .filter((s) => req.user.role === "director" || s.branch === req.user.branch)
    .map((s) => ({
      id: String(s._id),
      sourceType: s.sourceType,
      entityName: s.entityName,
      location: s.location,
      produce: s.produce,
      contact: s.contact || "",
      branch: s.branch
    }));

  res.json({ inventoryByBranch, prices, sales, credits, procurements, staff, suppliers });
});

const publicDir = path.join(__dirname, "public");
const NO_CACHE_HTML_PATHS = new Set(["/agent.html", "/manager.html", "/director.html", "/reports.html"]);

app.use((req, res, next) => {
  if (NO_CACHE_HTML_PATHS.has(req.path) || req.path.startsWith("/api/")) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");
  }
  next();
});

if (require("fs").existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

async function seedDefaults() {
  for (const [name, type] of Object.entries(PRODUCE)) {
    await Product.findOneAndUpdate({ name }, { name, type }, { upsert: true });
  }

  const defaultPrices = {
    Beans: 3500,
    "Grain Maize": 1200,
    "Cow Peas": 2800,
    "G-nuts": 4200,
    Soybeans: 3100
  };
  for (const [productName, pricePerKg] of Object.entries(defaultPrices)) {
    await Price.findOneAndUpdate({ productName }, { productName, pricePerKg }, { upsert: true });
  }

  for (const branch of BRANCHES) {
    for (const productName of Object.keys(PRODUCE)) {
      await Inventory.findOneAndUpdate(
        { branch, productName },
        { $setOnInsert: { branch, productName, quantityKg: 0 } },
        { upsert: true }
      );
    }
  }

  const defaults = [
    { name: "Orban", role: "director", branch: "All", password: "orban123" },
    { name: "Branch Manager", role: "manager", branch: "Maganjo", password: "manager123" },
    { name: "Branch Manager 2", role: "manager", branch: "Matugga", password: "manager123" },
    { name: "Agent Maganjo", role: "agent", branch: "Maganjo", password: "agent123" },
    { name: "Agent Matugga", role: "agent", branch: "Matugga", password: "agent123" }
  ];

  for (const u of defaults) {
    const found = await User.findOne({ name: u.name });
    if (!found) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      await User.create({ name: u.name, role: u.role, branch: u.branch, passwordHash });
    } else if (!found.passwordHash) {
      found.passwordHash = await bcrypt.hash(u.password, 10);
      await found.save();
    }
  }

  const defaultSuppliers = [
    { sourceType: "Internal Farm", entityName: "Maganjo Farm", location: "Maganjo", produce: "Beans, Grain Maize, Cow Peas, G-nuts, Soybeans", contact: "0700000001", branch: "Maganjo", createdByName: "Branch Manager" },
    { sourceType: "Internal Farm", entityName: "Matugga Farm", location: "Matugga", produce: "Beans, Grain Maize, Cow Peas, G-nuts, Soybeans", contact: "0700000002", branch: "Matugga", createdByName: "Branch Manager 2" },
    { sourceType: "Company Supplier", entityName: "Uganda Grain Traders", location: "Regional", produce: "Grain Maize, Soybeans", contact: "0700000003", branch: "Maganjo", createdByName: "Branch Manager" }
  ];

  for (const s of defaultSuppliers) {
    const found = await Supplier.findOne({ entityName: s.entityName, branch: s.branch });
    if (found) continue;
    const creator = await User.findOne({ name: s.createdByName });
    if (!creator) continue;
    await Supplier.create({
      sourceType: s.sourceType,
      entityName: s.entityName,
      location: s.location,
      produce: s.produce,
      contact: s.contact,
      branch: s.branch,
      createdBy: creator._id
    });
  }
}

async function cleanupLegacyUserIndexes() {
  try {
    const userCollection = mongoose.connection.collection("users");
    const indexes = await userCollection.indexes();
    const legacyEmailIndex = indexes.find((idx) => idx.name === "email_1");
    if (!legacyEmailIndex) return;
    await userCollection.dropIndex("email_1");
    console.log("Dropped legacy users.email_1 index.");
  } catch (err) {
    if (err && (err.codeName === "NamespaceNotFound" || err.code === 26)) {
      return;
    }
    throw err;
  }
}

async function cleanupPlainPasswords() {
  const result = await User.updateMany({ passwordPlain: { $exists: true } }, { $unset: { passwordPlain: "" } });
  if (result.modifiedCount > 0) {
    //console.log(`Removed passwordPlain from ${result.modifiedCount} users.`);
  }
}

async function start() {
  const isProd = process.env.NODE_ENV === "production";
  const shouldSeed =
    process.env.SEED_DEFAULTS === "true" ||
    (!isProd && process.env.SEED_DEFAULTS !== "false");

  if (isProd && !process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET in production. Set it in your environment variables.");
  }

  if (isProd && (!MONGODB_URI || IS_LOCAL_MONGO_URI)) {
    throw new Error("Invalid production MONGODB_URI: localhost is not reachable on Render. Set a hosted MongoDB URI in environment variables.");
  }

  await mongoose.connect(MONGODB_URI);
  await cleanupLegacyUserIndexes();
  await cleanupPlainPasswords();
  if (shouldSeed) {
    await seedDefaults();
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`KGL server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
