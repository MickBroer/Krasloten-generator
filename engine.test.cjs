/* Uitvoeren: node engine.test.cjs */
const assert = require('node:assert/strict');
const { generate, quotas } = require('./engine.js');

// Een vaste toevalsreeks maakt eventuele fouten reproduceerbaar.
let seed = 109;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}

let scenarios = 0;
function check(amount, percentages, overlap, iconCount = 8) {
  const prizes = percentages.map((chance, index) => ({ name: `Prize ${index}`, chance }));
  const result = generate(amount, prizes, overlap, iconCount, random);
  const counts = prizes.map(() => 0);
  assert.equal(result.tickets.length, amount);

  for (const ticket of result.tickets) {
    assert.equal(ticket.own.length, 4);
    assert.equal(new Set(ticket.own.map((item) => item.icon)).size, 4);
    assert.equal(new Set(ticket.winning).size, 2);
    const wins = ticket.own.filter((item) => ticket.winning.includes(item.icon));
    assert.ok(wins.length <= (overlap ? 2 : 1));
    assert.equal(new Set(wins.map((item) => item.prize)).size, wins.length);
    wins.forEach((item) => {
      assert.ok(prizes[item.prize].chance > 0);
      counts[item.prize]++;
    });
  }
  assert.deepEqual(counts, quotas(amount, prizes, overlap));
  assert.equal(result.histogram.reduce((sum, count) => sum + count, 0), amount);
  scenarios++;
}

check(40, [20, 5, 25, 10, 3, 0, 0], true);
check(40, [20, 5, 25, 10, 3, 0, 0], false);
check(1, [100, 100, 0], true, 6);
check(100, [100, 100], true);
check(40, [0, 0], false, 6);
check(5, [100, 0], false);
check(11, [50, 50, 50, 50, 0], true);

for (let index = 0; index < 250; index++) {
  const overlap = index % 2 === 0;
  const limit = overlap ? 200 : 100;
  const percentages = Array.from({ length: 8 }, () => random() * 100);
  const total = percentages.reduce((sum, chance) => sum + chance, 0);
  const scale = Math.min(1, limit / total * 0.999);
  check(1 + Math.floor(random() * 180), [...percentages.map((chance) => chance * scale), 0],
    overlap, 6 + index % 10);
}

assert.throws(() => generate(40, [{ name: 'a', chance: 101 }], true, 8));
assert.throws(() => generate(40, [{ name: 'a', chance: 60 }, { name: 'b', chance: 60 }], false, 8));
assert.throws(() => generate(40, [{ name: 'a', chance: 20 }], true, 5));
console.log(`${scenarios} distribution scenarios passed.`);
