#!/usr/bin/env node
/**
 * 기존 Supabase의 테이블/컬럼 구조를 조회합니다.
 * 네트워크가 Supabase에 접근 가능한 환경(예: 로컬 PC)에서 실행하세요.
 *
 *   node scripts/inspect-db.mjs
 *
 * .env.local 의 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 읽습니다.
 * PostgREST 의 OpenAPI 스펙으로부터 노출된 테이블과 컬럼을 출력합니다.
 */
import { readFileSync } from "node:fs";

function loadEnv() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* .env.local 없으면 실제 환경변수 사용 */
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("❌ .env.local 에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 설정하세요.");
  process.exit(1);
}

const base = url.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");

try {
  const res = await fetch(`${base}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`❌ 응답 ${res.status} ${res.statusText}`);
    console.error(await res.text());
    process.exit(1);
  }
  const spec = await res.json();
  const defs = spec.definitions || spec.components?.schemas || {};
  const tables = Object.keys(defs);

  if (tables.length === 0) {
    console.log("⚠️  노출된 테이블이 없습니다. (RLS/권한 또는 빈 스키마)");
    process.exit(0);
  }

  console.log(`\n✅ ${base} 에서 노출된 테이블 ${tables.length}개:\n`);
  for (const t of tables) {
    const props = defs[t].properties || {};
    console.log(`📋 ${t}`);
    for (const [col, meta] of Object.entries(props)) {
      const type = meta.format || meta.type || "?";
      const pk = (meta.description || "").includes("Primary Key") ? " 🔑" : "";
      console.log(`     - ${col} (${type})${pk}`);
    }
    console.log("");
  }
} catch (e) {
  console.error("❌ 접속 실패:", e.message);
  console.error("   네트워크가 Supabase 도메인 접근을 허용하는 환경에서 실행했는지 확인하세요.");
  process.exit(1);
}
