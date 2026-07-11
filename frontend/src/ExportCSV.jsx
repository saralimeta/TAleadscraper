import { NAVY, WHITE, priorityOf } from "./theme.js";

export default function ExportCSV({ leads }) {
  const go = () => {
    const hdr = ["#", "Trade", "Business Name", "City", "Phone", "Website", "Email", "Rating", "Reviews", "Priority", "Contacted", "Follow-Up", "Notes"];
    const rows = leads.map((l, i) => [
      i + 1,
      l.trade,
      `"${l.name.replace(/"/g, '""')}"`,
      l.city,
      l.phone || "",
      l.website || "",
      l.email || "",
      l.rating,
      l.reviews,
      priorityOf(l.reviews),
      "", "", ""
    ]);
    const csv = [hdr, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `TradeAnchor_Leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <button
      onClick={go}
      disabled={leads.length === 0}
      style={{
        padding: "11px 22px", borderRadius: 8, fontSize: 14, fontWeight: 700,
        cursor: leads.length === 0 ? "not-allowed" : "pointer",
        background: leads.length === 0 ? "#A0AEC0" : NAVY, color: WHITE, border: "none", whiteSpace: "nowrap"
      }}
    >
      ⬇ Export {leads.length} leads to CSV
    </button>
  );
}
