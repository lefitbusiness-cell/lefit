import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Distinct products catalog, explicitly differentiating items from the SAME brand (Ferrero, Mars, Mondelez, etc.)
const KNOWN_LEFIT_PRODUCTS: Record<string, any> = {
  // --- FERRERO BRAND PRODUCTS ---
  bueno: {
    productName: 'Kinder Bueno',
    brand: 'Ferrero',
    category: 'Knusprig gefüllter Waffelriegel mit Haselnuss-Milchcreme',
    healthCheck: 'Industriezucker pur und raffiniertes Palmöl treiben den Blutzucker in Sekunden nach oben und stürzen dich direkt in den nächsten Heißhunger-Crash. Die knusprige Waffel liefert keinerlei Mikronährstoffe, dafür über 30g reinen Zucker auf 100g.',
    portionTip: 'Maximal 1 Einzelriegel (21,5g = ca. 122 kcal) – und das ausschließlich ca. 40 Minuten vor einem schweren Beintraining als schneller Carbs-Push, niemals abends auf der Couch!',
    cleanRecipe: {
      title: 'LEFIT Clean Bueno Crisps',
      subtitle: '100% Natürlich • Ohne Palmöl • Knusprig & Proteinreich',
      prepTime: '15 Min. (+ 20 Min. Kühlen)',
      difficulty: 'Einfach',
      servings: '4 Riegel',
      macros: {
        calories: '185 kcal / Riegel',
        protein: '9g',
        carbs: '12g',
        fat: '11g',
        fiber: '3.5g'
      },
      comparison: '70% weniger Zucker, 3x mehr Protein, 100% pure Haselnuss-Kraft statt billigem Palmöl',
      ingredients: [
        '80g geröstetes Haselnussmus (100% reine Haselnüsse, ohne Zusatzstoffe)',
        '30g Bio-Mandelmehl oder feine Haferkleie',
        '25g Whey- oder veganes Proteinpulver (Haselnuss oder Vanille)',
        '2 EL Dattelsirup oder gemahlene Medjool-Datteln (natürliche Süße)',
        '2 EL cremige Kokosmilch oder Mandelmilch',
        '2 zuckerfreie Dinkel- oder Buchweizen-Waffelblätter',
        '50g Zartbitterschokolade (mind. 85% Kakaoanteil)'
      ],
      instructions: [
        'Haselnussmus, Proteinpulver, Dattelsirup und Mandelmilch in einer Schüssel zu einer samtigen, aromatischen Creme verrühren.',
        'Die Creme messerdick zwischen den Dinkel-Waffelblättern verteilen und sanft zusammendrücken.',
        'Die Waffel für 15 Minuten ins Gefrierfach stellen, damit die Masse schnittfest wird.',
        'Die Zartbitterschokolade schonend im Wasserbad schmelzen.',
        'Die gekühlte Waffel in 4 fingerbreite Riegel schneiden und dünn mit der flüssigen Edelschokolade überziehen.',
        'Nochmals 10 Minuten kühl stellen, bis die Glasur knackig ist – genießen ohne Reue!'
      ],
      leonsVerdict: 'Echter, unverfälschter Haselnuss-Geschmack! Das Haselnussmus versorgt deine Zellen mit gesunden einfach ungesättigten Fettsäuren, während das Protein deine Muskeln nach dem Workout optimal schützt.'
    }
  },
  kinder_riegel: {
    productName: 'Kinder Riegel / Kinder Schokolade',
    brand: 'Ferrero',
    category: 'Gefüllte Vollmilchschokolade mit Milchcreme-Kern',
    healthCheck: 'Besteht zu über 53% aus reinem Zucker und zu 35% aus Fett. Der angebliche "Milch-Vorteil" ist ein reines Werbeversprechen: Pro Riegel nimmst du fast 3 Stück Würfelzucker auf – ein fataler Kick für deine Insulinkurve.',
    portionTip: 'Maximal 1 kleiner Riegel (21g) als gezielter Notfall-Cheat, niemals packungsweise vor dem TV!',
    cleanRecipe: {
      title: 'LEFIT Clean Milk Bars',
      subtitle: '100% Natürlich • Cremiger Cashew-Vanille-Kern • 85% Kakao-Mantel',
      prepTime: '15 Min. (+ 20 Min. Kühlen)',
      difficulty: 'Einfach',
      servings: '5 Riegel',
      macros: {
        calories: '160 kcal / Riegel',
        protein: '7g',
        carbs: '9g',
        fat: '10.5g',
        fiber: '2.5g'
      },
      comparison: '65% weniger Zucker, natürliche Süße aus Ahornsirup, hochwertige Cashew-Milchcreme',
      ingredients: [
        '80g weißes Mandelmus oder Cashewmus',
        '30g Whey Protein Vanille oder Isolat',
        '2 EL Kokosöl (nativ bio)',
        '1 EL echter Ahornsirup',
        '60g Zartbitterschokolade (mind. 80% Kakao)'
      ],
      instructions: [
        'Mandelmus, Kokosöl, Proteinpulver und Ahornsirup zu einer homogenen weißen Creme verrühren.',
        'Die Masse in Silikon-Riegelformen füllen und 20 Minuten im Tiefkühler aushärten lassen.',
        'Die Zartbitterschokolade im Wasserbad schmelzen.',
        'Die gefrorenen Riegel aus der Form lösen und mit der dunklen Schokolade umhüllen.',
        'Nochmals 5 Minuten kalt stellen – fertig ist der cleanen Schoko-Riegel!'
      ],
      leonsVerdict: 'Der legendäre Geschmack von weißer Milchcreme und herber Schokolade – komplett ohne billige Milchpulver-Konzentrate oder raffinierten Zucker.'
    }
  },
  kinder_country: {
    productName: 'Kinder Country',
    brand: 'Ferrero',
    category: 'Gefüllte Vollmilchschokolade mit Cerealien (Gerste, Reis, Weizen, Dinkel, Buchweizen)',
    healthCheck: 'Die Cerealien klingen gesund, sind aber gepufft, mit Zucker karamellisiert und in gehärtetes Pflanzenfett eingebettet. Pro Riegel stecken über 10g Zucker und leere Kohlenhydrate ohne nennenswerte Ballaststoffe.',
    portionTip: 'Maximal 1 Riegel (23,5g) vor dem Sport verzehren, um die schnellen Carbs direkt zu verbrennen.',
    cleanRecipe: {
      title: 'LEFIT Clean Country Crisps',
      subtitle: '100% Natürlich • Gepufftes Quinoa & Buchweizen • Mandel-Milchcreme',
      prepTime: '15 Min. (+ 15 Min. Kühlen)',
      difficulty: 'Sehr einfach',
      servings: '4 Riegel',
      macros: {
        calories: '175 kcal / Riegel',
        protein: '8g',
        carbs: '14g',
        fat: '9.5g',
        fiber: '3.8g'
      },
      comparison: 'Volle Vollkorn-Power aus echtem Quinoa, kein Palmfett, dreifacher Ballaststoffgehalt',
      ingredients: [
        '35g gepufftes Bio-Quinoa oder gepuffter Buchweizen (ungesüßt)',
        '60g cremiges Mandelmus',
        '25g Vanille-Protein',
        '1 EL Dattelsirup',
        '50g Zartbitterschokolade zum Überziehen'
      ],
      instructions: [
        'Mandelmus mit Proteinpulver und Dattelsirup verrühren.',
        'Die gepufften Körner vorsichtig unterheben, sodass eine knusprige Masse entsteht.',
        'Zu 4 Riegeln formen und auf Backpapier 15 Minuten ins Gefrierfach legen.',
        'Mit geschmolzener Zartbitterschokolade überziehen und fest werden lassen.'
      ],
      leonsVerdict: 'Unglaublicher Crunch! Echte Vollkornkörner liefern langanhaltende Energie und B-Vitamine für deinen Stoffwechsel.'
    }
  },
  duplo: {
    productName: 'Duplo',
    brand: 'Ferrero',
    category: 'Gefüllte Waffel mit Nougatcreme und Vollmilchschokolade',
    healthCheck: 'Besteht aus minderwertigem Palmfett und über 50% Zucker. Die zarte Waffel sättigt überhaupt nicht, sondern triggert im Gehirn den Impuls, direkt den zweiten und dritten Riegel aufzureißen.',
    portionTip: 'Maximal 1 Riegel (18,2g = ca. 100 kcal) am Tag.',
    cleanRecipe: {
      title: 'LEFIT Clean Hazelnut Sticks',
      subtitle: '100% Natürlich • Knusprige Vollkornwaffel • Dunkler Haselnuss-Nougat',
      prepTime: '15 Min. (+ 15 Min. Kühlen)',
      difficulty: 'Einfach',
      servings: '4 Sticks',
      macros: {
        calories: '155 kcal / Riegel',
        protein: '7.5g',
        carbs: '10g',
        fat: '9g',
        fiber: '3g'
      },
      comparison: 'Reines Haselnuss-Nougat ohne Palmfett, 75% weniger Zucker',
      ingredients: [
        '70g Haselnussmus (dunkel geröstet)',
        '20g Rohkakaopulver',
        '2 EL Ahornsirup',
        '20g Schoko-Proteinpulver',
        '2 zuckerfreie Dinkelwaffeln',
        '40g Zartbitterschokolade'
      ],
      instructions: [
        'Haselnussmus mit Rohkakao, Proteinpulver und Ahornsirup zu einer zähen Nougatcreme verrühren.',
        'Dünn auf die Dinkelwaffeln streichen, in Riegel schneiden und kühlen.',
        'Mit Zartbitterschokolade überziehen.'
      ],
      leonsVerdict: 'Der längste Genuss – aber ohne den Industriezucker-Absturz!'
    }
  },
  hanuta: {
    productName: 'Hanuta',
    brand: 'Ferrero',
    category: 'Haselnuss-Schnittchen mit Kakao-Creme zwischen zwei Waffeln',
    healthCheck: 'Über 30% Palmöl und fast 50% Zucker. Die Haselnussstückchen sind winzig im Vergleich zu der Masse an billigem Pflanzenfett.',
    portionTip: 'Maximal 1 Waffelschnittchen (22g) als geplante Ausnahme.',
    cleanRecipe: {
      title: 'LEFIT Clean Hanuta Squares',
      subtitle: '100% Natürlich • Geröstete Haselnuss-Splitter • Roher Kakao',
      prepTime: '15 Min.',
      difficulty: 'Sehr einfach',
      servings: '3 Schnittchen',
      macros: {
        calories: '180 kcal / Stück',
        protein: '8.5g',
        carbs: '11g',
        fat: '11g',
        fiber: '3.5g'
      },
      comparison: 'Vollgepackt mit echten Haselnussstücken, reich an Vitamin E und Magnesium',
      ingredients: [
        '40g gehackte, geröstete Haselnüsse',
        '60g Haselnussmus',
        '2 EL Kakaopulver',
        '2 EL Dattelpaste',
        '4 zuckerfreie Dinkel- oder Reiswaffeln'
      ],
      instructions: [
        'Haselnussmus, Kakao und Dattelpaste verrühren und die gehackten Haselnüsse unterheben.',
        'Großzügig zwischen zwei Waffelhälften verstreichen und leicht andrücken.',
        '10 Minuten kühlen – herrlich knusprig!'
      ],
      leonsVerdict: 'Bissfeste Haselnüsse und herbe Schokolade wie beim Original, aber zu 100% vollwertig.'
    }
  },
  nutella: {
    productName: 'Nutella',
    brand: 'Ferrero',
    category: 'Süßer Brotaufstrich mit Kakao und Haselnüssen',
    healthCheck: 'Besteht zu über 55% aus reinem Haushaltszucker und zu 30% aus minderwertigem Palmöl. Echte Haselnüsse machen gerade mal 13% aus – energetisch eine reine Zuckerbombe ohne nachhaltigen Sättigungseffekt.',
    portionTip: 'Maximal 1 Teelöffel (ca. 15g) an Refeed-Tagen – keinesfalls löffelweise direkt aus dem Glas!',
    cleanRecipe: {
      title: 'LEFIT Dark Hazelnut Power-Creme',
      subtitle: '100% Natürlich • 80% Haselnussanteil • Gesüßt mit Medjool-Datteln',
      prepTime: '10 Min.',
      difficulty: 'Sehr einfach',
      servings: '1 Glas (ca. 250g)',
      macros: {
        calories: '92 kcal / EL (20g)',
        protein: '4.5g',
        carbs: '6g',
        fat: '6.5g',
        fiber: '2.8g'
      },
      comparison: 'Über 6-facher Haselnussanteil, null Industriezucker, reich an Magnesium und Eisen',
      ingredients: [
        '180g frisch geröstetes Haselnussmus (aus 100% Haselnüssen)',
        '3 EL rohes Bio-Kakaopulver (stark entölt, ungezuckert)',
        '4 weiche Medjool-Datteln (entsteint)',
        '60ml ungesüßte Mandelmilch oder Hafermilch',
        '1 Prise feines Meersalz',
        '1 Messerspitze echte Bourbon-Vanille'
      ],
      instructions: [
        'Die Medjool-Datteln für 5 Minuten in warmem Wasser einweichen und anschließend mit 60ml Mandelmilch im Mixer pürieren.',
        'Das Haselnussmus, das rohe Kakaopulver, Vanille und die Prise Meersalz hinzufügen.',
        'Alles auf höchster Stufe 1–2 Minuten cremig aufschlagen, bis ein seidiger Glanz entsteht.',
        'In ein sauberes Weckglas füllen. Im Kühlschrank hält die Creme bis zu 3 Wochen.'
      ],
      leonsVerdict: 'So muss Schoko-Haselnuss schmecken: tief aromatisch, ehrlich nussig und reich an Antioxidantien aus rohem Kakao.'
    }
  },

  // --- MARS BRAND PRODUCTS (DISTINGUISHED PRECISELY) ---
  snickers: {
    productName: 'Snickers',
    brand: 'Mars',
    category: 'Erdnuss-Karamell-Nougat Riegel mit Vollmilchschokolade',
    healthCheck: 'Glukosesirup, gehärtetes Palmfett und raffinierter Zucker überlagern den gesunden Kern der Erdnuss völlig. Mit über 280 kcal pro Riegel schießt die Insulin-Ausschüttung durch die Decke, gefolgt von Müdigkeit und erneutem Verlangen.',
    portionTip: 'Maximal einen halben Riegel (ca. 25g) unmittelbar vor einem intensiven Kraftsport-Workout verzehren.',
    cleanRecipe: {
      title: 'LEFIT Clean Peanut-Caramel Bar',
      subtitle: '100% Natürlich • Cremiges Dattel-Karamell • Protein-Erdnuss-Kern',
      prepTime: '20 Min. (+ 25 Min. Kühlen)',
      difficulty: 'Einfach',
      servings: '6 Riegel',
      macros: {
        calories: '210 kcal / Riegel',
        protein: '12g',
        carbs: '15g',
        fat: '12g',
        fiber: '4g'
      },
      comparison: '65% weniger Zucker, doppelt so viel Protein, reines Dattel-Karamell ohne Glukosesirup',
      ingredients: [
        '100g blanchierte Erdnüsse (ungesalzen)',
        '80g cremiges Erdnussmus (100% Erdnüsse)',
        '35g Vanille- oder Erdnuss-Proteinpulver',
        '6 weiche Medjool-Datteln',
        '2 EL Mandelmehl',
        '60g Zartbitterschokolade (mindestens 80% Kakao)'
      ],
      instructions: [
        'Boden: 40g Erdnussmus mit Mandelmehl, Proteinpulver und 1 EL Wasser zu einem festen Teig verkneten und flach in eine Form drücken.',
        'Karamell: Die Medjool-Datteln mit 40g Erdnussmus und 2 EL heißem Wasser cremig pürieren.',
        'Das Dattel-Karamell auf dem Boden verstreichen und mit den ganzen Erdnüssen bestreuen.',
        'Für 20 Minuten ins Gefrierfach stellen, dann in 6 Riegel schneiden.',
        'Mit geschmolzener Zartbitterschokolade überziehen und fest werden lassen.'
      ],
      leonsVerdict: 'Volle Erdnuss-Power und echtes Dattel-Karamell. Liefert langanhaltende Energie durch gesunde pflanzliche Fette und hochwertige Proteine.'
    }
  },
  twix: {
    productName: 'Twix',
    brand: 'Mars',
    category: 'Knuspriger Keks mit Karamell und Vollmilchschokolade',
    healthCheck: 'Besteht aus weißem Mehl, billigem Palmfett und flüssigem Glukosesirup. Der Keks liefert leere Kalorien, während das Industriekaramell deinen Zähnen und deinem Blutzucker zusetzt.',
    portionTip: 'Maximal 1 Einzelriegel (25g) an aktiven Tagen.',
    cleanRecipe: {
      title: 'LEFIT Clean Twix Shortbread Sticks',
      subtitle: '100% Natürlich • Hafer-Mandel-Shortbread • Dattel-Karamell',
      prepTime: '20 Min. (+ 12 Min. Backzeit)',
      difficulty: 'Einfach',
      servings: '6 Riegel',
      macros: {
        calories: '190 kcal / Riegel',
        protein: '6.5g',
        carbs: '16g',
        fat: '11g',
        fiber: '3.2g'
      },
      comparison: 'Reines Mandel-Shortbread ohne gehärtetes Fett, gesüßt mit Ahornsirup und Datteln',
      ingredients: [
        '80g Mandelmehl + 40g Hafermehl',
        '2 EL Kokosöl (flüssig) + 2 EL Ahornsirup',
        '6 Medjool Datteln + 2 EL Mandelmus (für das Karamell)',
        '60g Zartbitterschokolade (85%)'
      ],
      instructions: [
        'Mehl mit Kokosöl und Ahornsirup verkneten, in Riegelform auf Backpapier drücken und bei 170°C 12 Min. backen.',
        'Datteln mit Mandelmus zu cremigem Karamell mixen und auf dem abgekühlten Keks verstreichen.',
        'Mit dunkler Schokolade überziehen und 15 Minuten kalt stellen.'
      ],
      leonsVerdict: 'Unglaublich zarter Keksboden und himmlisches Dattel-Karamell!'
    }
  },
  bounty: {
    productName: 'Bounty',
    brand: 'Mars',
    category: 'Saftiges Kokosmark mit Milchschokolade',
    healthCheck: 'Trotz des gesunden Rufs von Kokos enthält ein Riegel fast 30g puren Zucker und künstliche Feuchthaltemittel. Der Blutzuckerspiegel schießt rapide nach oben.',
    portionTip: 'Maximal 1 kleiner Riegel (28,5g).',
    cleanRecipe: {
      title: 'LEFIT Clean Coconut Bites',
      subtitle: '100% Natürlich • Reines Kokosfleisch • Dunkle Schokolade',
      prepTime: '15 Min. (+ 20 Min. Kühlen)',
      difficulty: 'Sehr einfach',
      servings: '6 Riegel',
      macros: {
        calories: '165 kcal / Riegel',
        protein: '4.5g',
        carbs: '7g',
        fat: '13g',
        fiber: '4.2g'
      },
      comparison: 'Reine MCT-Fette aus nativem Kokos, kein Industriezucker, reich an Ballaststoffen',
      ingredients: [
        '100g Bio-Kokosraspeln',
        '4 EL cremige Kokosmilch',
        '2 EL Ahornsirup oder Honig',
        '20g Vanille-Proteinpulver',
        '50g Zartbitterschokolade (85%)'
      ],
      instructions: [
        'Kokosraspeln mit Kokosmilch, Protein und Ahornsirup zu einer formbaren Masse vermengen.',
        'Zu kleinen Riegeln formen und 20 Minuten ins Gefrierfach legen.',
        'In geschmolzene Zartbitterschokolade tauchen und fest werden lassen.'
      ],
      leonsVerdict: 'Tropischer Kokosgeschmack pur! Die mittelkettigen Fettsäuren (MCT) werden vom Körper direkt in Energie umgewandelt.'
    }
  },
  mars: {
    productName: 'Mars Riegel',
    brand: 'Mars',
    category: 'Karamell und weiche Candy-Creme mit Milchschokolade',
    healthCheck: 'Mit über 60% reinem Zucker und Invertzuckersirup eine der aggressivsten Kalorienbomben im Riegel-Regal. Führt innerhalb von 30 Minuten zum gefürchteten "Sugar Crash".',
    portionTip: 'Maximal ein halber Riegel unmittelbar vor intensivem Ausdauersport.',
    cleanRecipe: {
      title: 'LEFIT Clean Choco-Caramel Bar',
      subtitle: '100% Natürlich • Fluffiges Protein-Nougat • Weiches Dattelkaramell',
      prepTime: '20 Min.',
      difficulty: 'Einfach',
      servings: '4 Riegel',
      macros: {
        calories: '195 kcal / Riegel',
        protein: '11g',
        carbs: '17g',
        fat: '9g',
        fiber: '3.5g'
      },
      comparison: '70% weniger Zucker, hochwertiges Protein für deine Muskeln',
      ingredients: [
        '40g Schoko-Proteinpulver + 30g Mandelmehl + 2 EL Hafermilch (für den Nougat)',
        '5 weiche Medjool Datteln + 1 EL Mandelmus (für das Karamell)',
        '50g Zartbitterschokolade'
      ],
      instructions: [
        'Nougat-Masse verkneten und flach formen.',
        'Dattelkaramell aufstreichen.',
        'Mit Zartbitterschokolade umhüllen und kühl stellen.'
      ],
      leonsVerdict: 'Super saftig und schokoladig – ganz ohne Heißhunger-Crash danach!'
    }
  },

  // --- MONDELEZ BRAND PRODUCTS (MILKA VS OREO) ---
  milka: {
    productName: 'Milka Alpenmilch Schokolade',
    brand: 'Mondelez',
    category: 'Tafelschokolade aus Alpenmilch',
    healthCheck: 'Eine ganze Tafel liefert fast 60g reinen Zucker und reichlich Palmfett. Der Kakaoanteil liegt bei mageren 30%, der Rest ist Milchzucker und Butterreinfett.',
    portionTip: 'Maximal 2 bis 3 Stückchen (ca. 15g bis 20g) als kleiner Genussmoment nach dem Essen.',
    cleanRecipe: {
      title: 'LEFIT Pure Raw Cacao Bar',
      subtitle: '100% Natürlich • Bio-Kakaobutter • Roher Kakao & Mandelmus',
      prepTime: '15 Min. (+ 25 Min. Kühlen)',
      difficulty: 'Einfach',
      servings: '1 Tafel (100g)',
      macros: {
        calories: '135 kcal / Portion (25g)',
        protein: '3.5g',
        carbs: '8g',
        fat: '11g',
        fiber: '3g'
      },
      comparison: 'Reich an Polyphenolen und Antioxidantien, keine Emulgatoren oder Palmöl',
      ingredients: [
        '50g Bio-Kakaobutter',
        '30g rohes Kakaopulver',
        '2 EL cremiges Mandelmus',
        '2 EL Ahornsirup',
        '1 Prise Meersalz'
      ],
      instructions: [
        'Kakaobutter schonend im Wasserbad schmelzen.',
        'Kakaopulver, Mandelmus und Ahornsirup einrühren.',
        'In eine Schokoladenform gießen und 25 Minuten im Kühlschrank aushärten lassen.'
      ],
      leonsVerdict: 'Echte Kakaobutter schmilzt unvergleichlich zart auf der Zunge und nährt deine Gefäße mit wertvollen Antioxidantien.'
    }
  },
  oreo: {
    productName: 'Oreo Kekse',
    brand: 'Mondelez',
    category: 'Dunkle Kakaokekse mit Vanillegeschmack-Cremefüllung',
    healthCheck: 'Die weiße Füllung ist reines gehärtetes Pflanzenfett gemischt mit Puderzucker. Die Keks-Hälften verdanken ihre tiefschwarze Farbe stark verarbeitetem, alkalisiertem Kakaopulver.',
    portionTip: 'Maximal 2 Kekse (ca. 22g = ca. 105 kcal).',
    cleanRecipe: {
      title: 'LEFIT Clean Dark Cocoa Sandwich-Cookies',
      subtitle: '100% Natürlich • Cashew-Vanille-Creme • Hafer-Kakao-Crunch',
      prepTime: '15 Min. (+ 12 Min. Backzeit)',
      difficulty: 'Einfach',
      servings: '8 Doppel-Kekse',
      macros: {
        calories: '145 kcal / Doppel-Keks',
        protein: '5.5g',
        carbs: '13g',
        fat: '8g',
        fiber: '2.5g'
      },
      comparison: 'Frei von gehärteten Fetten, natürliche Vanille, gesunde Fette aus Cashewkernen',
      ingredients: [
        '80g Hafermehl (fein gemahlene Haferflocken)',
        '30g rohes Kakaopulver',
        '3 EL Ahornsirup oder Dattelpaste',
        '2 EL Kokosöl (nativ)',
        'Für die Creme: 60g eingeweichte Cashewkerne, 2 EL Mandelmilch, 1 TL Vanilleextrakt, 1 EL Ahornsirup'
      ],
      instructions: [
        'Für die Kekse: Hafermehl, Kakaopulver, Kokosöl und Ahornsirup verkneten, dünn ausrollen und Kreise ausstechen.',
        'Bei 175°C Ober-/Unterhitze 10–12 Minuten backen und vollständig abkühlen lassen.',
        'Für die Füllung: Cashews mit Mandelmilch, Vanille und Ahornsirup im Hochleistungsmixer absolut samtig pürieren.',
        'Je einen Teelöffel Creme auf einen Keks geben und mit dem zweiten Keks sanft zusammendrücken.',
        'Für 30 Minuten kühl stellen – der pure Genuss!'
      ],
      leonsVerdict: 'Super knusprig, herrlich herb und mit einer samtigen Creme aus echten Cashews und echter Vanille.'
    }
  },

  // --- SALTY SNACKS ---
  chips_paprika: {
    productName: 'Paprika Kartoffelchips',
    brand: 'Klassische Snack-Marke',
    category: 'Frittierte Kartoffelchips mit Würzmittel',
    healthCheck: 'In heißem Sonnenblumen- oder Palmöl frittierte Kartoffeln bilden Acrylamid und enthalten oxidierte Fette. Die Kombination aus Fett und schnellen Kohlenhydraten schaltet im Gehirn den Sättigungsreiz ab.',
    portionTip: 'Eine Handvoll (ca. 25g = ca. 135 kcal) – am besten in eine kleine Schale füllen, nie aus der Tüte snacken!',
    cleanRecipe: {
      title: 'LEFIT Crunch Paprika-Kichererbsen oder Süßkartoffel-Chips',
      subtitle: '100% Natürlich • Ofengeröstet • Reich an Ballaststoffen & Crunch',
      prepTime: '10 Min. (+ 25 Min. Backzeit)',
      difficulty: 'Sehr einfach',
      servings: '2 Portionen',
      macros: {
        calories: '160 kcal / Portion',
        protein: '7.5g',
        carbs: '22g',
        fat: '4.5g',
        fiber: '6g'
      },
      comparison: '80% weniger Fett, 4x mehr Ballaststoffe, schonend im Ofen mit nativem Olivenöl gebacken',
      ingredients: [
        '1 Dose (240g Abtropfgewicht) Bio-Kichererbsen oder 1 große Süßkartoffel',
        '1 EL natives Olivenöl extra',
        '1 TL geräuchertes Paprikapulver (Pimentón de la Vera)',
        '1/2 TL Knoblauchpulver',
        '1/2 TL Kreuzkümmel',
        '1/2 TL grobes Meersalz'
      ],
      instructions: [
        'Kichererbsen gründlich abspülen und mit einem Küchentuch vollständig trocken reiben.',
        'In einer Schüssel mit Olivenöl und den Gewürzen gründlich vermengen.',
        'Auf einem mit Backpapier ausgelegten Blech verteilen.',
        'Bei 200°C Umluft für ca. 25–30 Minuten knusprig rösten.',
        'Kurz abkühlen lassen – sie werden beim Auskühlen extrem kross!'
      ],
      leonsVerdict: 'Der perfekte Knabber-Spaß für den Serienabend! Liefert komplexe Kohlenhydrate, darmfreundliche Ballaststoffe und null Transfette.'
    }
  },
  chips_sour_cream: {
    productName: 'Sour Cream & Onion Chips',
    brand: 'Klassische Snack-Marke',
    category: 'Frittierte Kartoffelchips mit Sauerrahm-Zwiebel-Aroma',
    healthCheck: 'Enthält künstliche Geschmacksverstärker (Mononatriumglutamat), Hefeextrakt und synthetische Säuerungsmittel, um ständigen Nachschubhunger zu erzeugen.',
    portionTip: 'Maximal eine kleine Schale (25g).',
    cleanRecipe: {
      title: 'LEFIT Zucchini & Kokos-Joghurt Crunch Chips',
      subtitle: '100% Natürlich • Mit frischen Kräutern & Knoblauch',
      prepTime: '10 Min. (+ 30 Min. Backzeit)',
      difficulty: 'Einfach',
      servings: '2 Portionen',
      macros: {
        calories: '120 kcal / Portion',
        protein: '5g',
        carbs: '10g',
        fat: '7g',
        fiber: '4g'
      },
      comparison: 'Frische Zucchini-Chips mit natürlichem Kräuter-Dip ohne Geschmacksverstärker',
      ingredients: [
        '2 mittelgroße Zucchini (hauchdünn gehobelt)',
        '1 EL Olivenöl',
        '1 TL Zwiebelpulver + 1 TL Schnittlauch getrocknet',
        '1 Prise Meersalz',
        'Dip: 3 EL ungesüßter Kokos- oder Lupinenjoghurt mit frischem Schnittlauch und Zitronensaft'
      ],
      instructions: [
        'Zucchinischeiben mit Olivenöl und Zwiebelpulver mischen.',
        'Auf dem Backblech bei 150°C ca. 30 Minuten dörren/backen, bis sie knusprig sind.',
        'Mit dem frischen Kräuter-Dip servieren.'
      ],
      leonsVerdict: 'Echter Sour-Cream Geschmack ohne künstliche Aromastoffe!'
    }
  },
  pizza: {
    productName: 'Pizza Margherita',
    brand: 'Klassische Pizza-Marke / Pizzeria',
    category: 'Steinofenpizza mit Tomatensauce und Käse',
    shortSummary: 'Weißmehl und fettiger Schmelzkäse treiben deinen Insulinspiegel hoch und machen träge. Meine Empfehlung: Maximal 2 bis 3 Stücke nach dem Training als Refeed, oder back dir die cleane LEFIT-Dinkelpizza!',
    healthCheck: 'Klassischer Pizzateig aus Auszugsmehl liefert kaum Ballaststoffe und belastet die Verdauung.',
    portionTip: 'Maximal 2 Stücke (ca. 180g) als gezielter Carb-Refeed.',
    cleanRecipe: {
      title: 'LEFIT Clean Protein Dinkel-Pizza',
      subtitle: '100% Natürlich • Vollkorn-Dinkelboden • Bio-Mozzarella & frisches Basilikum',
      prepTime: '20 Min. (+ 15 Min. Backzeit)',
      difficulty: 'Einfach',
      servings: '2 Portionen',
      macros: {
        calories: '340 kcal / Portion',
        protein: '24g',
        carbs: '38g',
        fat: '9g',
        fiber: '7g'
      },
      comparison: '3x mehr Ballaststoffe, doppelt so viel Protein und ohne künstliche Schmelzkäse-Zusätze',
      ingredients: [
        '150g Vollkorn-Dinkelmehl',
        '100g Magerquark oder Seidentofu (für ultra Protein-Kruste)',
        '1 TL Backpulver & 1 Prise Meersalz',
        '80ml lauwarmes Wasser + 1 TL Olivenöl',
        '100g passierte Bio-Tomaten mit Oregano',
        '100g echter Büffel- oder fettreduzierter Bio-Mozzarella',
        'Frische Basilikumblätter'
      ],
      instructions: [
        'Dinkelmehl, Magerquark, Backpulver, Wasser und Olivenöl zu einem geschmeidigen Teig verkneten.',
        'Den Teig auf Backpapier dünn ausrollen.',
        'Mit der gewürzten Tomatensauce bestreichen und mit Mozzarella belegen.',
        'Bei 220°C Ober-/Unterhitze 12-15 Minuten goldbraun und kross backen.',
        'Mit frischem Basilikum garnieren und ofenfrisch genießen!'
      ],
      leonsVerdict: 'Unglaublich knusprig! Der Quark im Teig macht die Kruste saftig und liefert wertvolles Casein-Protein.'
    }
  },
  burger: {
    productName: 'Cheeseburger',
    brand: 'Fast-Food-Kette / Burger-Restaurant',
    category: 'Rindfleisch-Burger mit Schmelzkäse und Weizenbrötchen',
    shortSummary: 'Industrielle Burger-Buns bestehen fast nur aus Zucker und Konservierungsstoffen, dazu kommt billiges Fett. Meine Empfehlung: Maximal 1 kleiner Burger ohne Pommes oder mach dir den saftigen LEFIT-Burger!',
    healthCheck: 'Raffinierte Buns und künstliche Schmelzkäse-Zubereitungen triggern Heißhunger.',
    portionTip: 'Maximal 1 kleiner Burger (ca. 120g) ohne gezuckerte Saucen.',
    cleanRecipe: {
      title: 'LEFIT Power Beef & Avocado Burger',
      subtitle: '100% Natürlich • Weiderind oder Linsen-Patty • Vollkorn-Bun',
      prepTime: '20 Min.',
      difficulty: 'Einfach',
      servings: '2 Burger',
      macros: {
        calories: '380 kcal / Burger',
        protein: '34g',
        carbs: '28g',
        fat: '14g',
        fiber: '6g'
      },
      comparison: 'Reines Weiderind, gesunde Avocado-Fette und vollwertiges Dinkel-Bun',
      ingredients: [
        '250g mageres Bio-Rinderhack (oder Linsen-Hafer-Masse)',
        '2 Vollkorn-Dinkel-Brötchen (oder Süßkartoffel-Scheiben als Bun)',
        '1/2 reife Avocado (zerdrückt mit Limette & Meersalz)',
        '40g echter Ziegen- oder Gouda-Käse',
        'Tomatenscheiben, rote Zwiebeln und Rucola'
      ],
      instructions: [
        'Das Hackfleisch mit Meersalz und Pfeffer würzen und zu 2 flachen Patties formen.',
        'In einer heißen Gusspfanne von jeder Seite 2-3 Minuten scharf anbraten.',
        'Käse auf die heißen Patties legen und kurz schmelzen lassen.',
        'Dinkel-Buns anrösten, mit Avocado-Creme bestreichen und mit Salat, Fleisch und Tomaten belegen.'
      ],
      leonsVerdict: 'Massive Protein-Power und gesunde Fette – so schmeckt ein echter Fitness-Burger!'
    }
  },
  chips_pringles: {
    productName: 'Pringles Original / Sour Cream',
    brand: 'Kellogg\'s / Pringles',
    category: 'Stapelchips aus Kartoffelpüreepulver und Palmfett',
    shortSummary: 'Besteht aus dehydriertem Kartoffelpulver, billigem Palmöl und künstlichen Geschmacksverstärkern, die dich zwingen, die Dose leerzuessen. Meine Empfehlung: Höchstens 8-10 Chips (20g) oder direkt echte Ofen-Chips machen!',
    healthCheck: 'Ultra-hoch verarbeitet und vollgepackt mit künstlichen Aromastoffen und Fett.',
    portionTip: 'Maximal eine Handvoll (ca. 20g = 100 kcal).',
    cleanRecipe: {
      title: 'LEFIT Süßkartoffel & Meersalz Crisps',
      subtitle: '100% Natürlich • Im Ofen gebacken • Null Palmfett',
      prepTime: '10 Min. (+ 20 Min. Backzeit)',
      difficulty: 'Einfach',
      servings: '2 Portionen',
      macros: {
        calories: '135 kcal / Portion',
        protein: '3g',
        carbs: '22g',
        fat: '4.5g',
        fiber: '4.2g'
      },
      comparison: 'Reine Süßkartoffel, reich an Vitamin A & C, 60% weniger Fett als Stapelchips',
      ingredients: [
        '2 große Bio-Süßkartoffeln (hauchdünn gehobelt)',
        '1 EL natives Olivenöl extra',
        '1 TL geräuchertes Paprikapulver & Meersalz',
        '1 Zweig Rosmarin feingehackt'
      ],
      instructions: [
        'Süßkartoffelscheiben mit Olivenöl und Gewürzen gründlich vermengen.',
        'Einlagig auf Backpapier auslegen.',
        'Bei 180°C Umluft 18-20 Minuten backen, bis die Ränder knusprig sind.',
        'Auf einem Gitter abkühlen lassen – wird ultra crunchy!'
      ],
      leonsVerdict: 'Der pure Knusper-Genuss! Volle Mikronährstoff-Power ohne Acrylamid-Schock.'
    }
  },
  coca_cola: {
    productName: 'Coca-Cola / Softdrink',
    brand: 'The Coca-Cola Company',
    category: 'Koffeinhaltiges Erfrischungsgetränk mit Zucker / Süßstoff',
    shortSummary: 'Eine einzige Dose liefert über 35g reinen Zucker (10 Würfelzucker) ohne jeden Nährwert, oder künstliche Süßstoffe, die das Mikrobiom stören. Meine Empfehlung: Maximal 1 kleines Glas als Ausnahme oder steig auf die frische LEFIT-Infusion um!',
    healthCheck: 'Reine flüssige Kalorien, die die Leber verfetten und Zahnschmelz angreifen.',
    portionTip: 'Maximal 150ml – am besten durch Wasser mit Zitrone ersetzen.',
    cleanRecipe: {
      title: 'LEFIT Sparkling Hibiskus & Beeren-Eistee',
      subtitle: '100% Natürlich • Ohne Zucker • Frischer Antioxidantien-Push',
      prepTime: '5 Min.',
      difficulty: 'Sehr einfach',
      servings: '2 Gläser',
      macros: {
        calories: '18 kcal / Glas',
        protein: '0.5g',
        carbs: '4g',
        fat: '0g',
        fiber: '1g'
      },
      comparison: 'Null Industriezucker, 100% natürliche Fruchtsäuren und Polyphenole',
      ingredients: [
        '2 Beutel Bio-Hibiskus- oder Beeren-Tee',
        '400ml kochendes Wasser (stark aufbrühen und abkühlen lassen)',
        '200ml eiskaltes Sprudelwasser',
        'Saft einer halben Bio-Limette',
        'Handvoll frische Beeren und Minzblätter',
        'Eiswürfel'
      ],
      instructions: [
        'Den Tee stark aufgießen, 10 Minuten ziehen lassen und kaltstellen.',
        'Mit Eiswürfeln, Sprudelwasser und frischem Limettensaft aufgießen.',
        'Mit frischer Minze und Beeren servieren.'
      ],
      leonsVerdict: 'Erfrischt 1000x besser als jede klebrige Cola und kurbelt deine Fettverbrennung an!'
    }
  },
  haribo: {
    productName: 'Haribo Goldbären',
    brand: 'Haribo',
    category: 'Fruchtgummi mit Gelatine und Glukosesirup',
    shortSummary: 'Besteht zu fast 80% aus Zucker, Glukosesirup und künstlichen Säuerungsmitteln. Meine Empfehlung: Maximal 4 bis 5 Bärchen vor dem Laufen als schneller Glykogen-Schub oder mach dir die cleanen LEFIT-Fruchtbärchen!',
    healthCheck: 'Klebt an den Zähnen und jagt das Insulin in extreme Spitzen.',
    portionTip: 'Maximal 20g (ca. 6 Bärchen) gezielt vor Cardio.',
    cleanRecipe: {
      title: 'LEFIT Clean Fruchtsaft-Bärchen',
      subtitle: '100% Natürlich • 100% Direktsaft • Mit pflanzlichem Agar-Agar',
      prepTime: '10 Min. (+ 20 Min. Kühlen)',
      difficulty: 'Einfach',
      servings: '3 Portionen',
      macros: {
        calories: '45 kcal / Portion',
        protein: '1.5g',
        carbs: '9g',
        fat: '0g',
        fiber: '1.8g'
      },
      comparison: 'Reiner 100% Bio-Muttersaft ohne Glukosesirup oder künstliche Farbstoffe',
      ingredients: [
        '200ml 100% reiner Bio-Kirsch- oder Granatapfelsaft (ohne Zuckerzusatz)',
        '1.5 TL pflanzliches Agar-Agar-Pulver',
        '1 EL Zitronensaft',
        '1 TL Ahornsirup (optional)'
      ],
      instructions: [
        'Fruchtsaft mit Agar-Agar und Zitronensaft in einem kleinen Topf verrühren.',
        'Aufkochen und 2 Minuten unter Rühren sanft köcheln lassen.',
        'Mit einer Pipette in Silikon-Bärchenformen füllen.',
        '20 Minuten im Kühlschrank fest werden lassen – fertig ist das cleane Fruchtgummi!'
      ],
      leonsVerdict: 'Echte Frucht-Vitamine zum Naschen! Perfekt für Heißhunger-Attacken zwischendurch.'
    }
  },
  doener: {
    productName: 'Döner Kebab',
    brand: 'Döner Imbiss / Streetfood',
    category: 'Fladenbrot mit Drehspieß-Fleisch, Salat und Saucen',
    shortSummary: 'Oft mit gestrecktem Hackfleisch-Spieß und Mayonnaise-lastigen Saucen zubereitet. Meine Empfehlung: Bestelle ihn mit Hähnchenfleisch, viel Salat und Kräuter-Joghurt-Sauce, oder bereite den LEFIT-Döner zu!',
    healthCheck: 'Fertigsaucen und minderwertige Spieße enthalten oft viel verstecktes Fett und Natrium.',
    portionTip: 'Maximal 1 Döner (ca. 350g), vorzugsweise mit Hähnchen und Joghurt-Sauce.',
    cleanRecipe: {
      title: 'LEFIT Clean Chicken Döner',
      subtitle: '100% Natürlich • Bio-Hähnchenbrust • Vollkorn-Dinkelbrot & Knoblauch-Kräuterquark',
      prepTime: '20 Min.',
      difficulty: 'Einfach',
      servings: '2 Döner',
      macros: {
        calories: '410 kcal / Döner',
        protein: '42g',
        carbs: '36g',
        fat: '9g',
        fiber: '7.5g'
      },
      comparison: '42g hochwertiges Protein, 70% weniger Fett als Imbiss-Döner und ohne Geschmacksverstärker',
      ingredients: [
        '300g Hähnchenbrustfilet (in feine Streifen geschnitten)',
        '1 TL Kreuzkümmel, Paprikapulver, Oregano, Knoblauchpulver & Meersalz',
        '2 Vollkorn-Dinkel-Pita oder Fladenbrote',
        '150g Magerquark oder griechischer Joghurt 0% mit Knoblauch & Kräutern',
        'Frischer Rotkohl, Eisbergsalat, Tomaten und Gurken'
      ],
      instructions: [
        'Hähnchenstreifen mit den Gewürzen marinieren und in der Pfanne scharf anbraten.',
        'Pita-Brote im Toaster kross anwärmen.',
        'Brote mit Knoblauch-Kräuterquark bestreichen, mit frischem Salat und dem heißen Hähnchen füllen.'
      ],
      leonsVerdict: 'Ein echter Muskelaufbau-Klassiker! Schmeckt besser als an jeder Dönerbude und liefert pure Proteine.'
    }
  },
  apfel: {
    productName: 'Frischer Bio-Apfel',
    brand: 'Naturprodukt',
    category: 'Frisches Kernobst',
    shortSummary: 'Perfekter natürlicher Snack! Liefert wertvolles Pektin für eine gesunde Darmflora und langanhaltende Sättigung. Meine Empfehlung: 1 bis 2 Äpfel täglich mit Schale genießen, ideal kombiniert mit einer Handvoll Mandeln!',
    healthCheck: '100% naturbelassen, reich an Vitamin C, Antioxidantien und verdauungsfördernden Ballaststoffen.',
    portionTip: '1 ganzer Apfel (ca. 150-180g) als idealer Snack zwischendurch.',
    cleanRecipe: {
      title: 'LEFIT Warmer Zimt-Apfel mit Mandel-Crunch',
      subtitle: '100% Natürlich • Warmer Genuss • Null Industriezucker',
      prepTime: '8 Min.',
      difficulty: 'Sehr einfach',
      servings: '1 Portion',
      macros: {
        calories: '165 kcal',
        protein: '3.5g',
        carbs: '24g',
        fat: '6.5g',
        fiber: '5g'
      },
      comparison: 'Schmeckt wie warmer Apfelstrudel, ganz ohne Zuckerzusatz oder Blätterteig',
      ingredients: [
        '1 großer Bio-Apfel (gewürfelt)',
        '1 TL echter Ceylon-Zimt',
        '15g gehackte Mandeln oder Walnüsse',
        '1 EL Wasser',
        'Optional: 2 EL warmer Bio-Kokosjoghurt'
      ],
      instructions: [
        'Apfelwürfel mit Zimt und 1 EL Wasser in einem kleinen Topf 4-5 Minuten dünsten.',
        'Die Nüsse kurz in einer Pfanne ohne Fett anrösten.',
        'Den warmen Zimt-Apfel in ein Schälchen füllen, mit gerösteten Mandeln toppen und sofort löffeln!'
      ],
      leonsVerdict: 'Balsam für die Seele und perfekt für den Stoffwechsel – Ceylon-Zimt reguliert zusätzlich den Blutzucker!'
    }
  }
};

