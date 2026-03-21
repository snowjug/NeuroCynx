# Email PDF Report Setup Guide

## What Changed?
Your NeuroCynx app now generates **beautiful PDF reports** with:
- ✅ SWOT Analysis (Strengths, Weaknesses, Opportunities, Threats)
- ✅ Health Radar Spider Chart (visual health metrics)
- ✅ Patient information and summary
- ✅ Care recommendations, medications, lifestyle tips
- ✅ Professional PDF formatting
- ✅ Sent as email attachment to patients

## Required Setup - SMTP Email Service

To send emails with PDF reports, you need an SMTP email service. Choose one:

### Option 1: Gmail (Easiest for Testing)
1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Copy the 16-character password
3. **Update your `.env` file**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=your-email@gmail.com
```

### Option 2: SendGrid (Recommended for Production)
1. **Create SendGrid Account**: https://sendgrid.com (Free tier: 100 emails/day)
2. **Create API Key**:
   - Go to Settings → API Keys
   - Create a new API key
3. **Update your `.env` file**:
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-actual-api-key-here
SMTP_FROM=noreply@yourdomain.com
```

### Option 3: Mailgun
1. **Create Mailgun Account**: https://www.mailgun.com (Free tier: 5000 emails/month)
2. **Get SMTP Credentials** from Dashboard
3. **Update your `.env` file**:
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
SMTP_FROM=noreply@your-domain.mailgun.org
```

## Installation

```bash
# Already done - new dependencies installed:
npm install pdfkit canvas nodemailer
```

## Testing the Email Feature

1. **Start your server**:
```bash
node server.js
```

2. **Upload a medical report** in the app
3. **Enter patient email** in the form
4. **Click "Email Report"**
5. **Check the patient's email inbox** for the PDF

## How It Works

When a patient clicks "Email Report":
1. The app collects all analysis data (summary, SWOT, metrics)
2. A **server-side PDF** is generated with:
   - Radar chart as embedded image
   - Formatted SWOT analysis
   - Health metrics table
   - All recommendations
3. PDF is attached to email
4. Email is sent via SMTP

## Troubleshooting

### "Email service is not configured"
**Solution**: Make sure these are in your `.env` file:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

### "Email send failed"
**Common causes**:
- Wrong SMTP credentials
- Gmail: Using regular password instead of App Password
- Firewall blocking port 587
- SMTP service is down

**Debug**: Check your server logs for detailed error messages.

### "Canvas library error"
**Solution**: Ensure canvas is installed:
```bash
npm install canvas --build-from-source
```

## What Gets Included in the PDF?

1. **Header** - NeuCyn branding + patient name + date
2. **Summary** - AI-generated health assessment
3. **Health Radar** - Visual spider chart of 5 health metrics
4. **Metrics Table** - Detailed scores for each health metric
5. **SWOT Analysis** - Color-coded sections
   - 🟢 Strengths (green)
   - 🟡 Weaknesses (orange)
   - 🔵 Opportunities (blue)
   - 🔴 Threats (red)
6. **Care Recommendations** - Doctor-recommended actions
7. **Medications** - Medication guidance with disclaimer
8. **Lifestyle Tips** - Daily health recommendations
9. **Footer** - Disclaimer about AI assistance

## Security Notes

✅ PDFs are generated on-the-fly (not stored)
✅ Only sent to the email address the patient provides
✅ SMTP credentials are environment variables (never in code)
✅ Always include medical disclaimer (already included)

## Next Steps

1. ✅ Choose an SMTP service above
2. ✅ Add credentials to `.env` file
3. ✅ Test with your own email
4. ✅ Deploy with confidence!

---

**Questions?** Check server logs:
```bash
# Server will show detailed error messages if setup fails
```
