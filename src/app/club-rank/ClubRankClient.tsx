"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebaseClient";

type PointRules = {
  match?: Record<string, Record<string, number>>;
  activity?: Record<string, number>;
};

type SeasonData = {
  title?: string;
  isActive?: boolean;
  matchWeight?: number;
  activityWeight?: number;
  pointRules?: PointRules;
};

type MatchRecord = {
  playerUid?: string;
  playerName?: string;
  type?: string;
  leagueType?: string;
  rank?: string;
  otherClubMember?: string;
  points?: number;
  status?: string;
};

type ActivityRecord = {
  playerUid?: string;
  playerName?: string;
  activityType?: string;
  points?: number;
  status?: string;
};

type AdjustmentRecord = {
  playerUid?: string;
  playerName?: string;
  applyTo?: string;
  type?: string;
  points?: number;
  note?: string;
  dateLabel?: string;
};

type LeaderboardRow = {
  playerUid?: string;
  playerName: string;
  matchPointsBase: number;
  activityPointsBase: number;
  matchAdjustment: number;
  activityAdjustment: number;
  totalAdjustment: number;
  matchesCount: number;
  activitiesCount: number;
  totalPoints: number;
};

type ChartRow = {
  label: string;
  value: number;
};

const DEFAULT_SEASON_ID = "2025";

const normalize = (val?: string) =>
  (val ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+|_|-/g, "");

