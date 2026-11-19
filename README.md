# Wordsmith Royale Rumble

Bouw een strakke, moderne web- en mobiele game genaamd Synonym Royale (gebaseerd op puur tekst en interface, geen 2D/3D).

Core Gameplay:

Een 10-speler Engels synoniem-spel van 5 rondes (elk 20 seconden per ronde).

Spelers krijgen een Engels woord te zien en moeten een zo goed mogelijk synoniem typen.

Spelmodi:

Play vs Bots (1 vs 9): Direct starten, waarin 9 AI-bots automatisch meespelen. De bots zijn niet te sterk (gebruiken normale, alledaagse synoniemen en typen met een realistische vertraging).

Online Multiplayer: Een lobby waarin echte spelers worden gekoppeld. Als er na een korte wachttijd geen 10 echte spelers zijn, wordt de lobby automatisch aangevuld tot 10 spelers met de gebalanceerde bots.

Scoringssysteem: Punten worden toegekend op basis van de kwaliteit van het synoniem. Er is een 'uniqueness bonus' (+10 punten) als niemand anders in de ronde datzelfde synoniem heeft gekozen.

Ranglijsten (Leaderboards):

Een globaal scorebord met tabbladen om te schakelen tussen All-Time (totaalscore), Weekly (de beste spelers van deze week) en Daily (de dagelijkse top).

Naamfilter / Profanity Filter:

Een ingebouwd filter op het invoerveld voor de spelersnaam. Scheldwoorden, beledigingen en tekens zoals sterretjes (*, ****) worden automatisch gedetecteerd, geblokkeerd en vervangen door een nette foutmelding of standaardnaam, zodat spelers altijd een nette naam moeten kiezen. hetzelfde filter geldt voor de synoniemen

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wordsmith-royale-rumble.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ac9a253a-a1af-56ca-a7e8-f4885955f933).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
