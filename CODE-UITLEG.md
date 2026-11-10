# Zelf aanpassen: een wegwijzer

De app gebruikt gewone JavaScript. Je hoeft niets te installeren of te compileren. Open de map in Visual Studio Code, wijzig een bestand, sla het op en vernieuw de browser.

De interface blijft Engels; de opmerkingen in de code zijn Nederlands. Elk bestand heeft één duidelijke taak. `index.html` laadt de scripts onderaan in de juiste volgorde. Verander die volgorde niet zonder ook de afhankelijkheden te controleren.

## Waar verander ik wat?

| Wat wil je aanpassen? | Bestand | Waar begin je? |
| --- | --- | --- |
| Standaard titel, prijzen, oplage en tekstkleur | `config.js` | `SAMPLE_COPY`, `DEFAULT_PRIZES`, `DEFAULT_SETTINGS` |
| Standaard posities | `config.js` | `createLayout()` |
| Kleuren, lettertypen en afstanden van de interface | `style.css` | `:root` en de secties eronder |
| Teksten, knoppen en panelen in de pagina | `index.html` | De overeenkomstige HTML-sectie |
| Knopacties en de editor | `app.js` | Secties met `----------` |
| Hoe een lot wordt getekend | `render.js` | `paint()` en `drawSample()` |
| Hoekgrepen en proportioneel schalen | `geometry.js` | `corners()` en `resizeFromCorner()` |
| Hoe iconen en prijzen worden gekozen | `engine.js` | `generate()`, `quotas()` en `assignPrizes()` |
| Handmatige bewerkingen en projectgegevens | `model.js` | `getEdits()`, `setPrizeText()` en `restoreProject()` |
| Afbeeldingen laden of downloaden | `files.js` | `readImage()`, `loadProjectImages()` en `download()` |
| PNG-afmetingen en CSV | `export.js` | `sheetSize()`, `png()` en `report()` |

## Voorbeeld: de standaard titel veranderen

In `config.js` staat:

```js
const SAMPLE_COPY = {
  title: 'GELUXXXZOEKER',
  winning: 'WINNING ICONS',
  own: 'YOUR ICONS',
  footer: 'Match an icon to win the prize beneath it.'
};
```

Vervang alleen de tekst tussen de aanhalingstekens. Dit geldt voor het ingebouwde ontwerp. Een eigen PNG is één afbeelding; tekst daarin kun je alleen in je ontwerpprogramma veranderen. Een handmatig aangepaste titel op één lot blijft zijn eigen tekst gebruiken.

## Voorbeeld: een standaardprijs toevoegen

Voeg in `DEFAULT_PRIZES` een regel toe, bijvoorbeeld:

```js
{ name: 'Coffee', chance: 10 },
```

De komma scheidt deze prijs van de volgende. De som van de kansen mag maximaal 100% zijn zonder overlap, of 200% met overlap. Een prijs met `chance: 0` kan zichtbaar zijn maar wordt nooit gewonnen.

## Voorbeeld: kleuren wijzigen

Bovenaan `style.css` staan de variabelen voor de interface:

```css
--ink: #000000;
--paper: #ffffff;
--background: #f5f5f5;
--muted: #626262;
```

De grijstinten houden hulpkaders en tekst leesbaar zonder kleur te introduceren. De kleuren van het voorbeeldlot staan in `render.js`, bij `drawSample()`. De meegeleverde icoontjes staan in `config.js`, bij `createDemoIcons()`.

## Hoe de gegevens zijn opgebouwd

`project` is het hele werkdocument:

```js
project = {
  version: 3,
  front: null,        // Of een afbeelding als data-URL.
  back: null,
  backSettings: {}, // Nummer op de achterkant, positie en lettertype.
  nudes: [],         // Afbeeldingen voor de volgende generatie.
  nudeArea: {},      // Middelpunt, breedte en hoogte van het fotovak.
  uploadNames: {},   // Bestandsnamen blijven zichtbaar na laden.
  icons: [],         // Iconen voor de volgende generatie.
  prices: [],        // Prijzen voor de volgende generatie.
  layout: [],        // Posities voor alle loten.
  settings: {},      // Oplage, afmetingen, tekstgrootte, enzovoort.
  result: null       // Of de al gegenereerde serie.
};
```

