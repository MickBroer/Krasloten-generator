/*
 * LOTGENERATOR — rekent de prijzen uit, kiest iconen en controleert de uitslag.
 * Deze code kent de interface en handmatige bewerkingen niet.
 */
(function (root) {
  'use strict';

  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function rulesFor(rules = {}) {
    const result = { winningCount: 2, ownCount: 4, nudeExclusive: true, ...rules };
    if (!Number.isInteger(result.winningCount) || result.winningCount < 1 || result.winningCount > 12 ||
        !Number.isInteger(result.ownCount) || result.ownCount < 1 || result.ownCount > 24 ||
        typeof result.nudeExclusive !== 'boolean') {
      throw Error('Choose 1–12 winning icons and 1–24 of your own icons.');
    }
    return result;
  }

  function nudePrizeIndex(prizes) {
    return prizes.findIndex((prize) => prize.name.trim().toLowerCase() === 'nude');
  }

  function capacityFor(overlap, rules) {
    const { winningCount, ownCount } = rulesFor(rules);
    return overlap ? Math.min(winningCount, ownCount) : 1;
  }

  // Grootste-restmethode, met exclusieve plaatsen gereserveerd voor Nude.
  // Bij afronding proberen we beide naburige aantallen Nude-winsten; zo ontstaan
  // ook bij kleine oplages geen onmogelijke combinaties of verborgen extra prijzen.
  function quotas(amount, prizes, overlap, options = {}) {
    const rules = rulesFor(options);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
      throw Error('Choose between 1 and 10,000 tickets.');
    }
    if (!Array.isArray(prizes) || !prizes.length || prizes.some((prize) =>
      typeof prize.name !== 'string' || !prize.name.trim() ||
      !Number.isFinite(prize.chance) || prize.chance < 0 || prize.chance > 100
    )) {
      throw Error('Give each prize a name and a percentage between 0 and 100.');
    }
    if (new Set(prizes.map((prize) => prize.name.trim().toLowerCase())).size !== prizes.length) {
      throw Error('Use distinct prize names.');
    }
    const capacity = capacityFor(overlap, rules);
    const exclusive = rules.nudeExclusive ? nudePrizeIndex(prizes) : -1;
    const nudeChance = exclusive < 0 ? 0 : prizes[exclusive].chance;
    const availablePercent = 100 - nudeChance;
    const regular = prizes.map((_, index) => index).filter((index) => index !== exclusive);
    const regularTotal = regular.reduce((sum, index) => sum + prizes[index].chance, 0);
    if (regular.some((index) => prizes[index].chance > availablePercent + 1e-8) ||
        regularTotal > availablePercent * capacity + 1e-8) {
      throw Error(`These odds do not fit: Nude wins alone; other prizes share the remaining ${availablePercent}% of tickets, with at most ${capacity} prizes per ticket.`);
    }

    const raw = prizes.map((prize) => amount * prize.chance / 100);
    const target = Math.round(raw.reduce((sum, count) => sum + count, 0));
    const rawExclusive = exclusive < 0 ? 0 : raw[exclusive];
    const candidates = [...new Set([Math.floor(rawExclusive), Math.ceil(rawExclusive)])];
    let best = null;
    for (const exclusiveCount of candidates) {
      const available = amount - exclusiveCount;
      const counts = raw.map((value, index) => index === exclusive ? exclusiveCount :
        Math.min(Math.floor(value), available));
      const upper = raw.map((value) => Math.min(Math.ceil(value), available));
      const floorTotal = regular.reduce((sum, index) => sum + counts[index], 0);
      const ceilingTotal = Math.min(available * capacity,
        regular.reduce((sum, index) => sum + upper[index], 0));
      const wanted = target - exclusiveCount;
      if (wanted < floorTotal || wanted > ceilingTotal) continue;
      const priority = [...regular].sort((a, b) =>
        (raw[b] - counts[b]) - (raw[a] - counts[a]) || a - b);
      let remaining = wanted - floorTotal;
      for (const index of priority) {
        if (remaining > 0 && counts[index] < upper[index] && prizes[index].chance > 0) {
          counts[index]++;
          remaining--;
        }
      }
      if (remaining) continue;
      const error = counts.reduce((sum, count, index) => sum + (count - raw[index]) ** 2, 0);
      // Bij gelijke afwijking heeft de eerder ingevoerde prijs voorrang.
      const firstDifference = best ? counts.findIndex((count, i) => count !== best.counts[i]) : -1;
      if (!best || error < best.error - 1e-8 ||
          (Math.abs(error - best.error) < 1e-8 && firstDifference >= 0 &&
            counts[firstDifference] > best.counts[firstDifference])) best = { counts, error };
    }
    if (!best) throw Error('These percentages cannot be rounded to a valid batch. Increase the batch size or adjust the odds.');
    return best.counts;
  }

  // Lees uitsluitend de gegenereerde iconen en prijsnummers, nooit de bewerklaag.
  function winningPrizes(ticket) {
    return ticket.own
      .filter((item) => ticket.winning.includes(item.icon))
      .map((item) => item.prize);
  }

  function combinationKey(ticket) {
    return JSON.stringify([
      [...ticket.winning].sort((a, b) => a - b),
      ticket.own.map((item) => [item.icon, item.prize]).sort((a, b) => a[0] - b[0])
    ]);
  }

  function analyze(tickets, prizes, overlap, iconCount, options = {}) {
    const rules = rulesFor(options);
    const capacity = capacityFor(overlap, rules);
    const exclusive = rules.nudeExclusive ? nudePrizeIndex(prizes) : -1;
    const counts = prizes.map(() => 0);
    const histogram = Array(capacity + 1).fill(0);
    const combinations = new Set();
    const ticketIds = new Set();
    const isIcon = (value) => Number.isInteger(value) && value >= 0 && value < iconCount;

    for (const ticket of tickets) {
      if (!Number.isInteger(ticket.id) || ticket.id < 1 || ticketIds.has(ticket.id) ||
          !Array.isArray(ticket.winning) || ticket.winning.length !== rules.winningCount ||
          !Array.isArray(ticket.own) || ticket.own.length !== rules.ownCount ||
          new Set(ticket.winning).size !== rules.winningCount ||
          new Set(ticket.own.map((item) => item.icon)).size !== rules.ownCount ||
          !ticket.winning.every(isIcon) ||
          ticket.own.some((item) => !isIcon(item.icon) ||
            !Number.isInteger(item.prize) || item.prize < 0 || item.prize >= prizes.length)) {
        throw Error('The batch contains an invalid ticket.');
      }
      ticketIds.add(ticket.id);
      const won = winningPrizes(ticket);
      if (won.length > capacity || new Set(won).size !== won.length ||
          (won.includes(exclusive) && won.length !== 1)) {
        throw Error('The batch contains invalid prize overlap.');
      }
      won.forEach((prize) => counts[prize]++);
      histogram[won.length]++;
      combinations.add(combinationKey(ticket));
    }
    return { counts, histogram, duplicates: tickets.length - combinations.size };
  }

  function assignPrizes(amount, counts, capacity, exclusive, random) {
    const assignments = Array.from({ length: amount }, () => []);
    const order = shuffle(assignments.map((_, index) => index), random);
    const reserved = exclusive < 0 ? 0 : counts[exclusive];
    order.slice(0, reserved).forEach((index) => assignments[index].push(exclusive));
    const available = order.slice(reserved);

    counts.map((count, prize) => ({ count, prize }))
      .filter(({ prize }) => prize !== exclusive)
      .sort((a, b) => b.count - a.count)
      .forEach(({ count, prize }) => {
        const candidates = shuffle(available, random)
          .sort((a, b) => assignments[a].length - assignments[b].length);
        candidates.slice(0, count).forEach((index) => assignments[index].push(prize));
      });

    // Alleen gewone winsten verplaatsen: een Nude-lot blijft altijd exclusief.
    for (let attempt = 0; attempt < available.length * 30; attempt++) {
      const from = available[Math.floor(random() * available.length)];
      const to = available[Math.floor(random() * available.length)];
      if (from === to || !assignments[from].length) continue;
      const position = Math.floor(random() * assignments[from].length);
      const prize = assignments[from][position];
      if (assignments[to].length < capacity && !assignments[to].includes(prize)) {
        assignments[from].splice(position, 1);
        assignments[to].push(prize);
      }
    }
    return assignments;
  }

  function generate(amount, prizes, overlap, iconCount, random = Math.random, options = {}) {
    const rules = rulesFor(options);
    const requiredIcons = rules.winningCount + rules.ownCount;
    if (!Number.isInteger(iconCount) || iconCount < requiredIcons) {
      throw Error(`Load at least ${requiredIcons} different icons for these two groups.`);
    }
    const targetCounts = quotas(amount, prizes, overlap, rules);
    const assignments = assignPrizes(amount, targetCounts, capacityFor(overlap, rules),
      rules.nudeExclusive ? nudePrizeIndex(prizes) : -1, random);
    const iconUse = Array(iconCount).fill(0);
    const fillerUse = prizes.map(() => 0);
    const iconIndices = Array.from({ length: iconCount }, (_, index) => index);
    const prizeIndices = prizes.map((_, index) => index);
    const seen = new Set();

    const tickets = assignments.map((wins, index) => {
      let ticket;
      let key;
      let candidateFillerUse;

      // Probeer een andere combinatie als deze al in de serie voorkomt.
      for (let attempt = 0; attempt < 80; attempt++) {
        candidateFillerUse = [...fillerUse];
        const pool = shuffle(iconIndices, random).sort((a, b) => iconUse[a] - iconUse[b]);
        const winning = pool.slice(0, rules.winningCount);
        const matching = shuffle(winning, random).slice(0, wins.length);
        const ownIcons = shuffle([...matching, ...pool.slice(rules.winningCount, requiredIcons - wins.length)], random);
        const prizeOrder = shuffle(wins, random);
        let nextWin = 0;

        const own = ownIcons.map((icon) => {
          if (winning.includes(icon)) return { icon, prize: prizeOrder[nextWin++] };
          const prize = shuffle(prizeIndices, random)
            .sort((a, b) => candidateFillerUse[a] - candidateFillerUse[b])[0];
          candidateFillerUse[prize]++;
          return { icon, prize };
        });

        ticket = { id: index + 1, winning, own };
        key = combinationKey(ticket);
        if (!seen.has(key)) break;
      }
      seen.add(key);
      candidateFillerUse.forEach((count, prize) => { fillerUse[prize] = count; });
      [...ticket.winning, ...ticket.own.map((item) => item.icon)]
        .forEach((icon) => iconUse[icon]++);
      return ticket;
    });

    const summary = analyze(tickets, prizes, overlap, iconCount, rules);
    if (summary.counts.some((count, index) => count !== targetCounts[index])) {
      throw Error('Internal check: prize distribution mismatch.');
    }
    return { tickets, ...summary };
  }

  const api = { generate, quotas, analyze, winningPrizes, rulesFor, nudePrizeIndex, capacityFor };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Lottery = api;
})(globalThis);
