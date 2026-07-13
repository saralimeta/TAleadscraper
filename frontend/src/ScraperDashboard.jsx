import { useState, useCallback, useRef } from "react";
import { NAVY, GOLD, GOLD_LIGHT, SLATE, WHITE, SUCCESS, SUCCESS_BG, priorityOf } from "./theme.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const TRADES = [
  "Plumber",
  "Electrician",
  "HVAC",
  "Drywall Contractor",
  "General Contractor",
  "Roofer",
  "Painter",
  "Landscaper",
  "Concrete Contractor",
  "Flooring Contractor",
  "Tile Contractor",
  "Fence Contractor",
  "Handyman",
  "Pool Contractor",
  "Solar Installer",
];

const CA_CITIES = {
  "Contra Costa County": [
    "Antioch", "Brentwood", "Clayton", "Concord", "Danville",
    "El Cerrito", "Hercules", "Lafayette", "Martinez", "Moraga",
    "Oakley", "Orinda", "Pinole", "Pittsburg", "Pleasant Hill",
    "Richmond", "San Pablo", "San Ramon", "Walnut Creek"
  ],
  "Alameda County": [
    "Alameda", "Albany", "Berkeley", "Castro Valley", "Dublin",
    "Emeryville", "Fremont", "Hayward", "Livermore", "Newark",
    "Oakland", "Pleasanton", "San Leandro", "Union City"
  ],
  "San Francisco County": ["San Francisco"],
  "San Mateo County": [
    "Belmont", "Burlingame", "Daly City", "Foster City", "Menlo Park",
    "Millbrae", "Pacifica", "Redwood City", "San Bruno", "San Mateo", "South San Francisco"
  ],
  "Santa Clara County": [
    "Campbell", "Cupertino", "Gilroy", "Los Altos", "Milpitas",
    "Mountain View", "Palo Alto", "San Jose", "Santa Clara", "Saratoga", "Sunnyvale"
  ],
  "Marin County": [
    "Corte Madera", "Fairfax", "Mill Valley", "Novato", "San Rafael", "Tiburon"
  ],
  "Sonoma County": [
    "Cotati", "Healdsburg", "Petaluma", "Rohnert Park", "Santa Rosa", "Sebastopol", "Windsor"
  ],
  "Sacramento County": [
    "Citrus Heights", "Elk Grove", "Folsom", "Rancho Cordova", "Roseville", "Sacramento"
  ],
  "Los Angeles County": [
    "Alhambra", "Burbank", "Compton", "Downey", "El Monte", "Glendale",
    "Inglewood", "Long Beach", "Los Angeles", "Pasadena", "Pomona",
    "Santa Monica", "Torrance", "West Covina"
  ],
  "Orange County": [
    "Anaheim", "Costa Mesa", "Fullerton", "Huntington Beach", "Irvine",
    "Mission Viejo", "Newport Beach", "Orange", "Santa Ana"
  ],
};

