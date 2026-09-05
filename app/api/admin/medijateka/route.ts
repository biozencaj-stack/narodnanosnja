import { resolveServerSession } from "@/lib/auth/server-session";
import { prisma } from "@/lib/db";
import { createMedijatekaGetHandler } from "@/lib/media/medijateka-rute";
import { prijaviNeuspehMedija } from "@/lib/media/prisma-veze";

export const GET = createMedijatekaGetHandler({
  resolveSession: () => resolveServerSession(),
  nadjiAssete: (upit) =>
    prisma.mediaAsset.findMany({
      where: upit.folder === null ? {} : { folder: upit.folder },
      orderBy: { createdAt: "desc" },
      take: upit.limit,
      select: {
        id: true,
        path: true,
        folder: true,
        width: true,
        height: true,
        bytes: true,
        alt: true,
        createdAt: true,
        _count: { select: { usages: true } },
      },
    }),
  reportFailure: prijaviNeuspehMedija,
});
