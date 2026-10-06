import React, { useState } from 'react';
import { Sparkles, Check, Copy, ArrowRight, ShoppingBag, ShieldCheck } from 'lucide-react';

/**
 * PromotionalBannerSection
 *
 * Matching pixel-for-pixel with reference UI screenshot:
 * - Warm cream/beige background banner (#f7f4ed / #faf7f2) with rounded corners
 * - Left Column:
 *   - Bold chunky headline: "Get 10% off your first order" ("10% off" in brand green)
 *   - Subtitle: "Subscribe to our newsletter for exclusive deals, tips and sustainability updates. Your code appears right away."
 *   - Clean email input + dark green button: "Get my 10% code"
 *   - Immediate interactive code reveal ("RESCUE10" with instant copy button)
 * - Right Column:
 *   - Angled soft coral/pink accent cutout backdrop
 *   - Green NearExpiry eco grocery tote bag & surplus goods spread (beverages, healthy snacks, essentials)
 */
export const PromotionalBannerSection = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText('RESCUE10');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-8 sm:my-12">
      <div className="relative rounded-[28px] sm:rounded-3xl bg-[#f6f3ea] border border-[#ebe5d8] p-8 sm:p-12 lg:p-16 overflow-hidden shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* ========================================================
              LEFT COLUMN: Headline, Text, Input + CTA
              ======================================================== */}
          <div className="lg:col-span-7 space-y-5 text-left">
            {/* Main Headline */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-black text-gray-950 tracking-tight leading-[1.1]">
              Get <span className="text-[#15803d]">10% off</span> <br />
              your first order
            </h2>

            {/* Supporting Copy */}
            <p className="text-sm sm:text-base text-gray-600 font-normal leading-relaxed max-w-lg">
              Subscribe to our newsletter for exclusive deals, tips and sustainability updates. Your code appears right away.
            </p>

            {/* Email Input + Button OR Revealed Code */}
            {!submitted ? (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 max-w-lg">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 px-4 py-3 sm:py-3.5 bg-white border border-gray-200 rounded-xl sm:rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-xs transition"
                />
                <button
                  type="submit"
                  className="px-6 py-3 sm:py-3.5 bg-[#0f5132] hover:bg-[#0c4128] text-white font-bold text-sm sm:text-base rounded-xl sm:rounded-2xl shadow-sm hover:shadow transition flex items-center justify-center whitespace-nowrap active:scale-98"
                >
                  Get my 10% code
                </button>
              </form>
            ) : (
              <div className="pt-2 max-w-lg">
                <div className="bg-white border-2 border-emerald-500/50 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Code Unlocked! 10% Off Applied</span>
                    </div>
                    <div className="font-mono text-xl font-black text-gray-900 tracking-wider">
                      RESCUE10
                    </div>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Copied to Clipboard</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Subtle disclaimer */}
            <p className="text-[11px] text-gray-400">
              Valid on all near-expiry items & surplus groceries. No minimum order required.
            </p>
          </div>

          {/* ========================================================
              RIGHT COLUMN: Eco Bag & Products Visual Composition
              ======================================================== */}
          <div className="lg:col-span-5 relative flex items-center justify-center pt-4 lg:pt-0">
            {/* Playful angled pastel accent shape (matching reference image) */}
            <div className="relative w-full max-w-[380px] sm:max-w-[420px] aspect-[4/3] flex items-center justify-center">
              
              {/* Tilted soft coral/pink polygon background */}
              <div className="absolute inset-0 bg-[#f8cfcb]/70 rounded-[32px] transform rotate-3 scale-95 transition-transform duration-500 hover:rotate-1" />

              {/* Main Illustration / Photo Container */}
              <div className="relative z-10 w-[92%] h-[92%] rounded-2xl overflow-hidden bg-white/40 shadow-sm border border-white/60">
                <img
                  src="/images/banners/banner1-NearExpiry.jpg"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80';
                  }}
                  alt="NearExpiry 10% Off Grocery Rescue Bag & Essentials"
                  className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700"
                />
                
                {/* Brand Green Bag Badge Overlay */}
                <div className="absolute top-3 right-3 bg-[#15803d] text-white px-3 py-1 rounded-xl text-xs font-black shadow-md flex items-center gap-1">
                  <span>10% OFF</span>
                </div>

                <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/80 shadow-xs flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs font-bold text-gray-900">NearExpiry Rescue Bag</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default PromotionalBannerSection;
