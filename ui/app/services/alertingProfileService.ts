import { settingsObjectsClient } from '@dynatrace-sdk/client-classic-environment-v2';

/**
 * Perfil de alerta (builtin:alerting.profile) simplificado para uso na UI.
 *
 * `categories` já traz os valores mapeados para o campo `event.category` de
 * dt.davis.problems, prontos para montar o filtro DQL.
 */
export interface AlertingProfile {
  objectId: string;
  name: string;
  managementZoneId: string | null;
  /** Severidades cruas definidas nas regras do perfil (ex.: PERFORMANCE). */
  severityLevels: string[];
  /** Valores de event.category correspondentes (ex.: SLOWDOWN). */
  categories: string[];
}

/**
 * Mapeia a severidade da regra do alerting profile para os possíveis valores
 * de `event.category` em dt.davis.problems. Incluímos as duas grafias
 * conhecidas para ser tolerante a variações entre versões do ambiente —
 * valores inexistentes num `in(...)` são inofensivos.
 */
const SEVERITY_TO_CATEGORY: Record<string, string[]> = {
  MONITORING_UNAVAILABLE: ['MONITORING_UNAVAILABLE'],
  AVAILABILITY: ['AVAILABILITY'],
  ERROR: ['ERROR'],
  PERFORMANCE: ['SLOWDOWN', 'PERFORMANCE'],
  RESOURCE_CONTENTION: ['RESOURCE', 'RESOURCE_CONTENTION'],
  CUSTOM_ALERT: ['CUSTOM', 'CUSTOM_ALERT', 'CUSTOM_ANNOTATION'],
  INFORMATION: ['INFO', 'INFORMATION'],
};

interface AlertingProfileValue {
  name?: string;
  managementZone?: string | null;
  severityRules?: Array<{ severityLevel?: string }>;
}

/** Lê todos os alerting profiles do ambiente, paginando os resultados. */
export async function fetchAlertingProfiles(): Promise<AlertingProfile[]> {
  const profiles: AlertingProfile[] = [];
  let nextPageKey: string | undefined;

  do {
    const res = await settingsObjectsClient.getSettingsObjects({
      schemaIds: 'builtin:alerting.profile',
      fields: 'objectId,value',
      pageSize: 500,
      nextPageKey,
    });

    for (const item of res.items ?? []) {
      const val = item.value as AlertingProfileValue | undefined;

      const severityLevels = [
        ...new Set(
          (val?.severityRules ?? [])
            .map(r => r.severityLevel)
            .filter((s): s is string => !!s),
        ),
      ];

      const categories = [
        ...new Set(
          severityLevels.flatMap(s => SEVERITY_TO_CATEGORY[s] ?? []),
        ),
      ];

      profiles.push({
        objectId: item.objectId ?? '',
        name: val?.name ?? '(sem nome)',
        managementZoneId: val?.managementZone ?? null,
        severityLevels,
        categories,
      });
    }

    nextPageKey = res.nextPageKey;
  } while (nextPageKey);

  profiles.sort((a, b) => a.name.localeCompare(b.name));
  return profiles;
}
