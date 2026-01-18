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
  if (["winner", "win", "champ", "우승", "1", "1등", "1위", "first"].includes(v)) return "winner";
  if (["runnerup", "runner-up", "ru", "준우승", "2", "2등", "2위", "second"].includes(v)) return "runner-up";
  if (["third", "3", "3등", "3위", "bronze", "동", "동메달"].includes(v)) return "third";
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
  if (["예", "yes", "y", "true", "1", "on"].includes(v)) return true;
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

function getMatchWeight(season?: SeasonData) {
  return typeof season?.matchWeight === "number" ? season.matchWeight : 0.5;
}

function getActivityWeight(season?: SeasonData) {
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
          throw new Error("활성 시즌을 찾을 수 없습니다.");
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
        setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
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
        { label: "경기 원점수", value: selected.matchPointsBase },
        { label: "활동 원점수", value: selected.activityPointsBase },
        { label: "경기 조정", value: selected.matchAdjustment },
        { label: "활동 조정", value: selected.activityAdjustment },
        { label: "최종 가산/차감", value: selected.totalAdjustment },
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
          <div className="content-card animate">데이터를 불러오는 중입니다...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <div className="content-card animate">오류: {error}</div>
        </div>
      </section>
    );
  }

  const activeSeasonTitle = season?.title || seasonId || "시즌";
  const matchWeight = getMatchWeight(season);
  const activityWeight = getActivityWeight(season);

  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">IMAO CLUB</div>
          <h1 className="section-title">
            <span className="text-gradient">아이마오 클럽 랭킹</span>
          </h1>
          <p className="section-description">
            {activeSeasonTitle} 시즌 · 선수와 멤버들의 활동을 함께 지켜봐주세요
          </p>
        </div>

        <div className="rank-tabs">
          <button
            type="button"
            className={`rank-tab ${activeTab === "dashboard" ? "rank-tab--active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            랭킹
          </button>
          <button
            type="button"
            className={`rank-tab ${activeTab === "rules" ? "rank-tab--active" : ""}`}
            onClick={() => setActiveTab("rules")}
          >
            포인트 규정
          </button>
        </div>

        {activeTab === "dashboard" && (
          <div className="rank-grid">
            <aside className="content-card animate">
              <h2 className="feature-title">집계 현황</h2>
              <p className="feature-description">실시간 데이터입니다.</p>
              <ul className="info-list">
                <li>총 선수: {stats.totalPlayers}</li>
                <li>총 경기: {stats.totalMatches}</li>
                <li>총 활동: {stats.totalActivities}</li>
              </ul>
            </aside>

            <section className="content-card animate">
              <div className="rank-header">
                <div>
                  <h2 className="feature-title">실시간 순위</h2>
                  <p className="feature-description">
                    선수 이름을 클릭하시면 상세내역을 보실 수 있습니다.
                    <br />
                    합산 = 경기포인트({Math.round(matchWeight * 100)}%) + 활동포인트({Math.round(activityWeight * 100)}%)
                  </p>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="rank-table">
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>선수명</th>
                      <th>총 획득 포인트</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={3}>시즌 데이터가 없습니다.</td>
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
                    {selected.playerName} 포인트 구성 (최종 {selected.totalPoints})
                  </h3>
                  <p className="feature-description">막대를 클릭해 비교해 보세요.</p>
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
            <h2 className="feature-title">포인트 규정 (요약)</h2>
            <div className="features-grid">
              <div className="feature-card animate">
                <h3 className="feature-title">경기 포인트 (대회 성적)</h3>
                <div className="feature-list">
                  <p><strong>국제대회</strong></p>
                  <ul className="info-list">
                    <li>- 우승 5점</li>
                    <li>- 준우승 4점</li>
                    <li>- 3등 3점</li>
                  </ul>
                  <p><strong>국내대회</strong></p>
                  <ul className="info-list">
                    <li>오픈부: 3 / 2 / 1 점</li>
                    <li>2부리그: 오픈부 경기포인트의 30%</li>
                  </ul>
                  <p className="feature-description">
                    * 국제/국내 모든 대회 적용 : 복식조 참여시 타 멤버와 팀을 이뤄 참가한 성적의 경우 30%만 인정
                    <br />
                    (신의 성실 규정에 의거 아이마오 타이틀[복장/용구]로 참가한 경우에 한함)
                  </p>
                </div>
                <div className="highlight-box">
                  <h4 className="benefit-title">최종 순위 결정</h4>
                  <ul className="benefit-list">
                    <li><strong>매년 11월 말 기준, 총 획득 포인트</strong></li>
                    <li>동점자 처리</li>
                    <li>1순위: 승자승(상대전적)</li>
                    <li>2순위: 총 득실차</li>
                    <li>3순위: 총 득점</li>
                    <li>4순위: 최소 실점 (필요 시 타이브레이크 매치)</li>
                    <li>지속 동점 시 타이브레이크 매치 진행</li>
                  </ul>
                  <p className="feature-description">
                    * 최종 선수 선발<br />
                    자동 선발: 남·녀 각각 상위 5명 / 차순위 1명은 예비 후보(위원회 평가)
                  </p>
                </div>
              </div>

              <div className="feature-card animate">
                <h3 className="feature-title">활동 포인트 (참여/운영/봉사)</h3>
                <div className="feature-list">
                  <p><strong>기본 활동</strong></p>
                  <ul className="info-list">
                    <li>정기모임/훈련 1점 (지각/조퇴 0.5점)</li>
                  </ul>
                  <p><strong>기여 활동</strong></p>
                  <ul className="info-list">
                    <li>클럽 내부 대회 2점 · 외부 교류전/대회 3점</li>
                    <li>대회/행사 스태프 4점 · 행사 단순참여 2점</li>
                  </ul>
                  <p><strong>헌신 활동</strong></p>
                  <ul className="info-list">
                    <li>신입 회원 교육/멘토링 3점 · 장비/코트 정리 2점</li>
                    <li>홍보 참여 2.5점 · 운영진 활동 월 5점</li>
                  </ul>
                  <p><strong>특별 포인트</strong></p>
                  <ul className="info-list">
                    <li>신규 회원 추천·가입 5점</li>
                    <li>클럽 주관 대회 입상 3/2/1점</li>
                    <li>외부대회 클럽 대표 입상: 포인트 2배</li>
                    <li>이달의 MVP 5점</li>
                  </ul>
                  <p><strong>차감</strong></p>
                  <ul className="info-list">
                    <li>무단 불참 3회 -2점, 비매너 -3점, 기물파손 -5점 등</li>
                  </ul>
                </div>
                <p className="feature-description">
                  누적 포인트는 연말 정산 및 등급/혜택(골드·실버·브론즈) 부여에 활용
                </p>
              </div>
            </div>

            <p className="feature-description">
              <a
                href="https://imaosports2025.cafe24.com/article/%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD/1/5/"
                target="_blank"
                rel="noreferrer"
              >
                규정 자세히 보기
              </a>
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
