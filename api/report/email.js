const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const { createCanvas } = require('canvas');
const { Resend } = require('resend');

const sanitizeSender = (value = '') => String(value).replaceAll(/[\r\n\t]+/g, ' ').trim();

const extractSenderEmail = (value = '') => {
  const input = String(value).trim();
  const displayMatch = /<([^>]+)>/.exec(input);
  return (displayMatch ? displayMatch[1] : input).trim().toLowerCase();
};

const isValidSender = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractSenderEmail(value));

const getEmailConfig = () => {
  const configuredProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim();
  const apiKey = process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY || '';
  const rawFrom = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@neucyn.tech';
  let from = sanitizeSender(rawFrom);

  // Auto-correct known wrong domain typo if present in old configs.
  if (/@neucyn\.com\b/i.test(from)) {
    from = from.replaceAll(/@neucyn\.com/gi, '@neucyn.tech');
  }

  if (!isValidSender(from)) {
    from = 'no-reply@neucyn.tech';
  }

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
    const errorDetail = error.message || JSON.stringify(error);
    console.error('Resend API Error:', { error: errorDetail, from, to });
    throw new Error(`Resend failed: ${errorDetail}. Verify (1) API key is valid, (2) sender domain "${from}" is verified in Resend.`);
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

    const size = 760;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = 250;
    const levels = 5;
    const angleSlice = (Math.PI * 2) / points.length;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const plotPoints = points.map((item, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const score = Math.max(0, Math.min(100, Number(item?.score) || 0));
      const radius = (maxRadius * score) / 100;
      return {
        label: String(item?.label || `Metric ${i + 1}`),
        score,
        angle,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

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

      const tickValue = String((100 / levels) * level);
      ctx.font = 'bold 13px Arial';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(tickValue, centerX + 6, centerY - radius);
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
      const labelX = centerX + (maxRadius + 54) * Math.cos(angle);
      const labelY = centerY + (maxRadius + 54) * Math.sin(angle);
      ctx.font = 'bold 17px Arial';
      ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, labelX, labelY);

      const score = Math.max(0, Math.min(100, Number(points[i]?.score) || 0));
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = '#1d4ed8';
      ctx.fillText(`${Math.round(score)}`, labelX, labelY + 18);
    }

    ctx.beginPath();
    for (let i = 0; i < plotPoints.length; i++) {
      const { x, y } = plotPoints[i];
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

    for (const point of plotPoints) {
      const { x, y } = point;
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

      const accentColor = '#1d4ed8';
      const accentLight = '#eff6ff';
      const textPrimary = '#111827';
      const textSecondary = '#4b5563';
      const borderColor = '#dbe3ef';
      const pageLeft = doc.page.margins.left;
      const pageRight = doc.page.width - doc.page.margins.right;
      const contentWidth = pageRight - pageLeft;

      const ensureSpace = (minSpace) => ensureSpaceFor(doc, minSpace, doc.page.margins.bottom);

      const drawDivider = () => {
        doc.strokeColor(borderColor).lineWidth(1).moveTo(pageLeft, doc.y).lineTo(pageRight, doc.y).stroke();
      };

      const drawSectionTitle = (title) => {
        ensureSpace(28);
        doc.moveDown(0.15);
        doc.font('Helvetica-Bold').fontSize(13).fillColor(textPrimary).text(title, pageLeft, doc.y, { width: contentWidth });
        doc.moveDown(0.2);
      };

      const drawBulletList = (items, { prefix = '•', color = textSecondary, maxItemLength = 160 } = {}) => {
        if (!Array.isArray(items) || items.length === 0) {
          doc.font('Helvetica').fontSize(10).fillColor(textSecondary).text('Not available', pageLeft, doc.y, { width: contentWidth });
          doc.moveDown(0.4);
          return;
        }

        items.forEach((item) => {
          ensureSpace(18);
          doc.font('Helvetica').fontSize(10).fillColor(color).text(`${prefix} ${String(item).substring(0, maxItemLength)}`, pageLeft + 2, doc.y, { width: contentWidth - 8 });
        });
        doc.moveDown(0.35);
      };

      const drawHighlightCards = (metrics) => {
        if (!Array.isArray(metrics) || metrics.length === 0) {
          return;
        }

        const normalized = metrics
          .map((m) => ({ label: String(m?.label || 'Metric'), score: Math.max(0, Math.min(100, Math.round(Number(m?.score) || 0))) }))
          .sort((a, b) => b.score - a.score);

        const average = Math.round(normalized.reduce((sum, item) => sum + item.score, 0) / normalized.length);
        const best = normalized[0];
        const focus = normalized.at(-1);

        const cards = [
          { title: 'Overall Score', value: `${average}/100`, note: average >= 75 ? 'Strong overall profile' : 'Needs closer follow-up', color: '#1d4ed8', bg: '#eff6ff' },
          { title: 'Top Strength', value: `${best.label}: ${best.score}`, note: 'Best performing health dimension', color: '#059669', bg: '#ecfdf5' },
          { title: 'Focus Area', value: `${focus.label}: ${focus.score}`, note: 'Prioritize this for improvement', color: '#d97706', bg: '#fffbeb' }
        ];

        const gap = 10;
        const cardWidth = (contentWidth - (gap * 2)) / 3;
        const cardHeight = 72;
        ensureSpace(cardHeight + 10);
        const y = doc.y;

        cards.forEach((card, index) => {
          const x = pageLeft + (index * (cardWidth + gap));
          doc.roundedRect(x, y, cardWidth, cardHeight, 8).fill(card.bg).strokeColor('#dbe3ef').lineWidth(1).stroke();
          doc.fillColor(card.color).font('Helvetica-Bold').fontSize(9).text(card.title, x + 10, y + 10, { width: cardWidth - 20 });
          doc.fillColor(textPrimary).font('Helvetica-Bold').fontSize(11).text(card.value, x + 10, y + 26, { width: cardWidth - 20 });
          doc.fillColor(textSecondary).font('Helvetica').fontSize(8).text(card.note, x + 10, y + 45, { width: cardWidth - 20 });
        });

        doc.y = y + cardHeight + 10;
      };

      const getRiskMeta = (metrics) => {
        const list = Array.isArray(metrics) ? metrics : [];
        if (!list.length) {
          return { label: 'Unknown', score: 0, color: '#6b7280', bg: '#f3f4f6' };
        }

        const mean = Math.round(list.reduce((sum, item) => sum + Math.max(0, Math.min(100, Math.round(Number(item?.score) || 0))), 0) / list.length);
        if (mean >= 80) {
          return { label: 'Low Risk', score: mean, color: '#065f46', bg: '#ecfdf5' };
        }
        if (mean >= 60) {
          return { label: 'Moderate Risk', score: mean, color: '#92400e', bg: '#fffbeb' };
        }
        return { label: 'High Risk', score: mean, color: '#991b1b', bg: '#fef2f2' };
      };

      // Header band
      const headerTop = doc.y;
      doc.roundedRect(pageLeft, headerTop, contentWidth, 84, 10).fill('#0f172a');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text('NeuCyn', pageLeft + 18, headerTop + 14);
      doc.font('Helvetica').fontSize(11).fillColor('#cbd5e1').text('Professional Health Analysis Report', pageLeft + 18, headerTop + 46);
      doc.font('Helvetica').fontSize(10).fillColor('#93c5fd').text(`Generated ${new Date().toLocaleString()}`, pageLeft + 18, headerTop + 62);
      doc.y = headerTop + 100;

      // Patient card
      ensureSpace(56);
      const patientCardY = doc.y;
      doc.roundedRect(pageLeft, patientCardY, contentWidth, 50, 8).fill(accentLight).strokeColor('#bfdbfe').lineWidth(1).stroke();
      doc.fillColor(textPrimary).font('Helvetica-Bold').fontSize(10).text('Patient', pageLeft + 12, patientCardY + 10);
      doc.fillColor(textSecondary).font('Helvetica').fontSize(11).text(toPlainText(patientName || 'Patient'), pageLeft + 12, patientCardY + 24, { width: contentWidth - 24 });

      const riskMeta = getRiskMeta(Array.isArray(analysis?.graph) ? analysis.graph : []);
      const riskPillWidth = 138;
      const riskPillX = pageRight - riskPillWidth - 10;
      doc.roundedRect(riskPillX, patientCardY + 10, riskPillWidth, 30, 14).fill(riskMeta.bg).strokeColor('#bfdbfe').lineWidth(1).stroke();
      doc.fillColor(riskMeta.color).font('Helvetica-Bold').fontSize(9).text(`${riskMeta.label} • ${riskMeta.score}/100`, riskPillX + 10, patientCardY + 20, { width: riskPillWidth - 20, align: 'center' });
      doc.y = patientCardY + 62;

      // Summary
      drawSectionTitle('Executive Summary');
      doc.font('Helvetica').fontSize(10).fillColor(textSecondary);
      const summary = String(analysis?.summary || '').trim();
      doc.text(summary || 'No summary available.', pageLeft, doc.y, { width: contentWidth, align: 'left' });
      doc.moveDown(0.4);
      drawHighlightCards(Array.isArray(analysis?.graph) ? analysis.graph : []);
      doc.moveDown(0.5);
      drawDivider();
      doc.moveDown(0.5);

      // Chart
      drawSectionTitle('Health Radar');
      if (chartBuffer) {
        ensureSpace(340);
        const chartWidth = 320;
        const chartX = pageLeft + (contentWidth - chartWidth) / 2;
        doc.image(chartBuffer, chartX, doc.y, { fit: [chartWidth, chartWidth], align: 'center' });
        doc.y += chartWidth + 10;
      } else {
        doc.font('Helvetica').fontSize(10).fillColor(textSecondary).text('Radar chart could not be generated from provided data.', pageLeft, doc.y, { width: contentWidth });
        doc.moveDown(0.3);
      }

      drawDivider();
      doc.moveDown(0.6);

      // Metrics table
      drawSectionTitle('Metrics Overview');
      const metrics = Array.isArray(analysis?.graph) ? analysis.graph : [];
      ensureSpace(34);
      const tableTop = doc.y;
      doc.roundedRect(pageLeft, tableTop, contentWidth, 26, 6).fill('#f8fafc').strokeColor(borderColor).lineWidth(1).stroke();
      doc.font('Helvetica-Bold').fontSize(10).fillColor(textPrimary).text('Metric', pageLeft + 12, tableTop + 8, { width: contentWidth - 100 });
      doc.text('Score', pageRight - 72, tableTop + 8, { width: 60, align: 'right' });
      doc.y = tableTop + 32;

      metrics.forEach((metric) => {
        ensureSpace(24);
        const label = String(metric?.label || 'Metric').substring(0, 60);
        const score = Math.max(0, Math.min(100, Math.round(Number(metric?.score) || 0)));
        const rowTop = doc.y;
        doc.rect(pageLeft, rowTop, contentWidth, 22).fill('#ffffff').strokeColor(borderColor).lineWidth(1).stroke();
        doc.font('Helvetica').fontSize(10).fillColor(textSecondary).text(label, pageLeft + 12, rowTop + 6, { width: contentWidth - 100 });
        doc.font('Helvetica-Bold').fontSize(10).fillColor(accentColor).text(`${score}/100`, pageRight - 72, rowTop + 6, { width: 60, align: 'right' });
        doc.y = rowTop + 24;
      });

      doc.moveDown(0.3);
      drawDivider();
      doc.moveDown(0.6);

      // SWOT
      if (analysis?.swot && typeof analysis.swot === 'object') {
        drawSectionTitle('SWOT Analysis');

        const swotSections = [
          { title: 'Strengths', items: analysis.swot.strengths, color: '#059669', bg: '#ecfdf5' },
          { title: 'Weaknesses', items: analysis.swot.weaknesses, color: '#d97706', bg: '#fffbeb' },
          { title: 'Opportunities', items: analysis.swot.opportunities, color: '#2563eb', bg: '#eff6ff' },
          { title: 'Threats', items: analysis.swot.threats, color: '#dc2626', bg: '#fef2f2' }
        ];

        const gap = 12;
        const cardWidth = (contentWidth - gap) / 2;
        const cardHeight = 130;

        for (let i = 0; i < swotSections.length; i += 2) {
          ensureSpace(cardHeight + 12);
          const rowY = doc.y;

          for (let j = 0; j < 2; j++) {
            const section = swotSections[i + j];
            if (!section) {
              continue;
            }

            const x = pageLeft + (j * (cardWidth + gap));
            doc.roundedRect(x, rowY, cardWidth, cardHeight, 8).fill(section.bg).strokeColor('#dbe3ef').lineWidth(1).stroke();
            doc.fillColor(section.color).font('Helvetica-Bold').fontSize(11).text(section.title, x + 10, rowY + 10, { width: cardWidth - 20 });

            const lines = Array.isArray(section.items) && section.items.length > 0
              ? section.items.slice(0, 3).map((item) => `• ${String(item).substring(0, 54)}`)
              : ['• Not available'];

            doc.fillColor(textSecondary).font('Helvetica').fontSize(9).text(lines.join('\n'), x + 10, rowY + 28, {
              width: cardWidth - 20,
              height: cardHeight - 36
            });
          }

          doc.y = rowY + cardHeight + 10;
        }

        drawDivider();
        doc.moveDown(0.6);
      }

      // Recommendations
      drawSectionTitle('Care Recommendations');
      drawBulletList(analysis?.care, { maxItemLength: 180 });

      drawSectionTitle('Medication Guidance');
      drawBulletList(analysis?.medicine, { prefix: 'Rx', maxItemLength: 180 });
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#6b7280').text('Always consult a licensed physician before taking medications.', pageLeft, doc.y, { width: contentWidth });
      doc.moveDown(0.5);

      drawSectionTitle('Lifestyle Recommendations');
      drawBulletList(analysis?.lifestyle, { maxItemLength: 180 });

      // Footer
      ensureSpace(60);
      drawDivider();
      doc.moveDown(0.45);
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('This report is AI-assisted and should not replace professional medical diagnosis or treatment.', pageLeft, doc.y, { width: contentWidth, align: 'center' });
      doc.moveDown(0.15);
      doc.text(`Report Generated: ${new Date().toLocaleString()}`, pageLeft, doc.y, { width: contentWidth, align: 'center' });

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);

        doc.save();
        doc.fillColor('#94a3b8');
        doc.opacity(0.07);
        doc.rotate(-32, { origin: [doc.page.width / 2, doc.page.height / 2] });
        doc.font('Helvetica-Bold').fontSize(56).text('NEUCYN CONFIDENTIAL', 70, doc.page.height / 2 - 28, {
          width: doc.page.width - 140,
          align: 'center'
        });
        doc.restore();

        doc.save();
        doc.fillColor('#94a3b8').font('Helvetica').fontSize(8);
        doc.text(`Page ${i + 1} of ${range.count}`, pageLeft, doc.page.height - doc.page.margins.bottom + 8, {
          width: contentWidth,
          align: 'right'
        });
        doc.restore();
      }

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
    const { provider, from } = getEmailConfig();
    if (provider === 'resend') {
      await sendViaResend({ to: email, subject, html, pdfBuffer, filename });
    } else {
      const transporter = createTransporter();
      await transporter.sendMail({
        from,
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
