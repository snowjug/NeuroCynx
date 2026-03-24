const express = require('express');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config();

const reportEmailHandler = require('./api/report/email');
const medicineCompareHandler = require('./api/medicine/compare');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_FALLBACK_MODELS = ['gemini-3-flash-preview', 'gemini-3.1-pro-preview'];

app.use(express.json({ limit: '30mb' }));
app.use(express.static(path.join(__dirname)));

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

app.post('/api/report/email', reportEmailHandler);
app.post('/api/medicine/compare', medicineCompareHandler);

app.post('/api/report/pdf', async (req, res) => {
  try {
    if (typeof reportEmailHandler.generatePDF !== 'function') {
      return res.status(500).json({
        error: {
          code: 'PDF_GENERATOR_UNAVAILABLE',
          message: 'PDF generator is unavailable right now.'
        }
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { patientName, analysis } = body;

    if (!analysis || typeof analysis !== 'object') {
      return res.status(400).json({
        error: {
          code: 'INVALID_ANALYSIS',
          message: 'Analysis payload is required.'
        }
      });
    }

    const pdfBuffer = await reportEmailHandler.generatePDF(patientName || 'Patient', analysis);
    const filename = `NeuCyn_Report_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'PDF_GENERATION_FAILED',
        message: error?.message || 'Failed to generate PDF report.'
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
