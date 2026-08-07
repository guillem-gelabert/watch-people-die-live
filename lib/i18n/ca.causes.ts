// Els noms de les causes de mort, tal com apareixen a data/causes.json (IHME Global Burden of
// Disease, causes de nivell 3) més les de la taula de reserva de app/globe/persona.ts.
//
// La clau és l'etiqueta anglesa exacta del fitxer de dades: és l'identificador, i no canvia mai.
// Una causa que no hi sigui es mostra en anglès — vegeu causeLabel() — de manera que una
// exportació nova del GBD afegeix causes sense trencar res. El test causes.test.ts comprova que
// no en falti cap de les que hi ha ara.
//
// El registre és el de la frase on cauen: "Dona de 84, càncer de mama – Espanya". Per això van en
// minúscula i sense article, tret dels casos on l'anglès ja en porta un.

export const causesCa: Record<string, string> = {
  // --- neoplàsies ---------------------------------------------------------
  "breast cancer": "càncer de mama",
  "cervical cancer": "càncer de coll uterí",
  "uterine cancer": "càncer d'úter",
  "prostate cancer": "càncer de pròstata",
  "colorectal cancer": "càncer colorectal",
  "lip and oral cavity cancer": "càncer de llavi i cavitat oral",
  "eye cancer": "càncer d'ull",
  "soft tissue and other extraosseous sarcomas": "sarcomes de teixits tous i extraossis",
  "malignant neoplasm of bone and articular cartilage":
    "neoplàsia maligna d'os i cartílag articular",
  "neuroblastoma and other peripheral nervous cell tumors":
    "neuroblastoma i altres tumors de cèl·lules nervioses perifèriques",
  "nasopharynx cancer": "càncer de nasofaringe",
  "other pharynx cancer": "altres càncers de faringe",
  "gallbladder and biliary tract cancer": "càncer de vesícula i vies biliars",
  "pancreatic cancer": "càncer de pàncrees",
  "malignant skin melanoma": "melanoma maligne de pell",
  "non-melanoma skin cancer": "càncer de pell no melanoma",
  "ovarian cancer": "càncer d'ovari",
  "testicular cancer": "càncer de testicle",
  "kidney cancer": "càncer de ronyó",
  "bladder cancer": "càncer de bufeta",
  "brain and central nervous system cancer": "càncer de cervell i sistema nerviós central",
  "thyroid cancer": "càncer de tiroide",
  mesothelioma: "mesotelioma",
  "hodgkin lymphoma": "limfoma de Hodgkin",
  "non-hodgkin lymphoma": "limfoma no hodgkinià",
  "multiple myeloma": "mieloma múltiple",
  leukaemia: "leucèmia",
  "other malignant neoplasms": "altres neoplàsies malignes",
  "other neoplasms": "altres neoplàsies",
  "esophageal cancer": "càncer d'esòfag",
  "stomach cancer": "càncer d'estómac",
  "liver cancer": "càncer de fetge",
  "larynx cancer": "càncer de laringe",
  "lung cancer": "càncer de pulmó",

  // --- cardiovasculars ----------------------------------------------------
  "a stroke": "un ictus",
  "hypertensive heart disease": "cardiopatia hipertensiva",
  "cardiomyopathy and myocarditis": "miocardiopatia i miocarditis",
  "atrial fibrillation and flutter": "fibril·lació i aleteig auricular",
  "aortic aneurysm": "aneurisma d'aorta",
  "lower extremity peripheral arterial disease": "arteriopatia perifèrica de les extremitats",
  endocarditis: "endocarditis",
  "non-rheumatic valvular heart disease": "valvulopatia no reumàtica",
  "other cardiovascular and circulatory diseases": "altres malalties cardiovasculars",
  "rheumatic heart disease": "cardiopatia reumàtica",
  "ischaemic heart disease": "cardiopatia isquèmica",
  "pulmonary arterial hypertension": "hipertensió arterial pulmonar",

  // --- respiratòries ------------------------------------------------------
  COPD: "MPOC",
  pneumoconiosis: "pneumoconiosi",
  asthma: "asma",
  "interstitial lung disease and pulmonary sarcoidosis":
    "malaltia pulmonar intersticial i sarcoïdosi",
  "other chronic respiratory diseases": "altres malalties respiratòries cròniques",
  "lower respiratory infection": "una infecció respiratòria de vies baixes",
  "upper respiratory infections": "infeccions respiratòries de vies altes",

  // --- infeccioses --------------------------------------------------------
  "typhoid and paratyphoid": "febre tifoide i paratifoide",
  "invasive non-typhoidal salmonella (ints)": "salmonel·la no tifoide invasiva",
  "zika virus": "virus del Zika",
  "varicella and herpes zoster": "varicel·la i herpes zòster",
  malaria: "malària",
  "chagas disease": "malaltia de Chagas",
  leishmaniasis: "leishmaniosi",
  "african trypanosomiasis": "tripanosomiasi africana",
  schistosomiasis: "esquistosomiasi",
  cysticercosis: "cisticercosi",
  "cystic echinococcosis": "equinococcosi quística",
  dengue: "dengue",
  "yellow fever": "febre groga",
  rabies: "ràbia",
  "intestinal nematode infections": "infeccions per nematodes intestinals",
  "other neglected tropical diseases": "altres malalties tropicals desateses",
  tuberculosis: "tuberculosi",
  "HIV/AIDS": "VIH/sida",
  "a diarrhoeal disease": "una malaltia diarreica",
  "other intestinal infectious diseases": "altres malalties infeccioses intestinals",
  "otitis media": "otitis mitjana",
  meningitis: "meningitis",
  encephalitis: "encefalitis",
  diphtheria: "diftèria",
  pertussis: "tos ferina",
  tetanus: "tètanus",
  measles: "xarampió",
  "acute hepatitis": "hepatitis aguda",
  "other unspecified infectious diseases": "altres malalties infeccioses no especificades",
  "sexually transmitted infections excluding hiv":
    "infeccions de transmissió sexual excloent-hi el VIH",
  "covid-19": "covid-19",

  // --- digestives i renals ------------------------------------------------
  "upper digestive system diseases": "malalties del tracte digestiu superior",
  appendicitis: "apendicitis",
  "paralytic ileus and intestinal obstruction": "ili paralític i obstrucció intestinal",
  "inguinal, femoral, and abdominal hernia": "hèrnia inguinal, femoral i abdominal",
  "inflammatory bowel disease": "malaltia inflamatòria intestinal",
  "vascular intestinal disorders": "trastorns vasculars intestinals",
  "gallbladder and biliary diseases": "malalties de la vesícula i les vies biliars",
  pancreatitis: "pancreatitis",
  "cirrhosis and other chronic liver diseases": "cirrosi i altres malalties hepàtiques cròniques",
  "other digestive diseases": "altres malalties digestives",
  "acute glomerulonephritis": "glomerulonefritis aguda",
  "kidney disease": "malaltia renal",
  "urinary diseases and male infertility": "malalties urinàries i infertilitat masculina",
  "gynecological diseases": "malalties ginecològiques",

  // --- metabòliques, sang, immunitat --------------------------------------
  diabetes: "diabetis",
  "hemoglobinopathies and hemolytic anemias": "hemoglobinopaties i anèmies hemolítiques",
  "endocrine, metabolic, blood, and immune disorders":
    "trastorns endocrins, metabòlics, hematològics i immunitaris",
  "protein-energy malnutrition": "desnutrició proteicoenergètica",
  "other nutritional deficiencies": "altres deficiències nutricionals",

  // --- neurològiques i mentals --------------------------------------------
  "Alzheimer's & dementia": "alzheimer i demència",
  "parkinson's disease": "malaltia de Parkinson",
  "idiopathic epilepsy": "epilèpsia idiopàtica",
  "multiple sclerosis": "esclerosi múltiple",
  "motor neuron disease": "malaltia de la motoneurona",
  "other neurological disorders": "altres trastorns neurològics",
  "eating disorders": "trastorns de la conducta alimentària",
  "alcohol use disorders": "trastorns per consum d'alcohol",
  "drug use disorders": "trastorns per consum de drogues",

  // --- musculoesquelètiques i pell ----------------------------------------
  "rheumatoid arthritis": "artritis reumatoide",
  "other musculoskeletal disorders": "altres trastorns musculoesquelètics",
  "decubitus ulcer": "úlcera per pressió",
  "other skin and subcutaneous diseases": "altres malalties de la pell i el teixit subcutani",
  "bacterial skin diseases": "malalties bacterianes de la pell",

  // --- materno-infantil ---------------------------------------------------
  "maternal complications": "complicacions del part",
  "neonatal complications": "complicacions neonatals",
  "birth asphyxia": "asfíxia perinatal",
  "a congenital condition": "una malaltia congènita",
  "sudden infant death syndrome": "síndrome de la mort sobtada del lactant",

  // --- lesions i violència -------------------------------------------------
  electrocution: "electrocució",
  "conflict and terrorism": "conflicte armat i terrorisme",
  "a road injury": "un accident de trànsit",
  "other transport injuries": "altres accidents de transport",
  falls: "una caiguda",
  drowning: "ofegament",
  "fire, heat, and hot substances": "foc, calor i substàncies calentes",
  poisonings: "intoxicacions",
  "exposure to mechanical forces": "exposició a forces mecàniques",
  "adverse effects of medical treatment": "efectes adversos del tractament mèdic",
  "animal contact": "contacte amb animals",
  "foreign body": "cos estrany",
  "other unintentional injuries": "altres lesions no intencionades",
  suicide: "suïcidi",
  "interpersonal violence": "violència interpersonal",
  "exposure to forces of nature": "exposició a forces de la natura",
  "environmental heat and cold exposure": "exposició a la calor i el fred ambientals",
  "police conflict and executions": "violència policial i execucions",

  // --- calaix de sastre -----------------------------------------------------
  "other causes": "altres causes",
};
