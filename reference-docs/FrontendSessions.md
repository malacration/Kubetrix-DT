# Sessões no Generic

O widget usa os serviços do filtro de cluster, namespace e workload para descobrir aplicações web RUM Classic por `calls[dt.entity.service]`. Aplica as mesmas exclusões de serviços de banco/queue listener do Generic. A relação é direta e depende da topologia registrada no período.

Todos os frontends encontrados são selecionados inicialmente. A seleção permite A+B, limpar ou selecionar todos, e é reiniciada quando o escopo Kubernetes muda. A seleção explícita é mantida durante atualizações do mesmo escopo. O período, resolução e atualização seguem o Generic.

A métrica `builtin:apps.web.activeSessions` representa **sessões ativas estimadas**, com atividade confirmada por intervalo, não sessões autenticadas ainda abertas. O filtro Kubernetes determina quais frontends entram; a métrica conta a atividade completa desses frontends, não apenas sessões que chamaram determinado serviço.

O total usa `splitBy():value`; a visualização por frontend usa `splitBy("dt.entity.application"):value`. Não somar contagens individuais de cardinalidade. Ausência de dados não vira zero. Consultas antigas são descartadas quando filtros mudam. A resolução efetiva aparece sob o gráfico, pois intervalos maiores podem incluir mais sessões distintas.

Referência oficial: https://docs.dynatrace.com/docs/analyze-explore-automate/metrics-classic/built-in-metrics

Validação: consulta real de descoberta via dtctl retornou 25 frontends para k8s-2024-prd. Testes automatizados: `npx jest --config=tests/jest.sessions.config.cjs --runInBand`. A consulta Classic de sessões ainda precisa de validação visual no app conectado; não houve deploy.

## Baseline

Total e séries por frontend incluem `Baseline (21d)`: média aritmética dos mesmos intervalos de 7, 14 e 21 dias atrás, usando os mesmos IDs selecionados. Os deslocamentos são feitos por `timeshift` na Metrics API. Atual e baseline são consultadas na mesma resolução, respeitando a disponibilidade do histórico de 21 dias. Não há normalização por razão de resoluções para essa métrica de cardinalidade. Ausências nas semanas de referência não são preenchidas com zero; pontos sem as três referências ficam sem baseline. A legenda e o texto do widget explicam a referência, e o widget informa quando não há baseline disponível.

## Resiliência das consultas

As quatro séries (atual total, atual por frontend e suas baselines) são consultadas separadamente, sem depender da ordem de resultados de um seletor composto. Falha na consulta da baseline não descarta as sessões atuais. Avisos da API são exibidos junto ao gráfico, preservando pontos retornados; respostas paginadas continuam sendo rejeitadas como parciais. O filtro apresenta somente nomes, mas mantém Application IDs como valores da seleção e das consultas.
