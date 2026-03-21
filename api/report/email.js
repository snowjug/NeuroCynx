const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const { createCanvas } = require('canvas');
const { Resend } = require('resend');

const getEmailConfig = () => {
  const configuredProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim();
  const apiKey = process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY || '';
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@neucyn.com';
  const provider = configuredProvider || (apiKey ? 'resend' : 'smtp');
  return { provider, apiKey, from };
};

const escapeHtml = (value = '') => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const toPlainText = (value = '') => String(value).replaceAll(/[\r\n\t]+/g, ' ').trim();

const ensureSpaceFor = (doc, minSpace, marginBottom = 40) => {
  const bottomLimit = doc.page.height - marginBottom;
  if (doc.y + minSpace > bottomLimit) {
    doc.addPage();
  }
};

const buildResendTemplateHtml = ({ patientName, reportId, dateText, reportUrl, unsubscribeUrl, status }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Neucyn Report</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;overflow:hidden;">
    <div style="background:#111827;color:#ffffff;padding:20px;text-align:center;">
      <h1 style="margin:0;font-size:22px;letter-spacing:0.5px;">Neucyn</h1>
      <div style="font-size:13px;opacity:0.8;margin-top:5px;">Automated Report</div>
    </div>

    <div style="padding:25px 20px;color:#1f2937;line-height:1.6;">
      <h2>Hello ${escapeHtml(patientName)},</h2>
      <p>Your requested report from <strong>neucyn.tech</strong> is ready. A full PDF is attached to this email.</p>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:15px;margin:20px 0;">
        <div style="font-weight:bold;margin-bottom:10px;font-size:15px;">Report Summary</div>

        <div style="display:flex;justify-content:space-between;margin:6px 0;font-size:14px;"><span>Report ID</span><span>${escapeHtml(reportId)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:6px 0;font-size:14px;"><span>Date Generated</span><span>${escapeHtml(dateText)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:6px 0;font-size:14px;"><span>Status</span><span>${escapeHtml(status)}</span></div>
      </div>

      <p>You can view the full detailed report using the button below:</p>

      <a href="${escapeHtml(reportUrl)}" style="display:inline-block;margin-top:20px;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">View Full Report</a>

      <p style="margin-top:25px;">If you did not request this report, please ignore this email or contact support.</p>

      <p>- Team Neucyn</p>
    </div>

    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      <p>© 2026 Neucyn.tech</p>
      <p>
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#2563eb;">Unsubscribe</a> •
        <a href="https://neucyn.tech" style="color:#2563eb;">Website</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
};

const isEmailConfigured = () => {
  const { provider, apiKey, from } = getEmailConfig();
  if (provider === 'resend') {
    return Boolean(apiKey && from && !apiKey.startsWith('re_xxxxxxxxx'));
  }
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
};

const sendViaResend = async ({ to, subject, html, pdfBuffer, filename }) => {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || apiKey.startsWith('re_xxxxxxxxx')) {
    throw new Error('Resend is not initialized. Replace re_xxxxxxxxx with your real API key in EMAIL_API_KEY.');
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
    attachments: [
      {
        filename,
        content: pdfBuffer.toString('base64')
      }
    ]
  });

  if (error) {
    throw new Error(error.message || 'Resend email request failed.');
  }
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

// Generate radar chart image locally using canvas
async function generateRadarChart(graphData) {
  try {
    const points = Array.isArray(graphData) ? graphData : [];
    if (!points.length) {
      return null;
    }

    const size = 700;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = 230;
    const levels = 5;
    const angleSlice = (Math.PI * 2) / points.length;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    for (let level = 1; level <= levels; level++) {
      const radius = (maxRadius / levels) * level;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const angle = angleSlice * i - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.strokeStyle = '#e6e6eb';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (let i = 0; i < points.length; i++) {
      const angle = angleSlice * i - Math.PI / 2;
      const x = centerX + maxRadius * Math.cos(angle);
      const y = centerY + maxRadius * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.stroke();

      const label = String(points[i]?.label || 'Metric');
      const labelX = centerX + (maxRadius + 42) * Math.cos(angle);
      const labelY = centerY + (maxRadius + 42) * Math.sin(angle);
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, labelX, labelY);
    }

    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const angle = angleSlice * i - Math.PI / 2;
      const score = Math.max(0, Math.min(100, Number(points[i]?.score) || 0));
      const radius = (maxRadius * score) / 100;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(124, 58, 237, 0.22)';
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < points.length; i++) {
      const angle = angleSlice * i - Math.PI / 2;
      const score = Math.max(0, Math.min(100, Number(points[i]?.score) || 0));
      const radius = (maxRadius * score) / 100;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#7c3aed';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Canvas chart generation failed:', error?.message || error);
    return null;
  }
}

