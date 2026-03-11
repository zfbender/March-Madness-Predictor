import { useState, useEffect } from "react";
import { fetchAllTeams, fetchTeamDetail } from "./api/espn.js";
import { calculateMatchup } from "./utils/predictions.js";

const seedColors = {
  1: "#FFD700", 2: "#FFA500", 3: "#FF6B35", 4: "#4CAF50",
  5: "#2196F3", 6: "#9C27B0", 7: "#00BCD4", 8: "#FF5722",
  9: "#795548", 10: "#607D8B", 11: "#E91E63", 12: "#009688",
  13: "#8BC34A", 14: "#FF9800", 15: "#3F51B5", 16: "#F44336",
};

function recordBadge(team) {
  const bg = team.color || "#555";
  return (
    <span style={{
      minWidth: "38px",
      height: "28px",
      borderRadius: "4px",
      background: bg,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "700",
      fontSize: "9px",
      flexShrink: 0,
      padding: "0 4px",
      letterSpacing: "0.02em",
      fontFamily: "'IBM Plex Mono', monospace",
      border: "1px solid rgba(255,255,255,0.15)",
    }}>
      {team.record || "—"}
    </span>
  );
}

function TeamCard({ team, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        padding: "10px 14px",
        marginBottom: "4px",
        borderRadius: "6px",
        background: selected ? "rgba(255,200,0,0.15)" : "rgba(255,255,255,0.04)",
        border: selected ? "1px solid #FFD700" : "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        transition: "all 0.15s ease",
        transform: selected ? "scale(1.01)" : "scale(1)",
      }}
    >
      {team.logo ? (
        <img
          src={team.logo}
          alt={team.abbreviation}
          style={{ width: "28px", height: "28px", objectFit: "contain", flexShrink: 0 }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
      ) : (
        <span style={{
          minWidth: "28px", height: "28px", borderRadius: "50%",
          background: team.color || "#555", flexShrink: 0,
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: "#fff", fontWeight: "700", fontSize: "13px",
          fontFamily: "'Oswald', sans-serif",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {team.name}
        </div>
        <div style={{ color: "#888", fontSize: "10px", fontFamily: "'IBM Plex Mono', monospace" }}>
          {team.abbreviation}
        </div>
      </div>
      {selected && team.record && (
        <span style={{ color: "#FFD700", fontSize: "10px", fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>
          {team.record}
        </span>
      )}
    </div>
  );
}

function StatBar({ label, value, color = "#FFD700" }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ color: "#aaa", fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        <span style={{ color: "#fff", fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: "bold" }}>{value}%</span>
      </div>
      <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${value}%`,
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          borderRadius: "3px", transition: "width 1s ease",
          boxShadow: `0 0 8px ${color}66`,
        }} />
      </div>
    </div>
  );
}

function Spinner({ label = "Loading..." }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "#555" }}>
      <div style={{
        width: "40px", height: "40px", margin: "0 auto 16px",
        border: "3px solid rgba(255,215,0,0.15)",
        borderTop: "3px solid #FFD700",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", letterSpacing: "0.1em" }}>
        {label}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  const [allTeams, setAllTeams]   = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [teamsError, setTeamsError] = useState(null);

  const [team1, setTeam1] = useState(null);
  const [team2, setTeam2] = useState(null);
  const [search1, setSearch1] = useState("");
  const [search2, setSearch2] = useState("");

  const [analysis, setAnalysis]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // Load all teams from ESPN on mount
  useEffect(() => {
    fetchAllTeams()
      .then((teams) => {
        setAllTeams(teams);
        setLoadingTeams(false);
      })
      .catch((err) => {
        setTeamsError(err.message);
        setLoadingTeams(false);
      });
  }, []);

  const filterTeams = (search) =>
    allTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.abbreviation.toLowerCase().includes(search.toLowerCase())
    );

  const filtered1 = filterTeams(search1);
  const filtered2 = filterTeams(search2);

  const runAnalysis = async () => {
    if (!team1 || !team2) return;
    setLoading(true);
    setAnalysis(null);
    setError(null);

    try {
      // Fetch real stats for both teams in parallel
      const [stats1, stats2] = await Promise.all([
        fetchTeamDetail(team1.id),
        fetchTeamDetail(team2.id),
      ]);

      // Attach record to team objects for display
      const t1 = { ...team1, record: stats1.record, ppg: stats1.ppg, oppPpg: stats1.oppPpg, fgPct: stats1.fgPct, winRate: stats1.winRate };
      const t2 = { ...team2, record: stats2.record, ppg: stats2.ppg, oppPpg: stats2.oppPpg, fgPct: stats2.fgPct, winRate: stats2.winRate };

      setTeam1(t1);
      setTeam2(t2);

      const result = calculateMatchup(t1, t2, stats1, stats2);
      setAnalysis(result);
    } catch (err) {
      setError(`Failed to load team stats: ${err.message}`);
    }

    setLoading(false);
  };

  const reset = () => {
    setTeam1(prev => prev ? { id: prev.id, name: prev.name, abbreviation: prev.abbreviation, shortName: prev.shortName, color: prev.color, altColor: prev.altColor, logo: prev.logo } : null);
    setTeam2(prev => prev ? { id: prev.id, name: prev.name, abbreviation: prev.abbreviation, shortName: prev.shortName, color: prev.color, altColor: prev.altColor, logo: prev.logo } : null);
    setAnalysis(null);
    setSearch1("");
    setSearch2("");
  };

  const winnerTeam  = analysis ? (analysis.winner === team1?.name ? team1 : team2) : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=IBM+Plex+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .team-list { max-height: 360px; overflow-y: auto; }
        .analyze-btn {
          background: linear-gradient(135deg, #FFD700, #FF6B00);
          color: #000; border: none; padding: 16px 40px;
          font-family: 'Bebas Neue', sans-serif; font-size: 22px;
          letter-spacing: 0.1em; border-radius: 4px; cursor: pointer;
          transition: all 0.2s; box-shadow: 0 0 30px rgba(255,215,0,0.3);
        }
        .analyze-btn:hover { transform: scale(1.04); box-shadow: 0 0 50px rgba(255,215,0,0.5); }
        .analyze-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .fade-in { animation: fadeIn 0.6s ease forwards; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .search-input {
          width: 100%; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12); color: #fff;
          padding: 8px 12px; border-radius: 4px;
          font-family: 'IBM Plex Mono', monospace; font-size: 12px;
          margin-bottom: 8px; outline: none;
        }
        .search-input:focus { border-color: #FFD700; }
        .search-input::placeholder { color: #555; }
        .noise { position: fixed; inset: 0; opacity: 0.025; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); z-index: 9999; }
        .grid-bg { position: fixed; inset: 0;
          background-image: linear-gradient(rgba(255,215,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.03) 1px, transparent 1px);
          background-size: 40px 40px; pointer-events: none; }
        .reset-btn:hover { background: rgba(255,215,0,0.1) !important; }
      `}</style>

      <div className="noise" />
      <div className="grid-bg" />

      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0a0a0f 0%, #0d0d1a 50%, #0a0a0f 100%)", color: "#fff", fontFamily: "'Oswald', sans-serif", position: "relative" }}>

        {/* Header */}
        <div style={{ textAlign: "center", padding: "40px 20px 20px", borderBottom: "1px solid rgba(255,215,0,0.15)" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(36px,7vw,72px)", letterSpacing: "0.06em", lineHeight: 1, background: "linear-gradient(135deg, #FFD700 0%, #FF6B00 60%, #FF3366 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            MARCH MADNESS 2026
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#555", fontSize: "11px", letterSpacing: "0.2em", marginTop: "6px", textTransform: "uppercase" }}>
            AI Bracket Predictor · Selection Sunday: March 15 · Powered by ESPN Live Stats
          </div>
        </div>

        {/* Team loading error */}
        {teamsError && (
          <div style={{ textAlign: "center", padding: "40px", color: "#FF3366", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }}>
            Failed to load teams: {teamsError}
          </div>
        )}

        {/* Loading teams */}
        {loadingTeams && !teamsError && <Spinner label="LOADING ALL 362 TEAMS FROM ESPN..." />}

        {/* Main content */}
        {!loadingTeams && !teamsError && !analysis && (
          <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "30px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "20px", alignItems: "start" }}>

              {/* Team 1 */}
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "20px", letterSpacing: "0.1em", color: "#FFD700", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  🏀 TEAM 1
                  {team1 && (
                    <>
                      {team1.logo && <img src={team1.logo} alt="" style={{ width: "20px", height: "20px", objectFit: "contain" }} />}
                      <span style={{ color: "#fff", fontSize: "14px" }}>{team1.shortName || team1.name}</span>
                      {team1.record && <span style={{ color: "#888", fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace" }}>({team1.record})</span>}
                    </>
                  )}
                </div>
                <input
                  className="search-input"
                  placeholder="Search team name or abbreviation..."
                  value={search1}
                  onChange={(e) => setSearch1(e.target.value)}
                />
                <div className="team-list">
                  {filtered1.slice(0, 80).map((t) => (
                    <TeamCard key={t.id} team={t} selected={team1?.id === t.id} onClick={() => setTeam1(t)} />
                  ))}
                  {filtered1.length > 80 && (
                    <div style={{ color: "#555", fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", padding: "8px", textAlign: "center" }}>
                      Refine search to see more ({filtered1.length} results)
                    </div>
                  )}
                </div>
              </div>

              {/* VS */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "40px", gap: "8px" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "48px", color: "#333", letterSpacing: "0.05em" }}>VS</div>
                {team1 && team2 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "2px", height: "30px", background: "linear-gradient(#FFD700, transparent)" }} />
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#555", textAlign: "center", letterSpacing: "0.1em" }}>LIVE<br />DATA</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "18px", color: "#FFD700" }}>ESPN</div>
                  </div>
                )}
              </div>

              {/* Team 2 */}
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "20px", letterSpacing: "0.1em", color: "#FF6B00", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  🏀 TEAM 2
                  {team2 && (
                    <>
                      {team2.logo && <img src={team2.logo} alt="" style={{ width: "20px", height: "20px", objectFit: "contain" }} />}
                      <span style={{ color: "#fff", fontSize: "14px" }}>{team2.shortName || team2.name}</span>
                      {team2.record && <span style={{ color: "#888", fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace" }}>({team2.record})</span>}
                    </>
                  )}
                </div>
                <input
                  className="search-input"
                  placeholder="Search team name or abbreviation..."
                  value={search2}
                  onChange={(e) => setSearch2(e.target.value)}
                />
                <div className="team-list">
                  {filtered2.slice(0, 80).map((t) => (
                    <TeamCard key={t.id} team={t} selected={team2?.id === t.id} onClick={() => setTeam2(t)} />
                  ))}
                  {filtered2.length > 80 && (
                    <div style={{ color: "#555", fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", padding: "8px", textAlign: "center" }}>
                      Refine search to see more ({filtered2.length} results)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Analyze Button */}
            <div style={{ textAlign: "center", marginTop: "36px" }}>
              {error && (
                <div style={{ color: "#FF3366", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginBottom: "12px" }}>
                  {error}
                </div>
              )}
              {loading ? (
                <Spinner label="FETCHING LIVE ESPN STATS..." />
              ) : (
                <>
                  <button
                    className="analyze-btn"
                    disabled={!team1 || !team2}
                    onClick={runAnalysis}
                  >
                    ⚡ ANALYZE MATCHUP
                  </button>
                  {(!team1 || !team2) && (
                    <div style={{ color: "#444", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", marginTop: "12px" }}>
                      Select both teams to unlock analysis
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && team1 && team2 && (
          <div className="fade-in" style={{ maxWidth: "900px", margin: "0 auto", padding: "30px 20px" }}>

            {/* Winner Banner */}
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#555", fontSize: "10px", letterSpacing: "0.3em", marginBottom: "8px" }}>PREDICTED WINNER</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(32px,6vw,60px)", background: "linear-gradient(135deg, #FFD700, #FF6B00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.04em" }}>
                🏆 {analysis.winner}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#888", fontSize: "13px", marginTop: "4px" }}>
                Projected Score:{" "}
                <span style={{ color: "#FFD700", fontWeight: "bold" }}>
                  {analysis.predictedScore.team1} – {analysis.predictedScore.team2}
                </span>
                <span style={{ color: "#555", marginLeft: "8px", fontSize: "11px" }}>
                  ({team1.shortName ?? team1.name.split(" ").pop()} vs {team2.shortName ?? team2.name.split(" ").pop()})
                </span>
              </div>
              {/* Records */}
              <div style={{ marginTop: "8px", display: "flex", justifyContent: "center", gap: "24px" }}>
                {[team1, team2].map((t) => (
                  t.record && (
                    <span key={t.id} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#666" }}>
                      {t.shortName ?? t.name}: <span style={{ color: "#aaa" }}>{t.record}</span>
                    </span>
                  )
                ))}
              </div>
            </div>

            {/* Win Probability + Upset Risk */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              <div style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: "8px", padding: "20px" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "14px", color: "#FFD700", letterSpacing: "0.1em", marginBottom: "16px" }}>WIN PROBABILITY</div>
                {[team1, team2].map((team, idx) => {
                  const prob = analysis.winner === team?.name ? analysis.winProbability : 100 - analysis.winProbability;
                  const isWinner = analysis.winner === team?.name;
                  return (
                    <div key={team?.id} style={{ marginBottom: idx === 0 ? "12px" : 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span style={{ color: "#ccc", fontSize: "12px", fontFamily: "'Oswald', sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
                          {team.logo && <img src={team.logo} alt="" style={{ width: "16px", height: "16px", objectFit: "contain" }} />}
                          {team?.shortName ?? team?.name}
                        </span>
                        <span style={{ color: isWinner ? "#FFD700" : "#aaa", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: isWinner ? "bold" : "normal" }}>{prob}%</span>
                      </div>
                      <div style={{ height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${prob}%`, background: isWinner ? "linear-gradient(90deg, #FFD700, #FF6B00)" : "linear-gradient(90deg, #FF6B00, #FF3366)", borderRadius: "4px", boxShadow: isWinner ? "0 0 10px #FFD70066" : "none" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ background: analysis.upsetRisk >= 60 ? "rgba(255,51,102,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${analysis.upsetRisk >= 60 ? "rgba(255,51,102,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: "8px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "14px", color: analysis.upsetRisk >= 60 ? "#FF3366" : "#888", letterSpacing: "0.1em", marginBottom: "8px" }}>UPSET RISK</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "64px", lineHeight: 1, color: analysis.upsetRisk >= 70 ? "#FF3366" : analysis.upsetRisk >= 40 ? "#FF6B00" : "#4CAF50" }}>
                  {analysis.upsetRisk}%
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#555", marginTop: "6px", letterSpacing: "0.1em" }}>
                  {analysis.upsetRisk >= 70 ? "🔥 HIGH ALERT" : analysis.upsetRisk >= 40 ? "⚠️ MODERATE" : "✅ SAFE PICK"}
                </div>
              </div>
            </div>

            {/* Stats Comparison */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              {[team1, team2].map((team, idx) => {
                const stats = idx === 0 ? analysis.stats.team1 : analysis.stats.team2;
                return (
                  <div key={team?.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                      {team?.logo && (
                        <img src={team.logo} alt="" style={{ width: "26px", height: "26px", objectFit: "contain", flexShrink: 0 }} />
                      )}
                      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: "14px", fontWeight: "700", color: "#fff" }}>{team?.name}</div>
                      {team?.record && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#666" }}>{team.record}</span>
                      )}
                    </div>
                    <StatBar label="Offense" value={stats.offense} color="#FFD700" />
                    <StatBar label="Defense" value={stats.defense} color="#4CAF50" />
                    <StatBar label="Pace" value={stats.pace} color="#2196F3" />
                    <StatBar label="Experience" value={stats.experience} color="#FF6B00" />
                    <StatBar label="Clutch" value={stats.clutch} color="#FF3366" />
                  </div>
                );
              })}
            </div>

            {/* Strengths */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              {[{ team: team1, strengths: analysis.team1Strengths }, { team: team2, strengths: analysis.team2Strengths }].map(({ team, strengths }) => (
                <div key={team?.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "16px" }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "13px", color: "#FFD700", letterSpacing: "0.1em", marginBottom: "10px" }}>
                    💪 {team?.shortName ?? team?.name?.split(" ").slice(-1)[0]} STRENGTHS
                  </div>
                  {strengths?.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px", alignItems: "flex-start" }}>
                      <span style={{ color: "#FFD700", fontSize: "10px", marginTop: "2px", flexShrink: 0 }}>▶</span>
                      <span style={{ color: "#bbb", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.4 }}>{s}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Key Matchup + X Factor */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              <div style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: "8px", padding: "16px" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "13px", color: "#FFD700", letterSpacing: "0.1em", marginBottom: "10px" }}>⚔️ KEY MATCHUP</div>
                <p style={{ color: "#ccc", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.6 }}>{analysis.keyMatchup}</p>
              </div>
              <div style={{ background: "rgba(255,107,0,0.05)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: "8px", padding: "16px" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "13px", color: "#FF6B00", letterSpacing: "0.1em", marginBottom: "10px" }}>🎲 X FACTOR</div>
                <p style={{ color: "#ccc", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.6 }}>{analysis.xFactor}</p>
              </div>
            </div>

            {/* Analyst Take */}
            <div style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,107,0,0.05))", border: "1px solid rgba(255,215,0,0.25)", borderRadius: "8px", padding: "20px", marginBottom: "30px" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "14px", color: "#FFD700", letterSpacing: "0.1em", marginBottom: "10px" }}>📊 ANALYST TAKE</div>
              <p style={{ color: "#ddd", fontSize: "13px", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.7 }}>{analysis.analystTake}</p>
              <div style={{ marginTop: "12px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#444" }}>
                Based on live ESPN stats · No AI used · Pure data
              </div>
            </div>

            {/* Reset */}
            <div style={{ textAlign: "center" }}>
              <button
                className="reset-btn"
                onClick={reset}
                style={{ background: "transparent", border: "1px solid rgba(255,215,0,0.4)", color: "#FFD700", padding: "12px 32px", fontFamily: "'Bebas Neue', sans-serif", fontSize: "18px", letterSpacing: "0.1em", borderRadius: "4px", cursor: "pointer", transition: "all 0.2s" }}
              >
                ← NEW MATCHUP
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: "20px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#333", fontSize: "10px", letterSpacing: "0.15em" }}>
            MARCH MADNESS 2026 · 362 D1 TEAMS · ESPN LIVE DATA · FINAL FOUR: APRIL 4 · SAN ANTONIO
          </span>
        </div>
      </div>
    </>
  );
}
