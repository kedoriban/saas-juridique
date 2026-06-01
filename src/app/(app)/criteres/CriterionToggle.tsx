"use client";

import { useTransition } from "react";
import { toggleCriterion } from "@/app/actions/criteria";

interface Props {
  criterionId: string;
  active: boolean;
}

export default function CriterionToggle({ criterionId, active }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleCriterion(criterionId, active);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      aria-label={active ? "Désactiver ce critère" : "Activer ce critère"}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
        active ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          active ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
