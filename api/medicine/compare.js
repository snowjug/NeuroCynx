const toSafeText = (value = '') => String(value).replaceAll(/[\r\n\t]+/g, ' ').trim();

const extractMedicineName = (rawValue = '') => {
  const text = toSafeText(rawValue);
  if (!text) return '';
  return text.split('-')[0].trim();
};

const fetchJsonIfOk = async (url) => {
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json().catch(() => null);
};

const pickGenericFromRelated = (payload) => {
  const conceptGroups = Array.isArray(payload?.relatedGroup?.conceptGroup)
    ? payload.relatedGroup.conceptGroup
    : [];

  for (const group of conceptGroups) {
    const conceptProperties = Array.isArray(group?.conceptProperties) ? group.conceptProperties : [];
    const candidate = toSafeText(conceptProperties?.[0]?.name || '');
    if (candidate) {
      return candidate;
    }
  }

  return '';
};

const getRxNormData = async (medicineName) => {
  const encoded = encodeURIComponent(medicineName);
  const idPayload = await fetchJsonIfOk(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encoded}`);
  const rxcui = idPayload?.idGroup?.rxnormId?.[0];
  if (!rxcui) {
    return { hasMatch: false, medicine: medicineName, source: 'RxNorm' };
  }

  const propertiesPayload = await fetchJsonIfOk(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`);
  const matchedName = toSafeText(propertiesPayload?.properties?.name || medicineName);
  const relatedPayload = await fetchJsonIfOk(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=IN+PIN`);
  const genericName = pickGenericFromRelated(relatedPayload) || matchedName;

  return {
    medicine: medicineName,
    hasMatch: true,
    source: 'RxNorm',
    rxcui,
    matchedName,
    genericName
  };
};

const getRxNormDataSafely = async (medicineName) => {
  try {
    return await getRxNormData(medicineName);
  } catch (error) {
    return { hasMatch: false, medicine: medicineName, source: 'RxNorm', error: error?.message || 'Lookup failed' };
  }
};

async function medicineCompareHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for this endpoint.' } });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const inputMedicines = Array.isArray(body?.medicines) ? body.medicines : [];
    const medicines = inputMedicines
      .map((item) => extractMedicineName(item))
      .filter(Boolean)
      .slice(0, 12);

    if (!medicines.length) {
      return res.status(200).json({ comparisons: [] });
    }

    const comparisons = await Promise.all(medicines.map((medicineName) => getRxNormDataSafely(medicineName)));

    return res.status(200).json({ comparisons });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'MEDICINE_COMPARE_FAILED',
        message: error?.message || 'Failed to compare medicines.'
      }
    });
  }
}

module.exports = medicineCompareHandler;
