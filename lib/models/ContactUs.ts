import { storeName, storeAddress, storeCity, storeEmail, storePhone } from "@/lib/config/store";

export default class ContactUs {
  name: string;
  email: string;
  tel: string;
  msgContext: string;
  msg: string;

  constructor(name: string, email: string, tel: string, msgContext: string, msg: string) {
    this.name = name;
    this.email = email;
    this.tel = tel;
    this.msgContext = msgContext;
    this.msg = msg;
  }

  formatMailBody(): string {
    return `
<!DOCTYPE html>
<html lang="sr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Podaci o kupcu</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f8f8f8;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
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
            margin: 5px 0;
            color: #333;
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
    <h2>Podaci o kupcu</h2>
    <div class="info">
        <p><strong>Ime i prezime: </strong>${this.name}</p>
        <p><strong>Email: </strong>${this.email}</p>
        <p><strong>Telefon: </strong>${this.tel}</p>
        <p><strong>Svrha poruke: </strong>${this.msgContext}</p>
        <p><strong>Tekst poruke: </strong>${this.msg}</p>
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
