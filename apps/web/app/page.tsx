import type { Metadata } from "next";
import { CodecoSupervisionApp } from "./codeco-supervision-app";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Vandaag",
  description:
    "CODECO-werkruimte voor constructiesupervisie, inspecties en rapportage.",
};

export default function Home() {
  return <Providers><CodecoSupervisionApp /></Providers>;
}
