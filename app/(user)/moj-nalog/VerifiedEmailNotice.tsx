"use client";

import { useEffect } from "react";
import { CheckCircle } from "lucide-react";

interface VerifiedEmailNoticeProps {
  show: boolean;
}

export function VerifiedEmailNotice({ show }: VerifiedEmailNoticeProps) {
  useEffect(() => {
    if (!show) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("verified");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-success/20 bg-success-light p-4 text-success"
      role="status"
    >
      <CheckCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">Email je uspešno potvrđen.</p>
        <p className="mt-1 text-sm">
          Vaš nalog je aktivan i bezbedno ste prijavljeni.
        </p>
      </div>
    </div>
  );
}
