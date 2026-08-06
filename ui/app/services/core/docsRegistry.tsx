// Registro central dos artigos de documentação da app.
// Para adicionar um novo artigo no futuro: crie a página em ui/app/pages/dashboards/<Nome>.tsx
// (a rota é resolvida automaticamente por MyRoutes.tsx a partir do nome do arquivo) e adicione
// uma entrada aqui — ela aparece automaticamente na página raiz de documentação (Docs.tsx) e fica
// disponível para qualquer botão/menu que precise linkar para ela via getDashboardUrl(slug).

export type DocArticle = {
  slug: string;
  label: string;
  description: string;
};

export const DOC_ARTICLES: DocArticle[] = [
  {
    slug: 'database-metrics-docs',
    label: 'Database Metrics (Oracle/PostgreSQL)',
    description:
      'Como a instância de banco é detectada e resolvida, catálogo de métricas Oracle (com escopo PDB vs. instância) e PostgreSQL usadas no painel Database Metrics.',
  },
  {
    slug: 'service-contribution-docs',
    label: 'Contribuição de Serviços (Throughput/Latência)',
    description:
      'Fórmulas das colunas Fatia Throughput, Carga (Little\'s Law) e Impacto na Latência Média nos widgets Services e Called Services outside of the namespace — e por que os totais de cada categoria não se misturam.',
  },
];
