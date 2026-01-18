"use client";

import { useEffect, useState } from "react";
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getDb } from "@/lib/firebaseClient";
import { getStorage } from "firebase/storage";

type GalleryItem = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  createdAt?: string;
};

export default function NewsGalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadItems = async () => {
    const snap = await getDocs(query(collection(getDb(), "gallery"), orderBy("createdAt", "desc")));
    const list: GalleryItem[] = snap.docs.map((docSnap) => {
      const data = docSnap.data() as {
        title?: string;
        description?: string;
        imageUrl?: string;
        createdAt?: { toDate?: () => Date };
      };
      return {
        id: docSnap.id,
        title: data.title || "갤러리",
        description: data.description || "",
        imageUrl: data.imageUrl || "",
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : undefined,
      };
    });
    setItems(list);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title || !file) {
      setMessage("제목과 사진을 입력해주세요.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const storage = getStorage();
      const path = `gallery/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const imageUrl = await getDownloadURL(fileRef);

      await addDoc(collection(getDb(), "gallery"), {
        title,
        description,
        imageUrl,
        createdAt: serverTimestamp(),
      });

      setTitle("");
      setDescription("");
      setFile(null);
      await loadItems();
      setShowUpload(false);
      setMessage("사진이 등록되었습니다.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "업로드에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">NEWS & QnA</div>
          <h1 className="section-title">클럽 갤러리</h1>
          <p className="section-description">클럽 활동 사진과 현장 스케치를 공유해 주세요.</p>
        </div>

        <div className="gallery-grid">
          {items.map((item) => (
            <div key={item.id} className="gallery-card">
              <div className="gallery-image" style={{ backgroundImage: `url(${item.imageUrl})` }} />
              <div className="gallery-body">
                <h3 className="gallery-title">{item.title}</h3>
                {item.description && <p className="gallery-desc">{item.description}</p>}
                {item.createdAt && <p className="gallery-date">{item.createdAt}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="gallery-fab" type="button" onClick={() => setShowUpload(true)}>
        사진 올리기
      </button>

      {showUpload && (
        <div className="gallery-modal">
          <div className="gallery-modal-card">
            <div className="gallery-modal-head">
              <h2 className="feature-title">새 사진 등록</h2>
              <button className="gallery-close" type="button" onClick={() => setShowUpload(false)}>
                ✕
              </button>
            </div>
            <form className="gallery-form" onSubmit={handleSubmit}>
              <input
                className="auth-input"
                placeholder="제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <textarea
                className="auth-input"
                placeholder="설명(선택)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <input
                className="auth-input"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              <div className="gallery-modal-actions">
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  사진 등록
                </button>
                <button className="btn btn-outline" type="button" onClick={() => setShowUpload(false)}>
                  닫기
                </button>
              </div>
              {message && <p className="auth-success">{message}</p>}
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
