import { Timeframe } from "@dynatrace/strato-components-preview/core"
import { clientClassic, MetricResult } from "../core/MetricsClientClassic"
import { pickBaselineResolution } from "../../components/timeframe/resolution";
import { expandGroups } from "./expandGroups";

// NOTA sobre média vs. mediana: estas duas funções combinam N leituras deslocadas
// (7, 14, 21... dias atrás) somando as expressões de metric selector e dividindo
// pelo número de exemplos — ou seja, a média é calculada NO SERVIDOR, como parte
// de uma única query. A Classic Metrics API v2 não tem uma operação nativa de
// "mediana entre expressões de metric selector" (fold(median) existe, mas opera
// sobre uma dimensão splitBy() de UMA métrica, não sobre expressões aritméticas
// independentes combinadas com +). Trocar para mediana aqui exigiria buscar as N
// séries deslocadas separadamente (N requests em vez de 1) e combiná-las no
// cliente — o que multiplica o tráfego para cada card/gráfico que usa baseline
// (Services, CallServices, UserActionTime, todos os KPIs de Postgres, etc.). Por
// isso mantive média aqui.
//
// Em DQL (WorkloadService.tsx k8s/front) a troca para mediana só foi possível na
// forma escalar (`summarize x = median(scalarField)`, agregando um valor por
// linha). A forma com expressão iterativa (`summarize x = median(field[])`, que
// combina arrays elemento a elemento) NÃO é suportada pela API — erro
// ITERATIVE_EXPRESSION_FOR_AGGREGATION_FUNCTIONS — então essas continuam em avg().
// `arrayMedian(array(...))` (services.tsx, oracleDatabaseService.tsx) é outro
// caminho, não afetado por essa limitação, pois opera sobre um array literal, não
// uma expressão iterativa.

export function classicBaseLineBy(
  metricResult : MetricResult,
  timeframe? : Timeframe,
  aggregation = ":avg",
  toUnit = "",
  examples = 3,
  resolution? : string){

  const expandedQuerys = expandGroups(metricResult.baseQuery)
  const querys = new Array<string>()
  expandedQuerys.forEach(baseQuery => {
    for(let i =0; i<examples; i++){
      querys.push(`((${baseQuery}):timeshift(-${7*(i+1)}d)${aggregation}:default(0,always)${toUnit})`)
    }
  });
  const query = `(${querys.join('+')})/ ${examples}`;
  return clientClassic(query, timeframe,pickBaselineResolution(timeframe,resolution),metricResult.entitySelector)
}

export function classicBaseLine(baseQuery : string, timeframe? : Timeframe, toUnit? : string, examples = 3, resolution? : string){
    const querys = new Array<string>()

    for(let i =0; i<examples; i++){
        querys.push(baseQuery+`:timeshift(-${7*(i+1)}d):avg:default(0,always)${toUnit}`)
    }

    const query = `${querys.join('+')}`;

    return clientClassic(query, timeframe, pickBaselineResolution(timeframe,resolution)).then(res => {
      res?.response?.result.forEach(col => {
        col.data.forEach(ms => {
          ms.values = ms.values.map(v => v / examples);
        });
      });
      return res;
    });
}