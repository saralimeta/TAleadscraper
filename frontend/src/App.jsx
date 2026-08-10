import { useState, useEffect } from "react";
import { NAVY, GOLD, WHITE } from "./theme.js";
import ScraperDashboard from "./ScraperDashboard.jsx";
import LeadsList from "./LeadsList.jsx";

const TABS = [
  { key: "dashboard", label: "Scraper Dashboard" },
  { key: "leads", label: "Leads List" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [leads, setLeads] = useState([]);
  const [scraped, setScraped] = useState(false);

  // Load previously-scraped leads from Supabase on first load, so the
  // Leads List tab has data even before a new scrape is run.
  useEffect(() => {
    fetch("/api/leads")
      .then((res) => (res.ok ? res.json() : { leads: [] }))
      .then((data) => {
        if (Array.isArray(data.leads) && data.leads.length > 0) {
          setLeads(data.leads);
          setScraped(true);
        }
      })
      .catch((err) => console.error("Failed to load saved leads:", err));
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif", background: "#F7F6F2", minHeight: "100vh", color: NAVY }}>

      {/* Header */}
      <div style={{ background: NAVY, padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
        <div>
          <div style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 2 }}>TRADEANCHOR.AI</div>
          <div style={{ color: WHITE, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Lead Scraper</div>
        </div>
        <div style={{ color: "#8899AA", fontSize: 12 }}>Run It. Grow It. Own It.</div>
      </div>

      {/* Tab bar */}
      <div style={{ background: WHITE, borderBottom: "1px solid #E2E8F0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", gap: 4 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "14px 18px",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.02em",
                background: "none",
                border: "none",
                borderBottom: `2.5px solid ${tab === t.key ? GOLD : "transparent"}`,
                color: tab === t.key ? NAVY : "#94A3B8",
                cursor: "pointer",
              }}
            >
              {t.label}
              {t.key === "leads" && leads.length > 0 && (
                <span style={{ marginLeft: 6, color: GOLD }}>({leads.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        {tab === "dashboard" ? (
          <ScraperDashboard leads={leads} setLeads={setLeads} scraped={scraped} setScraped={setScraped} />
        ) : (
          <LeadsList leads={leads} setLeads={setLeads} />
        )}
      </div>
    </div>
  );
}
