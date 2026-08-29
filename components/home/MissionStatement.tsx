"use client";

export function MissionStatement() {
  return (
    <section className="relative py-20 lg:py-28 bg-[#faf9f7] overflow-hidden">
      {/* Decorative curved lines - SVG background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.15]">
        {/* Top left curve */}
        <svg
          className="absolute -top-20 -left-20 w-80 h-80"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="100"
            cy="100"
            r="80"
            stroke="#4F46E5"
            strokeWidth="0.5"
            fill="none"
          />
          <circle
            cx="100"
            cy="100"
            r="60"
            stroke="#4F46E5"
            strokeWidth="0.5"
            fill="none"
          />
        </svg>

        {/* Center decorative element */}
        <svg
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px]"
          viewBox="0 0 600 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Large gentle curves */}
          <path
            d="M0 200 Q150 100, 300 200 T600 200"
            stroke="#4F46E5"
            strokeWidth="0.5"
            fill="none"
          />
          <path
            d="M0 220 Q150 120, 300 220 T600 220"
            stroke="#4F46E5"
            strokeWidth="0.5"
            fill="none"
          />
          <path
            d="M0 180 Q150 80, 300 180 T600 180"
            stroke="#4F46E5"
            strokeWidth="0.5"
            fill="none"
          />

          {/* Vertical gentle curve */}
          <path
            d="M300 0 Q350 200, 300 400"
            stroke="#4F46E5"
            strokeWidth="0.5"
            fill="none"
          />
          <path
            d="M280 0 Q330 200, 280 400"
            stroke="#4F46E5"
            strokeWidth="0.5"
            fill="none"
          />
          <path
            d="M320 0 Q370 200, 320 400"
            stroke="#4F46E5"
            strokeWidth="0.5"
            fill="none"
          />
        </svg>

        {/* Bottom right curve */}
        <svg
          className="absolute -bottom-20 -right-20 w-80 h-80"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="100"
            cy="100"
            r="80"
            stroke="#4F46E5"
            strokeWidth="0.5"
            fill="none"
          />
          <circle
            cx="100"
            cy="100"
            r="60"
            stroke="#4F46E5"
            strokeWidth="0.5"
            fill="none"
          />
          <circle
            cx="100"
            cy="100"
            r="40"
            stroke="#4F46E5"
            strokeWidth="0.5"
            fill="none"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="container-wide relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-display text-xl md:text-2xl lg:text-3xl text-text leading-relaxed italic">
            &ldquo;Kvalitet, stil i pristupačnost &mdash; sve na jednom mestu.&rdquo;
          </p>
        </div>
      </div>
    </section>
  );
}
