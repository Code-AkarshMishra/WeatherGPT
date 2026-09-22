const sendSuccess = (res, data = {}, meta = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.req ? res.req.id : undefined,
      ...meta,
    },
  });
};

const sendError = (res, statusCode, code, message, requestId = null, details = null) => {
  const errorObj = {
    code,
    message,
    requestId: requestId || (res.req ? res.req.id : undefined),
  };

  if (details && process.env.NODE_ENV !== 'production') {
    errorObj.details = details;
  }

  return res.status(statusCode).json({
    success: false,
    error: errorObj,
  });
};

module.exports = {
  sendSuccess,
  sendError,
};
