import React from 'react';
import { Container, Flex } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { DocNav } from 'app/components/docs/DocNav';

const DOCS_SLUG = 'service-contribution-docs';

// Página de documentação das colunas de "contribuição" (Fatia Throughput, Carga
// (Little's Law), Impacto na Latência Média) dos widgets Services.tsx e
// CallsServices.tsx (Generic.tsx). Acessível de duas formas:
//  1) botão "Documentação" dentro de cada um dos dois widgets;
//  2) raiz de documentação (SideBar → Documentação → /dashboards/Docs).
// Abre em nova aba via getDashboardUrl('service-contribution-docs').
//
// A rota é resolvida automaticamente por MyRoutes.tsx a partir do nome deste
// arquivo (slug "service-contribution-docs" -> "ServiceContributionDocs.tsx").

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
  marginBottom: '1.5rem',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.4rem 0.6rem',
  borderBottom: '2px solid var(--dt-colors-border-neutral-default, #d0d3da)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.4rem 0.6rem',
  borderBottom: '1px solid var(--dt-colors-border-neutral-default, #e4e5eb)',
  verticalAlign: 'top',
};

const codeStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '0.85em',
  background: 'var(--dt-colors-background-field-neutral-default, #f0f1f5)',
  padding: '0.1em 0.35em',
  borderRadius: '4px',
};

const sectionGap = { marginTop: '1.5rem' };

type Row = { name: string; formula: string; desc: string };

const Table = ({ rows }: { rows: Row[] }) => (
  <table style={tableStyle}>
    <thead>
      <tr>
        <th style={thStyle}>Métrica</th>
        <th style={thStyle}>Fórmula</th>
        <th style={thStyle}>Interpretação</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r) => (
        <tr key={r.name}>
          <td style={tdStyle}>{r.name}</td>
          <td style={tdStyle}><code style={codeStyle}>{r.formula}</code></td>
          <td style={tdStyle}>{r.desc}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const contributionRows: Row[] = [
  {
    name: 'Fatia Throughput',
    formula: 'currCount_i / Σ currCount',
    desc: 'Percentual do volume total de requisições da categoria que pertence a este serviço. Responde "quanto desse total é este serviço", sem considerar latência.',
  },
  {
    name: "Carga (Little's Law)",
    formula: '(currCount_i × currResponse_i) / Σ (currCount × currResponse)',
    desc: 'Fatia da "carga" total da categoria — no sentido de Little\'s Law (L = λ·W, concorrência = throughput × tempo de resposta). Um serviço lento e raro pode pesar tanto quanto um rápido e frequente.',
  },
  {
    name: 'Impacto na Latência Média',
    formula: 'médiaTotal − médiaSemEsteServiço',
    desc: 'Quantos µs/ms a latência média da categoria mudaria se este serviço fosse removido do cálculo. Positivo = está puxando a média geral para cima; negativo = está puxando para baixo.',
  },
];

const ServiceContributionDocs = () => {
  return (
    <Container style={{ padding: '1.5rem', maxWidth: '960px' }}>
      <DocNav currentSlug={DOCS_SLUG} />
      <Heading level={1}>Documentação — Contribuição de Serviços</Heading>
      <Text>
        Nos widgets <b>Services</b> e <b>Called Services outside of the namespace</b> (aba{' '}
        <b>Generic</b>), cada linha da tabela tem três colunas que tentam responder "o quanto esse
        serviço contribui para o todo", combinando throughput (<code style={codeStyle}>currCount</code>)
        e tempo de resposta (<code style={codeStyle}>currResponse</code>) de formas diferentes,
        dependendo da pergunta que você quer responder.
      </Text>

      <Flex style={sectionGap} flexDirection="column" gap={8}>
        <Heading level={2}>Categorias são somadas separadamente</Heading>
        <Text>
          <b>Services</b> e <b>Called Services outside of the namespace</b> são categorias
          independentes — cada uma tem sua própria tabela, seu próprio carregamento de dados e,
          portanto, seu próprio total (Σ). A contribuição de um serviço é sempre relativa ao total
          <i> da tabela em que ele está</i>; os totais nunca são somados entre as duas categorias.
          Isso é proposital: "outside" representa serviços fora do namespace/workload filtrado,
          enquanto "Services" representa o que está dentro — misturar os totais tornaria a
          contribuição de cada serviço sem sentido (ex.: um serviço interno pequeno pareceria
          insignificante ao ser comparado contra o tráfego externo, e vice-versa).
        </Text>
        <Text style={{ fontSize: '0.85rem', opacity: 0.8 }}>
          Implementado em <code style={codeStyle}>ui/app/model/ServiceContribution.ts</code>{' '}
          (<code style={codeStyle}>withServiceContributions</code>) — cada widget chama essa função
          com a sua própria lista de registros já carregada.
        </Text>
      </Flex>

      <Flex style={sectionGap} flexDirection="column" gap={8}>
        <Heading level={2}>As três métricas</Heading>
        <Table rows={contributionRows} />
      </Flex>

      <Flex style={sectionGap} flexDirection="column" gap={8}>
        <Heading level={2}>Qual usar?</Heading>
        <ul>
          <li>
            Quer saber quem gera mais <b>volume</b> de chamadas? Use <b>Fatia Throughput</b>.
          </li>
          <li>
            Quer saber quem mais consome a <b>capacidade/concorrência</b> do sistema (volume × tempo
            que cada requisição ocupa)? Use <b>Carga (Little's Law)</b> — é a métrica que combina as
            duas dimensões num único número, então é o ponto de partida recomendado quando a pergunta
            é genérica ("quanto esse serviço contribui para o todo").
          </li>
          <li>
            Quer saber quem é o <b>culpado</b> por a latência média geral estar alta (ou quem ajudaria
            mais se você otimizasse)? Use <b>Impacto na Latência Média</b> — ao contrário das outras
            duas (que são fatias percentuais), essa é uma simulação de "e se esse serviço não
            existisse", na mesma unidade de tempo do tempo de resposta.
          </li>
        </ul>
        <Text style={{ fontSize: '0.85rem', opacity: 0.8 }}>
          Observação: <b>Carga</b> e <b>Impacto na Latência Média</b> partem do mesmo numerador
          (<code style={codeStyle}>currCount × currResponse</code>), mas não são a mesma coisa —{' '}
          <b>Carga</b> é a fatia desse numerador somado (uma métrica relativa, 0–100%);{' '}
          <b>Impacto</b> é uma simulação de remoção (uma métrica absoluta, em unidade de tempo, que
          pode ser negativa).
        </Text>
      </Flex>

      <Flex style={sectionGap} flexDirection="column" gap={8}>
        <Heading level={2}>Casos de borda</Heading>
        <ul>
          <li>Serviço sem tráfego no período (<code style={codeStyle}>currCount</code> nulo/0): todas as três métricas ficam 0.</li>
          <li>Categoria inteira sem tráfego (Σ currCount = 0): todas as três métricas ficam 0 para todas as linhas, em vez de <code style={codeStyle}>NaN</code>/divisão por zero.</li>
          <li>Serviço é o único com tráfego da categoria: removê-lo zera o total, então <b>Impacto na Latência Média</b> mostra a média total inteira (ele "carrega" 100% da latência observada).</li>
        </ul>
      </Flex>

      <div style={{ marginTop: '2rem' }}>
        <DocNav currentSlug={DOCS_SLUG} />
      </div>
    </Container>
  );
};

export default ServiceContributionDocs;
