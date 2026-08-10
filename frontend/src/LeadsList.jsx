import { useState, useMemo } from "react";
import { NAVY, GOLD, priorityOf } from "./theme.js";
import ExportCSV from "./ExportCSV.jsx";

function websiteHref(website) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

function websiteLabel(website) {
  return website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

const STATUS_META = {
  outdated: { label: "Outdated", colors: ["#FFF5F5", "#C53030", "#FEB2B2"] },
  needs_update: { label: "Needs Update", colors: ["#FFFAF0", "#C05621", "#FBD38D"] },
  modern: { label: "Modern", colors: ["#F0FFF4", "#276749", "#9AE6B4"] },
  unreachable: { label: "Unreachable", colors: ["#F7FAFC", "#718096", "#CBD5E0"] },
};

const ANALYZE_CONCURRENCY = 3;

export default function LeadsList({ leads, setLeads }) {
  const [countryF, setCountryF] = useState("All");
  const [countyF, setCountyF] = useState("All");
  const [tradeF, setTradeF] = useState("All");
  const [cityF, setCityF] = useState("All");
  const [statusF, setStatusF] = useState("All");
  const [minR, setMinR] = useState(0);
  const [minRev, setMinRev] = useState(0);
  const [pF, setPF] = useState("All");
  const [sort, setSort] = useState("reviews");
  const [q, setQ] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const COUNTRIES = useMemo(() => [...new Set(leads.map(l => l.country).filter(Boolean))].sort(), [leads]);
  const COUNTIES = useMemo(() => [...new Set(leads.map(l => l.county).filter(Boolean))].sort(), [leads]);
  const TRADES = useMemo(() => [...new Set(leads.map(l => l.trade))].sort(), [leads]);
  const CITIES = useMemo(() => [...new Set(leads.map(l => l.city))].sort(), [leads]);
  const STATUSES = useMemo(() => [...new Set(leads.map(l => l.website_status).filter(Boolean))].sort(), [leads]);

  const unanalyzedCount = useMemo(() => leads.filter(l => l.website && !l.website_status).length, [leads]);

  async function analyzeWebsites() {
    const targets = leads.filter(l => l.website && !l.website_status);
    if (targets.length === 0 || analyzing) return;
    setAnalyzing(true);
    setProgress({ done: 0, total: targets.length });

    let idx = 0;
    const worker = async () => {
      while (idx < targets.length) {
        const lead = targets[idx++];
        try {
          const res = await fetch("/api/check-website", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: lead.id, website: lead.website }),
          });
          if (res.ok) {
            const patch = await res.json();
            setLeads(prev => prev.map(l => l.id === patch.id ? { ...l, ...patch } : l));
          }
        } catch {
          // Network error — lead stays unchecked, user can click Analyze again.
        }
        setProgress(p => ({ ...p, done: p.done + 1 }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(ANALYZE_CONCURRENCY, targets.length) }, worker));
    setAnalyzing(false);
  }

  const filtered = useMemo(() => leads
    .filter(l => countryF === "All" || l.country === countryF)
    .filter(l => countyF === "All" || l.county === countyF)
    .filter(l => tradeF === "All" || l.trade === tradeF)
    .filter(l => cityF === "All" || l.city === cityF)
    .filter(l => statusF === "All" || l.website_status === statusF)
    .filter(l => l.rating >= minR && l.reviews >= minRev)
    .filter(l => pF === "All" || priorityOf(l.reviews) === pF)
    .filter(l => !q || l.name.toLowerCase().includes(q.toLowerCase()) || l.city.toLowerCase().includes(q.toLowerCase()) || l.trade.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "reviews" ? b.reviews - a.reviews : sort === "rating" ? b.rating - a.rating : sort === "name" ? a.name.localeCompare(b.name) : a.trade.localeCompare(b.trade)),
    [leads, countryF, countyF, tradeF, cityF, statusF, minR, minRev, pF, sort, q]
  );

  const tradeCounts = useMemo(() => {
    const c = {};
    filtered.forEach(l => { c[l.trade] = (c[l.trade] || 0) + 1; });
    return c;
  }, [filtered]);

  const sel = { padding: "8px 10px", border: "1.5px solid #CBD5E0", borderRadius: 7, fontSize: 13, background: "#fff", color: "#15233A", width: "100%" };

  return (
    <div>
      {/* Metric strip */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <div style={{ background: NAVY, color: "#fff", padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{leads.length} total</div>
        <div style={{ background: GOLD, color: NAVY, padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{filtered.length} showing</div>
      </div>

      {/* Filters */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "16px", marginBottom: 12 }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search name, city, or trade..."
          style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #CBD5E0", borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
        />

        {/* Country chips */}
        {COUNTRIES.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#4A5568", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Filter by Country <span style={{ color: GOLD }}>({countryF === "All" ? "ALL" : countryF})</span>
              </span>
              {countryF !== "All" && <button onClick={() => setCountryF("All")} style={{ fontSize: 11, color: GOLD, background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>Show All</button>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COUNTRIES.map(c => {
                const cnt = leads.filter(l => l.country === c).length;
                return (
                  <button
                    key={c}
                    onClick={() => setCountryF(countryF === c ? "All" : c)}
                    style={{
                      padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                      background: countryF === c ? GOLD : "#fff", color: countryF === c ? NAVY : "#4A5568",
                      border: `1.5px solid ${countryF === c ? GOLD : "#CBD5E0"}`
                    }}
                  >
                    {c} <span style={{ opacity: 0.65, fontSize: 10 }}>({cnt})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* County chips */}
        {COUNTIES.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#4A5568", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Filter by County <span style={{ color: GOLD }}>({countyF === "All" ? "ALL" : countyF})</span>
              </span>
              {countyF !== "All" && <button onClick={() => setCountyF("All")} style={{ fontSize: 11, color: GOLD, background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>Show All</button>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COUNTIES.map(c => {
                const cnt = leads.filter(l => l.county === c).length;
                return (
                  <button
                    key={c}
                    onClick={() => setCountyF(countyF === c ? "All" : c)}
                    style={{
                      padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                      background: countyF === c ? NAVY : "#fff", color: countyF === c ? "#fff" : "#4A5568",
                      border: `1.5px solid ${countyF === c ? NAVY : "#CBD5E0"}`
                    }}
                  >
                    {c} <span style={{ opacity: 0.65, fontSize: 10 }}>({cnt})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Trade chips */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4A5568", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Filter by Trade <span style={{ color: GOLD }}>({tradeF === "All" ? "ALL" : tradeF})</span>
            </span>
            {tradeF !== "All" && <button onClick={() => setTradeF("All")} style={{ fontSize: 11, color: GOLD, background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>Show All</button>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TRADES.map(t => {
              const cnt = leads.filter(l => l.trade === t).length;
              return (
                <button
                  key={t}
                  onClick={() => setTradeF(tradeF === t ? "All" : t)}
                  style={{
                    padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                    background: tradeF === t ? GOLD : "#fff", color: tradeF === t ? NAVY : "#4A5568",
                    border: `1.5px solid ${tradeF === t ? GOLD : "#CBD5E0"}`
                  }}
                >
                  {t} <span style={{ opacity: 0.65, fontSize: 10 }}>({cnt})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* City chips */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4A5568", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Filter by City <span style={{ color: GOLD }}>({cityF === "All" ? "ALL" : cityF})</span>
            </span>
            {cityF !== "All" && <button onClick={() => setCityF("All")} style={{ fontSize: 11, color: GOLD, background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>Show All</button>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CITIES.map(c => (
              <button
                key={c}
                onClick={() => setCityF(cityF === c ? "All" : c)}
                style={{
                  padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                  background: cityF === c ? NAVY : "#fff", color: cityF === c ? "#fff" : "#4A5568",
                  border: `1.5px solid ${cityF === c ? NAVY : "#CBD5E0"}`
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Website Status chips */}
        {STATUSES.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#4A5568", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Filter by Website Status <span style={{ color: GOLD }}>({statusF === "All" ? "ALL" : STATUS_META[statusF]?.label || statusF})</span>
              </span>
              {statusF !== "All" && <button onClick={() => setStatusF("All")} style={{ fontSize: 11, color: GOLD, background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>Show All</button>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {STATUSES.map(s => {
                const cnt = leads.filter(l => l.website_status === s).length;
                const meta = STATUS_META[s] || { label: s, colors: ["#fff", "#4A5568", "#CBD5E0"] };
                return (
                  <button
                    key={s}
                    onClick={() => setStatusF(statusF === s ? "All" : s)}
                    style={{
                      padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                      background: statusF === s ? meta.colors[1] : meta.colors[0], color: statusF === s ? "#fff" : meta.colors[1],
                      border: `1.5px solid ${meta.colors[2]}`
                    }}
                  >
                    {meta.label} <span style={{ opacity: 0.65, fontSize: 10 }}>({cnt})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dropdowns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#4A5568", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Min Rating</label>
            <select style={sel} value={minR} onChange={e => setMinR(parseFloat(e.target.value))}>
              <option value={0}>Any</option><option value={4.0}>4.0+</option><option value={4.5}>4.5+</option><option value={4.8}>4.8+</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#4A5568", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Min Reviews</label>
            <select style={sel} value={minRev} onChange={e => setMinRev(parseInt(e.target.value))}>
              <option value={0}>Any</option><option value={10}>10+</option><option value={25}>25+</option><option value={50}>50+</option><option value={100}>100+</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#4A5568", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Priority</label>
            <select style={sel} value={pF} onChange={e => setPF(e.target.value)}>
              <option>All</option><option value="HIGH">HIGH 100+</option><option value="MED">MED 20-99</option><option value="LOW">LOW &lt;20</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#4A5568", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Sort</label>
            <select style={sel} value={sort} onChange={e => setSort(e.target.value)}>
              <option value="reviews">Reviews ↓</option><option value="rating">Rating ↓</option><option value="name">Name A-Z</option><option value="trade">Trade</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <ExportCSV leads={filtered} />
          <button
            onClick={analyzeWebsites}
            disabled={analyzing || unanalyzedCount === 0}
            style={{
              padding: "11px 22px", borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: analyzing || unanalyzedCount === 0 ? "not-allowed" : "pointer",
              background: analyzing || unanalyzedCount === 0 ? "#A0AEC0" : GOLD, color: NAVY, border: "none", whiteSpace: "nowrap"
            }}
          >
            {analyzing
              ? `Checking ${progress.done} / ${progress.total}…`
              : unanalyzedCount === 0
                ? "All websites analyzed"
                : `🔍 Analyze ${unanalyzedCount} website${unanalyzedCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {/* Trade summary pills */}
      {Object.keys(tradeCounts).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {Object.entries(tradeCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
            <div
              key={t}
              onClick={() => setTradeF(tradeF === t ? "All" : t)}
              style={{ padding: "4px 12px", background: NAVY, color: "#fff", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {t} <span style={{ color: GOLD }}>{n}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: NAVY }}>
                {["#", "Trade", "Business Name", "Country", "County", "City", "Phone", "Website", "Email", "Rating", "Reviews", "Priority"].map(h => (
                  <th key={h} style={{ padding: "9px 11px", color: "#fff", fontWeight: 700, textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} style={{ padding: "28px", textAlign: "center", color: "#A0AEC0" }}>
                  {leads.length === 0 ? "No leads yet — run a scrape on the Scraper Dashboard tab" : "No leads match — adjust filters above"}
                </td></tr>
              ) : filtered.map((l, i) => {
                const p = priorityOf(l.reviews);
                const pc = p === "HIGH" ? ["#FFFBEB", "#92400E", "#FDE68A"] : p === "MED" ? ["#EBF8FF", "#2C5282", "#90CDF4"] : ["#F7FAFC", "#718096", "#CBD5E0"];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #EDF2F7", background: i % 2 === 0 ? "#fff" : "#FAFAF9" }}>
                    <td style={{ padding: "7px 11px", color: "#718096", fontSize: 11 }}>{i + 1}</td>
                    <td style={{ padding: "7px 11px", color: "#4A5568", whiteSpace: "nowrap" }}>{l.trade}</td>
                    <td style={{ padding: "7px 11px", fontWeight: 600, color: NAVY, minWidth: 180 }}>{l.name}</td>
                    <td style={{ padding: "7px 11px", color: "#4A5568", whiteSpace: "nowrap" }}>{l.country || <span style={{ color: "#CBD5E0" }}>—</span>}</td>
                    <td style={{ padding: "7px 11px", color: "#4A5568", whiteSpace: "nowrap" }}>{l.county || <span style={{ color: "#CBD5E0" }}>—</span>}</td>
                    <td style={{ padding: "7px 11px", color: "#4A5568", whiteSpace: "nowrap" }}>{l.city}</td>
                    <td style={{ padding: "7px 11px", whiteSpace: "nowrap" }}>
                      {l.phone ? <a href={`tel:${l.phone}`} style={{ color: GOLD, fontWeight: 600, textDecoration: "none" }}>{l.phone}</a> : <span style={{ color: "#CBD5E0" }}>—</span>}
                    </td>
                    <td style={{ padding: "7px 11px", whiteSpace: "nowrap" }}>
                      {l.website ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <a href={websiteHref(l.website)} target="_blank" rel="noreferrer" style={{ color: "#3182CE", textDecoration: "none", fontSize: 11 }}>{websiteLabel(l.website)}</a>
                          {l.website_status && (
                            <span
                              title={(l.website_signals || []).join(", ")}
                              style={{
                                padding: "2px 6px", borderRadius: 10, fontSize: 9, fontWeight: 700,
                                background: STATUS_META[l.website_status]?.colors[0], color: STATUS_META[l.website_status]?.colors[1],
                                border: `1px solid ${STATUS_META[l.website_status]?.colors[2]}`
                              }}
                            >
                              {STATUS_META[l.website_status]?.label || l.website_status}
                            </span>
                          )}
                        </div>
                      ) : <span style={{ color: "#CBD5E0" }}>—</span>}
                    </td>
                    <td style={{ padding: "7px 11px", whiteSpace: "nowrap" }}>
                      {l.email ? <a href={`mailto:${l.email}`} style={{ color: "#38A169", textDecoration: "none", fontSize: 11 }}>{l.email}</a> : <span style={{ color: "#CBD5E0" }}>—</span>}
                    </td>
                    <td style={{ padding: "7px 11px", textAlign: "center", fontWeight: 700, color: l.rating >= 4.8 ? "#276749" : l.rating >= 4 ? NAVY : "#C53030" }}>{l.rating || "—"}</td>
                    <td style={{ padding: "7px 11px", textAlign: "center", color: "#4A5568" }}>{(l.reviews || 0).toLocaleString()}</td>
                    <td style={{ padding: "7px 11px" }}>
                      <span style={{ padding: "3px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: pc[0], color: pc[1], border: `1px solid ${pc[2]}` }}>{p}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
