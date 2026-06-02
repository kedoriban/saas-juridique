/**
 * Seed ~15 arrêts fictifs pour la démo V1.
 * Aucun PDF n'est téléchargé : seule l'URL publique CCE est stockée.
 * Usage : node --env-file=.env.local scripts/seed-arrets.mjs
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function pdfUrl(numeroRaw, langue) {
  const digits = numeroRaw.replace(/\D/g, "").padStart(6, "0");
  const ext = langue === "nl" ? "an" : "fr";
  return `https://www.rvv-cce.be/sites/default/files/arr/a${digits}.${ext}_.pdf`;
}

const ARRETS = [
  {
    numero: "CCE 260.001",
    date_arret: "2024-01-15",
    langue: "fr",
    chambre: "Chambre A",
    matiere: "Asile",
    pays_origine: "Afghanistan",
    resume:
      "Demande de protection internationale. Requérant afghan invoquant des persécutions liées à l'appartenance ethnique hazara. Décision de refus — crédibilité non établie.",
  },
  {
    numero: "CCE 260.002",
    date_arret: "2024-01-16",
    langue: "nl",
    chambre: "Kamer B",
    matiere: "Asiel",
    pays_origine: "Syrië",
    resume:
      "Aanvraag internationale bescherming. Syrisch verzoeker. Risico op ernstige schade erkend. Subsidiaire bescherming toegekend.",
  },
  {
    numero: "CCE 260.003",
    date_arret: "2024-01-22",
    langue: "fr",
    chambre: "Chambre A",
    matiere: "Protection subsidiaire",
    pays_origine: "Iraq",
    resume:
      "Refus du statut de réfugié mais octroi de la protection subsidiaire en raison de la situation sécuritaire en Iraq.",
  },
  {
    numero: "CCE 260.004",
    date_arret: "2024-01-30",
    langue: "nl",
    chambre: "Kamer C",
    matiere: "Gezinshereniging",
    pays_origine: "Marokko",
    resume:
      "Beroep gezinshereniging. Bewijs van voldoende bestaansmiddelen onvoldoende. Beroep verworpen.",
  },
  {
    numero: "CCE 260.005",
    date_arret: "2024-02-05",
    langue: "fr",
    chambre: "Chambre B",
    matiere: "Regroupement familial",
    pays_origine: "Maroc",
    resume:
      "Recours contre refus de regroupement familial. Documents d'état civil non authentifiés. Renvoi pour réexamen.",
  },
  {
    numero: "CCE 260.006",
    date_arret: "2024-02-12",
    langue: "nl",
    chambre: "Kamer A",
    matiere: "Asiel",
    pays_origine: "Somalië",
    resume:
      "Somalische verzoeker. Interne vluchtmogelijkheid niet aangetoond. Vluchtelingenstatus toegekend.",
  },
  {
    numero: "CCE 260.007",
    date_arret: "2024-02-19",
    langue: "fr",
    chambre: "Chambre C",
    matiere: "Séjour",
    pays_origine: "Chine",
    resume:
      "Recours contre ordre de quitter le territoire. Durée de séjour et intégration considérées. Annulation partielle.",
  },
  {
    numero: "CCE 260.008",
    date_arret: "2024-02-26",
    langue: "nl",
    chambre: "Kamer B",
    matiere: "Asiel",
    pays_origine: "Eritrea",
    resume:
      "Eritrese verzoeker — dienstplicht. Ernstige schade bij terugkeer aangetoond. Subsidiaire bescherming.",
  },
  {
    numero: "CCE 260.009",
    date_arret: "2024-03-04",
    langue: "fr",
    chambre: "Chambre A",
    matiere: "Asile",
    pays_origine: "République démocratique du Congo",
    resume:
      "Persécutions liées à l'appartenance à un mouvement d'opposition. Statut de réfugié accordé.",
  },
  {
    numero: "CCE 260.010",
    date_arret: "2024-03-11",
    langue: "nl",
    chambre: "Kamer C",
    matiere: "Verblijf",
    pays_origine: "Turkije",
    resume:
      "Bevel om het grondgebied te verlaten bestreden. Medische situatie onderzocht. Tijdelijke opschorting verleend.",
  },
  {
    numero: "CCE 260.011",
    date_arret: "2024-03-18",
    langue: "fr",
    chambre: "Chambre B",
    matiere: "Asile",
    pays_origine: "Guinée",
    resume:
      "Demande de protection internationale — risque MGF pour une mineure. Statut de réfugié accordé.",
  },
  {
    numero: "CCE 260.012",
    date_arret: "2024-03-25",
    langue: "nl",
    chambre: "Kamer A",
    matiere: "Asiel",
    pays_origine: "Albanië",
    resume:
      "Albanees verzoeker. Interne bescherming beschikbaar geacht. Aanvraag afgewezen.",
  },
  {
    numero: "CCE 260.013",
    date_arret: "2024-04-02",
    langue: "fr",
    chambre: "Chambre C",
    matiere: "Protection subsidiaire",
    pays_origine: "Yémen",
    resume:
      "Conflit armé au Yémen. Risque réel de préjudice grave établi. Protection subsidiaire octroyée.",
  },
  {
    numero: "CCE 260.014",
    date_arret: "2024-04-09",
    langue: "nl",
    chambre: "Kamer B",
    matiere: "Gezinshereniging",
    pays_origine: "Syrië",
    resume:
      "Gezinshereniging — echtgeno(o)t van erkende vluchteling. Documenten in orde. Beroep gegrond.",
  },
  {
    numero: "CCE 260.015",
    date_arret: "2024-04-15",
    langue: "fr",
    chambre: "Chambre A",
    matiere: "Asile",
    pays_origine: "Iran",
    resume:
      "Conversion religieuse alléguée en Belgique. Crainte fondée de persécution à l'égard des néo-convertis. Statut accordé.",
  },
];

async function main() {
  console.log(`Insertion de ${ARRETS.length} arrêts…`);

  const rows = ARRETS.map((a) => ({
    ...a,
    pdf_url: pdfUrl(a.numero, a.langue),
    statut_traitement: "en_attente",
  }));

  const { data, error } = await supabase
    .from("arrets")
    .upsert(rows, { onConflict: "numero" })
    .select("numero");

  if (error) {
    console.error("Erreur :", error.message);
    process.exit(1);
  }

  console.log(`✓ ${data.length} arrêts insérés/mis à jour :`);
  data.forEach((r) => console.log(`  • ${r.numero}`));
}

main();
