function createAuth({ jwt, JWT_SECRET, User }) {
  return function auth(requiredRoles = []) {
    return async (req, res, next) => {
      try {
        const raw = req.headers.authorization || "";
        const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";
        if (!token) return res.status(401).json({ message: "Unauthorized" });
        const payload = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(payload.sub);
        if (!user) return res.status(401).json({ message: "Invalid token" });
        req.user = user;
        if (requiredRoles.length && !requiredRoles.includes(user.role)) {
          return res.status(403).json({ message: "Forbidden" });
        }
        return next();
      } catch (e) {
        return res.status(401).json({ message: "Unauthorized" });
      }
    };
  };
}

module.exports = { createAuth };