De gegenereerde serie bewaart een eigen kopie van haar prijzen en iconen. Daarom verandert een bestaande serie niet als je links alvast nieuwe kansen invult.

Een oorspronkelijk lot ziet er bijvoorbeeld zo uit:

```js
{
  id: 1,
  winning: [0, 1],
  own: [
    { icon: 0, prize: 2 },
    { icon: 3, prize: 1 },
    { icon: 4, prize: 0 },
    { icon: 5, prize: 3 }
  ]
}
```

De getallen verwijzen naar een positie in een lijst, beginnend bij nul. `icon: 0` is dus het eerste icoon. `prize: 2` is de derde prijs. Alleen het eerste eigen icoon matcht hier; de oorspronkelijke uitslag is daardoor de derde prijs.

Handmatige veranderingen komen in een apart onderdeel:

```js
ticket.edits = {
  prizeTexts: { 0: 'My custom prize' },
  sampleCopy: { title: 'A personal title' },
  overlays: [
    {
      id: 'unique-item-id',
      type: 'image',
      src: 'data:image/png;base64,...',
      name: 'my-image.png',
      x: 0.5,
      y: 0.4,
      width: 0.25
    }
  ]
};
```

`x: 0.5` betekent midden op de breedte. `y: 0.4` betekent 40% vanaf de bovenkant. `width: 0.25` is 25% van de lotbreedte. De hoogte van een afbeelding volgt automatisch uit de verhoudingen van het bestand. Tekstlagen hebben in plaats van `src` en `width` de velden `text`, `fontSize` en `color`.

**Laat de oorspronkelijke `winning` en `own` ongemoeid bij visuele bewerkingen.** Alleen `edits` veranderen is voldoende. `engine.js` kijkt niet naar `edits`, zodat de geregistreerde prijzen gelijk blijven.

## Waarom het label niet op de PNG staat

“Manually edited” is een HTML-element naast het canvas in `index.html`. Het wordt getoond als `Model.isEdited(ticket)` waar is. `render.js` tekent alleen het ontwerp, de iconen, de teksten en de toegevoegde lagen. De PNG-export gebruikt precies diezelfde tekenfunctie, zonder de selectiehulpkaders.

## Wat gebeurt er bij opnieuw genereren?

De knop controleert eerst of de instellingen kloppen. Bij bewerkte loten verschijnt een bevestigingsvenster. Na bevestiging maakt `Model.createBatch(project)` nieuwe loten. Deze nieuwe objecten hebben geen `edits`. Annuleren laat de hele oude serie staan.

## Veilig uitproberen

1. Bewaar een kopie van de map en van een projectbestand.
2. Verander één ding tegelijk.
3. Sla op en vernieuw je browser.
4. Probeer een kleine serie en exporteer één PNG.
5. Wijzig je de spelregels of projectstructuur? Voer ook de tests uit:

```sh
node engine.test.cjs
node model.test.cjs
node features.test.cjs
node editor.test.cjs
```

Voor GitHub Pages moet je alle tien programmabestanden samen uploaden. Alleen de oude vier bestanden vervangen is voor deze versie niet genoeg. Zie `README.md` voor de lijst.


## Nieuwe instellingen in versie 3

`DEFAULT_SETTINGS` in `config.js` bevat nu ook `winningCount`, `ownCount` en `fontFamily`. De lijst `FONTS` koppelt zichtbare namen aan lokale CSS-lettertypefamilies. Lettertypevelden verwijzen altijd naar zo'n naam; er worden geen webfonts geladen.

`Config.createLayout(winningCount, ownCount)` maakt de posities. De lijst is als volgt opgebouwd:

1. Alle winnende iconen.
2. Alle eigen iconen.
3. Alle bijbehorende prijsteksten.

