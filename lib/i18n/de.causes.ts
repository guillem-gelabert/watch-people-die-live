// Die Todesursachen, wie sie in data/causes.json stehen (IHME Global Burden of Disease,
// Level-3-Ursachen) plus die aus der Rückfalltabelle in app/globe/persona.ts.
//
// Der Schlüssel ist genau das englische Label aus der Datendatei: es ist die Kennung und ändert
// sich nie. Eine fehlende Ursache erscheint auf Englisch — siehe causeLabel() — sodass ein neuer
// GBD-Export Ursachen hinzufügen kann, ohne etwas zu zerbrechen. causes.test.ts prüft, dass von
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
  "eye cancer": "Augenkrebs",
  "soft tissue and other extraosseous sarcomas": "Weichteil- und andere extraossäre Sarkome",
  "malignant neoplasm of bone and articular cartilage":
    "bösartige Neubildung von Knochen und Gelenkknorpel",
  "neuroblastoma and other peripheral nervous cell tumors":
    "Neuroblastom und andere periphere Nervenzelltumoren",
  "nasopharynx cancer": "Nasenrachenkrebs",
  "other pharynx cancer": "anderer Rachenkrebs",
  "gallbladder and biliary tract cancer": "Gallenblasen- und Gallenwegskrebs",
  "pancreatic cancer": "Bauchspeicheldrüsenkrebs",
  "malignant skin melanoma": "malignes Melanom",
  "non-melanoma skin cancer": "heller Hautkrebs",
  "ovarian cancer": "Eierstockkrebs",
  "testicular cancer": "Hodenkrebs",
  "kidney cancer": "Nierenkrebs",
  "bladder cancer": "Blasenkrebs",
  "brain and central nervous system cancer": "Hirn- und ZNS-Krebs",
  "thyroid cancer": "Schilddrüsenkrebs",
  mesothelioma: "Mesotheliom",
  "hodgkin lymphoma": "Hodgkin-Lymphom",
  "non-hodgkin lymphoma": "Non-Hodgkin-Lymphom",
  "multiple myeloma": "multiples Myelom",
  leukaemia: "Leukämie",
  "other malignant neoplasms": "andere bösartige Neubildungen",
  "other neoplasms": "andere Neubildungen",
  "esophageal cancer": "Speiseröhrenkrebs",
  "stomach cancer": "Magenkrebs",
  "liver cancer": "Leberkrebs",
  "larynx cancer": "Kehlkopfkrebs",
  "lung cancer": "Lungenkrebs",

  // --- Herz-Kreislauf -----------------------------------------------------
  "a stroke": "Schlaganfall",
  "hypertensive heart disease": "hypertensive Herzkrankheit",
  "cardiomyopathy and myocarditis": "Kardiomyopathie und Myokarditis",
  "atrial fibrillation and flutter": "Vorhofflimmern und -flattern",
  "aortic aneurysm": "Aortenaneurysma",
  "lower extremity peripheral arterial disease": "periphere arterielle Verschlusskrankheit",
  endocarditis: "Endokarditis",
  "non-rheumatic valvular heart disease": "nichtrheumatische Herzklappenerkrankung",
  "other cardiovascular and circulatory diseases": "andere Herz-Kreislauf-Erkrankungen",
  "rheumatic heart disease": "rheumatische Herzkrankheit",
  "ischaemic heart disease": "koronare Herzkrankheit",
  "pulmonary arterial hypertension": "pulmonale arterielle Hypertonie",

  // --- Atemwege -----------------------------------------------------------
  COPD: "COPD",
  pneumoconiosis: "Pneumokoniose",
  asthma: "Asthma",
  "interstitial lung disease and pulmonary sarcoidosis":
    "interstitielle Lungenerkrankung und Sarkoidose",
  "other chronic respiratory diseases": "andere chronische Atemwegserkrankungen",
  "lower respiratory infection": "Infektion der unteren Atemwege",
  "upper respiratory infections": "Infektionen der oberen Atemwege",

  // --- Infektionen --------------------------------------------------------
  "typhoid and paratyphoid": "Typhus und Paratyphus",
  "invasive non-typhoidal salmonella (ints)": "invasive nichttyphoidale Salmonellose",
  "zika virus": "Zika-Virus",
  "varicella and herpes zoster": "Windpocken und Gürtelrose",
  malaria: "Malaria",
  "chagas disease": "Chagas-Krankheit",
  leishmaniasis: "Leishmaniose",
  "african trypanosomiasis": "afrikanische Trypanosomiasis",
  schistosomiasis: "Schistosomiasis",
  cysticercosis: "Zystizerkose",
  "cystic echinococcosis": "zystische Echinokokkose",
  dengue: "Dengue",
  "yellow fever": "Gelbfieber",
  rabies: "Tollwut",
  "intestinal nematode infections": "Infektionen mit Darmnematoden",
  "other neglected tropical diseases": "andere vernachlässigte Tropenkrankheiten",
  tuberculosis: "Tuberkulose",
  "HIV/AIDS": "HIV/Aids",
  "a diarrhoeal disease": "Durchfallerkrankung",
  "other intestinal infectious diseases": "andere infektiöse Darmerkrankungen",
  "otitis media": "Mittelohrentzündung",
  meningitis: "Hirnhautentzündung",
  encephalitis: "Gehirnentzündung",
  diphtheria: "Diphtherie",
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
  "inguinal, femoral, and abdominal hernia": "Leisten-, Schenkel- und Bauchwandbruch",
  "inflammatory bowel disease": "chronisch-entzündliche Darmerkrankung",
  "vascular intestinal disorders": "vaskuläre Darmerkrankungen",
  "gallbladder and biliary diseases": "Gallenblasen- und Gallenwegserkrankungen",
  pancreatitis: "Bauchspeicheldrüsenentzündung",
  "cirrhosis and other chronic liver diseases": "Leberzirrhose und andere chronische Leberleiden",
  "other digestive diseases": "andere Verdauungskrankheiten",
  "acute glomerulonephritis": "akute Glomerulonephritis",
  "kidney disease": "Nierenerkrankung",
  "urinary diseases and male infertility": "Harnwegserkrankungen und männliche Unfruchtbarkeit",
  "gynecological diseases": "gynäkologische Erkrankungen",

  // --- Stoffwechsel, Blut, Immunsystem ------------------------------------
  diabetes: "Diabetes",
  "hemoglobinopathies and hemolytic anemias": "Hämoglobinopathien und hämolytische Anämien",
  "endocrine, metabolic, blood, and immune disorders":
    "endokrine, Stoffwechsel-, Blut- und Immunerkrankungen",
  "protein-energy malnutrition": "Protein-Energie-Mangelernährung",
  "other nutritional deficiencies": "andere Nährstoffmängel",

  // --- Nerven und Psyche ---------------------------------------------------
  "Alzheimer's & dementia": "Alzheimer und Demenz",
  "parkinson's disease": "Parkinson",
  "idiopathic epilepsy": "idiopathische Epilepsie",
  "multiple sclerosis": "multiple Sklerose",
  "motor neuron disease": "Motoneuronerkrankung",
  "other neurological disorders": "andere neurologische Erkrankungen",
  "eating disorders": "Essstörungen",
  "alcohol use disorders": "Alkoholabhängigkeit",
  "drug use disorders": "Drogenabhängigkeit",

  // --- Bewegungsapparat und Haut ------------------------------------------
  "rheumatoid arthritis": "rheumatoide Arthritis",
  "other musculoskeletal disorders": "andere Erkrankungen des Bewegungsapparats",
  "decubitus ulcer": "Dekubitus",
  "other skin and subcutaneous diseases": "andere Haut- und Unterhauterkrankungen",
  "bacterial skin diseases": "bakterielle Hauterkrankungen",

  // --- Mutter und Kind ------------------------------------------------------
  "maternal complications": "Komplikationen bei der Geburt",
  "neonatal complications": "Neugeborenenkomplikationen",
  "birth asphyxia": "Geburtsasphyxie",
  "a congenital condition": "angeborene Erkrankung",
  "sudden infant death syndrome": "plötzlicher Kindstod",

  // --- Verletzungen und Gewalt ----------------------------------------------
  electrocution: "Stromschlag",
  "conflict and terrorism": "Krieg und Terrorismus",
  "a road injury": "Verkehrsunfall",
  "other transport injuries": "andere Transportunfälle",
  falls: "Sturz",
  drowning: "Ertrinken",
  "fire, heat, and hot substances": "Feuer, Hitze und heiße Stoffe",
  poisonings: "Vergiftungen",
  "exposure to mechanical forces": "Einwirkung mechanischer Kräfte",
  "adverse effects of medical treatment": "unerwünschte Wirkungen medizinischer Behandlung",
  "animal contact": "Tierkontakt",
  "foreign body": "Fremdkörper",
  "other unintentional injuries": "andere unbeabsichtigte Verletzungen",
  suicide: "Suizid",
  "interpersonal violence": "zwischenmenschliche Gewalt",
  "exposure to forces of nature": "Naturgewalten",
  "environmental heat and cold exposure": "Hitze- und Kälteeinwirkung",
  "police conflict and executions": "Polizeigewalt und Hinrichtungen",

  // --- Sammelposten ----------------------------------------------------------
  "other causes": "andere Ursachen",
};