const normalizeType = (val?: string) => {
  const v = normalize(val);
  if (["êµ? œ", "êµ? œ?€??, "international", "intl", "inter"].includes(v)) return "êµ? œ?€??;
  if (["êµ?‚´", "êµ?‚´?€??, "domestic", "local"].includes(v)) return "êµ?‚´?€??;
  return val ?? "";
};

const normalizeRank = (val?: string) => {
  const v = normalize(val);
  if (["winner", "win", "champ", "?°ìŠ¹", "1", "1??, "1??, "first"].includes(v)) return "winner";
  if (["runnerup", "runner-up", "ru", "ì¤€?°ìŠ¹", "2", "2??, "2??, "second"].includes(v)) return "runner-up";
  if (["third", "3", "3??, "3??, "bronze", "??, "?™ë©”??].includes(v)) return "third";
  if (["participation", "ì°¸ê?", "ì°¸ì—¬"].includes(v)) return "participation";
  return val ?? "";
};

const normalizeLeagueType = (val?: string) => {
  const v = normalize(val);
  if (["open", "?¤í”ˆ", "?¤í”ˆë¶€", "openë¶€"].includes(v)) return "open";
  if (["2", "2ë¶€", "2ë¶€ë¦¬ê·¸", "division2", "d2", "div2", "2nd"].includes(v)) return "division2";
  return val ?? "";
};

const normalizeOtherClub = (val?: string) => {
  const v = normalize(val);
  if (["??, "yes", "y", "true", "1", "on"].includes(v)) return true;
  if (["?„ë‹ˆ??, "?„ë‹ˆ??, "no", "n", "false", "0", "off"].includes(v)) return false;
  return false;
};

function computeMatchPoints(record: MatchRecord, rules: PointRules) {
  if (typeof record.points === "number") return record.points;
  const matchRules = rules.match || {};
  const typeKey = normalizeType(record.type);
  const rankKey = normalizeRank(record.rank);
  const leagueKey = normalizeLeagueType(record.leagueType);
  const typeRules = matchRules[typeKey] || {};

  let base = 0;
  if (typeKey === "êµ?‚´?€?? && leagueKey === "division2") {
    const openBase = typeRules[rankKey] ?? 0;
    base = openBase * 0.3;
  } else {
    base = typeRules[rankKey] ?? 0;
  }

  if (normalizeOtherClub(record.otherClubMember)) {
    const penalty = matchRules.otherClubMemberPenalty;
    if (typeof penalty === "number") {
      if (penalty > 0 && penalty < 1) base = base * penalty;
      else base = base - penalty;
    } else {
      base = base * 0.3;
    }
  }
  return base;
}

function computeActivityPoints(record: ActivityRecord, rules: PointRules) {
  if (typeof record.points === "number") return record.points;
  const activityRules = rules.activity || {};
  const key = record.activityType || "";
  return activityRules[key] ?? 0;
}

function getMatchWeight(season?: SeasonData | null) {
  return typeof season?.matchWeight === "number" ? season.matchWeight : 0.5;
}

function getActivityWeight(season?: SeasonData | null) {
  return typeof season?.activityWeight === "number" ? season.activityWeight : 0.5;
}

function buildAdjustments(records: AdjustmentRecord[]) {
  const index = new Map<
    string,
    { match: number; activity: number; total: number; details: AdjustmentRecord[] }
  >();

  records.forEach((record) => {
    const name = (record.playerName || "").trim();
    if (!name) return;
    const applyTo = (record.applyTo || "total").toLowerCase();
    const type = (record.type || "bonus").toLowerCase();
    let pts = Number(record.points) || 0;
    pts = type === "penalty" ? -Math.abs(pts) : Math.abs(pts);

    const current = index.get(name) || { match: 0, activity: 0, total: 0, details: [] };
    if (applyTo === "match") current.match += pts;
    else if (applyTo === "activity") current.activity += pts;
    else current.total += pts;
    current.details.push({ ...record, points: pts });
    index.set(name, current);
  });

  return index;
}

async function fetchSeason(db: ReturnType<typeof getDb>) {
  const seasonsRef = collection(db, "seasons");
  const activeQuery = query(seasonsRef, where("isActive", "==", true), limit(1));
  const activeSnap = await getDocs(activeQuery);
  if (!activeSnap.empty) {
    const docSnap = activeSnap.docs[0];
    return { id: docSnap.id, data: docSnap.data() as SeasonData };
  }

  const fallbackDoc = await getDoc(doc(db, "seasons", DEFAULT_SEASON_ID));
  if (fallbackDoc.exists()) {
    return { id: fallbackDoc.id, data: fallbackDoc.data() as SeasonData };
  }

  return null;
}

async function fetchCollection<T extends DocumentData>(path: string) {
  const db = getDb();
  const ref = collection(db, path);
  let snap = await getDocs(query(ref, where("status", "==", "confirmed")));
  if (snap.empty) {
    snap = await getDocs(ref);
  }
  return snap.docs.map((docSnap) => docSnap.data() as T);
}

export default function ClubRankClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [selected, setSelected] = useState<LeaderboardRow | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "rules">("dashboard");
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<any>(null);

  const stats = useMemo(() => {
    const totalPlayers = leaderboard.length;
    const totalMatches = leaderboard.reduce((sum, row) => sum + (row.matchesCount || 0), 0);
    const totalActivities = leaderboard.reduce((sum, row) => sum + (row.activitiesCount || 0), 0);
    return { totalPlayers, totalMatches, totalActivities };
  }, [leaderboard]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const db = getDb();
        const seasonResult = await fetchSeason(db);
        if (!seasonResult) {
          throw new Error("?œì„± ?œì¦Œ??ì°¾ì„ ???†ìŠµ?ˆë‹¤.");
        }

        if (!mounted) return;
        setSeason(seasonResult.data);
        setSeasonId(seasonResult.id);

        const [matches, activities, adjustments] = await Promise.all([
          fetchCollection<MatchRecord>(`seasons/${seasonResult.id}/matches`),
          fetchCollection<ActivityRecord>(`seasons/${seasonResult.id}/activities`),
          fetchCollection<AdjustmentRecord>(`seasons/${seasonResult.id}/adjustments`),
        ]);

        const adjustIndex = buildAdjustments(adjustments);
        const matchWeight = getMatchWeight(seasonResult.data);
        const activityWeight = getActivityWeight(seasonResult.data);
        const rules = seasonResult.data.pointRules || {};

        const matchMap = new Map<string, { points: number; count: number; uid?: string }>();
        matches.forEach((m) => {
          if (!m.playerName) return;
          const current = matchMap.get(m.playerName) || { points: 0, count: 0, uid: m.playerUid };
          current.points += computeMatchPoints(m, rules);
          current.count += 1;
          matchMap.set(m.playerName, current);
        });

        const activityMap = new Map<string, { points: number; count: number; uid?: string }>();
        activities.forEach((a) => {
          if (!a.playerName) return;
          const current = activityMap.get(a.playerName) || { points: 0, count: 0, uid: a.playerUid };
          current.points += computeActivityPoints(a, rules);
          current.count += 1;
          activityMap.set(a.playerName, current);
        });

        const players = new Set([
          ...Array.from(matchMap.keys()),
          ...Array.from(activityMap.keys()),
          ...Array.from(adjustIndex.keys()),
        ]);

        const rows: LeaderboardRow[] = [];
        players.forEach((name) => {
          const matchInfo = matchMap.get(name) || { points: 0, count: 0, uid: undefined };
          const activityInfo = activityMap.get(name) || { points: 0, count: 0, uid: undefined };
          const adjust = adjustIndex.get(name) || { match: 0, activity: 0, total: 0 };

          const matchPointsBase = matchInfo.points;
          const activityPointsBase = activityInfo.points;
          const matchAdjustment = adjust.match;
          const activityAdjustment = adjust.activity;
          const totalAdjustment = adjust.total;
          const totalPoints =
            matchPointsBase * matchWeight +
            activityPointsBase * activityWeight +
            matchAdjustment +
            activityAdjustment +
            totalAdjustment;

          rows.push({
            playerUid: matchInfo.uid || activityInfo.uid,
            playerName: name,
            matchPointsBase,
            activityPointsBase,
            matchAdjustment,
            activityAdjustment,
            totalAdjustment,
            matchesCount: matchInfo.count,
            activitiesCount: activityInfo.count,
            totalPoints: Number(totalPoints.toFixed(2)),
          });
        });

        rows.sort((a, b) => b.totalPoints - a.totalPoints);
        if (!mounted) return;
        setLeaderboard(rows);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "?°ì´?°ë? ë¶ˆëŸ¬?¤ì? ëª»í–ˆ?µë‹ˆ??");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const renderChart = async () => {
      if (!selected || !chartRef.current) return;
      const { default: Chart } = await import("chart.js/auto");
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const chartData: ChartRow[] = [
        { label: "ê²½ê¸° ?ì ??, value: selected.matchPointsBase },
        { label: "?œë™ ?ì ??, value: selected.activityPointsBase },
        { label: "ê²½ê¸° ì¡°ì •", value: selected.matchAdjustment },
        { label: "?œë™ ì¡°ì •", value: selected.activityAdjustment },
        { label: "ìµœì¢… ê°€??ì°¨ê°", value: selected.totalAdjustment },
      ];

      chartInstance.current = new Chart(chartRef.current, {
        type: "bar",
        data: {
          labels: chartData.map((row) => row.label),
          datasets: [
            {
              label: "?ìˆ˜",
              data: chartData.map((row) => row.value),
              backgroundColor: [
                "rgba(255, 107, 53, 0.5)",
                "rgba(0, 255, 136, 0.4)",
                "rgba(255, 107, 53, 0.2)",
                "rgba(0, 255, 136, 0.2)",
                "rgba(255, 255, 255, 0.18)",
              ],
              borderColor: [
                "rgba(255, 107, 53, 0.9)",
                "rgba(0, 255, 136, 0.9)",
                "rgba(255, 107, 53, 0.6)",
                "rgba(0, 255, 136, 0.6)",
                "rgba(255, 255, 255, 0.5)",
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: "#B0B0B0" },
              grid: { color: "rgba(255,255,255,0.08)" },
            },
            x: {
              ticks: { color: "#B0B0B0" },
              grid: { color: "rgba(255,255,255,0.08)" },
            },
          },
          plugins: {
            legend: { display: false },
          },
        },
      });
    };

    renderChart();
  }, [selected]);

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <div className="content-card animate">?°ì´?°ë? ë¶ˆëŸ¬?¤ëŠ” ì¤‘ì…?ˆë‹¤...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <div className="content-card animate">?¤ë¥˜: {error}</div>
        </div>
      </section>
    );
  }

  const activeSeasonTitle = season?.title || seasonId || "?œì¦Œ";
  const matchWeight = getMatchWeight(season);
  const activityWeight = getActivityWeight(season);

  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">IMAO CLUB</div>
          <h1 className="section-title">
            <span className="text-gradient">?„ì´ë§ˆì˜¤ ?´ëŸ½ ??‚¹</span>
          </h1>
          <p className="section-description">
            {activeSeasonTitle} ?œì¦Œ Â· ? ìˆ˜?€ ë©¤ë²„?¤ì˜ ?œë™???¨ê»˜ ì§€ì¼œë´ì£¼ì„¸??          </p>
        </div>

        <div className="rank-tabs">
          <button
            type="button"
            className={`rank-tab ${activeTab === "dashboard" ? "rank-tab--active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            ??‚¹
          </button>
          <button
            type="button"
            className={`rank-tab ${activeTab === "rules" ? "rank-tab--active" : ""}`}
            onClick={() => setActiveTab("rules")}
          >
            ?¬ì¸??ê·œì •
          </button>
        </div>

        {activeTab === "dashboard" && (
          <div className="rank-grid">
            <aside className="content-card animate">
              <h2 className="feature-title">ì§‘ê³„ ?„í™©</h2>
              <p className="feature-description">?¤ì‹œê°??°ì´?°ì…?ˆë‹¤.</p>
              <ul className="info-list">
                <li>ì´?? ìˆ˜: {stats.totalPlayers}</li>
                <li>ì´?ê²½ê¸°: {stats.totalMatches}</li>
                <li>ì´??œë™: {stats.totalActivities}</li>
              </ul>
            </aside>

            <section className="content-card animate">
              <div className="rank-header">
                <div>
                  <h2 className="feature-title">?¤ì‹œê°??œìœ„</h2>
                  <p className="feature-description">
                    ? ìˆ˜ ?´ë¦„???´ë¦­?˜ì‹œë©??ì„¸?´ì—­??ë³´ì‹¤ ???ˆìŠµ?ˆë‹¤.
                    <br />
                    ?©ì‚° = ê²½ê¸°?¬ì¸??{Math.round(matchWeight * 100)}%) + ?œë™?¬ì¸??{Math.round(activityWeight * 100)}%)
                  </p>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="rank-table">
                  <thead>
                    <tr>
                      <th>?œìœ„</th>
                      <th>? ìˆ˜ëª?/th>
                      <th>ì´??ë“ ?¬ì¸??/th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={3}>?œì¦Œ ?°ì´?°ê? ?†ìŠµ?ˆë‹¤.</td>
                      </tr>
                    )}
                    {leaderboard.map((row, idx) => (
                      <tr key={row.playerUid || row.playerName} onClick={() => setSelected(row)}>
                        <td>{idx + 1}</td>
                        <td>{row.playerName}</td>
                        <td>{row.totalPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selected && (
                <div className="rank-chart animate">
                  <h3 className="feature-title">
                    {selected.playerName} ?¬ì¸??êµ¬ì„± (ìµœì¢… {selected.totalPoints})
                  </h3>
                  <p className="feature-description">ë§‰ë?ë¥??´ë¦­??ë¹„êµ??ë³´ì„¸??</p>
                  <div className="chart-box">
                    <canvas ref={chartRef} />
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "rules" && (
          <section className="content-card animate">
            <h2 className="feature-title">?¬ì¸??ê·œì • (?”ì•½)</h2>
            <div className="features-grid">
              <div className="feature-card animate">
                <h3 className="feature-title">ê²½ê¸° ?¬ì¸??(?€???±ì )</h3>
                <div className="feature-list">
                  <p><strong>êµ? œ?€??/strong></p>
                  <ul className="info-list">
                    <li>- ?°ìŠ¹ 5??/li>
                    <li>- ì¤€?°ìŠ¹ 4??/li>
                    <li>- 3??3??/li>
                  </ul>
                  <p><strong>êµ?‚´?€??/strong></p>
                  <ul className="info-list">
                    <li>?¤í”ˆë¶€: 3 / 2 / 1 ??/li>
                    <li>2ë¶€ë¦¬ê·¸: ?¤í”ˆë¶€ ê²½ê¸°?¬ì¸?¸ì˜ 30%</li>
                  </ul>
                  <p className="feature-description">
                    * êµ? œ/êµ?‚´ ëª¨ë“  ?€???ìš© : ë³µì‹ì¡?ì°¸ì—¬???€ ë©¤ë²„?€ ?€???´ë¤„ ì°¸ê????±ì ??ê²½ìš° 30%ë§??¸ì •
                    <br />
                    (? ì˜ ?±ì‹¤ ê·œì •???˜ê±° ?„ì´ë§ˆì˜¤ ?€?´í?[ë³µì¥/?©êµ¬]ë¡?ì°¸ê???ê²½ìš°???œí•¨)
                  </p>
                </div>
                <div className="highlight-box">
                  <h4 className="benefit-title">ìµœì¢… ?œìœ„ ê²°ì •</h4>
                  <ul className="benefit-list">
                    <li><strong>ë§¤ë…„ 11??ë§?ê¸°ì?, ì´??ë“ ?¬ì¸??/strong></li>
                    <li>?™ì ??ì²˜ë¦¬</li>
                    <li>1?œìœ„: ?¹ì???ë??„ì )</li>
                    <li>2?œìœ„: ì´??ì‹¤ì°?/li>
                    <li>3?œìœ„: ì´??ì </li>
                    <li>4?œìœ„: ìµœì†Œ ?¤ì  (?„ìš” ???€?´ë¸Œ?ˆì´??ë§¤ì¹˜)</li>
                    <li>ì§€???™ì  ???€?´ë¸Œ?ˆì´??ë§¤ì¹˜ ì§„í–‰</li>
                  </ul>
                  <p className="feature-description">
                    * ìµœì¢… ? ìˆ˜ ? ë°œ<br />
                    ?ë™ ? ë°œ: ?¨Â·ë? ê°ê° ?ìœ„ 5ëª?/ ì°¨ìˆœ??1ëª…ì? ?ˆë¹„ ?„ë³´(?„ì›???‰ê?)
                  </p>
                </div>
              </div>

              <div className="feature-card animate">
                <h3 className="feature-title">?œë™ ?¬ì¸??(ì°¸ì—¬/?´ì˜/ë´‰ì‚¬)</h3>
                <div className="feature-list">
                  <p><strong>ê¸°ë³¸ ?œë™</strong></p>
                  <ul className="info-list">
                    <li>?•ê¸°ëª¨ì„/?ˆë ¨ 1??(ì§€ê°?ì¡°í‡´ 0.5??</li>
                  </ul>
                  <p><strong>ê¸°ì—¬ ?œë™</strong></p>
                  <ul className="info-list">
                    <li>?´ëŸ½ ?´ë? ?€??2??Â· ?¸ë? êµë¥˜???€??3??/li>
                    <li>?€???‰ì‚¬ ?¤íƒœ??4??Â· ?‰ì‚¬ ?¨ìˆœì°¸ì—¬ 2??/li>
                  </ul>
                  <p><strong>?Œì‹  ?œë™</strong></p>
                  <ul className="info-list">
                    <li>? ì… ?Œì› êµìœ¡/ë©˜í† ë§?3??Â· ?¥ë¹„/ì½”íŠ¸ ?•ë¦¬ 2??/li>
                    <li>?ë³´ ì°¸ì—¬ 2.5??Â· ?´ì˜ì§??œë™ ??5??/li>
                  </ul>
                  <p><strong>?¹ë³„ ?¬ì¸??/strong></p>
                  <ul className="info-list">
                    <li>? ê·œ ?Œì› ì¶”ì²œÂ·ê°€??5??/li>
                    <li>?´ëŸ½ ì£¼ê? ?€???…ìƒ 3/2/1??/li>
                    <li>?¸ë??€???´ëŸ½ ?€???…ìƒ: ?¬ì¸??2ë°?/li>
                    <li>?´ë‹¬??MVP 5??/li>
                  </ul>
                  <p><strong>ì°¨ê°</strong></p>
                  <ul className="info-list">
                    <li>ë¬´ë‹¨ ë¶ˆì°¸ 3??-2?? ë¹„ë§¤??-3?? ê¸°ë¬¼?Œì† -5????/li>
                  </ul>
                </div>
                <p className="feature-description">
                  ?„ì  ?¬ì¸?¸ëŠ” ?°ë§ ?•ì‚° ë°??±ê¸‰/?œíƒ(ê³¨ë“œÂ·?¤ë²„Â·ë¸Œë¡ ì¦? ë¶€?¬ì— ?œìš©
                </p>
              </div>
            </div>

            <p className="feature-description">
              <a
                href="https://imaosports2025.cafe24.com/article/%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD/1/5/"
                target="_blank"
                rel="noreferrer"
              >
                ê·œì • ?ì„¸??ë³´ê¸°
              </a>
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
