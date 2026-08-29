'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { StarRating, StarRatingCompact } from '@/components/ui/StarRating';
import { CheckCircle, Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  verified: boolean;
  createdAt: string;
  user: {
    name: string;
  };
}

interface ReviewStats {
  count: number;
  average: number;
  distribution: Record<number, number>;
}

interface ProductReviewsProps {
  productCode: string;
  onStatsChange?: (stats: ReviewStats) => void;
}

export function ProductReviews({ productCode, onStatsChange }: ProductReviewsProps) {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>({ count: 0, average: 0, distribution: {} });
  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState<boolean | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');

  // Fetch reviews
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch(`/api/reviews/${encodeURIComponent(productCode)}`);
        if (response.ok) {
          const data = await response.json();
          setReviews(data.reviews);
          setStats(data.stats);
          onStatsChange?.(data.stats);
        }
      } catch (err) {
        console.error('Error fetching reviews:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [productCode, onStatsChange]);

  // Check if user can review (has purchased the product)
  useEffect(() => {
    if (!session?.user) {
      setCanReview(false);
      return;
    }

    // Check if user already has a review
    const userReview = reviews.find(r => r.user.name.startsWith(session.user.firstName || ''));
    if (userReview) {
      setCanReview(false);
      return;
    }

    // For simplicity, we'll let the API check if user can review when they submit
    // This avoids an extra API call
    setCanReview(true);
  }, [session, reviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Molimo izaberite ocenu');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(productCode)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, title, comment }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Greška pri slanju recenzije');
        return;
      }

      // Add new review to list
      setReviews(prev => [data.review, ...prev]);

      // Update stats
      const newCount = stats.count + 1;
      const newAverage = ((stats.average * stats.count) + rating) / newCount;
      const newStats = {
        count: newCount,
        average: newAverage,
        distribution: {
          ...stats.distribution,
          [rating]: (stats.distribution[rating] || 0) + 1,
        },
      };
      setStats(newStats);
      onStatsChange?.(newStats);

      // Reset form
      setRating(0);
      setTitle('');
      setComment('');
      setShowForm(false);
      setCanReview(false);
    } catch {
      setError('Greška pri slanju recenzije');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Da li ste sigurni da želite da obrišete recenziju?')) return;

    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(productCode)}/${reviewId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const deletedReview = reviews.find(r => r.id === reviewId);
        setReviews(prev => prev.filter(r => r.id !== reviewId));

        // Update stats
        if (deletedReview && stats.count > 0) {
          const newCount = stats.count - 1;
          const newAverage = newCount > 0
            ? ((stats.average * stats.count) - deletedReview.rating) / newCount
            : 0;
          const newStats = {
            count: newCount,
            average: newAverage,
            distribution: {
              ...stats.distribution,
              [deletedReview.rating]: Math.max(0, (stats.distribution[deletedReview.rating] || 0) - 1),
            },
          };
          setStats(newStats);
          onStatsChange?.(newStats);
        }

        setCanReview(true);
      }
    } catch (err) {
      console.error('Error deleting review:', err);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-stone-900">
            Recenzije kupaca
          </h2>
          {stats.count > 0 ? (
            <div className="flex items-center gap-2 mt-1">
              <StarRating rating={stats.average} size="md" />
              <span className="text-stone-600">
                {stats.average.toFixed(1)} ({stats.count} {stats.count === 1 ? 'recenzija' : 'recenzija'})
              </span>
            </div>
          ) : (
            <p className="text-stone-500 mt-1">Ovaj proizvod još nema recenzija</p>
          )}
        </div>

        {/* Add review button */}
        {session?.user && canReview && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
          >
            Napišite recenziju
          </button>
        )}
      </div>

      {/* Review form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-stone-50 rounded-xl p-6 space-y-4">
          <h3 className="font-medium text-stone-900">Vaša recenzija</h3>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Ocena *
            </label>
            <StarRating
              rating={rating}
              size="lg"
              interactive
              onChange={setRating}
            />
          </div>

          {/* Title */}
          <div>
            <label htmlFor="review-title" className="block text-sm font-medium text-stone-700 mb-1">
              Naslov (opciono)
            </label>
            <input
              id="review-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Npr. Odlična obuća!"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              maxLength={100}
            />
          </div>

          {/* Comment */}
          <div>
            <label htmlFor="review-comment" className="block text-sm font-medium text-stone-700 mb-1">
              Komentar (opciono)
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Podelite vaše iskustvo sa ovim proizvodom..."
              rows={4}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              maxLength={1000}
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Pošalji recenziju
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setRating(0);
                setTitle('');
                setComment('');
                setError(null);
              }}
              className="px-4 py-2 bg-stone-200 text-stone-700 rounded-lg hover:bg-stone-300 transition-colors text-sm"
            >
              Otkaži
            </button>
          </div>
        </form>
      )}

      {/* Message for non-logged in users */}
      {!session?.user && (
        <div className="bg-stone-50 rounded-xl p-4 text-center">
          <MessageSquare className="h-8 w-8 text-stone-400 mx-auto mb-2" />
          <p className="text-stone-600">
            <a href="/prijava" className="text-primary hover:underline font-medium">Prijavite se</a>
            {' '}da biste ostavili recenziju
          </p>
        </div>
      )}

      {/* Reviews list */}
      {reviews.length > 0 && (
        <div className="divide-y divide-stone-200">
          {reviews.map((review) => (
            <div key={review.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <StarRating rating={review.rating} size="sm" />
                    {review.verified && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle className="h-3 w-3" />
                        Verifikovan kupac
                      </span>
                    )}
                  </div>

                  {review.title && (
                    <h4 className="font-medium text-stone-900">{review.title}</h4>
                  )}

                  {review.comment && (
                    <p className="text-stone-600 mt-1">{review.comment}</p>
                  )}

                  <div className="flex items-center gap-2 mt-2 text-sm text-stone-500">
                    <span>{review.user.name}</span>
                    <span>•</span>
                    <span>{new Date(review.createdAt).toLocaleDateString('sr-RS')}</span>
                  </div>
                </div>

                {/* Delete button for owner/admin */}
                {session?.user && (
                  (session.user.role === 'ADMIN' || review.user.name.startsWith(session.user.firstName || '')) && (
                    <button
                      onClick={() => handleDelete(review.id)}
                      className="p-2 text-stone-400 hover:text-red-600 transition-colors"
                      title="Obriši recenziju"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rating distribution */}
      {stats.count > 0 && (
        <div className="bg-stone-50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-stone-700 mb-3">Distribucija ocena</h4>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.distribution[star] || 0;
              const percentage = stats.count > 0 ? (count / stats.count) * 100 : 0;

              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-sm text-stone-600 w-6">{star}★</span>
                  <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-stone-500 w-8">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
