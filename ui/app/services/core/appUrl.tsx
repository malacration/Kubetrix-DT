// Monta URLs absolutas para páginas DESTA app (diferente de getEnvironmentUrl(), que é usado
// nos widgets de Services/Problems para linkar para OUTRAS apps clássicas do Dynatrace).
//
// Como a app é hospedada pela plataforma sob um prefixo que varia por ambiente
// (ex: /ui/apps/<app-id>/...), não dá para simplesmente assumir "/dashboards/X" a partir da
// raiz do domínio. Em vez disso, derivamos o prefixo da própria URL atual — mesmo padrão já
// usado em NameSpacesSelect/ClusterSelect/WorkloadsSelect (new URL(window.location.href)).
//
// As rotas de página são resolvidas dinamicamente por MyRoutes.tsx a partir do nome do arquivo
// em ui/app/pages/dashboards (slug em kebab-case -> PascalCase.tsx), então basta apontar para
// "/dashboards/<slug>".
export function getDashboardUrl(pageSlug: string): string {
  if (typeof window === 'undefined') return `/dashboards/${pageSlug}`;

  const { origin, pathname } = window.location;
  const match = pathname.match(/^(.*?)\/(dashboards|exemplos)\/[^/]+\/?$/);
  const basePath = match ? match[1] : pathname.replace(/\/$/, '');

  return `${origin}${basePath}/dashboards/${pageSlug}`;
}

export function openDashboardInNewTab(pageSlug: string): void {
  if (typeof window === 'undefined') return;
  window.open(getDashboardUrl(pageSlug), '_blank', 'noopener,noreferrer');
}
