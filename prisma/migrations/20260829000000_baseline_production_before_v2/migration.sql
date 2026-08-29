-- Prisma baseline: production schema immediately before V2 expand migrations.
-- Schema-only PostgreSQL 16 dump; intentionally contains no data, owner or ACL.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path = public, pg_catalog;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'SHIPPED',
    'CANCELLED'
);


--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'CASH',
    'CARD'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED'
);


--
-- Name: PromotionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PromotionType" AS ENUM (
    'PERCENT_OFF',
    'FIXED_AMOUNT_OFF',
    'BUY_X_GET_Y_FREE',
    'BUY_X_GET_PERCENT',
    'FREE_SHIPPING',
    'QUANTITY_DISCOUNT'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'CUSTOMER',
    'OPERATOR',
    'ADMIN'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Address; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Address" (
    id text NOT NULL,
    "userId" text NOT NULL,
    street text NOT NULL,
    apartment text,
    city text NOT NULL,
    "postalCode" text NOT NULL,
    country text DEFAULT 'Srbija'::text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL
);


--
-- Name: Article; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Article" (
    id text NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    content text NOT NULL,
    excerpt text,
    image1 text,
    image2 text,
    image3 text,
    author text,
    published boolean DEFAULT false NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "metaTitle" text,
    "metaDescription" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Banner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Banner" (
    id text NOT NULL,
    title jsonb NOT NULL,
    subtitle jsonb,
    description jsonb,
    "imageData" text NOT NULL,
    "contentType" text NOT NULL,
    "linkUrl" text,
    "buttonText" jsonb,
    "position" text DEFAULT 'home_hero'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Brand; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Brand" (
    id text NOT NULL,
    name jsonb NOT NULL,
    slug text NOT NULL,
    logo text,
    description jsonb,
    active boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Category" (
    id text NOT NULL,
    name jsonb NOT NULL,
    slug text NOT NULL,
    description jsonb,
    image text,
    "parentId" text,
    "showInNav" boolean DEFAULT false NOT NULL,
    "navOrder" integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ChatFAQ; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChatFAQ" (
    id text NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    category text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ChatMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChatMessage" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    message text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "adminNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Color; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Color" (
    id text NOT NULL,
    name text NOT NULL,
    hex text NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: CouponUsage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CouponUsage" (
    id text NOT NULL,
    "promotionId" text NOT NULL,
    "userId" text,
    "orderId" text,
    "usedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EmailVerification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmailVerification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Newsletter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Newsletter" (
    id text NOT NULL,
    subject text NOT NULL,
    content text NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "sentBy" text NOT NULL,
    "recipientCount" integer NOT NULL
);


--
-- Name: NewsletterImage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NewsletterImage" (
    id text NOT NULL,
    name text NOT NULL,
    "imageData" text NOT NULL,
    "contentType" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: NewsletterSubscriber; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NewsletterSubscriber" (
    id text NOT NULL,
    email text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Order" (
    id text NOT NULL,
    "orderNumber" text NOT NULL,
    "userId" text,
    "guestEmail" text,
    "guestFirstName" text,
    "guestLastName" text,
    "guestPhone" text,
    "shippingStreet" text NOT NULL,
    "shippingCity" text NOT NULL,
    "shippingPostal" text NOT NULL,
    "shippingCountry" text DEFAULT 'Srbija'::text NOT NULL,
    "paymentMethod" public."PaymentMethod" NOT NULL,
    "paymentStatus" public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    status public."OrderStatus" DEFAULT 'PENDING'::public."OrderStatus" NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    shipping numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) NOT NULL,
    "couponCode" text,
    "promotionIds" text[],
    note text,
    "trackingNumber" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OrderItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrderItem" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "productId" text,
    "productCode" text NOT NULL,
    "productName" text NOT NULL,
    size text NOT NULL,
    quantity integer NOT NULL,
    price numeric(10,2) NOT NULL,
    picture text
);


