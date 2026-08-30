export interface ProviderAccessDefinition {
  providerId: string;
  permissions: chrome.permissions.Permissions;
}

export interface PermissionAdapter {
  contains(permissions: chrome.permissions.Permissions): Promise<boolean>;
  request(permissions: chrome.permissions.Permissions): Promise<boolean>;
  remove(permissions: chrome.permissions.Permissions): Promise<boolean>;
}

export type ConnectResult =
  | { status: "connected" }
  | { status: "denied" }
  | { status: "not-found" };

export type DisconnectResult =
  | { status: "disconnected" }
  | { status: "failed" }
  | { status: "not-found" };

export interface PermissionManager {
  connect(providerId: string): Promise<ConnectResult>;
  disconnect(providerId: string): Promise<DisconnectResult>;
  isConnected(providerId: string): Promise<boolean>;
}

export function createPermissionManager(
  definitions: readonly ProviderAccessDefinition[],
  adapter: PermissionAdapter
): PermissionManager {
  const byProviderId = new Map(
    definitions.map((definition) => [definition.providerId, definition])
  );

  return {
    async isConnected(providerId) {
      const definition = byProviderId.get(providerId);
      return definition ? adapter.contains(definition.permissions) : false;
    },
    async connect(providerId) {
      const definition = byProviderId.get(providerId);
      if (!definition) return { status: "not-found" };
      return (await adapter.request(definition.permissions))
        ? { status: "connected" }
        : { status: "denied" };
    },
    async disconnect(providerId) {
      const definition = byProviderId.get(providerId);
      if (!definition) return { status: "not-found" };

      const namedPermissions = definition.permissions.permissions ?? [];
      const removableNamedPermissions: chrome.runtime.ManifestPermissions[] = [];
      for (const permission of namedPermissions) {
        const otherUsers = definitions.filter(
          (candidate) =>
            candidate.providerId !== providerId &&
            candidate.permissions.permissions?.includes(permission)
        );
        const stillNeeded = (
          await Promise.all(otherUsers.map((candidate) => adapter.contains(candidate.permissions)))
        ).some(Boolean);
        if (!stillNeeded) removableNamedPermissions.push(permission);
      }

      const permissions: chrome.permissions.Permissions = {
        origins: definition.permissions.origins,
      };
      if (removableNamedPermissions.length > 0) {
        permissions.permissions = removableNamedPermissions;
      }
      return (await adapter.remove(permissions))
        ? { status: "disconnected" }
        : { status: "failed" };
    },
  };
}
