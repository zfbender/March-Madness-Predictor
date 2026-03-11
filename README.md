# March Madness 2026 Predictor

A fully data-driven matchup analyzer for NCAA Men's Basketball. No AI, no paid APIs — 100% free, powered by ESPN's live stats.

---

## How to Run

```bash
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## Data Source

All data is pulled live from ESPN's unofficial public API:

```
https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball
```

- **Team list** (`/teams?limit=500`) — fetched once on app load, returns all 362 D1 programs with name, abbreviation, colors, and logo URL
- **Team stats** (`/teams/{id}/statistics`) — fetched on demand when you click "Analyze Matchup", returns season-long per-game averages
- **Team record** (`/teams/{id}`) — fetched alongside stats, returns win/loss record and `avgPointsAgainst`

**Logos** are not downloaded locally. The app stores the ESPN CDN URL and the browser loads the image directly from ESPN's servers at render time.

---

## What Each Display Section Means

### Predicted Winner & Projected Score

The winner is determined by comparing projected scores for each team.

**Formula:**
```
Projected Score (Team A) = (Team A PPG + Team B avgPointsAgainst) / 2
Projected Score (Team B) = (Team B PPG + Team A avgPointsAgainst) / 2
```

This averages how many points a team typically scores with how many their opponent typically allows. The team with the higher projected score is the predicted winner.

---

### Win Probability

Derived from the projected score margin.

**Formula:**
```
Margin = projectedScore(Team 1) - projectedScore(Team 2)
Raw probability = 50% + (margin × 3%)
Clamped to range: 5% – 95%
```

Each point of projected margin shifts the probability 3% away from 50/50. A 5-point margin = ~65% favorite. Capped at 95% so no matchup is ever treated as a guaranteed win.

---

### Upset Risk

Measures how close the matchup is — how likely the underdog can pull off a win.

**Formula:**
```
probGap = |winProbability - 50|
upsetRisk = 50 - (probGap × 0.8)
Clamped to range: 5% – 95%
```

A 50/50 matchup = 50% upset risk. A 95% favorite = ~5% upset risk. Color coded:
- 🟢 Green (`< 40%`) — Safe pick
- 🟡 Orange (`40–69%`) — Moderate risk
- 🔴 Red (`≥ 70%`) — High alert

---

### Stat Bars (Offense, Defense, Pace, Experience, Clutch)

Each stat is a **composite score from 0–100** representing where a team ranks relative to all of D1. The league-wide min/max ranges are hardcoded based on typical D1 bounds and used to normalize each raw ESPN stat to a percentile.

#### Offense (0–100)
How efficiently a team scores.
```
Offense = (PPG_normalized × 45%) + (FG%_normalized × 30%) + (3P%_normalized × 25%)
```
- **PPG** — Points per game (D1 range: 55–95)
- **FG%** — Field goal percentage (D1 range: 37–53%)
- **3P%** — Three-point percentage (D1 range: 26–42%)

#### Defense (0–100)
How well a team prevents the opponent from scoring.
```
Defense = (oppPPG_inverted × 50%) + (SPG × 25%) + (BPG × 15%) + (DRPG × 10%)
```
- **oppPPG** — Opponent points per game, *inverted* (lower is better; D1 range: 58–88)
- **SPG** — Steals per game (D1 range: 3–10)
- **BPG** — Blocks per game (D1 range: 0.5–6)
- **DRPG** — Defensive rebounds per game (D1 range: 17–30)

#### Pace (0–100)
How up-tempo a team plays.
```
Pace = FGAttempts_normalized
```
- **FG Attempts** — Field goal attempts per game used as a tempo proxy (D1 range: 50–76). More attempts = faster pace.

#### Experience (0–100)
How battle-tested a team is based on their season results.
```
Experience = WinRate_normalized
```
- **Win Rate** — Wins ÷ Games Played (range: 0–1). Teams that win more are treated as more experienced in high-pressure situations.

#### Clutch (0–100)
How well a team performs in tight, late-game situations.
```
Clutch = (FT%_normalized × 55%) + (AstToRatio_normalized × 45%)
```
- **FT%** — Free throw percentage (D1 range: 60–82%). Critical for winning close games in the final minutes.
- **AST/TO Ratio** — Assist-to-turnover ratio (D1 range: 0.7–1.9). Higher ratio = better ball security under pressure.

---

### Team Strengths

Three bullet points per team highlighting their highest-scoring stat categories. The app picks the top 3 composite scores (offense, defense, pace, experience, clutch, win record) and translates each into a plain-English sentence using the actual ESPN stat values.

Examples:
- "Scoring 82.4 PPG on 49.1% shooting" → high offense score
- "Holding opponents to just 61.3 PPG" → high defense score
- "Fast-paced attack averaging 71 FG attempts per game" → high pace score

---

### Key Matchup

Identifies the most decisive factor in the game by finding the **largest gap between the two teams** across all five composite scores (offense, defense, pace, experience, clutch). The category with the biggest point differential is called out as the deciding edge.

---

### X Factor

A single wildcard observation based on matchup dynamics. The logic checks in order:

1. **Pace gap > 20 points** → one team wants to run, the other thrives in a half-court grind — tempo battle highlighted
2. **Projected margin < 3 points** → too close to call — free throws flagged as likely decider
3. **Clutch gap > 15 points** → one team significantly better at late-game execution
4. **Default** → turnovers flagged as the hidden differentiator

---

### Analyst Take

A summary paragraph combining the win probability confidence level, which team has the offensive advantage, and which has the defensive advantage. Outputs one of three confidence tones:
- **Dominant** (≥80% win probability)
- **Comfortable** (65–79%)
- **Narrow** (below 65%)

Always ends with a reminder that tournament basketball can erase regular-season advantages.

---

## File Structure

```
src/
├── api/
│   └── espn.js          # All ESPN API calls (fetchAllTeams, fetchTeamDetail)
├── utils/
│   └── predictions.js   # Normalization, stat scoring, win probability, text templates
├── App.jsx              # UI, state management, rendering
└── main.jsx             # React entry point
```

---

## Limitations

- **Seeds are not available** until Selection Sunday (March 15, 2026) — the bracket hasn't been announced yet. Win/loss records are shown instead.
- **BartTorvik** (advanced analytics) is blocked by Cloudflare from browser requests and could not be used.
- The prediction model is based on season averages only. It does not account for injuries, travel, home/away splits, or single-game variance.
- Win probability shifts 3% per projected point margin — this is a simplified logistic approximation, not a Vegas-calibrated model.
