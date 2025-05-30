import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { TimeframeV2 } from '@dynatrace/strato-components-preview/core';


export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface QueryResult {
  data?: any;
  error?: string;
}

export function executeDqlQuery(
  dql: string,
  timeFrame?: TimeframeV2,
  maxRetries = 10,
  retryDelay = 200,
): Promise<QueryResult> {
  try {
    const query = {
      query: dql,
      defaultTimeframeStart: timeFrame?.from.absoluteDate,
      defaultTimeframeEnd: timeFrame?.to.absoluteDate,
    };

    return queryExecutionClient.queryExecute({ body: query }).then(execution =>
      // @ts-expect-error o framework garante a tipagem
      pollUntilDone(execution.requestToken, maxRetries),
    );
  } catch (err: any) {
    console.error('Erro ao executar query:', err);
    return Promise.resolve({ error: err.message || 'Erro desconhecido.' });
  }

  function pollUntilDone(
    requestToken: string,
    retriesLeft: number,
  ): Promise<QueryResult> {
    return queryExecutionClient
      .queryPoll({ requestToken })
      .then(pollResult => {
        if (pollResult.state === 'SUCCEEDED') {
          return { data: pollResult.result };
        }

        if (pollResult.state === 'FAILED') {
          return { error: 'Query falhou ao executar.' };
        }

        if (retriesLeft <= 0) {
          return { error: 'Tempo limite excedido ao aguardar o resultado da query.' };
        }
        return delay(retryDelay).then(() =>
          pollUntilDone(requestToken, retriesLeft - 1),
        );
      })
      .catch(err => {
        console.error('Erro no polling:', err);
        return { error: err.message || 'Erro desconhecido.' };
      });
  }
}
