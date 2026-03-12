const express = require("express");

module.exports = function createSalesRoutes(deps) {
  const { auth, PRODUCE, isProduceType, isAlphaNumMin2, ensureBranchAccess, isNin, isPhone, upsertStock, Sale, Credit } = deps;
  const router = express.Router();

  function canEditOwnedRecord(reqUser, record) {
    if (reqUser.role === "director") return true;
    if (reqUser.role === "manager") return true;
    return String(record.createdBy) === String(reqUser._id);
  }

  /**
   * @swagger
   * /api/sales/cash:
   *   post:
   *     tags: [Sales]
   *     summary: Record cash sale
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
   *         description: Cash sale recorded
   *       400:
   *         description: Validation error
   */
  router.post("/sales/cash", auth(["manager", "agent"]), async (req, res) => {
    const { branch, produce, produceType, tonnage, amount, buyer, agent, date, time } = req.body || {};
    if (!branch || !produce || !produceType || !buyer || !agent || !date || !time) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!Object.prototype.hasOwnProperty.call(PRODUCE, produce)) return res.status(400).json({ message: "Invalid produce name." });
    if (!isProduceType(produceType)) {
      return res.status(400).json({ message: "Invalid produce type." });
    }
    if (!isAlphaNumMin2(buyer) || !isAlphaNumMin2(agent)) {
      return res.status(400).json({ message: "Buyer and agent names must be at least 2 alphanumeric characters." });
    }
    if (Number(amount) < 10000) return res.status(400).json({ message: "Amount paid must be at least 10000 UgX." });
    if (!ensureBranchAccess(req.user, branch)) return res.status(403).json({ message: "Forbidden branch" });

    const updated = await upsertStock(branch, produce, -Number(tonnage));
    if (!updated) return res.status(400).json({ message: "Only available stock can be sold. Sale blocked." });

    await Sale.create({
      type: "cash",
      produce,
      produceType,
      tonnage: Number(tonnage),
      amount: Number(amount),
      buyer,
      agent,
      branch,
      date,
      time,
      recordedByRole: req.user.role,
      createdBy: req.user._id
    });
    return res.status(201).json({ message: "Cash sale recorded and stock reduced." });
  });

  /**
   * @swagger
   * /api/sales/credit:
   *   post:
   *     tags: [Sales]
   *     summary: Record credit sale
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
   *         description: Credit sale recorded
   *       400:
   *         description: Validation error
   */
  router.post("/sales/credit", auth(["manager", "agent"]), async (req, res) => {
    const { buyer, nin, location, contact, amountDue, dueDate, produce, type, tonnage, agent, branch, dispatch } = req.body || {};
    if (!buyer || !nin || !location || !contact || !dueDate || !produce || !type || !agent || !branch || !dispatch) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!Object.prototype.hasOwnProperty.call(PRODUCE, produce)) return res.status(400).json({ message: "Invalid produce name." });
    if (!isProduceType(type)) {
      return res.status(400).json({ message: "Invalid produce type." });
    }
    if (!isAlphaNumMin2(buyer) || !isAlphaNumMin2(location) || !isAlphaNumMin2(agent)) {
      return res.status(400).json({ message: "Buyer, location, and agent must be at least 2 alphanumeric characters." });
    }
    if (Number(amountDue) < 10000) return res.status(400).json({ message: "Amount due must be at least 10000 UgX." });
    if (!ensureBranchAccess(req.user, branch)) return res.status(403).json({ message: "Forbidden branch" });
    if (!isNin(nin)) return res.status(400).json({ message: "Invalid NIN format." });
    if (!isPhone(contact)) return res.status(400).json({ message: "Invalid phone format." });

    const updated = await upsertStock(branch, produce, -Number(tonnage));
    if (!updated) return res.status(400).json({ message: "Insufficient stock for dispatch." });

    await Credit.create({
      buyer,
      nin,
      location,
      contact,
      amountDue: Number(amountDue),
      dueDate,
      produce,
      type,
      tonnage: Number(tonnage),
      agent,
      branch,
      dispatch,
      recordedByRole: req.user.role,
      createdBy: req.user._id
    });
    return res.status(201).json({ message: "Credit sale logged and stock reduced." });
  });

  router.put("/sales/cash/:id", auth(["manager", "agent"]), async (req, res) => {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Cash sale record not found." });
    if (!ensureBranchAccess(req.user, sale.branch)) return res.status(403).json({ message: "Forbidden branch" });
    if (!canEditOwnedRecord(req.user, sale)) return res.status(403).json({ message: "You can only edit your own sales records." });

    const branch = req.body && req.body.branch ? req.body.branch : sale.branch;
    const produce = req.body && req.body.produce ? req.body.produce : sale.produce;
    const produceType = req.body && req.body.produceType ? req.body.produceType : sale.produceType;
    const tonnage = req.body && req.body.tonnage !== undefined ? Number(req.body.tonnage) : Number(sale.tonnage);
    const amount = req.body && req.body.amount !== undefined ? Number(req.body.amount) : Number(sale.amount);
    const buyer = req.body && req.body.buyer ? String(req.body.buyer).trim() : sale.buyer;
    const agent = req.body && req.body.agent ? String(req.body.agent).trim() : sale.agent;
    const date = req.body && req.body.date ? req.body.date : sale.date;
    const time = req.body && req.body.time ? req.body.time : sale.time;

    if (!branch || !produce || !produceType || !buyer || !agent || !date || !time) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!Object.prototype.hasOwnProperty.call(PRODUCE, produce)) return res.status(400).json({ message: "Invalid produce name." });
    if (!isProduceType(produceType)) return res.status(400).json({ message: "Invalid produce type." });
    if (!isAlphaNumMin2(buyer) || !isAlphaNumMin2(agent)) {
      return res.status(400).json({ message: "Buyer and agent names must be at least 2 alphanumeric characters." });
    }
    if (amount < 10000) return res.status(400).json({ message: "Amount paid must be at least 10000 UgX." });
    if (!ensureBranchAccess(req.user, branch)) return res.status(403).json({ message: "Forbidden branch" });

    await upsertStock(sale.branch, sale.produce, Number(sale.tonnage));
    const updated = await upsertStock(branch, produce, -Number(tonnage));
    if (!updated) {
      await upsertStock(sale.branch, sale.produce, -Number(sale.tonnage));
      return res.status(400).json({ message: "Insufficient stock for updated cash sale." });
    }

    sale.branch = branch;
    sale.produce = produce;
    sale.produceType = produceType;
    sale.tonnage = Number(tonnage);
    sale.amount = Number(amount);
    sale.buyer = buyer;
    sale.agent = agent;
    sale.date = date;
    sale.time = time;
    await sale.save();

    return res.json({ message: "Cash sale record updated." });
  });

  router.put("/sales/credit/:id", auth(["manager", "agent"]), async (req, res) => {
    const credit = await Credit.findById(req.params.id);
    if (!credit) return res.status(404).json({ message: "Credit sale record not found." });
    if (!ensureBranchAccess(req.user, credit.branch)) return res.status(403).json({ message: "Forbidden branch" });
    if (!canEditOwnedRecord(req.user, credit)) return res.status(403).json({ message: "You can only edit your own credit records." });

    const buyer = req.body && req.body.buyer ? String(req.body.buyer).trim() : credit.buyer;
    const nin = req.body && req.body.nin ? String(req.body.nin).trim() : credit.nin;
    const location = req.body && req.body.location ? String(req.body.location).trim() : credit.location;
    const contact = req.body && req.body.contact ? String(req.body.contact).trim() : credit.contact;
    const amountDue = req.body && req.body.amountDue !== undefined ? Number(req.body.amountDue) : Number(credit.amountDue);
    const dueDate = req.body && req.body.dueDate ? req.body.dueDate : credit.dueDate;
    const produce = req.body && req.body.produce ? req.body.produce : credit.produce;
    const type = req.body && req.body.type ? req.body.type : credit.type;
    const tonnage = req.body && req.body.tonnage !== undefined ? Number(req.body.tonnage) : Number(credit.tonnage);
    const agent = req.body && req.body.agent ? String(req.body.agent).trim() : credit.agent;
    const branch = req.body && req.body.branch ? req.body.branch : credit.branch;
    const dispatch = req.body && req.body.dispatch ? req.body.dispatch : credit.dispatch;

    if (!buyer || !nin || !location || !contact || !dueDate || !produce || !type || !agent || !branch || !dispatch) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!Object.prototype.hasOwnProperty.call(PRODUCE, produce)) return res.status(400).json({ message: "Invalid produce name." });
    if (!isProduceType(type)) return res.status(400).json({ message: "Invalid produce type." });
    if (!isAlphaNumMin2(buyer) || !isAlphaNumMin2(location) || !isAlphaNumMin2(agent)) {
      return res.status(400).json({ message: "Buyer, location, and agent must be at least 2 alphanumeric characters." });
    }
    if (amountDue < 10000) return res.status(400).json({ message: "Amount due must be at least 10000 UgX." });
    if (!ensureBranchAccess(req.user, branch)) return res.status(403).json({ message: "Forbidden branch" });
    if (!isNin(nin)) return res.status(400).json({ message: "Invalid NIN format." });
    if (!isPhone(contact)) return res.status(400).json({ message: "Invalid phone format." });

    await upsertStock(credit.branch, credit.produce, Number(credit.tonnage));
    const updated = await upsertStock(branch, produce, -Number(tonnage));
    if (!updated) {
      await upsertStock(credit.branch, credit.produce, -Number(credit.tonnage));
      return res.status(400).json({ message: "Insufficient stock for updated credit sale." });
    }

    credit.buyer = buyer;
    credit.nin = nin;
    credit.location = location;
    credit.contact = contact;
    credit.amountDue = Number(amountDue);
    credit.dueDate = dueDate;
    credit.produce = produce;
    credit.type = type;
    credit.tonnage = Number(tonnage);
    credit.agent = agent;
    credit.branch = branch;
    credit.dispatch = dispatch;
    await credit.save();

    return res.json({ message: "Credit sale record updated." });
  });

  router.delete("/sales/cash/:id", auth(["director", "manager", "agent"]), async (req, res) => {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Cash sale record not found." });
    if (!ensureBranchAccess(req.user, sale.branch)) return res.status(403).json({ message: "Forbidden branch" });
    if (!canEditOwnedRecord(req.user, sale)) return res.status(403).json({ message: "You can only delete your own sales records." });

    await upsertStock(sale.branch, sale.produce, Number(sale.tonnage));
    await sale.deleteOne();
    return res.json({ message: "Cash sale record deleted and stock restored." });
  });

  router.delete("/sales/credit/:id", auth(["director", "manager", "agent"]), async (req, res) => {
    const credit = await Credit.findById(req.params.id);
    if (!credit) return res.status(404).json({ message: "Credit sale record not found." });
    if (!ensureBranchAccess(req.user, credit.branch)) return res.status(403).json({ message: "Forbidden branch" });
    if (!canEditOwnedRecord(req.user, credit)) return res.status(403).json({ message: "You can only delete your own credit records." });

    await upsertStock(credit.branch, credit.produce, Number(credit.tonnage));
    await credit.deleteOne();
    return res.json({ message: "Credit sale record deleted and stock restored." });
  });

  return router;
};
