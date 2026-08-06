import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Container, Flex } from '@dynatrace/strato-components/layouts';
import { Heading, Text, Link } from '@dynatrace/strato-components/typography';
import { DOC_ARTICLES } from 'app/services/core/docsRegistry';

// Raiz de documentação: ponto único de acesso manual (via SideBar) a todos os artigos de
// documentação da app. Para adicionar um novo artigo, veja docsRegistry.tsx — essa página
// lista automaticamente tudo que estiver registrado lá, sem precisar editar este arquivo.
const Docs = () => {
  return (
    <Container style={{ padding: '1.5rem', maxWidth: '720px' }}>
      <Heading level={1}>Documentação</Heading>
      <Text>Artigos de documentação disponíveis nesta app.</Text>

      <Flex flexDirection="column" gap={12} style={{ marginTop: '1.5rem' }}>
        {DOC_ARTICLES.map((article) => (
          <div
            key={article.slug}
            style={{
              padding: '0.75rem 1rem',
              border: '1px solid var(--dt-colors-border-neutral-default, #e4e5eb)',
              borderRadius: 'var(--dt-borders-radius-field-default, 8px)',
            }}
          >
            <Link as={RouterLink} to={`/dashboards/${article.slug}`}>
              <Heading level={4} style={{ margin: 0 }}>{article.label}</Heading>
            </Link>
            <Text style={{ fontSize: '0.85rem', opacity: 0.8 }}>{article.description}</Text>
          </div>
        ))}

        {DOC_ARTICLES.length === 0 && (
          <Text style={{ opacity: 0.7 }}>Nenhum artigo de documentação cadastrado ainda.</Text>
        )}
      </Flex>
    </Container>
  );
};

export default Docs;
