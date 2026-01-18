"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getAuthInstance, getDb } from "@/lib/firebaseClient";

export default function NewsContactPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserUid(user?.uid || null);
      setUserEmail(user?.email || null);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userUid) {
      setMessage("로그인이 필요합니다.");
      return;
    }
    if (!title || !body) {
      setMessage("제목과 내용을 입력해주세요.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await addDoc(collection(getDb(), "inquiries"), {
        title,
        body,
        userUid,
        userEmail: userEmail || "",
        status: "open",
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setBody("");
      setMessage("문의가 접수되었습니다.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "문의 접수에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">NEWS & QnA</div>
          <h1 className="section-title">아이마오 클럽 문의</h1>
          <p className="section-description">궁금한 내용을 남겨주시면 빠르게 답변드릴게요.</p>
        </div>

        <div className="content-card animate contact-card">
          <h2 className="feature-title">문의 작성</h2>
          <p className="feature-description">작성한 문의는 마이페이지에서 내역으로 확인됩니다.</p>
          <form className="contact-form" onSubmit={handleSubmit}>
            <input
              className="auth-input"
              placeholder="제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <textarea
              className="auth-input"
              placeholder="문의 내용"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              required
            />
            <button className="btn btn-primary" type="submit" disabled={loading}>
              문의 등록
            </button>
            {message && <p className="auth-success">{message}</p>}
          </form>
        </div>
      </div>
    </section>
  );
}