function downloadCSV(leads) {
  const headers = ["#", "Trade", "Business Name", "Address", "City", "Phone", "Rating", "Reviews", "Priority", "Website", "Hours", "Contacted", "Follow-Up Date", "Notes"];
  const rows = leads.map((l, i) => [
    i + 1,
    l.trade,
    `"${l.name.replace(/"/g, '""')}"`,
    `"${l.address.replace(/"/g, '""')}"`,
    l.city,
    l.phone || "",
    l.rating,
    l.reviews,
    priorityOf(l.reviews),
    l.website || "",
    `"${(l.hours || []).join("; ").replace(/"/g, '""')}"`,
    "", "", ""
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `TradeAnchor_Leads_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ScraperDashboard({ leads, setLeads, scraped, setScraped }) {
  const [county, setCounty] = useState("Contra Costa County");
  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedTrades, setSelectedTrades] = useState([]);
  const [minRating, setMinRating] = useState(0);
  const [minReviews, setMinReviews] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("reviews");
  const [filterPriority, setFilterPriority] = useState("all");
  const stopRef = useRef(false);

  const cities = CA_CITIES[county] || [];

  const toggleCity = (city) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  const toggleTrade = (trade) => {
    setSelectedTrades(prev =>
      prev.includes(trade) ? prev.filter(t => t !== trade) : [...prev, trade]
    );
  };

  const selectAllCities = () => setSelectedCities([...cities]);
  const clearCities = () => setSelectedCities([]);
  const selectAllTrades = () => setSelectedTrades([...TRADES]);
  const clearTrades = () => setSelectedTrades([]);

  const scrape = useCallback(async () => {
    if (!selectedCities.length || !selectedTrades.length) {
      setError("Select at least one city and one trade.");
      return;
    }
    setError("");
    setLeads([]);
    setScraped(false);
    setLoading(true);
    stopRef.current = false;

    const queries = [];
    for (const trade of selectedTrades) {
      for (const city of selectedCities) {
        queries.push({ trade, city });
      }
    }

    setProgress({ done: 0, total: queries.length, current: "" });

    const seen = new Set();
    const allLeads = [];

    for (const { trade, city } of queries) {
      if (stopRef.current) break;
      setProgress(p => ({ ...p, current: `${trade} in ${city}...` }));

      try {
        const response = await fetch(`${API_BASE_URL}/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trade, city }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `Request failed (${response.status})`);
        }

        const data = await response.json();
        const businesses = Array.isArray(data.businesses) ? data.businesses : [];

        for (const b of businesses) {
          if (!b.name || seen.has(`${b.name}-${b.city}`)) continue;
          seen.add(`${b.name}-${b.city}`);
          allLeads.push({
            trade,
            name: b.name || "",
            address: b.address || "",
            city: b.city || city,
            phone: b.phone || null,
            rating: parseFloat(b.rating) || 0,
            reviews: parseInt(b.reviews) || 0,
            website: b.website || null,
            hours: Array.isArray(b.hours) ? b.hours : [],
          });
        }

        setLeads([...allLeads]);
        setProgress(p => ({ ...p, done: p.done + 1 }));

        // Small delay to avoid hammering the API
        await new Promise(r => setTimeout(r, 300));

      } catch (err) {
        console.error("Query failed:", trade, city, err);
        setProgress(p => ({ ...p, done: p.done + 1 }));
      }
    }

    setLoading(false);
    setScraped(true);
    stopRef.current = false;
  }, [selectedCities, selectedTrades, setLeads, setScraped]);

  const stopScrape = () => {
    stopRef.current = true;
  };

  const filtered = leads
    .filter(l => l.rating >= minRating && l.reviews >= minReviews)
    .filter(l => {
      if (filterPriority === "high") return l.reviews >= 100;
      if (filterPriority === "med") return l.reviews >= 20 && l.reviews < 100;
      if (filterPriority === "low") return l.reviews < 20;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "reviews") return b.reviews - a.reviews;
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "trade") return a.trade.localeCompare(b.trade);
      return 0;
    });

  const tradeCounts = {};
  filtered.forEach(l => {
    tradeCounts[l.trade] = (tradeCounts[l.trade] || 0) + 1;
  });

  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div>
      {/* Config Panel */}
      <div style={{ background: WHITE, borderRadius: 12, border: `1px solid #E2E8F0`, padding: "24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

        {/* County */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: SLATE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>County</label>
          <select
            value={county}
            onChange={e => { setCounty(e.target.value); setSelectedCities([]); }}
            style={{ width: "100%", padding: "10px 14px", border: `1.5px solid #CBD5E0`, borderRadius: 8, fontSize: 14, background: WHITE, color: NAVY, cursor: "pointer" }}
          >
            {Object.keys(CA_CITIES).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Cities */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: SLATE, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Cities <span style={{ color: GOLD }}>({selectedCities.length} selected)</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={selectAllCities} style={{ fontSize: 11, color: GOLD, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "2px 0" }}>All</button>
              <span style={{ color: "#CBD5E0" }}>|</span>
              <button onClick={clearCities} style={{ fontSize: 11, color: SLATE, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "2px 0" }}>Clear</button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {cities.map(city => (
              <button
                key={city}
                onClick={() => toggleCity(city)}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                  background: selectedCities.includes(city) ? NAVY : WHITE,
                  color: selectedCities.includes(city) ? WHITE : SLATE,
                  border: `1.5px solid ${selectedCities.includes(city) ? NAVY : "#CBD5E0"}`,
                }}
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        {/* Trades */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: SLATE, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Trades <span style={{ color: GOLD }}>({selectedTrades.length} selected)</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={selectAllTrades} style={{ fontSize: 11, color: GOLD, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>All</button>
              <span style={{ color: "#CBD5E0" }}>|</span>
              <button onClick={clearTrades} style={{ fontSize: 11, color: SLATE, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear</button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TRADES.map(trade => (
              <button
                key={trade}
                onClick={() => toggleTrade(trade)}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                  background: selectedTrades.includes(trade) ? GOLD : WHITE,
                  color: selectedTrades.includes(trade) ? NAVY : SLATE,
                  border: `1.5px solid ${selectedTrades.includes(trade) ? GOLD : "#CBD5E0"}`,
                }}
              >
                {trade}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Row */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: SLATE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Min Rating</label>
            <select value={minRating} onChange={e => setMinRating(parseFloat(e.target.value))}
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #CBD5E0", borderRadius: 8, fontSize: 13, background: WHITE, color: NAVY }}>
              <option value={0}>Any</option>
              <option value={4.0}>4.0+</option>
              <option value={4.5}>4.5+</option>
              <option value={4.8}>4.8+</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: SLATE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Min Reviews</label>
            <select value={minReviews} onChange={e => setMinReviews(parseInt(e.target.value))}
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #CBD5E0", borderRadius: 8, fontSize: 13, background: WHITE, color: NAVY }}>
              <option value={0}>Any</option>
              <option value={10}>10+</option>
              <option value={25}>25+</option>
              <option value={50}>50+</option>
              <option value={100}>100+</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: SLATE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Priority</label>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #CBD5E0", borderRadius: 8, fontSize: 13, background: WHITE, color: NAVY }}>
              <option value="all">All</option>
              <option value="high">HIGH (100+ reviews)</option>
              <option value="med">MED (20–99 reviews)</option>
              <option value="low">LOW (under 20)</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: SLATE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Sort By</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #CBD5E0", borderRadius: 8, fontSize: 13, background: WHITE, color: NAVY }}>
              <option value="reviews">Reviews (high → low)</option>
              <option value="rating">Rating (high → low)</option>
              <option value="name">Name (A → Z)</option>
              <option value="trade">Trade</option>
            </select>
          </div>
        </div>

        {/* Query count warning */}
        {selectedCities.length > 0 && selectedTrades.length > 0 && (
          <div style={{ padding: "10px 14px", background: GOLD_LIGHT, borderRadius: 8, fontSize: 13, color: NAVY, marginBottom: 16, border: `1px solid ${GOLD}` }}>
            <strong>{selectedCities.length * selectedTrades.length} queries</strong> → est. <strong>{selectedCities.length * selectedTrades.length * 8}–{selectedCities.length * selectedTrades.length * 10} leads</strong> · ~{Math.ceil(selectedCities.length * selectedTrades.length * 0.4)} min to complete
          </div>
        )}

        {error && (
          <div style={{ padding: "10px 14px", background: "#FFF5F5", borderRadius: 8, fontSize: 13, color: "#C53030", marginBottom: 16, border: "1px solid #FEB2B2" }}>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={scrape}
            disabled={loading}
            style={{
              padding: "12px 28px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "#A0AEC0" : GOLD, color: NAVY, border: "none",
              boxShadow: loading ? "none" : "0 2px 8px rgba(201,162,39,0.35)", transition: "all 0.15s",
              letterSpacing: "0.02em"
            }}
          >
            {loading ? `Scraping... ${progressPct}%` : "🔍 Run Scrape"}
          </button>

          {loading && (
            <button
              onClick={stopScrape}
              style={{ padding: "12px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", background: WHITE, color: "#C53030", border: "1.5px solid #FEB2B2" }}
            >
              ⏹ Stop
            </button>
          )}

          {leads.length > 0 && (
            <button
              onClick={() => downloadCSV(filtered)}
              style={{ padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", background: NAVY, color: WHITE, border: "none", boxShadow: "0 2px 8px rgba(21,35,58,0.25)" }}
            >
              ⬇ Export CSV ({filtered.length} leads)
            </button>
          )}

          {leads.length > 0 && (
            <button
              onClick={() => { setLeads([]); setScraped(false); }}
              style={{ padding: "12px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", background: WHITE, color: SLATE, border: "1.5px solid #CBD5E0" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {loading && (
        <div style={{ background: WHITE, borderRadius: 12, padding: "16px 20px", marginBottom: 20, border: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{progress.current}</span>
            <span style={{ fontSize: 13, color: SLATE }}>{progress.done} / {progress.total} queries</span>
          </div>
          <div style={{ background: "#EDF2F7", borderRadius: 99, height: 8, overflow: "hidden" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: `linear-gradient(90deg, ${GOLD}, #E8B800)`, borderRadius: 99, transition: "width 0.3s ease" }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: SLATE }}>{leads.length} leads captured so far</div>
        </div>
      )}

      {/* Success Banner */}
      {scraped && !loading && leads.length > 0 && (
        <div style={{ background: SUCCESS_BG, border: `1px solid #9AE6B4`, borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: SUCCESS, fontWeight: 700, fontSize: 14 }}>
            ✓ Scrape complete — {leads.length} leads found across {Object.keys(tradeCounts).length} trades
          </span>
          <button onClick={() => downloadCSV(filtered)} style={{ padding: "8px 18px", borderRadius: 8, background: SUCCESS, color: WHITE, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Export CSV
          </button>
        </div>
      )}

      {/* Trade Summary Pills */}
      {leads.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {Object.entries(tradeCounts).sort((a, b) => b[1] - a[1]).map(([trade, count]) => (
            <div key={trade} style={{ padding: "5px 14px", background: NAVY, color: WHITE, borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              {trade} <span style={{ color: GOLD }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Results Table */}
      {filtered.length > 0 && (
        <div style={{ background: WHITE, borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: NAVY }}>
                  {["#", "Trade", "Business Name", "City", "Phone", "Rating", "Reviews", "Priority"].map(h => (
                    <th key={h} style={{ padding: "11px 14px", color: WHITE, fontWeight: 700, textAlign: "left", whiteSpace: "nowrap", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, i) => {
                  const priority = priorityOf(lead.reviews);
                  const priorityColor = priority === "HIGH" ? { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" } : priority === "MED" ? { bg: "#EBF8FF", text: "#2C5282", border: "#90CDF4" } : { bg: "#F7FAFC", text: "#4A5568", border: "#CBD5E0" };
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #EDF2F7", background: i % 2 === 0 ? WHITE : "#FAFAF9" }}>
                      <td style={{ padding: "10px 14px", color: SLATE, fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ padding: "10px 14px", color: SLATE, whiteSpace: "nowrap" }}>{lead.trade}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: NAVY, maxWidth: 220 }}>
                        {lead.website ? (
                          <a href={lead.website} target="_blank" rel="noreferrer" style={{ color: NAVY, textDecoration: "none" }}>{lead.name}</a>
                        ) : lead.name}
                      </td>
                      <td style={{ padding: "10px 14px", color: SLATE, whiteSpace: "nowrap" }}>{lead.city}</td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        {lead.phone ? (
                          <a href={`tel:${lead.phone}`} style={{ color: GOLD, fontWeight: 600, textDecoration: "none" }}>{lead.phone}</a>
                        ) : <span style={{ color: "#CBD5E0" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: lead.rating >= 4.8 ? "#276749" : lead.rating >= 4.0 ? NAVY : "#C53030" }}>{lead.rating || "—"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", color: SLATE }}>{lead.reviews || 0}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: priorityColor.bg, color: priorityColor.text, border: `1px solid ${priorityColor.border}` }}>
                          {priority}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && leads.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: SLATE }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏗️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Ready to scrape</div>
          <div style={{ fontSize: 13 }}>Select a county, pick your cities and trades, then hit Run Scrape.</div>
        </div>
      )}
    </div>
  );
}
