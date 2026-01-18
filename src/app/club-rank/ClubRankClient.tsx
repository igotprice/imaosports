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
  if (["winner", "win", "champ", "?°ìŠ¹", "1", "1??, "first"].includes(v)) return "winner";
  if (["runnerup", "runner-up", "ru", "ì¤€?°ìŠ¹", "2", "2??, "second"].includes(v)) return "runner-up";
  if (["third", "3", "3??, "bronze", "?™ë©”??].includes(v)) return "third";
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
  if (["??, "??, "yes", "y", "true", "1", "on"].includes(v)) return true;
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
          throw new Error("??–ê½¦ ??–ì«µ??ï§¡ì– ??????ë’¿??ˆë–.");
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
        setError(err instanceof Error ? err.message : "?ê³—ì” ?ê³? ?ºëˆ???? ï§ì‚µë»??¬ë•²??");
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
        { label: "°æ±â Á¡¼ö", value: selected.matchPointsBase },
        { label: "È°µ¿ Á¡¼ö", value: selected.activityPointsBase },
        { label: "°æ±â Á¶Á¤", value: selected.matchAdjustment },
        { label: "È°µ¿ Á¶Á¤", value: selected.activityAdjustment },
        { label: "ÃÖÁ¾ °¡°¨", value: selected.totalAdjustment },
      ];

      chartInstance.current = new Chart(chartRef.current, {
        type: "bar",
        data: {
          labels: chartData.map((row) => row.label),
          datasets: [
            {
              label: "Á¡¼ö",
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
          <div className="content-card animate">?ê³—ì” ?ê³? ?ºëˆ???»ë’— ä»¥ë¬’???ˆë–...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <div className="content-card animate">??»ìªŸ: {error}</div>
        </div>
      </section>
    );
  }

  const activeSeasonTitle = season?.title || seasonId || "??–ì«µ";
  const matchWeight = getMatchWeight(season);
  const activityWeight = getActivityWeight(season);

  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">IMAO CLUB</div>
          <h1 className="section-title">
            <span className="text-gradient">?ê¾©ì” ï§ë‰????€????ê¶?/span>
          </h1>
          <p className="section-description">
            {activeSeasonTitle} ??–ì«µ ì¨??ì¢ë‹”?? ï§ã…»ì¾??¼ì“½ ??•ë£????£í¡ ï§Â€?³ì’•?„äºŒ?±ê½­??          </p>
        </div>

        <div className="rank-tabs">
          <button
            type="button"
            className={`rank-tab ${activeTab === "dashboard" ? "rank-tab--active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            ??ê¶?
          </button>
          <button
            type="button"
            className={`rank-tab ${activeTab === "rules" ? "rank-tab--active" : ""}`}
            onClick={() => setActiveTab("rules")}
          >
            ?????æ´¹ì’–??
          </button>
        </div>

        {activeTab === "dashboard" && (
          <div className="rank-grid">
            <aside className="content-card animate">
              <h2 className="feature-title">ï§ë¬???ê¾ªì†´</h2>
              <p className="feature-description">??¼ë–†åª??ê³—ì” ?ê³—ì—¯??ˆë–.</p>
              <ul className="info-list">
                <li>???ì¢ë‹”: {stats.totalPlayers}</li>
                <li>??å¯ƒì„ë¦? {stats.totalMatches}</li>
                <li>????•ë£: {stats.totalActivities}</li>
              </ul>
            </aside>

            <section className="content-card animate">
              <div className="rank-header">
                <div>
                  <h2 className="feature-title">??¼ë–†åª???–ì</h2>
                  <p className="feature-description">
                    ?ì¢ë‹” ??€ì«????€???ë–†ï§??ê³¸ê½­??ë¿­??è¹‚ëŒ??????‰ë’¿??ˆë–.
                    <br />
                    ??¹ê¶› = å¯ƒì„ë¦?????{Math.round(matchWeight * 100)}%) + ??•ë£?????{Math.round(activityWeight * 100)}%)
                  </p>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="rank-table">
                  <thead>
                    <tr>
                      <th>??–ì</th>
                      <th>?ì¢ë‹”ï§?/th>
                      <th>????¾ë±· ?????/th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={3}>??–ì«µ ?ê³—ì” ?ê³? ??ë’¿??ˆë–.</td>
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
                    {selected.playerName} ??????´ÑŠê½¦ (ï§¤ì’–ì¥?{selected.totalPoints})
                  </h3>
                  <p className="feature-description">ï§ë°?????€?????¾§???è¹‚ëŒê½??</p>
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
            <h2 className="feature-title">?????æ´¹ì’–??(?ë¶¿ë¹Ÿ)</h2>
            <div className="features-grid">
              <div className="feature-card animate">
                <h3 className="feature-title">å¯ƒì„ë¦??????(?????ê¹†ìŸ»)</h3>
                <div className="feature-list">
                  <p><strong>???????/strong></p>
                  <ul className="info-list">
                    <li>- ?ê³—ë“… 5??/li>
                    <li>- ä»¥Â€?ê³—ë“… 4??/li>
                    <li>- 3??3??/li>
                  </ul>
                  <p><strong>??ê¶????/strong></p>
                  <ul className="info-list">
                    <li>??½ëµ‚?ºÂ€: 3 / 2 / 1 ??/li>
                    <li>2?ºÂ€?±Ñˆë ‡: ??½ëµ‚?ºÂ€ å¯ƒì„ë¦????ëª„ì“½ 30%</li>
                  </ul>
                  <p className="feature-description">
                    * ??????ê¶?ï§â‘¤ë±??????ê³¸ìŠœ : è¹‚ë“­?‡è??ï§¡ëª„ë¿???? ï§ã…»ì¾?? ??????€ì¨?ï§¡ë©¸????ê¹†ìŸ»??å¯ƒìŒ??30%ï§??ëª„ì ™
                    <br />
                    (?ì¢ì“½ ?ê¹†ë– æ´¹ì’–?????êµ… ?ê¾©ì” ï§ë‰???????[è¹‚ë“­????·ë„]æ¿?ï§¡ë©¸???å¯ƒìŒ?????—ë¸¿)
                  </p>
                </div>
                <div className="highlight-box">
                  <h4 className="benefit-title">ï§¤ì’–ì¥???–ì å¯ƒê³—??/h4>
                  <ul className="benefit-list">
                    <li><strong>ï§ã…»??11??ï§?æ¹²ê³—?, ????¾ë±· ?????/strong></li>
                    <li>??ˆì ??ï§£ì„??/li>
                    <li>1??–ì: ?ë±€????ê³??ê¾©ìŸ»)</li>
                    <li>2??–ì: ????¹ë–ï§?/li>
                    <li>3??–ì: ????¹ì </li>
                    <li>4??–ì: ï§¤ì’–????¼ì  (?ê¾©ìŠ‚ ??????€???‰ì” ??ï§ã…¼??</li>
                    <li>ï§Â€????ˆì  ??????€???‰ì” ??ï§ã…¼??ï§ê¾ªë»?/li>
                  </ul>
                  <p className="feature-description">
                    * ï§¤ì’–ì¥??ì¢ë‹” ?ì¢Šì»»<br />
                    ?ë¨?£ ?ì¢Šì»»: ??±ë£¸? åª›ê³´ì»??ê³¸ì 5ï§?/ ï§¡â‘¥???1ï§ë‚†? ??ˆí‰¬ ?ê¾¨ë‚«(?ê¾©ì?????)
                  </p>
                </div>
              </div>

              <div className="feature-card animate">
                <h3 className="feature-title">??•ë£ ?????(ï§¡ëª„ë¿???ìº/?Šë±ê¶?</h3>
                <div className="feature-list">
                  <p><strong>æ¹²ê³•????•ë£</strong></p>
                  <ul className="info-list">
                    <li>?ëº?¦°ï§â‘¥????ˆì ´ 1??(ï§Â€åª?è­°ê³ ??0.5??</li>
                  </ul>
                  <p><strong>æ¹²ê³—ë¿???•ë£</strong></p>
                  <ul className="info-list">
                    <li>??€????€? ????2??ì¨??ëª? ?´ë¨®ìª??????3??/li>
                    <li>??????±ê¶— ??½ê¹­??4??ì¨???±ê¶— ??¥ë‹šï§¡ëª„ë¿?2??/li>
                  </ul>
                  <p><strong>???–Š ??•ë£</strong></p>
                  <ul className="info-list">
                    <li>?ì¢ì—¯ ??? ?´ë¨¯??ï§ì„‘?—ï§?3??ì¨??Î»???„ë????ëº£â” 2??/li>
                    <li>??¾ë‚« ï§¡ëª„ë¿?2.5??ì¨???ìºï§???•ë£ ??5??/li>
                  </ul>
                  <p><strong>?ë°¸í€??????/strong></p>
                  <ul className="info-list">
                    <li>?ì¢‰í‡‹ ??? ?°ë¶¿ì¿‡ì¨Œåª›Â€??5??/li>
                    <li>??€??äºŒì‡¨? ??????†ê¸½ 3/2/1??/li>
                    <li>?ëª???????€????????†ê¸½: ?????2è«?/li>
                    <li>??€???MVP 5??/li>
                  </ul>
                  <p><strong>ï§¡â‘£ì»?/strong></p>
                  <ul className="info-list">
                    <li>?¾ë????ºë‰ê°?3??-2?? ??¾¨???-3?? æ¹²ê³•Ğª???? -5????/li>
                  </ul>
                </div>
                <p className="feature-description">
                  ?ê¾©ìŸ» ????ëªƒë’— ?ê³•ì­š ?ëº¤ê¶› è«??ê¹ƒíˆ’/??—ê¹®(?¨â‘¤ë±¶ì¨Œ??»ì¾­ì¨Œé‡‰??¤ï§? ?ºÂ€??ë¿???–ìŠœ
                </p>
              </div>
            </div>

            <p className="feature-description">
              <a
                href="https://imaosports2025.cafe24.com/article/%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD/1/5/"
                target="_blank"
                rel="noreferrer"
              >
                æ´¹ì’–???ë¨?½­??è¹‚ë‹¿ë¦?
              </a>
            </p>
          </section>
        )}
      </div>
    </section>
  );
}




