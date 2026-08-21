import { describe, expect, it } from "vitest";
import { fixtureId, resetIdSequence } from "registry";
import { userPrincipal } from "identity/principal";
import { actorContext } from "./slice.js";
import { TaskSlice } from "./slice.js";
import { inProcessTaskSession } from "./in-process-session.js";
import {
  bootLiveTaskSession,
  createAccountViaKernelPublicApi,
  loginViaKernelPublicApi,
  loadTaskSurface,
  submitTaskCompose,
  ORIGIN_MOUNTS,
  KERNEL_AUTH_TOKEN_KEY,
  TASK_TENANT_STORAGE_KEY,
  type KernelPasswordPublicApi,
} from "./live-session.js";
import { outreachBootConfig, renderOutreachDocument } from "./origin-html.js";
import type { TaskDomainPublicApi } from "./domain-api.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);

describe("origin compositor client boot", () => {
  it("opens a TaskSessionApi from kernel authenticate + openTenant", async () => {
    resetIdSequence();
    const slice = new TaskSlice();
    const actor = actorContext(userPrincipal(ownerId, tenant));
    const domain: TaskDomainPublicApi = {
      authenticate: async (token) => {
        expect(token).toBe("admin:secret");
        return {
          openTenant: async (tenantId) => {
            expect(tenantId).toBe(tenant);
            return inProcessTaskSession(slice, actor);
          },
          openDefaultTenant: async () => inProcessTaskSession(slice, actor),
        };
      },
    };
    const session = await bootLiveTaskSession(domain, "admin:secret", tenant);
    const surface = await submitTaskCompose(session, "From live boot", "boot-1");
    expect(surface.items.map((item) => item.title)).toEqual(["From live boot"]);
    expect((await loadTaskSurface(session)).activity.map((fact) => fact.action)).toContain("created");
  });

  it("omits tenantId so the client calls openDefaultTenant", async () => {
    let openedDefault = false;
    const slice = new TaskSlice();
    const actor = actorContext(userPrincipal(ownerId, tenant));
    const domain: TaskDomainPublicApi = {
      authenticate: async () => ({
        openTenant: async () => {
          throw new Error("hydrate path must not pass a tenant");
        },
        openDefaultTenant: async () => {
          openedDefault = true;
          return inProcessTaskSession(slice, actor);
        },
      }),
    };
    const session = await bootLiveTaskSession(domain, "admin:secret");
    expect(openedDefault).toBe(true);
    expect(await session.tenantId()).toBe(tenant);
  });

  it("mints a kernel session token through PublicApi.login / createAccount", async () => {
    const tokens: string[] = [];
    const publicApi: KernelPasswordPublicApi = {
      createAccount: async (username, displayName, hash) => {
        expect(username).toBe("admin");
        expect(displayName).toBe("Admin");
        expect(hash).toEqual(new Uint8Array([1, 2, 3]));
        tokens.push("admin:created");
        return "admin:created";
      },
      login: async (username, hash) => {
        expect(username).toBe("admin");
        expect(hash).toEqual(new Uint8Array([1, 2, 3]));
        return "admin:logged-in";
      },
    };
    expect(await createAccountViaKernelPublicApi(publicApi, "admin", "Admin", new Uint8Array([1, 2, 3]))).toBe(
      "admin:created",
    );
    expect(await loginViaKernelPublicApi(publicApi, "admin", new Uint8Array([1, 2, 3]))).toBe("admin:logged-in");
    await expect(loginViaKernelPublicApi({ ...publicApi, login: async () => null }, "admin", new Uint8Array([1]))).rejects.toThrow(
      /login failed/,
    );
  });

  it("SSRs the custom shell with compositor boot mounts", () => {
    const html = renderOutreachDocument({
      path: "/tasks",
      username: "admin",
      items: [{ entityId: "doc_1", title: "Visible task", facet: "task", done: false }],
      activity: [{ id: "a1", action: "created", entityId: "doc_1" }],
    });
    expect(html).toContain("data-origin=\"compositor\"");
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("data-slice=\"task\"");
    expect(html).toContain("Visible task");
    expect(html).toContain("id=\"outreach-boot\"");
    const boot = outreachBootConfig("/tasks");
    expect(boot.kernelApi).toBe(ORIGIN_MOUNTS.kernelApi);
    expect(boot.domainApi).toBe("/domain");
    expect(boot.authTokenKey).toBe(KERNEL_AUTH_TOKEN_KEY);
    expect(boot.tenantKey).toBe(TASK_TENANT_STORAGE_KEY);
    expect(html).toContain("\"kernelApi\":\"/api\"");
    expect(html).toContain("\"domainApi\":\"/domain\"");
    expect(html).toContain("/assets/outreach-shell.js");
    const login = renderOutreachDocument({ path: "/login" });
    expect(login).toContain("data-surface=\"kernel.login\"");
  });
});
