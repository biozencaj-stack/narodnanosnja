import assert from "node:assert/strict";
import test from "node:test";
import { MAX_ISTOVREMENO, saOgranicenjemObrade, zauzetihMesta } from "./semafor";

function odlozeno<T>(vrednost: T, cekanje: { resolve: () => void }) {
  return new Promise<T>((resolve) => {
    cekanje.resolve = () => resolve(vrednost);
  });
}

test("nikad ne radi više poslova nego što je dozvoljeno", async () => {
  const kontrole: { resolve: () => void }[] = [];
  let najvise = 0;
  let uToku = 0;

  const poslovi = Array.from({ length: MAX_ISTOVREMENO + 3 }, () => {
    const kontrola = { resolve: () => undefined as void };
    kontrole.push(kontrola);
    return saOgranicenjemObrade(async () => {
      uToku += 1;
      najvise = Math.max(najvise, uToku);
      await odlozeno(null, kontrola);
      uToku -= 1;
    });
  });

  // Pusti ih redom; svaki oslobađa mesto za sledeći.
  for (const kontrola of kontrole) {
    await new Promise((resolve) => setImmediate(resolve));
    kontrola.resolve();
  }
  await Promise.all(poslovi);

  assert.ok(
    najvise <= MAX_ISTOVREMENO,
    `istovremeno je radilo ${najvise}, dozvoljeno ${MAX_ISTOVREMENO}`,
  );
});

test("neuspeh posla vraća mesto, inače bi se otpremanje trajno zaglavilo", async () => {
  for (let i = 0; i < MAX_ISTOVREMENO + 2; i += 1) {
    await assert.rejects(
      saOgranicenjemObrade(async () => {
        throw new Error("obrada pukla");
      }),
      /obrada pukla/,
    );
  }

  assert.equal(zauzetihMesta(), 0);

  // Posle serije grešaka semafor i dalje pušta posao.
  assert.equal(await saOgranicenjemObrade(async () => "radi"), "radi");
});
