const BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

export async function fetchAllTeams() {
  const res = await fetch(`${BASE}/teams?limit=500`);
  if (!res.ok) throw new Error(`ESPN teams fetch failed: ${res.status}`);
  const data = await res.json();

  return data.sports[0].leagues[0].teams
    .map(({ team: t }) => ({
      id: t.id,
      name: t.displayName,
      abbreviation: t.abbreviation,
      shortName: t.shortDisplayName,
      color: `#${t.color || "555555"}`,
      altColor: `#${t.alternateColor || "333333"}`,
      logo: t.logos?.[0]?.href || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchTeamDetail(teamId) {
  const [statsRes, teamRes] = await Promise.all([
    fetch(`${BASE}/teams/${teamId}/statistics`),
    fetch(`${BASE}/teams/${teamId}`),
  ]);

  if (!statsRes.ok || !teamRes.ok) {
    throw new Error(`ESPN stats fetch failed for team ${teamId}`);
  }

  const statsData = await statsRes.json();
  const teamData = await teamRes.json();

  // Flatten all stat categories into one object
  const s = {};
  for (const cat of statsData?.results?.stats?.categories ?? []) {
    for (const stat of cat.stats ?? []) {
      s[stat.name] = stat.value;
    }
  }

  // Pull win/loss record + opponent stats
  const overall = (teamData?.team?.record?.items ?? []).find(
    (r) => r.type === "total"
  );
  const recStat = (name) =>
    overall?.stats?.find((x) => x.name === name)?.value ?? 0;

  const wins = recStat("wins");
  const losses = recStat("losses");
  const gamesPlayed = recStat("gamesPlayed") || wins + losses || 1;
  const winRate = wins / gamesPlayed;
  const record = overall?.summary ?? `${wins}-${losses}`;
  const avgPtsAgainst = recStat("avgPointsAgainst") || 72;
  const pointDiff = recStat("differential") || 0;

  return {
    ppg: s.avgPoints ?? 70,
    oppPpg: avgPtsAgainst,
    pointDiff,
    fgPct: s.fieldGoalPct ?? 44,
    threePct: s.threePointFieldGoalPct ?? 33,
    ftPct: s.freeThrowPct ?? 70,
    rpg: s.avgRebounds ?? 35,
    apg: s.avgAssists ?? 13,
    tpg: s.avgTurnovers ?? 13,
    spg: s.avgSteals ?? 6,
    bpg: s.avgBlocks ?? 3,
    oRpg: s.avgOffensiveRebounds ?? 10,
    dRpg: s.avgDefensiveRebounds ?? 24,
    fgAttempts: s.avgFieldGoalsAttempted ?? 62,
    astToRatio: s.assistTurnoverRatio ?? 1.1,
    wins: Math.round(wins),
    losses: Math.round(losses),
    winRate,
    record,
    gamesPlayed: Math.round(gamesPlayed),
  };
}
