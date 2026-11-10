/* Uitvoeren: node model.test.cjs — bewerkingen, opslag, migratie en export. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Config = require('./config.js');
const Model = require('./model.js');
const Engine = require('./engine.js');

const project = Model.createProject();
project.nudes = [{ src: project.icons[0], name: 'neutral-test-image.png' }];
project.result = Model.createBatch(project);
const batch = project.result;
const ticket = batch.tickets.find((item) => Engine.winningPrizes(item).length > 0 && item.nudeIndex === undefined);
const otherTicket = batch.tickets.find((item) => item !== ticket);
const slot = ticket.own.findIndex((item) => ticket.winning.includes(item.icon));
const originalText = batch.prices[ticket.own[slot].prize].name;
const originalOutcome = Model.recordedPrizes(ticket, batch.prices);
const originalSummary = Engine.analyze(batch.tickets, batch.prices, true, batch.icons.length);

// Een ander zichtbaar prijsetiket verandert nooit de echte uitslag.
Model.setPrizeText(ticket, slot, 'A hand-edited boat', originalText);
Model.setSampleText(ticket, 'title', 'MY UNIQUE TICKET');
Model.getEdits(ticket).overlays.push({
  id: 'custom-image', type: 'image', name: 'sample.png', src: project.icons[0],
  x: 0.25, y: 0.7, width: 0.3
}, {
  id: 'custom-text', type: 'text', text: 'Custom message\nSecond line',
  x: 0.6, y: 0.4, fontSize: 4, color: '#000000', fontFamily: 'Arial'
});
assert.equal(Model.visiblePrize(ticket, slot, batch.prices), 'A hand-edited boat');
assert.deepEqual(Model.recordedPrizes(ticket, batch.prices), originalOutcome);
assert.deepEqual(Engine.analyze(batch.tickets, batch.prices, true, batch.icons.length), originalSummary);
assert.ok(Model.isEdited(ticket));
assert.ok(!Model.isEdited(otherTicket));

// Nieuwe instellingen raken de bestaande serie niet.
project.prices[0].name = 'Future prize';
project.prices[0].chance = 0;
project.icons = [...project.icons].reverse();
project.settings.amount = 55;
assert.ok(Model.hasPendingSettings(project));
assert.equal(batch.amount, 40);
assert.equal(batch.prices[0].name, 'Cigarette');
assert.deepEqual(Model.recordedPrizes(ticket, batch.prices), originalOutcome);

// Bewaren en openen behoudt zowel uiterlijk als oorspronkelijke uitkomsten.
const restored = Model.restoreProject(JSON.parse(Model.serializeProject(project)));
const restoredTicket = restored.result.tickets.find((item) => item.id === ticket.id);
assert.deepEqual(restoredTicket.edits, ticket.edits);
assert.deepEqual(Model.recordedPrizes(restoredTicket, restored.result.prices), originalOutcome);
assert.ok(Model.hasPendingSettings(restored));

// Oude projecten openen zonder een nieuwe loting te doen.
const old = Model.createProject();
old.result = Engine.generate(old.settings.amount, old.prices, old.settings.overlap, old.icons.length);
old.version = 1;
const oldTickets = JSON.stringify(old.result.tickets);
const migrated = Model.restoreProject(old);
assert.equal(migrated.version, 3);
assert.equal(JSON.stringify(migrated.result.tickets), oldTickets);
assert.equal(migrated.result.prices[0].name, old.prices[0].name);

const invalid = JSON.parse(Model.serializeProject(project));
invalid.result.tickets[0].winning = [0, 0];
assert.throws(() => Model.restoreProject(invalid));
const invalidEdit = JSON.parse(Model.serializeProject(project));
invalidEdit.result.tickets.find((item) => item.id === ticket.id).edits.overlays[0].src = 'https://example.com/image.png';
assert.throws(() => Model.restoreProject(invalidEdit));

// Een echte nieuwe generatie begint zonder handmatige bewerkingen.
const regenerated = Model.createBatch(project);
assert.equal(regenerated.tickets.length, 55);
assert.ok(regenerated.tickets.every((item) => !Model.isEdited(item)));
assert.ok(Model.isEdited(ticket));

// Controleer de gedeelde tekenfunctie met een canvas-testdubbel.
// Dit controleert de tekenopdrachten; het vervangt geen visuele browsertest.
const printedText = [];
const drawnImages = [];
const fakeImage = { naturalWidth: 160, naturalHeight: 160 };
const fakeContext = {
  save() {}, restore() {}, clearRect() {}, fillRect() {},
  fillText(text) { printedText.push(text); },
  drawImage(...args) { drawnImages.push(args); }
};
const downloads = [];
const sandbox = {
  StudioConfig: Config, StudioModel: Model,
  StudioFiles: {
    getImage() { return fakeImage; },
    download(blob, name) { downloads.push({ blob, name }); }
  },
  Blob, setTimeout
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/render.js', 'utf8'), sandbox);
sandbox.StudioRender.paint(fakeContext, restored, restoredTicket, 1000, 650);
assert.ok(printedText.includes('A hand-edited boat'));
assert.ok(printedText.includes('MY UNIQUE TICKET'));
assert.ok(printedText.includes('Custom message'));
assert.ok(!printedText.includes('Manually edited'));
assert.equal(drawnImages.length, 7); // Zes speliconen + één extra afbeelding.
assert.equal(drawnImages.at(-1)[3], 300); // Afbeeldingbreedte = 30% van 1000.

printedText.length = 0;
sandbox.StudioRender.paint(fakeContext, restored, otherTicket, 1000, 650);
assert.ok(printedText.includes('GELUXXXZOEKER'));
assert.ok(!printedText.includes('MY UNIQUE TICKET'));
assert.ok(!printedText.includes('A hand-edited boat'));

vm.runInContext(fs.readFileSync(__dirname + '/export.js', 'utf8'), sandbox);
sandbox.StudioExport.report(restored);
(async () => {
  const csv = await downloads[0].blob.text();
  assert.ok(csv.includes('Original prizes won'));
  assert.ok(!csv.includes('A hand-edited boat'));
  assert.ok(csv.includes('"Yes"'));
  Model.resetTicket(ticket);
  assert.ok(!Model.isEdited(ticket));
  assert.equal(Model.visiblePrize(ticket, slot, batch.prices), originalText);
  console.log('Manual edits, batch isolation, project round-trip, migration, reset, drawing and CSV checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
