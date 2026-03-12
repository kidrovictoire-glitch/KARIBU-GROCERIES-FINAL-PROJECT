const express = require("express");

module.exports = function createSuppliersRoutes(deps) {
  const { auth, ensureBranchAccess, isAlphaNumMin2, isPhone, Supplier } = deps;
  const router = express.Router();

  router.get("/suppliers", auth(["manager", "director"]), async (req, res) => {
    const filter = req.user.role === "director" ? {} : { branch: req.user.branch };
    const rows = await Supplier.find(filter).sort({ createdAt: -1 });
    return res.json(
      rows.map((r) => ({
        id: String(r._id),
        sourceType: r.sourceType,
        entityName: r.entityName,
        location: r.location,
        produce: r.produce,
        contact: r.contact || "",
        branch: r.branch
      }))
    );
  });

  router.post("/suppliers", auth(["manager", "director"]), async (req, res) => {
    const { sourceType, entityName, location, produce, contact, branch } = req.body || {};
    if (!sourceType || !entityName || !location || !produce || !contact || !branch) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!ensureBranchAccess(req.user, branch)) return res.status(403).json({ message: "Forbidden branch" });
    if (!isAlphaNumMin2(entityName) || !isAlphaNumMin2(location) || !isAlphaNumMin2(produce)) {
      return res.status(400).json({ message: "Entity, location, and produce must be at least 2 alphanumeric characters." });
    }
    if (!isPhone(contact)) return res.status(400).json({ message: "Invalid supplier phone format." });

    const created = await Supplier.create({
      sourceType: String(sourceType).trim(),
      entityName: String(entityName).trim(),
      location: String(location).trim(),
      produce: String(produce).trim(),
      contact: String(contact).trim(),
      branch: String(branch).trim(),
      createdBy: req.user._id
    });

    return res.status(201).json({
      id: String(created._id),
      sourceType: created.sourceType,
      entityName: created.entityName,
      location: created.location,
      produce: created.produce,
      contact: created.contact || "",
      branch: created.branch
    });
  });

  router.delete("/suppliers/:id", auth(["manager", "director"]), async (req, res) => {
    const row = await Supplier.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Supplier not found." });
    if (!ensureBranchAccess(req.user, row.branch)) return res.status(403).json({ message: "Forbidden branch" });
    await Supplier.deleteOne({ _id: row._id });
    return res.json({ message: "Supplier deleted." });
  });

  return router;
};
