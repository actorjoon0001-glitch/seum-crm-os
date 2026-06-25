"use client";

import { useEffect, useState } from "react";
import type { ContractDrawing } from "@/lib/types";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif|svg)$/i;
const PDF_EXT = /\.pdf$/i;

type Kind = "image" | "pdf" | "other";

function fileType(d: ContractDrawing): Kind {
  const t = d.file_name || d.url || d.path || "";
  if (IMAGE_EXT.test(t)) return "image";
  if (PDF_EXT.test(t)) return "pdf";
  return "other";
}

function ext(d: ContractDrawing): string {
  const t = d.file_name || d.url || d.path || "";
  const m = t.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
  return m ? m[1].toUpperCase() : "파일";
}

export default function DrawingGallery({
  drawings,
}: {
  drawings: ContractDrawing[];
}) {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight")
        setActive((i) => (i === null ? null : Math.min(i + 1, drawings.length - 1)));
      if (e.key === "ArrowLeft")
        setActive((i) => (i === null ? null : Math.max(i - 1, 0)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, drawings.length]);

  if (drawings.length === 0) {
    return <p className="text-sm text-gray-400">첨부된 계약서 파일이 없습니다.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {drawings.map((d, i) => (
          <Thumbnail key={d.id} drawing={d} onOpen={() => setActive(i)} />
        ))}
      </div>

      {active !== null && (
        <Lightbox
          drawing={drawings[active]}
          index={active}
          total={drawings.length}
          onClose={() => setActive(null)}
          onPrev={() => setActive((i) => (i === null ? null : Math.max(i - 1, 0)))}
          onNext={() =>
            setActive((i) =>
              i === null ? null : Math.min(i + 1, drawings.length - 1)
            )
          }
        />
      )}
    </>
  );
}

function Thumbnail({
  drawing: d,
  onOpen,
}: {
  drawing: ContractDrawing;
  onOpen: () => void;
}) {
  const type = fileType(d);
  const label = d.file_name || d.kind || "첨부파일";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:border-seum hover:shadow-md"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gray-50">
        {type === "image" && d.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.url}
            alt={label}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : type === "pdf" && d.url ? (
          <>
            <iframe
              src={`${d.url}#toolbar=0&navpanes=0&view=FitH`}
              title={label}
              className="pointer-events-none h-full w-full"
              loading="lazy"
            />
            <span className="absolute bottom-1 right-1 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
              PDF
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center text-gray-400">
            <span className="text-3xl">📐</span>
            <span className="mt-1 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
              {ext(d)}
            </span>
            <span className="mt-1 text-xs">크게 보기</span>
          </div>
        )}
        <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/5" />
      </div>
      <div className="truncate px-3 py-2 text-xs text-gray-600" title={label}>
        {d.kind && (
          <span className="mr-1 rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-500">
            {d.kind}
          </span>
        )}
        {label}
      </div>
    </button>
  );
}

function Lightbox({
  drawing: d,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  drawing: ContractDrawing;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const type = fileType(d);
  const label = d.file_name || d.kind || "첨부파일";
  const href = d.url || d.path || "#";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 상단 바 */}
      <div
        className="flex items-center justify-between text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="truncate text-sm">
          <span className="mr-2 rounded bg-white/20 px-2 py-0.5 text-xs">
            {index + 1} / {total}
          </span>
          {label}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
          >
            새 탭에서 열기 ↗
          </a>
          <button
            onClick={onClose}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
          >
            닫기 ✕
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div
        className="relative mt-3 flex flex-1 items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {index > 0 && (
          <button
            onClick={onPrev}
            className="absolute left-2 z-10 rounded-full bg-white/15 p-3 text-white hover:bg-white/25"
            aria-label="이전"
          >
            ←
          </button>
        )}

        {type === "image" && d.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.url}
            alt={label}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : type === "pdf" && d.url ? (
          <iframe
            src={d.url}
            title={label}
            className="h-full w-full max-w-4xl rounded-lg bg-white"
          />
        ) : (
          <div className="rounded-2xl bg-white p-10 text-center">
            <div className="text-4xl">📐</div>
            <p className="mt-3 font-semibold text-gray-800">
              {ext(d)} 파일은 미리보기를 지원하지 않습니다
            </p>
            <p className="mt-1 text-sm text-gray-500">
              도면(CAD) 등은 아래 버튼으로 내려받아 전용 프로그램에서 여세요.
            </p>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-lg bg-seum px-5 py-2 text-sm font-semibold text-white"
            >
              파일 열기 / 다운로드
            </a>
          </div>
        )}

        {index < total - 1 && (
          <button
            onClick={onNext}
            className="absolute right-2 z-10 rounded-full bg-white/15 p-3 text-white hover:bg-white/25"
            aria-label="다음"
          >
            →
          </button>
        )}
      </div>
    </div>
  );
}
