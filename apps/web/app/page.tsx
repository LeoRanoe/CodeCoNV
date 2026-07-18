import type { Metadata } from "next";
import { SitezichtApp } from "./sitezicht-app";

export const metadata: Metadata = {
  title: "Vandaag",
  description:
    "Mobiele dagcockpit voor constructiesupervisie, inspecties en rapportage.",
};

export default function Home() {
  return <SitezichtApp />;
}
