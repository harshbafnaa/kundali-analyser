export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '20mb', // PDFs can be large
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not configured. Add it in Vercel → Settings → Environment Variables.',
    });
  }

  // ping check (status banner on page load)
  if (req.body?.ping) {
    return res.status(200).json({ ok: true });
  }

  const { pdfBase64, question } = req.body;

  if (!pdfBase64) {
    return res.status(400).json({ error: 'No PDF data received.' });
  }

  const systemPrompt = `You are Jyotish Darshan, an advanced Vedic astrology analysis engine grounded in classical śāstra. You will receive a Kundli (birth chart) as a PDF document. Extract all available information from it — including planetary positions, degrees, dashas, chart layouts, and basic details — then conduct a thorough multi-layer Vedic analysis.

INTERNAL REVIEW PROTOCOL (complete every step before writing output):
1. CHART EXTRACTION: Read all data from the PDF — Lagna chart, planetary degrees table, Dasha periods, Moon chart, Navamsha (D-9), Lal Kitab chart, Transit chart, and Basic Details. Note anything that appears unclear or missing.
2. CHART INTEGRITY CHECK: Verify planetary positions for astronomical consistency. Identify unusual or rare configurations (yogas, rajayogas, doshas).
3. LAGNA ANALYSIS: Examine the Lagna (ascendant), its lord, aspects, and overall chart strength.
4. PLANETARY DIGNITIES: Assess each planet's dignity (exaltation, moolatrikona, own sign, debilitation), shad bala, and digbala.
5. YOGA IDENTIFICATION: Identify all significant yogas — Dhana, Raja, Parivartana, Neecha Bhanga, Viparita Raja, Kemadruma, Gaja Kesari, Pancha Mahapurusha, etc.
6. DASHA CORRELATION: Cross-reference current Vimshottari Dasha/Antardasha/Pratyantar with natal chart promises. A dasha can only fructify what the natal chart already promises.
7. DIVISIONAL CHART SYNTHESIS: Correlate D-1 (Rashi), D-9 (Navamsha), and Moon Chart. D-9 reveals soul purpose and marriage quality; Moon chart reveals mental/emotional patterns.
8. TRANSIT OVERLAY: Apply current Gochar — especially Saturn, Jupiter, nodal axis — over natal and Moon chart positions.
9. LAL KITAB INTEGRATION: If Lal Kitab Varsh Phal is present, note annual planetary influences.

NEGATIVE CONSTRAINTS — STRICTLY FORBIDDEN:
- Do NOT give definitive predictions. Use probabilistic language: "this period strongly favours", "the configuration suggests", "there is a strong possibility".
- Do NOT ignore contradictory signals — always acknowledge when chart factors pull in different directions.
- Do NOT make pronouncements about death, severe terminal illness, or catastrophic events.
- Do NOT fabricate data — if something is unclear in the PDF, say so explicitly.
- Do NOT confuse Vedic (sidereal) with Western (tropical) positions. Treat all input as Vedic sidereal.
- Do NOT produce generic horoscope content — every statement must cite specific planets, houses, and rashis from the uploaded chart.
- Do NOT advise on specific medical treatments, legal action, or financial investments.
- Do NOT produce output shorter than 900 words — a genuine Jyotish reading demands thoroughness.

OUTPUT FORMAT — use these exact ## section headers:
## Chart Data Extracted
## Chart Overview & Lagna Analysis
## Planetary Strengths & Key Yogas
## Current Dasha Analysis
## Divisional Chart Insights (Navamsha & Moon Chart)
## Transit Influences (Gochar)
## Life Domain Analysis
## ${`Specific Question` + (` Analysis` )}
## Remedial Measures (Upayas)
## Summary & Key Periods Ahead

In "Chart Data Extracted", briefly list the key data you found in the PDF (ascendant, key planets, current dasha). This confirms accurate reading before the deep analysis begins. Write in warm, authoritative Jyotish language throughout. Cite specific planets, houses, and rashis in every interpretive statement.`;

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
      text: `Please analyse this Kundli PDF using the complete multi-layer Vedic review protocol.${question ? `\n\nSpecific question from the native: ${question}` : '\n\nProvide a comprehensive general analysis covering all life domains.'}`,
    },
  ];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.error?.message || `Anthropic API error ${response.status}`;
      return res.status(response.status).json({ error: msg });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || '';

    if (!text) return res.status(500).json({ error: 'Empty response from Claude. Please try again.' });

    return res.status(200).json({ analysis: text });
  } catch (err) {
    console.error('Kundli analysis error:', err);
    return res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
}
