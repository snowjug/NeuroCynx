const GEMINI_FALLBACK_MODELS = ['gemini-3-flash-preview', 'gemini-3.1-pro-preview'];

async function geminiGenerateHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for this endpoint.' } });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      return res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Live AI service is not configured.'
        }
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { parts, responseMimeType } = body;

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
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );

        const result = await response.json();

        if (response.ok) {
          return res.status(200).json(result);
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
}

module.exports = geminiGenerateHandler;
