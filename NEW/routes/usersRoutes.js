const express = require("express");

module.exports = function createUsersRoutes(deps) {
  const { auth, bcrypt, jwt, JWT_SECRET, BRANCHES, User, AccountChangeRequest } = deps;
  const router = express.Router();

  async function createAccountChangeRequest(user, body) {
    const { name, password } = body || {};
    if (!user || !["manager", "agent"].includes(user.role)) {
      return { status: 403, payload: { message: "Forbidden" } };
    }

    const nextName = name === undefined ? user.name : String(name).trim();
    if (name !== undefined && nextName.length < 2) {
      return { status: 400, payload: { message: "Name too short." } };
    }

    const hasPassword = password !== undefined && String(password).length > 0;
    if (hasPassword && String(password).length < 4) {
      return { status: 400, payload: { message: "Password too short." } };
    }

    const wantsNameChange = nextName !== user.name;
    if (!wantsNameChange && !hasPassword) {
      return { status: 400, payload: { message: "No account changes provided." } };
    }

    const pending = await AccountChangeRequest.findOne({ requestedBy: user._id, status: "pending" });
    if (pending) {
      return {
        status: 409,
        payload: { message: "You already have a pending account change request awaiting director approval." }
      };
    }

    const requestDoc = await AccountChangeRequest.create({
      requestedBy: user._id,
      currentName: user.name,
      currentRole: user.role,
      currentBranch: user.branch,
      requestedName: wantsNameChange ? nextName : "",
      requestedPasswordHash: hasPassword ? await bcrypt.hash(String(password), 10) : "",
      status: "pending"
    });

    return {
      status: 202,
      payload: {
        message: "Account change request submitted for director approval.",
        requestId: String(requestDoc._id),
        status: requestDoc.status
      }
    };
  }

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     tags: [Auth]
   *     summary: Login user
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username, password]
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *               branch:
   *                 type: string
   *     responses:
   *       200:
   *         description: Authenticated
   *       401:
   *         description: Unauthorized
   */
  router.post("/auth/login", async (req, res) => {
    const { username, password, branch } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: "Missing credentials" });
    const user = await User.findOne({ name: new RegExp(`^${String(username).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    if (!user) return res.status(401).json({ message: "Account not found. Check the staff name." });
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Incorrect password." });

    if (user.role !== "director" && branch && branch !== user.branch) {
      return res.status(400).json({ message: `This account belongs to ${user.branch}. Use that branch to login.` });
    }
    if (user.role === "director" && branch && branch !== "All") {
      return res.status(400).json({ message: "Director account must use branch All." });
    }

    const token = jwt.sign({ sub: String(user._id), role: user.role, branch: user.branch }, JWT_SECRET, { expiresIn: "8h" });
    return res.json({
      token,
      user: { id: String(user._id), name: user.name, role: user.role, branch: user.branch }
    });
  });

  /**
   * @swagger
   * /api/staff:
   *   get:
   *     tags: [Staff]
   *     summary: Get staff list
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Staff list
   */
  router.get("/staff", auth(["director"]), async (req, res) => {
    const rows = await User.find({}, { name: 1, role: 1, branch: 1, _id: 1 }).sort({ role: 1, name: 1 });
    return res.json(rows.map((r) => ({ id: String(r._id), name: r.name, role: r.role, branch: r.branch })));
  });

  /**
   * @swagger
   * /api/staff:
   *   post:
   *     tags: [Staff]
   *     summary: Create staff user
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Staff created
   */
  router.post("/staff", auth(["director"]), async (req, res) => {
    const { name, role, branch, password } = req.body || {};
    const normalizedRole = String(role || "").toLowerCase();
    if (!name || String(name).trim().length < 2) return res.status(400).json({ message: "Name too short." });
    if (!["director", "manager", "agent"].includes(normalizedRole)) return res.status(400).json({ message: "Invalid role." });
    if (!["All", ...BRANCHES].includes(branch)) return res.status(400).json({ message: "Invalid branch." });
    if (normalizedRole === "director" && branch !== "All") {
      return res.status(400).json({ message: "Director role must use branch All." });
    }
    if (normalizedRole !== "director" && branch === "All") {
      return res.status(400).json({ message: "Only director can use branch All." });
    }
    if (!password || String(password).length < 4) return res.status(400).json({ message: "Password too short." });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      name: String(name).trim(),
      role: normalizedRole,
      branch,
      passwordHash
    });
    return res.status(201).json({ id: String(user._id), name: user.name, role: user.role, branch: user.branch });
  });

  /**
   * @swagger
   * /api/staff/{id}:
   *   put:
   *     tags: [Staff]
   *     summary: Update staff user
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Staff updated
   */
  router.put("/staff/:id", auth(["director"]), async (req, res) => {
    const { name, role, branch, password } = req.body || {};
    const normalizedRole = role ? String(role).toLowerCase() : undefined;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Staff not found." });
    if (name && String(name).trim().length < 2) return res.status(400).json({ message: "Name too short." });
    if (normalizedRole && !["director", "manager", "agent"].includes(normalizedRole)) return res.status(400).json({ message: "Invalid role." });
    if (branch && !["All", ...BRANCHES].includes(branch)) return res.status(400).json({ message: "Invalid branch." });

    const nextRole = normalizedRole || user.role;
    const nextBranch = branch || user.branch;
    if (nextRole === "director" && nextBranch !== "All") {
      return res.status(400).json({ message: "Director role must use branch All." });
    }
    if (nextRole !== "director" && nextBranch === "All") {
      return res.status(400).json({ message: "Only director can use branch All." });
    }

    if (name) user.name = String(name).trim();
    if (normalizedRole) user.role = normalizedRole;
    if (branch) user.branch = branch;
    if (password) {
      if (String(password).length < 4) return res.status(400).json({ message: "Password too short." });
      user.passwordHash = await bcrypt.hash(String(password), 10);
    }
    await user.save();
    return res.json({ id: String(user._id), name: user.name, role: user.role, branch: user.branch });
  });

  /**
   * @swagger
   * /api/staff/{id}:
   *   delete:
   *     tags: [Staff]
   *     summary: Delete staff user
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Staff deleted
   */
  router.delete("/staff/:id", auth(["director"]), async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Staff not found." });
    await User.deleteOne({ _id: user._id });
    return res.json({ message: "Staff deleted." });
  });

  router.get("/account-change-requests", auth(["director"]), async (req, res) => {
    const rows = await AccountChangeRequest.find({})
      .populate("requestedBy", "name")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });

    return res.json(rows.map((r) => ({
      id: String(r._id),
      requestedByName: r.requestedBy && r.requestedBy.name ? r.requestedBy.name : r.currentName,
      requestedByRole: r.currentRole,
      requestedByBranch: r.currentBranch,
      requestedName: r.requestedName || "",
      hasPasswordChange: !!r.requestedPasswordHash,
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      reviewedByName: r.reviewedBy && r.reviewedBy.name ? r.reviewedBy.name : "",
      reviewNote: r.reviewNote || ""
    })));
  });

  router.post("/account-change-requests/:id/approve", auth(["director"]), async (req, res) => {
    const requestDoc = await AccountChangeRequest.findById(req.params.id);
    if (!requestDoc) return res.status(404).json({ message: "Request not found." });
    if (requestDoc.status !== "pending") return res.status(400).json({ message: "Request already processed." });

    const user = await User.findById(requestDoc.requestedBy);
    if (!user) return res.status(404).json({ message: "Request owner account not found." });

    if (requestDoc.requestedName) user.name = requestDoc.requestedName;
    if (requestDoc.requestedPasswordHash) user.passwordHash = requestDoc.requestedPasswordHash;
    await user.save();

    requestDoc.status = "approved";
    requestDoc.reviewedBy = req.user._id;
    requestDoc.reviewedAt = new Date();
    requestDoc.reviewNote = String((req.body && req.body.note) || "").trim();
    await requestDoc.save();

    return res.json({ message: "Account change request approved and applied." });
  });

  router.post("/account-change-requests/:id/reject", auth(["director"]), async (req, res) => {
    const requestDoc = await AccountChangeRequest.findById(req.params.id);
    if (!requestDoc) return res.status(404).json({ message: "Request not found." });
    if (requestDoc.status !== "pending") return res.status(400).json({ message: "Request already processed." });

    requestDoc.status = "rejected";
    requestDoc.reviewedBy = req.user._id;
    requestDoc.reviewedAt = new Date();
    requestDoc.reviewNote = String((req.body && req.body.note) || "").trim();
    await requestDoc.save();

    return res.json({ message: "Account change request rejected." });
  });

  router.get("/account-change-requests/me", auth(["manager", "agent"]), async (req, res) => {
    const rows = await AccountChangeRequest.find({ requestedBy: req.user._id }).sort({ createdAt: -1 }).limit(20);
    return res.json(rows.map((r) => ({
      id: String(r._id),
      requestedName: r.requestedName || "",
      hasPasswordChange: !!r.requestedPasswordHash,
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote || ""
    })));
  });

  /**
   * @swagger
   * /api/account/me:
   *   put:
   *     tags: [Account]
   *     summary: Request own manager/agent account updates for director approval
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       202:
   *         description: Change request submitted
   */
  router.put("/account/me", auth(["manager", "agent"]), async (req, res) => {
    const { name, password } = req.body || {};
    const nextName = name === undefined ? req.user.name : String(name).trim();
    const hasPassword = password !== undefined && String(password).length > 0;

    if (name !== undefined && nextName.length < 2) {
      return res.status(400).json({ message: "Name too short." });
    }
    if (hasPassword && String(password).length < 4) {
      return res.status(400).json({ message: "Password too short." });
    }

    if (req.user.role === "agent") {
      if (name !== undefined) req.user.name = nextName;
      if (hasPassword) req.user.passwordHash = await bcrypt.hash(String(password), 10);
      await req.user.save();
      return res.json({
        message: "Account updated successfully.",
        user: { id: String(req.user._id), name: req.user.name, role: req.user.role, branch: req.user.branch }
      });
    }

    const result = await createAccountChangeRequest(req.user, req.body || {});
    return res.status(result.status).json(result.payload);
  });

  return router;
};
