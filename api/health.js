module.exports = (_req, res) => {
  return res.status(200).json({ ok: true, service: 'NeuCyn API (Vercel function)' });
};
