// Checks that the JS colour engine gives byte-identical results to Nocturne for Mail (Swift).
// tests/color-parity.json is generated from the Swift code.
require("../src/color.js");
const { parseFast } = globalThis.NocturneColor;
const cases = require("./color-parity.json");
let failures = 0;
for (const c of cases) {
  const color = parseFast(c.in);
  const bg = color && color.adjusted("bg").css(), text = color && color.adjusted("text").css();
  if (bg !== c.bg || text !== c.text) {
    if (failures++ < 10) console.log(`MISMATCH ${c.in}: bg ${bg} vs ${c.bg}, text ${text} vs ${c.text}`);
  }
}
console.log(failures === 0 ? `colour parity: all ${cases.length} cases match` : `colour parity: ${failures} of ${cases.length} cases differ`);
process.exit(failures === 0 ? 0 : 1);