--
-- Name: PasswordReset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PasswordReset" (
    id text NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    name jsonb NOT NULL,
    slug text NOT NULL,
    description jsonb,
    sku text,
    price numeric(10,2) NOT NULL,
    "salePrice" numeric(10,2),
    image1 text,
    image2 text,
    image3 text,
    "categoryId" text,
    "brandId" text,
    gender text,
    active boolean DEFAULT true NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    "onSale" boolean DEFAULT false NOT NULL,
    novo boolean DEFAULT false NOT NULL,
    "metaTitle" jsonb,
    "metaDescription" jsonb,
    "erpId" text,
    color text,
    "colorHex" text,
    material text,
    weight numeric(8,2),
    length numeric(8,2),
    width numeric(8,2),
    height numeric(8,2),
    "countryOfOrigin" text,
    "careInstructions" jsonb,
    barcode text,
    tags text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ProductCategory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductCategory" (
    id text NOT NULL,
    "productId" text NOT NULL,
    "categoryId" text NOT NULL
);


--
-- Name: ProductReview; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductReview" (
    id text NOT NULL,
    "productId" text,
    "productCode" text NOT NULL,
    "userId" text NOT NULL,
    rating integer NOT NULL,
    title text,
    comment text,
    verified boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ProductSize; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductSize" (
    id text NOT NULL,
    "productId" text NOT NULL,
    size text NOT NULL,
    stock integer DEFAULT 0 NOT NULL
);


--
-- Name: ProductVariant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductVariant" (
    id text NOT NULL,
    "productId" text NOT NULL,
    color text,
    "colorHex" text,
    size text,
    sku text,
    stock integer DEFAULT 0 NOT NULL,
    price numeric(10,2),
    image text
);


--
-- Name: Promotion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Promotion" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    type public."PromotionType" NOT NULL,
    value numeric(10,2) NOT NULL,
    "minQuantity" integer,
    "minCartValue" numeric(10,2),
    "maxUses" integer,
    "usedCount" integer DEFAULT 0 NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    code text,
    stackable boolean DEFAULT false NOT NULL,
    "quantityTiers" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PromotionProduct; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PromotionProduct" (
    id text NOT NULL,
    "promotionId" text NOT NULL,
    "productId" text NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: Setting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Setting" (
    id text NOT NULL,
    key text NOT NULL,
    value text NOT NULL
);


--
-- Name: SizeTable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SizeTable" (
    id text NOT NULL,
    "brandName" text NOT NULL,
    sizes jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StoreLocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StoreLocation" (
    id text NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    phone text,
    email text,
    hours text NOT NULL,
    "mapUrl" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TickerMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TickerMessage" (
    id text NOT NULL,
    text jsonb NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Transaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Transaction" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "transId" text,
    "authCode" text,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'RSD'::text NOT NULL,
    status text NOT NULL,
    "rawResponse" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    phone text,
    role public."Role" DEFAULT 'CUSTOMER'::public."Role" NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    "newsletterOptIn" boolean DEFAULT false NOT NULL,
    "preferredLocale" text DEFAULT 'sr'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Wishlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Wishlist" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "productId" text,
    "externalProductId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Address Address_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Address"
    ADD CONSTRAINT "Address_pkey" PRIMARY KEY (id);


--
-- Name: Article Article_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Article"
    ADD CONSTRAINT "Article_pkey" PRIMARY KEY (id);


--
-- Name: Banner Banner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Banner"
    ADD CONSTRAINT "Banner_pkey" PRIMARY KEY (id);


--
-- Name: Brand Brand_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Brand"
    ADD CONSTRAINT "Brand_pkey" PRIMARY KEY (id);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: ChatFAQ ChatFAQ_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatFAQ"
    ADD CONSTRAINT "ChatFAQ_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessage ChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY (id);


--
-- Name: Color Color_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Color"
    ADD CONSTRAINT "Color_pkey" PRIMARY KEY (id);


--
-- Name: CouponUsage CouponUsage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CouponUsage"
    ADD CONSTRAINT "CouponUsage_pkey" PRIMARY KEY (id);


