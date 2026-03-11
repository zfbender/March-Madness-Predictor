// ─── League-wide D1 ranges for normalization (2025-26 season) ───────────────
// Used to place each team on a 0–100 percentile scale relative to all of D1.
const L = {
  ppg:        { min: 55,  max: 95  },
  oppPpg:     { min: 58,  max: 88  }, // lower = better defense
  fgPct:      { min: 37,  max: 53  },
  threePct:   { min: 26,  max: 42  },
  ftPct:      { min: 60,  max: 82  },
  spg:        { min: 3,   max: 10  },
  bpg:        { min: 0.5, max: 6   },
  dRpg:       { min: 17,  max: 30  },
  fgAttempts: { min: 50,  max: 76  }, // pace proxy
  astToRatio: { min: 0.7, max: 1.9 },
  winRate:    { min: 0,   max: 1   },
  pointDiff:  { min: -20, max: 30  },
};

function norm(value, key, invert = false) {
  const { min, max } = L[key];
  if (max === min) return 50;
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return Math.round(invert ? 100 - pct : pct);
}

function buildStats(s) {
  return {
    // Offense: scoring + shooting efficiency
    offense: Math.round(
      norm(s.ppg, "ppg") * 0.45 +
      norm(s.fgPct, "fgPct") * 0.30 +
      norm(s.threePct, "threePct") * 0.25
    ),
    // Defense: opponent scoring (inverted) + steals + blocks + def rebounds
    defense: Math.round(
      norm(s.oppPpg, "oppPpg", true) * 0.50 +
      norm(s.spg, "spg") * 0.25 +
      norm(s.bpg, "bpg") * 0.15 +
      norm(s.dRpg, "dRpg") * 0.10
    ),
    // Pace: tempo (field goal attempts per game)
    pace: norm(s.fgAttempts, "fgAttempts"),
    // Experience: win rate — teams that win are more experienced in winning
    experience: norm(s.winRate, "winRate"),
    // Clutch: free throw execution + ball security under pressure
    clutch: Math.round(
      norm(s.ftPct, "ftPct") * 0.55 +
      norm(s.astToRatio, "astToRatio") * 0.45
    ),
  };
}

// ─── Win probability via projected scores + point differential ───────────────
function calcWinProbability(team1Stats, team2Stats) {
  // Project each team's score as avg of their offense and opponent's defense concession
  const proj1 = (team1Stats.ppg + team2Stats.oppPpg) / 2;
  const proj2 = (team2Stats.ppg + team1Stats.oppPpg) / 2;
  const margin = proj1 - proj2;

  // Logistic-ish: each point of margin ≈ 3% shift from 50%
  const rawProb = 50 + margin * 3;
  return {
    team1Prob: Math.min(95, Math.max(5, Math.round(rawProb))),
    proj1: Math.round(proj1),
    proj2: Math.round(proj2),
    margin,
  };
}

// ─── Text templates ───────────────────────────────────────────────────────────
function keyMatchup(t1, t2, s1, s2) {
  const gaps = [
    { label: "offensive firepower",  diff: s1.offense - s2.offense,  adv: t1, dis: t2 },
    { label: "defensive intensity",  diff: s1.defense - s2.defense,  adv: t1, dis: t2 },
    { label: "tempo control",        diff: s1.pace - s2.pace,        adv: t1, dis: t2 },
    { label: "tournament experience",diff: s1.experience - s2.experience, adv: t1, dis: t2 },
    { label: "clutch execution",     diff: s1.clutch - s2.clutch,    adv: t1, dis: t2 },
  ].map(g => ({ ...g, diff: g.diff > 0 ? g.diff : -g.diff, adv: g.diff > 0 ? g.adv : g.dis, dis: g.diff > 0 ? g.dis : g.adv }))
   .sort((a, b) => b.diff - a.diff);

  const top = gaps[0];
  const second = gaps[1];
  return `The decisive factor in this matchup is ${top.adv.name}'s edge in ${top.label} — a ${top.diff}-point advantage on the rating scale that ${top.dis.name} will struggle to overcome. Compounding this, ${top.adv.name} also holds the upper hand in ${second.label}. If ${top.dis.name} is to pull off the upset, they'll need an extraordinary performance far beyond their season average.`;
}

