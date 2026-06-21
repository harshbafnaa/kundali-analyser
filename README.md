# 🪐 Jyotish Darshan — Vedic Kundli Analyser

A Vedic astrology analysis app powered by Claude (claude-sonnet-4-6), deployable on Vercel in under 5 minutes. The API key lives securely in a Vercel serverless function — never exposed to the browser.

---

## Project Structure

```
kundli-analyser/
├── api/
│   └── analyse.js        ← Vercel serverless function (holds your API key)
├── public/
│   └── index.html        ← Frontend UI
├── vercel.json           ← Routing config
├── package.json
└── .gitignore
```

---

## Deployment (5 steps)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "init: Jyotish Darshan kundli analyser"
git remote add origin https://github.com/YOUR_USERNAME/kundli-analyser.git
git push -u origin main
```

### 2. Import into Vercel

- Go to [vercel.com](https://vercel.com) → **Add New Project**
- Import your GitHub repository
- Framework Preset: **Other**
- Root Directory: leave as `.` (project root)
- Click **Deploy** (it will fail on first deploy — that's expected, API key not set yet)

### 3. Add the Environment Variable

In your Vercel project dashboard:

```
Settings → Environment Variables → Add New

Name:   ANTHROPIC_API_KEY
Value:  sk-ant-api03-xxxxxxxxxxxxxxxxxxxx
Environments: ✅ Production  ✅ Preview  ✅ Development
```

### 4. Redeploy

```
Deployments → (latest) → ⋯ → Redeploy
```

### 5. Done ✓

Your app is live at `https://your-project.vercel.app`

---

## Local Development

```bash
npm install
npx vercel dev
```

Create a `.env.local` file in the project root:

```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxx
```

Then open `http://localhost:3000`

---

## How It Works

- **Frontend** (`public/index.html`) collects all kundli data and sends it to `/api/analyse`
- **Serverless function** (`api/analyse.js`) reads `process.env.ANTHROPIC_API_KEY` and calls Anthropic's API server-side
- **Model**: `claude-sonnet-4-6` with `max_tokens: 4000` — deep reasoning, token-efficient
- **System prompt** enforces an 8-step internal review protocol (Chart Integrity → Lagna → Dignities → Yogas → Dasha → Divisional Charts → Transits → Lal Kitab) with strict negative constraints

---

## Input Fields

| Section | Fields |
|---|---|
| Birth Details | Name, DOB, TOB, Location |
| Lagna Chart | Free-text planetary positions |
| Planetary Degrees | Planet, House, Rashi, Deg-Min-Sec, Lord, Nakshatra, Char., Naks. Lord |
| Dasha | Mahadasha, Antardasha, Pratyantar Dasha + periods |
| Moon Chart | Free-text (Chandra Kundli) |
| Navamsha (D-9) | Free-text |
| Lal Kitab Varsh Phal | Free-text (optional) |
| Transit Chart | Free-text (current Gochar) |
| Basic Details | Ascendant, Moon Sign, Nakshatra, Namakshar, Lucky No/Col/Days, Friendly Nos, Lucky Stone |
| Question | Optional specific question for the Jyotishi |

---

## Notes

- For guidance only. Always consult a qualified Jyotishi for major life decisions.
- Analysis is based on Vedic sidereal system (not Western tropical).
