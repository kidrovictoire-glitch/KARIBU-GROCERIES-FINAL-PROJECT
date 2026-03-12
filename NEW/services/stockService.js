function createUpsertStock({ Inventory }) {
  return async function upsertStock(branch, productName, deltaKg) {
    const existing = await Inventory.findOne({ branch, productName });
    if (!existing) {
      if (deltaKg < 0) return null;
      return Inventory.create({ branch, productName, quantityKg: deltaKg });
    }
    const next = Number(existing.quantityKg || 0) + Number(deltaKg || 0);
    if (next < 0) return null;
    existing.quantityKg = next;
    await existing.save();
    return existing;
  };
}

module.exports = { createUpsertStock };
