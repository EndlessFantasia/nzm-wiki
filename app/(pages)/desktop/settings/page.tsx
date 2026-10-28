import type { Metadata } from "next";
import DesktopSettings from "@/components/DesktopSettings";

export const metadata: Metadata = {
  title: "桌面端设置",
  alternates: { canonical: "/desktop/settings" },
  robots: { index: false, follow: false },
};

export default function DesktopSettingsPage() {
  return <DesktopSettings />;
}
