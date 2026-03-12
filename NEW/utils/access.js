function ensureBranchAccess(user, branch) {
  if (user.role === "director") return true;
  return user.branch === branch;
}

module.exports = { ensureBranchAccess };
