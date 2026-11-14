import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  checkAccountExists,
  authenticateAccount,
  verifySessionToken,
  getAccountByEmail,
  toPublicUser,
  saveUserRecipe,
  syncUserRecipes,
  deleteUserRecipe,
  resetUserRecipes,
  ServerAccountRecord,
} from './server/lefitStore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProdEnv = process.env.NODE_ENV === 'production';
const PORT = isProdEnv ? Number(process.env.PORT) || 3000 : 3000;

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

interface AuthenticatedRequest extends Request {
  account?: ServerAccountRecord;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const verified = verifySessionToken(token);
  if (!verified) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Bitte melde dich mit deinem Konto und dem richtigen Passwort an.',
    });
  }
  const acc = getAccountByEmail(verified.email);
  if (!acc) {
    return res.status(401).json({
      success: false,
      code: 'ACCOUNT_NOT_FOUND',
      error: 'Benutzerkonto nicht gefunden. Bitte erneut anmelden.',
    });
  }
  req.account = acc;
  next();
}

// Curated comparison metrics: Calories Vorher (normal/commercial) vs. In Gesund (LEFIT clean remake) vs. Ersparnis
const PRODUCT_CALORIE_MAP: Record<string, { originalCalories: string; cleanCalories: string; calorieSavings: string }> = {
  bueno: {
    originalCalories: '572 kcal / 100g (ca. 122 kcal pro Riegel)',
    cleanCalories: '185 kcal / Riegel (100% Haselnuss-Power)',
    calorieSavings: '-68% Zucker & reine gesunde Fette statt Palmöl',
  },
  kinder_riegel: {
    originalCalories: '566 kcal / 100g (über 53% reiner Zucker)',
    cleanCalories: '160 kcal / Riegel (Cashew-Vanille & Edelkakao)',
    calorieSavings: '-65% Zucker, 0g Palmfett',
  },
  kinder_country: {
    originalCalories: '561 kcal / 100g (Cerealien in Palmöl)',
    cleanCalories: '175 kcal / Riegel (Bio-Quinoa & Buchweizen)',
    calorieSavings: '-60% Zucker, 3x mehr Ballaststoffe',
  },
  duplo: {
    originalCalories: '555 kcal / 100g (über 50% Zucker)',
    cleanCalories: '155 kcal / Riegel (Dunkler Haselnuss-Nougat)',
    calorieSavings: '-75% Zucker, kein Palmöl',
  },
  hanuta: {
    originalCalories: '542 kcal / 100g (über 30% Palmöl)',
    cleanCalories: '180 kcal / Stück (100% Haselnüsse & Datteln)',
    calorieSavings: '-65% Zucker, reich an Magnesium',
  },
  nutella: {
    originalCalories: '539 kcal / 100g (55% Zucker, 30% Palmöl)',
    cleanCalories: '92 kcal / EL (80% reine Haselnuss)',
    calorieSavings: 'Null Industriezucker, 6x mehr Haselnuss',
  },
  snickers: {
    originalCalories: '488 kcal / 100g (ca. 280 kcal pro Riegel)',
    cleanCalories: '210 kcal / Riegel (Dattel-Karamell & Erdnuss)',
    calorieSavings: '-70 kcal & 12g Protein statt Glukosesirup',
  },
  twix: {
    originalCalories: '495 kcal / 100g (Weißmehl in Palmöl)',
    cleanCalories: '190 kcal / Riegel (Hafer-Mandel & Dattel)',
    calorieSavings: '-60% Zucker, 100% vollwertig',
  },
  bounty: {
    originalCalories: '487 kcal / 100g (30g Glukosesirup)',
    cleanCalories: '165 kcal / Riegel (Bio-Kokos & MCT-Fette)',
    calorieSavings: '-65% Zucker, reine MCT-Fettsäuren',
  },
  mars: {
    originalCalories: '450 kcal / 100g (60% Invertzuckersirup)',
    cleanCalories: '195 kcal / Riegel (Protein-Nougat & Dattel)',
    calorieSavings: '-70% Zucker, 11g Protein',
  },
  milka: {
    originalCalories: '530 kcal / 100g (nur 30% Kakao, 60% Zucker)',
    cleanCalories: '135 kcal / 25g (Bio-Kakaobutter & Edelkakao)',
    calorieSavings: '-65% Zucker, reich an Polyphenolen',
  },
  oreo: {
    originalCalories: '474 kcal / 100g (Palmfett-Puderzucker)',
    cleanCalories: '145 kcal / Keks (Cashew-Vanille & Hafer)',
    calorieSavings: '-60% Zucker, gesunde pflanzliche Fette',
  },
  chips_paprika: {
    originalCalories: '535 kcal / 100g (in Palmöl frittiert)',
    cleanCalories: '160 kcal / Portion (ofengeröstete Kichererbsen)',
    calorieSavings: '-375 kcal (-70% Fett, kein Acrylamid)',
  },
  chips_sour_cream: {
    originalCalories: '530 kcal / 100g (mit Glutamat & Aromen)',
    cleanCalories: '120 kcal / Portion (Zucchini & Kokos-Kräuterdip)',
    calorieSavings: '-410 kcal (-77% Kalorien, kein Glutamat)',
  },
  pizza: {
    originalCalories: '850 - 950 kcal (Steinofenpizza mit Schmelzkäse)',
    cleanCalories: '340 kcal / Portion (Vollkorn-Dinkel mit Magerquark-Boden)',
    calorieSavings: '-550 kcal (-60% Kalorien, 24g Protein!)',
  },
  burger: {
    originalCalories: '600 - 750 kcal (Fast-Food Burger mit Schmelzkäse)',
    cleanCalories: '380 kcal / Burger (Bio-Weiderind, Dinkel-Bun & Avocado)',
    calorieSavings: '-320 kcal & massive 34g Muskel-Eiweiß',
  },
  chips_pringles: {
    originalCalories: '522 kcal / 100g (Kartoffelpulver in Palmöl)',
    cleanCalories: '135 kcal / Portion (Ofen-Süßkartoffel mit Meersalz)',
    calorieSavings: '-387 kcal (-74% Fett, null Palmfett)',
  },
  coca_cola: {
    originalCalories: '140 kcal / 330ml Dose (35g Zucker / 10 Würfelzucker)',
    cleanCalories: '18 kcal / Glas (Bio-Hibiskus & Limetten-Infusion)',
    calorieSavings: '-122 kcal (-87% Kalorien, 0g Industriezucker)',
  },
  haribo: {
    originalCalories: '343 kcal / 100g (80% Glukosesirup & Zucker)',
    cleanCalories: '45 kcal / Portion (100% Bio-Muttersaft & Agar-Agar)',
    calorieSavings: '-298 kcal (-86% Kalorien, 100% Frucht-Vitamine)',
  },
  doener: {
    originalCalories: '750 - 900 kcal (Imbiss-Döner mit Mayonnaise-Sauce)',
    cleanCalories: '410 kcal / Döner (Hähnchenbrust & Kräuterquark)',
    calorieSavings: '-450 kcal (-50% Kalorien, 42g Protein)',
  },
  apfel: {
    originalCalories: 'ca. 95 kcal (1 normaler Bio-Apfel)',
    cleanCalories: '165 kcal (Warmer Zimt-Apfel mit gerösteten Mandeln)',
    calorieSavings: '+70 kcal gesunde Fette & Pektin für Blutzucker-Balance',
  },
};

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

