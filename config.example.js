// Zkopíruj jako config.js (ten je v .gitignore) a doplň vlastní hodnoty.
// Soubor patří na Kindle vedle calendar.html.
var EVENTS_URL = 'https://kindle-cal.YOUR-SUBDOMAIN.workers.dev/events.js';
var EVENTS_TOKEN = 'same-value-as-ACCESS_TOKEN-secret';

// --- Odjezdy MHD (volitelné; bez nich platí tyto výchozí hodnoty) ---
// Jeden záznam = jeden řádek tabulky. Klíče:
//   line       číslo linky (povinné)
//   direction  1 nebo 2 - stabilní směr podle Wiener Linien (2 = do centra u St. Marx)
//   towards    část názvu cílové stanice, na velikosti písmen nezáleží
// Pozor: cíl se mění (71 do centra jezdí do Schottenring U, ale část spojů jen do
// Schwarzenbergplatz), proto je u 18 a 71 lepší `direction` než `towards`.
var DEPARTURE_FILTER = [
    { line: '18', direction: 1 },
    { line: '18', direction: 2 },
    { line: '71', direction: 2 },
    { line: '74A', towards: 'Stubentor' }
];

// Odjezdy dříve než za tolik minut se nezobrazí (kolik minut trvá cesta na zastávku).
var DEPARTURE_MIN_MINUTES = 0;
