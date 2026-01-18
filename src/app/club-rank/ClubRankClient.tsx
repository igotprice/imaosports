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
  if (["국제", "국제대회", "international", "intl", "inter"].includes(v)) return "국제대회";
  if (["국내", "국내대회", "domestic", "local"].includes(v)) return "국내대회";
  return val ?? "";
};

const normalizeRank = (val?: string) => {
  const v = normalize(val);
  if (["winner", "win", "champ", "우승", "1", "1위", "first"].includes(v)) return "winner";
  if (["runnerup", "runner-up", "ru", "준우승", "2", "2위", "second"].includes(v)) return "runner-up";
  if (["third", "3", "3위", "bronze", "동메달"].includes(v)) return "third";
  if (["participation", "참가", "참여"].includes(v)) return "participation";
  return val ?? "";
};

const normalizeLeagueType = (val?: string) => {
  const v = normalize(val);
  if (["open", "오픈", "오픈부", "open부"].includes(v)) return "open";
  if (["2", "2부", "2부리그", "division2", "d2", "div2", "2nd"].includes(v)) return "division2";
  return val ?? "";
};

const normalizeOtherClub = (val?: string) => {
  const v = normalize(val);
  if (["예", "네", "yes", "y", "true", "1", "on"].includes(v)) return true;
  if (["아니오", "아니요", "no", "n", "false", "0", "off"].includes(v)) return false;
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
  if (typeKey === "국내대회" && leagueKey === "division2") {
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
          throw new Error("?쒖꽦 ?쒖쫵??李얠쓣 ???놁뒿?덈떎.");
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
        setError(err instanceof Error ? err.message : "?곗씠?곕? 遺덈윭?ㅼ? 紐삵뻽?듬땲??");
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
        { label: "寃쎄린 ?먯젏??, value: selected.matchPointsBase },
        { label: "?쒕룞 ?먯젏??, value: selected.activityPointsBase },
        { label: "寃쎄린 議곗젙", value: selected.matchAdjustment },
        { label: "?쒕룞 議곗젙", value: selected.activityAdjustment },
        { label: "理쒖쥌 媛??李④컧", value: selected.totalAdjustment },
      ];

      chartInstance.current = new Chart(chartRef.current, {
        type: "bar",
        data: {
          labels: chartData.map((row) => row.label),
          datasets: [
            {
              label: "?먯닔",
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
          <div className="content-card animate">?곗씠?곕? 遺덈윭?ㅻ뒗 以묒엯?덈떎...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <div className="content-card animate">?ㅻ쪟: {error}</div>
        </div>
      </section>
    );
  }

  const activeSeasonTitle = season?.title || seasonId || "?쒖쫵";
  const matchWeight = getMatchWeight(season);
  const activityWeight = getActivityWeight(season);

  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">IMAO CLUB</div>
          <h1 className="section-title">
            <span className="text-gradient">?꾩씠留덉삤 ?대읇 ??궧</span>
          </h1>
          <p className="section-description">
            {activeSeasonTitle} ?쒖쫵 쨌 ?좎닔? 硫ㅻ쾭?ㅼ쓽 ?쒕룞???④퍡 吏耳쒕킄二쇱꽭??          </p>
        </div>

        <div className="rank-tabs">
          <button
            type="button"
            className={`rank-tab ${activeTab === "dashboard" ? "rank-tab--active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            ??궧
          </button>
          <button
            type="button"
            className={`rank-tab ${activeTab === "rules" ? "rank-tab--active" : ""}`}
            onClick={() => setActiveTab("rules")}
          >
            ?ъ씤??洹쒖젙
          </button>
        </div>

        {activeTab === "dashboard" && (
          <div className="rank-grid">
            <aside className="content-card animate">
              <h2 className="feature-title">吏묎퀎 ?꾪솴</h2>
              <p className="feature-description">?ㅼ떆媛??곗씠?곗엯?덈떎.</p>
              <ul className="info-list">
                <li>珥??좎닔: {stats.totalPlayers}</li>
                <li>珥?寃쎄린: {stats.totalMatches}</li>
                <li>珥??쒕룞: {stats.totalActivities}</li>
              </ul>
            </aside>

            <section className="content-card animate">
              <div className="rank-header">
                <div>
                  <h2 className="feature-title">?ㅼ떆媛??쒖쐞</h2>
                  <p className="feature-description">
                    ?좎닔 ?대쫫???대┃?섏떆硫??곸꽭?댁뿭??蹂댁떎 ???덉뒿?덈떎.
                    <br />
                    ?⑹궛 = 寃쎄린?ъ씤??{Math.round(matchWeight * 100)}%) + ?쒕룞?ъ씤??{Math.round(activityWeight * 100)}%)
                  </p>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="rank-table">
                  <thead>
                    <tr>
                      <th>?쒖쐞</th>
                      <th>?좎닔紐?/th>
                      <th>珥??띾뱷 ?ъ씤??/th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={3}>?쒖쫵 ?곗씠?곌? ?놁뒿?덈떎.</td>
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
                    {selected.playerName} ?ъ씤??援ъ꽦 (理쒖쥌 {selected.totalPoints})
                  </h3>
                  <p className="feature-description">留됰?瑜??대┃??鍮꾧탳??蹂댁꽭??</p>
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
            <h2 className="feature-title">?ъ씤??洹쒖젙 (?붿빟)</h2>
            <div className="features-grid">
              <div className="feature-card animate">
                <h3 className="feature-title">寃쎄린 ?ъ씤??(????깆쟻)</h3>
                <div className="feature-list">
                  <p><strong>援?젣???/strong></p>
                  <ul className="info-list">
                    <li>- ?곗듅 5??/li>
                    <li>- 以?곗듅 4??/li>
                    <li>- 3??3??/li>
                  </ul>
                  <p><strong>援?궡???/strong></p>
                  <ul className="info-list">
                    <li>?ㅽ뵂遺: 3 / 2 / 1 ??/li>
                    <li>2遺由ш렇: ?ㅽ뵂遺 寃쎄린?ъ씤?몄쓽 30%</li>
                  </ul>
                  <p className="feature-description">
                    * 援?젣/援?궡 紐⑤뱺 ????곸슜 : 蹂듭떇議?李몄뿬??? 硫ㅻ쾭? ????대쨪 李멸????깆쟻??寃쎌슦 30%留??몄젙
                    <br />
                    (?좎쓽 ?깆떎 洹쒖젙???섍굅 ?꾩씠留덉삤 ??댄?[蹂듭옣/?⑷뎄]濡?李멸???寃쎌슦???쒗븿)
                  </p>
                </div>
                <div className="highlight-box">
                  <h4 className="benefit-title">理쒖쥌 ?쒖쐞 寃곗젙</h4>
                  <ul className="benefit-list">
                    <li><strong>留ㅻ뀈 11??留?湲곗?, 珥??띾뱷 ?ъ씤??/strong></li>
                    <li>?숈젏??泥섎━</li>
                    <li>1?쒖쐞: ?뱀옄???곷??꾩쟻)</li>
                    <li>2?쒖쐞: 珥??앹떎李?/li>
                    <li>3?쒖쐞: 珥??앹젏</li>
                    <li>4?쒖쐞: 理쒖냼 ?ㅼ젏 (?꾩슂 ????대툕?덉씠??留ㅼ튂)</li>
                    <li>吏???숈젏 ????대툕?덉씠??留ㅼ튂 吏꾪뻾</li>
                  </ul>
                  <p className="feature-description">
                    * 理쒖쥌 ?좎닔 ?좊컻<br />
                    ?먮룞 ?좊컻: ?㉱룸? 媛곴컖 ?곸쐞 5紐?/ 李⑥닚??1紐낆? ?덈퉬 ?꾨낫(?꾩썝???됯?)
                  </p>
                </div>
              </div>

              <div className="feature-card animate">
                <h3 className="feature-title">?쒕룞 ?ъ씤??(李몄뿬/?댁쁺/遊됱궗)</h3>
                <div className="feature-list">
                  <p><strong>湲곕낯 ?쒕룞</strong></p>
                  <ul className="info-list">
                    <li>?뺢린紐⑥엫/?덈젴 1??(吏媛?議고눜 0.5??</li>
                  </ul>
                  <p><strong>湲곗뿬 ?쒕룞</strong></p>
                  <ul className="info-list">
                    <li>?대읇 ?대? ???2??쨌 ?몃? 援먮쪟?????3??/li>
                    <li>????됱궗 ?ㅽ깭??4??쨌 ?됱궗 ?⑥닚李몄뿬 2??/li>
                  </ul>
                  <p><strong>?뚯떊 ?쒕룞</strong></p>
                  <ul className="info-list">
                    <li>?좎엯 ?뚯썝 援먯쑁/硫섑넗留?3??쨌 ?λ퉬/肄뷀듃 ?뺣━ 2??/li>
                    <li>?띾낫 李몄뿬 2.5??쨌 ?댁쁺吏??쒕룞 ??5??/li>
                  </ul>
                  <p><strong>?밸퀎 ?ъ씤??/strong></p>
                  <ul className="info-list">
                    <li>?좉퇋 ?뚯썝 異붿쿇쨌媛??5??/li>
                    <li>?대읇 二쇨? ????낆긽 3/2/1??/li>
                    <li>?몃?????대읇 ????낆긽: ?ъ씤??2諛?/li>
                    <li>?대떖??MVP 5??/li>
                  </ul>
                  <p><strong>李④컧</strong></p>
                  <ul className="info-list">
                    <li>臾대떒 遺덉갭 3??-2?? 鍮꾨ℓ??-3?? 湲곕Ъ?뚯넀 -5????/li>
                  </ul>
                </div>
                <p className="feature-description">
                  ?꾩쟻 ?ъ씤?몃뒗 ?곕쭚 ?뺤궛 諛??깃툒/?쒗깮(怨⑤뱶쨌?ㅻ쾭쨌釉뚮줎利? 遺?ъ뿉 ?쒖슜
                </p>
              </div>
            </div>

            <p className="feature-description">
              <a
                href="https://imaosports2025.cafe24.com/article/%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD/1/5/"
                target="_blank"
                rel="noreferrer"
              >
                洹쒖젙 ?먯꽭??蹂닿린
              </a>
            </p>
          </section>
        )}
      </div>
    </section>
  );
}

