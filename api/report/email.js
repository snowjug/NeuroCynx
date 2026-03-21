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

const getReportInsights = (graphData) => {
  const metrics = Array.isArray(graphData)
    ? graphData.map((item) => ({
      label: String(item?.label || 'Metric'),
      score: Math.max(0, Math.min(100, Math.round(Number(item?.score) || 0)))
    }))
    : [];

  if (!metrics.length) {
    return {
      metrics,
      average: 0,
      riskLabel: 'Unknown Risk',
      topStrength: 'Not available',
      focusArea: 'Not available'
    };
  }

  const sorted = [...metrics].sort((a, b) => b.score - a.score);
  const average = Math.round(metrics.reduce((sum, item) => sum + item.score, 0) / metrics.length);
  let riskLabel = 'High Risk';
  if (average >= 80) {
    riskLabel = 'Low Risk';
  } else if (average >= 60) {
    riskLabel = 'Moderate Risk';
  }

  return {
    metrics,
    average,
    riskLabel,
    topStrength: `${sorted[0].label} (${sorted[0].score})`,
    focusArea: `${sorted.at(-1).label} (${sorted.at(-1).score})`
  };
};

const buildResendTemplateHtml = ({
  patientName,
  reportId,
  dateText,
  reportUrl,
  unsubscribeUrl,
  status,
  riskLabel,
  riskScore,
  topStrength,
  focusArea
}) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Neucyn Report</title>
</head>
<body style="margin:0;padding:0;background:#e9eef7;font-family:Arial,sans-serif;">
  <div style="max-width:620px;margin:24px auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbe3ef;box-shadow:0 10px 30px rgba(2,6,23,0.06);">
    <div style="background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;padding:24px 22px;">
      <h1 style="margin:0;font-size:24px;letter-spacing:0.3px;">Neucyn Report</h1>
      <div style="font-size:13px;opacity:0.9;margin-top:6px;">Automated Health Insight Delivery</div>
      <div style="margin-top:14px;display:inline-block;background:rgba(255,255,255,0.16);padding:7px 12px;border-radius:999px;font-size:12px;font-weight:bold;">
        ${escapeHtml(riskLabel)} • ${escapeHtml(String(riskScore))}/100
      </div>
    </div>

    <div style="padding:24px 22px;color:#1f2937;line-height:1.6;">
      <h2>Hello ${escapeHtml(patientName)},</h2>
      <p>Your requested report from <strong>neucyn.tech</strong> is ready. A full PDF is attached to this email.</p>

      <div style="background:#f8fbff;border:1px solid #d9e7ff;border-radius:10px;padding:16px;margin:18px 0 14px 0;">
        <div style="font-weight:bold;margin-bottom:10px;font-size:15px;color:#0f172a;">Report Summary</div>

        <div style="display:flex;justify-content:space-between;margin:6px 0;font-size:14px;"><span>Report ID</span><span>${escapeHtml(reportId)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:6px 0;font-size:14px;"><span>Date Generated</span><span>${escapeHtml(dateText)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:6px 0;font-size:14px;"><span>Status</span><span>${escapeHtml(status)}</span></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 16px 0;">
        <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;padding:10px;">
          <div style="font-size:12px;color:#065f46;font-weight:bold;">Top Strength</div>
          <div style="font-size:13px;color:#1f2937;margin-top:3px;">${escapeHtml(topStrength)}</div>
        </div>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;">
          <div style="font-size:12px;color:#92400e;font-weight:bold;">Focus Area</div>
          <div style="font-size:13px;color:#1f2937;margin-top:3px;">${escapeHtml(focusArea)}</div>
        </div>
      </div>

      <p>You can view the full detailed report using the button below:</p>

      <a href="${escapeHtml(reportUrl)}" style="display:inline-block;margin-top:10px;padding:12px 18px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">View Full Report</a>

      <p style="margin-top:25px;">If you did not request this report, please ignore this email or contact support.</p>

      <p>- Team Neucyn</p>
    </div>

    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;background:#f8fafc;">
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

    const size = 600;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = 200;
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
  const insights = getReportInsights(analysis?.graph);

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

      const getRiskMeta = (riskLabel, score) => {
        if (riskLabel === 'Low Risk') {
          return { label: riskLabel, score, color: '#065f46', bg: '#ecfdf5' };
        }
        if (riskLabel === 'Moderate Risk') {
          return { label: riskLabel, score, color: '#92400e', bg: '#fffbeb' };
        }
        if (riskLabel === 'High Risk') {
          return { label: riskLabel, score, color: '#991b1b', bg: '#fef2f2' };
        }
        return { label: 'Unknown Risk', score: 0, color: '#6b7280', bg: '#f3f4f6' };
      };

      // Cover page
      const coverTop = doc.y;
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8fafc');
      doc.roundedRect(pageLeft, coverTop + 20, contentWidth, 170, 14).fill('#0f172a');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(36).text('NeuCyn', pageLeft + 22, coverTop + 52);
      doc.fillColor('#93c5fd').font('Helvetica').fontSize(14).text('Comprehensive Health Intelligence Report', pageLeft + 22, coverTop + 98);
      doc.fillColor('#cbd5e1').font('Helvetica').fontSize(11).text(`Generated ${new Date().toLocaleString()}`, pageLeft + 22, coverTop + 122);

      const coverRisk = getRiskMeta(insights.riskLabel, insights.average);
      doc.roundedRect(pageLeft, coverTop + 216, contentWidth, 84, 10).fill('#ffffff').strokeColor('#dbe3ef').lineWidth(1).stroke();
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text('Patient', pageLeft + 16, coverTop + 230);
      doc.fillColor('#4b5563').font('Helvetica').fontSize(12).text(toPlainText(patientName || 'Patient'), pageLeft + 16, coverTop + 246);
      doc.roundedRect(pageRight - 170, coverTop + 232, 154, 28, 14).fill(coverRisk.bg).strokeColor('#bfdbfe').lineWidth(1).stroke();
      doc.fillColor(coverRisk.color).font('Helvetica-Bold').fontSize(10).text(`${coverRisk.label} • ${coverRisk.score}/100`, pageRight - 162, coverTop + 242, { width: 138, align: 'center' });

      doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(14).text('Key Highlights', pageLeft, coverTop + 326);
      doc.roundedRect(pageLeft, coverTop + 352, contentWidth, 92, 8).fill('#ffffff').strokeColor('#dbe3ef').lineWidth(1).stroke();
      doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(11).text(`Top Strength: ${insights.topStrength}`, pageLeft + 14, coverTop + 370, { width: contentWidth - 28 });
      doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(11).text(`Focus Area: ${insights.focusArea}`, pageLeft + 14, coverTop + 392, { width: contentWidth - 28 });
      doc.fillColor('#4b5563').font('Helvetica').fontSize(10).text('Detailed chart analysis, SWOT, and recommendations follow on next pages.', pageLeft + 14, coverTop + 415, { width: contentWidth - 28 });

      doc.addPage();
      doc.y = doc.page.margins.top;

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

      const riskMeta = getRiskMeta(insights.riskLabel, insights.average);
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
      drawHighlightCards(insights.metrics);
      doc.moveDown(0.5);
      drawDivider();
      doc.moveDown(0.5);

      // Chart with legend
      drawSectionTitle('Health Radar');
      if (chartBuffer) {
        ensureSpace(340);
        const chartWidth = 220;
        const chartX = pageLeft + (contentWidth - chartWidth) / 2;
        doc.image(chartBuffer, chartX, doc.y, { fit: [chartWidth, chartWidth], align: 'center' });
        doc.y += chartWidth + 8;

        // Legend below chart - compact format
        const metrics = Array.isArray(analysis?.graph) ? analysis.graph : [];
        if (metrics.length > 0) {
          doc.moveDown(0.2);
          const legendItemsPerRow = 2;
          const legendColWidth = contentWidth / legendItemsPerRow;
          let legendIndex = 0;
          
          for (let i = 0; i < Math.ceil(metrics.length / legendItemsPerRow); i++) {
            const legendY = doc.y;
            for (let j = 0; j < legendItemsPerRow && legendIndex < metrics.length; j++) {
              const metric = metrics[legendIndex];
              const score = Math.max(0, Math.min(100, Math.round(Number(metric?.score) || 0)));
              const label = String(metric?.label || 'Metric').substring(0, 24);
              const x = pageLeft + (j * legendColWidth);
              
              doc.font('Helvetica').fontSize(8.5).fillColor(textSecondary)
                .text(`${label}: ${score}`, x + 2, legendY, { width: legendColWidth - 4 });
              legendIndex++;
            }
            doc.moveDown(0.25);
          }
        }
      } else {
        doc.font('Helvetica').fontSize(10).fillColor(textSecondary).text('Radar chart could not be generated from provided data.', pageLeft, doc.y, { width: contentWidth });
        doc.moveDown(0.3);
      }

      doc.moveDown(0.2);
      drawDivider();
      doc.moveDown(0.6);

      // Metrics table - keep together on same page
      drawSectionTitle('Metrics Overview');
      const metrics = Array.isArray(analysis?.graph) ? analysis.graph : [];
      const metricsTableHeight = 34 + (metrics.length * 24);
      ensureSpace(metricsTableHeight + 10);
      
      const tableTop = doc.y;
      doc.roundedRect(pageLeft, tableTop, contentWidth, 26, 6).fill('#f8fafc').strokeColor(borderColor).lineWidth(1).stroke();
      doc.font('Helvetica-Bold').fontSize(10).fillColor(textPrimary).text('Metric', pageLeft + 12, tableTop + 8, { width: contentWidth - 100 });
      doc.text('Score', pageRight - 72, tableTop + 8, { width: 60, align: 'right' });
      doc.y = tableTop + 32;

      metrics.forEach((metric) => {
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

      // SWOT - keep section together
      if (analysis?.swot && typeof analysis.swot === 'object') {
        const swotHeight = 28 + (2 * 170);
        ensureSpace(swotHeight + 10);
        drawSectionTitle('SWOT Analysis');

        const swotSections = [
          { title: 'Strengths', items: analysis.swot.strengths, color: '#059669', bg: '#ecfdf5' },
          { title: 'Weaknesses', items: analysis.swot.weaknesses, color: '#d97706', bg: '#fffbeb' },
          { title: 'Opportunities', items: analysis.swot.opportunities, color: '#2563eb', bg: '#eff6ff' },
          { title: 'Threats', items: analysis.swot.threats, color: '#dc2626', bg: '#fef2f2' }
        ];

        const gap = 12;
        const cardWidth = (contentWidth - gap) / 2;
        const cardHeight = 160;

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
            doc.fillColor(section.color).font('Helvetica-Bold').fontSize(12).text(section.title, x + 12, rowY + 12, { width: cardWidth - 24 });

            const lines = Array.isArray(section.items) && section.items.length > 0
              ? section.items.slice(0, 4).map((item) => `• ${String(item).substring(0, 52)}`)
              : ['• Not available'];

            doc.fillColor(textSecondary).font('Helvetica').fontSize(10).text(lines.join('\n'), x + 12, rowY + 34, {
              width: cardWidth - 24,
              height: cardHeight - 46
            });
          }

          doc.y = rowY + cardHeight + 10;
        }

        drawDivider();
        doc.moveDown(0.6);
      }

      // Recommendations with professional card styling - keep sections together
      drawSectionTitle('Care Recommendations');
      const careItems = Array.isArray(analysis?.care) ? analysis.care : [];
      
      if (careItems.length > 0) {
        ensureSpace(115);
        const careCardY = doc.y;
        doc.roundedRect(pageLeft, careCardY, contentWidth, 105, 8).fill('#f0f9ff').strokeColor('#0284c7').lineWidth(1.5).stroke();
        doc.fillColor('#0c4a6e').font('Helvetica-Bold').fontSize(11).text('Action Items & Monitoring', pageLeft + 12, careCardY + 10, { width: contentWidth - 24 });
        
        const careLines = careItems.slice(0, 3).map((item) => `• ${String(item).substring(0, 85)}`);
        doc.fillColor(textSecondary).font('Helvetica').fontSize(10).text(careLines.join('\n'), pageLeft + 12, careCardY + 30, {
          width: contentWidth - 24,
          height: 65
        });
        doc.y = careCardY + 108;
      } else {
        doc.font('Helvetica').fontSize(10).fillColor(textSecondary).text('No care recommendations available.', pageLeft, doc.y, { width: contentWidth });
        doc.moveDown(0.4);
      }

      doc.moveDown(0.5);

      drawSectionTitle('Medication Guidance');
      const medicineItems = Array.isArray(analysis?.medicine) ? analysis.medicine : [];
      
      if (medicineItems.length > 0) {
        ensureSpace(145);
        const medicineCardY = doc.y;
        doc.roundedRect(pageLeft, medicineCardY, contentWidth, 135, 8).fill('#fefce8').strokeColor('#ca8a04').lineWidth(1.5).stroke();
        doc.fillColor('#78350f').font('Helvetica-Bold').fontSize(11).text('Prescribed Medications', pageLeft + 12, medicineCardY + 10, { width: contentWidth - 24 });
        
        const medicineLines = medicineItems.slice(0, 3).map((item) => `Rx  ${String(item).substring(0, 75)}`);
        doc.fillColor(textSecondary).font('Helvetica').fontSize(10).text(medicineLines.join('\n'), pageLeft + 12, medicineCardY + 30, {
          width: contentWidth - 24,
          height: 85
        });
        
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#991b1b').text('Always consult a licensed physician before taking medications.', pageLeft + 12, medicineCardY + 120, { width: contentWidth - 24 });
        doc.y = medicineCardY + 138;
      } else {
        doc.font('Helvetica').fontSize(10).fillColor(textSecondary).text('No medication guidance available.', pageLeft, doc.y, { width: contentWidth });
        doc.moveDown(0.4);
      }

      doc.moveDown(0.5);

      drawSectionTitle('Lifestyle Recommendations');
      const lifestyleItems = Array.isArray(analysis?.lifestyle) ? analysis.lifestyle : [];
      if (lifestyleItems.length > 0) {
        ensureSpace(140);
        const lifestyleCardY = doc.y;
        doc.roundedRect(pageLeft, lifestyleCardY, contentWidth, 130, 8).fill('#f0fdf4').strokeColor('#16a34a').lineWidth(1.5).stroke();
        doc.fillColor('#166534').font('Helvetica-Bold').fontSize(11).text('Wellness & Daily Habits', pageLeft + 12, lifestyleCardY + 10, { width: contentWidth - 24 });
        
        const lifestyleLines = lifestyleItems.slice(0, 5).map((item) => `• ${String(item).substring(0, 75)}`);
        doc.fillColor(textSecondary).font('Helvetica').fontSize(10).text(lifestyleLines.join('\n'), pageLeft + 12, lifestyleCardY + 30, {
          width: contentWidth - 24,
          height: 90
        });
        doc.y = lifestyleCardY + 135;
      } else {
        doc.font('Helvetica').fontSize(10).fillColor(textSecondary).text('No lifestyle recommendations available.', pageLeft, doc.y, { width: contentWidth });
        doc.moveDown(0.4);
      }

      doc.moveDown(0.3);

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
        doc.fillColor('#94a3b8').font('Helvetica').fontSize(8);
        doc.text(`Page ${i + 1} of ${range.count}`, pageLeft, doc.page.height - doc.page.margins.bottom - 10, {
          width: contentWidth,
          align: 'right',
          lineBreak: false
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
    const insights = getReportInsights(analysis?.graph);

    const subject = 'Your NeuCyn Health Report';
    const reportId = `NCY-${Date.now().toString().slice(-8)}`;
    const html = buildResendTemplateHtml({
      patientName: toPlainText(patientName || 'Patient'),
      reportId,
      dateText: new Date().toLocaleString(),
      status: 'Generated',
      riskLabel: insights.riskLabel,
      riskScore: insights.average,
      topStrength: insights.topStrength,
      focusArea: insights.focusArea,
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
