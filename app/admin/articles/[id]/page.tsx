"use client";

import { use } from "react";
import ArticleForm from "../ArticleForm";

export default function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ArticleForm articleId={id} />;
}
