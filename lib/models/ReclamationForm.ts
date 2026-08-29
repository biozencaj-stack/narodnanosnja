import { storeName, storeAddress, storeCity, storeEmail, storePhone } from "@/lib/config/store";

export default class ReclamationForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  itemCode: string;
  itemSize: string;
  orderNumber: string;
  fiscalNumber: string;
  desc: string;
  buyerRequest: number;

  constructor(
    name: string,
    email: string,
    phone: string,
    address: string,
    city: string,
    itemCode: string,
    itemSize: string,
    orderNumber: string,
    fiscalNumber: string,
    desc: string,
    buyerRequest: number
  ) {
    this.name = name;
    this.email = email;
    this.phone = phone;
    this.address = address;
    this.city = city;
    this.itemCode = itemCode;
    this.itemSize = itemSize;
    this.orderNumber = orderNumber;
    this.fiscalNumber = fiscalNumber;
    this.desc = desc;
    this.buyerRequest = buyerRequest;
  }

  getBuyerRequest(): string {
    switch (this.buyerRequest) {
      case 0:
        return 'Zamena za drugi artikal';
      case 1:
        return 'Povrat novca';
      case 2:
        return 'Servis artikla';
      default:
        return 'Nije nista odabrano!';
    }
  }

  formatMailBody(): string {
    return `
<!DOCTYPE html>
<html lang="sr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Podaci o Reklamaciji</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f8f8f8;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: #fff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
        }
        h2 {
            text-align: center;
            color: #005229;
        }
        .info {
            margin-top: 20px;
            padding: 10px;
            background-color: #e0f7fa;
            border-radius: 5px;
        }
        .info p {
            margin: 10px 0;
            color: #333;
        }
        .info strong {
            color: #005229;
        }
        .contact-info {
            margin-top: 20px;
            text-align: center;
        }
        .contact-info p {
            margin: 5px 0;
            color: #555;
        }
    </style>
</head>
<body>
<div class="container">
    <h2>Podaci o Reklamaciji</h2>
    <div class="info">
        <p><strong>Ime i Prezime: </strong>${this.name}</p>
        <p><strong>Email: </strong>${this.email}</p>
        <p><strong>Telefon: </strong>${this.phone}</p>
        <p><strong>Adresa: </strong>${this.address}</p>
        <p><strong>Grad i Poštanski Broj: </strong>${this.city}</p>
        <p><strong>Naziv i Šifra Artikla: </strong>${this.itemCode}</p>
        <p><strong>Veličina: </strong>${this.itemSize}</p>
        <p><strong>Broj Porudžbine: </strong>${this.orderNumber}</p>
        <p><strong>Fiskalni Broj: </strong>${this.fiscalNumber}</p>
        <p><strong>Opis Nesaobraznosti: </strong>${this.desc}</p>
        <p><strong>Zahtev Potrošača: </strong>${this.getBuyerRequest()}</p>
    </div>
    <div class="contact-info">
        <p><strong>${storeName}</strong></p>
        <p>${storeAddress}${storeAddress && storeCity ? ", " : ""}${storeCity}${storeAddress || storeCity ? ", Srbija" : "Srbija"}</p>
        <p>Email: ${storeEmail}</p>
        <p>Telefon: ${storePhone}</p>
    </div>
</div>
</body>
</html>
`;
  }
}
