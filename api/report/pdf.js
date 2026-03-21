const reportEmailHandler = require('./email');

async function reportPdfHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for this endpoint.' } });
  }

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
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'PDF_GENERATION_FAILED',
        message: error?.message || 'Failed to generate PDF report.'
      }
    });
  }
}

module.exports = reportPdfHandler;
