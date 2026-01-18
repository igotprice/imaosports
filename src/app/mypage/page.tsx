"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getAuthInstance, getDb } from "@/lib/firebaseClient";

type Profile = {
  email?: string;
  phone?: string;
  address?: string;
  region?: string;
  tier?: string;
  tierLevel?: number;
};

type ActivityItem = {
  id: string;
  collection: "matches" | "activities";
  title: string;
  subtitleLines: string[];
  points: number;
  date?: string;
  playerName?: string;
  competitionName?: string;
  type?: string;
  leagueType?: string;
  rank?: string;
  otherClubMember?: string;
  activityType?: string;
};

type InquiryItem = {
  id: string;
  title: string;
  body: string;
  status?: string;
  createdAt?: string;
};

const tierIcon: Record<string, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  admin: "👑",
};

const tierLabel: Record<string, string> = {
  bronze: "브론즈",
  silver: "실버",
  gold: "골드",
  admin: "관리자",
};

const regionOptions = [
  "경상남도",
  "부산광역시",
  "대구광역시",
  "울산광역시",
  "전라북도",
  "전라남도",
  "서울 북서부",
  "서울 북동부",
  "서울 남서부",
  "서울 남동부",
  "경기 북서부",
  "경기 북동부",
  "경기 남서부",
  "겸기 남동부",
  "충청북도",
  "충청남도",
  "강원도",
  "대전광역시",
  "경상북도",
  "광주광역시",
  "제주",
];

const normalizeRank = (value?: string) => {
  const v = (value || "").trim().toLowerCase();
  if (["우승", "1등", "1위"].includes(v)) return "winner";
  if (["준우승", "2등", "2위"].includes(v)) return "runner-up";
  if (["3등", "3위"].includes(v)) return "third";
  return value || "";
};