--
-- Name: EmailVerification EmailVerification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailVerification"
    ADD CONSTRAINT "EmailVerification_pkey" PRIMARY KEY (id);


--
-- Name: NewsletterImage NewsletterImage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NewsletterImage"
    ADD CONSTRAINT "NewsletterImage_pkey" PRIMARY KEY (id);


--
-- Name: NewsletterSubscriber NewsletterSubscriber_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NewsletterSubscriber"
    ADD CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY (id);


--
-- Name: Newsletter Newsletter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Newsletter"
    ADD CONSTRAINT "Newsletter_pkey" PRIMARY KEY (id);


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: PasswordReset PasswordReset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordReset"
    ADD CONSTRAINT "PasswordReset_pkey" PRIMARY KEY (id);


--
-- Name: ProductCategory ProductCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductCategory"
    ADD CONSTRAINT "ProductCategory_pkey" PRIMARY KEY (id);


--
-- Name: ProductReview ProductReview_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductReview"
    ADD CONSTRAINT "ProductReview_pkey" PRIMARY KEY (id);


--
-- Name: ProductSize ProductSize_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductSize"
    ADD CONSTRAINT "ProductSize_pkey" PRIMARY KEY (id);


--
-- Name: ProductVariant ProductVariant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductVariant"
    ADD CONSTRAINT "ProductVariant_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: PromotionProduct PromotionProduct_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromotionProduct"
    ADD CONSTRAINT "PromotionProduct_pkey" PRIMARY KEY (id);


--
-- Name: Promotion Promotion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Promotion"
    ADD CONSTRAINT "Promotion_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: Setting Setting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Setting"
    ADD CONSTRAINT "Setting_pkey" PRIMARY KEY (id);


--
-- Name: SizeTable SizeTable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SizeTable"
    ADD CONSTRAINT "SizeTable_pkey" PRIMARY KEY (id);


--
-- Name: StoreLocation StoreLocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StoreLocation"
    ADD CONSTRAINT "StoreLocation_pkey" PRIMARY KEY (id);


--
-- Name: TickerMessage TickerMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TickerMessage"
    ADD CONSTRAINT "TickerMessage_pkey" PRIMARY KEY (id);


--
-- Name: Transaction Transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Wishlist Wishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wishlist"
    ADD CONSTRAINT "Wishlist_pkey" PRIMARY KEY (id);


--
-- Name: Address_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Address_userId_idx" ON public."Address" USING btree ("userId");


--
-- Name: Article_publishedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Article_publishedAt_idx" ON public."Article" USING btree ("publishedAt");


--
-- Name: Article_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Article_published_idx" ON public."Article" USING btree (published);


--
-- Name: Article_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Article_slug_idx" ON public."Article" USING btree (slug);


--
-- Name: Article_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Article_slug_key" ON public."Article" USING btree (slug);


--
-- Name: Banner_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Banner_order_idx" ON public."Banner" USING btree ("order");


--
-- Name: Banner_position_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Banner_position_isActive_idx" ON public."Banner" USING btree ("position", "isActive");


--
-- Name: Brand_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Brand_active_idx" ON public."Brand" USING btree (active);


--
-- Name: Brand_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Brand_slug_idx" ON public."Brand" USING btree (slug);


--
-- Name: Brand_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Brand_slug_key" ON public."Brand" USING btree (slug);


--
-- Name: Category_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Category_active_idx" ON public."Category" USING btree (active);


--
-- Name: Category_parentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Category_parentId_idx" ON public."Category" USING btree ("parentId");


--
-- Name: Category_showInNav_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Category_showInNav_idx" ON public."Category" USING btree ("showInNav");


--
-- Name: Category_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Category_slug_idx" ON public."Category" USING btree (slug);


--
-- Name: Category_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Category_slug_key" ON public."Category" USING btree (slug);


--
-- Name: ChatFAQ_active_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChatFAQ_active_sortOrder_idx" ON public."ChatFAQ" USING btree (active, "sortOrder");


--
-- Name: ChatMessage_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChatMessage_createdAt_idx" ON public."ChatMessage" USING btree ("createdAt");


