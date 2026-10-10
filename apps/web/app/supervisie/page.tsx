import type { Metadata } from "next";
import { CodecoSupervisionApp } from "../codeco-supervision-app";
import { DocumentLanguage } from "../document-language";
import { Providers } from "../providers";

export const metadata: Metadata = {
  title: "Supervisie",
  description: "Secure CODECO workspace for construction supervision, evidence and reporting.",
  robots: { index: false, follow: false, nocache: true },
};

export default function SupervisionPage() {
  return <><DocumentLanguage /><Providers><CodecoSupervisionApp /></Providers></>;
}
