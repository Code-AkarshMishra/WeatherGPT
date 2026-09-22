const { v4: uuidv4 } = require('uuid');

const requestIdMiddleware = (req, res, next) => {
  const incomingId = req.header('x-request-id');
  const requestId = incomingId || uuidv4();
  
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

module.exports = requestIdMiddleware;