// API Endpoint to recognize product and produce LEFIT health check & clean recipe
app.post('/api/scan-product', async (req, res) => {
  try {
    const { imageBase64, sampleId, productNameHint } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    // 1. Direct key match in curated catalog if sampleId is explicitly provided
    if (sampleId && KNOWN_LEFIT_PRODUCTS[sampleId]) {
      const item = KNOWN_LEFIT_PRODUCTS[sampleId];
      return res.json({
        success: true,
        data: {
          ...item,
          shortSummary: `${item.healthCheck} Portionsempfehlung: ${item.portionTip}`,
        },
        source: 'curated'
      });
    }

    // 2. PRIMARY: Gemini 3.8 Flash universal AI recognition for ANY product or food in the world!
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const promptText = `
Du bist die weltweite, universelle Lebensmittel- und Verpackungs-Erkennungs-KI für LEFIT (gegründet von Fitness-Experte Leon: 100% natürlich, ohne künstlichen Mist).
Analysiere dieses Bild oder die Eingabe: "${productNameHint || 'gescanntes Produkt / Essen'}" mit 100%iger Präzision. KEINE FEHLER!

STRIKTE ANWEISUNGEN:
1. Erkenne haargenau das Produkt oder Essen:
   - Bei verpackten Produkten aller Art (Chips, Süßigkeiten, Schokolade, Getränke, Joghurt, Tiefkühlkost, Fertiggerichte, Müslis, Riegel aller Marken weltweit wie Pringles, Doritos, Kinder Bueno, Kinder Country, Duplo, Hanuta, Oreo, Milka, Twix, Snickers, Haribo, Coca-Cola, Red Bull, Nutella, etc.):
     Lies den Text und das Logo auf der Verpackung und erkenne die EXAKTE Marke und den EXAKTEN Produktnamen!
   - Bei frischem, unverpacktem oder gekochtem Essen (Pizza, Cheeseburger, Döner Kebab, Spaghetti, Sushi, Salat, Curry, Apfel, Banane, Lachs mit Reis, Pommes, etc.):
     Erkenne das genaue Gericht bzw. Essen!
   - NIEMALS fälschlicherweise "Kinderriegel" ausgeben, wenn ein anderes Produkt oder Essen zu sehen ist!

2. Erstelle das Ergebnis exakt als JSON mit diesen Feldern:
   - "productName": Der exakte Name des Essens / Produkts (z. B. "Pringles Sour Cream & Onion", "Pizza Margherita", "Cheeseburger", "Kinder Bueno", "Apfel", etc.).
   - "brand": Die Marke (z. B. "Kellogg's", "Ferrero", "Mars", "Dr. Oetker", etc.) oder "Frisch zubereitet" / "Naturprodukt".
   - "category": Spezifische Kategorie (z. B. "Knusprige Kartoffelchips", "Italienische Steinofenpizza", "Rindfleisch-Burger", etc.).
   - "shortSummary": Ganz kurz (2 bis maximal 3 Sätze) komplett in EINEM kurzen Text: Leons persönliche Erfahrung/Gesundheitscheck zu den Inhaltsstoffen UND direkt darin integriert die konkrete Portionsempfehlung für den Alltag!
   - "healthCheck": 1-2 kurze Sätze zu den Zutaten und der gesundheitlichen Wirkung.
   - "portionTip": Die konkrete Portionsmenge.
   - "cleanRecipe": Ein 100% natürliches, gesundes LEFIT-Rezept zum Selbermachen als cleane Alternative ohne künstlichen Mist:
     - "title", "subtitle", "prepTime", "difficulty", "servings", "macros" (calories, protein, carbs, fat, fiber), "comparison", "ingredients" (5-8 natürliche Zutaten mit Mengenangaben), "instructions" (4-6 Schritte), "leonsVerdict".
`;

        const parts: any[] = [];
        if (imageBase64) {
          const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          });
        }
        parts.push({ text: promptText });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API timeout')), 25000)
        );

        const response: any = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: { parts },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING },
                  brand: { type: Type.STRING },
                  category: { type: Type.STRING },
                  shortSummary: { type: Type.STRING },
                  healthCheck: { type: Type.STRING },
                  portionTip: { type: Type.STRING },
                  cleanRecipe: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      subtitle: { type: Type.STRING },
                      prepTime: { type: Type.STRING },
                      difficulty: { type: Type.STRING },
                      servings: { type: Type.STRING },
                      macros: {
                        type: Type.OBJECT,
                        properties: {
                          calories: { type: Type.STRING },
                          protein: { type: Type.STRING },
                          carbs: { type: Type.STRING },
                          fat: { type: Type.STRING },
                          fiber: { type: Type.STRING },
                        },
                        required: ['calories', 'protein', 'carbs', 'fat'],
                      },
                      comparison: { type: Type.STRING },
                      ingredients: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      instructions: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      leonsVerdict: { type: Type.STRING },
                    },
                    required: ['title', 'subtitle', 'prepTime', 'servings', 'ingredients', 'instructions', 'leonsVerdict'],
                  },
                },
                required: ['productName', 'brand', 'category', 'shortSummary', 'healthCheck', 'portionTip', 'cleanRecipe'],
              },
            },
          }),
          timeoutPromise,
        ]);

        const textOutput = response.text;
        if (textOutput) {
          const parsed = JSON.parse(textOutput);
          if (parsed.productName) {
            return res.json({
              success: true,
              data: parsed,
              source: 'gemini',
            });
          }
        }
      } catch (geminiError) {
        console.warn('Gemini recognition issue:', geminiError);
      }
    }

    // 3. Fallback matching if hint matches catalog
    if (productNameHint) {
      const lower = productNameHint.toLowerCase();
      for (const [key, prod] of Object.entries(KNOWN_LEFIT_PRODUCTS)) {
        if (lower.includes(prod.productName.toLowerCase()) || prod.productName.toLowerCase().includes(lower)) {
          return res.json({
            success: true,
            data: {
              ...prod,
              shortSummary: `${prod.healthCheck} Portionsempfehlung: ${prod.portionTip}`,
            },
            source: 'curated-search',
          });
        }
      }

      // Generate dynamic response for the specific food name requested (NOT Kinder Bueno!)
      const customFoodName = productNameHint.trim();
      return res.json({
        success: true,
        data: {
          productName: customFoodName,
          brand: 'Erkanntes Lebensmittel',
          category: 'Erkanntes Essen / Snack',
          shortSummary: `Enthält meist industriell verarbeitete Fette und einfachen Zucker, die deine Energie schnell abstürzen lassen. Meine Empfehlung: Höchstens 1 kleine Portion bewusst genießen oder direkt die cleane LEFIT-Alternative zubereiten!`,
          healthCheck: `Industriell verarbeitete Zutaten können den Blutzucker belasten.`,
          portionTip: `Maximal 1 kleine Portion als bewusster Genuss.`,
          cleanRecipe: {
            title: `LEFIT Clean ${customFoodName}`,
            subtitle: '100% Natürlich • Ohne künstlichen Mist',
            prepTime: '15 Min.',
            difficulty: 'Einfach',
            servings: '2 Portionen',
            macros: {
              calories: '220 kcal',
              protein: '14g',
              carbs: '22g',
              fat: '8g',
              fiber: '5g'
            },
            comparison: 'Frei von künstlichen Zusatzstoffen und raffiniertem Zucker',
            ingredients: [
              '100% natürliche Vollwert-Zutaten',
              'Bio-Haferflocken oder Mandelmehl',
              'Hochwertiges Proteinpulver oder Nüsse',
              'Frische Früchte oder Datteln für natürliche Süße',
              'Echtes Kakaopulver oder Gewürze'
            ],
            instructions: [
              'Alle naturbelassenen Zutaten schonend vorbereiten.',
              'Ohne künstliche Zusätze oder gehärtete Fette zubereiten.',
              'Frisch genießen und den Körper mit echten Nährstoffen versorgen!'
            ],
            leonsVerdict: `Echter, sauberer Geschmack ohne Reue und voller natürlicher Energie für deinen Alltag!`
          }
        },
        source: 'custom-generator'
      });
    }

    // 4. If image was provided but recognition failed, DO NOT return bueno! Tell the user to retake or specify!
    if (imageBase64) {
      return res.status(422).json({
        success: false,
        error: 'Konnte das Produkt auf der Kamera nicht eindeutig erkennen. Bitte richte die Kamera direkt auf die Packung oder tippe den Namen ein.',
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Kein Bild oder Produktname übermittelt.',
    });
  } catch (error: any) {
    console.error('Error in /api/scan-product:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Interner Fehler beim Verarbeiten des Scans',
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    brand: 'LEFIT',
    model: 'gemini-3.8-flash',
    hasKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY')
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, 'vite.config.ts'),
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LEFIT Server] Running on http://0.0.0.0:${PORT} in ${isProd ? 'production' : 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error('[LEFIT Server] Failed to start:', err);
  process.exit(1);
});
