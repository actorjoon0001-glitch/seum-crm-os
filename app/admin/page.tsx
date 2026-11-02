import { redirect } from "next/navigation";

// 계약 고객 페이지는 폐지됨. 예전 링크/포털에서 /admin 으로 들어오면 한눈에 보기(홈)로 보낸다.
export default function AdminIndex() {
  redirect("/");
}
