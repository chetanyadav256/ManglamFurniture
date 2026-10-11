export function notFound(req, res) {
  res.status(404).json({ message: 'API route not found.' });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    message: status >= 500 ? 'Internal server error.' : 'Invalid request.',
  });
}
