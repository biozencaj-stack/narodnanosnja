interface ProductAccordionProps {
  material?: string;
  purpose?: string;
  description?: string;
  groupName?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  factory?: string;       // Country of origin (bags/accessories) - not displayed
  manufacturer?: string;  // Manufacturer (bags/accessories)
  isBag?: boolean;
}

// Brand descriptions - add brand-specific descriptions here
const brandDescriptions: Record<string, string> = {};

// Brand video URLs - exported so parent can use it
export const brandVideos: Record<string, string> = {};

// Helper to extract YouTube video ID - exported for use in parent
export function getYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&\n?#]+)/);
  return match ? match[1] : null;
}

export function ProductAccordion({
  material,
  purpose,
  description,
  groupName,
  dimensions,
  factory: _factory, // Available but not displayed
  manufacturer,
  isBag = false,
}: ProductAccordionProps) {
  const brandDescription = groupName ? brandDescriptions[groupName.toUpperCase()] : null;

  // Check if dimensions have valid values (not 0)
  const hasValidDimensions = dimensions && (
    (dimensions.width && dimensions.width > 0) ||
    (dimensions.length && dimensions.length > 0) ||
    (dimensions.height && dimensions.height > 0)
  );

  // Check if bag has any properties to show
  const hasBagProperties = isBag && (material || manufacturer || hasValidDimensions);

  return (
    <div className="space-y-6">
      {/* Properties - Static section */}
      <div className="border-b border-border pb-4">
        <h3 className="text-base font-medium text-text mb-3">Svojstva</h3>
        {isBag ? (
          <ul className="space-y-2 text-sm text-text-muted">
            {material && (
              <li>• Materijal: {material}</li>
            )}
            {manufacturer && (
              <li>• Proizvođač: {manufacturer}</li>
            )}
            {hasValidDimensions && (
              <>
                {dimensions!.width && dimensions!.width > 0 && (
                  <li>• Širina: {dimensions!.width} cm</li>
                )}
                {dimensions!.length && dimensions!.length > 0 && (
                  <li>• Dužina: {dimensions!.length} cm</li>
                )}
                {dimensions!.height && dimensions!.height > 0 && (
                  <li>• Visina: {dimensions!.height} cm</li>
                )}
              </>
            )}
            {!hasBagProperties && (
              <li className="text-text-muted">Informacije nisu dostupne.</li>
            )}
          </ul>
        ) : (
          <ul className="space-y-2 text-sm text-text-muted">
            {material && (
              <li>• Materijal: {material}</li>
            )}
            {purpose && (
              <li>• Namena: {purpose}</li>
            )}
          </ul>
        )}
      </div>

      {/* Description / Brand info - Static section */}
      <div className="border-b border-border pb-4">
        <h3 className="text-base font-medium text-text mb-3">Detalji</h3>
        <div className="space-y-4 text-sm text-text-muted">
          {description && (
            <p>{description}</p>
          )}
          {brandDescription && (
            <p>{brandDescription}</p>
          )}
          {!description && !brandDescription && (
            <p>Opis nije dostupan.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Separate Video component to be used after size selector
interface ProductVideoProps {
  groupName?: string;
}

export function ProductVideo({ groupName }: ProductVideoProps) {
  const videoUrl = groupName ? brandVideos[groupName.toUpperCase()] : null;
  const videoId = videoUrl ? getYouTubeVideoId(videoUrl) : null;

  // Don't render anything if no video
  if (!videoId) return null;

  return (
    <div className="border-t border-border pt-6">
      <h3 className="text-base font-medium text-text mb-3">Video</h3>
      <div className="aspect-video w-full">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="Video o brendu"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full rounded-lg"
        />
      </div>
    </div>
  );
}
