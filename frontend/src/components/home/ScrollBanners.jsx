import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Store,
  Leaf,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * ScrollBanners
 *
 * Horizontal scroll-to-right multi-banner hero sequence:
 * Banner 1: Exact, 100% unmodified NearExpiry Hero
 * Banner 2: Grocery & Balanced Snacks (from Reference 1)
 * Banner 3: Everyday Household & Cleaners (from Reference 2)
 * Banner 4: Health, Wellness & Nutrition (from Reference 3)
 * Banner 5: Hair Care & Personal Beauty (from Reference 4)
 *
 * Every banner contains the identical two CTA buttons:
 * 1. "Browse Today's Deals" -> /marketplace
 * 2. "Become a Retail Partner" -> /register-seller
 */
export const ScrollBanners = () => {
  const scrollRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalBanners = 5;

  const bannerLabels = [
    'Grocery Rescue',
    'Healthy Snacks',
    'Everyday Household',
    'Health & Wellness',
    'Hair Care & Beauty',
  ];

  // Listen to horizontal scroll events to update active dot
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    if (clientWidth > 0) {
      const index = Math.round(scrollLeft / clientWidth);
      setCurrentIndex(Math.max(0, Math.min(totalBanners - 1, index)));
    }
  }, [totalBanners]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Navigate to previous banner
  const scrollPrev = () => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    scrollRef.current.scrollBy({ left: -clientWidth, behavior: 'smooth' });
  };

  // Navigate to next banner
  const scrollNext = () => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    scrollRef.current.scrollBy({ left: clientWidth, behavior: 'smooth' });
  };

  // Jump directly to specific banner index
  const scrollToBanner = (index) => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({
      left: index * clientWidth,
      behavior: 'smooth',
    });
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative group">
      {/* Horizontal Scroll Track */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-3xl shadow-2xl"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* =========================================================
            BANNER 1: EXISTING NEAREXPIRY HERO (100% UNCHANGED)
            ========================================================= */}
        <div className="w-full flex-shrink-0 snap-center min-w-full">
          <div className="relative rounded-3xl bg-gradient-to-br from-brand-700 via-emerald-800 to-slate-900 text-white p-8 md:p-16 overflow-hidden shadow-2xl min-h-[500px] md:min-h-[520px] flex flex-col justify-center">
            <div className="relative z-10 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Dynamic Hyperlocal Grocery Rescue
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
                Eat Fresh, <br />
                <span className="text-amber-300">Save Big,</span> <br />
                Waste Nothing.
              </h1>
              <p className="text-base md:text-lg text-emerald-100/90 leading-relaxed font-normal">
                NearExpiry connects local neighborhood supermarkets with smart shoppers. Enjoy genuine groceries at steep dynamic discounts before they expire.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/marketplace"
                  className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition flex items-center gap-2"
                >
                  Browse Today's Deals
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/register-seller"
                  className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl backdrop-blur-md border border-white/20 transition flex items-center gap-2"
                >
                  <Store className="w-4 h-4" />
                  Become a Retail Partner
                </Link>
              </div>
            </div>

            {/* Decorative Floating Badges */}
            <div className="absolute -bottom-8 -right-8 opacity-20 pointer-events-none text-9xl">
              ⏳
            </div>
          </div>
        </div>

        {/* =========================================================
            BANNER 2: SNACKS & GROCERY (From Reference 1)
            ========================================================= */}
        <div className="w-full flex-shrink-0 snap-center min-w-full">
          <div className="relative rounded-3xl bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-950 text-white p-8 md:p-14 lg:p-16 overflow-hidden shadow-2xl min-h-[500px] md:min-h-[520px] flex flex-col justify-center">
            <div className="absolute -right-20 -top-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-6 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-xs font-semibold text-emerald-300">
                  <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                  100% Genuine · Quality Assured Snacks
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight leading-tight">
                  Good Food. <br />
                  <span className="text-emerald-400">Better Prices.</span>
                </h2>
                <p className="text-base md:text-lg text-emerald-100/90 leading-relaxed font-normal">
                  Discover wholesome organic snacks, artisan granola, and pantry favorites from verified local grocers at dynamic discounts before expiry.
                </p>
                {/* Same 2 buttons */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    to="/marketplace"
                    className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition flex items-center gap-2"
                  >
                    Browse Today's Deals
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/register-seller"
                    className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl backdrop-blur-md border border-white/20 transition flex items-center gap-2"
                  >
                    <Store className="w-4 h-4" />
                    Become a Retail Partner
                  </Link>
                </div>
              </div>
              <div className="lg:col-span-5 flex justify-center lg:justify-end">
                <div className="relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-black/30 backdrop-blur-sm max-w-md w-full">
                  <img
                    src="/images/banners/banner2-snacks.jpg"
                    alt="NearExpiry Balanced Organic Snacks"
                    className="w-full h-56 sm:h-64 md:h-72 object-cover object-center"
                    loading="lazy"
                  />
                  <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                      <Leaf className="w-3.5 h-3.5" /> Healthy Snack Rescue
                    </span>
                    <span className="text-amber-300 font-bold">Up to 70% Off</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            BANNER 3: HOUSEHOLD ESSENTIALS (Whole Background Image)
            ========================================================= */}
        <div className="w-full flex-shrink-0 snap-center min-w-full">
          <div className="relative rounded-3xl bg-cyan-950 text-white p-8 md:p-14 lg:p-16 overflow-hidden shadow-2xl min-h-[500px] md:min-h-[520px] flex flex-col justify-center">
            {/* Whole Background Image */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              <img
                src="/images/banners/banner3-household.jpg"
                onError={(e) => {
                  if (!e.target.dataset.triedJpeg) {
                    e.target.dataset.triedJpeg = 'true';
                    e.target.src = '/images/banners/banner3-household.jpeg';
                  }
                }}
                alt="NearExpiry Everyday Household Essentials"
                className="w-full h-full object-cover object-center scale-105 animate-cinematic-pan"
                loading="eager"
              />
              {/* Dark gradient overlays so text remains 100% crisp and readable over the background */}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/70 to-slate-950/20 z-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/30 z-10" />
              <div className="absolute right-1/4 top-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl animate-soft-float z-10" />
            </div>

            {/* Foreground UI Layer with full functionality */}
            <div className="relative z-20 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 backdrop-blur-md border border-cyan-400/30 text-xs font-semibold text-cyan-200">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
                Everyday Home & Care Essentials
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight leading-tight">
                Everyday Essentials. <br />
                <span className="text-cyan-300">Smarter Prices.</span>
              </h2>
              <p className="text-base md:text-lg text-cyan-100/90 leading-relaxed font-normal">
                Stock up on top-quality cleaning products, paper goods, and daily home essentials from your neighborhood supermarkets at steep dynamic markdowns.
              </p>
              {/* Same 2 functional CTA buttons just like other banners */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/marketplace"
                  className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition flex items-center gap-2"
                >
                  Browse Today's Deals
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/register-seller"
                  className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl backdrop-blur-md border border-white/20 transition flex items-center gap-2"
                >
                  <Store className="w-4 h-4" />
                  Become a Retail Partner
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            BANNER 4: PHARMACY & WELLNESS (Whole Background Image)
            ========================================================= */}
        <div className="w-full flex-shrink-0 snap-center min-w-full">
          <div className="relative rounded-3xl bg-teal-950 text-white p-8 md:p-14 lg:p-16 overflow-hidden shadow-2xl min-h-[500px] md:min-h-[520px] flex flex-col justify-center">
            {/* Whole Background Image */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              <img
                src="/images/banners/banner4-pharmacy.jpeg"
                alt="NearExpiry Health, Wellness and Pharmacy Rescue"
                className="w-full h-full object-cover object-center scale-105 animate-cinematic-pan"
                loading="lazy"
              />
              {/* Dark gradient overlays so text remains 100% crisp and readable over the background */}
              <div className="absolute inset-0 bg-gradient-to-r from-teal-950/95 via-teal-950/70 to-teal-950/20 z-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-teal-950/80 via-transparent to-teal-950/30 z-10" />
              <div className="absolute right-1/4 top-1/4 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl animate-soft-float z-10" />
            </div>

            {/* Foreground UI Layer with full functionality */}
            <div className="relative z-20 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-xs font-semibold text-emerald-300">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Health, Wellness & Nutrition Essentials
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight leading-tight">
                Better Wellness. <br />
                <span className="text-emerald-400">Smart Savings.</span>
              </h2>
              <p className="text-base md:text-lg text-emerald-100/90 leading-relaxed font-normal">
                Find genuine dietary supplements, daily vitamins, and wellness essentials verified under NearExpiry's strict FEFO expiry protocols.
              </p>
              {/* Same 2 functional CTA buttons just like other banners */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/marketplace"
                  className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition flex items-center gap-2"
                >
                  Browse Today's Deals
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/register-seller"
                  className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl backdrop-blur-md border border-white/20 transition flex items-center gap-2"
                >
                  <Store className="w-4 h-4" />
                  Become a Retail Partner
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            BANNER 5: HAIR CARE & BEAUTY (Whole Background Image)
            ========================================================= */}
        <div className="w-full flex-shrink-0 snap-center min-w-full">
          <div className="relative rounded-3xl bg-stone-950 text-white p-8 md:p-14 lg:p-16 overflow-hidden shadow-2xl min-h-[500px] md:min-h-[520px] flex flex-col justify-center">
            {/* Whole Background Image */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              <img
                src="/images/banners/banner5-beauty.jpg"
                alt="NearExpiry Personal Care and Hair Beauty Rescue"
                className="w-full h-full object-cover object-center scale-105 animate-cinematic-pan"
                loading="lazy"
              />
              {/* Subtle dark gradient overlay so text remains 100% crisp and readable */}
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/90 via-stone-950/60 to-transparent z-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-stone-950/30 z-10" />
              <div className="absolute right-1/4 top-1/4 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl animate-soft-float z-10" />
            </div>

            {/* Foreground UI Layer with full functionality */}
            <div className="relative z-20 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-400/30 text-xs font-semibold text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Personal Care & Hair Beauty Rescue
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight leading-tight">
                Care More. <br />
                <span className="text-amber-300">Spend Less.</span>
              </h2>
              <p className="text-base md:text-lg text-amber-100/90 leading-relaxed font-normal">
                Discover premium hair care, nourishing serums, and personal care essentials rescued from supermarket surplus at remarkable price cuts before expiry.
              </p>
              {/* Same 2 functional CTA buttons just like other banners */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/marketplace"
                  className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition flex items-center gap-2"
                >
                  Browse Today's Deals
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/register-seller"
                  className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl backdrop-blur-md border border-white/20 transition flex items-center gap-2"
                >
                  <Store className="w-4 h-4" />
                  Become a Retail Partner
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          LEFT & RIGHT FLOATING ARROW NAVIGATION (Always Visible & Prominent)
          ========================================================= */}
      <button
        onClick={scrollPrev}
        disabled={currentIndex === 0}
        className={`absolute left-7 sm:left-10 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-white/30 shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95 ${
          currentIndex === 0 ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'opacity-90 hover:opacity-100 cursor-pointer'
        }`}
        aria-label="Previous banner"
      >
        <ChevronLeft className="w-7 h-7 text-white" />
      </button>

      <button
        onClick={scrollNext}
        disabled={currentIndex === totalBanners - 1}
        className={`absolute right-7 sm:right-10 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-white/30 shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95 ${
          currentIndex === totalBanners - 1 ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'opacity-90 hover:opacity-100 cursor-pointer'
        }`}
        aria-label="Next banner"
      >
        <ChevronRight className="w-7 h-7 text-white" />
      </button>

      {/* =========================================================
          BOTTOM SLIDE INDICATORS & CONTROLS
          ========================================================= */}
      <div className="absolute bottom-5 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 shadow-2xl text-white">
        <span className="text-xs font-bold text-amber-300">
          {currentIndex + 1} / {totalBanners}
        </span>
        <span className="text-xs text-white/90 font-medium hidden sm:inline border-r border-white/25 pr-3">
          {bannerLabels[currentIndex]}
        </span>

        {/* 5 Dots */}
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3, 4].map((idx) => {
            const isActive = currentIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => scrollToBanner(idx)}
                className={`transition-all duration-300 rounded-full ${
                  isActive
                    ? 'w-8 h-2.5 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]'
                    : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/80'
                }`}
                aria-label={`Jump to banner ${idx + 1}: ${bannerLabels[idx]}`}
                title={bannerLabels[idx]}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};
export default ScrollBanners;