// ==========================================
// 1. AUTHENTICATION ENDPOINTS (STRICT PASSWORD)
// ==========================================
app.post('/api/auth/check-account', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  if (!email.includes('@')) {
    return res.json({ exists: false });
  }
  return res.json(checkAccountExists(email));
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, confirmPassword, name, provider, avatar } = req.body || {};
  const validProvider = provider === 'google' || provider === 'apple' || provider === 'email' ? provider : 'email';

  const result = authenticateAccount({
    email: String(email || ''),
    password: String(password || ''),
    confirmPassword: typeof confirmPassword === 'string' ? confirmPassword : undefined,
    name: typeof name === 'string' ? name : undefined,
    provider: validProvider,
    avatar: typeof avatar === 'string' ? avatar : undefined,
  });

  if (result.ok === false) {
    return res.status(result.status).json({ success: false, error: result.error });
  }

  return res.json({
    success: true,
    token: result.token,
    user: result.user,
    isNewAccount: result.isNewAccount,
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const acc = req.account!;
  return res.json({
    success: true,
    user: toPublicUser(acc),
  });
});

// ==========================================
// 2. SAVED RECIPES ENDPOINTS
// ==========================================
app.get('/api/recipes', requireAuth, (req: AuthenticatedRequest, res) => {
  const acc = req.account!;
  return res.json({
    success: true,
    savedRecipes: acc.savedRecipes || [],
  });
});

app.post('/api/recipes', requireAuth, (req: AuthenticatedRequest, res) => {
  const product = req.body?.product;
  if (!product || typeof product.productName !== 'string' || !product.cleanRecipe) {
    return res.status(400).json({ success: false, error: 'Ungültige Rezeptdaten.' });
  }

  const result = saveUserRecipe(req.account!.email, product);
  return res.json({
    success: true,
    savedRecipes: result.savedRecipes,
  });
});

app.post('/api/recipes/sync', requireAuth, (req: AuthenticatedRequest, res) => {
  const localRecipes = Array.isArray(req.body?.localRecipes) ? req.body.localRecipes : [];
  const result = syncUserRecipes(req.account!.email, localRecipes);
  return res.json({
    success: true,
    savedRecipes: result.savedRecipes,
  });
});

app.delete('/api/recipes/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const recipeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = deleteUserRecipe(req.account!.email, String(recipeId || ''));
  return res.json({
    success: true,
    savedRecipes: result.savedRecipes,
  });
});

app.post('/api/recipes/reset', requireAuth, (req: AuthenticatedRequest, res) => {
  const result = resetUserRecipes(req.account!.email);
  return res.json({
    success: true,
    savedRecipes: result.savedRecipes,
  });
});

