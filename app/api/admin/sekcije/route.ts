import { resolveServerSession } from "@/lib/auth/server-session";
import { prisma } from "@/lib/db";
import {
  createSekcijeGetHandler,
  createSekcijePostHandler,
} from "@/lib/sekcije/rute";
import { prijaviNeuspeh } from "@/lib/sekcije/prisma-veze";

export const GET = createSekcijeGetHandler({
  resolveSession: () => resolveServerSession(),
  nadjiSekcije: (pageKey) =>
    prisma.pageSection.findMany({
      where: { pageKey },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    }),
  reportFailure: prijaviNeuspeh,
});

export const POST = createSekcijePostHandler({
  resolveSession: () => resolveServerSession(),
  prebrojTipNaStrani: (pageKey, kind) =>
    prisma.pageSection.count({ where: { pageKey, kind } }),
  poslednjiRedosled: async (pageKey) => {
    const poslednja = await prisma.pageSection.findFirst({
      where: { pageKey },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return poslednja?.order ?? null;
  },
  napravi: (podaci) =>
    prisma.pageSection.create({
      data: {
        pageKey: podaci.pageKey,
        kind: podaci.kind,
        order: podaci.order,
        isActive: true,
        config: podaci.config as object,
        updatedById: podaci.korisnikId,
      },
    }),
  reportFailure: prijaviNeuspeh,
});
