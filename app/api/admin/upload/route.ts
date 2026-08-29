import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

/**
 * POST /api/admin/upload
 * Upload an image file, resize it, and save to public/uploads/
 * Accepts FormData with: file (File), folder (string: products|articles|categories|brands)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "products";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 },
      );
    }

    // Validate file size (max 1MB - images should be optimized before upload)
    if (file.size > 1 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Fajl je prevelik. Maksimalna veličina je 1MB. Smanjite rezoluciju ili kompresujte sliku pre uploada." },
        { status: 400 },
      );
    }

    // Validate folder
    const allowedFolders = ["products", "articles", "categories", "brands"];
    if (!allowedFolders.includes(folder)) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Process image with sharp - resize to max 800x800, convert to WebP with strong compression
    const processed = await sharp(buffer)
      .resize(800, 800, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}-${randomStr}.webp`;

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
    await fs.mkdir(uploadDir, { recursive: true });

    // Save file
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, processed);

    // Return the public URL path
    const publicPath = `/uploads/${folder}/${filename}`;

    return NextResponse.json({
      path: publicPath,
      filename,
      size: processed.length,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 },
    );
  }
}
