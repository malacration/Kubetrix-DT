# Oracle Database Extension — Catálogo de Métricas

> Cópia de referência para construção de futuras views/painéis.
> Fonte: https://docs.dynatrace.com/docs/observe/infrastructure-observability/databases/extensions/oracle-database
> Extensão: `com.dynatrace.extension.sql-oracle` (Extension 2.0 — registra entidades Smartscape
> nativas: `DB_CLUSTER_ORACLE`, `DB_INSTANCE_ORACLE`, `DB_DATABASE_ORACLE`. Não usa CUSTOM_DEVICE,
> portanto NÃO é consultável pela Classic Metrics API com `type("sql:...")` como o Postgres — use
> DQL/Grail (`timeseries`, com o nome da métrica entre crases por causa do hífen em `sql-oracle`).

## Escopo confirmado (validado no tenant, ago/2026)

Nem toda métrica é reportada por PDB. Ao usar uma métrica nova, confirme o escopo antes de
assumir a dimensão `container.name`:

| Escopo | Dimensão | Confirmado para |
|---|---|---|
| **database** (por PDB) | `container.name` | `sessions.*`, `tablespaces.usage`, `queries.dbTime.count`, `queries.cpuTime.count` |
| **instance** (por instância RAC, compartilhado entre todas as PDBs dela) | `instance.name` | `limits.*_utilization`, `memory.pga.*`, `memory.sga.*`, `cpu.*`, `wait.events*` |

## Métricas padrão (sempre reportadas)

| Nome | Chave da métrica | Descrição |
|---|---|---|
| Cluster topology | `com.dynatrace.extension.sql-oracle.cluster_topology` | Estado de todos os clusters Oracle com instâncias e hosts vinculados |
| Database topology | `com.dynatrace.extension.sql-oracle.database_topology` | Estado das instâncias Oracle e seus databases vinculados |
| Instance status | `com.dynatrace.extension.sql-oracle.status` | Detalhes da instância Oracle conectada |
| Instance Uptime | `com.dynatrace.extension.sql-oracle.uptime` | Tempo de atividade em segundos |
| Database status | `com.dynatrace.extension.sql-oracle.db_status` | Detalhes do database Oracle conectado |

## Sessions

| Nome | Chave | Descrição |
|---|---|---|
| Active Sessions | `com.dynatrace.extension.sql-oracle.sessions.active` | Contagem de sessões ativas |
| Blocked Sessions | `com.dynatrace.extension.sql-oracle.sessions.blocked` | Contagem de sessões bloqueadas |
| Total sessions | `com.dynatrace.extension.sql-oracle.sessions.all` | Contagem total de sessões |
| User calls | `com.dynatrace.extension.sql-oracle.sessions.userCalls.count` | Total de logins, parses ou execute calls |
| Deadlocks | `com.dynatrace.extension.sql-oracle.sessions.deadlocks.count` | Total de ocorrências de deadlock |

## Memory

| Nome | Chave | Descrição |
|---|---|---|
| PGA aggregate limit | `com.dynatrace.extension.sql-oracle.memory.pga.size.pgaAggregateLimit` | Limite da memória PGA agregada |
| PGA aggregate target | `com.dynatrace.extension.sql-oracle.memory.pga.size.pgaAggregateTarget` | Alvo da memória PGA agregada |
| PGA memory used | `com.dynatrace.extension.sql-oracle.memory.pga.used` | PGA consumida por work areas |
| Allocated PGA | `com.dynatrace.extension.sql-oracle.memory.pga.allocated` | Alocação atual de PGA |
| Shared pool free | `com.dynatrace.extension.sql-oracle.memory.sga.cacheBuffer.sharedPoolFree` | Memória SGA livre no shared pool |
| Redo log space wait time | `com.dynatrace.extension.sql-oracle.memory.sga.redoBuffer.redoLogSpaceWaitTime.count` | Tempo de espera por espaço de redo |
| Redo size increase | `com.dynatrace.extension.sql-oracle.memory.sga.redoBuffer.redoSizeIncrease.count` | Total de redo gerado (bytes) |
| Redo write time | `com.dynatrace.extension.sql-oracle.memory.sga.redoBuffer.redoWriteTime.count` | Tempo de escrita do redo buffer |
| Logical reads | `com.dynatrace.extension.sql-oracle.memory.sessionLogicalReads.count` | Soma de database block gets + consistent gets |
| Physical reads | `com.dynatrace.extension.sql-oracle.memory.physicalReads.count` | Total de blocos lidos do disco |
| Physical reads direct | `com.dynatrace.extension.sql-oracle.memory.physicalReadsDirect.count` | Leituras que ignoram o buffer cache |
| Sorts in memory | `com.dynatrace.extension.sql-oracle.memory.memorySorts.count` | Sorts completados em memória |
| Sorts on disk | `com.dynatrace.extension.sql-oracle.memory.diskSorts.count` | Sorts que precisaram gravar em disco |
| DB Block gets from cache | `com.dynatrace.extension.sql-oracle.memory.dbBlockGetsFromCache.count` | Consistent read requests do buffer cache |
| Consistent gets from cache | `com.dynatrace.extension.sql-oracle.memory.consistentGetsFromCache.count` | Current block requests do buffer cache |
| Physical reads into cache | `com.dynatrace.extension.sql-oracle.memory.physicalReadsCache.count` | Blocos lidos para dentro do buffer cache |
| Library cache hit ratio | `com.dynatrace.extension.sql-oracle.memory.libraryCacheHitRatio` | Taxa de acerto do library cache |

## I/O

| Nome | Chave | Descrição |
|---|---|---|
| Physical bytes read | `com.dynatrace.extension.sql-oracle.io.bytesRead.count` | Total de bytes lidos do disco |
| Physical bytes written | `com.dynatrace.extension.sql-oracle.io.bytesWritten.count` | Total de bytes escritos no disco |
| Total wait time | `com.dynatrace.extension.sql-oracle.io.wait.count` | Tempo em todos os estados de espera, exceto Idle |

## Wait Events

Básico (agregado por wait class):

| Nome | Chave | Descrição |
|---|---|---|
| Number of wait events by wait class | `com.dynatrace.extension.sql-oracle.wait.count` | Total de esperas, exceto eventos Idle |
| Seconds waited by wait class | `com.dynatrace.extension.sql-oracle.wait.time.count` | Tempo total de espera, exceto Idle |

Detalhado (top 20 eventos, dimensões `event` e `wait_class`; escopo por instância, não por PDB):

| Nome | Chave | Descrição |
|---|---|---|
| Number of wait events | `com.dynatrace.extension.sql-oracle.wait.events.count` | Esperas por evento específico, top 20 |
| Seconds waited | `com.dynatrace.extension.sql-oracle.wait.events.time.count` | Tempo de espera por evento, top 20 |

> Observação prática: a classe `Other` costuma ser dominada por eventos de baixo nível/background
> (ex.: `cell single block physical read: RDMA` em Exadata, `Data Guard Broker Wait`). Para achar
> contenção real, olhe `wait_class = Application` (ex.: `enq: TX - row lock contention`) e
> `wait_class = Concurrency`/`Cluster`, e sempre normalize por contagem (tempo médio por espera),
> não só o tempo total somado.

## Tablespaces

Básico:

| Nome | Chave | Descrição |
|---|---|---|
| Total size | `com.dynatrace.extension.sql-oracle.tablespaces.totalSpace` | Tamanho total do tablespace, incl. extensibilidade |
| Free space | `com.dynatrace.extension.sql-oracle.tablespaces.freeSpace` | Espaço livre disponível (bytes) |
| Used space | `com.dynatrace.extension.sql-oracle.tablespaces.usedSpace` | Espaço em uso (bytes) |
| Tablespace usage | `com.dynatrace.extension.sql-oracle.tablespaces.usage` | Percentual em uso |

Detalhado (adiciona):

| Nome | Chave | Descrição |
|---|---|---|
| Allocated space | `com.dynatrace.extension.sql-oracle.tablespaces.allocatedSpace` | Espaço total alocado (bytes) |

## Datafiles

| Nome | Chave | Descrição |
|---|---|---|
| Datafile status | `com.dynatrace.extension.sql-oracle.datafile.status` | Status dos datafiles e tempfiles |
| Datafile corrupted blocks | `com.dynatrace.extension.sql-oracle.datafile.corrupted_blocks` | Blocos corrompidos por datafile |

## CPU

| Nome | Chave | Descrição |
|---|---|---|
| CPU cores | `com.dynatrace.extension.sql-oracle.cpu.cores` | Número de cores de CPU |
| Background CPU usage | `com.dynatrace.extension.sql-oracle.cpu.backgroundTotal` | CPU de processos background (centi-seg/seg) |
| Foreground CPU usage | `com.dynatrace.extension.sql-oracle.cpu.foregroundTotal` | CPU de processos foreground (centi-seg/seg) |

## Query Performance

| Nome | Chave | Descrição |
|---|---|---|
| Connection management time | `com.dynatrace.extension.sql-oracle.queries.connectionManagement.count` | Tempo de connect/disconnect de sessão |
| PL/SQL exec time | `com.dynatrace.extension.sql-oracle.queries.plSqlExec.count` | Tempo de execução do interpretador PL/SQL |
| SQL exec time | `com.dynatrace.extension.sql-oracle.queries.sqlExec.count` | Tempo de execução SQL |
| SQL parse time | `com.dynatrace.extension.sql-oracle.queries.sqlParse.count` | Tempo de parse SQL |
| DB Time | `com.dynatrace.extension.sql-oracle.queries.dbTime.count` | Tempo de call em nível de usuário do banco (métrica-chave de performance) |
| DB CPU | `com.dynatrace.extension.sql-oracle.queries.cpuTime.count` | Tempo de CPU para calls do banco |

## Fast Recovery Area (FRA)

| Nome | Chave | Descrição |
|---|---|---|
| FRA Usage | `com.dynatrace.extension.sql-oracle.fra.usage` | Percentual de utilização de disco |
| FRA limit | `com.dynatrace.extension.sql-oracle.fra.limit` | Espaço máximo recuperável (bytes) |
| FRA used | `com.dynatrace.extension.sql-oracle.fra.used` | Espaço em disco usado atualmente (bytes) |
| FRA reclaimable | `com.dynatrace.extension.sql-oracle.fra.reclaimable` | Espaço reclamável de arquivos obsoletos |

## Limits

| Nome | Chave | Descrição |
|---|---|---|
| Sessions utilization | `com.dynatrace.extension.sql-oracle.limits.sessions_utilization` | % de sessões em uso vs. limite |
| Processes utilization | `com.dynatrace.extension.sql-oracle.limits.processes_utilization` | % de processos em uso vs. limite |

## RAC

| Nome | Chave | Descrição |
|---|---|---|
| Instance ping | `com.dynatrace.extension.sql-oracle.rac.instance_ping` | Tempo de ping de mensagem 8K entre instâncias |
| RAC interconnects | `com.dynatrace.extension.sql-oracle.rac.interconnects` | Informação do interconnect do cluster |

## ASM

Nível Disk Group:

| Nome | Chave | Descrição |
|---|---|---|
| Free space | `com.dynatrace.extension.sql-oracle.asm.disk_group.free_mb` | Espaço livre (MB) |
| Total space | `com.dynatrace.extension.sql-oracle.asm.disk_group.total_mb` | Espaço total (MB) |
| Used space | `com.dynatrace.extension.sql-oracle.asm.disk_group.usage` | Percentual de uso |

Nível Disk (detalhado):

| Nome | Chave | Descrição |
|---|---|---|
| Free space | `com.dynatrace.extension.sql-oracle.asm.disk.free_mb` | Espaço livre por disco |
| Total space | `com.dynatrace.extension.sql-oracle.asm.disk.total_mb` | Espaço total por disco |
| Used space | `com.dynatrace.extension.sql-oracle.asm.disk.usage` | Percentual de uso por disco |
| Reads | `com.dynatrace.extension.sql-oracle.asm.disk.reads.count` | Número de leituras |
| Writes | `com.dynatrace.extension.sql-oracle.asm.disk.writes.count` | Número de escritas |

## Data Guard

| Nome | Chave | Descrição |
|---|---|---|
| Dataguard severe events | `com.dynatrace.extension.sql-oracle.dataguard.severeEvents` | Eventos fatais/severos nas últimas 24h |
| NOLOGGING activity | `com.dynatrace.extension.sql-oracle.dataguard.nologgingActivity` | Arquivos com atividade sem redo |
| Archive destination status | `com.dynatrace.extension.sql-oracle.dataguard.archiveDestErrStatus` | Destinos inválidos/com erro |
| Seq. difference | `com.dynatrace.extension.sql-oracle.dataguard.seqDifference` | Gap de sequência entre primary/archive |

## Backup Job

| Nome | Chave | Descrição |
|---|---|---|
| Input bytes | `com.dynatrace.extension.sql-oracle.backup-input_bytes` | Soma do tamanho dos arquivos de input do backup |
| Output bytes | `com.dynatrace.extension.sql-oracle.backup-output_bytes` | Tamanho total das peças de output do backup |
| Elapsed seconds | `com.dynatrace.extension.sql-oracle.backup-elapsed_seconds` | Tempo decorrido do job (segundos) |
| Compression ratio | `com.dynatrace.extension.sql-oracle.backup-compression_ratio` | Eficiência de compressão do backup |
| Input bytes per second | `com.dynatrace.extension.sql-oracle.backup-input_bytes_per_second` | Taxa de leitura por segundo |
| Output bytes per second | `com.dynatrace.extension.sql-oracle.backup-output_bytes_per_second` | Taxa de escrita por segundo |
| Auto-backup count | `com.dynatrace.extension.sql-oracle.backup-autobackup_count_number` | Número de autobackups realizados |
| Backup state | `com.dynatrace.extension.sql-oracle.backup.state` | Métrica de estado do job de backup |
| Time since last backup | `com.dynatrace.extension.sql-oracle.backup.time_since` | Tempo desde o último backup bem-sucedido |

## Multitenant (PDB) — dimensão `container.name`

| Nome | Chave | Descrição |
|---|---|---|
| Total size | `com.dynatrace.extension.sql-oracle.pdb-total_size` | Espaço em disco da PDB (data + temp), bytes |
| Block size | `com.dynatrace.extension.sql-oracle.pdb-block_size` | Tamanho de bloco atual da PDB |
| Diagnostic size | `com.dynatrace.extension.sql-oracle.pdb-diagnostic_size` | Uso de disco de trace de diagnóstico |
| Audit files size | `com.dynatrace.extension.sql-oracle.pdb-audit_files_size` | Uso de disco dos arquivos de audit unificado |
| Max size | `com.dynatrace.extension.sql-oracle.pdb-max_size` | Espaço máximo permitido para data/temp |
| Max diagnostic size | `com.dynatrace.extension.sql-oracle.pdb-max_diagnostic_size` | Espaço máximo de trace de diagnóstico |
| Max audit size | `com.dynatrace.extension.sql-oracle.pdb-max_audit_size` | Espaço máximo de arquivos de audit |

## Feature sets (toggle na config da extensão)

`default` (sempre ativo) · `sessions` · `memory` · `io` · `waitEvents` (+ `waitEvents (detailed)`) ·
`queryPerformance` · `cpu` · `fra` · `limits` · `tablespaces` (ou `tablespaces (detailed)`,
mutuamente exclusivos) · `datafiles` · `rac` · `asm` (+ `asm (detailed)`) · `dataguard` ·
`backupJob` · `multitenancy` · `TopN`

## Top N Queries (log-based, não é metric.series "puro")

Fonte: `dt.metrics.source = openpipeline:logs`, chaves `log.sql-oracle.top_n_queries.*`.
Dimensões confirmadas: `container.name` (PDB), `schema`, `instance.name`. Não expõe `sql_id`/
`sql_text` como dimensão de métrica — para o texto da query é necessário consultar o log bruto
por trás (`fetch logs`), não a métrica agregada.

| Nome | Chave |
|---|---|
| Application wait time | `log.sql-oracle.top_n_queries.application_wait_time` |
| Buffer gets | `log.sql-oracle.top_n_queries.buffer_gets` |
| Cluster wait time | `log.sql-oracle.top_n_queries.cluster_wait_time` |
| Concurrency wait time | `log.sql-oracle.top_n_queries.concurrency_wait_time` |
| CPU time | `log.sql-oracle.top_n_queries.cpu_time` |
| Direct writes | `log.sql-oracle.top_n_queries.direct_writes` |
| Disk reads | `log.sql-oracle.top_n_queries.disk_reads` |
| Elapsed time | `log.sql-oracle.top_n_queries.elapsed_time` |
| Executions | `log.sql-oracle.top_n_queries.executions` |
| Parse calls | `log.sql-oracle.top_n_queries.parse_calls` |
| Rows processed | `log.sql-oracle.top_n_queries.rows_processed` |
| User I/O wait time | `log.sql-oracle.top_n_queries.user_io_wait_time` |

## Exemplo de query DQL usada no app (`oracleDatabaseService.tsx`)

```dql
timeseries v = avg(`com.dynatrace.extension.sql-oracle.sessions.active`, scalar: true),
  filter: in(container.name, array("MODULOGABINETE"))
```

Nota: o nome da métrica precisa estar entre crases (`` ` ``) por causa do hífen em `sql-oracle` —
sem isso o parser DQL trata `-` como operador de subtração.
