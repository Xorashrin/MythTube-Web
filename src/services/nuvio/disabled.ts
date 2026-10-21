// Providers / repositories switched off by remote config (kill-switch for broken or unsafe plugins).
const providers = new Set<string>();
const repos = new Set<string>();

export function setDisabled(providerKeys: string[] = [], repoIds: string[] = []) {
  providers.clear();
  repos.clear();
  providerKeys.forEach((k) => providers.add(k));
  repoIds.forEach((k) => repos.add(k));
}

export function providerDisabled(key: string): boolean {
  return providers.has(key) || repos.has(key.split(':')[0]);
}