// Generate beautiful PDF report
async function generatePDF(patientName, analysis) {
  const chartBuffer = await generateRadarChart(analysis?.graph);

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
      doc.text(`Patient: ${toPlainText(patientName || 'Patient')}`, { align: 'left' });
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
      if (chartBuffer) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text('Health Radar');
        doc.moveDown(0.5);
        doc.image(chartBuffer, { fit: [250, 250], align: 'center' });
        doc.moveDown(1);
      }

      // Health Metrics Table
      ensureSpaceFor(doc, 120);
      doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text('Health Metrics');
      doc.moveDown(0.5);

      const metrics = Array.isArray(analysis.graph) ? analysis.graph : [];
      doc.fontSize(9).font('Helvetica-Bold').fillColor(accentColor);
      doc.text('Metric', 50, doc.y, { continued: true });
      doc.text('Score', 450, doc.y, { width: 60, align: 'right' });
      doc.moveDown(0.4);
      doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.4);
      doc.fontSize(9).font('Helvetica').fillColor(textSecondary);

      metrics.forEach((metric) => {
        ensureSpaceFor(doc, 26);
        const label = String(metric.label || 'Metric').substring(0, 30);
        const score = Math.max(0, Math.min(100, Math.round(Number(metric.score) || 0)));

        const rowY = doc.y;
        doc.text(label, 50, rowY, { width: 370 });
        doc.font('Helvetica-Bold').fillColor(accentColor).text(`${score}/100`, 450, rowY, { width: 60, align: 'right' });
        doc.font('Helvetica').fillColor(textSecondary);
        doc.y = rowY + 16;
        doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.35);
      });

      doc.moveDown(1);

      // SWOT Analysis
      if (analysis.swot && typeof analysis.swot === 'object') {
        ensureSpaceFor(doc, 100);
        doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text('SWOT Analysis');
        doc.moveDown(0.5);

        const swotSections = [
          { title: 'Strengths', items: analysis.swot.strengths, color: '#10b981' },
          { title: 'Weaknesses', items: analysis.swot.weaknesses, color: '#f59e0b' },
          { title: 'Opportunities', items: analysis.swot.opportunities, color: '#3b82f6' },
          { title: 'Threats', items: analysis.swot.threats, color: '#ef4444' }
        ];

        swotSections.forEach((section) => {
          ensureSpaceFor(doc, 48);
          doc.fontSize(11).font('Helvetica-Bold').fillColor(section.color).text(section.title);
          doc.fontSize(9).font('Helvetica').fillColor(textSecondary);

          if (Array.isArray(section.items) && section.items.length > 0) {
            section.items.forEach((item) => {
              ensureSpaceFor(doc, 18);
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
        ensureSpaceFor(doc, 70);
        doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text('Care Recommendations');
        doc.fontSize(9).font('Helvetica').fillColor(textSecondary);

        analysis.care.forEach((item) => {
          ensureSpaceFor(doc, 18);
          doc.text(`• ${String(item).substring(0, 70)}`, { width: 500 });
        });

        doc.moveDown(1);
      }

      // Medications
      if (Array.isArray(analysis.medicine) && analysis.medicine.length > 0) {
        ensureSpaceFor(doc, 70);
        doc.fontSize(14).font('Helvetica-Bold').fillColor(accentColor).text('Medication Guidance');
        doc.fontSize(9).font('Helvetica').fillColor(textSecondary);

        analysis.medicine.forEach((item) => {
          ensureSpaceFor(doc, 18);
          doc.text(`Rx: ${String(item).substring(0, 66)}`, { width: 500 });
        });

        doc.fontSize(8).fillColor('#666').text('Always consult with a licensed physician before taking medications.', { width: 500 });
        doc.moveDown(1);
      }

      // Lifestyle Recommendations
      if (Array.isArray(analysis.lifestyle) && analysis.lifestyle.length > 0) {
        ensureSpaceFor(doc, 70);
        doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text('Lifestyle Recommendations');
        doc.fontSize(9).font('Helvetica').fillColor(textSecondary);

        analysis.lifestyle.forEach((item) => {
          ensureSpaceFor(doc, 18);
          doc.text(`• ${String(item).substring(0, 70)}`, { width: 500 });
        });

        doc.moveDown(1.5);
      }

      // Footer
      ensureSpaceFor(doc, 48);
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
      const { provider } = getEmailConfig();
      const configHint = provider === 'resend'
        ? 'Set EMAIL_PROVIDER=resend, EMAIL_FROM, and replace re_xxxxxxxxx in EMAIL_API_KEY with your real key.'
        : 'Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in .env.';

      return res.status(503).json({
        error: {
          code: 'EMAIL_NOT_CONFIGURED',
          message: `Email service is not configured. ${configHint}`
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

    const subject = 'Your NeuCyn Health Report';
    const reportId = `NCY-${Date.now().toString().slice(-8)}`;
    const html = buildResendTemplateHtml({
      patientName: toPlainText(patientName || 'Patient'),
      reportId,
      dateText: new Date().toLocaleString(),
      status: 'Generated',
      reportUrl: process.env.REPORT_URL || 'https://neucyn.tech',
      unsubscribeUrl: process.env.UNSUBSCRIBE_URL || 'https://neucyn.tech'
    });
    const filename = `NeuCyn_Report_${Date.now()}.pdf`;

    // Send email with PDF attachment
    const { provider } = getEmailConfig();
    if (provider === 'resend') {
      await sendViaResend({ to: email, subject, html, pdfBuffer, filename });
    } else {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@neucyn.com',
        to: email,
        subject,
        html,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });
    }

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
module.exports.generatePDF = generatePDF;
