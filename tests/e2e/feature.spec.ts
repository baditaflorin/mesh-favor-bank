import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("A logs a favor → B's ledger shows owed by bob", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    await b.locator(".mesh-qrx-payload summary").click();
    const bPayload = (await b.locator(".mesh-qrx-payload code").textContent()) ?? "";
    await a.getByPlaceholder("or paste a mesh:// payload").fill(bPayload);
    await a.getByRole("button", { name: "use", exact: true }).click();

    await expect(a.locator(".fb-bal.is-pos").first()).toContainText("owes you 1");
    await expect(b.locator(".fb-bal.is-neg").first()).toContainText("you owe them 1");
  } finally {
    await cleanup();
  }
});
