// Die Todesursachen, wie sie in data/causes.json stehen (Global Health Estimates der WHO)
// plus die aus der Rückfalltabelle in app/globe/persona.ts.
//
// Der Schlüssel ist genau das englische Label aus der Datendatei: es ist die Kennung und ändert
// sich nie. Eine fehlende Ursache erscheint auf Englisch — siehe causeLabel() — sodass ein neuer
// Export Ursachen hinzufügen kann, ohne etwas zu zerbrechen. causes.test.ts prüft, dass von
// den heute vorhandenen keine fehlt.
//
// Das Register ist das des Satzes, in dem sie landen: „Frau, 84, Brustkrebs – Spanien“. Sie
// stehen deshalb durchweg im artikellosen Nominativ — auch dort, wo das englische Label selbst
// einen unbestimmten Artikel führt („a stroke“), weil ein Artikel in dieser Apposition im
// Akkusativ landet und nach dem Objekt eines Verbs klingt, das im Satz gar nicht vorkommt.

export const causesDe: Record<string, string> = {
  // --- Neubildungen -------------------------------------------------------
  "breast cancer": "Brustkrebs",
  "cervical cancer": "Gebärmutterhalskrebs",
  "uterine cancer": "Gebärmutterkrebs",
  "prostate cancer": "Prostatakrebs",
  "colorectal cancer": "Darmkrebs",
  "lip and oral cavity cancer": "Lippen- und Mundhöhlenkrebs",
  "nasopharynx cancer": "Nasenrachenkrebs",
  "gallbladder and biliary tract cancer": "Gallenblasen- und Gallenwegskrebs",
  "pancreatic cancer": "Bauchspeicheldrüsenkrebs",
  "malignant skin melanoma": "malignes Melanom",
  "ovarian cancer": "Eierstockkrebs",
  "testicular cancer": "Hodenkrebs",
  "kidney cancer": "Nierenkrebs",
  "bladder cancer": "Blasenkrebs",
  "brain and central nervous system cancer": "Hirn- und ZNS-Krebs",
  "thyroid cancer": "Schilddrüsenkrebs",
  "hodgkin lymphoma": "Hodgkin-Lymphom",
  "non-hodgkin lymphoma": "Non-Hodgkin-Lymphom",
  "multiple myeloma": "multiples Myelom",
  leukaemia: "Leukämie",
  "other malignant neoplasms": "andere bösartige Neubildungen",
  "other neoplasms": "andere Neubildungen",
  "esophageal cancer": "Speiseröhrenkrebs",
  "stomach cancer": "Magenkrebs",
  "liver cancer": "Leberkrebs",
  "lung cancer": "Lungenkrebs",

  // --- Herz-Kreislauf -----------------------------------------------------
  "a stroke": "Schlaganfall",
  "hypertensive heart disease": "hypertensive Herzkrankheit",
  "cardiomyopathy and myocarditis": "Kardiomyopathie und Myokarditis",
  "other cardiovascular and circulatory diseases": "andere Herz-Kreislauf-Erkrankungen",
  "rheumatic heart disease": "rheumatische Herzkrankheit",
  "ischaemic heart disease": "koronare Herzkrankheit",

  // --- Atemwege -----------------------------------------------------------
  COPD: "COPD",
  asthma: "Asthma",
  "other chronic respiratory diseases": "andere chronische Atemwegserkrankungen",
  "lower respiratory infection": "Infektion der unteren Atemwege",
  "upper respiratory infections": "Infektionen der oberen Atemwege",

  // --- Infektionen --------------------------------------------------------
  malaria: "Malaria",
  leishmaniasis: "Leishmaniose",
  "african trypanosomiasis": "afrikanische Trypanosomiasis",
  dengue: "Dengue",
  rabies: "Tollwut",
  tuberculosis: "Tuberkulose",
  "HIV/AIDS": "HIV/Aids",
  "a diarrhoeal disease": "Durchfallerkrankung",
  "otitis media": "Mittelohrentzündung",
  meningitis: "Hirnhautentzündung",
  encephalitis: "Gehirnentzündung",
  pertussis: "Keuchhusten",
  tetanus: "Wundstarrkrampf",
  measles: "Masern",
  "acute hepatitis": "akute Hepatitis",
  "other unspecified infectious diseases": "andere nicht näher bezeichnete Infektionskrankheiten",
  "sexually transmitted infections excluding hiv": "sexuell übertragbare Infektionen außer HIV",
  "covid-19": "Covid-19",

  // --- Verdauung und Nieren -----------------------------------------------
  "upper digestive system diseases": "Erkrankungen des oberen Verdauungstrakts",
  appendicitis: "Blinddarmentzündung",
  "paralytic ileus and intestinal obstruction": "paralytischer Ileus und Darmverschluss",
  "inflammatory bowel disease": "chronisch-entzündliche Darmerkrankung",
  pancreatitis: "Bauchspeicheldrüsenentzündung",
  "cirrhosis and other chronic liver diseases": "Leberzirrhose und andere chronische Leberleiden",
  "other digestive diseases": "andere Verdauungskrankheiten",
  "kidney disease": "Nierenerkrankung",
  "urinary diseases and male infertility": "Harnwegserkrankungen und männliche Unfruchtbarkeit",

  // --- Stoffwechsel, Blut, Immunsystem ------------------------------------
  diabetes: "Diabetes",
  "hemoglobinopathies and hemolytic anemias": "Hämoglobinopathien und hämolytische Anämien",
  "endocrine, metabolic, blood, and immune disorders":
    "endokrine, Stoffwechsel-, Blut- und Immunerkrankungen",
  "protein-energy malnutrition": "Protein-Energie-Mangelernährung",

  // --- Nerven und Psyche ---------------------------------------------------
  "Alzheimer's & dementia": "Alzheimer und Demenz",
  "parkinson's disease": "Parkinson",
  "idiopathic epilepsy": "idiopathische Epilepsie",
  "other neurological disorders": "andere neurologische Erkrankungen",
  "alcohol use disorders": "Alkoholabhängigkeit",
  "drug use disorders": "Drogenabhängigkeit",

  // --- Bewegungsapparat und Haut ------------------------------------------
  "other musculoskeletal disorders": "andere Erkrankungen des Bewegungsapparats",

  // --- Mutter und Kind ------------------------------------------------------
  "maternal complications": "Komplikationen bei der Geburt",
  "neonatal complications": "Neugeborenenkomplikationen",
  "birth asphyxia": "Geburtsasphyxie",
  "a congenital condition": "angeborene Erkrankung",
  "sudden infant death syndrome": "plötzlicher Kindstod",

  // --- Verletzungen und Gewalt ----------------------------------------------
  "conflict and terrorism": "Krieg und Terrorismus",
  "a road injury": "Verkehrsunfall",
  falls: "Sturz",
  drowning: "Ertrinken",
  "fire, heat, and hot substances": "Feuer, Hitze und heiße Stoffe",
  poisonings: "Vergiftungen",
  "exposure to mechanical forces": "Einwirkung mechanischer Kräfte",
  "other unintentional injuries": "andere unbeabsichtigte Verletzungen",
  suicide: "Suizid",
  "interpersonal violence": "zwischenmenschliche Gewalt",
  "exposure to forces of nature": "Naturgewalten",

  // --- Sammelposten ----------------------------------------------------------
  "other causes": "andere Ursachen",
};
