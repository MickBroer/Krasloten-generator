/*
 * PROJECTGEGEVENS — scheidt speluitkomsten van wat je op een lot tekent.
 * project.prices/settings/icons = instellingen voor de VOLGENDE generatie.
 * project.result = bewaarde serie met eigen prijs- en icoongegevens.
 * ticket.edits = alleen uiterlijk; deze gegevens tellen niet mee voor winst.
 */
(function (root) {
  'use strict';
  const Config = typeof module !== 'undefined' ? require('./config.js') : root.StudioConfig;
  const Engine = typeof module !== 'undefined' ? require('./engine.js') : root.Lottery;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function createProject() {
    return {
      version: 3,
      front: null,
      back: null,
      backSettings: { ...Config.DEFAULT_BACK_SETTINGS },
      nudes: [],
      nudeArea: { x: 0.5, y: 0.75, width: 0.8, height: 0.32 },
      uploadNames: { front: '', back: '', icons: [] },
      icons: Config.createDemoIcons(),
      prices: clone(Config.DEFAULT_PRIZES),
      layout: Config.createLayout(),
      settings: { ...Config.DEFAULT_SETTINGS },
      result: null
    };
  }

  function requestedRules(project) {
    return Engine.rulesFor({ winningCount: project.settings.winningCount,
      ownCount: project.settings.ownCount, nudeExclusive: true });
  }

  function activeRules(project) {
    return project.result?.rules || requestedRules(project);
  }

  function hasBack(project) {
    return Boolean(project.back || project.backSettings.showNumber);
  }

  function createBatch(project, random = Math.random) {
    const { amount, overlap } = project.settings;
    const rules = requestedRules(project);
    const counts = Engine.quotas(amount, project.prices, overlap, rules);
    const nudePrize = Engine.nudePrizeIndex(project.prices);
    if (nudePrize >= 0 && counts[nudePrize] > 0 && !project.nudes.length) {
      throw Error('Upload at least one nude image before generating a batch with Nude winners.');
    }
    const batch = {
      ...Engine.generate(amount, project.prices, overlap, project.icons.length, random, rules),
      prices: clone(project.prices), icons: [...project.icons],
      nudes: clone(project.nudes), rules, amount, overlap
    };
    const imageUses = batch.nudes.map(() => 0);
    for (const ticket of batch.tickets) {
      if (!Engine.winningPrizes(ticket).includes(nudePrize)) continue;
      const leastUsed = Math.min(...imageUses);
      const choices = imageUses.map((uses, index) => ({ uses, index }))
        .filter((item) => item.uses === leastUsed);
      ticket.nudeIndex = choices[Math.floor(random() * choices.length)].index;
      imageUses[ticket.nudeIndex]++;
    }
    return batch;
  }

  function hasPendingSettings(project) {
    const batch = project.result;
    if (!batch) return false;
    return batch.amount !== project.settings.amount ||
      batch.overlap !== project.settings.overlap ||
      batch.rules.winningCount !== project.settings.winningCount ||
      batch.rules.ownCount !== project.settings.ownCount ||
      JSON.stringify(batch.prices) !== JSON.stringify(project.prices) ||
      JSON.stringify(batch.icons) !== JSON.stringify(project.icons) ||
      JSON.stringify(batch.nudes) !== JSON.stringify(project.nudes);
  }

  function getEdits(ticket) {
    if (!ticket.edits) ticket.edits = { prizeTexts: {}, sampleCopy: {}, overlays: [] };
    return ticket.edits;
  }

  function isEdited(ticket) {
    const edits = ticket?.edits;
    return Boolean(edits && (Object.keys(edits.prizeTexts).length ||
      Object.keys(edits.sampleCopy).length || edits.overlays.length));
  }

  function setPrizeText(ticket, slot, text, original) {
    const overrides = getEdits(ticket).prizeTexts;
    if (text === original) delete overrides[slot];
    else overrides[slot] = text;
  }

  function setSampleText(ticket, key, text) {
    const overrides = getEdits(ticket).sampleCopy;
    if (text === Config.SAMPLE_COPY[key]) delete overrides[key];
    else overrides[key] = text;
  }

  function visiblePrize(ticket, slot, prizes) {
    return ticket.edits?.prizeTexts?.[slot] ?? prizes[ticket.own[slot].prize]?.name ?? 'Prize';
  }

  function recordedPrizes(ticket, prizes) {
    return Engine.winningPrizes(ticket).map((index) => prizes[index].name);
  }

  function resetTicket(ticket) {
    delete ticket.edits;
  }

  function isImageSource(source) {
    return typeof source === 'string' &&
      /^data:image\/(png|jpeg|webp|svg\+xml)[;,]/i.test(source);
  }

  function inRange(value, minimum, maximum) {
    return Number.isFinite(value) && value >= minimum && value <= maximum;
  }

  function validateSettings(settings) {
    if (!Number.isInteger(settings.amount) || !inRange(settings.amount, 1, 10000) ||
        typeof settings.overlap !== 'boolean' ||
        !Number.isInteger(settings.winningCount) || !inRange(settings.winningCount, 1, 12) ||
        !Number.isInteger(settings.ownCount) || !inRange(settings.ownCount, 1, 24) ||
        !Object.hasOwn(Config.FONTS, settings.fontFamily) ||
        !inRange(settings.iconSize, 4, 22) || !inRange(settings.fontSize, 1, 6) ||
        !/^#[\da-f]{6}$/i.test(settings.textColor) ||
        !inRange(settings.widthMM, 10, 1000) || ![150, 300, 600].includes(settings.dpi) ||
        !Number.isInteger(settings.columns) || !inRange(settings.columns, 1, 20) ||
        !inRange(settings.gap, 0, 50)) {
      throw Error('Check the number of tickets, sizes, color and export settings.');
    }
  }

  function validateEdits(ticket) {
    if (!ticket.edits) return;
    const { prizeTexts, sampleCopy, overlays } = ticket.edits;
    if (!prizeTexts || !sampleCopy || !Array.isArray(overlays) || overlays.length > 100) {
      throw Error('Invalid manual edits in this project.');
    }
    for (const [slot, text] of Object.entries(prizeTexts)) {
      if (!/^(0|[1-9]\d*)$/.test(slot) || Number(slot) >= ticket.own.length ||
          typeof text !== 'string' || text.length > 500) {
        throw Error('Invalid prize text override.');
      }
    }
    for (const [key, text] of Object.entries(sampleCopy)) {
      if (!Object.hasOwn(Config.SAMPLE_COPY, key) || typeof text !== 'string' || text.length > 500) {
        throw Error('Invalid sample text override.');
      }
    }
    const ids = new Set();
    for (const overlay of overlays) {
      if (typeof overlay.id !== 'string' || ids.has(overlay.id) ||
          !inRange(overlay.x, 0, 1) || !inRange(overlay.y, 0, 1) ||
          !['image', 'text'].includes(overlay.type)) {
        throw Error('Invalid added item in this project.');
      }
      ids.add(overlay.id);
      if (overlay.type === 'image' && (!isImageSource(overlay.src) ||
          !inRange(overlay.width, 0.02, 1) || typeof overlay.name !== 'string')) {
        throw Error('Invalid added image in this project.');
      }
      if (overlay.type === 'text' && (typeof overlay.text !== 'string' ||
          overlay.text.length > 500 || !inRange(overlay.fontSize, 1, 15) ||
          !Object.hasOwn(Config.FONTS, overlay.fontFamily) ||
          !/^#[\da-f]{6}$/i.test(overlay.color))) {
        throw Error('Invalid added text in this project.');
      }
    }
  }

  function validateNudes(images) {
    if (!Array.isArray(images) || images.some((image) =>
      !isImageSource(image.src) || typeof image.name !== 'string')) {
      throw Error('Invalid nude image collection in this project.');
    }
  }

  // Oude series houden hun oude spelregels. Pas opnieuw genereren past de nieuwe
  // exclusieve Nude-regel toe. Handmatige bewerkingen worden nooit weggemigreerd.
  function restoreProject(raw) {
    const project = clone(raw);
    const oldVersion = project.version;
    if (![1, 2, 3].includes(oldVersion)) throw Error('Unsupported project version.');
    if (oldVersion < 3) {
      project.settings = { ...Config.DEFAULT_SETTINGS, ...project.settings };
      project.backSettings = { ...Config.DEFAULT_BACK_SETTINGS };
      project.nudes = [];
      project.nudeArea = { x: 0.5, y: 0.75, width: 0.8, height: 0.32 };
      project.uploadNames = {
        front: project.front ? 'Saved front design' : '',
        back: project.back ? 'Saved back design' : '', icons: []
      };
      if (project.result) {
        if (oldVersion === 1) Object.assign(project.result, {
          prices: clone(project.prices), icons: [...project.icons],
          amount: project.settings.amount, overlap: project.settings.overlap
        });
        project.result.rules = { winningCount: 2, ownCount: 4, nudeExclusive: false };
        project.result.nudes = [];
        for (const ticket of project.result.tickets) {
          for (const overlay of ticket.edits?.overlays || []) {
            if (overlay.type === 'text') overlay.fontFamily = 'Arial';
          }
        }
      }
    }
    validateSettings(project.settings);
    const rules = activeRules(project);
    if (!Array.isArray(project.prices) || !project.prices.length ||
        project.prices.some((prize) => typeof prize.name !== 'string' ||
          !inRange(prize.chance, 0, 100)) ||
        !Array.isArray(project.icons) || project.icons.length < 1 ||
        !project.icons.every(isImageSource) ||
        !Array.isArray(project.layout) || project.layout.length !== rules.winningCount + 2 * rules.ownCount ||
        project.layout.some((position) => !inRange(position.x, 0, 1) || !inRange(position.y, 0, 1))) {
      throw Error('This is not a valid Krasslut Studio project.');
    }
    for (const side of ['front', 'back']) {
      if (project[side] !== null && !isImageSource(project[side])) throw Error('Invalid front or back design.');
    }
    const back = project.backSettings;
    if (!back || typeof back.showNumber !== 'boolean' ||
        !inRange(back.x, 0, 1) || !inRange(back.y, 0, 1) ||
        !inRange(back.fontSize, 1, 15) || !/^#[\da-f]{6}$/i.test(back.color) ||
        !Object.hasOwn(Config.FONTS, back.fontFamily)) throw Error('Invalid back design settings.');
    const area = project.nudeArea;
    if (!area || !inRange(area.x, 0, 1) || !inRange(area.y, 0, 1) ||
        !inRange(area.width, 0.02, 1) || !inRange(area.height, 0.02, 1) ||
        area.x < area.width / 2 - 1e-8 || area.x > 1 - area.width / 2 + 1e-8 ||
        area.y < area.height / 2 - 1e-8 || area.y > 1 - area.height / 2 + 1e-8) {
      throw Error('Invalid nude image area.');
    }
    validateNudes(project.nudes);
    const names = project.uploadNames;
    if (!names || typeof names.front !== 'string' || typeof names.back !== 'string' ||
        !Array.isArray(names.icons) || names.icons.some((name) => typeof name !== 'string')) {
      throw Error('Invalid upload names in this project.');
    }

    const batch = project.result;
    if (batch) {
      Engine.rulesFor(batch.rules);
      validateNudes(batch.nudes);
      if (!Array.isArray(batch.icons) || batch.icons.length < rules.winningCount + rules.ownCount ||
          !batch.icons.every(isImageSource) || typeof batch.overlap !== 'boolean' ||
          !Array.isArray(batch.tickets) || batch.tickets.length !== batch.amount) {
        throw Error('The saved batch is invalid.');
      }
      const expected = Engine.quotas(batch.amount, batch.prices, batch.overlap, batch.rules);
      const summary = Engine.analyze(batch.tickets, batch.prices, batch.overlap, batch.icons.length, batch.rules);
      if (summary.counts.some((count, index) => count !== expected[index])) {
        throw Error('The saved outcomes do not match the original prize distribution.');
      }
      const nudePrize = Engine.nudePrizeIndex(batch.prices);
      for (const ticket of batch.tickets) {
        validateEdits(ticket);
        const isNude = batch.rules.nudeExclusive && Engine.winningPrizes(ticket).includes(nudePrize);
        if (isNude && (!Number.isInteger(ticket.nudeIndex) || ticket.nudeIndex < 0 ||
            ticket.nudeIndex >= batch.nudes.length)) throw Error('A Nude winner is missing its saved image.');
        if (!isNude && ticket.nudeIndex !== undefined) throw Error('An image is assigned to a non-Nude ticket.');
      }
      Object.assign(batch, summary);
    }
    project.version = 3;
    return project;
  }

  function serializeProject(project) {
    // Controleer voor opslaan dezelfde structuur als bij het openen.
    return JSON.stringify(restoreProject(project), null, 2);
  }

  const api = { createProject, createBatch, hasPendingSettings, getEdits, isEdited,
    setPrizeText, setSampleText, visiblePrize, recordedPrizes, resetTicket,
    restoreProject, serializeProject, validateSettings, isImageSource,
    requestedRules, activeRules, hasBack };
  if (typeof module !== 'undefined') module.exports = api;
  else root.StudioModel = api;
})(globalThis);
