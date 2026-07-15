import { supabase } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const name = (req.body?.name || "").trim();
  const countryId = req.body?.countryId;

  if (!name || !countryId) {
    return res.status(400).json({ error: "'name' and 'countryId' are required" });
  }

  const { data, error } = await supabase
    .from("counties")
    .insert({ name, country_id: countryId })
    .select("id, name, country_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That county already exists in this country" });
    }
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ county: { ...data, cities: [] } });
}
