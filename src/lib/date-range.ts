export type DateRangePreset = "today" | "yesterday" | "last7" | "custom";

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "custom", label: "Custom" },
];

export function iso(d: Date) {
  return d.toISOString().split("T")[0];
}

export function todayISO() {
  return iso(new Date());
}

export function getPresetDates(preset: Exclude<DateRangePreset, "custom">) {
  const today = new Date();
  switch (preset) {
    case "today":
      return { from: iso(today), to: iso(today) };
    case "yesterday": {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      const s = iso(d);
      return { from: s, to: s };
    }
    case "last7": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { from: iso(start), to: iso(today) };
    }
  }
}

export function detectPreset(from: string, to: string): DateRangePreset {
  const today = todayISO();
  if (from === today && to === today) return "today";

  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yestIso = iso(yest);
  if (from === yestIso && to === yestIso) return "yesterday";

  const start7 = new Date();
  start7.setDate(start7.getDate() - 6);
  if (from === iso(start7) && to === today) return "last7";

  return "custom";
}