function topStrengths(team, stats, opponent, oppStats) {
  const categories = [
    { label: "elite offensive efficiency", score: stats.offense, threshold: 65 },
    { label: "lockdown defense",           score: stats.defense, threshold: 65 },
    { label: "up-tempo pace",              score: stats.pace,    threshold: 70 },
    { label: "veteran experience",         score: stats.experience, threshold: 60 },
    { label: "clutch free-throw shooting", score: stats.clutch,  threshold: 60 },
    { label: `strong ${team.record} record`, score: norm(team.winRate ?? 0.5, "winRate"), threshold: 55 },
  ];

  // Pick the 3 highest-scoring categories
  return categories
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(c => {
      if (c.label.startsWith("elite offensive"))
        return `Scoring ${team.ppg?.toFixed(1) ?? "—"} PPG on ${team.fgPct?.toFixed(1) ?? "—"}% shooting`;
      if (c.label.startsWith("lockdown"))
        return `Holding opponents to just ${team.oppPpg?.toFixed(1) ?? "—"} PPG`;
      if (c.label.startsWith("up-tempo"))
        return `Fast-paced attack averaging ${team.fgAttempts?.toFixed(0) ?? "—"} FG attempts per game`;
      if (c.label.startsWith("veteran"))
        return `Proven ${team.record} record heading into the tournament`;
      if (c.label.startsWith("clutch"))
        return `${team.ftPct?.toFixed(1) ?? "—"}% from the free-throw line when games go to the wire`;
      return `Consistent ${team.record} record and positive point differential`;
    });
}

function xFactor(t1, t2, s1, s2, margin) {
  const paceDiff = s1.pace - s2.pace;
  if (Math.abs(paceDiff) > 20) {
    const faster = paceDiff > 0 ? t1 : t2;
    const slower = paceDiff > 0 ? t2 : t1;
    return `The biggest wildcard is tempo — ${faster.name} wants to run while ${slower.name} thrives in a half-court grind, and whoever dictates the pace could swing this game by double digits.`;
  }
  if (Math.abs(margin) < 3) {
    return `With the matchup so evenly rated, free throws may decide the outcome — both teams will likely be in bonus territory in a tight fourth quarter.`;
  }
  const clutchGap = Math.abs(s1.clutch - s2.clutch);
  if (clutchGap > 15) {
    const better = s1.clutch > s2.clutch ? t1 : t2;
    return `${better.name}'s superior clutch execution — built on ball security and free-throw accuracy — gives them a distinct advantage if this game stays close into the final minutes.`;
  }
  return `Turnovers will be the hidden x-factor; the team that protects the ball best in transition is likely to come out on top.`;
}

function analystTake(t1, t2, winner, loser, winProb, stats1, stats2) {
  const confidence = winProb >= 80 ? "dominant" : winProb >= 65 ? "comfortable" : "narrow";
  const adjective = winProb >= 80 ? "clear" : winProb >= 65 ? "legitimate" : "slight";
  const offEdge = stats1.offense > stats2.offense ? t1 : t2;
  const defEdge = stats1.defense > stats2.defense ? t1 : t2;

  return `${winner.name} is the ${adjective} favorite here and should advance with a ${confidence} margin if they execute their gameplan. ${offEdge.name} holds the offensive advantage while ${defEdge.name} brings the better defensive unit — the team that can impose both will control the game. Don't sleep on ${loser.name} though; tournament basketball erases regular-season advantages fast, and this is March.`;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function calculateMatchup(team1, team2, team1Stats, team2Stats) {
  const stats1 = buildStats(team1Stats);
  const stats2 = buildStats(team2Stats);

  const { team1Prob, proj1, proj2, margin } = calcWinProbability(team1Stats, team2Stats);

  const winner       = team1Prob >= 50 ? team1 : team2;
  const loser        = team1Prob >= 50 ? team2 : team1;
  const winnerStats  = team1Prob >= 50 ? team1Stats : team2Stats;
  const loserStats   = team1Prob >= 50 ? team2Stats : team1Stats;
  const winnerScores = team1Prob >= 50 ? stats1 : stats2;
  const loserScores  = team1Prob >= 50 ? stats2 : stats1;
  const winProbability = team1Prob >= 50 ? team1Prob : 100 - team1Prob;

  // Upset risk: how close the matchup is + underdog's win rate
  const probGap = Math.abs(team1Prob - 50);
  const upsetRisk = Math.max(5, Math.min(95, Math.round(50 - probGap * 0.8)));

  return {
    winner: winner.name,
    winProbability,
    predictedScore: { team1: proj1, team2: proj2 },
    upsetRisk,
    stats: { team1: stats1, team2: stats2 },
    keyMatchup:     keyMatchup(team1, team2, stats1, stats2),
    team1Strengths: topStrengths({ ...team1, ...team1Stats }, stats1, team2, stats2),
    team2Strengths: topStrengths({ ...team2, ...team2Stats }, stats2, team1, stats1),
    xFactor:        xFactor(team1, team2, stats1, stats2, margin),
    analystTake:    analystTake(team1, team2, winner, loser, winProbability, stats1, stats2),
  };
}
