/* EXPORT — printafmetingen, PNG-bestanden en het oorspronkelijke prijzenoverzicht. */
(function (root) {
  'use strict';
  const Model = root.StudioModel;
  const Render = root.StudioRender;
  const Files = root.StudioFiles;

  function sheetSize(project, single = false) {
    Model.validateSettings(project.settings);
    const settings = project.settings;
    const design = Render.dimensions(project);
    const width = Math.round(settings.widthMM / 25.4 * settings.dpi);
    const height = Math.round(width * design.height / design.width);
    const gap = Math.round(settings.gap / 25.4 * settings.dpi);
    const amount = single ? 1 : project.result?.tickets.length || settings.amount;
    const columns = single ? 1 : Math.min(settings.columns, amount);
    const rows = Math.ceil(amount / columns);
    return { width, height, gap, columns, rows,
      sheetWidth: columns * width + (columns - 1) * gap,
      sheetHeight: rows * height + (rows - 1) * gap };
  }

  async function png(project, ticketIndex, type) {
    if (!project.result) throw Error('Generate a batch first.');
    const isSingle = type === 'single' || type === 'single-back';
    const isBack = type === 'back' || type === 'single-back';
    if (isBack && !Model.hasBack(project)) throw Error('Load a back design or enable the series number first.');
    const size = sheetSize(project, isSingle);
    if (size.sheetWidth > 16000 || size.sheetHeight > 16000 ||
        size.sheetWidth * size.sheetHeight > 60000000) {
      throw Error('This sheet is too large. Reduce the resolution or batch size, or export one ticket.');
    }

    const output = document.createElement('canvas');
    output.width = size.sheetWidth;
    output.height = size.sheetHeight;
    const context = output.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, output.width, output.height);
    const tile = document.createElement('canvas');
    tile.width = size.width;
    tile.height = size.height;
    const tileContext = tile.getContext('2d');
    const tickets = isSingle ? [project.result.tickets[ticketIndex]] : project.result.tickets;

    for (let index = 0; index < tickets.length; index++) {
      if (isBack) {
        Render.paintBack(tileContext, project, tickets[index], size.width, size.height);
      } else {
        // paint() neemt handmatige bewerkingen mee, maar bevat geen UI-labels.
        Render.paint(tileContext, project, tickets[index], size.width, size.height);
      }
      context.drawImage(tile, (index % size.columns) * (size.width + size.gap),
        Math.floor(index / size.columns) * (size.height + size.gap));
      if (index % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const blob = await new Promise((resolve) => output.toBlob(resolve, 'image/png'));
    if (!blob) throw Error('The browser could not export this sheet. Choose a smaller size.');
    const fileName = isSingle
      ? `scratch-card-${String(tickets[0].id).padStart(4, '0')}${isBack ? '-back' : ''}.png`
      : isBack ? 'scratch-cards-backs.png' : 'scratch-cards-fronts.png';
    Files.download(blob, fileName);
  }

  function report(project) {
    if (!project.result) throw Error('Generate a batch first.');
    const batch = project.result;
    const rows = [
      ['Ticket number', 'Original prizes won', 'Manually edited'],
      ...batch.tickets.map((ticket) => [
        ticket.id,
        Model.recordedPrizes(ticket, batch.prices).join(' + ') || 'No prize',
        Model.isEdited(ticket) ? 'Yes' : 'No'
      ])
    ];
    // Voorkom dat zelf ingevoerde tekst als spreadsheetformule wordt uitgevoerd.
    const cell = (value) => '"' + String(value)
      .replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
    const csv = '\ufeff' + rows.map((row) => row.map(cell).join(';')).join('\r\n');
    Files.download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'private-prize-report.csv');
  }

  root.StudioExport = { sheetSize, png, report };
})(globalThis);
