import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const locations = [
  {
    name: "DemoShop Beograd Centar",
    address: "Knez Mihailova 25",
    city: "Beograd",
    phone: "011 123 4567",
    email: "beograd@demoshop.rs",
    hours: "Pon-Pet: 09-21h | Sub: 09-17h | Ned: 10-16h",
    mapUrl: "https://maps.google.com/?q=Knez+Mihailova+25+Beograd",
    isActive: true,
    sortOrder: 0,
  },
  {
    name: "DemoShop Novi Sad",
    address: "Bulevar Mihajla Pupina 3",
    city: "Novi Sad",
    phone: "021 456 7890",
    email: "novisad@demoshop.rs",
    hours: "Pon-Pet: 09-21h | Sub: 09-17h | Ned: 10-16h",
    mapUrl: "https://maps.google.com/?q=Bulevar+Mihajla+Pupina+3+Novi+Sad",
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "DemoShop Niš",
    address: "Obrenovićeva 38",
    city: "Niš",
    phone: "018 234 5678",
    email: "nis@demoshop.rs",
    hours: "Pon-Pet: 09-20h | Sub: 09-16h",
    mapUrl: "https://maps.google.com/?q=Obrenoviceva+38+Nis",
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "DemoShop Kragujevac",
    address: "Kralja Petra I 15",
    city: "Kragujevac",
    phone: "034 345 6789",
    email: "kragujevac@demoshop.rs",
    hours: "Pon-Pet: 09-20h | Sub: 09-15h",
    mapUrl: "https://maps.google.com/?q=Kralja+Petra+I+15+Kragujevac",
    isActive: true,
    sortOrder: 3,
  },
  {
    name: "DemoShop Subotica",
    address: "Korzo 5",
    city: "Subotica",
    phone: "024 567 8901",
    email: "subotica@demoshop.rs",
    hours: "Pon-Pet: 09-20h | Sub: 09-15h",
    mapUrl: "https://maps.google.com/?q=Korzo+5+Subotica",
    isActive: true,
    sortOrder: 4,
  },
];

async function main() {
  console.log("Seeding 5 store locations...");

  for (const loc of locations) {
    const existing = await prisma.storeLocation.findFirst({
      where: { name: loc.name },
    });
    if (!existing) {
      await prisma.storeLocation.create({ data: loc });
      console.log(`  Created: ${loc.name}`);
    } else {
      console.log(`  Skipped (exists): ${loc.name}`);
    }
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
