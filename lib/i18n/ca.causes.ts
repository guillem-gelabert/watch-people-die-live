// Els noms de les causes de mort, tal com apareixen a data/causes.json (Estimacions Sanitàries
// Mundials de l'OMS) més les de la taula de reserva de app/globe/persona.ts.
//
// La clau és l'etiqueta anglesa exacta del fitxer de dades: és l'identificador, i no canvia mai.
// Una causa que no hi sigui es mostra en anglès — vegeu causeLabel() — de manera que una
// exportació nova afegeix causes sense trencar res. El test causes.test.ts comprova que
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
  "nasopharynx cancer": "càncer de nasofaringe",
  "gallbladder and biliary tract cancer": "càncer de vesícula i vies biliars",
  "pancreatic cancer": "càncer de pàncrees",
  "malignant skin melanoma": "melanoma maligne de pell",
  "ovarian cancer": "càncer d'ovari",
  "testicular cancer": "càncer de testicle",
  "kidney cancer": "càncer de ronyó",
  "bladder cancer": "càncer de bufeta",
  "brain and central nervous system cancer": "càncer de cervell i sistema nerviós central",
  "thyroid cancer": "càncer de tiroide",
  "hodgkin lymphoma": "limfoma de Hodgkin",
  "non-hodgkin lymphoma": "limfoma no hodgkinià",
  "multiple myeloma": "mieloma múltiple",
  leukaemia: "leucèmia",
  "other malignant neoplasms": "altres neoplàsies malignes",
  "other neoplasms": "altres neoplàsies",
  "esophageal cancer": "càncer d'esòfag",
  "stomach cancer": "càncer d'estómac",
  "liver cancer": "càncer de fetge",
  "lung cancer": "càncer de pulmó",

  // --- cardiovasculars ----------------------------------------------------
  "a stroke": "un ictus",
  "hypertensive heart disease": "cardiopatia hipertensiva",
  "cardiomyopathy and myocarditis": "miocardiopatia i miocarditis",
  "other cardiovascular and circulatory diseases": "altres malalties cardiovasculars",
  "rheumatic heart disease": "cardiopatia reumàtica",
  "ischaemic heart disease": "cardiopatia isquèmica",

  // --- respiratòries ------------------------------------------------------
  COPD: "MPOC",
  asthma: "asma",
  "other chronic respiratory diseases": "altres malalties respiratòries cròniques",
  "lower respiratory infection": "una infecció respiratòria de vies baixes",
  "upper respiratory infections": "infeccions respiratòries de vies altes",

  // --- infeccioses --------------------------------------------------------
  malaria: "malària",
  leishmaniasis: "leishmaniosi",
  "african trypanosomiasis": "tripanosomiasi africana",
  dengue: "dengue",
  rabies: "ràbia",
  tuberculosis: "tuberculosi",
  "HIV/AIDS": "VIH/sida",
  "a diarrhoeal disease": "una malaltia diarreica",
  "otitis media": "otitis mitjana",
  meningitis: "meningitis",
  encephalitis: "encefalitis",
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
  "inflammatory bowel disease": "malaltia inflamatòria intestinal",
  pancreatitis: "pancreatitis",
  "cirrhosis and other chronic liver diseases": "cirrosi i altres malalties hepàtiques cròniques",
  "other digestive diseases": "altres malalties digestives",
  "kidney disease": "malaltia renal",
  "urinary diseases and male infertility": "malalties urinàries i infertilitat masculina",

  // --- metabòliques, sang, immunitat --------------------------------------
  diabetes: "diabetis",
  "hemoglobinopathies and hemolytic anemias": "hemoglobinopaties i anèmies hemolítiques",
  "endocrine, metabolic, blood, and immune disorders":
    "trastorns endocrins, metabòlics, hematològics i immunitaris",
  "protein-energy malnutrition": "desnutrició proteicoenergètica",

  // --- neurològiques i mentals --------------------------------------------
  "Alzheimer's & dementia": "alzheimer i demència",
  "parkinson's disease": "malaltia de Parkinson",
  "idiopathic epilepsy": "epilèpsia idiopàtica",
  "other neurological disorders": "altres trastorns neurològics",
  "alcohol use disorders": "trastorns per consum d'alcohol",
  "drug use disorders": "trastorns per consum de drogues",

  // --- musculoesquelètiques i pell ----------------------------------------
  "other musculoskeletal disorders": "altres trastorns musculoesquelètics",

  // --- materno-infantil ---------------------------------------------------
  "maternal complications": "complicacions del part",
  "neonatal complications": "complicacions neonatals",
  "birth asphyxia": "asfíxia perinatal",
  "a congenital condition": "una malaltia congènita",
  "sudden infant death syndrome": "síndrome de la mort sobtada del lactant",

  // --- lesions i violència -------------------------------------------------
  "conflict and terrorism": "conflicte armat i terrorisme",
  "a road injury": "un accident de trànsit",
  falls: "una caiguda",
  drowning: "ofegament",
  "fire, heat, and hot substances": "foc, calor i substàncies calentes",
  poisonings: "intoxicacions",
  "exposure to mechanical forces": "exposició a forces mecàniques",
  "other unintentional injuries": "altres lesions no intencionades",
  suicide: "suïcidi",
  "interpersonal violence": "violència interpersonal",
  "exposure to forces of nature": "exposició a forces de la natura",

  // --- calaix de sastre -----------------------------------------------------
  "other causes": "altres causes",
};
