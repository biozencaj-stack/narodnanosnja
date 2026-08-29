import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidateTag } from "next/cache";
import {
  storeSettingFields,
  validateStoreSetting,
  validateStoreThemeContrast,
} from "@/lib/config/store-settings-schema";
import { getStoreSettings } from "@/lib/config/store-settings";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getStoreSettings();
    return NextResponse.json({ settings, fields: storeSettingFields });
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju podešavanja" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { settings } = body as { settings?: Record<string, unknown> };

    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return NextResponse.json(
        { error: "Invalid settings format" },
        { status: 400 }
      );
    }

    const errors: Record<string, string> = {};
    const updates: { key: string; value: string }[] = [];
    for (const field of storeSettingFields) {
      if (!(field.key in settings)) continue;
      const value = settings[field.key];
      const error = validateStoreSetting(field, value);
      if (error) errors[field.key] = error;
      else updates.push({ key: field.key, value: String(value).trim() });
    }

    const currentSettings = await getStoreSettings();
    const normalizedUpdates = Object.fromEntries(
      updates.map((setting) => [setting.key, setting.value]),
    );
    const nextSettings = { ...currentSettings, ...normalizedUpdates };
    Object.assign(errors, validateStoreThemeContrast(nextSettings));

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: "Proverite označena polja", errors },
        { status: 400 },
      );
    }

    await prisma.$transaction(
      updates.map((setting) =>
        prisma.setting.upsert({
          where: { key: setting.key },
          update: { value: setting.value },
          create: setting,
        }),
      ),
    );
    revalidateTag("settings", { expire: 0 });

    return NextResponse.json({
      message: "Podešavanja sačuvana",
      settings: nextSettings,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Greška pri čuvanju podešavanja" },
      { status: 500 }
    );
  }
}