export default function MyPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState("2025");
  const [pointRules, setPointRules] = useState<Record<string, any>>({});
  const [rulesVersion, setRulesVersion] = useState("");
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);

  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const snap = await getDoc(doc(getDb(), "users", user.uid));
      const data = snap.exists() ? (snap.data() as Profile) : null;
      setProfile(data);
      setPhone(data?.phone || "");
      setAddress(data?.address || "");
      setRegion(data?.region || "");

      const seasonsRef = collection(getDb(), "seasons");
      const activeQuery = query(seasonsRef, where("isActive", "==", true), limit(1));
      const activeSnap = await getDocs(activeQuery);
      const activeSeasonId = !activeSnap.empty ? activeSnap.docs[0].id : "2025";
      setSeasonId(activeSeasonId);

      if (!activeSnap.empty) {
        const seasonData = activeSnap.docs[0].data() as {
          pointRules?: Record<string, any>;
          rulesVersion?: string;
        };
        setPointRules(seasonData.pointRules || {});
        setRulesVersion(seasonData.rulesVersion || "");
      }

      const matchSnap = await getDocs(
        query(
          collection(getDb(), `seasons/${activeSeasonId}/matches`),
          where("playerUid", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(5)
        )
      );
      const activitySnap = await getDocs(
        query(
          collection(getDb(), `seasons/${activeSeasonId}/activities`),
          where("playerUid", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(5)
        )
      );

      const items: ActivityItem[] = [];
      matchSnap.forEach((docSnap) => {
        const m = docSnap.data() as {
          competitionName?: string;
          rank?: string;
          points?: number;
          playerName?: string;
          type?: string;
          leagueType?: string;
          otherClubMember?: string;
          eventDate?: { toDate?: () => Date };
        };
        items.push({
          id: docSnap.id,
          collection: "matches",
          title: "클럽 포인트 등록",
          subtitleLines: [
            m.playerName ? `선수명: ${m.playerName}` : "선수명: -",
            m.competitionName ? `대회: ${m.competitionName}` : "대회: -",
            m.rank ? `성적: ${m.rank}` : "성적: -",
          ],
          points: typeof m.points === "number" ? m.points : 0,
          date: m.eventDate?.toDate ? m.eventDate.toDate().toLocaleDateString() : undefined,
          playerName: m.playerName,
          competitionName: m.competitionName,
          type: m.type,
          leagueType: m.leagueType,
          rank: m.rank,
          otherClubMember: m.otherClubMember,
        });
      });
      activitySnap.forEach((docSnap) => {
        const a = docSnap.data() as {
          activityType?: string;
          points?: number;
          playerName?: string;
          eventDate?: { toDate?: () => Date };
        };
        items.push({
          id: docSnap.id,
          collection: "activities",
          title: "클럽 포인트 등록",
          subtitleLines: [
            a.playerName ? `선수명: ${a.playerName}` : "선수명: -",
            a.activityType ? `활동: ${a.activityType}` : "활동: -",
          ],
          points: typeof a.points === "number" ? a.points : 0,
          date: a.eventDate?.toDate ? a.eventDate.toDate().toLocaleDateString() : undefined,
          playerName: a.playerName,
          activityType: a.activityType,
        });
      });
      items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setActivities(items.slice(0, 6));

      let inquiryItems: InquiryItem[] = [];
      try {
        const inquirySnap = await getDocs(
          query(collection(getDb(), "inquiries"), where("userUid", "==", user.uid), limit(20))
        );
        inquiryItems = inquirySnap.docs.map((docSnap) => {
          const data = docSnap.data() as {
            title?: string;
            body?: string;
            status?: string;
            createdAt?: { toDate?: () => Date };
          };
          return {
            id: docSnap.id,
            title: data.title || "문의",
            body: data.body || "",
            status: data.status || "open",
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : undefined,
          };
        });
      } catch (err) {
        setMessage("문의 내역을 불러오지 못했습니다.");
      }
      inquiryItems.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setInquiries(inquiryItems.slice(0, 5));

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    if (!region) {
      setMessage("클럽 지역을 선택해주세요.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const auth = getAuthInstance();
      const user = auth.currentUser;
      if (!user) return;
      await updateDoc(doc(getDb(), "users", user.uid), {
        phone,
        address,
        region,
        lastLoginAt: serverTimestamp(),
      });
      setMessage("정보가 저장되었습니다.");
      setEditMode(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const computeMatchPoints = (item: ActivityItem) => {
    const matchRules = pointRules.match || {};
    const typeRules = matchRules[item.type || ""] || {};
    const rankKey = normalizeRank(item.rank);
    let base = typeRules[rankKey] ?? 0;
    if ((item.type || "") === "국내대회" && item.leagueType === "2부리그") {
      base *= 0.3;
    }
    if (item.otherClubMember === "예") {
      const penalty = matchRules.otherClubMemberPenalty;
      if (typeof penalty === "number") {
        if (penalty > 0 && penalty < 1) base *= penalty;
        else base -= penalty;
      } else {
        base *= 0.3;
      }
    }
    return Number(base.toFixed(2));
  };

  const computeActivityPoints = (item: ActivityItem) => {
    const activityRules = pointRules.activity || {};
    return typeof activityRules[item.activityType || ""] === "number"
      ? activityRules[item.activityType || ""]
      : 0;
  };

  const handleDelete = async (item: ActivityItem) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    await deleteDoc(doc(getDb(), `seasons/${seasonId}/${item.collection}`, item.id));
    setActivities((prev) => prev.filter((row) => row.id !== item.id));
  };

  const handleUpdate = async (item: ActivityItem) => {
    const docRef = doc(getDb(), `seasons/${seasonId}/${item.collection}`, item.id);
    if (item.collection === "matches") {
      const points = computeMatchPoints(item);
      await updateDoc(docRef, {
        playerName: item.playerName || "",
        competitionName: item.competitionName || "",
        type: item.type || "",
        leagueType: item.leagueType || "",
        rank: item.rank || "",
        otherClubMember: item.otherClubMember || "",
        points,
        ruleVersion: rulesVersion,
        updatedAt: serverTimestamp(),
      });
    } else {
      const points = computeActivityPoints(item);
      await updateDoc(docRef, {
        playerName: item.playerName || "",
        activityType: item.activityType || "",
        points,
        ruleVersion: rulesVersion,
        updatedAt: serverTimestamp(),
      });
    }
    setEditingId(null);
    setActivities((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? {
              ...item,
              points:
                item.collection === "matches"
                  ? computeMatchPoints(item)
                  : computeActivityPoints(item),
              subtitleLines:
                item.collection === "matches"
                  ? [
                      item.playerName ? `선수명: ${item.playerName}` : "선수명: -",
                      item.competitionName ? `대회: ${item.competitionName}` : "대회: -",
                      item.rank ? `성적: ${item.rank}` : "성적: -",
                    ]
                  : [
                      item.playerName ? `선수명: ${item.playerName}` : "선수명: -",
                      item.activityType ? `활동: ${item.activityType}` : "활동: -",
                    ],
            }
          : row
      )
    );
  };

  const tierKey = profile?.tier || "bronze";
  const tierText = tierLabel[tierKey] || profile?.tier || "브론즈";
  const tierEmoji = tierIcon[tierKey] || "⭐";

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <div className="content-card animate">마이페이지를 불러오는 중입니다...</div>
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="section">
        <div className="container">
          <div className="content-card animate">로그인이 필요합니다.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">MY PAGE</div>
          <h1 className="section-title">마이페이지</h1>
          <p className="section-description">회원 정보를 확인할 수 있습니다.</p>
        </div>

        <div className="mypage-grid">
          <div className="content-card animate">
            <div className="mypage-tier">
              <div className="mypage-tier-icon">{tierEmoji}</div>
              <div>
                <p className="mypage-tier-label">{tierText}</p>
                <p className="mypage-tier-sub">등급 {profile.tierLevel ?? "-"}</p>
              </div>
            </div>

            {!editMode ? (
              <div className="mypage-summary">
                <div className="mypage-info">
                  <span>계정(이메일)</span>
                  <strong>{profile.email || "-"}</strong>
                </div>
                <div className="mypage-info">
                  <span>핸드폰 번호</span>
                  <strong>{profile.phone || "-"}</strong>
                </div>
                <div className="mypage-info">
                  <span>주소</span>
                  <strong>{profile.address || "-"}</strong>
                </div>
                <div className="mypage-info mypage-info--region">
                  <span>클럽 활동 지역</span>
                  <strong>{profile.region || "클럽 지역을 선택해주세요."}</strong>
                </div>
                <button className="btn btn-primary" type="button" onClick={() => setEditMode(true)}>
                  정보 수정
                </button>
              </div>
            ) : (
              <div className="mypage-form">
                <label className="auth-label">
                  계정(이메일)
                  <input className="auth-input" value={profile.email || ""} disabled />
                </label>
                <label className="auth-label">
                  핸드폰 번호
                  <input
                    className="auth-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label className="auth-label">
                  주소
                  <input
                    className="auth-input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </label>
                <label className="auth-label">
                  클럽 활동 지역
                  <select
                    className="auth-input"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  >
                    <option value="">선택</option>
                    {regionOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mypage-actions">
                  <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>
                    정보 저장
                  </button>
                  <button className="btn btn-outline" type="button" onClick={() => setEditMode(false)}>
                    취소
                  </button>
                </div>
                {message && <p className="auth-success">{message}</p>}
              </div>
            )}
          </div>

          <div className="content-card animate">
            <h2 className="feature-title">클럽 활동 내역</h2>
            {activities.length === 0 ? (
              <p className="feature-description">등록된 활동 내역이 없습니다.</p>
            ) : (
              <div className="mypage-activity">
                {activities.map((item) => (
                  <div key={item.id} className="mypage-activity-card">
                    <div>
                      <p className="mypage-activity-title">{item.title}</p>
                      <p className="mypage-activity-sub">
                        {item.subtitleLines.map((line, lineIndex) => (
                          <span key={lineIndex}>
                            {line}
                            {lineIndex < item.subtitleLines.length - 1 && <br />}
                          </span>
                        ))}
                      </p>

                      {editingId === item.id && item.collection === "matches" && (
                        <div className="mypage-edit">
                          <input
                            className="auth-input"
                            placeholder="선수명"
                            value={item.playerName || ""}
                            onChange={(e) =>
                              setActivities((prev) =>
                                prev.map((row) =>
                                  row.id === item.id ? { ...row, playerName: e.target.value } : row
                                )
                              )
                            }
                          />
                          <input
                            className="auth-input"
                            placeholder="대회명"
                            value={item.competitionName || ""}
                            onChange={(e) =>
                              setActivities((prev) =>
                                prev.map((row) =>
                                  row.id === item.id ? { ...row, competitionName: e.target.value } : row
                                )
                              )
                            }
                          />
                          <div className="mypage-edit-row">
                            <select
                              className="auth-input"
                              value={item.type || ""}
                              onChange={(e) =>
                                setActivities((prev) =>
                                  prev.map((row) =>
                                    row.id === item.id ? { ...row, type: e.target.value } : row
                                  )
                                )
                              }
                            >
                              <option value="">대회 유형</option>
                              <option>국제대회</option>
                              <option>국내대회</option>
                            </select>
                            <select
                              className="auth-input"
                              value={item.leagueType || ""}
                              onChange={(e) =>
                                setActivities((prev) =>
                                  prev.map((row) =>
                                    row.id === item.id ? { ...row, leagueType: e.target.value } : row
                                  )
                                )
                              }
                            >
                              <option value="">리그</option>
                              <option>오픈부</option>
                              <option>2부리그</option>
                            </select>
                          </div>
                          <div className="mypage-edit-row">
                            <select
                              className="auth-input"
                              value={item.rank || ""}
                              onChange={(e) =>
                                setActivities((prev) =>
                                  prev.map((row) =>
                                    row.id === item.id ? { ...row, rank: e.target.value } : row
                                  )
                                )
                              }
                            >
                              <option value="">성적</option>
                              <option>우승</option>
                              <option>준우승</option>
                              <option>3등</option>
                            </select>
                            <select
                              className="auth-input"
                              value={item.otherClubMember || ""}
                              onChange={(e) =>
                                setActivities((prev) =>
                                  prev.map((row) =>
                                    row.id === item.id ? { ...row, otherClubMember: e.target.value } : row
                                  )
                                )
                              }
                            >
                              <option value="">복식 타클럽 여부</option>
                              <option>예</option>
                              <option>아니오</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {editingId === item.id && item.collection === "activities" && (
                        <div className="mypage-edit">
                          <input
                            className="auth-input"
                            placeholder="선수명"
                            value={item.playerName || ""}
                            onChange={(e) =>
                              setActivities((prev) =>
                                prev.map((row) =>
                                  row.id === item.id ? { ...row, playerName: e.target.value } : row
                                )
                              )
                            }
                          />
                          <input
                            className="auth-input"
                            placeholder="활동 항목"
                            value={item.activityType || ""}
                            onChange={(e) =>
                              setActivities((prev) =>
                                prev.map((row) =>
                                  row.id === item.id ? { ...row, activityType: e.target.value } : row
                                )
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                    <div className="mypage-activity-meta">
                      <span className="mypage-activity-points">{item.points}점</span>
                      {item.date && <span className="mypage-activity-date">{item.date}</span>}
                      <div className="mypage-activity-actions">
                        {editingId === item.id ? (
                          <>
                            <button className="btn btn-primary" type="button" onClick={() => handleUpdate(item)}>
                              저장
                            </button>
                            <button className="btn btn-outline" type="button" onClick={() => setEditingId(null)}>
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-outline" type="button" onClick={() => setEditingId(item.id)}>
                              수정
                            </button>
                            <button className="btn btn-primary" type="button" onClick={() => handleDelete(item)}>
                              삭제
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="content-card animate">
            <h2 className="feature-title">나의 문의 내역</h2>
            {inquiries.length === 0 ? (
              <p className="feature-description">작성한 문의가 없습니다.</p>
            ) : (
              <div className="notice-list">
                {inquiries.map((item) => (
                  <div key={item.id} className="content-card notice-item">
                    <div className="notice-head">
                      <h3 className="feature-title">{item.title}</h3>
                      <span className="notice-meta">
                        {item.createdAt && <span className="notice-date">{item.createdAt}</span>}
                      </span>
                    </div>
                    <p className="feature-description">{item.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
