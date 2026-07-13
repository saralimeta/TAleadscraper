import { supabase } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const name = (req.body?.name || "").trim();
  const countyId = req.body?.countyId;

  if (!name || !countyId) {
    return res.status(400).json({ error: "'name' and 'countyId' are required" });
  }

  const { data, error } = await supabase
    .from("cities")
    .insert({ name, county_id: countyId })
    .select("id, name, county_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That city already exists in this county" });
    }
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ city: data });
}
