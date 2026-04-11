export type NexusCloudDiscoveryApp = {
  id: string;
  name: string;
  role: string;
  mode: string;
  exposes: readonly string[];
  consumes: readonly string[];
  embedded: boolean;
  referenced: boolean;
  requiredApis: readonly string[];
};

export type NexusCloudDiscoveryResponse = {
  protocol: string;
  hub: string;
  apps: readonly NexusCloudDiscoveryApp[];
  updatedAt: string;
};

export type NexusCloudRegistrationRequest = {
  appId: string;
  nodeId: string;
  endpoint: string;
  secret?: string;
  capabilities?: readonly string[];
};

export type NexusCloudRegistrationResponse = {
  registered: boolean;
  appId: string;
  nodeId: string;
  endpoint: string;
  secretHint: string | null;
  capabilities: readonly string[];
  registry: string;
  client: string;
  connectedTo: string;
};

export type NexusCloudClientContract = {
  name: string;
  baseUrl: string;
  auth: string;
  endpoints: {
    topology: string;
    apps: string;
    connections: string;
    summary: string;
  };
  headers: readonly string[];
};

export async function fetchNexusCloudDiscovery(baseUrl: string): Promise<NexusCloudDiscoveryResponse> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/.well-known/nexus-cloud`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Nexus Cloud discovery: ${res.status}`);
  }
  return res.json() as Promise<NexusCloudDiscoveryResponse>;
}

export async function registerWithNexusCloud(baseUrl: string, body: NexusCloudRegistrationRequest, bearerToken: string): Promise<NexusCloudRegistrationResponse> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/cloud/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Failed to register with Nexus Cloud: ${res.status}`);
  }
  return res.json() as Promise<NexusCloudRegistrationResponse>;
}

export async function fetchNexusCloudClientContract(baseUrl: string): Promise<NexusCloudClientContract> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/cloud/client`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Nexus Cloud client contract: ${res.status}`);
  }
  const data = await res.json() as { client: NexusCloudClientContract };
  return data.client;
}
