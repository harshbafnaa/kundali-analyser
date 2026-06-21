export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not set. Go to Vercel → Settings → Environment Variables and add it, then redeploy.',
    });
  }

  if (req.body?.ping) {
    return res.status(200).json({ ok: true });
  }

  const { pdfBase64, question } = req.body || {};

  if (!pdfBase64 || typeof pdfBase64 !== 'string' || pdfBase64.length < 100) {
    return res.status(400).json({ error: 'No valid PDF data received. Please upload your Kundli PDF.' });
  }

  const systemPrompt = `You are Jyotish Darshan, an advanced Vedic astrology analysis engine grounded in classical shastra. You will receive a Kundli (birth chart) as a PDF document. Extract all available information from it then conduct a thorough multi-layer Vedic analysis.

INTERNAL REVIEW PROTOCOL (complete every step before writing output):
1. CHART EXTRACTION: Read all data — Lagna chart, planetary degrees, Dasha periods, Moon chart, Navamsha (D-9), Lal Kitab, Transit chart, Basic Details.
2. CHART INTEGRITY CHECK: Verify planetary positions. Identify yogas, rajayogas, doshas.
3. LAGNA ANALYSIS: Examine the Lagna, its lord, aspects, chart strength.
4. PLANETARY DIGNITIES: Assess dignity (exaltation, moolatrikona, own sign, debilitation), shad bala, digbala.
5. YOGA IDENTIFICATION: Dhana, Raja, Parivartana, Neecha Bhanga, Viparita Raja, Kemadruma, Gaja Kesari, Pancha Mahapurusha, etc.
6. DASHA CORRELATION: Cross-reference current Vimshottari Dasha/Antardasha/Pratyantar with natal promises.
7. DIVISIONAL CHART SYNTHESIS: Correlate D-1, D-9 (Navamsha), Moon Chart.
8. TRANSIT OVERLAY: Saturn, Jupiter, nodal axis over natal and Moon chart.
9. LAL KITAB INTEGRATION: If Varsh Phal present, note annual influences.

NEGATIVE CONSTRAINTS:
- Use probabilistic language only — never definitive predictions.
- Acknowledge contradictory signals.
- No pronouncements about death or catastrophic events.
- Do not fabricate data — flag unclear PDF sections.
- Treat all positions as Vedic sidereal.
- Every statement must cite specific planets, houses, rashis.
- No medical, legal, or specific financial advice.

OUTPUT FORMAT — use these ## section headers:
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

Start with "Chart Data Extracted" listing ascendant, key planets, current dasha to confirm accurate reading. Be thorough and cite specific chart factors throughout.`;

  const userContent = [
    {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
    },
    {
      type: 'text',
      text: `Analyse this Kundli PDF using the full Vedic review protocol.${
        question ? `\n\nSpecific question from the native: ${question}` : '\n\nProvide a comprehensive general analysis.'
      }`,
    },
  ];

  try {
    // ── STREAMING request to Anthropic ──
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        stream: true,           // ← streaming keeps connection alive, avoids 504
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      let msg = `Anthropic API error ${anthropicRes.status}`;
      try { msg = JSON.parse(errText)?.error?.message || msg; } catch {}
      return res.status(anthropicRes.status).json({ error: msg });
    }

    // ── Stream SSE from Anthropic → collect full text → return JSON ──
    // Vercel hobby functions can't do true HTTP streaming back to browser,
    // but streaming FROM Anthropic prevents the upstream timeout.
    const reader = anthropicRes.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            fullText += parsed.delta.text;
          }
        } catch { /* skip malformed SSE lines */ }
      }
    }

    if (!fullText) {
      return res.status(500).json({ error: 'Empty analysis received. Please try again.' });
    }

    return res.status(200).json({ analysis: fullText });

  } catch (err) {
    console.error('Kundli handler error:', err);
    return res.status(500).json({ error: `Server error: ${err.message || 'Please try again.'}` });
  }
}
