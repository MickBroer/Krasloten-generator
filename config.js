/*
 * CONFIGURATIE — begin hier als je de standaardinstellingen wilt wijzigen.
 * De interface is Engels; de uitleg in de code is Nederlands.
 * Deze gewone scripts werken ook als je index.html rechtstreeks opent.
 */
(function (root) {
  'use strict';

  const DEFAULT_SETTINGS = {
    amount: 40,
    overlap: true,
    winningCount: 2,
    ownCount: 4,
    fontFamily: 'Arial',
    iconSize: 12,      // Percentage van de breedte van een lot.
    fontSize: 2.7,     // Ook als percentage van de breedte.
    textColor: '#000000',
    widthMM: 90,
    dpi: 300,
    columns: 4,
    gap: 3
  };

  const DEFAULT_PRIZES = [
    { name: 'Cigarette', chance: 20 },
    { name: 'Nude', chance: 5 },
    { name: 'Tampon', chance: 25 },
    { name: 'Free ticket', chance: 10 },
    { name: '€5', chance: 3 },
    { name: 'Boat', chance: 0 },
    { name: 'Friendship', chance: 0 }
  ];

  // Teksten op het meegeleverde voorbeeldontwerp.
  const SAMPLE_COPY = {
    title: 'GELUXXXZOEKER',
    winning: 'WINNING ICONS',
    own: 'YOUR ICONS',
    footer: 'Match an icon to win the prize beneath it.'
  };

  // Alleen lokale browser-/systeemlettertypen; er worden geen webfonts opgehaald.
  const FONTS = {
    Arial: 'Arial, Helvetica, sans-serif',
    Verdana: 'Verdana, Geneva, sans-serif',
    Georgia: 'Georgia, "Times New Roman", serif',
    'Times New Roman': '"Times New Roman", Times, serif',
    'Courier New': '"Courier New", Courier, monospace',
    'Trebuchet MS': '"Trebuchet MS", Arial, sans-serif',
    System: 'system-ui, -apple-system, "Segoe UI", sans-serif'
  };

  const DEFAULT_BACK_SETTINGS = {
    showNumber: false, x: 0.5, y: 0.9, fontSize: 3,
    color: '#000000', fontFamily: 'Arial'
  };

  function positionNames(winningCount = 2, ownCount = 4) {
    return [
      ...Array.from({ length: winningCount }, (_, i) => `Winning icon ${i + 1}`),
      ...Array.from({ length: ownCount }, (_, i) => `Your icon ${i + 1}`),
      ...Array.from({ length: ownCount }, (_, i) => `Prize ${i + 1}`)
    ];
  }

  // Aantallen passen automatisch in rijen. x/y zijn middelpuntcoördinaten (0..1).
  function createLayout(winningCount = 2, ownCount = 4) {
    const winningColumns = Math.min(6, winningCount);
    const winningRows = Math.ceil(winningCount / winningColumns);
    const ownColumns = Math.min(6, ownCount);
    const ownRows = Math.ceil(ownCount / ownColumns);
    const winning = Array.from({ length: winningCount }, (_, i) => ({
      x: winningCount === 2 ? 0.38 + i * 0.24 :
        0.1 + ((i % winningColumns) + 0.5) * 0.8 / winningColumns,
      y: winningRows === 1 ? 0.35 : 0.27 + (Math.floor(i / winningColumns) + 0.5) * 0.18 / winningRows
    }));
    const own = Array.from({ length: ownCount }, (_, i) => ({
      x: 0.1 + ((i % ownColumns) + 0.5) * 0.8 / ownColumns,
      y: ownRows === 1 ? 0.67 : 0.57 + (Math.floor(i / ownColumns) + 0.35) * 0.33 / ownRows
    }));
    const prizes = own.map((point) => ({
      x: point.x, y: ownRows === 1 ? 0.83 : point.y + 0.17 / ownRows
    }));
    return [...winning, ...own, ...prizes];
  }

  function createDemoIcons() {
    return ['★', '◆', '♥', '♣', '●', '▲', '☀', '✿'].map((shape) => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
          <rect x="6" y="6" width="148" height="148" rx="36" fill="#000000"/>
          <text x="80" y="109" font-size="95" text-anchor="middle"
                fill="#ffffff" font-family="Arial">${shape}</text>
        </svg>`;
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  const api = { DEFAULT_SETTINGS, DEFAULT_PRIZES, SAMPLE_COPY, FONTS, DEFAULT_BACK_SETTINGS,
    positionNames, createLayout, createDemoIcons };
  if (typeof module !== 'undefined') module.exports = api;
  else root.StudioConfig = api;
})(globalThis);
