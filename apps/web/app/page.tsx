import type { Metadata } from "next";
import { CodecoSupervisionApp } from "./codeco-supervision-app";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Today | CODECO Supervisie",
  description:
    "CODECO workspace for construction supervision, visual evidence, inspections and reporting.",
};

export default function Home() {
  return <Providers><CodecoSupervisionApp /></Providers>;
}
