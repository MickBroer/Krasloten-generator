/* Nieuwe functies: node features.test.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Config = require('./config.js');
const Engine = require('./engine.js');
const Model = require('./model.js');
const Geometry = require('./geometry.js');

let seed = 71;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
let scenarios = 0;
function check(amount, winningCount, ownCount, chances, overlap = true) {
  const rules = { winningCount, ownCount, nudeExclusive: true };
  const prizes = chances.map((chance, index) => ({ name: index === 0 ? 'Nude' : `Prize ${index}`, chance }));
  const result = Engine.generate(amount, prizes, overlap, winningCount + ownCount, random, rules);
  assert.deepEqual(result.counts, Engine.quotas(amount, prizes, overlap, rules));
  assert.equal(result.counts.reduce((a, b) => a + b, 0),
    Math.round(chances.reduce((a, b) => a + b, 0) * amount / 100));
  for (const ticket of result.tickets) {
    const wins = Engine.winningPrizes(ticket);
    assert.equal(ticket.winning.length, winningCount);
    assert.equal(ticket.own.length, ownCount);
    assert.equal(new Set(ticket.own.map((item) => item.icon)).size, ownCount);
    assert.ok(wins.length <= (overlap ? Math.min(winningCount, ownCount) : 1));
    if (wins.includes(0)) assert.equal(wins.length, 1);
  }
  scenarios++;
  return result;
}

const full = check(40, 3, 5, [20, 80, 80, 80, 0]);
assert.deepEqual(full.histogram, [0, 8, 0, 32]);
check(3, 3, 5, [50, 50, 50, 50]);
check(1, 1, 1, [50, 50]);
check(40, 12, 24, [100, 0, 0]);
check(40, 1, 6, [0, 0, 0]);
assert.throws(() => check(40, 3, 5, [20, 90]));
assert.throws(() => check(40, 3, 5, [100, 1]));
assert.throws(() => check(40, 2, 4, [20, 80, 80, 80]));

for (let index = 0; index < 500; index++) {
  const winningCount = 1 + Math.floor(random() * 6);
  const ownCount = 1 + Math.floor(random() * 12);
  const overlap = index % 3 !== 0;
  const capacity = overlap ? Math.min(winningCount, ownCount) : 1;
  const nude = random() * 100;
  let others = Array.from({ length: 8 }, () => random() * (100 - nude));
  const sum = others.reduce((a, b) => a + b, 0);
  const scale = Math.min(1, capacity * (100 - nude) / sum * 0.999999);
  others = others.map((value) => value * scale);
  check(1 + Math.floor(random() * 90), winningCount, ownCount, [nude, ...others, 0], overlap);
}

// Elke afbeelding wordt bij het lot bewaard; cache/laden verandert de keuze niet.
const project = Model.createProject();
assert.throws(() => Model.createBatch(project), /Upload at least one nude/);
project.settings.winningCount = 3;
project.settings.ownCount = 5;
project.layout = Config.createLayout(3, 5);
project.prices = [20, 80, 80, 80, 0].map((chance, i) => ({ name: i === 0 ? 'Nude' : `Prize ${i}`, chance }));
project.nudes = project.icons.slice(0, 3).map((src, i) => ({ src, name: `neutral-test-${i}.png` }));
project.uploadNames = { front: '', back: '', icons: project.icons.map((_, i) => `icon-${i}.png`) };
project.settings.fontFamily = 'Georgia';
project.backSettings = { showNumber: true, x: 0.4, y: 0.8, fontSize: 4, color: '#000000', fontFamily: 'Courier New' };
project.nudeArea = { x: 0.45, y: 0.74, width: 0.6, height: 0.28 };
project.result = Model.createBatch(project, random);
const nudeTickets = project.result.tickets.filter((ticket) => ticket.nudeIndex !== undefined);
assert.equal(nudeTickets.length, 8);
const imageUse = project.nudes.map((_, i) => nudeTickets.filter((ticket) => ticket.nudeIndex === i).length);
assert.ok(Math.max(...imageUse) - Math.min(...imageUse) <= 1);
const reopened = Model.restoreProject(JSON.parse(Model.serializeProject(project)));
assert.deepEqual(reopened, project);
project.nudes = [];
assert.ok(Model.hasPendingSettings(project));
assert.equal(project.result.nudes.length, 3);

// Alle vier hoekgrepen behouden de verhouding en de tegenoverliggende hoek.
const box = { x: 250, y: 200, width: 200, height: 100 };
for (const corner of Geometry.corners(box)) {
  const anchor = { x: corner.sx < 0 ? 450 : 250, y: corner.sy < 0 ? 300 : 200 };
  const resized = Geometry.resizeFromCorner(box, corner,
    { x: anchor.x + corner.sx * 300, y: anchor.y + corner.sy * 150 }, 1000, 650);
  assert.ok(Math.abs(resized.width - 0.3) < 1e-10);
  assert.ok(Math.abs(resized.x * 1000 - corner.sx * 150 - anchor.x) < 1e-10);
  assert.ok(Math.abs(resized.y * 650 - corner.sy * 75 - anchor.y) < 1e-10);
}

// Tekenopdrachten: Nude vervangt alleen de eigen groep; de achterkant gebruikt
// het echte lotnummer en het gekozen lettertype, onafhankelijk van handmatige tekst.
const drawCalls = [];
const textCalls = [];
const context = {
  save() {}, restore() {}, clearRect() {}, fillRect() {},
  fillText(text, ...args) { textCalls.push({ text, font: this.font, args }); },
  drawImage(...args) { drawCalls.push(args); }
};
const fakeImage = { naturalWidth: 400, naturalHeight: 200 };
const sandbox = { StudioConfig: Config, StudioModel: Model,
  StudioFiles: { getImage: () => fakeImage }, StudioGeometry: Geometry };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/render.js', 'utf8'), sandbox);
const nudeTicket = reopened.result.tickets.find((ticket) => ticket.nudeIndex !== undefined);
sandbox.StudioRender.paint(context, reopened, nudeTicket, 1000, 650);
assert.equal(drawCalls.length, 4); // Eén foto plus drie winnende iconen.
assert.ok(!textCalls.some((call) => call.text.startsWith('Prize ')));
assert.ok(!textCalls.some((call) => call.text === 'Nude'));
assert.ok(textCalls.some((call) => call.text === 'GELUXXXZOEKER' && call.font.includes('Georgia')));
const area = sandbox.StudioRender.nudeBounds(reopened, 1000, 650);
const [, x, y, width, height] = drawCalls[0];
assert.ok(x >= area.x && y >= area.y && x + width <= area.x + area.width + 1e-8 && y + height <= area.y + area.height + 1e-8);
assert.equal(width / height, 2);
textCalls.length = 0;
sandbox.StudioRender.paintBack(context, reopened, nudeTicket, 1000, 650);
assert.equal(textCalls[0].text, `${nudeTicket.id} / 40`);
assert.ok(textCalls[0].font.includes('Courier New'));
reopened.backSettings.showNumber = false;
textCalls.length = 0;
sandbox.StudioRender.paintBack(context, reopened, nudeTicket, 1000, 650);
assert.equal(textCalls.length, 0);
console.log(`${scenarios} variable-icon/exclusive-prize scenarios passed; image persistence, custom area, fonts, back numbering and four resize corners passed.`);
