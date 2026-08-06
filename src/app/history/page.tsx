import { HistoryClient } from "@/components/history-client";
import { APP_NAME } from "@/lib/brand";

export const metadata = {
  title: `Thư viện — ${APP_NAME}`,
};

export default function HistoryPage() {
  return <HistoryClient />;
}