--
-- Name: ChatMessage_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChatMessage_isRead_idx" ON public."ChatMessage" USING btree ("isRead");


--
-- Name: Color_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Color_active_idx" ON public."Color" USING btree (active);


--
-- Name: Color_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Color_name_key" ON public."Color" USING btree (name);


--
-- Name: CouponUsage_promotionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CouponUsage_promotionId_idx" ON public."CouponUsage" USING btree ("promotionId");


--
-- Name: CouponUsage_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CouponUsage_userId_idx" ON public."CouponUsage" USING btree ("userId");


--
-- Name: EmailVerification_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailVerification_token_idx" ON public."EmailVerification" USING btree (token);


--
-- Name: EmailVerification_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmailVerification_token_key" ON public."EmailVerification" USING btree (token);


--
-- Name: EmailVerification_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailVerification_userId_idx" ON public."EmailVerification" USING btree ("userId");


--
-- Name: NewsletterImage_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NewsletterImage_createdAt_idx" ON public."NewsletterImage" USING btree ("createdAt");


--
-- Name: NewsletterSubscriber_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NewsletterSubscriber_active_idx" ON public."NewsletterSubscriber" USING btree (active);


--
-- Name: NewsletterSubscriber_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NewsletterSubscriber_email_idx" ON public."NewsletterSubscriber" USING btree (email);


--
-- Name: NewsletterSubscriber_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON public."NewsletterSubscriber" USING btree (email);


--
-- Name: Newsletter_sentAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Newsletter_sentAt_idx" ON public."Newsletter" USING btree ("sentAt");


--
-- Name: OrderItem_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderItem_orderId_idx" ON public."OrderItem" USING btree ("orderId");


--
-- Name: OrderItem_productCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderItem_productCode_idx" ON public."OrderItem" USING btree ("productCode");


--
-- Name: Order_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_createdAt_idx" ON public."Order" USING btree ("createdAt");


--
-- Name: Order_orderNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_orderNumber_idx" ON public."Order" USING btree ("orderNumber");


--
-- Name: Order_orderNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Order_orderNumber_key" ON public."Order" USING btree ("orderNumber");


--
-- Name: Order_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_status_idx" ON public."Order" USING btree (status);


--
-- Name: Order_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_userId_idx" ON public."Order" USING btree ("userId");


--
-- Name: PasswordReset_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PasswordReset_token_idx" ON public."PasswordReset" USING btree (token);


--
-- Name: PasswordReset_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PasswordReset_token_key" ON public."PasswordReset" USING btree (token);


--
-- Name: PasswordReset_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PasswordReset_userId_idx" ON public."PasswordReset" USING btree ("userId");


--
-- Name: ProductCategory_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductCategory_categoryId_idx" ON public."ProductCategory" USING btree ("categoryId");


--
-- Name: ProductCategory_productId_categoryId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProductCategory_productId_categoryId_key" ON public."ProductCategory" USING btree ("productId", "categoryId");


--
-- Name: ProductCategory_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductCategory_productId_idx" ON public."ProductCategory" USING btree ("productId");


--
-- Name: ProductReview_productCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductReview_productCode_idx" ON public."ProductReview" USING btree ("productCode");


--
-- Name: ProductReview_productCode_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProductReview_productCode_userId_key" ON public."ProductReview" USING btree ("productCode", "userId");


--
-- Name: ProductReview_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductReview_userId_idx" ON public."ProductReview" USING btree ("userId");


--
-- Name: ProductSize_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductSize_productId_idx" ON public."ProductSize" USING btree ("productId");


--
-- Name: ProductVariant_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductVariant_productId_idx" ON public."ProductVariant" USING btree ("productId");


--
-- Name: Product_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_active_idx" ON public."Product" USING btree (active);


--
-- Name: Product_brandId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_brandId_idx" ON public."Product" USING btree ("brandId");


--
-- Name: Product_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_categoryId_idx" ON public."Product" USING btree ("categoryId");


--
-- Name: Product_color_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_color_idx" ON public."Product" USING btree (color);


