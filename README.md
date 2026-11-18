# Fogyatékosság és foglalkoztatás Európában / Disability and employment in Europe

Kétnyelvű (magyar–angol) dashboard a fogyatékossággal élők becsült foglalkoztatási rátájáról az EU tagállamaiban.
Egyetlen statikus fájl (`index.html`), külső függőség nélkül.

## Közzététel GitHub Pages-en

1. Hozz létre egy új, nyilvános repót, és töltsd fel a mappa teljes tartalmát (a `.github` mappával együtt).
2. Settings → Pages → Source: „Deploy from a branch", Branch: `main`, mappa: `/ (root)`.
3. Az oldal néhány perc múlva elérhető: `https://<felhasználónév>.github.io/<repo>/`.
4. Megosztási előnézet (LinkedIn): az `og:image` sor a két HTML-fájlban a `https://daczip.github.io/disability-employment-eu/og-image.png`
   címre mutat; más repónévnél ezt is át kell írni.
5. Az automatikus adatfrissítéshez a munkafolyamat-fájlnak pontosan a `.github/workflows/update-data.yml` útvonalon kell lennie (a repó gyökerében).

Élő változat: https://daczip.github.io/disability-employment-eu/

## Módszer

Minden bemenő adat a 20–64 éves népességre vonatkozik, és az EU-SILC-ből származik:

| Jel | Eurostat-tábla | Tartalom |
|---|---|---|
| a | `hlth_silc_06` | a tevékenységükben korlátozottak aránya a foglalkoztatottak között |
| b | `hlth_silc_06` | a korlátozottak aránya a teljes népességben |
| G | `hlth_dlm200` | foglalkoztatási különbség (disability employment gap), enyhe, súlyos és együttes szintre |

- tartósan (enyhén vagy súlyosan) korlátozottak rátája: d = a × G × (1 − b) / (b − a)
- korlátozottság nélküliek rátája: n = d + G
- súlyosan, illetve enyhén korlátozottak rátája: n − G(súlyos), n − G(enyhe)
- a teljes népesség EU-SILC szerinti rátája: e = b × d + (1 − b) × n

A képlet abból következik, hogy d / e = a / b, és n − d = G.

**Kerekítés.** Az Eurostat az a és b arányt egy tizedesre közli. A ± érték a legnagyobb eltérés, ha a, b és G
kerekítése egyszerre a legrosszabb irányba hat (2025-ben az országok mediánja ±1,4, legfeljebb ±3,8 százalékpont).
Ahol b − a kisebb 1 százalékpontnál, a becslés nem készül el.

**Ellenőrzések** (a 2026. november 13-i adatokon, nők és férfiak együtt):
- A súlyosan korlátozottak rátája két független úton: n − G(súlyos), illetve e × a(súlyos) / b(súlyos).
  Az eltérés mediánja 0,5, 90. percentilise 1,25 százalékpont, ami a kerekítés nagyságrendjébe esik.
- A népességen belüli arány a két táblában (`hlth_silc_06`, `hlth_silc_12`): eltérés legfeljebb 0,3 pont.
- A 16–64 és a 20–64 évesek aránya a foglalkoztatottak között: medián eltérés 0,0, legfeljebb 0,5 pont.

**Ellenőrzés mikroadatokon.** Az EDE 2025-ös statisztikai jelentése (EU-SILC mikroadatok, 2016–2022) közvetlenül
számolt rátáival összevetve 187 ország-évben: a becslés átlagosan +0,66 százalékponttal magasabb, az eltérés mediánja
1,32, 90. percentilise 3,38 pont. Enyhén korlátozottak: +0,40; súlyosan korlátozottak: +1,64 (90. percentilis 5,42).
Magyarország: átlagosan +1,2 (−0,3 és +2,6 között). A legnagyobb eltérés (DK 2019, +10,2) közelítő „a” jelzésű érték.
Ezek a számok egyszeri összevetésből származnak, frissítéskor nem számolódnak újra.

