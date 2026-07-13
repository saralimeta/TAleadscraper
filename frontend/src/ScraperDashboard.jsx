import { useState, useEffect, useCallback, useRef } from "react";
import { NAVY, GOLD, GOLD_LIGHT, SLATE, WHITE, SUCCESS, SUCCESS_BG, priorityOf } from "./theme.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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
  const [counties, setCounties] = useState([]);
  const [trades, setTrades] = useState([]);
  const [bootLoading, setBootLoading] = useState(true);
  const [selectedCountyId, setSelectedCountyId] = useState(null);
  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedTrades, setSelectedTrades] = useState([]);
  const [minRating, setMinRating] = useState(0);
  const [minReviews, setMinReviews] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("reviews");
  const [filterPriority, setFilterPriority] = useState("all");
  const [newCountyName, setNewCountyName] = useState("");
  const [newCityName, setNewCityName] = useState("");
  const [newTradeName, setNewTradeName] = useState("");
  const [addingCounty, setAddingCounty] = useState(false);
  const [addingCity, setAddingCity] = useState(false);
  const [addingTrade, setAddingTrade] = useState(false);
  const [addError, setAddError] = useState("");
  const [freeCounty, setFreeCounty] = useState("");
  const [freeCity, setFreeCity] = useState("");
  const [freeTrade, setFreeTrade] = useState("");
  const [freeSearching, setFreeSearching] = useState(false);
  const [freeError, setFreeError] = useState("");
  const stopRef = useRef(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/counties`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/trades`).then(r => r.json()),
    ])
      .then(([countiesData, tradesData]) => {
        const cs = countiesData.counties || [];
        setCounties(cs);
        setTrades(tradesData.trades || []);
        if (cs.length > 0) setSelectedCountyId(cs[0].id);
      })
      .catch(err => console.error("Failed to load counties/trades:", err))
      .finally(() => setBootLoading(false));
  }, []);

  const selectedCounty = counties.find(c => c.id === selectedCountyId) || null;
  const cities = selectedCounty ? selectedCounty.cities : [];
  const countyName = selectedCounty ? selectedCounty.name : "";

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

  const selectAllCities = () => setSelectedCities(cities.map(c => c.name));
  const clearCities = () => setSelectedCities([]);
  const selectAllTrades = () => setSelectedTrades(trades.map(t => t.name));
  const clearTrades = () => setSelectedTrades([]);

  const addCounty = async () => {
    const name = newCountyName.trim();
    if (!name) return;
    setAddingCounty(true);
    setAddError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/counties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add county");
      setCounties(prev => [...prev, data.county].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCountyId(data.county.id);
      setSelectedCities([]);
      setNewCountyName("");
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddingCounty(false);
    }
  };

  const addCity = async () => {
    const name = newCityName.trim();
    if (!name || !selectedCountyId) return;
    setAddingCity(true);
    setAddError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/cities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, countyId: selectedCountyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add city");
      setCounties(prev => prev.map(c =>
        c.id === selectedCountyId
          ? { ...c, cities: [...c.cities, data.city].sort((a, b) => a.name.localeCompare(b.name)) }
          : c
      ));
      setNewCityName("");
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddingCity(false);
    }
  };

  const addTrade = async () => {
    const name = newTradeName.trim();
    if (!name) return;
    setAddingTrade(true);
    setAddError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add trade");
      setTrades(prev => [...prev, data.trade].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTradeName("");
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddingTrade(false);
    }
  };

  const runFreeformSearch = async () => {
    const trade = freeTrade.trim();
    const city = freeCity.trim();
    const county = freeCounty.trim();

    if (!trade || !city) {
      setFreeError("Trade and city are required — county is optional.");
      return;
    }

    setFreeError("");
    setFreeSearching(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade, city, county }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);

      const businesses = Array.isArray(data.businesses) ? data.businesses : [];

      setLeads(prev => {
        const seen = new Set(prev.map(l => `${l.name}-${l.city}`));
        const additions = [];
        for (const b of businesses) {
          if (!b.name || seen.has(`${b.name}-${b.city}`)) continue;
          seen.add(`${b.name}-${b.city}`);
          additions.push({
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
        return [...prev, ...additions];
      });

      setScraped(true);
      setFreeCounty("");
      setFreeCity("");
      setFreeTrade("");
    } catch (err) {
      setFreeError(err.message);
    } finally {
      setFreeSearching(false);
    }
  };

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
        queries.push({ trade, city, county: countyName });
      }
    }

    setProgress({ done: 0, total: queries.length, current: "" });

    const seen = new Set();
    const allLeads = [];

    for (const { trade, city, county: queryCounty } of queries) {
      if (stopRef.current) break;
      setProgress(p => ({ ...p, current: `${trade} in ${city}...` }));

      try {
        const response = await fetch(`${API_BASE_URL}/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trade, city, county: queryCounty }),
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
  }, [selectedCities, selectedTrades, countyName, setLeads, setScraped]);

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

  if (bootLoading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: SLATE }}>
        Loading counties and trades...
      </div>
    );
  }

  return (
    <div>
      {/* Config Panel */}
      <div style={{ background: WHITE, borderRadius: 12, border: `1px solid #E2E8F0`, padding: "24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

        {addError && (
          <div style={{ padding: "10px 14px", background: "#FFF5F5", borderRadius: 8, fontSize: 13, color: "#C53030", marginBottom: 16, border: "1px solid #FEB2B2" }}>
            {addError}
          </div>
        )}

        {/* County */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: SLATE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>County</label>
          <select
            value={selectedCountyId ?? ""}
            onChange={e => { setSelectedCountyId(Number(e.target.value)); setSelectedCities([]); }}
            style={{ width: "100%", padding: "10px 14px", border: `1.5px solid #CBD5E0`, borderRadius: 8, fontSize: 14, background: WHITE, color: NAVY, cursor: "pointer", marginBottom: 8 }}
          >
            {counties.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newCountyName}
              onChange={e => setNewCountyName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCounty()}
              placeholder="Add a new county..."
              style={{ flex: 1, padding: "8px 12px", border: "1.5px solid #CBD5E0", borderRadius: 8, fontSize: 13 }}
            />
            <button
              onClick={addCounty}
              disabled={addingCounty || !newCountyName.trim()}
              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: addingCounty ? "not-allowed" : "pointer", background: GOLD, color: NAVY, border: "none" }}
            >
              {addingCounty ? "Adding..." : "+ Add"}
            </button>
          </div>
        </div>

        {/* Cities */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: SLATE, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Cities in {countyName || "—"} <span style={{ color: GOLD }}>({selectedCities.length} selected)</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={selectAllCities} style={{ fontSize: 11, color: GOLD, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "2px 0" }}>All</button>
              <span style={{ color: "#CBD5E0" }}>|</span>
              <button onClick={clearCities} style={{ fontSize: 11, color: SLATE, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "2px 0" }}>Clear</button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {cities.map(city => (
              <button
                key={city.id}
                onClick={() => toggleCity(city.name)}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                  background: selectedCities.includes(city.name) ? NAVY : WHITE,
                  color: selectedCities.includes(city.name) ? WHITE : SLATE,
                  border: `1.5px solid ${selectedCities.includes(city.name) ? NAVY : "#CBD5E0"}`,
                }}
              >
                {city.name}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newCityName}
              onChange={e => setNewCityName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCity()}
              placeholder={`Add a city to ${countyName || "this county"}...`}
              disabled={!selectedCountyId}
              style={{ flex: 1, padding: "8px 12px", border: "1.5px solid #CBD5E0", borderRadius: 8, fontSize: 13 }}
            />
            <button
              onClick={addCity}
              disabled={addingCity || !newCityName.trim() || !selectedCountyId}
              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: addingCity ? "not-allowed" : "pointer", background: GOLD, color: NAVY, border: "none" }}
            >
              {addingCity ? "Adding..." : "+ Add"}
            </button>
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {trades.map(trade => (
              <button
                key={trade.id}
                onClick={() => toggleTrade(trade.name)}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                  background: selectedTrades.includes(trade.name) ? GOLD : WHITE,
                  color: selectedTrades.includes(trade.name) ? NAVY : SLATE,
                  border: `1.5px solid ${selectedTrades.includes(trade.name) ? GOLD : "#CBD5E0"}`,
                }}
              >
                {trade.name}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newTradeName}
              onChange={e => setNewTradeName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTrade()}
              placeholder="Add a new trade (available for all counties)..."
              style={{ flex: 1, padding: "8px 12px", border: "1.5px solid #CBD5E0", borderRadius: 8, fontSize: 13 }}
            />
            <button
              onClick={addTrade}
              disabled={addingTrade || !newTradeName.trim()}
              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: addingTrade ? "not-allowed" : "pointer", background: GOLD, color: NAVY, border: "none" }}
            >
              {addingTrade ? "Adding..." : "+ Add"}
            </button>
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

      {/* Freeform Search */}
      <div style={{ background: WHITE, borderRadius: 12, border: "1px solid #E2E8F0", padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: SLATE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          Freeform Search
        </label>
        <div style={{ fontSize: 12, color: SLATE, marginBottom: 12 }}>
          Search any county, city, and trade directly — no need to add them to the lists above first. Results get added to your leads just like a regular scrape.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <input
            value={freeCounty}
            onChange={e => setFreeCounty(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runFreeformSearch()}
            placeholder="County (optional)"
            style={{ flex: 1, minWidth: 160, padding: "9px 12px", border: "1.5px solid #CBD5E0", borderRadius: 8, fontSize: 13 }}
          />
          <input
            value={freeCity}
            onChange={e => setFreeCity(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runFreeformSearch()}
            placeholder="City"
            style={{ flex: 1, minWidth: 160, padding: "9px 12px", border: "1.5px solid #CBD5E0", borderRadius: 8, fontSize: 13 }}
          />
          <input
            value={freeTrade}
            onChange={e => setFreeTrade(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runFreeformSearch()}
            placeholder="Trade"
            style={{ flex: 1, minWidth: 160, padding: "9px 12px", border: "1.5px solid #CBD5E0", borderRadius: 8, fontSize: 13 }}
          />
          <button
            onClick={runFreeformSearch}
            disabled={freeSearching}
            style={{
              padding: "9px 22px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: freeSearching ? "not-allowed" : "pointer",
              background: freeSearching ? "#A0AEC0" : GOLD, color: NAVY, border: "none", whiteSpace: "nowrap",
            }}
          >
            {freeSearching ? "Searching..." : "🔍 Search"}
          </button>
        </div>
        {freeError && (
          <div style={{ padding: "8px 12px", background: "#FFF5F5", borderRadius: 8, fontSize: 12, color: "#C53030", border: "1px solid #FEB2B2" }}>
            {freeError}
          </div>
        )}
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
