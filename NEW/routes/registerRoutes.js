const express = require("express");

module.exports = function createRegisterRoutes(deps) {
  const { bcrypt, jwt, JWT_SECRET, BRANCHES, User } = deps;
  const router = express.Router();

  /**
   * @swagger
   * /users/login:
   *   post:
   *     operationId: userLogin
   *     tags: [Auth]
   *     summary: User Login
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username, password, branch]
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *               branch:
   *                 type: string
   *                 enum: [All, Maganjo, Matugga]
   *     responses:
   *       200:
   *         description: Authenticated
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
  router.post("/users/login", async (req, res) => {
    const { username, password, branch } = req.body || {};
    if (!username || !password || !branch) return res.status(400).json({ message: "Missing credentials" });
    const user = await User.findOne({ name: new RegExp(`^${String(username).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    if (!user) return res.status(401).json({ message: "Account not found. Check the staff name." });
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Incorrect password." });

    if (user.role !== "director" && branch !== user.branch) {
      return res.status(400).json({ message: `This account belongs to ${user.branch}. Use that branch to login.` });
    }
    if (user.role === "director" && branch !== "All") {
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
   * /users/register:
   *   post:
   *     tags: [Auth]
   *     summary: Register a user account
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, role, branch, password]
   *             properties:
   *               name:
   *                 type: string
   *               role:
   *                 type: string
   *                 enum: [director, manager, agent]
   *               branch:
   *                 type: string
   *                 enum: [All, Maganjo, Matugga]
   *               password:
   *                 type: string
   *     responses:
   *       201:
   *         description: User created
   *       400:
   *         description: Validation error
   *       409:
   *         description: User already exists
   */
  router.post("/users/register", async (req, res) => {
    const { name, username, role, branch, password } = req.body || {};
    const staffName = String(name || username || "").trim();
    const normalizedRole = String(role || "agent").toLowerCase();
    const targetBranch = branch || (normalizedRole === "director" ? "All" : BRANCHES[0]);

    if (!staffName || staffName.length < 2) return res.status(400).json({ message: "Name too short." });
    if (!["director", "manager", "agent"].includes(normalizedRole)) {
      return res.status(400).json({ message: "Role must be director, manager, or agent." });
    }
    if (normalizedRole === "director" && targetBranch !== "All") {
      return res.status(400).json({ message: "Director role must use branch All." });
    }
    if (normalizedRole !== "director" && targetBranch === "All") {
      return res.status(400).json({ message: "Only director can use branch All." });
    }
    if (!["All", ...BRANCHES].includes(targetBranch)) return res.status(400).json({ message: "Invalid branch." });
    if (!password || String(password).length < 4) return res.status(400).json({ message: "Password too short." });

    const existing = await User.findOne({ name: new RegExp(`^${staffName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    if (existing) return res.status(409).json({ message: "User already exists." });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      name: staffName,
      role: normalizedRole,
      branch: targetBranch,
      passwordHash
    });

    return res.status(201).json({
      id: String(user._id),
      name: user.name,
      role: user.role,
      branch: user.branch
    });
  });

  return router;
};
