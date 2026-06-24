"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { cn } from "@/lib/utils/cn";

const investorTypes = [
  { value: "value", label: "Value" },
  { value: "activist", label: "Activist" },
  { value: "13d activist", label: "13D Activist" },
  { value: "tiger cub", label: "Tiger Cub" }
] as const;

type InvestorType = (typeof investorTypes)[number]["value"];

const definitions = [
  {
    label: "Value",
    text: 'These firms explicitly emphasize "Value" in their investment strategies. Note: This classification was applied judiciously, as many firms market their ability to find "value" opportunities.'
  },
  {
    label: "Activist",
    text: "The firm is either directly described as an activist in its own marketing materials or in third-party articles, or is portrayed as engaging in activist-type activities (such as consulting with management or getting firm members elected to the board)."
  },
  {
    label: "13D Activist",
    text: "While these firms may not explicitly describe activist tactics in their materials or third-party articles, they have filed a 13D form within the last year. This indicates ownership of at least 5% of a publicly traded company, suggesting active participation in corporate activities that may or may not align with management's recommendations."
  },
  {
    label: "Tiger Cub",
    text: "These firms were founded by managers mentored by Julian Robertson of Tiger Management, one of the pioneering hedge funds."
  }
] as const;

function investorLabel(value: InvestorType) {
  return investorTypes.find((type) => type.value === value)?.label ?? "Value";
}

function SummaryTile({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-56 flex-col justify-between rounded-none border border-borderStrong bg-sidebar p-5 shadow-panel md:min-h-64">
      <div>
        <p className="text-sm font-semibold leading-6 text-textPrimary">{title}</p>
        <p className="mt-3 text-sm leading-6 text-textMuted">{description}</p>
      </div>
      <p className="mt-8 border-t border-borderStrong/70 pt-4 text-xs uppercase tracking-[0.2em] text-textMuted">
        Data wiring coming next
      </p>
    </div>
  );
}

function InvestorTypesModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-auto border border-borderStrong bg-panel p-5 shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 id={titleId} className="text-lg font-semibold text-textPrimary">
            Investor Types
          </h3>
          <button
            type="button"
            aria-label="Close investor type definitions"
            className="border border-borderStrong px-2 py-1 text-sm text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
            onClick={onClose}
          >
            X
          </button>
        </div>
        <div className="space-y-4 text-sm leading-6 text-textSecondary">
          {definitions.map((definition) => (
            <p key={definition.label}>
              <span className="font-semibold text-textPrimary">{definition.label}:</span>{" "}
              {definition.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InstitutionalSummary() {
  const [investorType, setInvestorType] = useState<InvestorType>("value");
  const [modalOpen, setModalOpen] = useState(false);
  const label = investorLabel(investorType);
  const cards = useMemo(
    () => [
      {
        title: `Top Holdings by ${label} Investors`,
        description: `A ranked holdings summary for ${label.toLowerCase()} investors will appear here once institutional data wiring is added.`
      },
      {
        title: `Top Positions by ${label} Investors`,
        description: `Position-type filtering is structured for future expansion; value-oriented positions are the safe placeholder for now.`
      },
      {
        title: `Sector Breakdown by ${label} Investors`,
        description: `Sector exposure for ${label.toLowerCase()} investors will appear here when the compatible fixture or provider shape is available.`
      }
    ],
    [label]
  );

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-textPrimary">
            Institutional Summary
          </h2>
          <p className="mt-1 text-xs text-textMuted">
            Investor-type controls update all institutional summary cards together.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <select
            aria-label="Select investor type"
            className="border border-borderStrong bg-sidebar px-3 py-1 text-xs text-textSecondary outline-none hover:border-accentBlue/50 hover:text-textPrimary focus:border-accentBlue"
            value={investorType}
            onChange={(event) => setInvestorType(event.target.value as InvestorType)}
          >
            {investorTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Open investor type definitions"
            className={cn(
              "flex h-7 w-7 items-center justify-center border border-borderStrong bg-sidebar text-xs font-semibold text-textSecondary",
              "hover:border-accentBlue/50 hover:text-textPrimary focus:outline-none focus:ring-1 focus:ring-accentBlue"
            )}
            onClick={() => setModalOpen(true)}
          >
            i
          </button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <SummaryTile key={card.title} title={card.title} description={card.description} />
        ))}
      </div>
      {modalOpen ? <InvestorTypesModal onClose={() => setModalOpen(false)} /> : null}
    </>
  );
}
