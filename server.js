const express = require('express');
const path = require('node:path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_FALLBACK_MODELS = ['gemini-3-flash-preview', 'gemini-3.1-pro-preview'];
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'no-reply@neucyn.com';

app.use(express.json({ limit: '30mb' }));
app.use(express.static(path.join(__dirname)));

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
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
};

const createTransporter = () => {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'NeuCyn API' });
});

app.post('/api/gemini/generate', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Live AI service is not configured.'
        }
      });
    }

    const { parts, responseMimeType } = req.body || {};

    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request must include a non-empty parts array.'
        }
      });
    }

    let lastError = 'All models failed.';

    for (const model of GEMINI_FALLBACK_MODELS) {
      const payload = { contents: [{ parts }] };
      if (responseMimeType) {
        payload.generationConfig = { response_mime_type: responseMimeType };
      }

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );

        const result = await response.json();

        if (response.ok) {
          return res.json(result);
        }

        lastError = result?.error?.message || `Model ${model} failed.`;
      } catch (error) {
        lastError = error?.message || `Network error with model ${model}.`;
      }
    }

    const isQuota = /quota|429/i.test(lastError);
    return res.status(isQuota ? 429 : 502).json({
      error: {
        code: isQuota ? 'QUOTA_EXCEEDED' : 'UPSTREAM_FAILURE',
        message: lastError
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: error?.message || 'Unexpected server error.'
      }
    });
  }
});

app.post('/api/report/email', async (req, res) => {
  try {
    if (!isEmailConfigured()) {
      return res.status(503).json({
        error: {
          code: 'EMAIL_NOT_CONFIGURED',
          message: 'Email service is not configured.'
        }
      });
    }

    const { to, patientName, analysis } = req.body || {};
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
      from: SMTP_FROM,
      to: email,
      subject: 'Your NeuCyn Health Report',
      html
    });

    return res.json({ ok: true, message: 'Report emailed successfully.' });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'EMAIL_SEND_FAILED',
        message: error?.message || 'Failed to send email report.'
      }
    });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`NeuCyn server running on http://localhost:${PORT}`);
});
