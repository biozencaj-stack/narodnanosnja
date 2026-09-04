import { resolveServerSession } from "@/lib/auth/server-session";
import { createMedijatekaDeleteHandler } from "@/lib/media/medijateka-rute";
import {
  nadjiUpotrebeAsseta,
  obrisiAsset,
  prijaviNeuspehMedija,
} from "@/lib/media/prisma-veze";

export const DELETE = createMedijatekaDeleteHandler({
  resolveSession: () => resolveServerSession(),
  nadjiUpotrebe: nadjiUpotrebeAsseta,
  obrisiAsset: obrisiAsset,
  reportFailure: prijaviNeuspehMedija,
});
