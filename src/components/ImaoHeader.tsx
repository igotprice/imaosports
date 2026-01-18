"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getAuthInstance, getDb } from "@/lib/firebaseClient";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

type NavItem = { label: string; href: string };

export default function ImaoHeader() {
  const [open, setOpen] = useState(false);
  const [tierLevel, setTierLevel] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const nav: NavItem[] = useMemo(
    () => {
      const items: NavItem[] = [
      { label: "아이마오", href: "/" },
      { label: "CLUB RANK", href: "/club-rank" },
      { label: "피클볼이란?", href: "/pickleball" },
      { label: "제품 라인업", href: "/products" },
      { label: "NEWS & QnA", href: "/news" },
      ];
      if (tierLevel >= 30) {
        items.push({ label: "클럽포인트 등록", href: "/club-point" });
      }
      return items;
    },
    [tierLevel]
  );

  const cta = "로그인";

  useEffect(() => {
    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsLoggedIn(false);
        setTierLevel(0);
        return;
      }
      setIsLoggedIn(true);
      const snap = await getDoc(doc(getDb(), "users", user.uid));
      if (!snap.exists()) {
        setTierLevel(0);
        return;
      }
      const data = snap.data() as { tierLevel?: number | string; tier?: string };
      const tierLevelValue =
        typeof data.tierLevel === "number"
          ? data.tierLevel
          : typeof data.tierLevel === "string"
          ? parseInt(data.tierLevel, 10)
          : NaN;
      if (!Number.isNaN(tierLevelValue)) {
        setTierLevel(tierLevelValue);
        return;
      }

      const tierKey = (data.tier || "").toLowerCase();
      if (tierKey === "gold") {
        setTierLevel(30);
      } else if (tierKey === "admin") {
        setTierLevel(99);
      } else if (tierKey === "silver") {
        setTierLevel(20);
      } else {
        setTierLevel(10);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    const auth = getAuthInstance();
    await signOut(auth);
    setOpen(false);
    router.push("/");
  };

  return (
    <>
      <header className="header">
        <div className="header-container">
          <Link href="/" className="logo" onClick={() => setOpen(false)}>
            <div className="logo-icon">I</div>
            <span className="logo-text">IMAO</span>
          </Link>

          <nav className="nav">
            {nav.map((it) => (
              <Link key={it.href} href={it.href} className="nav-link">
                {it.label}
              </Link>
            ))}
          </nav>

          <div className="header-cta">
            {isLoggedIn ? (
              <div className="header-actions">
                <Link href="/mypage" className="btn btn-outline">
                  마이페이지
                </Link>
                <button className="btn btn-primary" type="button" onClick={handleLogout}>
                  로그아웃
                </button>
              </div>
            ) : (
              <Link href="/join" className="btn btn-primary">
                {cta}
              </Link>
            )}
          </div>

          <button
            className="mobile-menu-btn"
            onClick={() => setOpen((v) => !v)}
            aria-label="Open menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div className={`mobile-menu ${open ? "active" : ""}`} aria-hidden={!open}>
        <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Close menu">
          ✕
        </button>
        <nav className="mobile-nav">
          {nav.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="mobile-nav-link"
              onClick={() => setOpen(false)}
            >
              {it.label}
            </Link>
          ))}
        </nav>
        {isLoggedIn ? (
          <>
            <Link
              href="/mypage"
              className="btn btn-outline"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setOpen(false)}
            >
              마이페이지
            </Link>
            <button
              className="btn btn-primary"
              type="button"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={handleLogout}
            >
              로그아웃
            </button>
          </>
        ) : (
          <Link
            href="/join"
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => setOpen(false)}
          >
            {cta}
          </Link>
        )}
      </div>
    </>
  );
}
