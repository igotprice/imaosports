"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getAuthInstance, getDb } from "@/lib/firebaseClient";

type PointRules = {
  match?: Record<string, Record<string, number>>;
  activity?: Record<string, number>;
  otherClubMemberPenalty?: number;
};

type SeasonData = {
  title?: string;
  rulesVersion?: string;
  pointRules?: PointRules;
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

const activityAlias: Record<string, string> = {
  정기모임: "정기모임",
  훈련: "훈련",
  지각: "지각",
  조퇴: "조퇴",
  클럽내부대회: "내부리그 운영",
  외부교류전: "외부교류전",
  외부대회참여: "외부교류전",
  대회스태프: "봉사/운영",
  행사참여: "봉사/운영",
  신입회원교육: "홍보/콘텐츠",
  멘토링: "홍보/콘텐츠",
  장비정리: "봉사/운영",
  코트정리: "봉사/운영",
  홍보참여: "홍보/콘텐츠",
  운영진활동: "내부리그 운영",
  신규회원추천: "홍보/콘텐츠",
  클럽주관대회입상_우승: "내부리그 운영",
  클럽주관대회입상_준우승: "내부리그 운영",
  클럽주관대회입상_3등: "내부리그 운영",
  외부대회입상_우승: "외부교류전",
  외부대회입상_준우승: "외부교류전",
  외부대회입상_3등: "외부교류전",
  MVP: "홍보/콘텐츠",
  무단불참3회: "봉사/운영",
  비매너: "봉사/운영",
  기물파손: "봉사/운영",
};

function computeMatchPoints(
  rules: PointRules,
  type: string,
  rank: string,
  leagueType: string,
  otherClubMember: string
) {
  const matchRules = rules.match || {};
  const typeKey = normalizeType(type);
  const rankKey = normalizeRank(rank);
  const leagueKey = normalizeLeagueType(leagueType);
  const typeRules = matchRules[typeKey] || {};

  let base = 0;
  if (typeKey === "국내대회" && leagueKey === "division2") {
    const openBase = typeRules[rankKey] ?? 0;
    base = openBase * 0.3;
  } else {
    base = typeRules[rankKey] ?? 0;
  }

  if (normalizeOtherClub(otherClubMember)) {
    const penalty = rules.otherClubMemberPenalty;
    if (typeof penalty === "number") {
      if (penalty > 0 && penalty < 1) base = base * penalty;
      else base = base - penalty;
    } else {
      base = base * 0.3;
    }
  }

  return Number(base.toFixed(2));
}

function computeActivityPoints(rules: PointRules, activityType: string) {
  const activityRules = rules.activity || {};
  const normalized = activityAlias[activityType] || activityType;
  const points = activityRules[normalized];
  return typeof points === "number" ? points : 0;
}

async function fetchSeason() {
  const db = getDb();
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

export default function ClubPointClient() {
  const [tierLevel, setTierLevel] = useState(0);
  const [uid, setUid] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [rules, setRules] = useState<PointRules>({});
  const [rulesVersion, setRulesVersion] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ title: string; message: string; ok: boolean } | null>(
    null
  );

  const canAccess = tierLevel >= 30;

  useEffect(() => {
    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        setTierLevel(0);
        setLoading(false);
        return;
      }
      setUid(user.uid);
      const userSnap = await getDoc(doc(getDb(), "users", user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const level =
        typeof userData?.tierLevel === "number" ? (userData?.tierLevel as number) : 0;
      setTierLevel(level);

      const season = await fetchSeason();
      if (season) {
        setSeasonId(season.id);
        setRules(season.data.pointRules || {});
        setRulesVersion(season.data.rulesVersion);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showToast = (title: string, message: string, ok = true) => {
    setToast({ title, message, ok });
    window.setTimeout(() => setToast(null), 3000);
  };

  const titleSuffix = useMemo(() => (seasonId ? `(${seasonId})` : ""), [seasonId]);

  const handleMatchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const playerName = String(data.get("playerName") || "").trim();
    const competitionName = String(data.get("competitionName") || "").trim();
    const type = String(data.get("type") || "").trim();
    const leagueType = String(data.get("leagueType") || "").trim();
    const rank = String(data.get("rank") || "").trim();
    const otherClubMember = String(data.get("otherClubMember") || "").trim();

    if (!playerName || !competitionName || !type || !rank || !otherClubMember) {
      showToast("입력 필요", "필수 항목을 확인하세요.", false);
      return;
    }
    if (type === "국내대회" && !leagueType) {
      showToast("입력 필요", "국내대회는 리그(오픈부/2부리그)를 선택해주세요.", false);
      return;
    }

    const points = computeMatchPoints(rules, type, rank, leagueType, otherClubMember);
    try {
      await addDoc(collection(getDb(), `seasons/${seasonId}/matches`), {
        playerUid: uid || "",
        playerName,
        competitionName,
        type,
        leagueType,
        rank,
        otherClubMember,
        eventDate: serverTimestamp(),
        points,
        ruleVersion: rulesVersion || "",
        status: "pending",
        createdByUid: uid || "",
        createdAt: serverTimestamp(),
      });
      form.reset();
      showToast("등록 완료", "경기결과가 저장되었습니다.");
    } catch (error) {
      showToast("등록 실패", error instanceof Error ? error.message : "저장 실패", false);
    }
  };

  const handleActivitySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const playerName = String(data.get("playerName") || "").trim();
    const activityType = String(data.get("activityType") || "").trim();
    if (!playerName || !activityType) {
      showToast("입력 필요", "필수 항목을 확인하세요.", false);
      return;
    }

    const points = computeActivityPoints(rules, activityType);
    try {
      await addDoc(collection(getDb(), `seasons/${seasonId}/activities`), {
        playerUid: uid || "",
        playerName,
        activityType,
        eventDate: serverTimestamp(),
        points,
        ruleVersion: rulesVersion || "",
        status: "pending",
        createdByUid: uid || "",
        createdAt: serverTimestamp(),
      });
      form.reset();
      showToast("등록 완료", "활동결과가 저장되었습니다.");
    } catch (error) {
      showToast("등록 실패", error instanceof Error ? error.message : "저장 실패", false);
    }
  };

  const handleAdjustSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const playerName = String(data.get("playerName") || "").trim();
    const applyTo = String(data.get("applyTo") || "").trim();
    const type = String(data.get("type") || "").trim();
    const pointsRaw = String(data.get("points") || "").trim();
    const note = String(data.get("note") || "").trim();
    const dateLabel = String(data.get("date") || "").trim();

    if (!playerName || !applyTo || !type || !pointsRaw) {
      showToast("입력 필요", "적용대상/종류/점수를 확인하세요.", false);
      return;
    }

    const points = Number(pointsRaw);
    if (Number.isNaN(points)) {
      showToast("입력 오류", "점수는 숫자만 입력하세요.", false);
      return;
    }

    try {
      await addDoc(collection(getDb(), `seasons/${seasonId}/adjustments`), {
        playerUid: uid || "",
        playerName,
        applyTo,
        type,
        points,
        note,
        dateLabel,
        createdByUid: uid || "",
        createdAt: serverTimestamp(),
      });
      form.reset();
      showToast("등록 완료", "조정 항목이 저장되었습니다.");
    } catch (error) {
      showToast("등록 실패", error instanceof Error ? error.message : "저장 실패", false);
    }
  };

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <div className="content-card animate">권한을 확인하는 중입니다...</div>
        </div>
      </section>
    );
  }

  if (!uid) {
    return (
      <section className="section">
        <div className="container">
          <div className="content-card animate">로그인이 필요합니다.</div>
        </div>
      </section>
    );
  }

  if (!canAccess) {
    return (
      <section className="section">
        <div className="container">
          <div className="content-card animate">골드 등급 이상만 접근할 수 있습니다.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">IMAO CLUB</div>
          <h1 className="section-title">
            클럽 포인트 등록 <span className="text-gradient">{titleSuffix}</span>
          </h1>
          <p className="section-description">입력한 항목은 대시보드에 자동 반영됩니다.</p>
        </div>

        <div className="club-form-grid">
          <form className="club-form-card" onSubmit={handleMatchSubmit} autoComplete="off">
            <header className="club-form-head">
              <h3 className="club-form-title">경기 결과 등록</h3>
              <p className="club-form-sub">국제/국내 · 오픈/2부(국내) · 우승/준우승/3등 · 복식 타클럽 여부</p>
            </header>

            <div className="club-form-body">
              <label className="club-form-field">
                <span className="club-form-label">선수명 *</span>
                <input className="club-form-input" name="playerName" placeholder="예) 홍길동" required />
              </label>

              <label className="club-form-field">
                <span className="club-form-label">대회명 *</span>
                <input className="club-form-input" name="competitionName" placeholder="예) IMAO OPEN 2025" required />
              </label>

              <div className="club-form-row">
                <label className="club-form-field">
                  <span className="club-form-label">대회 유형 *</span>
                  <select className="club-form-select" name="type" required>
                    <option value="">선택</option>
                    <option>국제대회</option>
                    <option>국내대회</option>
                  </select>
                </label>
                <label className="club-form-field">
                  <span className="club-form-label">리그(국내만)</span>
                  <select className="club-form-select" name="leagueType">
                    <option value="">선택</option>
                    <option>오픈부</option>
                    <option>2부리그</option>
                  </select>
                </label>
              </div>

              <div className="club-form-row">
                <label className="club-form-field">
                  <span className="club-form-label">성적 *</span>
                  <select className="club-form-select" name="rank" required>
                    <option value="">선택</option>
                    <option>우승</option>
                    <option>준우승</option>
                    <option>3등</option>
                  </select>
                </label>
                <label className="club-form-field">
                  <span className="club-form-label">복식 타클럽 팀 여부 *</span>
                  <select className="club-form-select" name="otherClubMember" required>
                    <option value="">선택</option>
                    <option>예</option>
                    <option>아니오</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="club-form-actions">
              <button className="btn btn-primary" type="submit">경기결과 등록</button>
              <p className="club-form-note">집계는 대시보드에서 자동 반영됩니다.</p>
            </div>
          </form>

          <form className="club-form-card" onSubmit={handleActivitySubmit} autoComplete="off">
            <header className="club-form-head">
              <h3 className="club-form-title">활동 결과 등록</h3>
              <p className="club-form-sub">활동 항목은 한글 그대로 입력</p>
            </header>

            <div className="club-form-body">
              <label className="club-form-field">
                <span className="club-form-label">선수명 *</span>
                <input className="club-form-input" name="playerName" placeholder="예) 홍길동" required />
              </label>

              <label className="club-form-field">
                <span className="club-form-label">활동 항목(한글) *</span>
                <input className="club-form-input" name="activityType" list="imao-act" placeholder="예) 정기모임" required />
              </label>
              <datalist id="imao-act">
                <option>정기모임</option>
                <option>훈련</option>
                <option>지각</option>
                <option>조퇴</option>
                <option>클럽내부대회</option>
                <option>외부교류전</option>
                <option>외부대회참여</option>
                <option>대회스태프</option>
                <option>행사참여</option>
                <option>신입회원교육</option>
                <option>멘토링</option>
                <option>장비정리</option>
                <option>코트정리</option>
                <option>홍보참여</option>
                <option>운영진활동</option>
                <option>신규회원추천</option>
                <option>클럽주관대회입상_우승</option>
                <option>클럽주관대회입상_준우승</option>
                <option>클럽주관대회입상_3등</option>
                <option>외부대회입상_우승</option>
                <option>외부대회입상_준우승</option>
                <option>외부대회입상_3등</option>
                <option>MVP</option>
                <option>무단불참3회</option>
                <option>비매너</option>
                <option>기물파손</option>
              </datalist>
              <div className="club-form-tags">
                <span className="club-form-tag">정기모임 10</span>
                <span className="club-form-tag">훈련 10</span>
                <span className="club-form-tag">지각 5</span>
                <span className="club-form-tag">조퇴 5</span>
                <span className="club-form-tag">대회스태프 40</span>
                <span className="club-form-tag">MVP 50</span>
              </div>
            </div>

            <div className="club-form-actions">
              <button className="btn btn-primary" type="submit">활동결과 등록</button>
              <p className="club-form-note">활동 점수는 규정표에 맞춰 자동 계산됩니다.</p>
            </div>
          </form>

          <form className="club-form-card" onSubmit={handleAdjustSubmit} autoComplete="off">
            <header className="club-form-head">
              <h3 className="club-form-title">조정(가산/차감) 등록</h3>
              <p className="club-form-sub">위원회 결정 등 임의 가산/차감</p>
            </header>

            <div className="club-form-body">
              <label className="club-form-field">
                <span className="club-form-label">선수명 *</span>
                <input className="club-form-input" name="playerName" placeholder="예) 홍길동" required />
              </label>

              <div className="club-form-row">
                <label className="club-form-field">
                  <span className="club-form-label">적용 대상 *</span>
                  <select className="club-form-select" name="applyTo" required>
                    <option value="">선택</option>
                    <option value="match">경기</option>
                    <option value="activity">활동</option>
                    <option value="total">최종</option>
                  </select>
                </label>
                <label className="club-form-field">
                  <span className="club-form-label">종류 *</span>
                  <select className="club-form-select" name="type" required>
                    <option value="">선택</option>
                    <option value="bonus">가산</option>
                    <option value="penalty">차감</option>
                  </select>
                </label>
              </div>

              <div className="club-form-row">
                <label className="club-form-field">
                  <span className="club-form-label">점수 *</span>
                  <input className="club-form-input" name="points" type="number" placeholder="예) 20 또는 -10" required />
                </label>
                <label className="club-form-field">
                  <span className="club-form-label">일자</span>
                  <input className="club-form-input" name="date" type="date" />
                </label>
              </div>

              <label className="club-form-field">
                <span className="club-form-label">사유</span>
                <input className="club-form-input" name="note" placeholder="예) 위원회 특별 가산" />
              </label>
            </div>

            <div className="club-form-actions">
              <button className="btn btn-primary" type="submit">조정 항목 등록</button>
              <p className="club-form-note">최종 계산: (경기 50% + 활동 50%) + 최종 조정</p>
            </div>
          </form>
        </div>

        {toast && (
          <div className={`club-toast ${toast.ok ? "club-toast--ok" : "club-toast--err"}`}>
            <div className="club-toast-title">{toast.title}</div>
            <div>{toast.message}</div>
          </div>
        )}
      </div>
    </section>
  );
}
