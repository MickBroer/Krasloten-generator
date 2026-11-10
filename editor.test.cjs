/*
 * Zonder browser: test de echte editor-eventhandlers met een eenvoudige DOM-testdubbel.
 * Zo wordt ook de verbinding tussen hoekgreep, pointerbeweging en lotgegevens getest.
 * Uitvoeren: node editor.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Config = require('./config.js');
const Model = require('./model.js');
const Engine = require('./engine.js');
const Geometry = require('./geometry.js');

const project = Model.createProject();
project.prices.find((prize) => prize.name === 'Nude').chance = 0;
project.result = Model.createBatch(project);
const image = { naturalWidth: 400, naturalHeight: 200 };
const drawing = {
  save() {}, restore() {}, clearRect() {}, fillRect() {}, strokeRect() {},
  fillText() {}, drawImage() {}, setLineDash() {}
};
class Element {
  constructor() {
    this.value = '';
    this.checked = false;
    this.type = 'text';
    this.children = [];
    this.style = {};
    this.classList = { toggle() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this[name] = value; }
  getContext() { return drawing; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 650 }; }
  setPointerCapture() {}
  focus() {}
  scrollIntoView() {}
}
const elements = new Map();
const get = (id) => {
  if (!elements.has(id)) elements.set(id, new Element());
  return elements.get(id);
};
get('resultsFilter').value = 'all';
get('overlap').type = 'checkbox';
const downloaded = [];
const sandbox = {
  StudioConfig: Config, StudioModel: { ...Model, createProject: () => project },
  Lottery: Engine, StudioGeometry: Geometry,
  StudioFiles: {
    getImage: (source) => source ? image : undefined,
    loadProjectImages: async () => {},
    readImage: async () => project.icons[0],
    download: (blob, name) => downloaded.push({ blob, name })
  },
  document: { getElementById: get, querySelector: get, createElement: () => new Element() },
  setTimeout, Blob
};
vm.createContext(sandbox);
for (const name of ['render.js', 'export.js', 'app.js']) {
  vm.runInContext(fs.readFileSync(__dirname + '/' + name, 'utf8'), sandbox);
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
(async () => {
  await settle();
  get('ticketMode').onclick();
  get('overlayFile').onchange({ target: { files: [{ name: 'test-image.png' }], value: '' } });
  await settle();
  const ticket = project.result.tickets[0];
  const overlay = ticket.edits.overlays[0];
  const outcomeBefore = Engine.winningPrizes(ticket);
  assert.equal(overlay.width, 0.25);
  const canvas = get('preview');
  canvas.onpointerdown({ clientX: 625, clientY: 387.5, pointerId: 1, preventDefault() {} });
  canvas.onpointermove({ clientX: 750, clientY: 450 });
  canvas.onpointerup();
  assert.ok(Math.abs(overlay.width - 0.375) < 1e-10);
  assert.ok(Math.abs(overlay.x - 0.5625) < 1e-10);
  assert.ok(Math.abs(Number(get('overlayWidth').value) - 37.5) < 1e-10);
  assert.deepEqual(Engine.winningPrizes(ticket), outcomeBefore);

  get('layoutMode').onclick();
  get('editNudeArea').onclick();
  const originalArea = { ...project.nudeArea };
  canvas.onpointerdown({ clientX: 500, clientY: 487.5, pointerId: 2 });
  canvas.onpointermove({ clientX: 550, clientY: 500.5 });
  canvas.onpointerup();
  assert.ok(Math.abs(project.nudeArea.x - originalArea.x - 0.05) < 1e-10);
  assert.ok(Math.abs(project.nudeArea.y - originalArea.y - 0.02) < 1e-10);
  assert.equal(project.nudeArea.width, originalArea.width);

  get('backTab').onclick();
  get('backShowNumber').checked = true;
  get('backShowNumber').onchange();
  assert.equal(project.backSettings.showNumber, true);
  assert.equal(get('exportSingle').textContent, 'This back · PNG');
  await get('saveProject').onclick();
  const saved = JSON.parse(await downloaded[0].blob.text());
  assert.equal(saved.result.tickets[0].edits.overlays[0].width, 0.375);
  console.log('Editor pointer resize, area dragging, original outcome preservation, back toggle and saved resize passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
