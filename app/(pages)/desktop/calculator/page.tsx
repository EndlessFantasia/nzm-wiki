import type { Metadata } from "next";
import DesktopCalculator from "@/components/DesktopCalculator";

export const metadata: Metadata = {
  title: "计算器",
  alternates: { canonical: "/desktop/calculator" },
  robots: { index: false, follow: false },
};

export default function DesktopCalculatorPage() {
  return <DesktopCalculator />;
}