--
-- Name: Product_featured_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_featured_idx" ON public."Product" USING btree (featured);


--
-- Name: Product_novo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_novo_idx" ON public."Product" USING btree (novo);


--
-- Name: Product_onSale_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_onSale_idx" ON public."Product" USING btree ("onSale");


--
-- Name: Product_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_sku_key" ON public."Product" USING btree (sku);


--
-- Name: Product_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_slug_idx" ON public."Product" USING btree (slug);


--
-- Name: Product_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_slug_key" ON public."Product" USING btree (slug);


--
-- Name: PromotionProduct_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PromotionProduct_productId_idx" ON public."PromotionProduct" USING btree ("productId");


--
-- Name: PromotionProduct_promotionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PromotionProduct_promotionId_idx" ON public."PromotionProduct" USING btree ("promotionId");


--
-- Name: PromotionProduct_promotionId_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PromotionProduct_promotionId_productId_key" ON public."PromotionProduct" USING btree ("promotionId", "productId");


--
-- Name: Promotion_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Promotion_code_idx" ON public."Promotion" USING btree (code);


--
-- Name: Promotion_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Promotion_code_key" ON public."Promotion" USING btree (code);


--
-- Name: Promotion_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Promotion_isActive_idx" ON public."Promotion" USING btree ("isActive");


--
-- Name: Promotion_startDate_endDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Promotion_startDate_endDate_idx" ON public."Promotion" USING btree ("startDate", "endDate");


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: Session_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Session_userId_idx" ON public."Session" USING btree ("userId");


--
-- Name: Setting_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Setting_key_idx" ON public."Setting" USING btree (key);


--
-- Name: Setting_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Setting_key_key" ON public."Setting" USING btree (key);


--
-- Name: SizeTable_brandName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SizeTable_brandName_idx" ON public."SizeTable" USING btree ("brandName");


--
-- Name: SizeTable_brandName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SizeTable_brandName_key" ON public."SizeTable" USING btree ("brandName");


--
-- Name: StoreLocation_isActive_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StoreLocation_isActive_sortOrder_idx" ON public."StoreLocation" USING btree ("isActive", "sortOrder");


--
-- Name: TickerMessage_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TickerMessage_isActive_idx" ON public."TickerMessage" USING btree ("isActive");


--
-- Name: TickerMessage_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TickerMessage_order_idx" ON public."TickerMessage" USING btree ("order");


--
-- Name: Transaction_orderId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Transaction_orderId_key" ON public."Transaction" USING btree ("orderId");


--
-- Name: Transaction_transId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Transaction_transId_idx" ON public."Transaction" USING btree ("transId");


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Wishlist_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Wishlist_userId_idx" ON public."Wishlist" USING btree ("userId");


--
-- Name: Wishlist_userId_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON public."Wishlist" USING btree ("userId", "productId");


--
-- Name: Address Address_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Address"
    ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Category Category_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CouponUsage CouponUsage_promotionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CouponUsage"
    ADD CONSTRAINT "CouponUsage_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES public."Promotion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmailVerification EmailVerification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailVerification"
    ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Order Order_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PasswordReset PasswordReset_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordReset"
    ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductCategory ProductCategory_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductCategory"
    ADD CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductCategory ProductCategory_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductCategory"
    ADD CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductReview ProductReview_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductReview"
    ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductReview ProductReview_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductReview"
    ADD CONSTRAINT "ProductReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductSize ProductSize_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductSize"
    ADD CONSTRAINT "ProductSize_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductVariant ProductVariant_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductVariant"
    ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Product Product_brandId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES public."Brand"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Product Product_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PromotionProduct PromotionProduct_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromotionProduct"
    ADD CONSTRAINT "PromotionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PromotionProduct PromotionProduct_promotionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromotionProduct"
    ADD CONSTRAINT "PromotionProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES public."Promotion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Transaction Transaction_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Wishlist Wishlist_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wishlist"
    ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Wishlist Wishlist_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wishlist"
    ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;
