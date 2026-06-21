// Vercel serverless config — must be top-level export
export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req, res) {
  // Always respond with JSON — never let plain text errors leak to the frontend
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed.' });

  // API key guard
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not set. Go to Vercel → your project → Settings → Environment Variables and add it, then redeploy.',
    });
  }

  // Ping / health check used by the status banner
  if (req.body?.ping) {
    return res.status(200).json({ ok: true });
  }

  const { pdfBase64, question } = req.body || {};

  if (!pdfBase64) {
    return res.status(400).json({ error: 'No PDF data received. Please upload a Kundli PDF.' });
  }

  // Validate it's plausibly base64 (not a raw error string)
  if (typeof pdfBase64 !== 'string' || pdfBase64.length < 100) {
    return res.status(400).json({ error: 'PDF data appears corrupt or too small. Please re-upload.' });
  }

  const systemPrompt = `You are Jyotish Darshan, an advanced Vedic astrology analysis engine grounded in classical shastra. You will receive a Kundli (birth chart) as a PDF document. Extract all available information from it — including planetary positions, degrees, dashas, chart layouts, and basic details — then conduct a thorough multi-layer Vedic analysis.

INTERNAL REVIEW PROTOCOL (complete every step before writing output):
1. CHART EXTRACTION: Read all data from the PDF — Lagna chart, planetary degrees table, Dasha periods, Moon chart, Navamsha (D-9), Lal Kitab chart, Transit chart, and Basic Details. Note anything unclear or missing.
2. CHART INTEGRITY CHECK: Verify planetary positions for astronomical consistency. Identify unusual or rare configurations (yogas, rajayogas, doshas).
3. LAGNA ANALYSIS: Examine the Lagna (ascendant), its lord, aspects, and overall chart strength.
4. PLANETARY DIGNITIES: Assess each planet's dignity (exaltation, moolatrikona, own sign, debilitation), shad bala, and digbala.
5. YOGA IDENTIFICATION: Identify all significant yogas — Dhana, Raja, Parivartana, Neecha Bhanga, Viparita Raja, Kemadruma, Gaja Kesari, Pancha Mahapurusha, etc.
6. DASHA CORRELATION: Cross-reference current Vimshottari Dasha/Antardasha/Pratyantar Dasha with natal chart promises. A dasha can only fructify what the natal chart already promises.
7. DIVISIONAL CHART SYNTHESIS: Correlate D-1 (Rashi), D-9 (Navamsha), and Moon Chart.
8. TRANSIT OVERLAY: Apply current Gochar — especially Saturn, Jupiter, nodal axis — over natal and Moon chart positions.
9. LAL KITAB INTEGRATION: If Lal Kitab Varsh Phal is present, note annual planetary influences.

NEGATIVE CONSTRAINTS — STRICTLY FORBIDDEN:
- Do NOT give definitive predictions. Use probabilistic language: "this period strongly favours", "the configuration suggests".
- Do NOT ignore contradictory signals — always acknowledge when chart factors pull in different directions.
- Do NOT make pronouncements about death, severe terminal illness, or catastrophic events.
- Do NOT fabricate data — if something is unclear in the PDF, say so explicitly.
- Do NOT confuse Vedic (sidereal) with Western (tropical) positions.
- Do NOT produce generic horoscope content — every statement must cite specific planets, houses, and rashis.
- Do NOT advise on specific medical treatments, legal action, or financial investments.
- Do NOT produce output shorter than 900 words.

OUTPUT FORMAT — use these exact ## section headers:
## Chart Data Extracted
## Chart Overview & Lagna Analysis
## Planetary Strengths & Key Yogas
## Current Dasha Analysis
## Divisional Chart Insights (Navamsha & Moon Chart)
## Transit Influences (Gochar)
## Life Domain Analysis
## Specific Question Analysis
## Remedial Measures (Upayas)
## Summary & Key Periods Ahead

In "Chart Data Extracted", list the key data found in the PDF (ascendant, key planets, current dasha) to confirm accurate reading before the deep analysis begins. Write in warm, authoritative Jyotish language. Cite specific planets, houses, and rashis in every interpretive statement.`;

  const userContent = [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: pdfBase64,
      },
    },
    {
      type: 'text',
      text: `Please analyse this Kundli PDF using the complete multi-layer Vedic review protocol.${
        question
          ? `\n\nSpecific question from the native: ${question}`
          : '\n\nProvide a comprehensive general analysis covering all life domains.'
      }`,
    },
  ];

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',   // required for PDF document blocks
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    // Read raw text first so we can always return valid JSON even if Anthropic sends non-JSON
    const rawText = await anthropicRes.text();

    let anthropicData;
    try {
      anthropicData = JSON.parse(rawText);
    } catch {
      console.error('Non-JSON response from Anthropic:', rawText.slice(0, 300));
      return res.status(502).json({
        error: `Unexpected response from Anthropic API (status ${anthropicRes.status}). Please try again in a moment.`,
      });
    }

    if (!anthropicRes.ok) {
      const msg = anthropicData?.error?.message || `Anthropic API error ${anthropicRes.status}`;
      return res.status(anthropicRes.status).json({ error: msg });
    }

    const analysisText = anthropicData?.content?.[0]?.text || '';
    if (!analysisText) {
      return res.status(500).json({ error: 'Claude returned an empty analysis. Please try again.' });
    }

    return res.status(200).json({ analysis: analysisText });

  } catch (err) {
    console.error('Kundli handler error:', err);
    return res.status(500).json({ error: `Server error: ${err.message || 'Unknown error. Please try again.'}` });
  }
}
