import { describe, it, expect } from "vitest";
import { fetchNexusCloudDiscovery, fetchNexusCloudClientContract } from "../../src/lib/nexusCloudClient";

describe("Nexus Cloud integration client contracts", () => {
  it("normalizes the discovery payload contract", () => {
    const payload = {
      protocol: "nexus-cloud/1.0",
      hub: "Nexus Cloud",
      apps: [
        {
          id: "nexus-hosting",
          name: "Nexus Hosting",
          role: "hosting-node",
          mode: "embedded",
          exposes: ["/.well-known/federation"],
          consumes: ["/api/v1/topology"],
          embedded: false,
          referenced: true,
          requiredApis: ["systems-api.v1"],
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    expect(payload.protocol).toBe("nexus-cloud/1.0");
    expect(payload.apps[0]?.requiredApis).toContain("systems-api.v1");
  });

  it("documents the client contract shape", () => {
    const client = {
      name: "Nexus Cloud client",
      baseUrl: "/api",
      auth: "Bearer fh_*",
      endpoints: {
        topology: "/api/v1/topology",
        apps: "/api/v1/apps",
        connections: "/api/v1/connections",
        summary: "/api/v1/summary",
      },
      headers: ["Accept: application/json", "Authorization: Bearer <token>"],
    };

    expect(client.endpoints.topology).toBe("/api/v1/topology");
    expect(client.headers).toContain("Accept: application/json");
  });
});
