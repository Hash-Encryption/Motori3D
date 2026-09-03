import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/vehicle-360.sqlite");
const cutoff = "2026-09-01T00:00:00.000Z";

const todayVehicles = db
  .prepare("SELECT id FROM vehicles WHERE created_at > ? AND business_id IS NULL")
  .all(cutoff);

console.log("Found today test vehicles:", todayVehicles.length);

for (const v of todayVehicles) {
  const captures = db.prepare("SELECT id FROM captures WHERE vehicle_id = ?").all(v.id);
  for (const c of captures) {
    db.prepare("DELETE FROM frames WHERE capture_id = ?").run(c.id);
    db.prepare("DELETE FROM captures WHERE id = ?").run(c.id);
  }
  db.prepare("DELETE FROM vehicles WHERE id = ?").run(v.id);
}

const remaining = db
  .prepare("SELECT count(*) as count FROM vehicles WHERE business_id IS NULL")
  .get();

console.log("Remaining baseline unassigned vehicles:", remaining.count);
