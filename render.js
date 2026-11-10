/*
 * TEKENEN — dezelfde functie tekent de preview en de uiteindelijke PNG.
 * Selectiekaders worden apart getekend. Het 'Manually edited'-label staat
 * uitsluitend in HTML, dus kan nooit in een geëxporteerd lot terechtkomen.
 */
(function (root) {
  'use strict';
  const Config = root.StudioConfig;
  const Model = root.StudioModel;
  const Files = root.StudioFiles;

  function dimensions(project) {
    const front = Files.getImage(project.front);
    return front ? { width: front.naturalWidth, height: front.naturalHeight }
      : { width: 1000, height: 650 };
  }

  function fitImage(context, image, x, y, width, height) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawnWidth = image.naturalWidth * scale;
    const drawnHeight = image.naturalHeight * scale;
    context.drawImage(image, x + (width - drawnWidth) / 2,
      y + (height - drawnHeight) / 2, drawnWidth, drawnHeight);
  }

  function drawSample(context, project, ticket, width, height) {
    const family = Config.FONTS[project.settings.fontFamily];
    const copy = { ...Config.SAMPLE_COPY, ...ticket.edits?.sampleCopy };
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#000000';
    context.fillRect(0, 0, width, height * 0.19);
    context.fillStyle = '#ffffff';
    context.font = `700 ${width * 0.047}px ${family}`;
    context.fillText(copy.title, width / 2, height * 0.12, width * 0.92);
    context.fillStyle = '#000000';
    context.font = `600 ${width * 0.018}px ${family}`;
    context.fillText(copy.winning, width / 2, height * 0.24, width * 0.92);
    context.fillText(copy.own, width / 2, height * 0.53, width * 0.92);
    context.font = `${width * 0.014}px ${family}`;
    context.fillText(copy.footer, width / 2, height * 0.95, width * 0.92);
  }

  function overlayBounds(overlay, width, height) {
    let itemWidth;
    let itemHeight;
    if (overlay.type === 'image') {
      const image = Files.getImage(overlay.src);
      itemWidth = overlay.width * width;
      itemHeight = itemWidth * image.naturalHeight / image.naturalWidth;
    } else {
      const fontPixels = width * overlay.fontSize / 100;
      itemWidth = width * 0.90;
      itemHeight = Math.max(1, overlay.text.split('\n').length) * fontPixels * 1.25;
    }
    return {
      x: overlay.x * width - itemWidth / 2,
      y: overlay.y * height - itemHeight / 2,
      width: itemWidth,
      height: itemHeight
    };
  }

  function drawOverlay(context, overlay, width, height) {
    const bounds = overlayBounds(overlay, width, height);
    if (overlay.type === 'image') {
      context.drawImage(Files.getImage(overlay.src), bounds.x, bounds.y, bounds.width, bounds.height);
      return;
    }
    const fontPixels = width * overlay.fontSize / 100;
    context.font = `600 ${fontPixels}px ${Config.FONTS[overlay.fontFamily]}`;
    context.fillStyle = overlay.color;
    context.textBaseline = 'middle';
    overlay.text.split('\n').forEach((line, index) => {
      context.fillText(line, overlay.x * width,
        bounds.y + (index + 0.5) * fontPixels * 1.25, bounds.width);
    });
  }

  function iconSize(project, index, width, height) {
    const rules = Model.activeRules(project);
    const isWinning = index < rules.winningCount;
    const count = isWinning ? rules.winningCount : rules.ownCount;
    const columns = Math.min(6, count);
    const rows = Math.ceil(count / columns);
    const requested = width * project.settings.iconSize / 100;
    const columnLimit = width * 0.8 / columns * 0.85;
    const rowLimit = rows === 1 ? Infinity :
      height * (isWinning ? 0.18 : 0.33) / rows * (isWinning ? 0.85 : 0.5);
    return Math.min(requested, columnLimit, rowLimit);
  }

  function prizeStyle(project, width, height) {
    const { ownCount } = Model.activeRules(project);
    const columns = Math.min(6, ownCount);
    const rows = Math.ceil(ownCount / columns);
    return {
      width: width * 0.8 / columns * 0.95,
      fontSize: Math.min(width * project.settings.fontSize / 100,
        rows === 1 ? Infinity : height * 0.33 / rows * 0.22)
    };
  }

  function layoutBounds(project, index, width, height) {
    const rules = Model.activeRules(project);
    const position = project.layout[index];
    const isIcon = index < rules.winningCount + rules.ownCount;
    const style = prizeStyle(project, width, height);
    const itemWidth = isIcon ? iconSize(project, index, width, height) : style.width;
    const itemHeight = isIcon ? itemWidth : style.fontSize * 1.4;
    return { x: position.x * width - itemWidth / 2, y: position.y * height - itemHeight / 2,
      width: itemWidth, height: itemHeight };
  }

  // De gebruiker bepaalt vooraf het afbeeldingsvak; nooit het hele lot.
  function nudeBounds(project, width, height) {
    const area = project.nudeArea;
    return { x: (area.x - area.width / 2) * width,
      y: (area.y - area.height / 2) * height,
      width: area.width * width, height: area.height * height };
  }

  function paint(context, project, ticket, width, height) {
    context.save();
    context.clearRect(0, 0, width, height);
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    if (project.front) context.drawImage(Files.getImage(project.front), 0, 0, width, height);
    else drawSample(context, project, ticket, width, height);

    const rules = Model.activeRules(project);
    const icons = project.result?.icons || project.icons;
    const prizes = project.result?.prices || project.prices;
    const nude = project.result?.nudes[ticket.nudeIndex];
    if (nude) {
      const box = nudeBounds(project, width, height);
      // Volledig zichtbaar, zonder vervorming of afsnijden. De iconen eronder
      // worden niet getekend; de foto is geen nieuwe speluitkomst.
      fitImage(context, Files.getImage(nude.src), box.x, box.y, box.width, box.height);
    }

    const iconLimit = nude ? rules.winningCount : rules.winningCount + rules.ownCount;
    for (let index = 0; index < iconLimit; index++) {
      const icon = index < rules.winningCount ? ticket.winning[index] :
        ticket.own[index - rules.winningCount].icon;
      const image = Files.getImage(icons[icon]);
      const bounds = layoutBounds(project, index, width, height);
      if (image) fitImage(context, image, bounds.x, bounds.y, bounds.width, bounds.height);
    }

    if (!nude) {
      const style = prizeStyle(project, width, height);
      context.textBaseline = 'middle';
      context.fillStyle = project.settings.textColor;
      context.font = `600 ${style.fontSize}px ${Config.FONTS[project.settings.fontFamily]}`;
      for (let slot = 0; slot < rules.ownCount; slot++) {
        const position = project.layout[rules.winningCount + rules.ownCount + slot];
        context.fillText(Model.visiblePrize(ticket, slot, prizes),
          position.x * width, position.y * height, style.width);
      }
    }
    for (const overlay of ticket.edits?.overlays || []) drawOverlay(context, overlay, width, height);
    context.restore();
  }

  function paintBack(context, project, ticket, width, height) {
    context.save();
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    if (project.back) fitImage(context, Files.getImage(project.back), 0, 0, width, height);
    const settings = project.backSettings;
    if (settings.showNumber) {
      const amount = project.result?.amount || project.settings.amount;
      context.fillStyle = settings.color;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `600 ${width * settings.fontSize / 100}px ${Config.FONTS[settings.fontFamily]}`;
      context.fillText(`${ticket.id || 1} / ${amount}`, settings.x * width, settings.y * height, width * 0.9);
    }
    context.restore();
  }

  function drawGuide(context, bounds, selected) {
    context.save();
    // Een dubbele zwart-witte lijn is zichtbaar op lichte én donkere ontwerpen.
    context.setLineDash(selected ? [] : [6, 4]);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 4;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle = '#000000';
    context.lineWidth = selected ? 2 : 1;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.restore();
  }

  function drawHandles(context, bounds, size = 16) {
    for (const corner of root.StudioGeometry.corners(bounds)) {
      context.fillStyle = '#ffffff';
      context.strokeStyle = '#000000';
      context.lineWidth = 2;
      context.fillRect(corner.x - size / 2, corner.y - size / 2, size, size);
      context.strokeRect(corner.x - size / 2, corner.y - size / 2, size, size);
    }
  }

  root.StudioRender = { dimensions, fitImage, paint, paintBack, overlayBounds,
    layoutBounds, nudeBounds, drawGuide, drawHandles };
})(globalThis);