De positie van de eerste prijstekst is dus `winningCount + ownCount`, niet meer een vast getal zoals 6. `Model.activeRules(project)` geeft de aantallen van de huidige serie. `Model.requestedRules(project)` geeft de instellingen voor de volgende serie. Houd deze twee gescheiden wanneer er al loten bestaan.

## De exclusieve afbeeldingsprijs

`Engine.nudePrizeIndex(prizes)` herkent de prijs met de naam `Nude`, ongeacht hoofdletters. Wil je een andere speciale naam gebruiken, verander dan deze functie en pas ook de uitleg in de interface aan.

`quotas()` reserveert de aantallen van deze prijs en controleert of de andere kansen op de overige loten passen. `assignPrizes()` houdt die loten buiten de gewone overlapverdeling. `analyze()` controleert achteraf dat een Nude-winnaar geen tweede prijs heeft.

`Model.createBatch()` bewaart de afbeeldingscollectie in `result.nudes` en kiest voor iedere Nude-winnaar een `ticket.nudeIndex`. `render.js` zoekt hiermee het gekozen bestand op. De keuze wordt dus niet tijdens tekenen of exporteren opnieuw gemaakt.

`project.nudeArea` heeft deze vorm:

```js
{ x: 0.5, y: 0.75, width: 0.8, height: 0.32 }
```

Alle waarden zijn verhoudingen van het lot. x en y zijn het middelpunt. In `render.js` gebruikt `nudeBounds()` dit vooraf gekozen vak. `fitImage()` laat de volledige afbeelding passend zien; winnende iconen worden daarna getekend. Op een Nude-lot slaat `paint()` de eigen iconen en hun prijsteksten over. De vakinstellingen gelden voor alle Nude-winnaars, niet voor de hele voorkant.

## Proportioneel vergroten via hoeken

`geometry.js` bevat alleen rekenwerk en kan los worden getest. De vier hoeken worden berekend uit de huidige afbeeldingsrechthoek. Bij het indrukken van een hoek bewaart `app.js` de oorspronkelijke rechthoek en hoek in `resizeGesture`.

Tijdens de pointerbeweging berekent `resizeFromCorner()` de nieuwe breedte en het middelpunt. De verhouding komt altijd van de bronafbeelding. De breedte in het invoermenu en de preview gebruiken dezelfde `overlay.width`; er is geen aparte exportbreedte. Tekstlagen hebben geen hoekgrepen; daar gebruik je de tekstgrootte-instelling.

## Achterkant en nummering

`project.backSettings` bevat `showNumber`, `x`, `y`, `fontSize`, `color` en `fontFamily`. De functie `paintBack()` wordt zowel door de preview als de export gebruikt. Het nummer komt uit `ticket.id`; de oplage komt uit de opgeslagen serie. Het wordt niet afgeleid van de pagina in het uitslagenoverzicht.

`Model.hasBack()` is waar als er een achtergrondsafbeelding is of als nummering aanstaat. Daardoor werkt een blanco achterkant met alleen een nummer ook. De uitslagen zelf worden niet op de achterkant getekend.

## Uitslagen en bestandsnamen

`renderResults()` in `app.js` maakt het filterbare overzicht met 50 loten per pagina. Het gebruikt `Model.recordedPrizes()` zodat handmatig aangepaste tekst de oorspronkelijke uitslag niet verandert.

De native file-inputs zijn verborgen. Gewone knoppen openen ze en `updateFileNames()` toont namen uit `project.uploadNames` en de afbeeldingscollecties. Het leegmaken van een native input maakt herupload van hetzelfde bestand mogelijk; de zichtbare bestandsnaam verdwijnt daardoor niet meer.

## Oudere projecten

`Model.restoreProject()` zet versie 1 en 2 om naar versie 3. Bestaande oude series krijgen `rules.nudeExclusive = false`, zodat hun oorspronkelijke uitkomsten geldig blijven. Nieuwe series gebruiken `true`. Zo kunnen oude projecten worden geopend zonder de aantallen of handmatige bewerkingen te veranderen.
