"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SignaturePad, type HandwrittenSignature } from "@/app/signature-pad";
import { useLanguage } from "@/lib/i18n";
import { isSigned } from "@/lib/signatures/handwritten-signature.mjs";

/**
 * "Sign, submit & notify" (Excel v5.0, Form Steps): the submit button of a form opens a signing popup
 * when the record is not signed yet. Signing there stores the signature on the form and then submits it;
 * where the signature is optional the popup also offers to submit without one. A signature that is already
 * on the form, or one that is locked on a stored record, goes straight through.
 *
 * `submit` is read from the latest render, so the submit that runs after signing sees the new signature.
 */
export function useSignedSubmit({
  value,
  onChange,
  submit,
  title,
  declaration,
  nameSuggestion = "",
  nameOptions = [],
  lockName = false,
  locked = false,
  required = false,
  enabled = true,
}: {
  value: HandwrittenSignature | null;
  onChange: (signature: HandwrittenSignature | null) => void;
  submit: () => void;
  title: string;
  declaration: string;
  nameSuggestion?: string;
  nameOptions?: string[];
  lockName?: boolean;
  locked?: boolean;
  /** Without a signature the record cannot be submitted: the popup has no "submit without" choice. */
  required?: boolean;
  enabled?: boolean;
}): { request: () => void; dialog: ReactNode; needsSignature: boolean } {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const afterSign = useRef(false);
  const latest = useRef(submit);
  useEffect(() => { latest.current = submit; });
  const signed = isSigned(value);
  const needsSignature = enabled && !signed && !locked;

  useEffect(() => {
    if (afterSign.current && signed) {
      afterSign.current = false;
      latest.current();
    }
  }, [signed]);

  const request = () => {
    if (needsSignature) setOpen(true);
    else submit();
  };

  const dialog = open ? (
    <SignaturePad
      title={title}
      declaration={declaration}
      nameSuggestion={nameSuggestion}
      nameOptions={nameOptions}
      lockName={lockName}
      confirmLabel={text("Sign & submit", "Ondertekenen en indienen")}
      skipLabel={required ? undefined : text("Submit without signature", "Indienen zonder handtekening")}
      onSkip={required ? undefined : () => { setOpen(false); submit(); }}
      close={() => setOpen(false)}
      save={(signature) => {
        afterSign.current = true;
        setOpen(false);
        onChange(signature);
      }}
    />
  ) : null;

  return { request, dialog, needsSignature };
}
