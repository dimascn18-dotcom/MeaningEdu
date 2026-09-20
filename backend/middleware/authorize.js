module.exports = function authorize(...allowedRoles) {
  return function checkRole(req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.peran)) {
      return res.status(403).json({ message: 'Akses ditolak untuk peran akun ini.' });
    }
    next();
  };
};
