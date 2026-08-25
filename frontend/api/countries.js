import { supabase } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("countries")
      .select("id, name, states(id, name, country_id, counties(id, name, state_id, cities(id, name)))")
      .order("name");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const countries = data.map((country) => ({
      ...country,
      states: [...country.states]
        .map((state) => ({
          ...state,
          counties: [...state.counties]
            .map((county) => ({
              ...county,
              cities: [...county.cities].sort((a, b) => a.name.localeCompare(b.name)),
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));

    return res.status(200).json({ countries });
  }

  if (req.method === "POST") {
    const name = (req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "'name' is required" });
    }

    const { data, error } = await supabase
      .from("countries")
      .insert({ name })
      .select("id, name")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "That country already exists" });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ country: { ...data, states: [] } });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
