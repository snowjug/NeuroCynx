const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const { createCanvas } = require('canvas');

const escapeHtml = (value = '') => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

// Generate radar chart as image
function generateRadarChart(graphData) {
  try {
    const size = 400;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = 150;
    const levels = 5;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Draw grid circles
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 1; i <= levels; i++) {
      const radius = (maxRadius / levels) * i;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw axis lines and labels
    const dataPoints = graphData && Array.isArray(graphData) ? graphData.length : 5;
    const angleSlice = (Math.PI * 2) / dataPoints;

    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < dataPoints; i++) {
      const angle = angleSlice * i - Math.PI / 2;
      const x1 = centerX + maxRadius * Math.cos(angle);
      const y1 = centerY + maxRadius * Math.sin(angle);

      // Axis line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      // Label
      const labelRadius = maxRadius + 35;
      const labelX = centerX + labelRadius * Math.cos(angle);
      const labelY = centerY + labelRadius * Math.sin(angle);

      if (graphData && graphData[i]) {
        const label = String(graphData[i].label || '').substring(0, 12);
        ctx.fillText(label, labelX, labelY);
      }
    }

    // Draw data polygon
    if (graphData && Array.isArray(graphData) && graphData.length > 0) {
      ctx.fillStyle = 'rgba(124, 58, 237, 0.2)';
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < graphData.length; i++) {
        const angle = angleSlice * i - Math.PI / 2;
        const score = Math.max(0, Math.min(100, Number(graphData[i].score) || 0));
        const radius = (maxRadius / 100) * score;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw points
      ctx.fillStyle = '#7c3aed';
      for (let i = 0; i < graphData.length; i++) {
        const angle = angleSlice * i - Math.PI / 2;
        const score = Math.max(0, Math.min(100, Number(graphData[i].score) || 0));
        const radius = (maxRadius / 100) * score;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Chart generation error:', error);
    return null;
  }
}

// Generate beautiful PDF report
async function generatePDF(patientName, analysis) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Define colors
      const accentColor = '#7c3aed';
      const textPrimary = '#1a1a1a';
      const textSecondary = '#5e5e66';
      const borderColor = '#e6e6eb';

      // Header
      doc.fontSize(28).font('Helvetica-Bold').fillColor(accentColor).text('NeuCyn', { align: 'left' });
      doc.fontSize(12).font('Helvetica').fillColor(textSecondary).text('Health Analysis Report', { align: 'left', continued: true });
      doc.moveDown(0.3);

      // Patient info
      doc.fontSize(10).font('Helvetica').fillColor(textPrimary);
      doc.text(`Patient: ${escapeHtml(patientName || 'Patient')}`, { align: 'left' });
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'left' });
      doc.moveDown(1);

      // Horizontal line
      doc.strokeColor(borderColor).lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.8);

      // Summary Section
      doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text('Summary');
      doc.fontSize(10).font('Helvetica').fillColor(textSecondary);
      const summary = String(analysis.summary || '').trim();
      doc.text(summary || 'No summary available', { align: 'left', width: 515 });
      doc.moveDown(1);

      // Health Radar Chart
      const chartBuffer = generateRadarChart(analysis.graph);
      if (chartBuffer) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text('Health Radar');
        doc.moveDown(0.5);
        doc.image(chartBuffer, { fit: [250, 250], align: 'center' });
        doc.moveDown(1);
      }

      // Health Metrics Table
      doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text('Health Metrics');
      doc.moveDown(0.5);

      const metrics = Array.isArray(analysis.graph) ? analysis.graph : [];
      let tableY = doc.y;

      doc.fontSize(9).font('Helvetica-Bold').fillColor(accentColor);
      doc.text('Metric', 50, tableY);
      doc.text('Score', 450, tableY, { width: 60, align: 'right' });

      tableY += 20;
      doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, tableY).lineTo(555, tableY).stroke();

      tableY += 8;
      doc.fontSize(9).font('Helvetica').fillColor(textSecondary);

      metrics.forEach((metric) => {
        const label = String(metric.label || 'Metric').substring(0, 30);
        const score = Math.max(0, Math.min(100, Math.round(Number(metric.score) || 0)));

        doc.text(label, 50, tableY);
        doc.font('Helvetica-Bold').fillColor(accentColor).text(`${score}/100`, 450, tableY, { width: 60, align: 'right' });
        doc.font('Helvetica').fillColor(textSecondary);

        tableY += 18;
        doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, tableY).lineTo(555, tableY).stroke();
        tableY += 4;
      });

      doc.moveDown(1);

      // SWOT Analysis
      if (analysis.swot && typeof analysis.swot === 'object') {
        doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text('SWOT Analysis');
        doc.moveDown(0.5);

        const swotSections = [
          { title: 'Strengths', items: analysis.swot.strengths, color: '#10b981' },
          { title: 'Weaknesses', items: analysis.swot.weaknesses, color: '#f59e0b' },
          { title: 'Opportunities', items: analysis.swot.opportunities, color: '#3b82f6' },
          { title: 'Threats', items: analysis.swot.threats, color: '#ef4444' }
        ];

        swotSections.forEach((section) => {
          doc.fontSize(11).font('Helvetica-Bold').fillColor(section.color).text(section.title);
          doc.fontSize(9).font('Helvetica').fillColor(textSecondary);

          if (Array.isArray(section.items) && section.items.length > 0) {
            section.items.forEach((item) => {
              doc.text(`• ${String(item).substring(0, 70)}`, { width: 500 });
            });
          } else {
            doc.text('No items available');
          }

          doc.moveDown(0.5);
        });

        doc.moveDown(0.5);
      }

      // Care Recommendations
      if (Array.isArray(analysis.care) && analysis.care.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text('Care Recommendations');
        doc.fontSize(9).font('Helvetica').fillColor(textSecondary);

        analysis.care.forEach((item) => {
          doc.text(`• ${String(item).substring(0, 70)}`, { width: 500 });
        });

        doc.moveDown(1);
      }

      // Medications
      if (Array.isArray(analysis.medicine) && analysis.medicine.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor(accentColor).text('Medication Guidance');
        doc.fontSize(9).font('Helvetica').fillColor(textSecondary);

        analysis.medicine.forEach((item) => {
          doc.text(`Rx: ${String(item).substring(0, 66)}`, { width: 500 });
        });

        doc.fontSize(8).fillColor('#666').text('Always consult with a licensed physician before taking medications.', { width: 500 });
        doc.moveDown(1);
      }

      // Lifestyle Recommendations
      if (Array.isArray(analysis.lifestyle) && analysis.lifestyle.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text('Lifestyle Recommendations');
        doc.fontSize(9).font('Helvetica').fillColor(textSecondary);

        analysis.lifestyle.forEach((item) => {
          doc.text(`• ${String(item).substring(0, 70)}`, { width: 500 });
        });

        doc.moveDown(1.5);
      }

      // Footer
      doc.strokeColor(borderColor).lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor('#999').text('This report is AI-assisted and should not replace a licensed clinician\'s diagnosis. Always consult with healthcare professionals for medical advice.', { align: 'center', width: 500 });
      doc.text(`Report Generated: ${new Date().toLocaleString()}`, { align: 'center', width: 500 });

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function reportEmailHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for this endpoint.' } });
  }

  try {
    if (!isEmailConfigured()) {
      return res.status(503).json({
        error: {
          code: 'EMAIL_NOT_CONFIGURED',
          message: 'Email service is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables.'
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

    // Generate PDF
    const pdfBuffer = await generatePDF(patientName, analysis);

    // Send email with PDF attachment
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@neucyn.com',
      to: email,
      subject: 'Your NeuCyn Health Report',
      html: `
        <div style="font-family:Arial, sans-serif;max-width:700px;margin:0 auto;color:#1f2937;">
          <h2>Hello ${escapeHtml(patientName || 'Patient')},</h2>
          <p>Your NeuCyn health analysis report is attached as a PDF. Please open it to view your complete health assessment including SWOT analysis and health metrics.</p>
          <p style="color:#6b7280;font-size:12px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:20px;">
            This report is AI-assisted and should not replace a licensed clinician's diagnosis. 
            Always consult with healthcare professionals for medical advice.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `NeuCyn_Report_${Date.now()}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    return res.status(200).json({ ok: true, message: 'Health report emailed successfully with PDF attachment.' });
  } catch (error) {
    console.error('Email handler error:', error);
    return res.status(500).json({
      error: {
        code: 'EMAIL_SEND_FAILED',
        message: error?.message || 'Failed to send email report.'
      }
    });
  }
}

module.exports = reportEmailHandler;
