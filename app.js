/*
 * BEDIENING — koppelt knoppen en invoervelden aan de andere bestanden.
 * Volgorde: toestand → tekenen → invoervelden → handmatige lagen → acties.
 * Alle projectgegevens staan in 'project'. Tijdelijke UI-keuzes staan ernaast.
 */
(function () {
  'use strict';
  const Config = StudioConfig;
  const Model = StudioModel;
  const Files = StudioFiles;
  const Render = StudioRender;
  const Export = StudioExport;
  const element = (id) => document.getElementById(id);
  const canvas = element('preview');
  const context = canvas.getContext('2d');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  let project = Model.createProject();
  let ticketIndex = 0;
  let mode = 'layout';
  let activeSide = 'front';
  let editingNudeArea = false;
  let resultsPage = 0;
  let resizeGesture = null;
  let selectedLayout = -1;
  let selectedOverlayId = null;
  let busy = false;
  let dragging = false;
  let dragOffset = { x: 0, y: 0 };

  function currentTicket() {
    if (project.result) return project.result.tickets[ticketIndex];
    const rules = Model.activeRules(project);
    return {
      id: 0,
      winning: Array.from({ length: rules.winningCount }, (_, i) => i % project.icons.length),
      own: Array.from({ length: rules.ownCount }, (_, i) => ({
        icon: (rules.winningCount + i) % project.icons.length, prize: i % project.prices.length
      }))
    };
  }

  function selectedOverlay() {
    return currentTicket().edits?.overlays.find((item) => item.id === selectedOverlayId);
  }

  function message(text, error = false) {
    element('message').textContent = text;
    element('message').className = error ? 'error' : '';
  }

  // Tijdens laden/exporteren kunnen gegevens niet tussentijds veranderen.
  async function runTask(task) {
    if (busy) return;
    busy = true;
    document.querySelector('main').inert = true;
    document.querySelector('header').inert = true;
    try {
      await task();
    } catch (error) {
      message(error.message, true);
    } finally {
      busy = false;
      document.querySelector('main').inert = false;
      document.querySelector('header').inert = false;
    }
  }

  // Een eigen dialoog werkt hetzelfde in alle browsers en beschermt je bewerkingen.
  function confirmAction(text) {
    return new Promise((resolve) => {
      const dialog = element('confirmDialog');
      element('confirmMessage').textContent = text;
      function finish(accepted) {
        dialog.close();
        resolve(accepted);
      }
      element('confirmCancel').onclick = () => finish(false);
      element('confirmContinue').onclick = () => finish(true);
      dialog.oncancel = (event) => {
        event.preventDefault();
        finish(false);
      };
      dialog.showModal();
      element('confirmCancel').focus();
    });
  }

  // ---------- Werkblad en samenvatting ----------

  function draw() {
    const design = Render.dimensions(project);
    canvas.width = 1000;
    canvas.height = Math.max(1, Math.round(1000 * design.height / design.width));
    if (activeSide === 'back') Render.paintBack(context, project, currentTicket(), canvas.width, canvas.height);
    else Render.paint(context, project, currentTicket(), canvas.width, canvas.height);

    if (activeSide === 'front' && mode === 'layout') {
      if (editingNudeArea) {
        const bounds = Render.nudeBounds(project, canvas.width, canvas.height);
        Render.drawGuide(context, bounds, true);
      } else {
        project.layout.forEach((_, index) => {
          Render.drawGuide(context, Render.layoutBounds(project, index, canvas.width, canvas.height),
            index === selectedLayout);
        });
      }
    } else if (activeSide === 'front' && mode === 'ticket' && selectedOverlay()) {
      const overlay = selectedOverlay();
      const bounds = Render.overlayBounds(overlay, canvas.width, canvas.height);
      Render.drawGuide(context, bounds, true);
      if (overlay.type === 'image') Render.drawHandles(context, bounds, handleSize());
    }

    const hasBack = Model.hasBack(project);
    element('editedBadge').hidden = !Model.isEdited(currentTicket());
    element('pageLabel').textContent = project.result
      ? `${currentTicket().id} / ${project.result.amount}` : 'Sample';
    element('prev').disabled = !project.result || ticketIndex === 0;
    element('next').disabled = !project.result || ticketIndex === project.result.tickets.length - 1;
    element('ticketMode').disabled = !project.result;
    element('exportBack').disabled = !hasBack || !project.result;
    element('exportSheet').disabled = !project.result || (activeSide === 'back' && !hasBack);
    element('exportSingle').disabled = !project.result || (activeSide === 'back' && !hasBack);
    element('exportSheet').textContent = activeSide === 'back' ? 'Download back sheet · PNG' : 'Download full sheet · PNG';
    element('exportSingle').textContent = activeSide === 'back' ? 'This back · PNG' : 'This ticket · PNG';
    element('exportReport').disabled = !project.result;
    element('resetTicket').disabled = !Model.isEdited(currentTicket());
    element('pendingSettings').hidden = !Model.hasPendingSettings(project);
    element('assetInfo').textContent =
      `${project.front ? 'Custom front' : 'Sample design'} · ${project.icons.length} icons for the next batch · ` +
      (project.back ? 'with back design' : 'no back design');
    updateFileNames();
    updateExportDimensions();
  }

  function updateFileNames() {
    const names = project.uploadNames;
    element('frontFileName').textContent = names.front || (project.front ? 'Saved front design' : 'Sample design');
    element('backFileName').textContent = names.back || (project.back ? 'Saved back design' : 'No back design loaded');
    element('iconsFileName').textContent = names.icons.length
      ? `${names.icons.length} files: ${names.icons.join(', ')}` : `${project.icons.length} sample/saved icons`;
    element('nudesFileName').textContent = project.nudes.length
      ? `${project.nudes.length} images: ${project.nudes.map((image) => image.name).join(', ')}` : 'No nude images loaded';
    element('clearNudes').disabled = !project.nudes.length;
    const required = project.settings.winningCount + project.settings.ownCount;
    element('requiredIcons').textContent = `These settings need at least ${required} different icon files. You have ${project.icons.length}.`;
  }

  function setSide(side) {
    activeSide = side;
    element('frontTab').setAttribute('aria-selected', String(side === 'front'));
    element('backTab').setAttribute('aria-selected', String(side === 'back'));
    element('frontModes').hidden = side === 'back';
    element('frontToolbar').hidden = side === 'back';
    element('backEditor').hidden = side !== 'back';
    setMode(mode);
  }

  function setMode(nextMode) {
    if (nextMode === 'ticket' && !project.result) return;
    mode = nextMode;
    selectedOverlayId = null;
    dragging = false;
    ['layout', 'ticket', 'preview'].forEach((name) => {
      element(name + 'Mode').classList.toggle('active', mode === name);
      element(name + 'Mode').setAttribute('aria-pressed', String(mode === name));
    });
    element('positionDetails').hidden = activeSide !== 'front' || mode !== 'layout';
    element('nudeAreaEditor').hidden = activeSide !== 'front' || mode !== 'layout';
    element('ticketEditor').hidden = activeSide !== 'front' || mode !== 'ticket';
    const help = {
      layout: 'Move icons and prize positions for all tickets. Use the arrow keys for small adjustments.',
      ticket: 'Edit only this ticket. Add images or text below, then drag added items into place.',
      preview: 'Clean preview: manual edits are included; guides and editing labels are not printed.'
    };
    element('modeHelp').textContent = activeSide === 'back'
      ? 'Back preview. The series number is linked to the same ticket number in the results list.'
      : editingNudeArea && mode === 'layout' ? 'Drag the Nude image frame. Its size can be changed in the fields below.' : help[mode];
    renderTicketEditor();
    draw();
  }

  function goToTicket(offset) {
    if (!project.result || busy) return;
    ticketIndex = clamp(ticketIndex + offset, 0, project.result.tickets.length - 1);
    selectedOverlayId = null;
    dragging = false;
    renderTicketEditor();
    renderResults();
    draw();
  }

  function renderSummary() {
    const container = element('summary');
    container.replaceChildren();
    const batch = project.result;
    renderResults();
    if (!batch) {
      container.className = 'empty';
      container.textContent = 'Generate a batch to see the distribution.';
      return;
    }
    container.className = '';
    const stats = document.createElement('div');
    stats.className = 'stats';
    batch.histogram.forEach((count, index) => {
      const box = document.createElement('div');
      const number = document.createElement('b');
      number.textContent = count;
      const label = document.createElement('span');
      label.textContent = index === 0 ? 'no prize' : index === 1 ? 'one prize' : `${index} prizes`;
      box.append(number, label);
      stats.append(box);
    });
    container.append(stats);

    const table = document.createElement('table');
    const header = document.createElement('tr');
    ['Prize', 'Requested', 'Tickets', 'Actual'].forEach((text) => {
      const cell = document.createElement('th');
      cell.textContent = text;
      header.append(cell);
    });
    table.append(header);
    batch.prices.forEach((prize, index) => {
      const row = document.createElement('tr');
      const actual = (batch.counts[index] / batch.amount * 100)
        .toLocaleString('en-GB', { maximumFractionDigits: 2 });
      [prize.name, `${prize.chance}%`, batch.counts[index], `${actual}%`].forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });
      table.append(row);
    });
    container.append(table);

    const editedCount = batch.tickets.filter(Model.isEdited).length;
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = `${editedCount} manually edited ticket(s). This table shows original recorded outcomes.`;
    container.append(note);
    if (batch.duplicates) {
      const repeated = document.createElement('p');
      repeated.className = 'hint';
      repeated.textContent = `${batch.duplicates} repeated original combinations. More icons allow greater variety.`;
      container.append(repeated);
    }
  }

  function updateExportDimensions() {
    try {
      const size = Export.sheetSize(project);
      const mmPerPixel = 25.4 / project.settings.dpi;
      element('dimensions').textContent =
        `Sheet: ${size.sheetWidth} × ${size.sheetHeight} px · ` +
        `${(size.sheetWidth * mmPerPixel).toFixed(1)} × ${(size.sheetHeight * mmPerPixel).toFixed(1)} mm. ` +
        `Ticket height: ${(size.height * mmPerPixel).toFixed(1)} mm.`;
    } catch (error) {
      element('dimensions').textContent = error.message;
    }
  }

  // Alle loten zijn hier op nummer terug te vinden; 50 rijen per pagina.
  function renderResults() {
    const container = element('ticketResults');
    container.replaceChildren();
    const batch = project.result;
    const filter = element('resultsFilter').value;
    const tickets = (batch?.tickets || []).filter((ticket) => {
      const wins = batch ? Model.recordedPrizes(ticket, batch.prices) : [];
      return filter === 'all' || (filter === 'winners' && wins.length > 0) ||
        (filter === 'nude' && wins.some((name) => name.trim().toLowerCase() === 'nude')) ||
        (filter === 'edited' && Model.isEdited(ticket));
    });
    const pageCount = Math.max(1, Math.ceil(tickets.length / 50));
    resultsPage = clamp(resultsPage, 0, pageCount - 1);
    element('resultsPageLabel').textContent = `${resultsPage + 1} / ${pageCount} · ${tickets.length} tickets`;
    element('resultsPrev').disabled = resultsPage === 0;
    element('resultsNext').disabled = resultsPage === pageCount - 1;
    if (!tickets.length) {
      container.textContent = batch ? 'No tickets match this filter.' : 'Generate a batch to see each ticket’s recorded prizes.';
      return;
    }
    const table = document.createElement('table');
    const head = document.createElement('tr');
    ['Ticket', 'Original prizes won', 'Image', 'Manual edits'].forEach((name) => {
      const th = document.createElement('th');
      th.textContent = name;
      head.append(th);
    });
    table.append(head);
    tickets.slice(resultsPage * 50, resultsPage * 50 + 50).forEach((ticket) => {
      const row = document.createElement('tr');
      row.classList.toggle('current-ticket', ticket === currentTicket());
      const cell = document.createElement('td');
      const button = document.createElement('button');
      button.textContent = `View #${ticket.id}`;
      button.onclick = () => {
        ticketIndex = batch.tickets.indexOf(ticket);
        selectedOverlayId = null;
        renderTicketEditor();
        renderResults();
        draw();
        canvas.scrollIntoView({ block: 'center', behavior: 'smooth' });
      };
      cell.append(button);
      row.append(cell);
      [Model.recordedPrizes(ticket, batch.prices).join(' + ') || 'No prize',
        batch.nudes[ticket.nudeIndex]?.name || '—', Model.isEdited(ticket) ? 'Yes' : 'No'].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value;
        row.append(td);
      });
      table.append(row);
    });
    container.append(table);
  }

  function populateFonts() {
    for (const id of ['fontFamily', 'overlayFontFamily', 'backFontFamily']) {
      const select = element(id);
      select.replaceChildren();
      for (const [name, family] of Object.entries(Config.FONTS)) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        option.style.fontFamily = family;
        select.append(option);
      }
    }
  }

  function syncBackSettings() {
    const back = project.backSettings;
    element('backShowNumber').checked = back.showNumber;
    element('backNumberControls').hidden = !back.showNumber;
    element('backX').value = (back.x * 100).toFixed(1);
    element('backY').value = (back.y * 100).toFixed(1);
    element('backFontSize').value = back.fontSize;
    element('backFontFamily').value = back.fontFamily;
    element('backColor').value = back.color;
  }

  function keepNudeAreaOnTicket() {
    const area = project.nudeArea;
    area.x = clamp(area.x, area.width / 2, 1 - area.width / 2);
    area.y = clamp(area.y, area.height / 2, 1 - area.height / 2);
  }

  function syncNudeArea() {
    for (const key of ['x', 'y', 'width', 'height']) {
      element('nudeArea' + key[0].toUpperCase() + key.slice(1)).value = (project.nudeArea[key] * 100).toFixed(1);
    }
  }

  // ---------- Algemene invoervelden ----------

  function syncSettings() {
    syncBackSettings();
    syncNudeArea();
    for (const [key, value] of Object.entries(project.settings)) {
      const input = element(key);
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
    }
  }

  function renderPrizes() {
    const container = element('prices');
    container.replaceChildren();
    project.prices.forEach((prize, index) => {
      const row = document.createElement('div');
      row.className = 'pricerow';
      const name = document.createElement('input');
      name.type = 'text';
      name.maxLength = 500;
      name.value = prize.name;
      name.setAttribute('aria-label', `Prize name ${index + 1}`);
      name.oninput = () => { prize.name = name.value; draw(); };

      const chance = document.createElement('input');
      chance.type = 'number';
      chance.min = 0;
      chance.max = 100;
      chance.step = 0.1;
      chance.value = prize.chance;
      chance.setAttribute('aria-label', `Prize odds ${index + 1}`);
      chance.oninput = () => {
        prize.chance = chance.value === '' ? NaN : Number(chance.value);
        draw();
      };
      const remove = document.createElement('button');
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove prize ${index + 1}`);
      remove.disabled = project.prices.length === 1;
      remove.onclick = () => {
        project.prices.splice(index, 1);
        renderPrizes();
        draw();
      };
      row.append(name, chance, remove);
      container.append(row);
    });
  }

  function renderPositions() {
    const container = element('positions');
    const rules = Model.activeRules(project);
    const names = Config.positionNames(rules.winningCount, rules.ownCount);
    container.replaceChildren();
    project.layout.forEach((position, index) => {
      const label = document.createElement('label');
      label.append(names[index]);
      for (const axis of ['x', 'y']) {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = 0;
        input.max = 100;
        input.step = 0.1;
        input.value = (position[axis] * 100).toFixed(1);
        input.setAttribute('aria-label', `${names[index]} ${axis} percent`);
        input.oninput = () => {
          position[axis] = clamp(Number(input.value) / 100, 0, 1);
          selectedLayout = index;
          draw();
        };
        label.append(axis.toUpperCase(), input);
      }
      container.append(label);
    });
  }

  // ---------- Teksten en extra lagen op één lot ----------

  function afterManualEdit() {
    draw();
    renderSummary();
  }

  function textField(container, labelText, value, onChange, id) {
    const label = document.createElement('label');
    label.append(labelText);
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 500;
    input.value = value;
    if (id) input.id = id;
    input.oninput = () => { onChange(input.value); afterManualEdit(); };
    label.append(input);
    container.append(label);
  }

  function renderTicketEditor() {
    if (!project.result) return;
    const ticket = currentTicket();
    const prizes = project.result.prices;
    const fields = element('prizeTextFields');
    fields.replaceChildren();
    for (let slot = 0; slot < ticket.own.length; slot++) {
      const original = prizes[ticket.own[slot].prize].name;
      textField(fields, `Visible prize text ${slot + 1}`, Model.visiblePrize(ticket, slot, prizes),
        (text) => Model.setPrizeText(ticket, slot, text, original), `ticketPrize${slot}`);
    }

    const nude = project.result.nudes[ticket.nudeIndex];
    fields.hidden = Boolean(nude);
    element('nudeTicketNote').hidden = !nude;
    element('nudeTicketNote').textContent = nude
      ? `Nude winner · ${nude.name}. The image fills the area you chose; your icons and prize labels are hidden. Winning icons remain visible.` : '';
    const won = Model.recordedPrizes(ticket, prizes);
    element('recordedOutcome').textContent = 'Original recorded prizes: ' + (won.join(' + ') || 'No prize');
    element('sampleTextDetails').hidden = Boolean(project.front);
    element('artworkTextNote').hidden = !project.front;
    const sampleFields = element('sampleTextFields');
    sampleFields.replaceChildren();
    const labels = { title: 'Title', winning: 'Winning icons heading', own: 'Your icons heading', footer: 'Footer' };
    for (const [key, original] of Object.entries(Config.SAMPLE_COPY)) {
      textField(sampleFields, labels[key], ticket.edits?.sampleCopy[key] ?? original,
        (text) => Model.setSampleText(ticket, key, text));
    }
    renderOverlayList();
    syncOverlayControls();
  }

  function renderOverlayList() {
    const container = element('overlayList');
    container.replaceChildren();
    const overlays = currentTicket().edits?.overlays || [];
    for (const [index, overlay] of overlays.entries()) {
      const button = document.createElement('button');
      button.textContent = overlay.type === 'image'
        ? `Image ${index + 1}: ${overlay.name}` : `Text ${index + 1}: ${overlay.text || '(empty)'}`;
      button.classList.toggle('active', overlay.id === selectedOverlayId);
      button.setAttribute('aria-pressed', String(overlay.id === selectedOverlayId));
      button.onclick = () => {
        selectedOverlayId = overlay.id;
        renderOverlayList();
        syncOverlayControls();
        draw();
      };
      container.append(button);
    }
  }

  function syncOverlayControls() {
    const overlay = selectedOverlay();
    element('overlayControls').hidden = !overlay;
    if (!overlay) return;
    element('overlayX').value = (overlay.x * 100).toFixed(1);
    element('overlayY').value = (overlay.y * 100).toFixed(1);
    const image = overlay.type === 'image';
    element('imageWidthField').hidden = !image;
    ['overlayFontField', 'overlayFontFamilyField', 'overlayColorField', 'overlayTextField'].forEach((id) => {
      element(id).hidden = image;
    });
    if (image) {
      element('overlayWidth').value = overlay.width * 100;
    } else {
      element('overlayFont').value = overlay.fontSize;
      element('overlayFontFamily').value = overlay.fontFamily;
      element('overlayColor').value = overlay.color;
      element('overlayText').value = overlay.text;
    }
  }

  function addOverlay(overlay) {
    const overlays = Model.getEdits(currentTicket()).overlays;
    if (overlays.length >= 100) throw Error('A ticket can contain up to 100 added items.');
    overlays.push(overlay);
    selectedOverlayId = overlay.id;
    renderOverlayList();
    syncOverlayControls();
    afterManualEdit();
  }

  function newOverlayId() {
    return 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  // ---------- Slepen en toetsenbord ----------

  function pointerPosition(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height };
  }

  function contains(bounds, position) {
    const x = position.x * canvas.width;
    const y = position.y * canvas.height;
    return x >= bounds.x && x <= bounds.x + bounds.width &&
      y >= bounds.y && y <= bounds.y + bounds.height;
  }

  function selectedPosition() {
    if (activeSide !== 'front') return null;
    if (mode === 'layout') return editingNudeArea ? project.nudeArea : project.layout[selectedLayout];
    if (mode === 'ticket') return selectedOverlay();
    return null;
  }

  function handleSize() {
    // Grepen blijven ongeveer 9 schermpixels groot bij iedere canvasweergave.
    return 9 * canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
  }

  function handleAt(position) {
    const overlay = selectedOverlay();
    if (activeSide !== 'front' || mode !== 'ticket' || overlay?.type !== 'image') return null;
    const bounds = Render.overlayBounds(overlay, canvas.width, canvas.height);
    const tolerance = handleSize();
    return StudioGeometry.corners(bounds).find((corner) =>
      Math.abs(position.x * canvas.width - corner.x) <= tolerance &&
      Math.abs(position.y * canvas.height - corner.y) <= tolerance) || null;
  }

  canvas.onpointerdown = (event) => {
    if (busy || activeSide !== 'front' || mode === 'preview') return;
    const position = pointerPosition(event);
    const handle = handleAt(position);
    if (handle) {
      resizeGesture = { bounds: Render.overlayBounds(selectedOverlay(), canvas.width, canvas.height), corner: handle };
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    selectedLayout = -1;
    selectedOverlayId = null;
    if (mode === 'layout') {
      if (editingNudeArea) {
        if (!contains(Render.nudeBounds(project, canvas.width, canvas.height), position)) return;
      } else {
        for (let index = project.layout.length - 1; index >= 0; index--) {
          if (contains(Render.layoutBounds(project, index, canvas.width, canvas.height), position)) {
            selectedLayout = index;
            break;
          }
        }
      }
    } else {
      const overlays = currentTicket().edits?.overlays || [];
      for (let index = overlays.length - 1; index >= 0; index--) {
        if (contains(Render.overlayBounds(overlays[index], canvas.width, canvas.height), position)) {
          selectedOverlayId = overlays[index].id;
          break;
        }
      }
      if (!selectedOverlayId && currentTicket().nudeIndex === undefined) {
        const rules = Model.activeRules(project);
        for (let slot = 0; slot < rules.ownCount; slot++) {
          const index = rules.winningCount + rules.ownCount + slot;
          if (contains(Render.layoutBounds(project, index, canvas.width, canvas.height), position)) {
            element(`ticketPrize${slot}`).focus();
            break;
          }
        }
      }
      renderOverlayList();
      syncOverlayControls();
    }
    const selected = selectedPosition();
    if (selected) {
      canvas.focus();
      dragging = true;
      dragOffset = { x: selected.x - position.x, y: selected.y - position.y };
      canvas.setPointerCapture(event.pointerId);
    }
    draw();
  };

  canvas.onpointermove = (event) => {
    if (busy) return;
    const position = pointerPosition(event);
    if (!dragging) {
      const handle = handleAt(position);
      canvas.style.cursor = handle ? (handle.sx === handle.sy ? 'nwse-resize' : 'nesw-resize') : 'default';
      return;
    }
    const selected = selectedPosition();
    if (!selected) return;
    if (resizeGesture) {
      Object.assign(selected, StudioGeometry.resizeFromCorner(resizeGesture.bounds, resizeGesture.corner,
        { x: position.x * canvas.width, y: position.y * canvas.height }, canvas.width, canvas.height));
    } else {
      selected.x = clamp(position.x + dragOffset.x, 0, 1);
      selected.y = clamp(position.y + dragOffset.y, 0, 1);
    }
    if (mode === 'ticket') syncOverlayControls();
    if (editingNudeArea) { keepNudeAreaOnTicket(); syncNudeArea(); }
    draw();
  };

  function finishDrag() {
    if (!dragging) return;
    dragging = false;
    resizeGesture = null;
    canvas.style.cursor = 'default';
    renderPositions();
    if (mode === 'ticket') afterManualEdit();
  }
  canvas.onpointerup = finishDrag;
  canvas.onpointercancel = finishDrag;
  canvas.onlostpointercapture = finishDrag;
  canvas.onkeydown = (event) => {
    if (busy) return;
    const selected = selectedPosition();
    if (!selected || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.01 : 0.001;
    if (event.key === 'ArrowLeft') selected.x -= step;
    if (event.key === 'ArrowRight') selected.x += step;
    if (event.key === 'ArrowUp') selected.y -= step;
    if (event.key === 'ArrowDown') selected.y += step;
    selected.x = clamp(selected.x, 0, 1);
    selected.y = clamp(selected.y, 0, 1);
    renderPositions();
    syncOverlayControls();
    if (editingNudeArea) keepNudeAreaOnTicket();
    syncNudeArea();
    afterManualEdit();
  };

  // ---------- Knoppen en bestandsacties ----------

  element('generate').onclick = () => runTask(async () => {
    Model.validateSettings(project.settings);
    // Eerst valideren; bij ongeldige percentages blijft de bestaande serie staan.
    Lottery.quotas(project.settings.amount, project.prices, project.settings.overlap, Model.requestedRules(project));
    const edited = project.result?.tickets.some(Model.isEdited);
    if (edited && !await confirmAction('Generate a new batch? This replaces all current tickets and removes their manual edits. Save your project first if you want to keep them.')) return;
    message('Generating your batch…');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const batch = Model.createBatch(project);
    const oldRules = Model.activeRules(project);
    if (oldRules.winningCount !== batch.rules.winningCount || oldRules.ownCount !== batch.rules.ownCount) {
      project.layout = Config.createLayout(batch.rules.winningCount, batch.rules.ownCount);
    }
    project.result = batch;
    ticketIndex = 0;
    resultsPage = 0;
    editingNudeArea = false;
    element('editNudeArea').setAttribute('aria-pressed', 'false');
    renderPositions();
    renderSummary();
    setSide('front');
    setMode('ticket');
    message(`${batch.amount} tickets generated. Original outcomes have been verified.`);
  });

  element('addPrice').onclick = () => {
    project.prices.push({ name: 'New prize', chance: 0 });
    renderPrizes();
    draw();
  };
  for (const key of Object.keys(Config.DEFAULT_SETTINGS)) {
    element(key).oninput = () => {
      const input = element(key);
      project.settings[key] = input.type === 'checkbox' ? input.checked
        : input.type === 'color' || key === 'fontFamily' ? input.value : Number(input.value);
      if ((key === 'winningCount' || key === 'ownCount') && !project.result) {
        project.settings[key] = clamp(Math.round(project.settings[key]), 1, key === 'winningCount' ? 12 : 24);
        project.layout = Config.createLayout(project.settings.winningCount, project.settings.ownCount);
        renderPositions();
      }
      draw();
    };
  }

  for (const side of ['front', 'back']) {
    element(side).onchange = (event) => {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      runTask(async () => {
        project[side] = await Files.readImage(file);
        project.uploadNames[side] = file.name;
        renderTicketEditor();
        draw();
        message(`${side === 'front' ? 'Front' : 'Back'} design loaded.`);
      });
    };
  }
  element('icons').onchange = (event) => {
    const files = [...event.target.files];
    event.target.value = '';
    if (!files.length) return;
    runTask(async () => {
      if (!files.length) return;
      const sources = [];
      for (const file of files) sources.push(await Files.readImage(file));
      if (new Set(sources).size !== sources.length) throw Error('Select different icon files.');
      project.icons = sources;
      project.uploadNames.icons = files.map((file) => file.name);
      draw();
      message('Icons loaded for the next batch. Current tickets are unchanged.');
    });
  };
  element('removeBack').onclick = () => { project.back = null; project.uploadNames.back = ''; draw(); };
  element('demo').onclick = () => runTask(async () => {
    const sources = Config.createDemoIcons();
    for (const source of sources) await Files.loadImage(source);
    project.front = null;
    project.uploadNames.front = '';
    project.uploadNames.icons = [];
    project.icons = sources;
    renderTicketEditor();
    draw();
    message('Sample design restored. Sample icons will be used for the next batch.');
  });
  element('resetLayout').onclick = () => {
    const rules = Model.activeRules(project);
    project.layout = Config.createLayout(rules.winningCount, rules.ownCount);
    renderPositions();
    draw();
  };
  ['layout', 'ticket', 'preview'].forEach((name) => {
    element(name + 'Mode').onclick = () => setMode(name);
  });
  element('prev').onclick = () => goToTicket(-1);
  element('next').onclick = () => goToTicket(1);

  element('addImage').onclick = () => element('overlayFile').click();
  element('overlayFile').onchange = (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file || !project.result) return;
    runTask(async () => {
      const source = await Files.readImage(file);
      addOverlay({ id: newOverlayId(), type: 'image', src: source,
        name: file.name, x: 0.5, y: 0.5, width: 0.25 });
      message('Image added to this ticket. Drag it into place or use the position controls.');
    });
  };
  element('addText').onclick = () => runTask(async () => {
    addOverlay({ id: newOverlayId(), type: 'text', text: 'Your text',
      x: 0.5, y: 0.5, fontSize: 3, color: '#000000', fontFamily: project.settings.fontFamily });
    element('overlayText').focus();
  });
  const overlayInputs = {
    overlayX: ['x', 0.01, 0, 1],
    overlayY: ['y', 0.01, 0, 1],
    overlayWidth: ['width', 0.01, 0.02, 1],
    overlayFont: ['fontSize', 1, 1, 15]
  };
  for (const [id, [property, scale, minimum, maximum]] of Object.entries(overlayInputs)) {
    element(id).oninput = () => {
      const overlay = selectedOverlay();
      if (!overlay) return;
      overlay[property] = clamp(Number(element(id).value) * scale, minimum, maximum);
      afterManualEdit();
    };
  }
  element('overlayText').oninput = () => {
    const overlay = selectedOverlay();
    if (!overlay || overlay.type !== 'text') return;
    overlay.text = element('overlayText').value;
    renderOverlayList();
    afterManualEdit();
  };
  element('overlayFontFamily').oninput = () => {
    const overlay = selectedOverlay();
    if (!overlay || overlay.type !== 'text') return;
    overlay.fontFamily = element('overlayFontFamily').value;
    afterManualEdit();
  };
  element('overlayColor').oninput = () => {
    const overlay = selectedOverlay();
    if (!overlay || overlay.type !== 'text') return;
    overlay.color = element('overlayColor').value;
    afterManualEdit();
  };
  element('removeOverlay').onclick = () => {
    const edits = Model.getEdits(currentTicket());
    edits.overlays = edits.overlays.filter((item) => item.id !== selectedOverlayId);
    selectedOverlayId = null;
    renderOverlayList();
    syncOverlayControls();
    afterManualEdit();
  };
  element('bringForward').onclick = () => {
    const overlay = selectedOverlay();
    if (!overlay) return;
    const edits = Model.getEdits(currentTicket());
    edits.overlays = [...edits.overlays.filter((item) => item.id !== overlay.id), overlay];
    renderOverlayList();
    afterManualEdit();
  };
  element('resetTicket').onclick = () => runTask(async () => {
    if (!await confirmAction('Remove all manual edits from this ticket? Its original artwork and text will be restored.')) return;
    Model.resetTicket(currentTicket());
    selectedOverlayId = null;
    renderTicketEditor();
    afterManualEdit();
  });

  for (const [id, type] of [['exportSheet', 'sheet'], ['exportSingle', 'single'], ['exportBack', 'back']]) {
    element(id).onclick = () => runTask(async () => {
      message('Preparing PNG…');
      const exportType = activeSide === 'back' && type === 'sheet' ? 'back'
        : activeSide === 'back' && type === 'single' ? 'single-back' : type;
      await Export.png(project, ticketIndex, exportType);
      message('PNG downloaded with your edits. No guides or editing labels are included.');
    });
  }
  element('exportReport').onclick = () => runTask(async () => Export.report(project));
  element('saveProject').onclick = () => runTask(async () => {
    Files.download(new Blob([Model.serializeProject(project)], { type: 'application/json' }),
      'krasslut-project.json');
    message('Project saved, including the current batch and all manual edits.');
  });
  element('openProject').onclick = () => element('projectFile').click();
  element('projectFile').onchange = (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    runTask(async () => {
      const restored = Model.restoreProject(await Files.readProject(file));
      if (project.result?.tickets.some(Model.isEdited) &&
          !await confirmAction('Open this project and replace the current workspace? Save first to keep any unsaved edits.')) return;
      await Files.loadProjectImages(restored);
      project = restored;
      ticketIndex = 0;
      resultsPage = 0;
      editingNudeArea = false;
      element('editNudeArea').setAttribute('aria-pressed', 'false');
      syncSettings();
      renderPrizes();
      renderPositions();
      renderSummary();
      setSide('front');
      setMode(project.result ? 'ticket' : 'layout');
      message('Project opened. Manual edits and original recorded outcomes have been restored.');
    });
  };

  // Bestandsinputs blijven verborgen: de eigen bestandsnaamlabels komen uit het
  // opgeslagen project, ook na heropenen. Leegmaken van de input maakt herupload mogelijk.
  for (const [button, input] of [['chooseFront', 'front'], ['chooseBack', 'back'],
    ['chooseIcons', 'icons'], ['chooseNudes', 'nudes']]) {
    element(button).onclick = () => element(input).click();
  }
  element('nudes').onchange = (event) => {
    const files = [...event.target.files];
    event.target.value = '';
    if (!files.length) return;
    runTask(async () => {
      const added = [];
      for (const file of files) added.push({ src: await Files.readImage(file), name: file.name });
      const sources = new Set(project.nudes.map((image) => image.src));
      for (const image of added) {
        if (!sources.has(image.src)) { project.nudes.push(image); sources.add(image.src); }
      }
      draw();
      message('Nude images loaded for the next batch. Each Nude winner gets one saved image and no other prize.');
    });
  };
  element('clearNudes').onclick = () => { project.nudes = []; draw(); };
  element('frontTab').onclick = () => setSide('front');
  element('backTab').onclick = () => setSide('back');
  element('backShowNumber').onchange = () => {
    project.backSettings.showNumber = element('backShowNumber').checked;
    syncBackSettings();
    draw();
  };
  for (const [id, property, scale] of [['backX', 'x', 0.01], ['backY', 'y', 0.01],
    ['backFontSize', 'fontSize', 1]]) {
    element(id).oninput = () => {
      const value = Number(element(id).value) * scale;
      project.backSettings[property] = property === 'fontSize' ? clamp(value, 1, 15) : clamp(value, 0, 1);
      draw();
    };
  }
  for (const [id, property] of [['backColor', 'color'], ['backFontFamily', 'fontFamily']]) {
    element(id).oninput = () => { project.backSettings[property] = element(id).value; draw(); };
  }
  element('editNudeArea').onclick = () => {
    editingNudeArea = !editingNudeArea;
    element('editNudeArea').setAttribute('aria-pressed', String(editingNudeArea));
    setMode('layout');
  };
  for (const key of ['x', 'y', 'width', 'height']) {
    const id = 'nudeArea' + key[0].toUpperCase() + key.slice(1);
    element(id).oninput = () => {
      project.nudeArea[key] = clamp(Number(element(id).value) / 100,
        key === 'width' || key === 'height' ? 0.02 : 0, 1);
      keepNudeAreaOnTicket();
      syncNudeArea();
      draw();
    };
  }
  element('resultsFilter').onchange = () => { resultsPage = 0; renderResults(); };
  element('resultsPrev').onclick = () => { resultsPage--; renderResults(); };
  element('resultsNext').onclick = () => { resultsPage++; renderResults(); };

  // ---------- Start ----------
  runTask(async () => {
    await Files.loadProjectImages(project);
    populateFonts();
    syncSettings();
    renderPrizes();
    renderPositions();
    renderSummary();
    setMode('layout');
  });
})();