**Miért nem a munkaerő-felmérés?** Ha a teljes foglalkoztatási rátát az LFS-ből (`lfsi_emp_a`) vennénk
(d = E − (1 − b) × G), a két felmérés eltérése a becslésbe kerülne: átlagosan +1,9, Magyarországon 2022-ben +5,3
százalékponttal. Az LFS-alapú értéket a táblázat összehasonlításként mutatja. Magyarországon a SILC-alapú
2022-es érték (47,3%) közel esik a népszámlálás súlyosan korlátozott 15–64 éveseinek 44%-os,
illetve a 16–64 évesekre számolt 46,5%-os foglalkoztatási arányához. A népszámlálás a Washington Group
kérdéssorával (hat alapvető tevékenység) méri a korlátozottságot, az EU-SILC a GALI-kérdéssel (szokásos tevékenységek),
ezért a két „súlyos” kategória nem azonos: a SILC-é jóval szűkebb (2022-ben 19,3%-os ráta).
Források: [KSH: Fogyatékosság és egészségi okból fakadó korlátozottság](https://www.ksh.hu/s/kiadvanyok/fogyatekossag-es-egeszsegi-okbol-fakado-korlatozottsag/assets/fogyatekossag-es-egeszsegi-okbol-fakado-korlatozottsag.pdf);
[Gárdos és mtsai, Statisztikai Szemle 2026/1](https://www.ksh.hu/statszemle_archive/all/2026/2026_01/2026_01_061.pdf).

**Korai évek.** A 20–64 éves bontás a `hlth_silc_06`-ban a legtöbb országban csak 2019-től vagy 2020-tól van.
Előtte az a értéke a 16–64 évesekből jön, a b értéke a `hlth_silc_12`-ből. A `hlth_silc_12` 20–64 éves aránya
2016-ra (Horvátország kivételével) nem elérhető, ezért öt korsáv (20–24, 25–34, 35–44, 45–54, 55–64) arányából
számoljuk, a `demo_pjangroup` népességével súlyozva, majd országonként a három legközelebbi év hivatalos és
közelített értékének átlagos eltérésével korrigáljuk. Az EU-27 2016-os értéke a tagállamok népességgel súlyozott
átlaga, ugyanígy korrigálva. Visszamenőleges próbán (2017 előrejelzése a 2018–2020-as eltérésből) a hiba mediánja
0,06, legnagyobb értéke 0,48 százalékpont volt. Minden ilyen közelítő érték „a” jelzést kap (ez nem Eurostat-jelzés).

**Adathibák.** Németország 2021-es súlyossági bontása az Eurostatnál hiányos (a súlyos és az együttes különbség
azonos, az enyhe hiányzik), ezért ott a súlyosan korlátozottak rátája nem jelenik meg.

## Akik nem dolgoznak (külön blokk, LFS)

Ez a blokk a munkaerő-felmérésből (LFS) származik, amely 2022 óta kétévente kérdez rá a korlátozottságra.
A számok az Eurostat táblái változtatás nélkül, és nem kerülnek be a fenti EU-SILC-becslésbe.

| Eurostat-tábla | Tartalom |
|---|---|
| `lfsa_argaeddl` | aktivitási ráta, 20–64 évesek, a korlátozottság szintje szerint |
| `lfsa_ipgaeddl` | a munkaerőpiacon kívüliek aránya (inaktivitási ráta) |
| `lfsa_urgaeddl` | munkanélküliségi ráta |
| `lfsa_sup_dl` | munkaerőpiaci tartalék (slack) és a dolgozni tudó, de nem kereső személyek, 15–74 évesek |
| `lfsa_egasdl` | foglalkoztatottak száma; ebből és a foglalkoztatási rátából adódik az LFS szerinti korlátozott arány |
| `hlth_silc_06` | (EU-SILC) a korlátozottak aránya a munkanélküliek, a nyugdíjasok és az egyéb inaktívak között, 20–64 évesek |

A foglalkoztatott és munkanélküli rész: aktivitási ráta × (1 − munkanélküliségi ráta), illetve a különbözet.
Ahol a munkanélküliségi ráta nem közölhető (kis minta), a sáv az aktív részt bontás nélkül mutatja.

**Miért külön?** Az LFS kérdése szűkebb kört azonosít korlátozottként: 2022-ben és 2024-ben 49 ország-évből 47-ben
kisebb az LFS szerinti arány, mint az EU-SILC-é (Magyarországon 2024-ben 6,7%, illetve 12,9%). Ahol az LFS-arány
a SILC-arány 70%-a alatt van (24 eset), az LFS szerinti foglalkoztatási ráta átlagosan 9,9 százalékponttal alacsonyabb
a becslésnél; ahol a két arány 15%-on belül van (9 eset), az eltérés mediánja 3,9 pont. Az oldal ezeket a
számokat az adatokból számolja, így frissítéskor maguktól változnak.

## Országprofilok (`orszagprofilok.html`)

Második lap a 27 tagállam rendszereiről: kvóta és hozzájárulás, szolgáltatások, védett foglalkoztatás, nemzeti cél,
reformok. A főoldal fejlécéből és a térkép melletti országkártyáról érhető el; a kiválasztott ország és a nyelv
a két lap között megmarad (`orszagprofilok.html#HU-hu`).

- A profilok szövege kézzel szerkesztett, a fájlba ágyazva (a `P` objektumban, magyarul és angolul). Nem frissül
  automatikusan; az állapot dátuma az oldal alján és a `UPDATED` változóban áll.
- A foglalkoztatási ráta a profil tetején a főoldal adataiból jön: ha a két lap ugyanarról a webhelyről töltődik be,
  az oldal megnyitáskor kiolvassa az `index.html` aktuális pillanatképét, így a havi adatfrissítést követi.
- Források: EDE-országjelentések (2024. novemberi állapot), DOTCOM (2025. október), nemzeti források; országonként
  kattintható listában. 2026 novemberében 24 ország kulcsadatait (bértámogatás, hozzájárulás, friss reformok) nemzeti
  forrásból ellenőriztük; a korábbi két „ellenőrzés alatt” pont (ciprusi ösztönző, román 127/2024. rendelet) lezárult.

## Foglalkoztatási ráta korcsoportonként (2026. november 18.)
Az „Akik nem dolgoznak” blokk új panele a korlátozottak és a nem korlátozottak foglalkoztatási rátáját mutatja 25–54 és 55–64 éves korban (összevetésül 20–64), országrangsorral és a kiválasztott ország korcsoportos táblájával. Forrás: `lfsa_argaeddl` (aktivitási ráta) és `lfsa_urgaeddl` (munkanélküliségi ráta), 2022 és 2024. Közvetlen, korcsoportos foglalkoztatási ráta fogyatékosság szerint nincs 2022/2024-re (a `hlth_dlm010` csak 2011), ezért a rátát az oldal számolja: aktivitási ráta × (1 − munkanélküliségi ráta); a kerekítés miatt legfeljebb néhány tized százalékpont az eltérés.
- 25 év alatt a korlátozottak munkanélküliségi rátája szinte mindenhol közölhetetlen (kis minta), ezért a fiatal korcsoport kimaradt.
- Hiányok: 25–54 évesek 2024: BG, MT (2022: BG, EL, MT); 55–64 évesek 2024: BG, EL, IE, LU, MT, RO, SK (2022: BG, IE, LV, MT, PL, RO, SK). Ezek „nincs adat”-ként jelennek meg.
- A frissítő szkript a korcsoportokat is letölti (`act.{SM_SEV|NONE}.{T|M|F}.{Y25-54|Y55-64}`, `unemp.…`), így a havi frissítés ezt a panelt is frissíti.

## Átlépés a nyílt munkaerőpiacra (2026. november 18.)

Minden országprofilban új blokk mutatja, van-e a védett foglalkoztatásból kivezető célzott eszköz (van: 11 ország; részleges, tervezett vagy megszűnt: 10; nem ismert: 6), és közölnek-e mért eredményt (9 ország). Források: EDE-országjelentések (2024), EDE-szintézis, valamint 14 országra célzott nemzeti forráskutatás. Az arányok eltérő módon mértek, ezért nem rangsoroljuk őket.

## Felület és akadálymentesség (2026. november 17.)

- Országprofil-oldal: kisebb nyitócím, szakaszugró sáv, a kulcsszámok kiemelt értékkel és külön magyarázó sorral, az elérhető eszközök tömör listában, a honlapok két csoportban (hatóságok, tematikus portálok), az összehasonlító tábla rögzített fejléccel és tömör/részletes nézettel.
- WCAG 2.2 AA: mindkét oldal axe-core 4.x ellenőrzésen 0 hibát ad világos és sötét módban, asztali és mobil méretben. Szövegkontraszt legalább 4,5:1, kezelőszervek szegélye legalább 3:1, „Ugrás a tartalomra” hivatkozás, tájékozódási pontok (landmark), billentyűzettel kezelhető térkép, 320 px szélességig vízszintes görgetés nélkül, az állapotjelek alakja is eltér (nem csak a színük).
- Ismert korlát: a profiloldal térképén a három modellt szín jelöli; ugyanez az információ szövegesen a táblázatban, az előnézetben és a képernyőolvasónak szánt címkékben is megvan.

## Tematikus honlapok az országprofilokban

A „Hová forduljon” blokk 2026 novemberétől 80 hivatalos és tematikus honlapot mutat (országonként 2–6), mindegyikhez egysoros magyar és angol leírással. A linkeket 2026. november 15–17. között élő böngészéssel ellenőriztük. Kimaradt négy elhagyott vagy eltérített domain (nrozp.sk, unie-pz.cz, sjh.dk, phare.irisnet.be). A portugál INR utódja az IDiPD (idipd.mtsss.gov.pt).

## Régiószűrő (mindkét lapon)

A felső sávban: Mind / Közép-Kelet / Észak / Nyugat / Dél. A besorolás az EU Kiadóhivatalának EuroVoc-tezauruszát követi:
Közép- és Kelet-Európa (BG, CZ, HR, HU, PL, RO, SI, SK), Észak-Európa (DK, EE, FI, LT, LV, SE), Nyugat-Európa (AT, BE, DE, FR,
IE, LU, NL), Dél-Európa (CY, EL, ES, IT, MT, PT). Az ENSZ M49-től eltér (ott HR és SI dél-, IE észak-európai, CY nyugat-ázsiai).
A `REG` objektumban módosítható (mindkét fájlban, a profiloldalnál a `work/prof/template.html`-ben); a régi `-C` hash-érték
automatikusan Közép-Keletre vált.

- Adatok lap: a térkép a régióra nagyít és a többi országot halványítja; a rangsorok, a változásdiagram, az inaktivitási
  rangsor és a táblázat csak a régió országait mutatja, mellettük a régió súlyozatlan átlagával (szaggatott vonal). Az EU-27
  átlag, a színskála és a felső sáv uniós helyezése nem változik.
- Országprofilok lap: a szűrő a modellszűrővel együtt hat a térképre, az összehasonlító táblára és a mátrixra.
- A választás a címben is megmarad (`index.html#HU-2025-T-hu-E`, `orszagprofilok.html#HU-hu-E`), és a két lap között átvivődik.

## Audit (2026. november 15.)

A pillanatkép minden értékét független számítással visszaellenőriztük a nyers Eurostat-fájlokból (SILC: 4 582, különbség: 2 520,
LFS: 4 719 érték, eltérés nélkül), az országprofilok számait pedig a forrásszövegekből. A javítások listája a projekt
`audit-jelentes-2026-11-15.md` dokumentumában van.

## Adatok frissítése

Az adatok az `index.html`-be ágyazva szerepelnek (`<!--DATA:START-->` és `<!--DATA:END-->` között).

- Kézzel, az Eurostat API-ból: `node scripts/update-data.mjs` (Node 18+), majd commit.
- Kézzel letöltött fájlokból: `node scripts/update-data.mjs --from <mappa>`. A mappában mind a tíz adatkészlet legyen
  (`lfsi_emp_a`, `hlth_dlm200`, `hlth_silc_12`, `hlth_silc_06`, `demo_pjangroup`, `lfsa_argaeddl`, `lfsa_ipgaeddl`,
  `lfsa_urgaeddl`, `lfsa_sup_dl`, `lfsa_egasdl`), TSV-ként vagy a Eurostat „SDMX-CSV” letöltéseként, a fájlnévben az
  adatkészlet kódjával (a Eurostat alapértelmezett neve, pl. `estat_lfsa_argaeddl_en.csv`, megfelel). A `hlth_silc_06`
  minden munkaerőpiaci státusszal kell (EMP, POP, UNE, RET, INAC_OTH).
- Csak ellenőrzés, írás nélkül: `--check`. A szkript minden futáskor kiírja, mennyire tér el a korsávos közelítés a hivatalos értékektől.
- Automatikusan: a `.github/workflows/update-data.yml` havonta lefut, és a repó Actions fülén kézzel is indítható.

Az induló pillanatkép a 2026. november 13-án letöltött Eurostat TSV-fájlokból készült, az LFS-blokk és a teljes
`hlth_silc_06` a 2026. november 15-én letöltött CSV-fájlokból, a frissítő szkripttel. A teljes `hlth_silc_06`-tal
újraszámolt korábbi értékek egyeztek (7 560 értékből 0 eltérés).

## Térkép

Az országhatárok a Natural Earth 1:50m közkincs adataiból készültek (world-atlas csomag), ETRS89-LAEA-hoz
hasonló területtartó vetületben, egyszerűsítve és az `index.html`-be ágyazva.

## Forrás

Eurostat. A becslés saját számítás, az Eurostat nem felel érte.
