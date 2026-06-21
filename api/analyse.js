export const config = {
  maxDuration: 60, // allow up to 60s for thorough Vedic analysis
};

export default async function handler(req, res) {
  // CORS — allow requests from same origin (Vercel deployment)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not configured. Please add it in your Vercel project environment variables.',
    });
  }

  const { systemPrompt, userPrompt } = req.body;

  if (!systemPrompt || !userPrompt) {
    return res.status(400).json({ error: 'Missing systemPrompt or userPrompt in request body.' });
  }

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
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.error?.message || `Anthropic API error ${response.status}`;
      return res.status(response.status).json({ error: msg });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || '';

    if (!text) {
      return res.status(500).json({ error: 'Empty response received from Claude. Please try again.' });
    }

    return res.status(200).json({ analysis: text });
  } catch (err) {
    console.error('Kundli analysis error:', err);
    return res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
}
