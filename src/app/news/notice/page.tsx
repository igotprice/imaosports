"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { getAuthInstance, getDb } from "@/lib/firebaseClient";

type NoticeItem = {
  id: string;
  title: string;
  body: string;
  createdAt?: string;
};

export default function NewsNoticePage() {
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tierLevel, setTierLevel] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadItems = async () => {
    const snap = await getDocs(query(collection(getDb(), "notices"), orderBy("createdAt", "desc")));
    const list: NoticeItem[] = snap.docs.map((docSnap) => {
      const data = docSnap.data() as {
        title?: string;
        body?: string;
        createdAt?: { toDate?: () => Date };
      };
      return {
        id: docSnap.id,
        title: data.title || "공지사항",
        body: data.body || "",
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : undefined,
      };
    });
    setItems(list);
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTierLevel(0);
        return;
      }
      const target = await getDoc(doc(getDb(), "users", user.uid));
      if (!target.exists()) {
        setTierLevel(0);
        return;
      }
      const data = target.data() as { tierLevel?: number; tier?: string };
      if (typeof data.tierLevel === "number") {
        setTierLevel(data.tierLevel);
      } else if (data.tier === "gold") {
        setTierLevel(30);
      } else if (data.tier === "admin") {
        setTierLevel(99);
      } else if (data.tier === "silver") {
        setTierLevel(20);
      } else {
        setTierLevel(10);
      }
    });
    return () => unsubscribe();
  }, []);

  const canWrite = tierLevel >= 30;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title || !body) {
      setMessage("제목과 내용을 입력해주세요.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await addDoc(collection(getDb(), "notices"), {
        title,
        body,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setBody("");
      await loadItems();
      setMessage("공지사항이 등록되었습니다.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">NEWS & QnA</div>
          <h1 className="section-title">공지사항</h1>
          <p className="section-description">클럽 공지 및 일정 업데이트를 확인하세요.</p>
        </div>

        <div className="notice-actions">
          <button
            className={`btn btn-outline notice-toggle ${canWrite ? "" : "notice-toggle--disabled"}`}
            type="button"
            disabled={!canWrite}
            onClick={() => setShowForm((v) => !v)}
          >
            공지 작성
          </button>
          {!canWrite && (
            <span className="notice-lock">골드 등급 이상만 사용 가능</span>
          )}
        </div>

        {canWrite && showForm && (
          <div className="content-card animate notice-form">
            <h2 className="feature-title">공지 작성</h2>
            <form className="gallery-form" onSubmit={handleSubmit}>
              <input
                className="auth-input"
                placeholder="제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className="auth-input"
                placeholder="내용"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
              />
              <button className="btn btn-primary" type="submit" disabled={loading}>
                공지 등록
              </button>
              {message && <p className="auth-success">{message}</p>}
            </form>
          </div>
        )}

        <div className="notice-list">
          {items.map((item) => {
            const isOpen = expandedId === item.id;
            return (
              <div key={item.id} className="content-card animate notice-item">
                <button
                  type="button"
                  className="notice-head"
                  onClick={() => setExpandedId(isOpen ? null : item.id)}
                >
                  <h3 className="feature-title">{item.title}</h3>
                  <span className="notice-meta">
                    {item.createdAt && <span className="notice-date">{item.createdAt}</span>}
                    <span className="notice-toggle-indicator">{isOpen ? "−" : "+"}</span>
                  </span>
                </button>
                {isOpen && <p className="feature-description">{item.body}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