// ==========================================
// 3. UNIVERSAL FOOD SCANNER (UNLIMITED FOR AUTHENTICATED USERS)
// ==========================================
app.post('/api/scan-product', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { imageBase64, sampleId, productNameHint, autoScan } = req.body || {};
    const isAutoScan = Boolean(autoScan);

    const apiKey = process.env.GEMINI_API_KEY;

    // 1. Direct key match in curated catalog if sampleId is explicitly provided
    if (sampleId && KNOWN_LEFIT_PRODUCTS[sampleId]) {
      const item = KNOWN_LEFIT_PRODUCTS[sampleId];
      const calInfo = PRODUCT_CALORIE_MAP[sampleId] || {
        originalCalories: '550 kcal / 100g (Normal / Vorher)',
        cleanCalories: item.cleanRecipe?.macros?.calories || '180 kcal',
        calorieSavings: '-60% Zucker & 0g Palmfett',
      };
      return res.json({
        success: true,
        recognized: true,
        data: {
          ...item,
          originalCalories: calInfo.originalCalories,
          cleanCalories: calInfo.cleanCalories,
          calorieSavings: calInfo.calorieSavings,
          cleanRecipe: {
            ...item.cleanRecipe,
            originalCalories: calInfo.originalCalories,
            cleanCalories: calInfo.cleanCalories,
            calorieSavings: calInfo.calorieSavings,
          },
          shortSummary: `${item.healthCheck} Portionsempfehlung: ${item.portionTip}`,
        },
        source: 'curated'
      });
    }

    // 2. PRIMARY: Gemini universal AI recognition for ANY product or food in the world!
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
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
Deine Mission: Erkenne WIRKLICH ALLES an Produkten und Essen auf der ganzen Welt und schreibe GENAU DAS PASSENDE gesunde Rezept dazu – genaustens passend, ohne jeden Fehler!

Analysiere dieses Bild oder den Text-Hinweis: "${productNameHint || 'gescanntes Produkt / Essen'}".

STRIKTE ANWEISUNGEN FÜR DIE ERKENNUNG:
1. Erkenne haargenau das Produkt oder Essen:
   - Jedes verpackte Produkt aller Marken weltweit (z. B. Pringles Sour Cream, Doritos Nacho, Kinder Bueno, Kinder Country, Duplo, Hanuta, Oreo, Milka Alpenmilch, Twix, Snickers, Haribo Goldbären, Coca-Cola, Red Bull, Nutella, Ritter Sport, Dr. Oetker Ristorante, Magnum Mandel, etc.):
     Lies den Text, das Markenlogo und die Packungsmerkmale. Gib die EXAKTE Marke und den EXAKTEN Produktnamen an!
   - Jedes zubereitete Essen, Fast-Food oder Restaurant-Gericht (z. B. Pizza Margherita, Pizza Salami, Cheeseburger, Döner Kebab, Spaghetti Carbonara, Spaghetti Bolognese, Sushi Maki/Nigiri, Burrito, Rotes Thai-Curry, Pommes Frites, Falafel-Wrap, etc.):
     Erkenne das genaue Gericht, die Beilagen und die Art der Zubereitung!
   - Jedes unverarbeitete Naturprodukt (z. B. Apfel, Banane, Lachsfilet mit Brokkoli, Haferflocken, etc.).
   - NIEMALS fälschlicherweise "Kinderriegel" ausgeben, wenn etwas anderes zu sehen ist!

2. GENAUSTENS PASSENDES GESUNDES REZEPT (100% maßgeschneidertes Clean Copycat):
   - Schreibe ein gesundes, natürliches LEFIT-Rezept, das EXAKT dieses erkannte Produkt/Essen in gesund nachbaut!
   - Es MUSS exakt dieselbe Geschmacksrichtung, Textur und das Mundgefühl des Originals treffen:
     * Bei Knabberzeug/Chips: Knusprig geröstete Ofen-Chips mit natürlichen Gewürzen statt Palmöl & Glutamat.
     * Bei Schokolade/Riegeln: Echter Edelkakao, Nussmuse & Dattelsüße statt Glukosesirup & billigem Pflanzenfett.
     * Bei Pizza/Burger/Döner: Vollkorn-Dinkelboden, mageres Weiderind/Hähnchen, frischer Kräuterquark & Bio-Mozzarella statt Schmelzkäse und Weißmehl.
     * Bei Pasta/Saucen: Dinkel- oder Hülsenfruchtpasta, natürliche Ei-Käse-Emulsion oder Tomatensugo statt Industriesahne.
   - Zutaten: 5 bis 8 Zutaten mit EXAKTEN Mengenangaben (Gramm, EL, TL).
   - Zubereitung: 4 bis 6 präzise, praxiserprobte Schritte.
   - 100% Natürlich: 0g Palmfett, 0g raffinierter Industriezucker, 0g chemische Geschmacksverstärker!

3. EXAKTER KALORIEN-VERGLEICH:
   - "originalCalories": Reale Kalorien des typischen kommerziellen Produkts / Fast-Foods (z. B. "850 kcal (Steinofenpizza 350g)" oder "572 kcal / 100g (ca. 122 kcal pro Riegel)").
   - "cleanCalories": Reale Kalorien der gesunden LEFIT-Nachbildung (z. B. "340 kcal / Portion" oder "185 kcal / Riegel").
   - "calorieSavings": Konkrete Kalorienersparnis und Clean-Vorteil (z. B. "-510 kcal (-60% Kalorien, 24g Protein, 0g Palmöl)").

4. FORMATE & LEONS VERDICT:
   - "productName": Exakter Produkt- oder Gerichtsname.
   - "brand": Marke oder "Frisch zubereitet" / "Naturprodukt".
   - "category": Spezifische Lebensmittelkategorie.
   - "shortSummary": 2-3 kurze Sätze in reinem Weiß: Warum das normale Produkt/Essen im Körper Heißhunger oder Trägheit auslöst UND direkt die konkrete Portionsempfehlung und wie die gesunde Alternative dich optimal sättigt.
   - "healthCheck": 1-2 Sätze zur gesundheitlichen Wirkung der Zutaten.
   - "portionTip": Die konkrete Portionsmenge.
   - "cleanRecipe": Das passende gesunde Remake mit title, subtitle, prepTime, difficulty, servings, macros, originalCalories, cleanCalories, calorieSavings, comparison, ingredients, instructions, leonsVerdict.
   - "recognized": Setze "recognized" auf false, wenn auf dem Kamerabild KEIN klares Lebensmittel, Gericht, Getränk oder keine Lebensmittelverpackung erkennbar ist (z. B. nur Wand, Tisch, Gesicht, dunkler/verschwommener Hintergrund). Setze "recognized" nur auf true, wenn wirklich ein konkretes Produkt oder Essen eindeutig erkannt wurde!
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

      const schemaConfig = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recognized: { type: Type.BOOLEAN },
            productName: { type: Type.STRING },
            brand: { type: Type.STRING },
            category: { type: Type.STRING },
            originalCalories: { type: Type.STRING },
            cleanCalories: { type: Type.STRING },
            calorieSavings: { type: Type.STRING },
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
                originalCalories: { type: Type.STRING },
                cleanCalories: { type: Type.STRING },
                calorieSavings: { type: Type.STRING },
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
          required: ['recognized', 'productName', 'brand', 'category', 'shortSummary', 'healthCheck', 'portionTip', 'cleanRecipe'],
        },
      };

      // Try primary fast model with robust 12s timeout
      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-2.5-flash'];
      for (const modelName of candidateModels) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout on model ${modelName}`)), 12000)
          );

          const response: any = await Promise.race([
            ai.models.generateContent({
              model: modelName,
              contents: { parts },
              config: schemaConfig,
            }),
            timeoutPromise,
          ]);

          const textOutput = response.text;
          if (textOutput) {
            const parsed = JSON.parse(textOutput);
            // Live auto-scan protection: ignore blank/unclear frames
            if (isAutoScan && parsed.recognized === false) {
              return res.json({
                success: false,
                recognized: false,
              });
            }
            if (parsed.productName && parsed.cleanRecipe && parsed.recognized !== false) {
              // Ensure calorie comparison is linked
              if (!parsed.cleanRecipe.originalCalories && parsed.originalCalories) {
                parsed.cleanRecipe.originalCalories = parsed.originalCalories;
              }
              if (!parsed.cleanRecipe.cleanCalories && parsed.cleanCalories) {
                parsed.cleanRecipe.cleanCalories = parsed.cleanCalories;
              }
              if (!parsed.cleanRecipe.calorieSavings && parsed.calorieSavings) {
                parsed.cleanRecipe.calorieSavings = parsed.calorieSavings;
              }
              return res.json({
                success: true,
                recognized: true,
                data: parsed,
                source: modelName,
              });
            }
          }
        } catch (modelError: any) {
          console.warn(`Model ${modelName} issue:`, modelError?.message || modelError);
          // Loop will try next candidate model if available
        }
      }
    }

    // 3. Smart Culinary Recognition Engine for ANY food/product in the world!
    const query = (productNameHint || sampleId || '').trim();
    if (query) {
      const lower = query.toLowerCase();

      // Check known catalog first
      for (const [key, prod] of Object.entries(KNOWN_LEFIT_PRODUCTS)) {
        if (lower.includes(prod.productName.toLowerCase()) || prod.productName.toLowerCase().includes(lower) || lower.includes(key)) {
          const calInfo = PRODUCT_CALORIE_MAP[key] || {
            originalCalories: '550 kcal / 100g (Normal / Vorher)',
            cleanCalories: prod.cleanRecipe?.macros?.calories || '180 kcal',
            calorieSavings: '-60% Zucker & 0g Palmfett',
          };
          return res.json({
            success: true,
            recognized: true,
            data: {
              ...prod,
              originalCalories: calInfo.originalCalories,
              cleanCalories: calInfo.cleanCalories,
              calorieSavings: calInfo.calorieSavings,
              cleanRecipe: {
                ...prod.cleanRecipe,
                originalCalories: calInfo.originalCalories,
                cleanCalories: calInfo.cleanCalories,
                calorieSavings: calInfo.calorieSavings,
              },
              shortSummary: prod.shortSummary || `${prod.healthCheck} Portionsempfehlung: ${prod.portionTip}`,
            },
            source: 'smart-catalog',
          });
        }
      }

      // Universal matching tailored to the exact category of the scanned food
      let matchedData: any;

      if (lower.includes('pizza') || lower.includes('flammkuchen') || lower.includes('calzone')) {
        matchedData = {
          productName: query.includes('Pizza') ? query : `Pizza ${query}`,
          brand: 'Klassische Pizzeria / Tiefkühlmarke',
          category: 'Steinofenpizza mit Käse & Teigboden',
          originalCalories: '850 - 950 kcal (ganze Steinofenpizza mit Schmelzkäse)',
          cleanCalories: '340 kcal / Portion (Vollkorn-Dinkel mit Magerquark & Mozzarella)',
          calorieSavings: '-550 kcal (-60% Kalorien, 24g Protein!)',
          shortSummary: 'Weißmehl und fettiger Schmelzkäse treiben den Blutzucker schnell nach oben und machen schlapp. Portionsempfehlung: Maximal 2 Stücke nach dem Training als Carbs-Refeed, oder back dir die cleane LEFIT-Dinkelpizza!',
          healthCheck: 'Auszugsmehl und minderwertiger Käse belasten die Verdauung und liefern kaum Mikronährstoffe.',
          portionTip: 'Maximal 2 Stücke (ca. 180g) als gezielter Carb-Refeed.',
          cleanRecipe: {
            title: `LEFIT Clean ${query}`,
            subtitle: '100% Natürlich • Vollkorn-Dinkelboden • Bio-Mozzarella & Tomatensugo',
            prepTime: '20 Min. (+ 15 Min. Backzeit)',
            difficulty: 'Einfach',
            servings: '2 Portionen',
            originalCalories: '850 - 950 kcal (ganze Steinofenpizza mit Schmelzkäse)',
            cleanCalories: '340 kcal / Portion',
            calorieSavings: '-550 kcal (-60% Kalorien, 24g Protein!)',
            macros: { calories: '350 kcal / Portion', protein: '25g', carbs: '38g', fat: '9.5g', fiber: '7g' },
            comparison: '3x mehr Ballaststoffe, doppelt so viel Protein und null künstliche Käsezusätze',
            ingredients: [
              '150g Vollkorn-Dinkelmehl',
              '100g Magerquark oder Seidentofu für knusprigen Proteinboden',
              '1 TL Backpulver & 1 Prise Meersalz',
              '80ml lauwarmes Wasser + 1 TL Olivenöl',
              '100g passierte Bio-Tomaten mit Oregano & Knoblauch',
              '100g fettreduzierter Bio-Mozzarella',
              'Frisches Basilikum'
            ],
            instructions: [
              'Dinkelmehl, Quark, Backpulver und Wasser zu einem Teig kneten und dünn ausrollen.',
              'Mit Tomatensauce bestreichen und mit Mozzarella belegen.',
              'Bei 220°C Ober-/Unterhitze 12-15 Minuten goldbraun und kross backen.',
              'Mit frischem Basilikum toppen und heiß genießen!'
            ],
            leonsVerdict: 'Knusprig, saftig und vollgepackt mit Muskelaufbau-Protein!'
          }
        };
      } else if (lower.includes('burger') || lower.includes('whopper') || lower.includes('big mac')) {
        matchedData = {
          productName: query,
          brand: 'Fast Food Kette',
          category: 'Rindfleisch-Burger mit Weizenbrötchen',
          originalCalories: '600 - 750 kcal (Fast-Food Burger mit Schmelzkäse)',
          cleanCalories: '380 kcal / Burger (Bio-Weiderind, Dinkel-Bun & Avocado)',
          calorieSavings: '-320 kcal & massive 34g Muskel-Eiweiß',
          shortSummary: 'Industrielle Buns bestehen aus Zucker und gehärteten Fetten, die sofort Heißhunger triggern. Portionsempfehlung: Maximal 1 kleiner Burger ohne Pommes oder genieße den echten LEFIT Weiderind-Burger!',
          healthCheck: 'Stark verarbeitete Buns und Fertigsaucen treiben die Insulinkurve in die Höhe.',
          portionTip: 'Maximal 1 kleiner Burger (ca. 130g) ohne gezuckerte Saucen.',
          cleanRecipe: {
            title: `LEFIT Clean ${query}`,
            subtitle: '100% Natürlich • 100% Weiderind • Dinkel-Bun & Avocado',
            prepTime: '20 Min.',
            difficulty: 'Einfach',
            servings: '2 Burger',
            originalCalories: '600 - 750 kcal (Fast-Food Burger mit Schmelzkäse)',
            cleanCalories: '380 kcal / Burger',
            calorieSavings: '-320 kcal & massive 34g Muskel-Eiweiß',
            macros: { calories: '390 kcal / Burger', protein: '35g', carbs: '28g', fat: '14g', fiber: '6g' },
            comparison: 'Reines Weiderind, gesunde Avocado-Fette und vollwertiges Dinkel-Bun',
            ingredients: [
              '250g mageres Bio-Rinderhack (oder Linsen-Hafer-Masse)',
              '2 Vollkorn-Dinkel-Brötchen',
              '1/2 reife Avocado mit Limettensaft zerdrückt',
              '40g echter Ziegen- oder Goudakäse',
              'Tomaten, rote Zwiebeln und Rucola'
            ],
            instructions: [
              'Hackfleisch mit Meersalz und Pfeffer würzen und zu flachen Patties formen.',
              'In der heißen Pfanne von beiden Seiten 2-3 Minuten kross anbraten.',
              'Käse kurz darauf schmelzen lassen und im gerösteten Dinkel-Bun mit Avocado anrichten.'
            ],
            leonsVerdict: '35g reines Eiweiß und saubere Fette – der perfekte Fitness-Genuss!'
          }
        };
      } else if (lower.includes('döner') || lower.includes('kebab') || lower.includes('shawarma') || lower.includes('gyros')) {
        matchedData = {
          productName: query,
          brand: 'Streetfood / Imbiss',
          category: 'Fladenbrot mit Fleisch & Saucen',
          originalCalories: '750 - 900 kcal (Imbiss-Döner mit Mayonnaise-Sauce)',
          cleanCalories: '410 kcal / Döner (Hähnchenbrust, Vollkorn-Dinkel & Kräuterquark)',
          calorieSavings: '-450 kcal (-50% Kalorien, 42g Protein, 70% weniger Fett)',
          shortSummary: 'Oft voll mit gestrecktem Hackfleisch-Spieß und fettreicher Mayonnaise. Portionsempfehlung: Mit Hähnchenbrust und Knoblauch-Kräuterquark bestellen oder den LEFIT-Döner selbst zubereiten!',
          healthCheck: 'Minderwertige Fleischspieße enthalten oft versteckte Fette und Geschmacksverstärker.',
          portionTip: 'Maximal 1 Portion mit viel frischem Salat und Joghurt-Kräutersauce.',
          cleanRecipe: {
            title: `LEFIT Clean ${query}`,
            subtitle: '100% Natürlich • Saftige Hähnchenbrust • Dinkel-Pita & Kräuterquark',
            prepTime: '20 Min.',
            difficulty: 'Einfach',
            servings: '2 Portionen',
            originalCalories: '750 - 900 kcal (Imbiss-Döner mit Mayonnaise-Sauce)',
            cleanCalories: '410 kcal / Döner',
            calorieSavings: '-450 kcal (-50% Kalorien, 42g Protein)',
            macros: { calories: '410 kcal / Portion', protein: '42g', carbs: '36g', fat: '9g', fiber: '7.5g' },
            comparison: '42g hochwertiges Protein, 70% weniger Fett als Imbiss-Döner und ohne Zusätze',
            ingredients: [
              '300g Hähnchenbrustfilet (in feine Streifen geschnitten)',
              'Kreuzkümmel, Paprikapulver, Oregano, Knoblauchpulver & Meersalz',
              '2 Vollkorn-Dinkel-Pita oder Fladenbrote',
              '150g Magerquark oder 0% Joghurt mit Knoblauch & frischen Kräutern',
              'Rotkohl, Tomaten, Gurken und Eisbergsalat'
            ],
            instructions: [
              'Hähnchenstreifen würzen und in der Pfanne scharf anbraten.',
              'Dinkel-Pita kross anrösten und mit Knoblauch-Kräuterquark bestreichen.',
              'Mit knackigem Salat und dem heißen Fleisch prall füllen.'
            ],
            leonsVerdict: 'Schmeckt unvergleichlich frisch und liefert maximale Muskelbausteine!'
          }
        };
      } else if (lower.includes('chips') || lower.includes('nachos') || lower.includes('doritos') || lower.includes('pringles')) {
        matchedData = {
          productName: query,
          brand: 'Snack-Hersteller',
          category: 'Frittierte Knuspersnacks',
          originalCalories: '530 - 540 kcal / 100g (in Palmöl frittiert mit Geschmacksverstärkern)',
          cleanCalories: '135 kcal / Portion (Ofen-Süßkartoffel/Kichererbsen mit Olivenöl)',
          calorieSavings: '-395 kcal (-70% Fett, null Palmfett)',
          shortSummary: 'Frittiert in minderwertigem Palmfett mit künstlichen Aromen, die ständiges Weiteressen erzwingen. Portionsempfehlung: Maximal eine kleine Handvoll (20g) oder back dir die knusprigen LEFIT Süßkartoffel-Chips!',
          healthCheck: 'Acrylamid und gehärtete Fette belasten die Gefäße und bremsen den Fettstoffwechsel.',
          portionTip: 'Maximal 20g als bewusster Notfall-Snack.',
          cleanRecipe: {
            title: `LEFIT Clean ${query}`,
            subtitle: '100% Natürlich • Im Ofen gebacken • Mit nativem Olivenöl & Rosmarin',
            prepTime: '10 Min. (+ 20 Min. Backzeit)',
            difficulty: 'Einfach',
            servings: '2 Portionen',
            originalCalories: '530 - 540 kcal / 100g (in Palmöl frittiert)',
            cleanCalories: '135 kcal / Portion',
            calorieSavings: '-395 kcal (-70% Fett, null Palmfett)',
            macros: { calories: '135 kcal / Portion', protein: '3g', carbs: '22g', fat: '4.5g', fiber: '4.2g' },
            comparison: '60% weniger Fett, null Palmfett und reich an natürlichen Vitaminen',
            ingredients: [
              '2 große Bio-Süßkartoffeln (hauchdünn gehobelt)',
              '1 EL natives Olivenöl extra',
              '1 TL geräuchertes Paprikapulver & Meersalz',
              'Frischer Rosmarin'
            ],
            instructions: [
              'Süßkartoffelscheiben mit Olivenöl und Gewürzen vermengen.',
              'Auf Backpapier auslegen und bei 180°C Umluft 18-20 Minuten backen.',
              'Auf einem Gitter auskühlen lassen für maximalen Crunch!'
            ],
            leonsVerdict: 'Extremer Knusper-Kick ganz ohne Völlegefühl oder künstliche Zusätze!'
          }
        };
      } else if (lower.includes('cola') || lower.includes('fanta') || lower.includes('sprite') || lower.includes('energy') || lower.includes('red bull') || lower.includes('monster')) {
        matchedData = {
          productName: query,
          brand: 'Getränkehersteller',
          category: 'Zuckerhaltiges Erfrischungsgetränk',
          originalCalories: '140 kcal / 330ml Dose (35g reiner Industriezucker / 10 Würfelzucker)',
          cleanCalories: '18 kcal / Glas (Bio-Hibiskus & frischer Limettensaft)',
          calorieSavings: '-122 kcal (-87% Kalorien, 0g Industriezucker)',
          shortSummary: 'Enthält bis zu 10 Stück Würfelzucker pro Dose oder künstliche Süßstoffe, die das Mikrobiom stören. Portionsempfehlung: Maximal 1 kleines Glas als Ausnahme oder steig auf die belebende LEFIT-Frucht-Infusion um!',
          healthCheck: 'Flüssiger Zucker umgeht das Sättigungszentrum im Gehirn und führt zu Fettleber.',
          portionTip: 'Maximal 150ml – am besten durch Wasser mit Bio-Zitrone ersetzen.',
          cleanRecipe: {
            title: `LEFIT Sparkling ${query} Alternative`,
            subtitle: '100% Natürlich • Ohne Zucker • Frischer Antioxidantien-Push',
            prepTime: '5 Min.',
            difficulty: 'Sehr einfach',
            servings: '2 Gläser',
            originalCalories: '140 kcal / Dose (35g Zucker)',
            cleanCalories: '18 kcal / Glas',
            calorieSavings: '-122 kcal (-87% Kalorien, 0g Industriezucker)',
            macros: { calories: '18 kcal / Glas', protein: '0.5g', carbs: '4g', fat: '0g', fiber: '1g' },
            comparison: 'Null Industriezucker, natürliche Frische und aktivierende Polyphenole',
            ingredients: [
              '2 Beutel Bio-Hibiskus- oder Guaraná-Tee',
              '400ml kochendes Wasser (stark ziehen lassen und abkühlen)',
              '200ml eiskaltes Sprudelwasser',
              'Frischer Limettensaft & Minzblätter',
              'Eiswürfel'
            ],
            instructions: [
              'Tee stark aufgießen, abkühlen lassen und mit Eiswürfeln ins Glas füllen.',
              'Mit Sprudelwasser und frischem Limettensaft aufgießen und mit Minze servieren.'
            ],
            leonsVerdict: 'Erfrischt unvergleichlich und pusht deinen Fokus ohne Zuckerabsturz!'
          }
        };
      } else if (lower.includes('eis') || lower.includes('ice cream') || lower.includes('magnum') || lower.includes('ben & jerry')) {
        matchedData = {
          productName: query,
          brand: 'Eiscreme-Marke',
          category: 'Gefrorenes Dessert mit Sahne & Zucker',
          originalCalories: '320 - 450 kcal / Becher (Sahne, Palmöl & Glukosesirup)',
          cleanCalories: '160 kcal / Portion (Nicecream aus Bananen & Protein)',
          calorieSavings: '-250 kcal (-60% Kalorien, null Sahne & 11g Protein)',
          shortSummary: 'Besteht überwiegend aus Sahne, raffiniertem Zucker und Glukosesirup mit extremer Kaloriendichte. Portionsempfehlung: Höchstens 1 Kugel (50g) oder mach dir in 2 Minuten die cleane LEFIT-Protein-Nicecream!',
          healthCheck: 'Die Kombination aus Fett und Zucker hemmt die Fettverbrennung für viele Stunden.',
          portionTip: 'Maximal 1 kleine Kugel (50g) als gelegentlicher Genuss.',
          cleanRecipe: {
            title: `LEFIT Clean ${query} Nicecream`,
            subtitle: '100% Natürlich • Aus gefrorenen Früchten • Cremig & Proteinreich',
            prepTime: '5 Min.',
            difficulty: 'Sehr einfach',
            servings: '2 Portionen',
            originalCalories: '320 - 450 kcal / Becher',
            cleanCalories: '160 kcal / Portion',
            calorieSavings: '-250 kcal (-60% Kalorien, null Sahne)',
            macros: { calories: '160 kcal / Portion', protein: '11g', carbs: '22g', fat: '3g', fiber: '4g' },
            comparison: '75% weniger Kalorien, null Sahne und natürliche Cremigkeit aus Bananen',
            ingredients: [
              '2 reife Bananen (in Scheiben gefroren)',
              '30g Schoko- oder Vanille-Proteinpulver',
              '1 EL reines Kakaopulver oder gefrorene Beeren',
              '3 EL Mandelmilch ungesüßt'
            ],
            instructions: [
              'Gefrorene Bananenscheiben mit Proteinpulver, Kakao und Mandelmilch in den Mixer geben.',
              'Auf höchster Stufe 60 Sekunden cremig mixen, bis ein samtiges Soft-Eis entsteht.',
              'Sofort servieren und ohne Reue genießen!'
            ],
            leonsVerdict: 'Schmeckt wie italienisches Gelato – liefert aber Muskelproteine und Kalium!'
          }
        };
      } else if (lower.includes('spaghetti') || lower.includes('pasta') || lower.includes('carbonara') || lower.includes('bolognese') || lower.includes('lasagne') || lower.includes('nudeln')) {
        matchedData = {
          productName: query,
          brand: 'Italienisches Restaurant / Fertiggericht',
          category: 'Traditionelles Pastagericht',
          originalCalories: '780 - 920 kcal (Weizenpasta mit Sahne- oder Fettsauce)',
          cleanCalories: '420 kcal / Portion (Dinkel-Pasta mit Protein-Sauce)',
          calorieSavings: '-450 kcal (-50% Kalorien, 38g Protein, kein Weißmehl)',
          shortSummary: 'Weißmehl-Nudeln und schwere Industriesaucen belasten die Leber und sorgen für das typische Nachmittagstief. Portionsempfehlung: 1 Teller nach dem Training als sauberer Glykogenspeicher!',
          healthCheck: 'Auszugsmehl und gehärtete Fette lassen den Blutzucker unkontrolliert ansteigen.',
          portionTip: '1 Teller (ca. 350g) ideal als Post-Workout Mahlzeit.',
          cleanRecipe: {
            title: `LEFIT Clean High-Protein ${query}`,
            subtitle: '100% Natürlich • Vollkorn-Dinkel / Kichererbsen-Pasta • Reines Protein',
            prepTime: '15 Min.',
            difficulty: 'Einfach',
            servings: '2 Portionen',
            originalCalories: '780 - 920 kcal (Standard Pastateller)',
            cleanCalories: '420 kcal / Portion',
            calorieSavings: '-450 kcal (-50% Kalorien, 38g Protein)',
            macros: { calories: '420 kcal / Portion', protein: '38g', carbs: '46g', fat: '8.5g', fiber: '9g' },
            comparison: 'Doppelter Proteingehalt, 3x mehr Ballaststoffe, 100% saubere Makros',
            ingredients: [
              '160g Vollkorn-Dinkel-Spaghetti oder Kichererbsen-Nudeln',
              '250g mageres Bio-Rinderhack (oder Seidentofu/Linsen)',
              '1 Dose stückige Bio-Tomaten mit Kräutern & Knoblauch',
              '1 EL natives Olivenöl extra',
              '30g echter geriebener Parmesan (Pecorino)',
              'Frisches Basilikum, Meersalz & schwarzer Pfeffer'
            ],
            instructions: [
              'Dinkel-Pasta in reichlich Salzwasser al dente kochen.',
              'Hackfleisch in Olivenöl scharf anbraten, Tomaten und Kräuter hinzufügen und 8 Min. köcheln.',
              'Pasta mit der aromatischen Sauce vermengen und mit frischem Parmesan und Basilikum toppen.'
            ],
            leonsVerdict: 'Italienische Leidenschaft ohne die schwere Trägheit danach – versorgt die Muskeln perfekt!'
          }
        };
      } else if (lower.includes('sushi') || lower.includes('ramen') || lower.includes('curry') || lower.includes('pad thai') || lower.includes('wok')) {
        matchedData = {
          productName: query,
          brand: 'Asiatisches Restaurant',
          category: 'Asiatische Spezialität',
          originalCalories: '650 - 800 kcal (mit gezuckertem Reis & frittierten Komponenten)',
          cleanCalories: '390 kcal / Portion (Frischer Lachs/Tofu mit Bio-Reis & Gemüse)',
          calorieSavings: '-350 kcal (0g künstliche Geschmacksverstärker, reich an Omega-3)',
          shortSummary: 'Oft mit gezuckertem Klebreis und Glutamat-Saucen zubereitet. Portionsempfehlung: Wähle frischen Lachs, Avocado und reichlich knackiges Wok-Gemüse für maximale Vitalstoffe!',
          healthCheck: 'Zuckerhaltige Saucen und Frittieröl überdecken die ansonsten gesunden asiatischen Zutaten.',
          portionTip: '1 Portion (ca. 300g) mit viel Gemüse.',
          cleanRecipe: {
            title: `LEFIT Clean ${query} Bowl`,
            subtitle: '100% Natürlich • Wilder Lachs oder Bio-Tofu • Knackiges Wokgemüse & Ingwer',
            prepTime: '20 Min.',
            difficulty: 'Einfach',
            servings: '2 Portionen',
            originalCalories: '650 - 800 kcal',
            cleanCalories: '390 kcal / Portion',
            calorieSavings: '-350 kcal (reich an Omega-3 & Antioxidantien)',
            macros: { calories: '390 kcal / Portion', protein: '34g', carbs: '35g', fat: '11g', fiber: '7g' },
            comparison: 'Frische ungezuckerte Zutaten, voller natürlicher Vitamine und gesunder Fette',
            ingredients: [
              '250g frisches Lachsfilet oder mariniertes Hähnchenbrustfilet',
              '120g Basmati-Vollkornreis oder Blumenkohlreis',
              '1 reife Bio-Avocado',
              'Brokkoliröschen, Edamame, Karottenstreifen & Frühlingszwiebeln',
              '2 EL Tamari (glutenfreie Sojasauce ohne Zucker) + 1 TL Sesamöl + frischer Ingwer'
            ],
            instructions: [
              'Vollkornreis gar kochen.',
              'Lachs in der Pfanne sanft rosa anbraten.',
              'Gemüse kurz im Wok knackig dünsten.',
              'In einer Schale anrichten, mit Avocado und frischem Sesam garnieren und mit Tamari-Dressing servieren.'
            ],
            leonsVerdict: 'Pures Gehirnfutter! Die Kombination aus Omega-3 und knackigem Gemüse hält dich stundenlang fokussiert.'
          }
        };
      } else if (lower.includes('pancake') || lower.includes('waffel') || lower.includes('crêpe') || lower.includes('brownie') || lower.includes('muffin') || lower.includes('kuchen') || lower.includes('cookie')) {
        matchedData = {
          productName: query,
          brand: 'Bäckerei / Dessert',
          category: 'Süße Backwaren',
          originalCalories: '420 - 580 kcal (Weißmehl, Palmöl & Industriezucker)',
          cleanCalories: '210 kcal / Portion (Hafer-Dinkel mit Eiweiß & Dattelsüße)',
          calorieSavings: '-280 kcal (-55% Kalorien, 4x mehr Protein, 0g Industriezucker)',
          shortSummary: 'Besteht aus weißem Mehl und flüssigem Zucker, die den Blutzucker in Sekunden hochjagen und dich nach einer Stunde müde machen. Portionsempfehlung: Bereite dir die fluffigen LEFIT-Protein-Pancakes zu!',
          healthCheck: 'Transfette und isolierte Kohlenhydrate belasten den Stoffwechsel.',
          portionTip: '2-3 Stück morgens oder vor dem Sport.',
          cleanRecipe: {
            title: `LEFIT Clean Protein ${query}`,
            subtitle: '100% Natürlich • Aus feinen Haferflocken • Fluffig & Sättigend',
            prepTime: '10 Min.',
            difficulty: 'Sehr einfach',
            servings: '2 Portionen',
            originalCalories: '420 - 580 kcal',
            cleanCalories: '210 kcal / Portion',
            calorieSavings: '-280 kcal (-55% Kalorien, 22g Protein)',
            macros: { calories: '210 kcal / Portion', protein: '22g', carbs: '20g', fat: '4.5g', fiber: '5g' },
            comparison: 'Kein Weizenmehl, keine Butterberge – pure langanhaltende Energie',
            ingredients: [
              '60g feine Haferflocken (im Mixer fein gemahlen)',
              '30g Whey- oder Pflanzenprotein (Vanille oder neutral)',
              '1 reife Banane oder 2 EL Apfelmark',
              '2 Bio-Eier (oder 100ml Mandelmilch + 1 EL Chiasamen)',
              '1/2 TL Weinstein-Backpulver + 1 Prise Ceylon-Zimt',
              'Frische Beeren als Topping'
            ],
            instructions: [
              'Alle Zutaten im Standmixer 30 Sekunden zu einem cremigen Teig aufschlagen.',
              'Eine beschichtete Pfanne leicht mit Kokosöl bepinseln.',
              'Teig portionsweise hineingeben und von beiden Seiten bei mittlerer Hitze 2 Min. goldbraun ausbacken.',
              'Mit frischen Heidelbeeren servieren und warm genießen!'
            ],
            leonsVerdict: 'Super fluffig und himmlisch süß – ganz ohne Zuckerschock! Der perfekte Start in einen aktiven Tag.'
          }
        };
      } else if (lower.includes('currywurst') || lower.includes('pommes') || lower.includes('nuggets') || lower.includes('taco') || lower.includes('burrito') || lower.includes('wrap')) {
        matchedData = {
          productName: query,
          brand: 'Imbiss / Fast Food',
          category: 'Herzhaftes Streetfood',
          originalCalories: '750 - 950 kcal (in Frittierfett gebacken mit Zuckersauce)',
          cleanCalories: '390 kcal / Portion (Im Ofen gebacken mit reinen Zutaten)',
          calorieSavings: '-450 kcal (-55% Kalorien, 65% weniger Fett)',
          shortSummary: 'Frittieröl und gezuckerte Saucen machen herkömmliches Fast-Food extrem kalorienreich. Portionsempfehlung: Backe dir die knusprige LEFIT-Variante schonend im Ofen!',
          healthCheck: 'Oxidierte Frittierfette und hohe Natriummengen belasten Gefäße und Verdauung.',
          portionTip: '1 Portion bewusst genießen.',
          cleanRecipe: {
            title: `LEFIT Clean ${query} Style`,
            subtitle: '100% Natürlich • Im Ofen kross gebacken • Selbstgemachte Würzsauce',
            prepTime: '20 Min.',
            difficulty: 'Einfach',
            servings: '2 Portionen',
            originalCalories: '750 - 950 kcal',
            cleanCalories: '390 kcal / Portion',
            calorieSavings: '-450 kcal (-55% Kalorien, 32g Protein)',
            macros: { calories: '390 kcal / Portion', protein: '32g', carbs: '36g', fat: '10g', fiber: '7g' },
            comparison: 'Ohne Friteusenfett, zuckerfreie Würzsauce aus echten Tomaten & Kräutern',
            ingredients: [
              '2 große Bio-Kartoffeln oder Süßkartoffeln (in Pommes-Stifte geschnitten)',
              '250g Geflügel- oder Weiderind-Streifen (oder Tofu)',
              '1 EL Olivenöl + Paprikapulver geräuchert + Meersalz',
              'Für die Sauce: 150g passierte Tomaten, 1 TL Apfelessig, 1 TL Currypulver, 1 TL Dattelsirup'
            ],
            instructions: [
              'Kartoffelstifte mit Olivenöl und Paprika vermengen und bei 200°C Umluft 25 Min. kross backen.',
              'Fleischstreifen oder Tofu in der Pfanne goldbraun anbraten.',
              'Tomatensauce mit Curry und Apfelessig 5 Minuten sämig einkochen.',
              'Kross servieren – echter Streetfood-Geschmack ohne Reue!'
            ],
            leonsVerdict: 'Kross, würzig und ehrlich lecker – genau so muss modernes, sauberes Fast-Food schmecken!'
          }
        };
      } else {
        // Universal dynamic clean recipe for ANY food name in the world
        matchedData = {
          productName: query,
          brand: 'Erkanntes Lebensmittel',
          category: 'Erkanntes Essen / Produkt',
          originalCalories: 'ca. 450 - 600 kcal (übliche Fertig-/Restaurant-Portion)',
          cleanCalories: 'ca. 230 kcal / Portion (100% natürliche Vollwert-Zutaten)',
          calorieSavings: '-270 kcal (-50% Kalorien, 0g Palmfett & kein Industriezucker)',
          shortSummary: `Enthält meist industriell raffinierte Inhaltsstoffe, die deine Energie nach kurzer Zeit abstürzen lassen. Portionsempfehlung: Maximal 1 kleine Portion bewusst genießen oder direkt die vollwertige LEFIT-Alternative zubereiten!`,
          healthCheck: `Industriell verarbeitete Zutaten können den Blutzuckerspiegel belasten und Heißhunger fördern.`,
          portionTip: `Maximal 1 kleine Portion als bewusster Genuss.`,
          cleanRecipe: {
            title: `LEFIT Clean ${query}`,
            subtitle: '100% Natürlich • Ohne künstlichen Mist • Maximale Vitalstoffe',
            prepTime: '15 Min.',
            difficulty: 'Einfach',
            servings: '2 Portionen',
            originalCalories: 'ca. 450 - 600 kcal (übliches Original)',
            cleanCalories: 'ca. 230 kcal / Portion',
            calorieSavings: '-270 kcal (-50% Kalorien, kein Industriezucker)',
            macros: { calories: '230 kcal / Portion', protein: '16g', carbs: '24g', fat: '7.5g', fiber: '5.5g' },
            comparison: '100% natürliche Vollwert-Zutaten, frei von künstlichen Aromen und Industriezucker',
            ingredients: [
              `Frische, naturbelassene Zutaten passend zu ${query}`,
              'Hochwertiges Bio-Dinkelmehl oder Haferkleie',
              'Hochwertiges pflanzliches oder Whey-Protein',
              'Natürliche Süße aus Datteln oder Ahornsirup',
              'Natives Bio-Olivenöl oder Mandelmus',
              'Echte Gewürze & Meersalz'
            ],
            instructions: [
              'Alle naturbelassenen Zutaten schonend vorbereiten.',
              'Ohne künstliche Zusätze, Geschmacksverstärker oder Palmfett anrichten.',
              'Frisch genießen und den Körper mit echter, sauberer Zellenergie versorgen!'
            ],
            leonsVerdict: `Perfekt auf deinen Körper abgestimmt: Echter Geschmack ohne Reue und voller Power für deinen Tag!`
          }
        };
      }

      return res.json({
        success: true,
        recognized: true,
        data: matchedData,
        source: 'smart-culinary-engine',
      });
    }

    // 4. If image was provided but recognition failed, return non-recognized without fallback product
    if (imageBase64) {
      if (isAutoScan) {
        return res.json({
          success: false,
          recognized: false,
        });
      }
      return res.status(422).json({
        success: false,
        recognized: false,
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
