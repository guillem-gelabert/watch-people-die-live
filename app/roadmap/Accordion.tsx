"use client";

import { useState, type ReactNode } from "react";

export interface AccordionItem {
  id: string;
  title: string;
  // Where the layer stands — "Planned · source to be decided", "Partially available". The
  // status is the point of the section, so it reads before the panel is opened.
  status?: string;
  body: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
}

// The closing section's open problems. Each one is a claim and a status; the reasoning behind
// it is a tap away, so the list reads as a summary first and an argument second.
//
// The open/close travel is a grid row animating between 0fr and 1fr (see .accordion-body), so
// nothing has to be measured: a panel is always exactly as tall as its own copy, at any width,
// without JavaScript reading layout.
export default function Accordion({ items }: AccordionProps) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="accordion">
      {items.map((item) => {
        const isOpen = open === item.id;
        return (
          <div className="accordion-item" key={item.id} data-open={isOpen ? "" : undefined}>
            <button
              type="button"
              className="accordion-head"
              aria-expanded={isOpen}
              aria-controls={`accordion-body-${item.id}`}
              onClick={() => setOpen(isOpen ? null : item.id)}
            >
              <span className="accordion-label">
                <span className="accordion-title">{item.title}</span>
                {item.status && <span className="accordion-status">{item.status}</span>}
              </span>
              <span className="accordion-icon" aria-hidden="true">
                +
              </span>
            </button>
            <div
              className="accordion-body"
              id={`accordion-body-${item.id}`}
              // A closed panel is out of the tab order and out of the accessibility tree; the
              // button above it carries the state.
              inert={!isOpen}
            >
              <div className="accordion-copy">{item.body}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
