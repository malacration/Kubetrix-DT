import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';


export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface QueryResult {
  data?: any;
  error?: string;
}

export async function executeDqlQuery(dql: string, timeFrame?: TimeframeV2, maxRetries = 10, retryDelay = 200): Promise<QueryResult> {
  try {
    const query = {
      query: dql,
      defaultTimeframeStart: timeFrame?.from.absoluteDate,
      defaultTimeframeEnd: timeFrame?.to.absoluteDate
    }
    const execution = await queryExecutionClient.queryExecute({
      body : query
    });

    //TODO debug
    console.log("dql Query",query);

    let retries = 0;
    while (retries < maxRetries) {
      const pollResult = await queryExecutionClient.queryPoll({
        // @ts-expect-error o framework garante a tipagem
        requestToken: execution.requestToken,
      });

      if (pollResult.state === 'SUCCEEDED') {
        return { data: pollResult.result };
      }

      if (pollResult.state === 'FAILED') {
        return { error: 'Query falhou ao executar.' };
      }

      await delay(retryDelay);
      retries++;
    }

    return { error: 'Tempo limite excedido ao aguardar o resultado da query.' };
  } catch (err: any) {
    console.error('Erro ao executar query:', err);
    return { error: err.message || 'Erro desconhecido.' };
  }
}