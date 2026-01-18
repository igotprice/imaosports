"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getAuthInstance, getDb } from "@/lib/firebaseClient";

type RegionOption = { value: string; label: string };

const regionOptions: RegionOption[] = [
  { value: "경상남도", label: "경상남도" },
  { value: "부산광역시", label: "부산광역시" },
  { value: "대구광역시", label: "대구광역시" },
  { value: "울산광역시", label: "울산광역시" },
  { value: "전라북도", label: "전라북도" },
  { value: "전라남도", label: "전라남도" },
  { value: "서울 북서부", label: "서울 북서부" },
  { value: "서울 북동부", label: "서울 북동부" },
  { value: "서울 남서부", label: "서울 남서부" },
  { value: "서울 남동부", label: "서울 남동부" },
  { value: "경기 북서부", label: "경기 북서부" },
  { value: "경기 북동부", label: "경기 북동부" },
  { value: "경기 남서부", label: "경기 남서부" },
  { value: "겸기 남동부", label: "겸기 남동부" },
  { value: "충청북도", label: "충청북도" },
  { value: "충청남도", label: "충청남도" },
  { value: "강원도", label: "강원도" },
  { value: "대전광역시", label: "대전광역시" },
  { value: "경상북도", label: "경상북도" },
  { value: "광주광역시", label: "광주광역시" },
  { value: "제주", label: "제주" },
];

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [termsAgree, setTermsAgree] = useState(false);
  const [privacyAgree, setPrivacyAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => email && password && phone && address && region && termsAgree && privacyAgree,
    [email, password, phone, address, region, termsAgree, privacyAgree]
  );

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password || !phone || !address || !region) {
      setError("필수 항목을 모두 입력해주세요.");
      setLoading(false);
      return;
    }
    if (!termsAgree || !privacyAgree) {
      setError("필수 동의 항목에 체크해주세요.");
      setLoading(false);
      return;
    }

    try {
      const auth = getAuthInstance();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;
      await setDoc(doc(getDb(), "users", uid), {
        email,
        displayName: email,
        status: "active",
        tier: "bronze",
        tierLevel: 10,
        joinedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        phone,
        address,
        region,
        termsAgree,
        privacyAgree,
      });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">IMAO MEMBER</div>
          <h1 className="section-title">회원가입</h1>
          <p className="section-description">가입하기 누르면 로그인 페이지로 이동합니다.</p>
        </div>

        <div className="auth-card">
          <form className="auth-form" onSubmit={handleSignup}>
            <label className="auth-label">
              이메일 (아이디)
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
            <label className="auth-label">
              핸드폰 번호
              <input
                type="tel"
                className="auth-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>
            <label className="auth-label">
              주소
              <input
                type="text"
                className="auth-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </label>
            <label className="auth-label">
              클럽 활동 지역
              <select
                className="auth-input"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                required
              >
                <option value="">선택</option>
                {regionOptions.map((opt) => (
                  <option key={opt.value} value={opt.label}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={termsAgree}
                onChange={(e) => setTermsAgree(e.target.checked)}
                required
              />
              [필수] 이용약관 동의
            </label>
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={privacyAgree}
                onChange={(e) => setPrivacyAgree(e.target.checked)}
                required
              />
              [필수] 개인정보 수집·이용 동의
            </label>

            <button className="btn btn-primary" type="submit" disabled={!canSubmit || loading}>
              회원가입
            </button>
          </form>

          {error && <p className="auth-error">{error}</p>}

          <p className="auth-link">
            이미 계정이 있으신가요? <a href="/login">로그인</a>
          </p>
        </div>
      </div>
    </section>
  );
}
