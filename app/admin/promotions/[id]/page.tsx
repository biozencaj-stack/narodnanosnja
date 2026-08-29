"use client";

import { use } from "react";
import PromotionForm from "../PromotionForm";

export default function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PromotionForm promotionId={id} />;
}
