import { supabase } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("trades")
      .select("id, name")
      .order("name");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ trades: data });
  }

  if (req.method === "POST") {
    const name = (req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "'name' is required" });
    }

    const { data, error } = await supabase
      .from("trades")
      .insert({ name })
      .select("id, name")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "That trade already exists" });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ trade: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
