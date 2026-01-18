"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getAuthInstance, getDb } from "@/lib/firebaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = getAuthInstance();
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await updateDoc(doc(getDb(), "users", credential.user.uid), {
        lastLoginAt: serverTimestamp(),
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const auth = getAuthInstance();
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const user = credential.user;
      const userDoc = doc(getDb(), "users", user.uid);
      await setDoc(
        userDoc,
        {
          email: user.email || "",
          displayName: user.displayName || user.email || "IMAO 회원",
          status: "active",
          tier: "bronze",
          tierLevel: 10,
          joinedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          photoURL: user.photoURL || "",
        },
        { merge: true }
      );
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);
    if (!resetEmail) {
      setError("이메일을 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const auth = getAuthInstance();
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage("비밀번호 재설정 이메일을 보냈습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">IMAO MEMBER</div>
          <h1 className="section-title">로그인</h1>
          <p className="section-description">클럽 포인트 및 랭킹 서비스를 이용하려면 로그인해주세요.</p>
        </div>

        <div className="auth-card">
          <button className="auth-google" type="button" onClick={handleGoogleLogin} disabled={loading}>
            Google로 계속하기
          </button>

          <div className="auth-divider">또는 이메일로 로그인</div>

          <form className="auth-form" onSubmit={handleEmailLogin}>
            <label className="auth-label">
              이메일
              <input
                type="email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="auth-label">
              비밀번호
              <input
                type="password"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              로그인
            </button>
          </form>

          {error && <p className="auth-error">{error}</p>}
          {resetMessage && <p className="auth-success">{resetMessage}</p>}

          <p className="auth-link">
            아직 회원이 아니신가요? <a href="/signup">회원가입</a>
          </p>

          <button
            className="btn btn-outline auth-reset-toggle"
            type="button"
            onClick={() => setShowReset((v) => !v)}
          >
            비밀번호 찾기
          </button>

          {showReset && (
            <form className="auth-reset" onSubmit={handlePasswordReset}>
              <label className="auth-label">
                비밀번호 찾기 (이메일)
                <input
                  type="email"
                  className="auth-input"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
              </label>
              <button className="btn btn-outline" type="submit" disabled={loading}>
                비밀번호 재설정 메일 보내기
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
