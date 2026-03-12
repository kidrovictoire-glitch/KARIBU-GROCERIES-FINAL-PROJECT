const express = require("express");

module.exports = function createProcurementRoutes(deps) {
  const { auth, PRODUCE, isProduceType, isAlphaNumMin2, ensureBranchAccess, isPhone, Procurement, upsertStock, Price } = deps;
  const router = express.Router();

  /**
   * @swagger
   * /api/procurements:
   *   post:
   *     tags: [Procurement]
   *     summary: Record procurement and update stock
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       201:
   *         description: Procurement recorded
   *       400:
   *         description: Validation error
   *       403:
   *         description: Forbidden branch
   */
  router.post("/procurements", auth(["manager"]), async (req, res) => {
    const { name, type, sourceType, date, time, tonnage, cost, sell, branch, dealer, contact } = req.body || {};
    if (!name || !type || !sourceType || !date || !time || !branch || !dealer || !contact) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!Object.prototype.hasOwnProperty.call(PRODUCE, name)) return res.status(400).json({ message: "Invalid produce name." });
    if (!isProduceType(type)) {
      return res.status(400).json({ message: "Invalid produce type." });
    }
    if (!isAlphaNumMin2(dealer)) return res.status(400).json({ message: "Dealer name must be at least 2 alphanumeric characters." });
    if (!ensureBranchAccess(req.user, branch)) return res.status(403).json({ message: "Forbidden branch" });
    if (!isPhone(contact)) return res.status(400).json({ message: "Invalid dealer phone format." });
    if (Number(tonnage) < 1000) return res.status(400).json({ message: "Tonnage must be at least 1000 Kgs." });
    if (Number(cost) < 10000 || Number(sell) < 100) return res.status(400).json({ message: "Invalid cost or selling price." });

    await Procurement.create({
      name,
      type,
      sourceType,
      date,
      time,
      tonnage: Number(tonnage),
      cost: Number(cost),
      sell: Number(sell),
      branch,
      dealer,
      contact,
      createdBy: req.user._id
    });
    await upsertStock(branch, name, Number(tonnage));
    await Price.findOneAndUpdate({ productName: name }, { productName: name, pricePerKg: Number(sell) }, { upsert: true });

    return res.status(201).json({ message: "Procurement recorded and stock updated." });
  });

  router.put("/procurements/:id", auth(["manager"]), async (req, res) => {
    const record = await Procurement.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Procurement record not found." });
    if (!ensureBranchAccess(req.user, record.branch)) return res.status(403).json({ message: "Forbidden branch" });

    const name = req.body && req.body.name ? req.body.name : record.name;
    const type = req.body && req.body.type ? req.body.type : record.type;
    const sourceType = req.body && req.body.sourceType ? req.body.sourceType : record.sourceType;
    const date = req.body && req.body.date ? req.body.date : record.date;
    const time = req.body && req.body.time ? req.body.time : record.time;
    const tonnage = req.body && req.body.tonnage !== undefined ? Number(req.body.tonnage) : Number(record.tonnage);
    const cost = req.body && req.body.cost !== undefined ? Number(req.body.cost) : Number(record.cost);
    const sell = req.body && req.body.sell !== undefined ? Number(req.body.sell) : Number(record.sell);
    const branch = req.body && req.body.branch ? req.body.branch : record.branch;
    const dealer = req.body && req.body.dealer ? String(req.body.dealer).trim() : record.dealer;
    const contact = req.body && req.body.contact ? String(req.body.contact).trim() : record.contact;

    if (!name || !type || !sourceType || !date || !time || !branch || !dealer || !contact) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!Object.prototype.hasOwnProperty.call(PRODUCE, name)) return res.status(400).json({ message: "Invalid produce name." });
    if (!isProduceType(type)) return res.status(400).json({ message: "Invalid produce type." });
    if (!isAlphaNumMin2(dealer)) return res.status(400).json({ message: "Dealer name must be at least 2 alphanumeric characters." });
    if (!ensureBranchAccess(req.user, branch)) return res.status(403).json({ message: "Forbidden branch" });
    if (!isPhone(contact)) return res.status(400).json({ message: "Invalid dealer phone format." });
    if (Number(tonnage) < 1000) return res.status(400).json({ message: "Tonnage must be at least 1000 Kgs." });
    if (Number(cost) < 10000 || Number(sell) < 100) return res.status(400).json({ message: "Invalid cost or selling price." });

    const canRollbackStock = await upsertStock(record.branch, record.name, -Number(record.tonnage));
    if (!canRollbackStock) {
      return res.status(400).json({ message: "Cannot edit this procurement because some of its stock has already been used." });
    }
    const updatedStock = await upsertStock(branch, name, Number(tonnage));
    if (!updatedStock) {
      await upsertStock(record.branch, record.name, Number(record.tonnage));
      return res.status(400).json({ message: "Failed to apply stock update for edited procurement." });
    }

    record.name = name;
    record.type = type;
    record.sourceType = sourceType;
    record.date = date;
    record.time = time;
    record.tonnage = Number(tonnage);
    record.cost = Number(cost);
    record.sell = Number(sell);
    record.branch = branch;
    record.dealer = dealer;
    record.contact = contact;
    await record.save();

    await Price.findOneAndUpdate({ productName: name }, { productName: name, pricePerKg: Number(sell) }, { upsert: true });
    return res.json({ message: "Procurement record updated." });
  });

  router.delete("/procurements/:id", auth(["manager", "director"]), async (req, res) => {
    const record = await Procurement.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Procurement record not found." });
    if (!ensureBranchAccess(req.user, record.branch)) return res.status(403).json({ message: "Forbidden branch" });

    const rolledBack = await upsertStock(record.branch, record.name, -Number(record.tonnage));
    await record.deleteOne();
    if (!rolledBack) {
      return res.json({ message: "Procurement record deleted. Stock remained unchanged because part of this intake had already been used." });
    }
    return res.json({ message: "Procurement record deleted." });
  });

  return router;
};
