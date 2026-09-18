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

/**
 * Abre o Mapa de Chamadas já centralizado num serviço específico, numa aba nova —
 * usado por qualquer tabela/widget que liste serviços (ver Services.tsx/CallsServices.tsx)
 * pra ir direto do serviço listado pro grafo de dependências dele.
 */
export function openMapaChamadasForService(serviceId: string): void {
  if (typeof window === 'undefined' || !serviceId) return;
  const sp = new URLSearchParams();
  sp.set('svc', serviceId);
  window.open(`${getDashboardUrl('MapaChamadas')}?${sp.toString()}`, '_blank', 'noopener,noreferrer');
}

/**
 * Abre o Mapa de Chamadas preservando os filtros de kubernetes ATUAIS da URL
 * (cluster/ns/wl) — mesma convenção de navegação já usada pela sidebar (ver
 * SideBar.tsx, que propaga `location.search` entre páginas).
 */
export function openMapaChamadasWithCurrentFilters(): void {
  if (typeof window === 'undefined') return;
  window.open(`${getDashboardUrl('MapaChamadas')}${window.location.search}`, '_blank', 'noopener,noreferrer');
}
