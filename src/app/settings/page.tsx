import { SettingsClient } from "@/components/settings-client";
import { APP_NAME } from "@/lib/brand";

export const metadata = {
  title: `Cài đặt — ${APP_NAME}`,
};

export default function SettingsPage() {
  return <SettingsClient />;
}
