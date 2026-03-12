function isPhone(v) {
  return /^(?:\+?256|0)?7\d{8}$/.test(String(v || "").trim());
}

function isNin(v) {
  return /^[A-Z0-9]{8,14}$/i.test(String(v || "").trim());
}

function isAlphaNumMin2(v) {
  return /^[A-Za-z0-9][A-Za-z0-9 .,'-]{1,}$/.test(String(v || "").trim());
}

function isProduceType(v) {
  return /^[A-Za-z][A-Za-z0-9 ,()/-]{1,}$/.test(String(v || "").trim());
}

module.exports = {
  isPhone,
  isNin,
  isAlphaNumMin2,
  isProduceType
};
