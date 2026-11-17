/**
 * AUCTUM Spaces Gallery (/spaces) — Territory & Crew Desks.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { FieldSpacesPanel } from '../components/field/FieldSocialPanels';

export default function FieldSpacesPage() {
  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link
          to="/field"
          className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary underline"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Back to Field Hub
        </Link>
        <Link
          to="/storm-tracking"
          className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] px-3 py-1 text-text-primary hover:bg-[hsl(var(--background-accent))]"
        >
          Command &amp; Storm Map
        </Link>
      </div>
      <FieldSpacesPanel />
    </div>
  );
}
