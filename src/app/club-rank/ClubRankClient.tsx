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
  if (["??", "????", "international", "intl", "inter"].includes(v)) return "????";
  if (["??", "????", "domestic", "local"].includes(v)) return "????";
  return val ?? "";
};

const normalizeRank = (val?: string) => {
  const v = normalize(val);
  if (["winner", "win", "champ", "??", "1", "1?", "first"].includes(v)) return "winner";
  if (["runnerup", "runner-up", "ru", "???", "2", "2?", "second"].includes(v)) return "runner-up";
  if (["third", "3", "3?", "bronze", "???"].includes(v)) return "third";
  if (["participation", "??", "??"].includes(v)) return "participation";
  return val ?? "";
};

const normalizeLeagueType = (val?: string) => {
  const v = normalize(val);
  if (["open", "??", "???", "open?"].includes(v)) return "open";
  if (["2", "2?", "2???", "division2", "d2", "div2", "2nd"].includes(v)) return "division2";
  return val ?? "";
};

const normalizeOtherClub = (val?: string) => {
  const v = normalize(val);
  if (["?", "?", "yes", "y", "true", "1", "on"].includes(v)) return true;
  if (["???", "???", "no", "n", "false", "0", "off"].includes(v)) return false;
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
  if (typeKey === "????" && leagueKey === "division2") {
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
          throw new Error("??뽮쉐 ??뽰サ??筌≪뼚??????곷뮸??덈뼄.");
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
        setError(err instanceof Error ? err.message : "?怨쀬뵠?怨? ?븍뜄???? 筌륁궢六??щ빍??");
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
        { label: "??", value: selected.matchPointsBase },
        { label: "?? ??", value: selected.activityPointsBase },
        { label: "?? ??", value: selected.matchAdjustment },
        { label: "?? ??", value: selected.activityAdjustment },
        { label: "?? ??", value: selected.totalAdjustment },
      ];

      chartInstance.current = new Chart(chartRef.current, {
        type: "bar",
        data: {
          labels: chartData.map((row) => row.label),
          datasets: [
            {
              label: "점수",
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
          <div className="content-card animate">?怨쀬뵠?怨? ?븍뜄???삳뮉 餓λ쵐???덈뼄...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <div className="content-card animate">??살첒: {error}</div>
        </div>
      </section>
    );
  }

  const activeSeasonTitle = season?.title || seasonId || "??뽰サ";
  const matchWeight = getMatchWeight(season);
  const activityWeight = getActivityWeight(season);

  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">IMAO CLUB</div>
          <h1 className="section-title">
            <span className="text-gradient">?袁⑹뵠筌띾뜆????�????沅?/span>
          </h1>
          <p className="section-description">
            {activeSeasonTitle} ??뽰サ 夷??醫롫땾?? 筌롢끇苡??쇱벥 ??뺣짗????ｍ뜞 筌왖�?녹뮆?꾡틠?깃쉭??          </p>
        </div>

        <div className="rank-tabs">
          <button
            type="button"
            className={`rank-tab ${activeTab === "dashboard" ? "rank-tab--active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            ??沅?
          </button>
          <button
            type="button"
            className={`rank-tab ${activeTab === "rules" ? "rank-tab--active" : ""}`}
            onClick={() => setActiveTab("rules")}
          >
            ?????域뱀뮇??
          </button>
        </div>

        {activeTab === "dashboard" && (
          <div className="rank-grid">
            <aside className="content-card animate">
              <h2 className="feature-title">筌욌쵌???袁れ넺</h2>
              <p className="feature-description">??쇰뻻揶??怨쀬뵠?怨쀬뿯??덈뼄.</p>
              <ul className="info-list">
                <li>???醫롫땾: {stats.totalPlayers}</li>
                <li>??野껋럡由? {stats.totalMatches}</li>
                <li>????뺣짗: {stats.totalActivities}</li>
              </ul>
            </aside>

            <section className="content-card animate">
              <div className="rank-header">
                <div>
                  <h2 className="feature-title">??쇰뻻揶???뽰맄</h2>
                  <p className="feature-description">
                    ?醫롫땾 ??�已????�???뤿뻻筌??怨멸쉭??곷열??癰귣똻??????됰뮸??덈뼄.
                    <br />
                    ??밴텦 = 野껋럡由?????{Math.round(matchWeight * 100)}%) + ??뺣짗?????{Math.round(activityWeight * 100)}%)
                  </p>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="rank-table">
                  <thead>
                    <tr>
                      <th>??뽰맄</th>
                      <th>?醫롫땾筌?/th>
                      <th>????얜굣 ?????/th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={3}>??뽰サ ?怨쀬뵠?怨? ??곷뮸??덈뼄.</td>
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
                    {selected.playerName} ??????닌딄쉐 (筌ㅼ뮇伊?{selected.totalPoints})
                  </h3>
                  <p className="feature-description">筌띾맧?????�?????쑨???癰귣똻苑??</p>
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
            <h2 className="feature-title">?????域뱀뮇??(?遺용튋)</h2>
            <div className="features-grid">
              <div className="feature-card animate">
                <h3 className="feature-title">野껋럡由??????(?????源놁읅)</h3>
                <div className="feature-list">
                  <p><strong>???????/strong></p>
                  <ul className="info-list">
                    <li>- ?怨쀫뱟 5??/li>
                    <li>- 餓Β�?怨쀫뱟 4??/li>
                    <li>- 3??3??/li>
                  </ul>
                  <p><strong>??沅????/strong></p>
                  <ul className="info-list">
                    <li>??쎈탞?봔�: 3 / 2 / 1 ??/li>
                    <li>2?봔�?귐덈젃: ??쎈탞?봔� 野껋럡由????紐꾩벥 30%</li>
                  </ul>
                  <p className="feature-description">
                    * ??????沅?筌뤴뫀諭??????怨몄뒠 : 癰귣벊?뉓??筌〓챷肉???? 筌롢끇苡?? ??????�夷?筌〓㈇????源놁읅??野껋럩??30%筌??紐꾩젟
                    <br />
                    (?醫롮벥 ?源녿뼄 域뱀뮇?????띻탢 ?袁⑹뵠筌띾뜆???????[癰귣벊????룸럡]嚥?筌〓㈇???野껋럩?????쀫맙)
                  </p>
                </div>
                <div className="highlight-box">
                  <h4 className="benefit-title">筌ㅼ뮇伊???뽰맄 野껉퀣??/h4>
                  <ul className="benefit-list">
                    <li><strong>筌띲끇??11??筌?疫꿸퀣?, ????얜굣 ?????/strong></li>
                    <li>??덉젎??筌ｌ꼶??/li>
                    <li>1??뽰맄: ?諭�????怨??袁⑹읅)</li>
                    <li>2??뽰맄: ????밸뼄筌?/li>
                    <li>3??뽰맄: ????뱀젎</li>
                    <li>4??뽰맄: 筌ㅼ뮇????쇱젎 (?袁⑹뒄 ??????�???됱뵠??筌띲끉??</li>
                    <li>筌왖�????덉젎 ??????�???됱뵠??筌띲끉??筌욊쑵六?/li>
                  </ul>
                  <p className="feature-description">
                    * 筌ㅼ뮇伊??醫롫땾 ?醫딆뻣<br />
                    ?癒?짗 ?醫딆뻣: ??깅８? 揶쏄낫而??怨몄맄 5筌?/ 筌△뫁???1筌뤿굞? ??덊돩 ?袁⑤궖(?袁⑹뜚?????)
                  </p>
                </div>
              </div>

              <div className="feature-card animate">
                <h3 className="feature-title">??뺣짗 ?????(筌〓챷肉???곸겫/?딅맩沅?</h3>
                <div className="feature-list">
                  <p><strong>疫꿸퀡????뺣짗</strong></p>
                  <ul className="info-list">
                    <li>?類?┛筌뤴뫁????덉졃 1??(筌왖�揶?鈺곌퀬??0.5??</li>
                  </ul>
                  <p><strong>疫꿸퀣肉???뺣짗</strong></p>
                  <ul className="info-list">
                    <li>??�????�? ????2??夷??紐? ?대Ŧ履??????3??/li>
                    <li>??????깃텢 ??쎄묶??4??夷???깃텢 ??λ떄筌〓챷肉?2??/li>
                  </ul>
                  <p><strong>???뻿 ??뺣짗</strong></p>
                  <ul className="info-list">
                    <li>?醫롮뿯 ???뜚 ?대Ŋ??筌롮꼹?쀯쭕?3??夷??貫???꾨????類ｂ봺 2??/li>
                    <li>??얜궖 筌〓챷肉?2.5??夷???곸겫筌???뺣짗 ??5??/li>
                  </ul>
                  <p><strong>?諛명�??????/strong></p>
                  <ul className="info-list">
                    <li>?醫됲뇣 ???뜚 ?곕뗄荑뉗쮯揶쎛�??5??/li>
                    <li>??�??雅뚯눊? ??????녾맒 3/2/1??/li>
                    <li>?紐???????�????????녾맒: ?????2獄?/li>
                    <li>??�???MVP 5??/li>
                  </ul>
                  <p><strong>筌△몿而?/strong></p>
                  <ul className="info-list">
                    <li>?얜????븍뜆媛?3??-2?? ??쑬???-3?? 疫꿸퀡窺???? -5????/li>
                  </ul>
                </div>
                <p className="feature-description">
                  ?袁⑹읅 ????紐껊뮉 ?怨뺤춾 ?類ㅺ텦 獄??源껎닋/??쀪문(?ⓥ뫀諭띠쮯??살쒔夷뚪뇡??쨴筌? ?봔�??肉???뽰뒠
                </p>
              </div>
            </div>

            <p className="feature-description">
              <a
                href="https://imaosports2025.cafe24.com/article/%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD/1/5/"
                target="_blank"
                rel="noreferrer"
              >
                域뱀뮇???癒?쉭??癰귣떯由?
              </a>
            </p>
          </section>
        )}
      </div>
    </section>
  );
}




