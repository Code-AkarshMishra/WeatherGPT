/**
 * emailService.js
 * WeatherGPT Proactive Disaster & Weather Warning Email Dispatcher
 *
 * Sends high-priority meteorological bulletins and IMD emergency advisories
 * directly to registered users based on their location and severity threshold.
 */
const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let transporter = null;

// Initialize transporter with environment variables or fallback test account
async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    logger.info(`[EmailService] Configured live SMTP transporter for ${user}`);
    return transporter;
  }

  // If no SMTP configured, automatically create a real disposable Ethereal testing inbox
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.info(`[EmailService] Created live dev Ethereal test inbox: ${testAccount.user}`);
  } catch (err) {
    // Mock transporter for offline/local environments
    transporter = {
      sendMail: async (opts) => {
        logger.info(`[EmailService Mock] Dispatching simulated email to ${opts.to} with subject "${opts.subject}"`);
        return { messageId: `mock-${Date.now()}` };
      },
    };
  }

  return transporter;
}

/**
 * Generate a responsive, professional HTML weather alert bulletin template
 */
function createAlertEmailHtml({ city, imdColor, riskAssessment, temp, rainProb, windSpeed, description, farmerAdvisory, actionPoints }) {
  const colorMap = {
    RED: { bg: '#ef4444', label: 'RED WARNING (High Emergency)' },
    ORANGE: { bg: '#f97316', label: 'ORANGE ALERT (Be Prepared)' },
    YELLOW: { bg: '#eab308', label: 'YELLOW WATCH (Be Aware)' },
    GREEN: { bg: '#22c55e', label: 'GREEN (All Clear / Normal)' },
  };

  const badge = colorMap[imdColor] || colorMap.ORANGE;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b1329; color: #f8fafc; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      .header { background: linear-gradient(135deg, #0284c7, #0369a1); padding: 24px; text-align: center; }
      .header h1 { margin: 0; font-size: 24px; color: #ffffff; letter-spacing: -0.5px; }
      .header p { margin: 6px 0 0 0; font-size: 13px; color: #e0f2fe; }
      .badge { display: inline-block; background: ${badge.bg}; color: #ffffff; font-size: 13px; font-weight: 800; padding: 6px 14px; border-radius: 9999px; margin-top: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
      .content { padding: 24px; }
      .alert-box { background: rgba(255,255,255,0.04); border-left: 4px solid ${badge.bg}; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
      .alert-title { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
      .grid { display: table; width: 100%; margin: 16px 0; }
      .col { display: table-cell; width: 33%; text-align: center; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; }
      .col-val { font-size: 20px; font-weight: 800; color: #38bdf8; }
      .col-lbl { font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-top: 4px; }
      .advisory-box { background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 10px; padding: 16px; margin-top: 16px; }
      .advisory-title { font-size: 14px; font-weight: 700; color: #38bdf8; margin-bottom: 6px; }
      .advisory-text { font-size: 13px; color: #cbd5e1; line-height: 1.5; margin: 0; }
      .helpline { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 10px; padding: 14px; margin-top: 16px; font-size: 12px; color: #fca5a5; }
      .footer { background: #090d16; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.06); }
      .btn { display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 8px; font-weight: 700; font-size: 13px; margin-top: 16px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🌤️ WeatherGPT Proactive Alert</h1>
        <p>National Meteorological Early Warning Broadcast &bull; MoES / IMD Linked</p>
        <div class="badge">${badge.label}</div>
      </div>
      <div class="content">
        <div class="alert-title">Critical Weather Advisory for <u>${city}</u></div>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">
          Our 24/7 autonomous meteorological monitor detected an active weather bulletin matching your registered location.
        </p>

        <div class="grid">
          <div class="col">
            <div class="col-val">${temp ?? '--'}°C</div>
            <div class="col-lbl">Temperature</div>
          </div>
          <div class="col" style="margin: 0 8px;">
            <div class="col-val">${rainProb ?? '--'}%</div>
            <div class="col-lbl">Rain Probability</div>
          </div>
          <div class="col">
            <div class="col-val">${windSpeed ?? '--'} km/h</div>
            <div class="col-lbl">Wind Gusts</div>
          </div>
        </div>

        <div class="alert-box">
          <div style="font-weight: 700; color: #f8fafc; font-size: 14px;">Risk Assessment:</div>
          <div style="color: #e2e8f0; font-size: 13px; margin-top: 4px;">${riskAssessment || 'Atmospheric disturbance observed in regional satellite radars.'}</div>
          ${description ? `<div style="color: #94a3b8; font-size: 12px; margin-top: 6px;">Current Condition: <em>${description}</em></div>` : ''}
        </div>

        ${
          farmerAdvisory
            ? `
        <div class="advisory-box">
          <div class="advisory-title">🌾 GKMS Farmer & Agriculture Advisory</div>
          <p class="advisory-text">${farmerAdvisory}</p>
        </div>`
            : ''
        }

        <div class="helpline">
          🚨 <strong>National Disaster Helplines:</strong><br/>
          • National Disaster Management Authority (NDMA): <strong>1078</strong><br/>
          • State Emergency Operations Center (SEOC): <strong>1070</strong><br/>
          • Ambulance / Medical: <strong>108</strong> &bull; Fire: <strong>101</strong>
        </div>

        <div style="text-align: center;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/alerts" class="btn">
            Open Live WeatherGPT Doppler Radar &rarr;
          </a>
        </div>
      </div>
      <div class="footer">
        You are receiving this automated alert because you subscribed to proactive early warnings for <strong>${city}</strong> on WeatherGPT.<br/>
        IMD / MoES Official Weather AI Integration &bull; Powered by Deep Learning Disaster Engines
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Dispatch an email alert to a specific recipient
 */
async function sendWeatherAlertEmail({ to, city, imdColor, riskAssessment, temp, rainProb, windSpeed, description, farmerAdvisory, actionPoints }) {
  if (!to) {
    logger.warn('[EmailService] Cannot send alert email: no recipient provided');
    return { success: false, error: 'Recipient email required' };
  }

  const subject = `⚠️ [IMD ${imdColor || 'ORANGE'} ALERT] Critical Weather Warning for ${city} — WeatherGPT`;
  const html = createAlertEmailHtml({
    city,
    imdColor,
    riskAssessment,
    temp,
    rainProb,
    windSpeed,
    description,
    farmerAdvisory,
    actionPoints,
  });

  try {
    const transport = await getTransporter();
    const mailOptions = {
      from: `"WeatherGPT Early Warning System" <${process.env.SMTP_FROM || 'alerts@weathergpt.ai'}>`,
      to,
      subject,
      html,
    };

    const info = await transport.sendMail(mailOptions);
    logger.info(`[EmailService] Alert email successfully sent to ${to} for ${city}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId, recipient: to };
  } catch (err) {
    logger.error(`[EmailService] Failed sending alert email to ${to}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendWeatherAlertEmail,
  createAlertEmailHtml,
};
