import React from 'react';
import { Container, Flex } from '@dynatrace/strato-components/layouts';
import { Heading, Text, Link } from '@dynatrace/strato-components/typography';
import { DocNav } from 'app/components/docs/DocNav';

const DOCS_SLUG = 'database-metrics-docs';

// Página de documentação dos widgets "Database KPIs" e "Database Metrics Charts" (Generic.tsx).
// Acessível de três formas:
//  1) botão "Documentação" dentro de cada widget (DatabaseKpisPanel.tsx / DatabaseChartsPanel.tsx);
//  2) menu de ajuda (?) no Header, visível em qualquer página da app;
//  3) raiz de documentação (SideBar → Documentação → /dashboards/Docs).
// Ambas abrem esta rota em uma nova aba via getDashboardUrl('database-metrics-docs').
//
// A rota é resolvida automaticamente por MyRoutes.tsx a partir do nome deste arquivo
// (slug "database-metrics-docs" -> "DatabaseMetricsDocs.tsx"), sem precisar registrar rota.

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

type Row = { name: string; key: string; desc: string };

const Table = ({ rows }: { rows: Row[] }) => (
  <table style={tableStyle}>
    <thead>
      <tr>
        <th style={thStyle}>Nome</th>
        <th style={thStyle}>Chave</th>
        <th style={thStyle}>Descrição</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r) => (
        <tr key={r.key}>
          <td style={tdStyle}>{r.name}</td>
          <td style={tdStyle}><code style={codeStyle}>{r.key}</code></td>
          <td style={tdStyle}>{r.desc}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const P = 'com.dynatrace.extension.sql-oracle.';

const sessionsRows: Row[] = [
  { name: 'Active Sessions', key: `${P}sessions.active`, desc: 'Contagem de sessões ativas' },
  { name: 'Blocked Sessions', key: `${P}sessions.blocked`, desc: 'Contagem de sessões bloqueadas' },
  { name: 'Total sessions', key: `${P}sessions.all`, desc: 'Contagem total de sessões' },
  { name: 'User calls', key: `${P}sessions.userCalls.count`, desc: 'Total de logins, parses ou execute calls' },
  { name: 'Deadlocks', key: `${P}sessions.deadlocks.count`, desc: 'Total de ocorrências de deadlock' },
];

const queryPerfRows: Row[] = [
  { name: 'DB Time', key: `${P}queries.dbTime.count`, desc: 'Tempo de call em nível de usuário do banco — métrica-chave de performance' },
  { name: 'DB CPU', key: `${P}queries.cpuTime.count`, desc: 'Tempo de CPU para calls do banco' },
  { name: 'SQL exec time', key: `${P}queries.sqlExec.count`, desc: 'Tempo de execução SQL' },
  { name: 'SQL parse time', key: `${P}queries.sqlParse.count`, desc: 'Tempo de parse SQL' },
  { name: 'PL/SQL exec time', key: `${P}queries.plSqlExec.count`, desc: 'Tempo de execução do interpretador PL/SQL' },
  { name: 'Connection management time', key: `${P}queries.connectionManagement.count`, desc: 'Tempo de connect/disconnect de sessão' },
];

const tablespaceRows: Row[] = [
  { name: 'Tablespace usage', key: `${P}tablespaces.usage`, desc: 'Percentual em uso' },
  { name: 'Free space', key: `${P}tablespaces.freeSpace`, desc: 'Espaço livre disponível (bytes)' },
  { name: 'Used space', key: `${P}tablespaces.usedSpace`, desc: 'Espaço em uso (bytes)' },
  { name: 'Total size', key: `${P}tablespaces.totalSpace`, desc: 'Tamanho total, incl. extensibilidade' },
];

const memoryRows: Row[] = [
  { name: 'PGA memory used', key: `${P}memory.pga.used`, desc: 'PGA consumida por work areas' },
  { name: 'PGA aggregate target', key: `${P}memory.pga.size.pgaAggregateTarget`, desc: 'Alvo da memória PGA agregada' },
  { name: 'Shared pool free', key: `${P}memory.sga.cacheBuffer.sharedPoolFree`, desc: 'Memória SGA livre no shared pool' },
  { name: 'Library cache hit ratio', key: `${P}memory.libraryCacheHitRatio`, desc: 'Taxa de acerto do library cache' },
];

const limitsRows: Row[] = [
  { name: 'Sessions utilization', key: `${P}limits.sessions_utilization`, desc: '% de sessões em uso vs. limite' },
  { name: 'Processes utilization', key: `${P}limits.processes_utilization`, desc: '% de processos em uso vs. limite' },
];

const waitRows: Row[] = [
  { name: 'Seconds waited by wait class', key: `${P}wait.time.count`, desc: 'Tempo total de espera, por classe, exceto Idle' },
  { name: 'Seconds waited (top 20 eventos)', key: `${P}wait.events.time.count`, desc: 'Tempo de espera por evento específico (dimensões event, wait_class)' },
];

const postgresRows: Row[] = [
  { name: 'Sessions count', key: 'postgres.sessions.count', desc: 'Contagem de sessões' },
  { name: 'Session time', key: 'postgres.session_time.count', desc: 'Tempo de sessão' },
  { name: 'Active connections', key: 'postgres.activity.active', desc: 'Conexões ativas' },
  { name: 'Idle in transaction', key: 'postgres.activity.idle_in_transaction', desc: 'Conexões com transação aberta e ociosa — sinal de vazamento de transação/lock' },
  { name: 'Conflicts', key: 'postgres.conflicts.count', desc: 'Conflitos de replicação/recovery' },
  { name: 'Deadlocks', key: 'postgres.deadlocks.count', desc: 'Total de deadlocks' },
];

const DatabaseMetricsDocs = () => {
  return (
    <Container style={{ padding: '1.5rem', maxWidth: '960px' }}>
      <DocNav currentSlug={DOCS_SLUG} />
      <Heading level={1}>Documentação — Database Metrics</Heading>
      <Text>
        Na aba <b>Generic</b> existem dois widgets independentes (cada um pode ser ocultado/maximizado
        separadamente): <b>Database KPIs</b> (valor atual vs. baseline) e <b>Database Metrics Charts</b>
        (série ao longo do tempo). Os dois detectam automaticamente, a partir das listas{' '}
        <i>Services</i> e <i>Called Services outside of the namespace</i>, quais entidades são bancos
        de dados Oracle ou PostgreSQL, e permitem carregar as métricas daquela instância sob demanda.
      </Text>

      <Flex style={sectionGap} flexDirection="column" gap={8}>
        <Heading level={2}>Como a instância é resolvida</Heading>
        <Text>
          O <code style={codeStyle}>SERVICE</code> (visão client-side criada pelo OneAgent a partir da chamada de
          rede, ex: <code style={codeStyle}>db_modulogabinete.tjro.net</code>) tem um nome sintético que nem
          sempre é igual ao nome real da instância usado pela extensão de banco. O resolvedor
          (<code style={codeStyle}>dbEntityResolver.tsx</code>) gera uma lista de candidatos:
        </Text>
        <ul>
          <li>remove aspas envolventes;</li>
          <li>remove o sufixo de domínio (tudo a partir do primeiro ".")</li>
          <li>tenta com e sem o prefixo <code style={codeStyle}>db_</code>;</li>
          <li>Oracle: compara em maiúsculas contra <code style={codeStyle}>container.name</code> (nome da PDB) usando <code style={codeStyle}>in(...)</code> no DQL — não precisa acertar de primeira, todos os candidatos são testados na mesma query;</li>
          <li>PostgreSQL: usa o candidato mais literal (a extensão clássica já nomeia o <code style={codeStyle}>SERVICE</code> igual ao database na maioria dos casos observados).</li>
        </ul>
        <Text>
          Exemplos confirmados no tenant: <code style={codeStyle}>db_modulogabinete.tjro.net</code> → PDB{' '}
          <code style={codeStyle}>MODULOGABINETE</code>; <code style={codeStyle}>db_drsaudiencias</code> → PDB{' '}
          <code style={codeStyle}>DRSAUDIENCIAS</code>; <code style={codeStyle}>pdb_transcricao.tjro.net</code> → PDB{' '}
          <code style={codeStyle}>PDB_TRANSCRICAO</code> (aqui o prefixo faz parte do nome real da PDB).
        </Text>
      </Flex>

      <Flex style={sectionGap} flexDirection="column" gap={8}>
        <Heading level={2}>Oracle — extensão sql-oracle</Heading>
        <Text>
          Fonte oficial:{' '}
          <Link href="https://docs.dynatrace.com/docs/observe/infrastructure-observability/databases/extensions/oracle-database" target="_blank">
            Dynatrace Docs — Oracle Database extension
          </Link>
          . Extensão Extension 2.0 — entidades Smartscape nativas (não usa CUSTOM_DEVICE como o
          Postgres), consultada via DQL puro (<code style={codeStyle}>timeseries</code>). O nome da métrica
          precisa ficar entre crases no DQL por causa do hífen em <code style={codeStyle}>sql-oracle</code>{' '}
          (senão o parser trata "-" como subtração).
        </Text>

        <Text style={{ fontWeight: 600 }}>⚠️ Escopo por métrica — confirmado contra o tenant real</Text>
        <Text>
          Nem toda métrica é reportada por PDB. Antes de usar uma métrica nova, valide o escopo —
          não assuma <code style={codeStyle}>container.name</code> por padrão.
        </Text>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Escopo</th>
              <th style={thStyle}>Dimensão</th>
              <th style={thStyle}>Confirmado para</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><b>database</b> (por PDB)</td>
              <td style={tdStyle}><code style={codeStyle}>container.name</code></td>
              <td style={tdStyle}>sessions.*, tablespaces.usage, queries.dbTime.count, queries.cpuTime.count</td>
            </tr>
            <tr>
              <td style={tdStyle}><b>instance</b> (por instância RAC, compartilhado entre as PDBs dela)</td>
              <td style={tdStyle}><code style={codeStyle}>instance.name</code></td>
              <td style={tdStyle}>limits.*_utilization, memory.pga.*, memory.sga.*, cpu.*, wait.events*</td>
            </tr>
          </tbody>
        </table>

        <Heading level={3}>Sessions (por PDB)</Heading>
        <Table rows={sessionsRows} />

        <Heading level={3}>Query Performance (por PDB)</Heading>
        <Table rows={queryPerfRows} />

        <Heading level={3}>Tablespaces (por PDB)</Heading>
        <Table rows={tablespaceRows} />

        <Heading level={3}>Memory (por instância)</Heading>
        <Table rows={memoryRows} />

        <Heading level={3}>Limits (por instância)</Heading>
        <Table rows={limitsRows} />

        <Heading level={3}>Wait Events (por instância)</Heading>
        <Table rows={waitRows} />
        <Text style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '-0.5rem' }}>
          A classe <code style={codeStyle}>Other</code> costuma ser dominada por eventos de baixo nível/background
          (ex: <code style={codeStyle}>cell single block physical read: RDMA</code> em Exadata, <code style={codeStyle}>Data Guard Broker Wait</code>).
          Para achar contenção real, olhe <code style={codeStyle}>wait_class = Application</code> (ex:{' '}
          <code style={codeStyle}>enq: TX - row lock contention</code>) e sempre normalize por contagem
          (tempo médio por espera), não só o tempo total somado.
        </Text>

        <Text style={{ marginTop: '1rem' }}>
          Catálogo completo (todas as categorias: I/O, CPU, FRA, RAC, ASM, Data Guard, Backup Job,
          Multitenant/PDB, Top N Queries) está versionado no repositório em{' '}
          <code style={codeStyle}>documents/oracle-database-extension-metrics.md</code>, para consulta ao
          construir novos painéis.
        </Text>
      </Flex>

      <Flex style={sectionGap} flexDirection="column" gap={8}>
        <Heading level={2}>PostgreSQL — extensão postgres</Heading>
        <Text>
          Extensão clássica: expõe entidades <code style={codeStyle}>CUSTOM_DEVICE</code> do tipo{' '}
          <code style={codeStyle}>sql:postgres_database</code>, consultável pela Classic Metrics API
          (<code style={codeStyle}>entityName.equals("...")</code>), diferente do Oracle.
        </Text>
        <Table rows={postgresRows} />
      </Flex>

      <Flex style={sectionGap} flexDirection="column" gap={8}>
        <Heading level={2}>Baseline (comparação com histórico)</Heading>
        <Text>
          Os KPIs comparam o valor atual com a <b>mediana</b> dos mesmos horários há 7, 14 e 21 dias
          (<code style={codeStyle}>arrayMedian</code> — preferida à média por ser menos sensível a um
          único dia atípico entre os três). Como uma extensão recém-ligada não tem esse histórico, a
          query usa{' '}
          <code style={codeStyle}>join kind: leftOuter</code> em cada shift — se uma janela deslocada não
          tiver nenhum dado, o valor atual (<code style={codeStyle}>now</code>) continua aparecendo
          normalmente e a baseline mostra <b>"Sem baseline"</b> em vez de travar em "NaN". a partir
          de 7 dias de dado acumulado, a baseline volta a aparecer automaticamente.
        </Text>
      </Flex>

      <div style={{ marginTop: '2rem' }}>
        <DocNav currentSlug={DOCS_SLUG} />
      </div>
    </Container>
  );
};

export default DatabaseMetricsDocs;
