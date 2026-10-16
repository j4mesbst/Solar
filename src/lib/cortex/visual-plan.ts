/** A compact, deterministic brief for the first visual generation.  It avoids
 * spending another local-model turn restating requirements already present in
 * the request, while leaving visual decisions to the selected model. */
export function visualPlan(prompt: string) {
  const source = prompt.toLowerCase();
  const has = (expression: RegExp) => expression.test(source);
  const layout = has(/sidebar|lat[ée]rale/) ? "sidebar + contenu" : has(/dashboard|tableau de bord/) ? "header + grille" : "contenu centré";
  const responsive = has(/responsive|mobile|t[ée]l[ée]phone|tablette/) ? "desktop + mobile" : "viewport 1280px sans overflow";
  const motion = has(/animation|transition|motion|apparition|fade|stagger/) ? "état initial/final, durée bornée, prefers-reduced-motion" : "aucune animation requise";
  const reference = has(/r[ée]f[ée]rence|capture|screenshot|maquette/) ? "comparer à la référence réellement fournie" : "pas de référence image";
  return [
    "BRIEF VISUEL (déterministe)",
    `LAYOUT: ${layout}`,
    "COMPOSANTS: structure, contenu, contrôles utilisables",
    "STYLE: tokens et design existants, hiérarchie lisible, espaces cohérents",
    "SI PROJET VIERGE: palette neutre et accent discret, échelle d’espacement cohérente, typographie système, contenu utile et hiérarchie claire; éviter décoration gratuite et composants surdimensionnés.",
    "COMPOSITION: regrouper les contrôles liés, aligner les bords, donner une zone principale dominante; conserver les styles déjà présents dans un projet existant.",
    `RESPONSIVE: ${responsive}`,
    `MOTION: ${motion}`,
    `RÉFÉRENCE: ${reference}`,
    "CHECKS: pas d’overflow, pas de collision de contrôle, texte non tronqué.",
  ].join("\n");
}
