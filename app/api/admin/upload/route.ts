import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { checkRateLimit } from "@/lib/rate-limit";
import { proveriUlazUploada } from "@/lib/media/upload-ulaz";
import { saOgranicenjemObrade } from "@/lib/media/semafor";

/**
 * POST /api/admin/upload
 *
 * Prima `FormData` sa `file` i `folder`. Granice veličine i dimenzija dolaze iz
 * profila u `lib/media/profili.ts` — razlikuju se po fascikli, jer hero slika i
 * ikona nemaju istu namenu.
 *
 * Odgovor nosi i `width`/`height`. To nije besplatan podatak: dobija se tako
 * što `.toBuffer()` postaje `.toBuffer({ resolveWithObject: true })`. Bez njih
 * bi pozivalac morao ponovo da otvara fajl da bi znao šta je dobio.
 */

const MAX_UPLOADA_U_MINUTU = 20;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Prijava je obavezna." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Nemate dozvolu za ovu administrativnu akciju." },
      { status: 403 },
    );
  }

  // Ključ je korisnik, ne IP: administratori rade iza iste kancelarijske adrese,
  // pa bi po IP-u jedan blokirao ostale.
  if (!checkRateLimit(`upload:${session.user.id}`, MAX_UPLOADA_U_MINUTU)) {
    return NextResponse.json(
      { error: "Previše otpremanja u kratkom roku. Sačekaj minut." },
      { status: 429 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = formData.get("folder") ?? "products";

    const ulaz = proveriUlazUploada(
      file instanceof File ? { type: file.type, size: file.size } : null,
      folder,
    );
    if (!ulaz.ok) {
      return NextResponse.json({ error: ulaz.poruka }, { status: ulaz.status });
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Nijedan fajl nije poslat." },
        { status: 400 },
      );
    }

    const profil = ulaz.profil;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Semafor: `sharp` drži dekodovani bitmap u memoriji, pa nekoliko
    // istovremenih velikih slika obori ceo proces, ne samo jedan zahtev.
    const { data: processed, info } = await saOgranicenjemObrade(() =>
      sharp(buffer)
        .resize(profil.maxSirina, profil.maxVisina, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: profil.kvalitet })
        .toBuffer({ resolveWithObject: true }),
    );

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}-${randomStr}.webp`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", profil.folder);
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, filename), processed);

    return NextResponse.json({
      path: `/uploads/${profil.folder}/${filename}`,
      filename,
      size: processed.length,
      width: info.width,
      height: info.height,
    });
  } catch (error) {
    // `sharp` puca i na fajlu koji tvrdi da je slika a nije — `file.type` u
    // `FormData` postavlja klijent i može da laže. To je greška klijenta, ne
    // servera, pa je odgovor 400.
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Fajl nije moguće pročitati kao sliku." },
      { status: 400 },
    );
  }
}
