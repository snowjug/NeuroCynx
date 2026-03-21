const nodemailer = require('nodemailer');

const escapeHtml = (value = '') => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const listToHtml = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return '<li>Not available</li>';
  }
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
};

const isEmailConfigured = () => {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
};

const createTransporter = () => {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

async function reportEmailHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for this endpoint.' } });
  }

  try {
    if (!isEmailConfigured()) {
      return res.status(503).json({
        error: {
          code: 'EMAIL_NOT_CONFIGURED',
          message: 'Email service is not configured.'
        }
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { to, patientName, analysis } = body;
    const email = String(to || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'A valid recipient email is required.'
        }
      });
    }

    if (!analysis || typeof analysis !== 'object') {
      return res.status(400).json({
        error: {
          code: 'INVALID_ANALYSIS',
          message: 'Analysis payload is required.'
        }
      });
    }

    const safeName = escapeHtml(patientName || 'Patient');
    const graphRows = Array.isArray(analysis.graph)
      ? analysis.graph
          .map((item) => {
            const label = escapeHtml(item?.label || 'Metric');
            const score = Number(item?.score);
            const normalized = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
            return `<tr><td style="padding:8px;border:1px solid #ddd;">${label}</td><td style="padding:8px;border:1px solid #ddd;">${normalized}/100</td></tr>`;
          })
          .join('')
      : '<tr><td style="padding:8px;border:1px solid #ddd;">No metrics</td><td style="padding:8px;border:1px solid #ddd;">N/A</td></tr>';

    const html = `
      <div style="font-family:Arial, sans-serif;max-width:700px;margin:0 auto;color:#1f2937;line-height:1.5;">
        <h2 style="margin-bottom:8px;">NeuCyn Health Report</h2>
        <p style="margin-top:0;">Hello ${safeName}, your latest analysis summary is below.</p>
        <h3>Summary</h3>
        <p>${escapeHtml(analysis.summary || 'Not available')}</p>

        <h3>Care Recommendations</h3>
        <ul>${listToHtml(analysis.care)}</ul>

        <h3>Medication Guidance</h3>
        <ul>${listToHtml(analysis.medicine)}</ul>

        <h3>Lifestyle Recommendations</h3>
        <ul>${listToHtml(analysis.lifestyle)}</ul>

        <h3>Health Score Metrics</h3>
        <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border:1px solid #ddd;background:#f8fafc;">Metric</th>
              <th style="text-align:left;padding:8px;border:1px solid #ddd;background:#f8fafc;">Score</th>
            </tr>
          </thead>
          <tbody>${graphRows}</tbody>
        </table>

        <p style="font-size:12px;color:#6b7280;">This report is AI-assisted and should not replace a licensed clinician's diagnosis.</p>
      </div>
    `;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@neucyn.com',
      to: email,
      subject: 'Your NeuCyn Health Report',
      html
    });

    return res.status(200).json({ ok: true, message: 'Report emailed successfully.' });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'EMAIL_SEND_FAILED',
        message: error?.message || 'Failed to send email report.'
      }
    });
  }
}

module.exports = reportEmailHandler;
