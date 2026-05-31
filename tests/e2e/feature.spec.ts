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
    await a.getByPlaceholder("or paste a payload (URL or mesh://)").fill(bPayload);
    await a.getByRole("button", { name: "use", exact: true }).click();

    await expect(a.locator(".fb-bal.is-pos").first()).toContainText("owes you 1");
    await expect(b.locator(".fb-bal.is-neg").first()).toContainText("you owe them 1");
  } finally {
    await cleanup();
  }
});

// Load-bearing cross-peer test: the favor recorded on A — including its note —
// must land in B's *transaction* feed (the advertised "ledger of who owes whom"),
// and a return favor logged by B must net the relationship back to "even" on
// BOTH peers. This drives the real record()→txs.push() Yjs path on the opposite
// peer; it fails if writes go to local useState instead of room.doc.
test("a favor + its note propagate to B's tx feed, and a return favor nets to even", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    // A logs "i did them a favor" with a note, by pasting B's payload.
    await a.getByPlaceholder("optional note (e.g. coffee run)").fill("coffee run");
    await b.locator(".mesh-qrx-payload summary").click();
    const bPayload = (await b.locator(".mesh-qrx-payload code").textContent()) ?? "";
    await a.getByPlaceholder("or paste a payload (URL or mesh://)").fill(bPayload);
    await a.getByRole("button", { name: "use", exact: true }).click();

    // The transaction (with name resolution + note) must show up on B.
    const bTx = b.locator(".fb-tx li").first();
    await expect(bTx).toContainText("alice");
    await expect(bTx).toContainText("bob");
    await expect(bTx).toContainText("coffee run");

    // Now B logs a return favor for A, which should net both ledgers to "even".
    await a.locator(".mesh-qrx-payload summary").click();
    const aPayload = (await a.locator(".mesh-qrx-payload code").textContent()) ?? "";
    await b.getByPlaceholder("or paste a payload (URL or mesh://)").fill(aPayload);
    await b.getByRole("button", { name: "use", exact: true }).click();

    await expect(a.locator(".fb-bal").first()).toContainText("even");
    await expect(b.locator(".fb-bal").first()).toContainText("even");
  } finally {
    await cleanup();
  }
});
