import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { ArrowRightIcon, HomeIcon } from '@dynatrace/strato-icons';
import { DOC_ARTICLES } from 'app/services/core/docsRegistry';

type DocNavProps = {
  /** Slug do artigo atual (mesmo valor registrado em docsRegistry.tsx). */
  currentSlug: string;
};

/**
 * Barra de navegação para páginas de documentação: "Voltar à documentação"
 * (raiz, /dashboards/Docs) + "Próximo artigo". O próximo artigo é resolvido
 * pela posição de `currentSlug` dentro de DOC_ARTICLES — nada é linkado
 * explicitamente aqui, então a ordem/navegação se ajusta sozinha conforme
 * artigos são adicionados/removidos/reordenados no registro.
 */
export const DocNav = ({ currentSlug }: DocNavProps) => {
  const index = DOC_ARTICLES.findIndex((article) => article.slug === currentSlug);
  const hasMultipleArticles = DOC_ARTICLES.length > 1;
  const next = hasMultipleArticles && index >= 0
    ? DOC_ARTICLES[(index + 1) % DOC_ARTICLES.length]
    : undefined;

  return (
    <Flex justifyContent="space-between" alignItems="center" style={{ marginBottom: '1.5rem' }}>
      <Button as={RouterLink} to="/dashboards/Docs">
        <Button.Prefix>
          <HomeIcon />
        </Button.Prefix>
        Voltar à documentação
      </Button>

      {next && (
        <Button as={RouterLink} to={`/dashboards/${next.slug}`}>
          Próximo: {next.label}
          <Button.Suffix>
            <ArrowRightIcon />
          </Button.Suffix>
        </Button>
      )}
    </Flex>
  );
};
