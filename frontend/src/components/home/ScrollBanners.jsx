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
 * Banner 5: Hair Care & Personal Beauty (Full-bleed user image with functional CTA buttons)
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
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-3xl shadow-2xl select-none"
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
          <div className="relative rounded-3xl bg-emerald-950 text-white p-8 md:p-14 lg:p-16 overflow-hidden shadow-2xl min-h-[500px] md:min-h-[520px] flex flex-col justify-center">
            {/* Background Image Layer */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              <img
                src="/images/banners/banner2-snacks.jpg"
                alt=""
                className="absolute right-0 top-0 w-full sm:w-4/5 lg:w-[58%] h-full object-cover object-right opacity-90 scale-105 animate-cinematic-pan"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-950/95 via-35% sm:via-48% to-transparent z-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-emerald-950/40 z-10" />
              <div className="absolute right-1/4 top-1/4 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl animate-soft-float z-10" />
            </div>

            {/* Content Layer */}
            <div className="relative z-20 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-xs font-semibold text-emerald-300">
                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                100% Genuine · Quality Assured Snacks
              </div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
                Good Food. <br />
                <span className="text-emerald-400">Better Prices.</span>
              </h2>
              <p className="text-base md:text-lg text-emerald-100/90 leading-relaxed font-normal">
                Discover wholesome organic snacks, artisan granola, and pantry favorites from verified local grocers at dynamic discounts before expiry.
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
          </div>
        </div>

        {/* =========================================================
            BANNER 3: HOUSEHOLD ESSENTIALS (From Reference 2)
            ========================================================= */}
        <div className="w-full flex-shrink-0 snap-center min-w-full">
          <div className="relative rounded-3xl bg-slate-950 text-white p-8 md:p-14 lg:p-16 overflow-hidden shadow-2xl min-h-[500px] md:min-h-[520px] flex flex-col justify-center">
            {/* Background Image Layer */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              <img
                src="/images/banners/banner3-household.jpg"
                alt=""
                className="absolute right-0 top-0 w-full sm:w-4/5 lg:w-[58%] h-full object-cover object-right opacity-90 scale-105 animate-cinematic-pan"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 via-35% sm:via-48% to-transparent z-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40 z-10" />
              <div className="absolute right-1/4 top-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl animate-soft-float z-10" />
            </div>

            {/* Content Layer */}
            <div className="relative z-20 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 backdrop-blur-md border border-cyan-400/30 text-xs font-semibold text-cyan-200">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
                Everyday Home & Care Essentials
              </div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
                Everyday Essentials. <br />
                <span className="text-cyan-300">Smarter Prices.</span>
              </h2>
              <p className="text-base md:text-lg text-cyan-100/90 leading-relaxed font-normal">
                Stock up on top-quality cleaning products, paper goods, and daily home essentials from your neighborhood supermarkets at steep dynamic markdowns.
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
          </div>
        </div>

        {/* =========================================================
            BANNER 4: PHARMACY & WELLNESS (From Reference 3)
            ========================================================= */}
        <div className="w-full flex-shrink-0 snap-center min-w-full">
          <div className="relative rounded-3xl bg-teal-950 text-white p-8 md:p-14 lg:p-16 overflow-hidden shadow-2xl min-h-[500px] md:min-h-[520px] flex flex-col justify-center">
            {/* Background Image Layer */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              <img
                src="/images/banners/banner4-pharmacy.jpg"
                alt=""
                className="absolute right-0 top-0 w-full sm:w-4/5 lg:w-[58%] h-full object-cover object-right opacity-90 scale-105 animate-cinematic-pan"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-teal-950 via-teal-950/95 via-35% sm:via-48% to-transparent z-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-teal-950/80 via-transparent to-teal-950/40 z-10" />
              <div className="absolute right-1/4 top-1/4 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl animate-soft-float z-10" />
            </div>

            {/* Content Layer */}
            <div className="relative z-20 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-xs font-semibold text-emerald-300">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Health, Wellness & Nutrition Essentials
              </div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
                Better Wellness. <br />
                <span className="text-emerald-400">Smart Savings.</span>
              </h2>
              <p className="text-base md:text-lg text-emerald-100/90 leading-relaxed font-normal">
                Find genuine dietary supplements, daily vitamins, and wellness essentials verified under NearExpiry's strict FEFO expiry protocols.
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
          </div>
        </div>

        {/* =========================================================
            BANNER 5: HAIR CARE & BEAUTY (Using Attached Banner 5 Image)
            ========================================================= */}
        <div className="w-full flex-shrink-0 snap-center min-w-full">
          <div className="relative rounded-3xl bg-stone-950 text-white overflow-hidden shadow-2xl min-h-[500px] md:min-h-[520px] flex flex-col justify-center">
            {/* The exact cinematic Banner 5 image provided by user */}
            <img
              src="/images/banners/banner5-beauty-cinematic.jpg"
              alt="Care More. Spend Less. - Personal Care & Hair Beauty Rescue"
              className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
              loading="lazy"
            />

            {/* Seamless subtle depth vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none z-10" />

            {/* 100% Fully Functional Clickable Buttons over the image buttons */}
            <div className="relative z-20 w-full h-full min-h-[500px] md:min-h-[520px] flex flex-col justify-end p-6 sm:p-10 md:p-14 lg:p-16 pointer-events-none">
              <div className="max-w-2xl space-y-4">
                {/* Desktop and Tablet Interactive Buttons aligned over the image */}
                <div className="hidden sm:flex items-center gap-4 pointer-events-auto pt-44 md:pt-48 lg:pt-56">
                  <Link
                    to="/marketplace"
                    className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-sm rounded-xl shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    Browse Today's Deals
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/register-seller"
                    className="px-6 py-3.5 bg-black/50 hover:bg-black/80 text-white font-semibold text-sm rounded-xl backdrop-blur-md border border-white/30 transition-all duration-200 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Store className="w-4 h-4" />
                    Become a Retail Partner
                  </Link>
                </div>

                {/* Mobile Tap-Friendly Buttons */}
                <div className="sm:hidden flex flex-col gap-2 pointer-events-auto pt-40">
                  <Link
                    to="/marketplace"
                    className="w-full py-3 bg-amber-400 text-gray-950 font-bold text-sm rounded-xl text-center flex items-center justify-center gap-2 shadow-lg"
                  >
                    Browse Today's Deals
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/register-seller"
                    className="w-full py-2.5 bg-black/70 text-white font-semibold text-xs rounded-xl backdrop-blur-md border border-white/20 text-center flex items-center justify-center gap-2"
                  >
                    <Store className="w-4 h-4" />
                    Become a Retail Partner
                  </Link>
                </div>
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
