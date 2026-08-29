"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Instagram, Play, Grid3X3, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstagramPost {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
}

const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL || "";

export function InstagramFeed() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const fetchPosts = async () => {
      try {
        const response = await fetch("/api/instagram-feed", {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to load Instagram posts");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid data format from Instagram API");
        }

        setPosts(data);
      } catch (err) {
        console.error("Instagram fetch error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [mounted]);

  const getMediaUrl = (post: InstagramPost): string | null => {
    if (!post) return null;
    if (post.media_type === "VIDEO") {
      return post.thumbnail_url || post.media_url;
    }
    if (post.media_type === "CAROUSEL_ALBUM" && post.thumbnail_url) {
      return post.thumbnail_url;
    }
    return post.media_url;
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <section className="py-16 lg:py-24 bg-background-alt overflow-hidden">
        <div className="container-wide">
          <div className="text-center mb-12">
            <div className="h-8 w-48 bg-border/50 rounded-lg mx-auto mb-3 animate-pulse" />
            <div className="h-5 w-32 bg-border/30 rounded mx-auto animate-pulse" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-border/30 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || !posts || posts.length === 0) {
    if (!instagramUrl) return null;

    return (
      <section className="py-16 lg:py-24 bg-background-alt">
        <div className="container-wide">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 p-10 md:p-16 text-center">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border-[40px] border-white/20" />
            </div>

            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-6">
                <Instagram className="h-8 w-8 text-white" />
              </div>
              <h2 className="font-display text-2xl md:text-3xl lg:text-4xl text-white mb-3">
                Pratite nas
              </h2>
              <p className="text-white/80 text-base lg:text-lg mb-8 max-w-md mx-auto">
                Inspiracija, novosti i ekskluzivne ponude -- sve na jednom mestu.
              </p>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 font-semibold rounded-full hover:bg-white/90 transition-all hover:scale-105 shadow-xl"
              >
                <Instagram className="h-5 w-5" />
                Otvorite Instagram
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 lg:py-24 bg-background-alt overflow-hidden">
      <div className="container-wide">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
                <Instagram className="h-5 w-5 text-white" />
              </div>
              <h2 className="font-display text-2xl md:text-3xl lg:text-4xl text-text">
                Pratite nas
              </h2>
            </div>
            <p className="text-text-muted text-sm md:text-base">
              Najnovije inspiracije iz naše zajednice
            </p>
          </div>

          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-full text-sm font-medium text-text hover:bg-background-hover hover:border-primary/30 transition-all group"
            >
              <Instagram className="h-4 w-4 text-text-muted group-hover:text-primary transition-colors" />
              Otvorite profil
              <ArrowUpRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
            </a>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {posts.slice(0, 8).map((post, index) => {
            const mediaUrl = getMediaUrl(post);
            if (!mediaUrl) return null;

            return (
              <a
                key={post.id}
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "group relative aspect-square overflow-hidden bg-background rounded-2xl",
                  index === 0 && "md:col-span-2 md:row-span-2",
                )}
              >
                <Image
                  src={mediaUrl}
                  alt={post.caption?.slice(0, 100) || "Instagram post"}
                  fill
                  sizes={index === 0 ? "(max-width: 768px) 50vw, 50vw" : "(max-width: 768px) 50vw, 25vw"}
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  {post.media_type === "VIDEO" && (
                    <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full p-2">
                      <Play className="h-4 w-4 text-white fill-white" />
                    </div>
                  )}
                  {post.media_type === "CAROUSEL_ALBUM" && (
                    <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full p-2">
                      <Grid3X3 className="h-4 w-4 text-white" />
                    </div>
                  )}

                  {post.caption && (
                    <p className="text-white text-xs md:text-sm line-clamp-2 leading-relaxed">
                      {post.caption}
                    </p>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
